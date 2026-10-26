import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { paymentMode } from "../lib/onlinePayments";
import { demoFeePercent, feeFor, isValidPayReference, normaliseRef, simulateVoucherProvider } from "../lib/voucher";

// A USSD menu in the standard CON / END format that USSD providers use.
// The member types the household's own reference. DEMO ONLY: the server also plays the voucher provider.
const router = Router();
const zero = new Prisma.Decimal(0);
const con = (s: string) => `CON ${s}`;
const end = (s: string) => `END ${s}`;

router.post("/session", async (req, res, next) => {
  try {
    res.type("text/plain");
    if (paymentMode() !== "demo") return res.send(end("This service is not available."));

    const raw = typeof req.body?.text === "string" ? req.body.text : "";
    const steps = raw === "" ? [] : raw.split("*");

    if (steps.length === 0) {
      return res.send(con("Ponto Mpate (demo)\n1. Pay a contribution\n0. Exit"));
    }
    if (steps[0] === "0") return res.send(end("Goodbye."));
    if (steps[0] !== "1" || steps.length > 4) return res.send(end("Invalid choice."));
    if (steps.length === 1) return res.send(con("Enter your 9-digit household reference:"));

    const ref = normaliseRef(steps[1]);
    if (!isValidPayReference(ref)) {
      return res.send(end("That reference is not valid. Check the number and try again."));
    }
    const household = await prisma.household.findUnique({
      where: { reference: ref },
      select: { id: true, isActive: true },
    });
    if (!household || !household.isActive) {
      return res.send(end("Reference not found. Check the number and try again."));
    }

    const obligations = await prisma.contributionObligation.findMany({
      where: { householdId: household.id, event: { status: "ACTIVE" } },
      include: { event: { select: { reference: true } }, payments: { select: { amount: true } } },
      orderBy: { event: { eventDate: "asc" } },
    });
    const due = obligations
      .map((o) => ({
        eventRef: o.event.reference,
        outstanding: o.amountDue.minus(o.payments.reduce((s, p) => s.plus(p.amount), zero)),
      }))
      .filter((d) => d.outstanding.gt(0));
    if (due.length === 0) return res.send(end("Nothing is due for this household right now."));

    // One contribution: go straight to confirm. Several: ask which one to pay first.
    const shown = due.slice(0, 4);
    let chosen = shown[0];
    let confirmAt = 2;
    if (due.length > 1) {
      confirmAt = 3;
      if (steps.length === 2) {
        const list = shown.map((d, i) => `${i + 1}. ${d.eventRef} R${d.outstanding.toFixed(2)}`).join("\n");
        return res.send(con(`Choose a contribution:\n${list}\n0. Cancel`));
      }
      if (steps[2] === "0") return res.send(end("Cancelled. Nothing was paid."));
      const n = Number(steps[2]);
      if (!Number.isInteger(n) || n < 1 || n > shown.length) return res.send(end("Invalid choice."));
      chosen = shown[n - 1];
    }

    if (steps.length === confirmAt) {
      return res.send(
        con(
          `${chosen.eventRef} contribution\nAmount: R${chosen.outstanding.toFixed(2)}\n(Demo provider fee R${feeFor(chosen.outstanding).toFixed(2)}, ${demoFeePercent()}%, comes out of the scheme's settlement)\n1. Confirm\n2. Cancel`
        )
      );
    }
    if (steps[confirmAt] === "2") return res.send(end("Cancelled. Nothing was paid."));
    if (steps[confirmAt] !== "1" || steps.length > confirmAt + 1) return res.send(end("Invalid choice."));

    const sim = await simulateVoucherProvider(ref, chosen.outstanding, chosen.eventRef);
    if (!sim.ok) {
      return res.send(end("We could not confirm the payment. Nothing was recorded. Please do not pay again until you are told."));
    }
    const r = sim.result;
    if (r.outcome === "confirmed") {
      return res.send(end(`Payment received.\nReceipt ${r.receiptNumber}\nAmount R${chosen.outstanding.toFixed(2)}`));
    }
    if (r.outcome === "duplicate") return res.send(end("This payment was already recorded."));
    return res.send(end("The payment could not be applied. It has been flagged for review. Please speak to your ward administrator."));
  } catch (err) {
    next(err);
  }
});

export default router;
