import "dotenv/config";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function checkDigit(payload: string): number {
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
const valid = (ref: string) => /^\d{9}$/.test(ref) && checkDigit(ref.slice(0, 8)) === Number(ref[8]);

async function main() {
  const households = await prisma.household.findMany({ orderBy: { createdAt: "asc" } });
  const used = new Set(households.map((h) => h.reference));
  for (const h of households) {
    if (valid(h.reference)) continue;
    let ref = "";
    do {
      const payload = String(crypto.randomInt(10_000_000, 100_000_000));
      ref = payload + checkDigit(payload);
    } while (used.has(ref));
    used.add(ref);
    await prisma.household.update({ where: { id: h.id }, data: { reference: ref } });
    console.log(`${h.householdName}: ${h.reference} -> ${ref}`);
  }
}

main().finally(() => prisma.$disconnect());
