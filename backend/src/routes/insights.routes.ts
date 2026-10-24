import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/authenticate";
import { reconcileEvent } from "../lib/reconcile";

const router = Router();
router.use(authenticate);

const zero = new Prisma.Decimal(0);
const LOW_RATE = 50; // percent
const DUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const FORECAST_MIN_EVENTS = 5;

type Insight = {
  type: string;
  severity: "info" | "attention";
  title: string;
  detail: string;
  basis: string; // how the insight was calculated
};

const pct = (recorded: Prisma.Decimal, expected: Prisma.Decimal) =>
  expected.gt(0) ? recorded.div(expected).mul(100).toNumber() : 0;

router.get("/", async (_req, res, next) => {
  try {
    const events = await prisma.funeralEvent.findMany({
      where: { status: { not: "CANCELLED" } },
      orderBy: { eventDate: "asc" },
      select: { id: true, reference: true, eventDate: true, status: true },
    });

    const obligations = await prisma.contributionObligation.findMany({
      where: { event: { status: { not: "CANCELLED" } } },
      select: {
        eventId: true,
        amountDue: true,
        payments: { select: { amount: true } },
        household: { select: { wardId: true, ward: { select: { name: true } } } },
      },
    });

    type WardTotals = { name: string; households: number; recorded: Prisma.Decimal };
    type EventTotals = {
      expected: Prisma.Decimal;
      recorded: Prisma.Decimal;
      households: number;
      wards: Map<string, WardTotals>;
    };
    const totals = new Map<string, EventTotals>();

    for (const o of obligations) {
      const paid = o.payments.reduce((s, p) => s.plus(p.amount), zero);
      let t = totals.get(o.eventId);
      if (!t) {
        t = { expected: zero, recorded: zero, households: 0, wards: new Map() };
        totals.set(o.eventId, t);
      }
      t.expected = t.expected.plus(o.amountDue);
      t.recorded = t.recorded.plus(paid);
      t.households++;
      const w = t.wards.get(o.household.wardId) ?? {
        name: o.household.ward.name,
        households: 0,
        recorded: zero,
      };
      w.households++;
      w.recorded = w.recorded.plus(paid);
      t.wards.set(o.household.wardId, w);
    }

    const insights: Insight[] = [];
    const now = Date.now();

    for (const e of events) {
      const t = totals.get(e.id);
      if (!t) continue;
      const rate = pct(t.recorded, t.expected);
      const days = Math.floor((now - e.eventDate.getTime()) / 86_400_000);

      if (e.status === "ACTIVE" && days >= 0 && rate < LOW_RATE) {
        insights.push({
          type: "LOW_COLLECTION",
          severity: days >= 7 ? "attention" : "info",
          title: `${e.reference} is at ${rate.toFixed(1)}% collected`,
          detail: `R${t.recorded.toFixed(2)} of R${t.expected.toFixed(2)} recorded; R${t.expected.minus(t.recorded).toFixed(2)} outstanding. The event was ${days} day(s) ago.`,
          basis: `Flagged when an active event is below ${LOW_RATE}% collected. Recent events are marked info, events 7+ days old are marked attention.`,
        });
      }

      if (e.status === "ACTIVE" && t.recorded.gt(0)) {
        for (const w of t.wards.values()) {
          if (w.recorded.isZero() && w.households > 0) {
            insights.push({
              type: "WARD_NO_PAYMENTS",
              severity: "info",
              title: `${w.name}: no payments recorded for ${e.reference}`,
              detail: `${w.households} household(s) in ${w.name} have no recorded payment yet, while the event overall is at ${rate.toFixed(1)}%.`,
              basis: "Flagged when a ward has no recorded payments but other wards in the same event do. This may just mean its collection has not been captured yet.",
            });
          }
        }
      }

      if (e.status === "ACTIVE" || e.status === "CLOSED") {
        const r = await reconcileEvent(e.id);
        const hasCash = Number(r.cashRecorded) > 0;
        if (r.status === "NEEDS_REVIEW") {
          insights.push({
            type: "CASH_MISMATCH",
            severity: "attention",
            title: `${e.reference}: cash handed over does not match cash recorded`,
            detail: `${r.message} (recorded cash R${r.cashRecorded}, handed over R${r.handedOver}).`,
            basis: "Compares recorded CASH payments with the sum of recorded handovers. A difference is for review only, not evidence of wrongdoing.",
          });
        } else if (r.status === "AWAITING_HANDOVER" && hasCash && e.status === "ACTIVE") {
          insights.push({
            type: "AWAITING_HANDOVER",
            severity: "info",
            title: `${e.reference}: R${r.cashRecorded} cash recorded, no handover recorded`,
            detail: "Record the cash handover so the event can be reconciled and closed.",
            basis: "Flagged when an active event has recorded cash payments and no handovers.",
          });
        }
      }
    }

    // Possible duplicate payments: same obligation, same amount, recorded within 10 minutes
    const payments = await prisma.payment.findMany({
      orderBy: { paidAt: "asc" },
      select: {
        obligationId: true,
        amount: true,
        paidAt: true,
        receipt: { select: { reference: true } },
        obligation: {
          select: {
            household: { select: { reference: true } },
            event: { select: { reference: true } },
          },
        },
      },
    });
    const byObligation = new Map<string, typeof payments>();
    for (const p of payments) {
      const list = byObligation.get(p.obligationId) ?? [];
      list.push(p);
      byObligation.set(p.obligationId, list);
    }
    for (const list of byObligation.values()) {
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1];
        const b = list[i];
        if (a.amount.equals(b.amount) && b.paidAt.getTime() - a.paidAt.getTime() <= DUP_WINDOW_MS) {
          insights.push({
            type: "POSSIBLE_DUPLICATE_PAYMENT",
            severity: "attention",
            title: `Two R${a.amount.toFixed(2)} payments for ${b.obligation.household.reference} on ${b.obligation.event.reference}`,
            detail: `Receipts ${a.receipt?.reference ?? "?"} and ${b.receipt?.reference ?? "?"} were recorded within ${Math.max(1, Math.round((b.paidAt.getTime() - a.paidAt.getTime()) / 60000))} minute(s) of each other. It may be a genuine two-part payment or an accidental repeat. Please confirm.`,
            basis: `Flagged when the same household pays the same amount twice for one event within ${DUP_WINDOW_MS / 60000} minutes.`,
          });
        }
      }
    }

    insights.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "attention" ? -1 : 1));

    // Historical trend and an honest forecast
    const trend = events.map((e) => {
      const t = totals.get(e.id);
      return {
        reference: e.reference,
        eventDate: e.eventDate,
        status: e.status,
        collectionRate: t ? Number(pct(t.recorded, t.expected).toFixed(1)) : 0,
      };
    });
    const closed = trend.filter((t) => t.status === "CLOSED");
    const lastClosed = closed.slice(-FORECAST_MIN_EVENTS);
    const forecast =
      closed.length >= FORECAST_MIN_EVENTS
        ? {
            available: true,
            method: `Simple average collection rate of the last ${FORECAST_MIN_EVENTS} closed events`,
            expectedCollectionRate: Number(
              (lastClosed.reduce((s, t) => s + t.collectionRate, 0) / lastClosed.length).toFixed(1)
            ),
            caveat: "An average of past events, not a prediction model. Real collection can differ.",
          }
        : {
            available: false,
            reason: `At least ${FORECAST_MIN_EVENTS} closed events are needed for a forecast. There are ${closed.length}.`,
          };

    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        summary: {
          attention: insights.filter((i) => i.severity === "attention").length,
          info: insights.filter((i) => i.severity === "info").length,
        },
        insights,
        trend,
        forecast,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
