import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const zero = new Prisma.Decimal(0);

export type ReconStatus = "MATCHED" | "NEEDS_REVIEW" | "AWAITING_HANDOVER";

export async function reconcileEvent(eventId: string) {
  const [cash, other, handed] = await Promise.all([
    prisma.payment.aggregate({
      where: { method: "CASH", obligation: { eventId } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { method: { not: "CASH" }, obligation: { eventId } },
      _sum: { amount: true },
    }),
    prisma.cashHandover.aggregate({
      where: { eventId },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const cashRecorded = cash._sum.amount ?? zero;
  const nonCashRecorded = other._sum.amount ?? zero;
  const handedOver = handed._sum.amount ?? zero;
  const handoverCount = handed._count._all;
  const difference = handedOver.minus(cashRecorded);

  let status: ReconStatus;
  let message: string;

  if (handoverCount === 0) {
    status = "AWAITING_HANDOVER";
    message = cashRecorded.gt(0)
      ? `R${cashRecorded.toFixed(2)} in cash is recorded and no handover has been recorded yet.`
      : "No cash payments or handovers have been recorded yet.";
  } else if (difference.isZero()) {
    status = "MATCHED";
    message = "Cash handed over matches cash recorded.";
  } else if (difference.lt(0)) {
    status = "NEEDS_REVIEW";
    message = `R${difference.abs().toFixed(2)} less cash was handed over than was recorded. This needs a human check. It may be cash still to be handed over, a recording error, or a payment recorded under the wrong method.`;
  } else {
    status = "NEEDS_REVIEW";
    message = `R${difference.toFixed(2)} more cash was handed over than was recorded. Check whether a payment has not been recorded yet.`;
  }

  return {
    status,
    message,
    cashRecorded: cashRecorded.toFixed(2),
    nonCashRecorded: nonCashRecorded.toFixed(2),
    handedOver: handedOver.toFixed(2),
    difference: difference.toFixed(2), // handed over minus recorded cash
    handoverCount,
  };
}
