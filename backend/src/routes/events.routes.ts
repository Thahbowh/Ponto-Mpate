import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  title: z.string().trim().min(3).max(120), // neutral label only, no personal details
  eventDate: z.coerce.date(),
  homeWardId: z.string().min(1),
  bereavedHouseholdId: z.string().min(1, "Choose the household holding the funeral"),
  contributionAmount: z.coerce.number().positive().max(100000).optional(),
});

router.get("/", async (_req, res, next) => {
  try {
    const events = await prisma.funeralEvent.findMany({
      orderBy: { eventDate: "desc" },
      include: {
        homeWard: { select: { id: true, name: true } },
        _count: { select: { obligations: true } },
      },
    });
    res.json({ success: true, data: events });
  } catch (err) {
    next(err);
  }
});

// Rule: only households in the funeral's own ward pay, the household holding the funeral is exempt,
// and the members of the paying households (that ward only) are sent a message.
router.post("/", authorize("ADMIN"), async (req, res, next) => {
  try {
    const input = createSchema.parse(req.body);

    const homeWard = await prisma.ward.findUnique({ where: { id: input.homeWardId } });
    if (!homeWard || !homeWard.isActive) {
      return res
        .status(400)
        .json({ success: false, error: { message: "Home ward does not exist or is inactive" } });
    }

    const bereaved = await prisma.household.findFirst({
      where: { id: input.bereavedHouseholdId, wardId: homeWard.id, isActive: true },
      select: { id: true, reference: true, householdName: true },
    });
    if (!bereaved) {
      return res.status(400).json({
        success: false,
        error: { message: "The household holding the funeral must be an active household in the home ward" },
      });
    }

    const eligibleWardIds = [homeWard.id];

    // The server decides the amount: explicit value, otherwise the scheme default
    let amount: Prisma.Decimal;
    if (input.contributionAmount !== undefined) {
      amount = new Prisma.Decimal(input.contributionAmount.toFixed(2));
    } else {
      const setting = await prisma.setting.findUnique({ where: { id: 1 } });
      if (!setting) {
        return res.status(400).json({
          success: false,
          error: { message: "No default contribution amount is configured" },
        });
      }
      amount = setting.defaultContributionAmount;
    }

    const households = await prisma.household.findMany({
      where: { wardId: homeWard.id, isActive: true, id: { not: bereaved.id } },
      select: { id: true },
    });
    if (households.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: "There are no other active households in this ward to contribute" },
      });
    }

    const year = input.eventDate.getFullYear();

    const outcome = await prisma.$transaction(async (tx) => {
      const count = await tx.funeralEvent.count({
        where: { reference: { startsWith: `FE-${year}-` } },
      });
      const reference = `FE-${year}-${String(count + 1).padStart(3, "0")}`;

      const created = await tx.funeralEvent.create({
        data: {
          reference,
          title: input.title,
          eventDate: input.eventDate,
          contributionAmount: amount,
          homeWardId: input.homeWardId,
          bereavedHouseholdId: bereaved.id,
          createdById: req.user!.id,
        },
      });

      await tx.eventEligibleWard.createMany({
        data: eligibleWardIds.map((wardId) => ({ eventId: created.id, wardId })),
      });

      await tx.contributionObligation.createMany({
        data: households.map((h) => ({
          eventId: created.id,
          householdId: h.id,
          amountDue: amount,
        })),
      });

      // Message the approved members of the paying households in this ward, and nobody else
      const householdIds = households.map((h) => h.id);
      const members = await tx.householdMember.findMany({
        where: { status: "APPROVED", householdId: { in: householdIds } },
        select: { userId: true, householdId: true },
      });
      const userIds = [...new Set(members.map((m) => m.userId))];
      if (userIds.length > 0) {
        await tx.notification.createMany({
          data: userIds.map((userId) => ({
            userId,
            eventId: created.id,
            title: "Funeral contribution due",
            message: `A funeral has been announced in ${homeWard.name}. Your household's contribution is R${amount.toFixed(2)} for ${reference} (${input.title}). You can pay online or at a participating shop from your Contributions page.`,
          })),
        });
      }
      const covered = new Set(members.map((m) => m.householdId));
      const householdsWithoutMember = householdIds.filter((id) => !covered.has(id)).length;

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "EVENT_CREATED",
          entityType: "FuneralEvent",
          entityId: created.id,
          details: {
            reference,
            ward: homeWard.name,
            exemptHousehold: bereaved.reference,
            households: households.length,
            contributionAmount: amount.toFixed(2),
            membersNotified: userIds.length,
            householdsWithoutMember,
          },
        },
      });

      return { created, membersNotified: userIds.length, householdsWithoutMember };
    });

    const event = outcome.created;
    res.status(201).json({
      success: true,
      data: {
        id: event.id,
        reference: event.reference,
        title: event.title,
        eventDate: event.eventDate,
        status: event.status,
        contributionAmount: amount.toFixed(2),
        ward: homeWard.name,
        eligibleWards: eligibleWardIds.length,
        households: households.length,
        expectedTotal: amount.mul(households.length).toFixed(2),
        exemptHousehold: { reference: bereaved.reference, householdName: bereaved.householdName },
        messages: {
          membersNotified: outcome.membersNotified,
          householdsWithoutMember: outcome.householdsWithoutMember,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/obligations", async (req, res, next) => {
  try {
    const event = await prisma.funeralEvent.findUnique({
      where: { id: req.params.id },
      include: {
        homeWard: { select: { id: true, name: true } },
        eligibleWards: { include: { ward: { select: { id: true, name: true } } } },
        bereavedHousehold: { select: { reference: true, householdName: true } },
      },
    });
    if (!event) {
      return res.status(404).json({ success: false, error: { message: "Event not found" } });
    }

    const obligations = await prisma.contributionObligation.findMany({
      where: { eventId: event.id },
      include: {
        household: {
          select: {
            id: true,
            reference: true,
            householdName: true,
            ward: { select: { id: true, name: true } },
          },
        },
        payments: { select: { amount: true } },
      },
      orderBy: { household: { reference: "asc" } },
    });
    const messagesSent = await prisma.notification.count({ where: { eventId: event.id } });

    const zero = new Prisma.Decimal(0);
    let expected = zero;
    let recorded = zero;
    let paidCount = 0;

    const rows = obligations.map((o) => {
      const paid = o.payments.reduce((sum, p) => sum.plus(p.amount), zero);
      expected = expected.plus(o.amountDue);
      recorded = recorded.plus(paid);
      if (o.status === "PAID") paidCount++;
      return {
        id: o.id,
        household: o.household,
        amountDue: o.amountDue.toFixed(2),
        amountPaid: paid.toFixed(2),
        status: o.status,
      };
    });

    res.json({
      success: true,
      data: {
        event: {
          id: event.id,
          reference: event.reference,
          title: event.title,
          eventDate: event.eventDate,
          status: event.status,
          contributionAmount: event.contributionAmount.toFixed(2),
          homeWard: event.homeWard,
          eligibleWards: event.eligibleWards.map((e) => e.ward),
          bereavedHousehold: event.bereavedHousehold,
          messagesSent,
        },
        summary: {
          households: obligations.length,
          householdsPaid: paidCount,
          householdsUnpaid: obligations.length - paidCount,
          expected: expected.toFixed(2),
          recorded: recorded.toFixed(2),
          outstanding: expected.minus(recorded).toFixed(2),
        },
        obligations: rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
