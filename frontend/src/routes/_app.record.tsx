import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/AuthContext";
import { ApiError, request } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { formatRand, methodLabel, newIdempotencyKey } from "@/lib/formatters";
import type {
  EventListItem,
  EventObligations,
  ObligationRow,
  PaymentMethod,
  PaymentResult,
} from "@/types/api";
import { FormField, inputClass } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const Route = createFileRoute("/_app/record")({
  validateSearch: (
    search: Record<string, unknown>
  ): { eventId?: string; householdId?: string } => ({
    eventId: typeof search.eventId === "string" ? search.eventId : undefined,
    householdId: typeof search.householdId === "string" ? search.householdId : undefined,
  }),
  component: RecordPage,
  head: () => ({ meta: [{ title: "Record contribution - Ponto Mpate" }] }),
});

const METHODS: PaymentMethod[] = ["CASH", "EFT", "OTHER"];

const primaryButton =
  "rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90 disabled:opacity-60";
const secondaryButton =
  "rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-gold disabled:opacity-60";

/** Display helper only. The server decides what is really outstanding. */
function outstandingOf(o: ObligationRow): string {
  const value = Number(o.amountDue) - Number(o.amountPaid);
  return (value > 0 ? value : 0).toFixed(2);
}

function parseAmount(text: string): number | null {
  const clean = text.trim().replace(",", ".");
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

function RecordPage() {
  const { isAdmin } = useAuth();
  const search = Route.useSearch();
  const events = useApi<EventListItem[]>(isAdmin ? "/funeral-events" : null);
  const active = (events.data ?? []).filter((e) => e.status === "ACTIVE");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-ink">Record a contribution</h1>
        <p className="mt-1 text-sm text-slate-600">
          A payment is only saved once the server confirms it. You will then get a receipt number.
        </p>
      </header>

      {!isAdmin ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          You have read-only access. Only administrators can record contributions.
        </p>
      ) : null}

      {isAdmin && events.loading ? <LoadingState label="Loading events..." /> : null}
      {isAdmin && events.error ? <ErrorState message={events.error} onRetry={events.refetch} /> : null}

      {isAdmin && events.data ? (
        active.length === 0 ? (
          <EmptyState
            title="There are no active events"
            hint="Payments can only be recorded against an active funeral event."
            action={
              <Link to="/events" className={primaryButton}>
                Go to funeral events
              </Link>
            }
          />
        ) : (
          <RecordForm
            events={active}
            initialEventId={search.eventId}
            initialHouseholdId={search.householdId}
          />
        )
      ) : null}
    </div>
  );
}

type Stage = "form" | "confirm" | "done";

