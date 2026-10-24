import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

const router = Router();
router.use(authenticate);

const paymentSchema = z.object({
  householdId: z.string().min(1),
  amount: z.coerce
    .number()
    .positive()
    .max(100000)
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, {
      message: "Amount can have at most 2 decimal places",
    }),
  method: z.enum(["CASH", "EFT", "OTHER"]),
  idempotencyKey: z.string().min(8).max(100),
});

router.post("/:id/payments", authorize("ADMIN"), async (req, res, next) => {
  try {
    const input = paymentSchema.parse(req.body);
    const eventId = req.params.id;
    const amount = new Prisma.Decimal(input.amount.toFixed(2));

    // A repeat of an earlier request: return the original result, create nothing
    const existing = await prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { receipt: true, obligation: true },
    });
    if (existing) {
      if (
        existing.obligation.eventId !== eventId ||
        existing.obligation.householdId !== input.householdId
      ) {
        return res.status(409).json({
          success: false,
          error: { message: "This idempotency key was already used for a different payment" },
        });
      }
      return res.status(200).json({
        success: true,
        duplicate: true,
        data: {
          paymentId: existing.id,
          householdId: existing.obligation.householdId,
          amount: existing.amount.toFixed(2),
          method: existing.method,
          receiptNumber: existing.receipt?.reference ?? null,
          obligationStatus: existing.obligation.status,
        },
      });
    }

    const event = await prisma.funeralEvent.findUnique({ where: { id: eventId } });
    if (!event) {
      return res.status(404).json({ success: false, error: { message: "Event not found" } });
    }
    if (event.status !== "ACTIVE") {
      return res
        .status(409)
        .json({ success: false, error: { message: "This event is not open for payments" } });
    }

    const obligation = await prisma.contributionObligation.findUnique({
      where: { eventId_householdId: { eventId, householdId: input.householdId } },
    });
    if (!obligation) {
      return res.status(404).json({
        success: false,
        error: { message: "This household has no contribution due for this event" },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Lock this obligation row so two simultaneous payments cannot overpay it
      await tx.$queryRaw`SELECT id FROM ContributionObligation WHERE id = ${obligation.id} FOR UPDATE`;

      const agg = await tx.payment.aggregate({
        where: { obligationId: obligation.id },
        _sum: { amount: true },
      });
      const alreadyPaid = agg._sum.amount ?? new Prisma.Decimal(0);
      const outstanding = obligation.amountDue.minus(alreadyPaid);

      if (outstanding.lte(0)) {
        return { ok: false as const, message: "This contribution is already fully paid" };
      }
      if (amount.gt(outstanding)) {
        return {
          ok: false as const,
          message: `Amount is more than the outstanding R${outstanding.toFixed(2)}`,
        };
      }

      const payment = await tx.payment.create({
        data: {
          obligationId: obligation.id,
          amount,
          method: input.method,
          recordedById: req.user!.id,
          idempotencyKey: input.idempotencyKey,
        },
      });

      const year = new Date().getFullYear();
      const count = await tx.receipt.count({
        where: { reference: { startsWith: `PM-${year}-` } },
      });
      const receipt = await tx.receipt.create({
        data: {
          reference: `PM-${year}-${String(count + 1).padStart(5, "0")}`,
          paymentId: payment.id,
        },
      });

      const newPaid = alreadyPaid.plus(amount);
      const status = newPaid.gte(obligation.amountDue) ? "PAID" : "PARTIALLY_PAID";
      await tx.contributionObligation.update({
        where: { id: obligation.id },
        data: { status },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "PAYMENT_RECORDED",
          entityType: "Payment",
          entityId: payment.id,
          details: {
            eventId,
            householdId: input.householdId,
            amount: amount.toFixed(2),
            method: input.method,
            receipt: receipt.reference,
          },
        },
      });

      return {
        ok: true as const,
        payment,
        receipt,
        status,
        outstanding: obligation.amountDue.minus(newPaid),
      };
    });

    if (!result.ok) {
      return res.status(400).json({ success: false, error: { message: result.message } });
    }

    res.status(201).json({
      success: true,
      data: {
        paymentId: result.payment.id,
        householdId: input.householdId,
        amount: amount.toFixed(2),
        method: input.method,
        receiptNumber: result.receipt.reference,
        obligationStatus: result.status,
        outstanding: result.outstanding.toFixed(2),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
