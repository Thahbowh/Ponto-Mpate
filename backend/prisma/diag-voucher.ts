import "dotenv/config";
import { PaymentMethod, Prisma, PrismaClient } from "@prisma/client";
import { simulateVoucherProvider } from "../src/lib/voucher";

const prisma = new PrismaClient();

async function main() {
  console.log("Prisma client knows VOUCHER:", Object.values(PaymentMethod).includes("VOUCHER" as any));
  const cols: any[] = await prisma.$queryRawUnsafe(
    "SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Payment' AND COLUMN_NAME = 'method'"
  );
  console.log("Database column allows:     ", cols[0]?.t);
  console.log("Webhook secret set:         ", (process.env.PAYMENT_WEBHOOK_SECRET ?? "").length >= 16);
  console.log("Payment mode:               ", process.env.PAYMENT_MODE ?? "(not set)");

  if (!process.argv.includes("--pay")) {
    console.log("(Checks only. Add --pay to try a real voucher payment and print the exact error.)");
    return;
  }

  const ob = await prisma.contributionObligation.findFirst({
    where: { payReference: { not: null }, event: { status: "ACTIVE" }, status: { not: "PAID" } },
    include: { payments: { select: { amount: true } } },
  });
  if (!ob) {
    console.log("No unpaid contribution with a shop reference found. Create one with the Pay cash at a shop button first.");
    return;
  }
  const paid = ob.payments.reduce((s, p) => s.plus(p.amount), new Prisma.Decimal(0));
  const outstanding = ob.amountDue.minus(paid);
  console.log("Trying reference", ob.payReference, "for R" + outstanding.toFixed(2));
  const result = await simulateVoucherProvider(ob.payReference!, outstanding);
  console.log("Result:", JSON.stringify(result));
}

main()
  .catch((e) => {
    console.error("THE REAL ERROR:\n", e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