function RecordForm({
  events,
  initialEventId,
  initialHouseholdId,
}: {
  events: EventListItem[];
  initialEventId?: string;
  initialHouseholdId?: string;
}) {
  const [eventId, setEventId] = useState(
    initialEventId && events.some((e) => e.id === initialEventId) ? initialEventId : ""
  );
  const [householdId, setHouseholdId] = useState(initialHouseholdId ?? "");
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [stage, setStage] = useState<Stage>("form");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState<{ payment: PaymentResult; duplicate: boolean } | null>(null);

  // One key per payment. Retrying the same payment reuses it, so it cannot be recorded twice.
  const keyRef = useRef("");
  if (!keyRef.current) keyRef.current = newIdempotencyKey();
  const freshKey = () => {
    keyRef.current = newIdempotencyKey();
  };

  const obligations = useApi<EventObligations>(
    eventId ? `/funeral-events/${eventId}/obligations` : null
  );
  const selected = obligations.data?.obligations.find((o) => o.household.id === householdId) ?? null;
  const event = events.find((e) => e.id === eventId) ?? null;

  // Pre-fill the amount once the chosen household is known (for example from a link)
  const selectedId = selected?.id;
  useEffect(() => {
    if (selected && amount === "") setAmount(outstandingOf(selected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const q = query.trim().toLowerCase();
  const matches = (obligations.data?.obligations ?? [])
    .filter(
      (o) =>
        !q ||
        o.household.householdName.toLowerCase().includes(q) ||
        o.household.reference.toLowerCase().includes(q)
    )
    .slice(0, 8);

  const amountNumber = parseAmount(amount);
  const outstanding = selected ? outstandingOf(selected) : null;
  const differsMessage =
    selected && selected.status !== "PAID" && amountNumber !== null && amountNumber > 0 && outstanding
      ? amountNumber < Number(outstanding) - 1e-9
        ? `This is less than the outstanding ${formatRand(outstanding)}. It will be recorded as a part payment.`
        : amountNumber > Number(outstanding) + 1e-9
          ? `This is more than the outstanding ${formatRand(outstanding)}. It cannot be recorded.`
          : ""
      : "";

  function clearFeedback() {
    setFieldErrors({});
    setFormError("");
  }

  function onEventChange(id: string) {
    setEventId(id);
    setHouseholdId("");
    setQuery("");
    setAmount("");
    freshKey();
    clearFeedback();
  }

  function chooseHousehold(o: ObligationRow) {
    setHouseholdId(o.household.id);
    setAmount(o.status === "PAID" ? "" : outstandingOf(o));
    freshKey();
    clearFeedback();
  }

  function onReview(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    const errs: Record<string, string> = {};
    if (!eventId) errs.eventId = "Choose the funeral event.";
    if (!selected) errs.householdId = "Choose the household.";
    if (selected) {
      if (selected.status === "PAID") {
        errs.householdId = "This household has already paid in full.";
      } else {
        const n = parseAmount(amount);
        if (n === null || n <= 0) errs.amount = "Enter the amount received.";
        else if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) errs.amount = "Use at most 2 decimal places.";
        else if (n > Number(outstandingOf(selected)) + 1e-9) {
          errs.amount = `This is more than the outstanding ${formatRand(outstandingOf(selected))}.`;
        }
      }
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length === 0) setStage("confirm");
  }

  async function submit() {
    if (submitting || !selected) return;
    const n = parseAmount(amount);
    if (n === null) return;
    setSubmitting(true);
    setFormError("");
    try {
      const body = await request<PaymentResult>(`/funeral-events/${eventId}/payments`, {
        method: "POST",
        body: { householdId, amount: n, method, idempotencyKey: keyRef.current },
      });
      setResult({ payment: body.data, duplicate: Boolean(body.duplicate) });
      setStage("done");
      obligations.refetch();
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = err.fieldErrors();
        if (Object.keys(fe).length > 0) {
          setFieldErrors(fe);
          setFormError("Please correct the highlighted fields.");
          setStage("form");
        } else if (err.status === 0) {
          setFormError(
            err.message + " If you are not sure whether it was saved, check the event page before trying again."
          );
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError("Something went wrong. The payment could not be confirmed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function recordAnother() {
    setStage("form");
    setResult(null);
    setHouseholdId("");
    setQuery("");
    setAmount("");
    freshKey();
    clearFeedback();
  }

  /* ------------------------------ Done ------------------------------ */
  if (stage === "done" && result) {
    const p = result.payment;
    return (
      <section
        role="status"
        aria-labelledby="done-heading"
        className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-6"
      >
        <h2 id="done-heading" className="text-xl font-semibold text-green-900">
          {result.duplicate ? "This payment was already recorded" : "Payment saved"}
        </h2>
        {result.duplicate ? (
          <p className="text-sm text-green-900">
            The server recognised this as the same payment, so no second payment was created.
          </p>
        ) : null}
        <dl className="grid gap-3 text-sm text-green-900 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide">Receipt number</dt>
            <dd className="text-lg font-bold">{p.receiptNumber ?? "Not available"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide">Amount</dt>
            <dd className="text-lg font-bold">
              {formatRand(p.amount)} ({methodLabel(p.method)})
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide">Household</dt>
            <dd>
              {selected ? `${selected.household.householdName} (${selected.household.reference})` : "Recorded"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide">Contribution status</dt>
            <dd>
              <StatusBadge status={p.obligationStatus} />
              {p.outstanding && Number(p.outstanding) > 0 ? ` ${formatRand(p.outstanding)} still outstanding` : ""}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-3">
          {p.receiptNumber ? (
            <Link
              to="/receipts/$receiptNumber"
              params={{ receiptNumber: p.receiptNumber }}
              className={primaryButton}
            >
              View / print receipt
            </Link>
          ) : null}
          <button type="button" onClick={recordAnother} className={secondaryButton}>
            Record another payment
          </button>
        </div>
      </section>
    );
  }

  /* ----------------------------- Confirm ----------------------------- */
  if (stage === "confirm" && selected) {
    return (
      <section
        aria-labelledby="confirm-heading"
        className="space-y-4 rounded-xl border-2 border-gold bg-white p-6"
      >
        <h2 id="confirm-heading" className="text-xl font-semibold text-ink">
          Check before recording
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Event</dt>
            <dd className="font-medium text-slate-900">
              {event?.reference} - {event?.title}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Household</dt>
            <dd className="font-medium text-slate-900">
              {selected.household.householdName} ({selected.household.reference})
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Ward</dt>
            <dd className="font-medium text-slate-900">{selected.household.ward.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Payment method</dt>
            <dd className="font-medium text-slate-900">{methodLabel(method)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Amount received</dt>
            <dd className="text-2xl font-bold text-ink">{formatRand(amountNumber)}</dd>
          </div>
        </dl>
        <p className="text-sm text-slate-600">
          Please confirm the money has been received. A recorded payment cannot be deleted from this app.
        </p>
        {formError ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {formError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={submit} disabled={submitting} className={primaryButton}>
            {submitting ? "Recording..." : "Confirm and record payment"}
          </button>
          <button
            type="button"
            onClick={() => {
              setFormError("");
              setStage("form");
            }}
            disabled={submitting}
            className={secondaryButton}
          >
            Go back and edit
          </button>
        </div>
      </section>
    );
  }

  /* ------------------------------ Form ------------------------------ */
  return (
    <form onSubmit={onReview} noValidate className="space-y-6">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">1. Funeral event</h2>
        <FormField label="Event" htmlFor="rc-event" error={fieldErrors.eventId}>
          <select
            id="rc-event"
            value={eventId}
            onChange={(e) => onEventChange(e.target.value)}
            aria-invalid={Boolean(fieldErrors.eventId)}
            aria-describedby={fieldErrors.eventId ? "rc-event-error" : undefined}
            className={inputClass}
          >
            <option value="">Choose an event...</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.reference} - {e.title} ({e.homeWard.name}, {formatRand(e.contributionAmount)} per household)
              </option>
            ))}
          </select>
        </FormField>
      </section>

      {eventId ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">2. Household</h2>
          {obligations.loading ? <LoadingState label="Loading households..." /> : null}
          {obligations.error ? <ErrorState message={obligations.error} onRetry={obligations.refetch} /> : null}
          {obligations.data ? (
            <>
              <FormField
                label="Find the household"
                htmlFor="rc-search"
                hint="Type a name or reference, then choose the correct household."
                error={fieldErrors.householdId}
              >
                <input
                  id="rc-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.householdId)}
                  className={inputClass}
                />
              </FormField>

              {matches.length === 0 ? (
                <p className="text-sm text-slate-600">
                  No household on this event matches. Only households that owe a contribution for this event
                  are listed.
                </p>
              ) : (
                <ul className="space-y-2">
                  {matches.map((o) => {
                    const isSelected = o.household.id === householdId;
                    return (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => chooseHousehold(o)}
                          aria-pressed={isSelected}
                          className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 text-left text-sm ${
                            isSelected ? "border-gold bg-amber-50" : "border-slate-200 bg-white hover:border-gold"
                          }`}
                        >
                          <span>
                            <span className="block font-semibold text-ink">{o.household.householdName}</span>
                            <span className="block font-mono text-xs text-slate-600">
                              {o.household.reference} - {o.household.ward.name}
                            </span>
                          </span>
                          <span className="flex items-center gap-3">
                            <span className="text-xs text-slate-600">
                              Outstanding {formatRand(outstandingOf(o))}
                            </span>
                            <StatusBadge status={o.status} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : null}
        </section>
      ) : null}

      {selected ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-ink">3. Payment</h2>

          <div className="rounded-lg bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-ink">
              {selected.household.householdName} ({selected.household.reference})
            </p>
            <p className="text-slate-600">
              {selected.household.ward.name} - due {formatRand(selected.amountDue)}, paid{" "}
              {formatRand(selected.amountPaid)}, outstanding {formatRand(outstandingOf(selected))}
            </p>
          </div>

          {selected.status === "PAID" ? (
            <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
              This household has already paid in full for this event.
            </p>
          ) : (
            <>
              <FormField
                label="Amount received (R)"
                htmlFor="rc-amount"
                error={fieldErrors.amount}
                hint={`Outstanding: ${formatRand(outstanding)}`}
              >
                <input
                  id="rc-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    freshKey();
                  }}
                  aria-invalid={Boolean(fieldErrors.amount)}
                  aria-describedby={fieldErrors.amount ? "rc-amount-error" : "rc-amount-hint"}
                  className={inputClass}
                />
              </FormField>
              {differsMessage ? (
                <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {differsMessage}
                </p>
              ) : null}

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-800">Payment method</legend>
                <div className="flex flex-wrap gap-3">
                  {METHODS.map((m) => (
                    <label
                      key={m}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
                        method === m ? "border-gold bg-amber-50" : "border-slate-300 bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="rc-method"
                        value={m}
                        checked={method === m}
                        onChange={() => {
                          setMethod(m);
                          freshKey();
                        }}
                      />
                      {methodLabel(m)}
                    </label>
                  ))}
                </div>
              </fieldset>

              {formError ? (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {formError}
                </p>
              ) : null}

              <button type="submit" className={primaryButton}>
                Review payment
              </button>
            </>
          )}
        </section>
      ) : null}
    </form>
  );
}
