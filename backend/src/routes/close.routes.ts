import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { reconcileEvent } from "../lib/reconcile";

const router = Router();
router.use(authenticate);

const zero = new Prisma.Decimal(0);

router.post("/:id/close", authorize("ADMIN"), async (req, res, next) => {
  try {
    const event = await prisma.funeralEvent.findUnique({ where: { id: req.params.id } });
    if (!event) {
      return res.status(404).json({ success: false, error: { message: "Event not found" } });
    }
    if (event.status === "CLOSED") {
      return res
        .status(409)
        .json({ success: false, error: { message: "This event is already closed" } });
    }
    if (event.status !== "ACTIVE") {
      return res
        .status(409)
        .json({ success: false, error: { message: "Only active events can be closed" } });
    }

    const recon = await reconcileEvent(event.id);
    const nothingToReconcile =
      recon.status === "AWAITING_HANDOVER" && Number(recon.cashRecorded) === 0;

    if (recon.status !== "MATCHED" && !nothingToReconcile) {
      return res.status(409).json({
        success: false,
        error: { message: `Cannot close this event yet. ${recon.message}` },
      });
    }

    const [expectedAgg, recordedAgg, notFullyPaid] = await Promise.all([
      prisma.contributionObligation.aggregate({
        where: { eventId: event.id },
        _sum: { amountDue: true },
      }),
      prisma.payment.aggregate({
        where: { obligation: { eventId: event.id } },
        _sum: { amount: true },
      }),
      prisma.contributionObligation.count({
        where: { eventId: event.id, status: { not: "PAID" } },
      }),
    ]);
    const expected = expectedAgg._sum.amountDue ?? zero;
    const recorded = recordedAgg._sum.amount ?? zero;
    const outstanding = expected.minus(recorded);

    const closed = await prisma.$transaction(async (tx) => {
      // Only closes if the event is still ACTIVE, so two requests cannot both succeed
      const result = await tx.funeralEvent.updateMany({
        where: { id: event.id, status: "ACTIVE" },
        data: { status: "CLOSED" },
      });
      if (result.count === 0) return false;

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "EVENT_CLOSED",
          entityType: "FuneralEvent",
          entityId: event.id,
          details: {
            reference: event.reference,
            reconciliationStatus: recon.status,
            cashRecorded: recon.cashRecorded,
            cashHandedOver: recon.handedOver,
            expected: expected.toFixed(2),
            recorded: recorded.toFixed(2),
            outstanding: outstanding.toFixed(2),
            householdsNotFullyPaid: notFullyPaid,
          },
        },
      });
      return true;
    });

    if (!closed) {
      return res
        .status(409)
        .json({ success: false, error: { message: "This event is no longer active" } });
    }

    res.json({
      success: true,
      data: {
        id: event.id,
        reference: event.reference,
        status: "CLOSED",
        reconciliation: recon,
        summary: {
          expected: expected.toFixed(2),
          recorded: recorded.toFixed(2),
          outstanding: outstanding.toFixed(2),
          householdsNotFullyPaid: notFullyPaid,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
