import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { paymentMode } from "../lib/onlinePayments";
import { demoFeePercent, feeFor, isValidPayReference, normaliseRef, simulateVoucherProvider } from "../lib/voucher";

// A USSD menu in the standard CON / END format that USSD providers use.
// DEMO ONLY: the server also plays the voucher provider when the member confirms.
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
    if (steps[0] !== "1" || steps.length > 3) return res.send(end("Invalid choice."));
    if (steps.length === 1) return res.send(con("Enter your 9-digit payment reference:"));

    const ref = normaliseRef(steps[1]);
    if (!isValidPayReference(ref)) {
      return res.send(end("That reference is not valid. Check the number and try again."));
    }
    const ob = await prisma.contributionObligation.findUnique({
      where: { payReference: ref },
      include: {
        event: { select: { reference: true, status: true } },
        payments: { select: { amount: true } },
      },
    });
    if (!ob) return res.send(end("Reference not found. Check the number and try again."));
    if (ob.event.status !== "ACTIVE") return res.send(end("This contribution is closed and cannot be paid."));

    const paid = ob.payments.reduce((s, p) => s.plus(p.amount), zero);
    const outstanding = ob.amountDue.minus(paid);
    if (outstanding.lte(0)) return res.send(end("This contribution is already paid in full."));

    if (steps.length === 2) {
      return res.send(
        con(
          `${ob.event.reference} contribution\nAmount: R${outstanding.toFixed(2)}\n(Demo provider fee R${feeFor(outstanding).toFixed(2)}, ${demoFeePercent()}%, comes out of the scheme's settlement)\n1. Confirm\n2. Cancel`
        )
      );
    }
    if (steps[2] === "2") return res.send(end("Cancelled. Nothing was paid."));
    if (steps[2] !== "1") return res.send(end("Invalid choice."));

    const sim = await simulateVoucherProvider(ref, outstanding);
    if (!sim.ok) {
      return res.send(end("We could not confirm the payment. Nothing was recorded. Please do not pay again until you are told."));
    }
    const r = sim.result;
    if (r.outcome === "confirmed") {
      return res.send(end(`Payment received.\nReceipt ${r.receiptNumber}\nAmount R${outstanding.toFixed(2)}`));
    }
    if (r.outcome === "duplicate") return res.send(end("This payment was already recorded."));
    return res.send(end("The payment could not be applied. It has been flagged for review. Please speak to your ward administrator."));
  } catch (err) {
    next(err);
  }
});

export default router;

