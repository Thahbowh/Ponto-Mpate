import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { joinLimiter } from "../lib/limiters";
import { paymentMode, simulateProviderCallback } from "../lib/onlinePayments";
import { ensurePayReference } from "../lib/voucher";

// Mounted behind authenticate + authorize("MEMBER"). Every query here is scoped to the signed-in
// member's own approved household, so changing an id in the browser cannot reveal anyone else's data.
const router = Router();
const zero = new Prisma.Decimal(0);

const notApproved = {
  success: false,
  error: { message: "Your household membership has not been approved yet." },
};

async function getMembership(userId: string) {
  return prisma.householdMember.findUnique({
    where: { userId },
    include: { household: { include: { ward: { select: { id: true, name: true } } } } },
  });
}

router.get("/me", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, role: true },
    });
    const m = await getMembership(req.user!.id);
    res.json({
      success: true,
      data: {
        user,
        membership: m
          ? {
              status: m.status,
              requestedAt: m.requestedAt,
              household: {
                reference: m.household.reference,
                ward: m.household.ward,
                // The household's name is only shown once staff have approved the link
                householdName: m.status === "APPROVED" ? m.household.householdName : null,
              },
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Wards with aggregate counts only. Three different numbers, labelled separately.
router.get("/wards", async (_req, res, next) => {
  try {
    const wards = await prisma.ward.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    const groups = await prisma.household.groupBy({
      by: ["wardId", "isActive"],
      _count: { _all: true },
    });
    const approved = await prisma.householdMember.findMany({
      where: { status: "APPROVED" },
      select: { household: { select: { wardId: true } } },
    });

    res.json({
      success: true,
      data: wards.map((w) => {
        const mine = groups.filter((g) => g.wardId === w.id);
        return {
          id: w.id,
          name: w.name,
          registeredHouseholds: mine.reduce((s, g) => s + g._count._all, 0),
          activeHouseholds: mine.filter((g) => g.isActive).reduce((s, g) => s + g._count._all, 0),
          memberAccounts: approved.filter((a) => a.household.wardId === w.id).length,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

const joinSchema = z.object({
  wardId: z.string().min(1),
  householdReference: z.string().trim().min(3).max(40),
});

router.post("/household/join", joinLimiter, async (req, res, next) => {
  try {
    const input = joinSchema.parse(req.body);
    const userId = req.user!.id;

    const existing = await prisma.householdMember.findUnique({ where: { userId } });
    if (existing && existing.status === "PENDING") {
      return res.status(409).json({
        success: false,
        error: { message: "Your request is already waiting for approval." },
      });
    }
    if (existing && existing.status === "APPROVED") {
      return res.status(409).json({
        success: false,
        error: { message: "You are already linked to a household." },
      });
    }

    const household = await prisma.household.findFirst({
      where: { reference: input.householdReference, wardId: input.wardId, isActive: true },
      include: { ward: { select: { id: true, name: true } } },
    });
    // Same answer whether the reference is wrong or belongs to another ward
    if (!household) {
      return res.status(404).json({
        success: false,
        error: {
          message:
            "We could not find an active household with that reference in the chosen ward. Please check it with your ward administrator.",
        },
      });
    }

    const membership = existing
      ? await prisma.householdMember.update({
          where: { id: existing.id },
          data: { householdId: household.id, status: "PENDING", requestedAt: new Date(), decidedAt: null },
        })
      : await prisma.householdMember.create({ data: { userId, householdId: household.id } });

    await prisma.auditLog.create({
      data: {
        userId,
        action: "MEMBERSHIP_REQUESTED",
        entityType: "HouseholdMember",
        entityId: membership.id,
        details: { householdReference: household.reference },
      },
    });

    res.status(201).json({
      success: true,
      data: { status: membership.status, reference: household.reference, ward: household.ward },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/contributions", async (req, res, next) => {
  try {
    const m = await getMembership(req.user!.id);
    if (!m || m.status !== "APPROVED") {
      return res.json({ success: true, data: { approved: false, summary: null, items: [] } });
    }

    const obligations = await prisma.contributionObligation.findMany({
      where: { householdId: m.householdId, event: { status: { not: "CANCELLED" } } },
      include: {
        event: { select: { id: true, reference: true, title: true, eventDate: true, status: true } },
        payments: { select: { amount: true } },
        attempts: {
          where: { status: "PENDING" },
          select: { reference: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { event: { eventDate: "desc" } },
    });

    let due = zero;
    let paidTotal = zero;
    const items = obligations.map((o) => {
      const paid = o.payments.reduce((s, p) => s.plus(p.amount), zero);
      const remaining = o.amountDue.minus(paid);
      const outstanding = remaining.gt(0) ? remaining : zero;
      due = due.plus(o.amountDue);
      paidTotal = paidTotal.plus(paid);
      return {
        obligationId: o.id,
        event: o.event,
        amountDue: o.amountDue.toFixed(2),
        amountPaid: paid.toFixed(2),
        outstanding: outstanding.toFixed(2),
        status: o.status,
        canPay: o.event.status === "ACTIVE" && outstanding.gt(0),
        pendingCheckout: o.attempts[0]?.reference ?? null,
        payReference: o.payReference,
      };
    });

    res.json({
      success: true,
      data: {
        approved: true,
        household: { reference: m.household.reference, householdName: m.household.householdName, ward: m.household.ward },
        summary: {
          due: due.toFixed(2),
          paid: paidTotal.toFixed(2),
          outstanding: due.minus(paidTotal).toFixed(2),
          contributionsOutstanding: items.filter((i) => Number(i.outstanding) > 0).length,
        },
        items,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/payments", async (req, res, next) => {
  try {
    const m = await getMembership(req.user!.id);
    if (!m || m.status !== "APPROVED") {
      return res.json({ success: true, data: { approved: false, payments: [], attempts: [] } });
    }

    const payments = await prisma.payment.findMany({
      where: { obligation: { householdId: m.householdId } },
      orderBy: { paidAt: "desc" },
      take: 50,
      include: {
        receipt: { select: { reference: true } },
        obligation: { select: { event: { select: { reference: true, title: true } } } },
      },
    });
    const attempts = await prisma.paymentAttempt.findMany({
      where: { userId: req.user!.id, status: { not: "SUCCESSFUL" } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { obligation: { select: { event: { select: { reference: true, title: true } } } } },
    });

    res.json({
      success: true,
      data: {
        approved: true,
        payments: payments.map((p) => ({
          receiptNumber: p.receipt?.reference ?? null,
          amount: p.amount.toFixed(2),
          method: p.method,
          paidAt: p.paidAt,
          event: p.obligation.event,
        })),
        attempts: attempts.map((a) => ({
          reference: a.reference,
          amount: a.amount.toFixed(2),
          status: a.status,
          createdAt: a.createdAt,
          event: a.obligation.event,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/receipts/:reference", async (req, res, next) => {
  try {
    const m = await getMembership(req.user!.id);
    if (!m || m.status !== "APPROVED") return res.status(403).json(notApproved);

    const receipt = await prisma.receipt.findFirst({
      where: {
        reference: req.params.reference,
        payment: { obligation: { householdId: m.householdId } },
      },
      include: {
        payment: {
          include: {
            recordedBy: { select: { role: true } },
            obligation: {
              include: {
                household: {
                  select: { reference: true, householdName: true, ward: { select: { name: true } } },
                },
                event: { select: { reference: true, title: true, eventDate: true } },
              },
            },
          },
        },
      },
    });
    if (!receipt) {
      return res.status(404).json({ success: false, error: { message: "Receipt not found" } });
    }

    const p = receipt.payment;
    res.json({
      success: true,
      data: {
        receiptNumber: receipt.reference,
        issuedAt: receipt.issuedAt,
        amount: p.amount.toFixed(2),
        method: p.method,
        paidAt: p.paidAt,
        recordedBy:
          p.method === "VOUCHER"
            ? "Paid at a participating shop (voucher)"
            : p.recordedBy.role === "MEMBER"
              ? "Paid online"
              : "Ponto Mpate administrator",
        household: p.obligation.household,
        event: p.obligation.event,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/contributions/:obligationId/shop-reference", async (req, res, next) => {
  try {
    const m = await getMembership(req.user!.id);
    if (!m || m.status !== "APPROVED") return res.status(403).json(notApproved);

    const obligation = await prisma.contributionObligation.findFirst({
      where: { id: req.params.obligationId, householdId: m.householdId },
      include: {
        event: { select: { reference: true, title: true, status: true } },
        payments: { select: { amount: true } },
      },
    });
    if (!obligation) {
      return res.status(404).json({ success: false, error: { message: "Contribution not found" } });
    }
    if (obligation.event.status !== "ACTIVE") {
      return res.status(409).json({ success: false, error: { message: "This event is not open for payments" } });
    }
    const paid = obligation.payments.reduce((s, p) => s.plus(p.amount), zero);
    const outstanding = obligation.amountDue.minus(paid);
    if (outstanding.lte(0)) {
      return res.status(409).json({ success: false, error: { message: "This contribution is already paid in full" } });
    }

    const payReference = await ensurePayReference(obligation.id);
    res.json({
      success: true,
      data: {
        payReference,
        amount: outstanding.toFixed(2),
        event: { reference: obligation.event.reference, title: obligation.event.title },
      },
    });
  } catch (err) {
    next(err);
  }
});
const checkoutSchema = z.object({ obligationId: z.string().min(1) });

router.post("/checkout", async (req, res, next) => {
  try {
    const { obligationId } = checkoutSchema.parse(req.body);
    const userId = req.user!.id;

    const m = await getMembership(userId);
    if (!m || m.status !== "APPROVED") return res.status(403).json(notApproved);

    const obligation = await prisma.contributionObligation.findFirst({
      where: { id: obligationId, householdId: m.householdId },
      include: { event: { select: { reference: true, title: true, status: true } } },
    });
    if (!obligation) {
      return res.status(404).json({ success: false, error: { message: "Contribution not found" } });
    }
    if (obligation.event.status !== "ACTIVE") {
      return res
        .status(409)
        .json({ success: false, error: { message: "This event is not open for payments" } });
    }

    const agg = await prisma.payment.aggregate({
      where: { obligationId },
      _sum: { amount: true },
    });
    const outstanding = obligation.amountDue.minus(agg._sum.amount ?? zero);
    if (outstanding.lte(0)) {
      return res
        .status(409)
        .json({ success: false, error: { message: "This contribution is already paid in full" } });
    }

    const pending = await prisma.paymentAttempt.findFirst({
      where: { obligationId, userId, status: "PENDING" },
    });
    if (pending && pending.amount.equals(outstanding)) {
      return res.json({
        success: true,
        data: {
          reference: pending.reference,
          amount: pending.amount.toFixed(2),
          status: pending.status,
          mode: paymentMode(),
          event: { reference: obligation.event.reference, title: obligation.event.title },
        },
      });
    }
    if (pending) {
      // The amount owed has changed since that checkout was started
      await prisma.paymentAttempt.updateMany({
        where: { obligationId, userId, status: "PENDING" },
        data: { status: "CANCELLED", completedAt: new Date() },
      });
    }

    const attempt = await prisma.paymentAttempt.create({
      data: {
        reference: `CHK-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
        obligationId,
        userId,
        amount: outstanding,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId,
        action: "CHECKOUT_STARTED",
        entityType: "PaymentAttempt",
        entityId: attempt.id,
        details: { reference: attempt.reference, amount: outstanding.toFixed(2) },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        reference: attempt.reference,
        amount: attempt.amount.toFixed(2),
        status: attempt.status,
        mode: paymentMode(),
        event: { reference: obligation.event.reference, title: obligation.event.title },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/checkout/:reference", async (req, res, next) => {
  try {
    const attempt = await prisma.paymentAttempt.findFirst({
      where: { reference: req.params.reference, userId: req.user!.id },
      include: {
        obligation: { include: { event: { select: { reference: true, title: true } } } },
        payment: { include: { receipt: { select: { reference: true } } } },
      },
    });
    if (!attempt) {
      return res.status(404).json({ success: false, error: { message: "Checkout not found" } });
    }
    res.json({
      success: true,
      data: {
        reference: attempt.reference,
        amount: attempt.amount.toFixed(2),
        status: attempt.status,
        mode: paymentMode(),
        event: attempt.obligation.event,
        receiptNumber: attempt.payment?.receipt?.reference ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

const demoPaySchema = z.object({ outcome: z.enum(["success", "fail", "cancel"]) });

// DEMO ONLY. Plays the payment provider on the server. Disabled unless PAYMENT_MODE=demo.
router.post("/checkout/:reference/demo-pay", async (req, res, next) => {
  try {
    if (paymentMode() !== "demo") {
      return res
        .status(404)
        .json({ success: false, error: { message: "Demo checkout is not available" } });
    }
    const { outcome } = demoPaySchema.parse(req.body);

    const attempt = await prisma.paymentAttempt.findFirst({
      where: { reference: req.params.reference, userId: req.user!.id },
    });
    if (!attempt) {
      return res.status(404).json({ success: false, error: { message: "Checkout not found" } });
    }

    let result: { outcome: string } = { outcome: "already_finished" };
    if (attempt.status === "PENDING") {
      const sim = await simulateProviderCallback(attempt, outcome);
      if (!sim.ok) {
        return res.status(500).json({ success: false, error: { message: "Could not process the demo payment" } });
      }
      result = sim.result;
    }

    const updated = await prisma.paymentAttempt.findUnique({
      where: { id: attempt.id },
      include: { payment: { include: { receipt: { select: { reference: true } } } } },
    });
    res.json({
      success: true,
      data: {
        reference: attempt.reference,
        status: updated?.status ?? attempt.status,
        receiptNumber: updated?.payment?.receipt?.reference ?? null,
        outcome: result.outcome,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;



