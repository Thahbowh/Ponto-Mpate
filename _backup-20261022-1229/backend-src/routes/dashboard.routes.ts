import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";

const router = Router();
router.use(authenticate);

const zero = new Prisma.Decimal(0);

type Totals = {
  households: number;
  paid: number;
  partiallyPaid: number;
  unpaid: number;
  underReview: number;
  expected: Prisma.Decimal;
  recorded: Prisma.Decimal;
};

const newTotals = (): Totals => ({
  households: 0,
  paid: 0,
  partiallyPaid: 0,
  unpaid: 0,
  underReview: 0,
  expected: zero,
  recorded: zero,
});

function add(t: Totals, status: string, due: Prisma.Decimal, paid: Prisma.Decimal) {
  t.households++;
  t.expected = t.expected.plus(due);
  t.recorded = t.recorded.plus(paid);
  if (status === "PAID") t.paid++;
  else if (status === "PARTIALLY_PAID") t.partiallyPaid++;
  else if (status === "UNDER_REVIEW") t.underReview++;
  else t.unpaid++;
}

function format(t: Totals) {
  return {
    households: t.households,
    householdsPaid: t.paid,
    householdsPartiallyPaid: t.partiallyPaid,
    householdsUnpaid: t.unpaid,
    householdsUnderReview: t.underReview,
    expected: t.expected.toFixed(2),
    recorded: t.recorded.toFixed(2),
    outstanding: t.expected.minus(t.recorded).toFixed(2),
    collectionRate: t.expected.gt(0)
      ? t.recorded.div(t.expected).mul(100).toFixed(1)
      : "0.0",
  };
}

router.get("/", async (req, res, next) => {
  try {
    const eventId = typeof req.query.eventId === "string" ? req.query.eventId : undefined;

    const [totalWards, totalHouseholds] = await Promise.all([
  prisma.ward.count({
    where: { isActive: true },
  }),
  prisma.household.count({
    where: { isActive: true },
  }),
]);

    const events = await prisma.funeralEvent.findMany({
      where: { status: { not: "CANCELLED" } },
      orderBy: { eventDate: "desc" },
      select: {
        id: true,
        reference: true,
        title: true,
        eventDate: true,
        status: true,
        contributionAmount: true,
        homeWard: { select: { name: true } },
      },
    });

    if (eventId && !events.some((e) => e.id === eventId)) {
      return res.status(404).json({ success: false, error: { message: "Event not found" } });
    }

    const obligations = await prisma.contributionObligation.findMany({
      where: { event: { status: { not: "CANCELLED" } } },
      select: {
        eventId: true,
        status: true,
        amountDue: true,
        payments: { select: { amount: true } },
        household: { select: { wardId: true, ward: { select: { name: true } } } },
      },
    });

    const overall = newTotals();
    const scoped = newTotals();
    const byEvent = new Map<string, Totals>();
    const byWard = new Map<string, { name: string; totals: Totals }>();

    for (const o of obligations) {
      const paid = o.payments.reduce((sum, p) => sum.plus(p.amount), zero);

      add(overall, o.status, o.amountDue, paid);

      if (!byEvent.has(o.eventId)) byEvent.set(o.eventId, newTotals());
      add(byEvent.get(o.eventId)!, o.status, o.amountDue, paid);

      if (!eventId || o.eventId === eventId) {
        add(scoped, o.status, o.amountDue, paid);
        const wardId = o.household.wardId;
        if (!byWard.has(wardId)) {
          byWard.set(wardId, { name: o.household.ward.name, totals: newTotals() });
        }
        add(byWard.get(wardId)!.totals, o.status, o.amountDue, paid);
      }
    }

    const recent = await prisma.payment.findMany({
      where: eventId ? { obligation: { eventId } } : {},
      orderBy: { paidAt: "desc" },
      take: 5,
      include: {
        receipt: { select: { reference: true } },
        obligation: {
          select: {
            household: { select: { reference: true, householdName: true } },
            event: { select: { reference: true } },
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        scope: eventId ? "event" : "all",

        community: {
        totalWards,
        totalHouseholds,
      },

  totals: format(scoped),
        allEventsTotals: format(overall),
        events: events.map((e) => ({
          id: e.id,
          reference: e.reference,
          title: e.title,
          eventDate: e.eventDate,
          status: e.status,
          homeWard: e.homeWard.name,
          ...format(byEvent.get(e.id) ?? newTotals()),
        })),
        wards: [...byWard.entries()]
          .map(([id, w]) => ({ id, name: w.name, ...format(w.totals) }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        recentPayments: recent.map((p) => ({
          receiptNumber: p.receipt?.reference ?? null,
          amount: p.amount.toFixed(2),
          method: p.method,
          paidAt: p.paidAt,
          household: p.obligation.household,
          event: p.obligation.event.reference,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
