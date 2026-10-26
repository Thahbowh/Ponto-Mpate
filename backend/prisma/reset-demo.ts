import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

// Resets the DEMO database to a known story. Fictional data only.
const prisma = new PrismaClient();

const AMOUNT = "12.00";
const YEAR = new Date().getFullYear();

const WARDS = [
  { name: "Demo Ward 1", households: ["Dlamini", "Nkosi", "Mokoena", "Khumalo", "Zulu"] },
  { name: "Demo Ward 2", households: ["Mofokeng", "Letsie", "Mohapi", "Ramokoena", "Tau"] },
  { name: "Demo Ward 3", households: ["Sekhonyana", "Makhetha", "Motaung", "Radebe", "Khoabane"] },
  { name: "Demo Ward 4", households: ["Mokone", "Lebona", "Thekiso"] },
];

function daysAgo(n: number, hour = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function minutesAfter(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}

function dbTarget(): string {
  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    return `${u.hostname}:${u.port || "3306"}${u.pathname}`;
  } catch {
    return "(unknown database)";
  }
}

async function main() {
  if (!process.argv.includes("--yes")) {
    console.log(`This will DELETE ALL DATA in ${dbTarget()} and rebuild the demo.`);
    console.log("To continue, run:  npx tsx prisma/reset-demo.ts --yes");
    return;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run with NODE_ENV=production.");
  }

  const notDemo = await prisma.household.count({
    where: {
      NOT: [{ reference: { startsWith: "DEMO-" } }, { reference: { startsWith: "HH-" } }],
    },
  });
  if (notDemo > 0) {
    throw new Error(`Found ${notDemo} household(s) that do not look like demo data. Refusing to delete anything.`);
  }

  console.log(`Resetting ${dbTarget()} ...`);

  // Children first, so nothing is blocked by a foreign key
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.voucherTransaction.deleteMany(),
    prisma.paymentAttempt.deleteMany(),
    prisma.receipt.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.cashHandover.deleteMany(),
    prisma.contributionObligation.deleteMany(),
    prisma.eventEligibleWard.deleteMany(),
    prisma.funeralEvent.deleteMany(),
    prisma.householdMember.deleteMany(),
    prisma.wardNeighbour.deleteMany(),
    prisma.household.deleteMany(),
    prisma.ward.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  await prisma.setting.upsert({
    where: { id: 1 },
    update: { schemeName: "Ponto Mpate (demo)", defaultContributionAmount: AMOUNT },
    create: { id: 1, schemeName: "Ponto Mpate (demo)", defaultContributionAmount: AMOUNT },
  });

  // Users
  const adminPw = process.env.DEMO_ADMIN_PASSWORD ?? "PontoAdmin2026";
  const viewerPw = process.env.DEMO_VIEWER_PASSWORD ?? "ViewerDemo2026";
  const memberPw = process.env.DEMO_MEMBER_PASSWORD ?? "MemberDemo2026";
  const admin = await prisma.user.create({
    data: { email: "admin@demo.example", name: "Demo Administrator", passwordHash: await bcrypt.hash(adminPw, 10), role: "ADMIN" },
  });
  await prisma.user.create({
    data: { email: "viewer@demo.example", name: "Demo Viewer", passwordHash: await bcrypt.hash(viewerPw, 10), role: "VIEWER" },
  });
  const member = await prisma.user.create({
    data: { email: "member@demo.example", name: "Demo Member", passwordHash: await bcrypt.hash(memberPw, 10), role: "MEMBER" },
  });

  // Wards (chain: 1-2, 2-3, 3-4) and households
  const wards = [];
  for (const w of WARDS) wards.push(await prisma.ward.create({ data: { name: w.name } }));
  for (const [a, b] of [[0, 1], [1, 2], [2, 3]]) {
    await prisma.wardNeighbour.createMany({
      data: [
        { wardId: wards[a].id, neighbourId: wards[b].id },
        { wardId: wards[b].id, neighbourId: wards[a].id },
      ],
    });
  }
  for (let w = 0; w < WARDS.length; w++) {
    await prisma.household.createMany({
      data: WARDS[w].households.map((surname, i) => ({
        reference: `DEMO-W${w + 1}-${String(i + 1).padStart(3, "0")}`,
        householdName: `Demo ${surname} household`,
        houseNumber: String(10 + w * 20 + i * 2),
        wardId: wards[w].id,
      })),
    });
  }

  // The demo member is already approved for one household
  const memberHousehold = await prisma.household.findUniqueOrThrow({ where: { reference: "DEMO-W2-003" } });
  await prisma.householdMember.create({
    data: { userId: member.id, householdId: memberHousehold.id, status: "APPROVED", decidedAt: new Date() },
  });

  // A second member, in Ward 1, to show that messages only go to the funeral's own ward
  const member1 = await prisma.user.create({
    data: { email: "member.ward1@demo.example", name: "Demo Member (Ward 1)", passwordHash: await bcrypt.hash(memberPw, 10), role: "MEMBER" },
  });
  const member1Household = await prisma.household.findUniqueOrThrow({ where: { reference: "DEMO-W1-002" } });
  await prisma.householdMember.create({
    data: { userId: member1.id, householdId: member1Household.id, status: "APPROVED", decidedAt: new Date() },
  });
  // Helpers for building events and payments
  let payNo = 0;
  let handoverNo = 0;
  const paidCents = new Map<string, number>();

  async function createEvent(
    reference: string,
    title: string,
    eventDate: Date,
    status: "ACTIVE" | "CLOSED",
    homeIndex: number,
    bereavedRef: string
  ) {
    // Only the funeral's own ward contributes, and the household holding the funeral is exempt
    const home = wards[homeIndex];
    const bereaved = await prisma.household.findUniqueOrThrow({ where: { reference: bereavedRef } });
    const event = await prisma.funeralEvent.create({
      data: {
        reference,
        title,
        eventDate,
        status,
        contributionAmount: AMOUNT,
        homeWardId: home.id,
        bereavedHouseholdId: bereaved.id,
        createdById: admin.id,
        createdAt: eventDate,
      },
    });
    await prisma.eventEligibleWard.createMany({ data: [{ eventId: event.id, wardId: home.id }] });
    const households = await prisma.household.findMany({
      where: { wardId: home.id, isActive: true, id: { not: bereaved.id } },
      orderBy: { reference: "asc" },
    });
    await prisma.contributionObligation.createMany({
      data: households.map((h) => ({ eventId: event.id, householdId: h.id, amountDue: AMOUNT })),
    });
    const obligations = await prisma.contributionObligation.findMany({
      where: { eventId: event.id },
      include: { household: { select: { reference: true } } },
    });
    const byRef = new Map(obligations.map((o) => [o.household.reference, o]));
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "EVENT_CREATED",
        entityType: "FuneralEvent",
        entityId: event.id,
        details: { reference, exemptHousehold: bereavedRef, households: households.length, contributionAmount: AMOUNT },
        createdAt: eventDate,
      },
    });
    return { event, refs: households.map((h) => h.reference), byRef };
  }

  async function pay(
    eventId: string,
    ob: { id: string; household: { reference: string } },
    amount: string,
    method: "CASH" | "EFT",
    at: Date
  ) {
    payNo++;
    const payment = await prisma.payment.create({
      data: {
        obligationId: ob.id,
        amount,
        method,
        paidAt: at,
        recordedById: admin.id,
        idempotencyKey: `demo-pay-${payNo}`,
        createdAt: at,
      },
    });
    const receipt = await prisma.receipt.create({
      data: { reference: `PM-${YEAR}-${String(payNo).padStart(5, "0")}`, paymentId: payment.id, issuedAt: at },
    });
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "PAYMENT_RECORDED",
        entityType: "Payment",
        entityId: payment.id,
        details: { eventId, household: ob.household.reference, amount, method, receipt: receipt.reference },
        createdAt: at,
      },
    });
    paidCents.set(ob.id, (paidCents.get(ob.id) ?? 0) + Math.round(Number(amount) * 100));
  }

  async function handover(eventId: string, amount: string, note: string, at: Date) {
    handoverNo++;
    const h = await prisma.cashHandover.create({
      data: {
        eventId,
        amount,
        note,
        handedOverAt: at,
        recordedById: admin.id,
        idempotencyKey: `demo-ho-${handoverNo}`,
        createdAt: at,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: "CASH_HANDOVER_RECORDED",
        entityType: "CashHandover",
        entityId: h.id,
        details: { eventId, amount },
        createdAt: at,
      },
    });
  }

  async function settle(eventId: string) {
    const obs = await prisma.contributionObligation.findMany({ where: { eventId } });
    for (const o of obs) {
      const paid = paidCents.get(o.id) ?? 0;
      const due = Math.round(Number(o.amountDue) * 100);
      const status = paid >= due ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "UNPAID";
      if (status !== "UNPAID") {
        await prisma.contributionObligation.update({ where: { id: o.id }, data: { status } });
      }
    }
  }

  // Event 1: closed history. Ward 1 holds the funeral and the Zulu household is exempt, so 4 households pay.
  // 2 paid cash, 1 paid by transfer, 1 part payment. All cash handed over.
  const e1Date = daysAgo(40);
  const e1 = await createEvent(`FE-${YEAR}-001`, "Demo funeral event 1", e1Date, "CLOSED", 0, "DEMO-W1-005");
  for (let i = 0; i < e1.refs.length; i++) {
    const ob = e1.byRef.get(e1.refs[i])!;
    const at = minutesAfter(e1Date, 60 * (i + 1));
    if (i < 2) await pay(e1.event.id, ob, "12.00", "CASH", at);
    else if (i === 2) await pay(e1.event.id, ob, "12.00", "EFT", at);
    else await pay(e1.event.id, ob, "6.00", "CASH", at);
  }
  await handover(e1.event.id, "20.00", "First handover", minutesAfter(e1Date, 60 * 24));
  await handover(e1.event.id, "10.00", "Remaining cash", minutesAfter(e1Date, 60 * 26));
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: "EVENT_CLOSED",
      entityType: "FuneralEvent",
      entityId: e1.event.id,
      details: { reference: e1.event.reference, reconciliationStatus: "MATCHED" },
      createdAt: minutesAfter(e1Date, 60 * 30),
    },
  });

  // Event 2: active. Ward 2 holds the funeral and the Tau household is exempt, so 4 households pay.
  // 1 paid cash and 1 part payment (cash), with no handover recorded yet. The demo member (Mohapi) still owes.
  const e2Date = daysAgo(10);
  const e2 = await createEvent(`FE-${YEAR}-002`, "Demo funeral event 2", e2Date, "ACTIVE", 1, "DEMO-W2-005");
  const plan: [string, string, "CASH" | "EFT"][] = [
    ["DEMO-W2-001", "12.00", "CASH"],
    ["DEMO-W2-002", "6.00", "CASH"],
  ];
  for (let i = 0; i < plan.length; i++) {
    const [ref, amount, method] = plan[i];
    await pay(e2.event.id, e2.byRef.get(ref)!, amount, method, minutesAfter(e2Date, 45 * (i + 1)));
  }

  await settle(e1.event.id);
  await settle(e2.event.id);

  await prisma.notification.create({
    data: {
      userId: member.id,
      eventId: e2.event.id,
      title: "Funeral contribution due",
      message: `A funeral has been announced in Demo Ward 2. Your household's contribution is R12.00 for FE-${YEAR}-002 (Demo funeral event 2). You can pay online or at a participating shop from your Contributions page.`,
      createdAt: e2Date,
    },
  });

  const counts = {
    wards: await prisma.ward.count(),
    households: await prisma.household.count(),
    events: await prisma.funeralEvent.count(),
    contributions: await prisma.contributionObligation.count(),
    payments: await prisma.payment.count(),
    handovers: await prisma.cashHandover.count(),
    users: await prisma.user.count(),
  };
  console.log("Demo rebuilt:", counts);
  console.log("Sign in with:");
  console.log("  admin@demo.example   (administrator)");
  console.log("  viewer@demo.example  (read only)");
  console.log("  member@demo.example  (household DEMO-W2-003)");
  console.log("Passwords come from DEMO_ADMIN_PASSWORD, DEMO_VIEWER_PASSWORD and DEMO_MEMBER_PASSWORD, or the defaults.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());




