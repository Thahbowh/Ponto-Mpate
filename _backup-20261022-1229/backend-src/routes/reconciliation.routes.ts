import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { reconcileEvent } from "../lib/reconcile";

const router = Router();
router.use(authenticate);

const handoverSchema = z.object({
  eventId: z.string().min(1),
  amount: z.coerce
    .number()
    .positive()
    .max(1000000)
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, {
      message: "Amount can have at most 2 decimal places",
    }),
  handedOverAt: z.coerce
    .date()
    .refine((d) => d.getTime() <= Date.now() + 60_000, { message: "Date cannot be in the future" })
    .optional(),
  note: z.string().trim().max(500).optional(), // keep notes neutral, no personal details
  idempotencyKey: z.string().min(8).max(100),
});

// Record a cash handover and return the updated reconciliation for the event
router.post("/", authorize("ADMIN"), async (req, res, next) => {
  try {
    const input = handoverSchema.parse(req.body);

    const existing = await prisma.cashHandover.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (existing.eventId !== input.eventId) {
        return res.status(409).json({
          success: false,
          error: { message: "This idempotency key was already used for a different handover" },
        });
      }
      return res.status(200).json({
        success: true,
        duplicate: true,
        data: {
          handover: {
            id: existing.id,
            eventId: existing.eventId,
            amount: existing.amount.toFixed(2),
            handedOverAt: existing.handedOverAt,
          },
          reconciliation: await reconcileEvent(existing.eventId),
        },
      });
    }

    const event = await prisma.funeralEvent.findUnique({ where: { id: input.eventId } });
    if (!event) {
      return res.status(404).json({ success: false, error: { message: "Event not found" } });
    }
    if (event.status !== "ACTIVE") {
      return res.status(409).json({
        success: false,
        error: { message: "Handovers can only be recorded for active events" },
      });
    }

    const amount = new Prisma.Decimal(input.amount.toFixed(2));

    const handover = await prisma.$transaction(async (tx) => {
      const created = await tx.cashHandover.create({
        data: {
          eventId: input.eventId,
          amount,
          handedOverAt: input.handedOverAt ?? new Date(),
          note: input.note,
          recordedById: req.user!.id,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          action: "CASH_HANDOVER_RECORDED",
          entityType: "CashHandover",
          entityId: created.id,
          details: { eventId: input.eventId, amount: amount.toFixed(2) },
        },
      });
      return created;
    });

    res.status(201).json({
      success: true,
      data: {
        handover: {
          id: handover.id,
          eventId: handover.eventId,
          amount: handover.amount.toFixed(2),
          handedOverAt: handover.handedOverAt,
        },
        reconciliation: await reconcileEvent(input.eventId),
      },
    });
  } catch (err) {
    next(err);
  }
});

// Current reconciliation for one event, plus its handover history
router.get("/:eventId", async (req, res, next) => {
  try {
    const event = await prisma.funeralEvent.findUnique({
      where: { id: req.params.eventId },
      select: { id: true, reference: true, title: true, status: true },
    });
    if (!event) {
      return res.status(404).json({ success: false, error: { message: "Event not found" } });
    }

    const handovers = await prisma.cashHandover.findMany({
      where: { eventId: event.id },
      orderBy: { handedOverAt: "asc" },
      include: { recordedBy: { select: { name: true } } },
    });

    res.json({
      success: true,
      data: {
        event,
        reconciliation: await reconcileEvent(event.id),
        handovers: handovers.map((h) => ({
          id: h.id,
          amount: h.amount.toFixed(2),
          handedOverAt: h.handedOverAt,
          note: h.note,
          recordedBy: h.recordedBy.name,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
