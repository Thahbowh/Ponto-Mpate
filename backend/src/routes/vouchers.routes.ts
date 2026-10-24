import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

// Staff view of shop-voucher payments and settlement. Mounted behind staff-only access.
const router = Router();
router.use(authenticate);

const zero = new Prisma.Decimal(0);
const DAY_MS = 24 * 60 * 60 * 1000;

router.get("/", async (_req, res, next) => {
  try {
    const rows = await prisma.voucherTransaction.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        obligation: {
          select: { event: { select: { reference: true } }, household: { select: { reference: true } } },
        },
        payment: { select: { receipt: { select: { reference: true } } } },
      },
    });

    const now = Date.now();
    let gross = zero;
    let fees = zero;
    let net = zero;
    let awaiting = zero;
    let settled = zero;
    let rejected = 0;
    let awaitingOver24h = 0;
    let settledCount = 0;
    let settledWithin24h = 0;

    for (const r of rows) {
      if (r.status === "REJECTED") {
        rejected++;
        continue;
      }
      gross = gross.plus(r.grossAmount);
      fees = fees.plus(r.providerFee);
      net = net.plus(r.netAmount);
      if (r.settlementStatus === "SETTLED") {
        settled = settled.plus(r.netAmount);
        settledCount++;
        if (r.settledAt && r.settledAt.getTime() - r.createdAt.getTime() <= DAY_MS) settledWithin24h++;
      } else {
        awaiting = awaiting.plus(r.netAmount);
        if (now - r.createdAt.getTime() > DAY_MS) awaitingOver24h++;
      }
    }

    res.json({
      success: true,
      data: {
        totals: {
          gross: gross.toFixed(2),
          fees: fees.toFixed(2),
          net: net.toFixed(2),
          awaiting: awaiting.toFixed(2),
          settled: settled.toFixed(2),
        },
        counts: {
          confirmed: rows.length - rejected,
          rejected,
          awaitingOver24h,
          settledCount,
          settledWithin24h,
        },
        transactions: rows.slice(0, 100).map((r) => ({
          id: r.id,
          providerReference: r.providerReference,
          status: r.status,
          settlementStatus: r.settlementStatus,
          grossAmount: r.grossAmount.toFixed(2),
          providerFee: r.providerFee.toFixed(2),
          netAmount: r.netAmount.toFixed(2),
          createdAt: r.createdAt,
          settledAt: r.settledAt,
          settlementBatch: r.settlementBatch,
          note: r.note,
          event: r.obligation.event.reference,
          household: r.obligation.household.reference,
          receiptNumber: r.payment?.receipt?.reference ?? null,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

const settleSchema = z.object({
  batchReference: z.string().trim().min(3).max(60),
  reportedAmount: z.coerce.number().positive().max(10_000_000),
});

// Record the provider's settlement report. Only settles when the reported total matches what is awaiting.
router.post("/settlements", authorize("ADMIN"), async (req, res, next) => {
  try {
    const input = settleSchema.parse(req.body);
    const reported = new Prisma.Decimal(input.reportedAmount.toFixed(2));

    const used = await prisma.voucherTransaction.findFirst({ where: { settlementBatch: input.batchReference } });
    if (used) {
      return res.status(409).json({
        success: false,
        error: { message: "That settlement batch reference has already been recorded." },
      });
    }

    const awaiting = await prisma.voucherTransaction.findMany({
      where: { status: "CONFIRMED", settlementStatus: "AWAITING_SETTLEMENT" },
      select: { id: true, netAmount: true },
    });
    if (awaiting.length === 0) {
      return res.status(400).json({ success: false, error: { message: "Nothing is awaiting settlement." } });
    }
    const expected = awaiting.reduce((s, t) => s.plus(t.netAmount), zero);

    if (!reported.equals(expected)) {
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "SETTLEMENT_MISMATCH",
          entityType: "VoucherTransaction",
          entityId: input.batchReference,
          details: { reported: reported.toFixed(2), expected: expected.toFixed(2) },
        },
      });
      return res.status(409).json({
        success: false,
        error: {
          message: `The provider reported R${reported.toFixed(2)} but R${expected.toFixed(2)} is awaiting settlement (difference R${reported.minus(expected).abs().toFixed(2)}). Nothing was marked as settled. Please check the provider's report.`,
        },
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.voucherTransaction.updateMany({
        where: { id: { in: awaiting.map((a) => a.id) }, settlementStatus: "AWAITING_SETTLEMENT" },
        data: { settlementStatus: "SETTLED", settledAt: new Date(), settlementBatch: input.batchReference },
      });
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "SETTLEMENT_RECORDED",
          entityType: "VoucherTransaction",
          entityId: input.batchReference,
          details: { amount: expected.toFixed(2), transactions: awaiting.length },
        },
      });
    });

    res.json({
      success: true,
      data: { batchReference: input.batchReference, transactions: awaiting.length, amount: expected.toFixed(2) },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
