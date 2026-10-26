import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";
import { sign, verifySignature } from "./onlinePayments";

const zero = new Prisma.Decimal(0);

/** Simulated provider fee rate, as a percentage of each transaction (0.25% by default). A real rate comes from the provider agreement. */
export function demoFeePercent(): string {
  return process.env.DEMO_VOUCHER_FEE_PERCENT ?? "0.25";
}

/** The fee for one transaction, rounded to the nearest cent. */
export function feeFor(amount: Prisma.Decimal): Prisma.Decimal {
  return amount.mul(new Prisma.Decimal(demoFeePercent())).div(100).toDecimalPlaces(2);
}

export function normaliseRef(input: string): string {
  return input.replace(/\D/g, "");
}

function luhnCheckDigit(payload: string): number {
  let sum = 0;
  let double = true;
  for (let i = payload.length - 1; i >= 0; i--) {
    let d = Number(payload[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return (10 - (sum % 10)) % 10;
}

/** 8 digits plus a check digit, so a typing mistake on a keypad is caught. */
export function isValidPayReference(ref: string): boolean {
  return /^\d{9}$/.test(ref) && luhnCheckDigit(ref.slice(0, 8)) === Number(ref[8]);
}

export async function ensurePayReference(obligationId: string): Promise<string> {
  const current = await prisma.contributionObligation.findUnique({
    where: { id: obligationId },
    select: { payReference: true },
  });
  if (!current) throw new Error("Contribution not found");
  if (current.payReference) return current.payReference;

  for (let attempt = 0; attempt < 8; attempt++) {
    const payload = String(crypto.randomInt(10_000_000, 100_000_000));
    const ref = payload + luhnCheckDigit(payload);
    try {
      const updated = await prisma.contributionObligation.updateMany({
        where: { id: obligationId, payReference: null },
        data: { payReference: ref },
      });
      if (updated.count > 0) return ref;
      const again = await prisma.contributionObligation.findUnique({
        where: { id: obligationId },
        select: { payReference: true },
      });
      if (again?.payReference) return again.payReference;
    } catch (err: any) {
      if (err?.code !== "P2002") throw err; // reference collision: try another
    }
  }
  throw new Error("Could not generate a unique payment reference");
}

/** Voucher payments are not entered by a person, so they are recorded under a service account nobody can sign in to. */
async function voucherServiceUserId(): Promise<string> {
  const email = "voucher-service@system.local";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;
  try {
    const hash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10);
    const created = await prisma.user.create({
      data: { email, name: "Shop voucher service", passwordHash: hash, role: "VIEWER" },
    });
    return created.id;
  } catch {
    const again = await prisma.user.findUnique({ where: { email } });
    if (again) return again.id;
    throw new Error("Could not create the voucher service account");
  }
}

const eventSchema = z.object({
  providerReference: z.string().min(4).max(100),
  payReference: z.string().min(1).max(20),
  eventReference: z.string().max(40).optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  fee: z.string().regex(/^\d+(\.\d{1,2})?$/),
});
export type VoucherEvent = z.infer<typeof eventSchema>;

export interface VoucherResult {
  outcome: string;
  receiptNumber?: string | null;
  message?: string;
}

/** Applies a VERIFIED provider confirmation. Safe to call more than once for the same transaction. */
export async function applyVoucherConfirmation(evt: VoucherEvent): Promise<VoucherResult> {
  const existing = await prisma.voucherTransaction.findUnique({
    where: { providerReference: evt.providerReference },
    include: { payment: { include: { receipt: { select: { reference: true } } } } },
  });
  if (existing) {
    return { outcome: "duplicate", receiptNumber: existing.payment?.receipt?.reference ?? null };
  }

  const ref = normaliseRef(evt.payReference);
  if (!isValidPayReference(ref)) return { outcome: "invalid_reference" };

  // The reference belongs to the household. Work out which contribution is being paid.
  const household = await prisma.household.findUnique({
    where: { reference: ref },
    select: { id: true, isActive: true },
  });
  if (!household || !household.isActive) return { outcome: "unknown_reference" };

  const open = await prisma.contributionObligation.findMany({
    where: { householdId: household.id, status: { not: "PAID" }, event: { status: "ACTIVE" } },
    include: { event: { select: { reference: true } } },
    orderBy: { event: { eventDate: "asc" } },
  });
  const obligation = evt.eventReference
    ? open.find((o) => o.event.reference === evt.eventReference)
    : open.length === 1
      ? open[0]
      : undefined;
  if (!obligation) {
    return { outcome: open.length > 1 && !evt.eventReference ? "ambiguous_contribution" : "no_open_contribution" };
  }

  const gross = new Prisma.Decimal(evt.amount);
  const fee = new Prisma.Decimal(evt.fee);
  if (gross.lte(0) || fee.lt(0) || fee.gte(gross)) return { outcome: "invalid_amount" };

  const userId = await voucherServiceUserId();

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM ContributionObligation WHERE id = ${obligation.id} FOR UPDATE`;

      const dup = await tx.voucherTransaction.findUnique({
        where: { providerReference: evt.providerReference },
      });
      if (dup) return { kind: "duplicate" as const };

      const event = await tx.funeralEvent.findUnique({
        where: { id: obligation.eventId },
        select: { status: true },
      });
      const agg = await tx.payment.aggregate({
        where: { obligationId: obligation.id },
        _sum: { amount: true },
      });
      const alreadyPaid = agg._sum.amount ?? zero;
      const outstanding = obligation.amountDue.minus(alreadyPaid);

      let reason = "";
      if (!event || event.status !== "ACTIVE") reason = "The event is no longer open for payments.";
      else if (outstanding.lte(0)) reason = "The contribution was already paid in full.";
      else if (!gross.equals(outstanding)) {
        reason = `Amount R${gross.toFixed(2)} did not match the R${outstanding.toFixed(2)} outstanding.`;
      }

      if (reason) {
        await tx.voucherTransaction.create({
          data: {
            providerReference: evt.providerReference,
            obligationId: obligation.id,
            status: "REJECTED",
            grossAmount: gross,
            providerFee: fee,
            netAmount: gross.minus(fee),
            settlementStatus: "NOT_APPLICABLE",
            note: reason,
          },
        });
        await tx.auditLog.create({
          data: {
            userId,
            action: "VOUCHER_PAYMENT_REJECTED",
            entityType: "VoucherTransaction",
            entityId: evt.providerReference,
            details: { reason, payReference: ref },
          },
        });
        return { kind: "rejected" as const, reason };
      }

      const payment = await tx.payment.create({
        data: {
          obligationId: obligation.id,
          amount: gross,
          method: "VOUCHER",
          recordedById: userId,
          idempotencyKey: `voucher:${evt.providerReference}`,
        },
      });
      const year = new Date().getFullYear();
      const count = await tx.receipt.count({ where: { reference: { startsWith: `PM-${year}-` } } });
      const receipt = await tx.receipt.create({
        data: { reference: `PM-${year}-${String(count + 1).padStart(5, "0")}`, paymentId: payment.id },
      });
      await tx.contributionObligation.update({
        where: { id: obligation.id },
        data: { status: alreadyPaid.plus(gross).gte(obligation.amountDue) ? "PAID" : "PARTIALLY_PAID" },
      });
      await tx.voucherTransaction.create({
        data: {
          providerReference: evt.providerReference,
          obligationId: obligation.id,
          paymentId: payment.id,
          status: "CONFIRMED",
          grossAmount: gross,
          providerFee: fee,
          netAmount: gross.minus(fee),
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: "VOUCHER_PAYMENT_CONFIRMED",
          entityType: "Payment",
          entityId: payment.id,
          details: {
            providerReference: evt.providerReference,
            gross: gross.toFixed(2),
            fee: fee.toFixed(2),
            receipt: receipt.reference,
          },
        },
      });
      return { kind: "confirmed" as const, receiptNumber: receipt.reference };
    });

    if (result.kind === "confirmed") return { outcome: "confirmed", receiptNumber: result.receiptNumber };
    if (result.kind === "rejected") return { outcome: "rejected", message: result.reason };
    return { outcome: "duplicate" };
  } catch (err: any) {
    if (err?.code === "P2002") return { outcome: "duplicate" };
    throw err;
  }
}

/** The one place a provider confirmation is checked. The webhook and the demo both go through here. */
export async function handleSignedVoucherNotification(
  raw: Buffer,
  signature: string | undefined
): Promise<{ ok: true; result: VoucherResult } | { ok: false; status: number; message: string }> {
  if (!verifySignature(raw, signature)) {
    return { ok: false, status: 401, message: "Invalid signature" };
  }
  let parsed: VoucherEvent;
  try {
    parsed = eventSchema.parse(JSON.parse(raw.toString("utf8")));
  } catch {
    return { ok: false, status: 400, message: "Invalid notification" };
  }
  return { ok: true, result: await applyVoucherConfirmation(parsed) };
}

/** DEMO ONLY: plays the voucher provider by signing a confirmation, then verifies it like a real one. */
export async function simulateVoucherProvider(payReference: string, amount: Prisma.Decimal, eventReference?: string) {
  const payload: VoucherEvent = {
    providerReference: `VCH-${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
    payReference,
    eventReference,
    amount: amount.toFixed(2),
    fee: feeFor(amount).toFixed(2),
  };
  const raw = Buffer.from(JSON.stringify(payload));
  return handleSignedVoucherNotification(raw, sign(raw));
}



/** A new 9-digit household reference (8 random digits plus a check digit) that no other household uses. */
export async function newHouseholdReference(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const payload = String(crypto.randomInt(10_000_000, 100_000_000));
    const ref = payload + luhnCheckDigit(payload);
    const taken = await prisma.household.findUnique({ where: { reference: ref }, select: { id: true } });
    if (!taken) return ref;
  }
  throw new Error("Could not generate a unique household reference");
}
