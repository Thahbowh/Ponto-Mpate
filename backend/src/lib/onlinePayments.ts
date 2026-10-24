import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";

const zero = new Prisma.Decimal(0);

/** "demo" means the server simulates the provider. A live gateway would only use the webhook. */
export function paymentMode(): string {
  return process.env.PAYMENT_MODE ?? (process.env.NODE_ENV === "production" ? "disabled" : "demo");
}

function secret(): string {
  const s = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!s || s.length < 16) throw new Error("PAYMENT_WEBHOOK_SECRET is missing or too short");
  return s;
}

export function sign(raw: string | Buffer): string {
  return crypto.createHmac("sha256", secret()).update(raw).digest("hex");
}

export function verifySignature(raw: string | Buffer, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = Buffer.from(sign(raw), "hex");
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

const eventSchema = z.object({
  reference: z.string().min(1).max(100),
  status: z.enum(["SUCCESS", "FAILED", "CANCELLED"]),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  providerTransactionId: z.string().max(100).optional(),
});
export type ProviderEvent = z.infer<typeof eventSchema>;

export interface ProviderResult {
  outcome: string;
  attemptStatus?: string;
  receiptNumber?: string | null;
}

/** Applies a VERIFIED provider notification. Safe to call more than once for the same payment. */
export async function applyProviderEvent(evt: ProviderEvent): Promise<ProviderResult> {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { reference: evt.reference },
    include: { obligation: true },
  });
  if (!attempt) return { outcome: "unknown_reference" };

  // A repeated notification: report the current state and change nothing
  if (attempt.status !== "PENDING") {
    const receipt = attempt.paymentId
      ? await prisma.receipt.findUnique({ where: { paymentId: attempt.paymentId } })
      : null;
    return { outcome: "duplicate", attemptStatus: attempt.status, receiptNumber: receipt?.reference ?? null };
  }

  if (evt.status === "FAILED" || evt.status === "CANCELLED") {
    const status = evt.status === "FAILED" ? ("FAILED" as const) : ("CANCELLED" as const);
    await prisma.$transaction(async (tx) => {
      const updated = await tx.paymentAttempt.updateMany({
        where: { id: attempt.id, status: "PENDING" },
        data: { status, completedAt: new Date() },
      });
      if (updated.count > 0) {
        await tx.auditLog.create({
          data: {
            userId: attempt.userId,
            action: status === "FAILED" ? "ONLINE_PAYMENT_FAILED" : "ONLINE_PAYMENT_CANCELLED",
            entityType: "PaymentAttempt",
            entityId: attempt.id,
            details: { reference: attempt.reference },
          },
        });
      }
    });
    return { outcome: status === "FAILED" ? "failed" : "cancelled", attemptStatus: status };
  }

  // SUCCESS: the amount the provider reports must match what we asked for
  if (!new Prisma.Decimal(evt.amount).equals(attempt.amount)) {
    await prisma.auditLog.create({
      data: {
        userId: attempt.userId,
        action: "ONLINE_PAYMENT_AMOUNT_MISMATCH",
        entityType: "PaymentAttempt",
        entityId: attempt.id,
        details: { reference: attempt.reference, expected: attempt.amount.toFixed(2), reported: evt.amount },
      },
    });
    return { outcome: "amount_mismatch", attemptStatus: attempt.status };
  }

  const result = await prisma.$transaction(async (tx) => {
    // Lock the obligation so this cannot race with another payment on the same contribution
    await tx.$queryRaw`SELECT id FROM ContributionObligation WHERE id = ${attempt.obligationId} FOR UPDATE`;

    const fresh = await tx.paymentAttempt.findUnique({ where: { id: attempt.id } });
    if (!fresh || fresh.status !== "PENDING") return { kind: "duplicate" as const };

    const event = await tx.funeralEvent.findUnique({
      where: { id: attempt.obligation.eventId },
      select: { status: true },
    });
    const agg = await tx.payment.aggregate({
      where: { obligationId: attempt.obligationId },
      _sum: { amount: true },
    });
    const alreadyPaid = agg._sum.amount ?? zero;
    const outstanding = attempt.obligation.amountDue.minus(alreadyPaid);

    if (!event || event.status !== "ACTIVE" || attempt.amount.gt(outstanding)) {
      // The situation changed after checkout started. Do not record a payment; flag it for review.
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: "FAILED", completedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          userId: attempt.userId,
          action: "ONLINE_PAYMENT_CONFLICT",
          entityType: "PaymentAttempt",
          entityId: attempt.id,
          details: { reference: attempt.reference, outstanding: outstanding.toFixed(2) },
        },
      });
      return { kind: "conflict" as const };
    }

    const payment = await tx.payment.create({
      data: {
        obligationId: attempt.obligationId,
        amount: attempt.amount,
        method: "ONLINE",
        recordedById: attempt.userId,
        idempotencyKey: `attempt:${attempt.id}`,
      },
    });

    const year = new Date().getFullYear();
    const count = await tx.receipt.count({ where: { reference: { startsWith: `PM-${year}-` } } });
    const receipt = await tx.receipt.create({
      data: { reference: `PM-${year}-${String(count + 1).padStart(5, "0")}`, paymentId: payment.id },
    });

    const newPaid = alreadyPaid.plus(attempt.amount);
    await tx.contributionObligation.update({
      where: { id: attempt.obligationId },
      data: { status: newPaid.gte(attempt.obligation.amountDue) ? "PAID" : "PARTIALLY_PAID" },
    });
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: "SUCCESSFUL", paymentId: payment.id, completedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId: attempt.userId,
        action: "PAYMENT_RECORDED",
        entityType: "Payment",
        entityId: payment.id,
        details: {
          online: true,
          reference: attempt.reference,
          amount: attempt.amount.toFixed(2),
          receipt: receipt.reference,
          providerTransactionId: evt.providerTransactionId ?? null,
        },
      },
    });
    return { kind: "recorded" as const, receiptNumber: receipt.reference };
  });

  if (result.kind === "recorded") {
    return { outcome: "recorded", attemptStatus: "SUCCESSFUL", receiptNumber: result.receiptNumber };
  }
  if (result.kind === "conflict") return { outcome: "conflict", attemptStatus: "FAILED" };
  return { outcome: "duplicate", attemptStatus: "SUCCESSFUL" };
}

/** The one place a provider notification is checked. The webhook and the demo both go through here. */
export async function handleSignedNotification(
  raw: Buffer,
  signature: string | undefined
): Promise<{ ok: true; result: ProviderResult } | { ok: false; status: number; message: string }> {
  if (!verifySignature(raw, signature)) {
    return { ok: false, status: 401, message: "Invalid signature" };
  }
  let parsed: ProviderEvent;
  try {
    parsed = eventSchema.parse(JSON.parse(raw.toString("utf8")));
  } catch {
    return { ok: false, status: 400, message: "Invalid notification" };
  }
  return { ok: true, result: await applyProviderEvent(parsed) };
}

/** DEMO ONLY: plays the part of the payment provider by signing a notification, then verifies it like a real one. */
export async function simulateProviderCallback(
  attempt: { reference: string; amount: Prisma.Decimal },
  outcome: "success" | "fail" | "cancel"
) {
  const payload: ProviderEvent = {
    reference: attempt.reference,
    status: outcome === "success" ? "SUCCESS" : outcome === "fail" ? "FAILED" : "CANCELLED",
    amount: attempt.amount.toFixed(2),
    providerTransactionId: `DEMO-${crypto.randomBytes(4).toString("hex")}`,
  };
  const raw = Buffer.from(JSON.stringify(payload));
  return handleSignedNotification(raw, sign(raw));
}
