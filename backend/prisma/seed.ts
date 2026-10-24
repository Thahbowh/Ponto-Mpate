import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed a production database.");
  }

  // Clear existing demo data (children first).
  await prisma.auditLog.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.contributionObligation.deleteMany();
  await prisma.eventEligibleWard.deleteMany();
  await prisma.funeralEvent.deleteMany();
  await prisma.household.deleteMany();
  await prisma.wardNeighbour.deleteMany();
  await prisma.ward.deleteMany();
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();

  // Settings: R12 is a prototype assumption, not confirmed by the scheme owner.
  await prisma.setting.create({
    data: {
      id: 1,
      schemeName: "Ponto Mpate (Prototype Demo)",
      defaultContributionAmount: new Prisma.Decimal("12.00"),
    },
  });

  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) throw new Error("Set SEED_ADMIN_PASSWORD in backend/.env");
  const admin = await prisma.user.create({
    data: {
      email: "admin@demo.example",
      name: "Demo Administrator",
      passwordHash: await bcrypt.hash(password, 10),
      role: "ADMIN",
    },
  });

  // Four fictional wards in a line: 1-2, 2-3, 3-4 are neighbours.
  const wards = [];
  for (const name of ["Demo Ward 1", "Demo Ward 2", "Demo Ward 3", "Demo Ward 4"]) {
    wards.push(await prisma.ward.create({ data: { name } }));
  }
  for (const [a, b] of [[0, 1], [1, 2], [2, 3]]) {
    await prisma.wardNeighbour.createMany({
      data: [
        { wardId: wards[a].id, neighbourId: wards[b].id },
        { wardId: wards[b].id, neighbourId: wards[a].id },
      ],
    });
  }

  // Five fictional households per ward.
  const surnames = [
    "Dlamini", "Nkosi", "Mokoena", "Khumalo", "Zulu",
    "Molefe", "Sithole", "Mahlangu", "Ndlovu", "Mthembu",
    "Tshabalala", "Radebe", "Maseko", "Ngwenya", "Buthelezi",
    "Mabaso", "Cele", "Shabalala", "Mkhize", "Zwane",
  ];
  const households = [];
  let n = 0;
  for (let w = 0; w < wards.length; w++) {
    for (let i = 1; i <= 5; i++) {
      households.push(
        await prisma.household.create({
          data: {
            reference: `DEMO-W${w + 1}-${String(i).padStart(3, "0")}`,
            householdName: `Demo ${surnames[n++]} household`,
            wardId: wards[w].id,
          },
        })
      );
    }
  }

  // One funeral event: home ward = Demo Ward 2, eligible = wards 1, 2, 3.
  // (Neighbour rule is a hackathon assumption pending owner confirmation.)
  const amount = new Prisma.Decimal("12.00");
  const event = await prisma.funeralEvent.create({
    data: {
      reference: "FE-2026-001",
      title: "Demo funeral event - Ward 2",
      eventDate: new Date("2026-10-25T09:00:00Z"),
      contributionAmount: amount,
      homeWardId: wards[1].id,
      createdById: admin.id,
    },
  });
  const eligibleWardIds = [wards[0].id, wards[1].id, wards[2].id];
  await prisma.eventEligibleWard.createMany({
    data: eligibleWardIds.map((wardId) => ({ eventId: event.id, wardId })),
  });

  const eligibleHouseholds = households.filter((h) => eligibleWardIds.includes(h.wardId));
  await prisma.contributionObligation.createMany({
    data: eligibleHouseholds.map((h) => ({
      eventId: event.id,
      householdId: h.id,
      amountDue: amount,
    })),
  });

  // Three demo payments: two full, one partial.
  const obligations = await prisma.contributionObligation.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: "asc" },
    take: 3,
  });
  const demoPayments = [
    { amount: "12.00", status: "PAID" as const },
    { amount: "12.00", status: "PAID" as const },
    { amount: "6.00", status: "PARTIALLY_PAID" as const },
  ];
  for (let i = 0; i < obligations.length; i++) {
    const payment = await prisma.payment.create({
      data: {
        obligationId: obligations[i].id,
        amount: new Prisma.Decimal(demoPayments[i].amount),
        method: "CASH",
        recordedById: admin.id,
        idempotencyKey: `seed-payment-${i + 1}`,
      },
    });
    await prisma.receipt.create({
      data: { reference: `RCT-SEED-${String(i + 1).padStart(4, "0")}`, paymentId: payment.id },
    });
    await prisma.contributionObligation.update({
      where: { id: obligations[i].id },
      data: { status: demoPayments[i].status },
    });
  }

  console.log("Seed complete: 4 wards, 20 households, 1 event, 15 obligations, 3 payments.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());