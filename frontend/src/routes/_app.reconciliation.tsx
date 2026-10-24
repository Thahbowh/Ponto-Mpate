import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/AuthContext";
import { api, ApiError, request } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { formatDateTime, formatRand, newIdempotencyKey } from "@/lib/formatters";
import type { EventListItem, Handover, Reconciliation } from "@/types/api";
import { FormField, inputClass } from "@/components/ui/FormField";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const Route = createFileRoute("/_app/reconciliation")({
  component: ReconciliationPage,
  head: () => ({ meta: [{ title: "Reconciliation - Ponto Mpate" }] }),
});

interface ReconData {
  event: { id: string; reference: string; title: string; status: string };
  reconciliation: Reconciliation;
  handovers: Handover[];
}

interface HandoverResult {
  handover: { id: string; eventId: string; amount: string; handedOverAt: string };
  reconciliation: Reconciliation;
}

interface CloseResult {
  id: string;
  reference: string;
  status: string;
  reconciliation: Reconciliation;
  summary: {
    expected: string;
    recorded: string;
    outstanding: string;
    householdsNotFullyPaid: number;
  };
}

const primaryButton =
  "rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90 disabled:opacity-60";
const secondaryButton =
  "rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-gold disabled:opacity-60";

/** Display only: the server calculates the real difference. */
function signed(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return formatRand(0);
  return `${n < 0 ? "-" : "+"}${formatRand(Math.abs(n))}`;
}

function parseAmount(text: string): number | null {
  const clean = text.trim().replace(",", ".");
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

function ReconciliationPage() {
  const events = useApi<EventListItem[]>("/funeral-events");
  const [eventId, setEventId] = useState("");

  const list = (events.data ?? []).filter((e) => e.status !== "CANCELLED");
  const event = list.find((e) => e.id === eventId) ?? null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-ink">Reconciliation</h1>
        <p className="mt-1 text-sm text-slate-600">
          Compare the cash recorded for an event with the cash handed over. A difference is a prompt to
          check the records, not a conclusion about anyone.
        </p>
      </header>

      {events.loading ? <LoadingState label="Loading events..." /> : null}
      {events.error ? <ErrorState message={events.error} onRetry={events.refetch} /> : null}

      {events.data ? (
        list.length === 0 ? (
          <EmptyState title="No funeral events yet" hint="Create an event and record payments first." />
        ) : (
          <>
            <div className="max-w-xl">
              <FormField label="Funeral event" htmlFor="rec-event">
                <select
                  id="rec-event"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Choose an event...</option>
                  {list.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.reference} - {e.title} ({e.status === "ACTIVE" ? "Active" : "Closed"})
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            {event ? (
              <EventReconciliation key={event.id} eventId={event.id} onChanged={events.refetch} />
            ) : (
              <p className="text-sm text-slate-600">Choose an event to see its reconciliation.</p>
            )}
          </>
        )
      ) : null}
    </div>
  );
}

function EventReconciliation({ eventId, onChanged }: { eventId: string; onChanged: () => void }) {
  const { isAdmin } = useAuth();
  const { data, loading, error, refetch } = useApi<ReconData>(`/reconciliation/${eventId}`);
  const [closedResult, setClosedResult] = useState<CloseResult | null>(null);

  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (!data) return loading ? <LoadingState label="Loading reconciliation..." /> : null;

  const r = data.reconciliation;
  const isActive = data.event.status === "ACTIVE";
  const remaining = Math.max(0, Number(r.cashRecorded) - Number(r.handedOver));

  const panelStyle =
    r.status === "MATCHED"
      ? "border-green-200 bg-green-50 text-green-900"
      : r.status === "NEEDS_REVIEW"
        ? "border-orange-200 bg-orange-50 text-orange-900"
        : "border-slate-200 bg-slate-50 text-slate-800";

  function changed() {
    refetch();
    onChanged();
  }

  return (
    <div className="space-y-6">
      <section role="status" aria-label="Reconciliation status" className={`rounded-xl border p-4 ${panelStyle}`}>
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-semibold">
            {data.event.reference} - {data.event.title}
          </p>
          <StatusBadge status={r.status} />
          <StatusBadge status={data.event.status} />
        </div>
        <p className="mt-2 text-sm">{r.message}</p>
      </section>

      <section aria-label="Reconciliation figures" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Cash recorded" value={formatRand(r.cashRecorded)} hint="Cash payments saved for this event" />
        <StatCard
          label="Cash handed over"
          value={formatRand(r.handedOver)}
          hint={`${r.handoverCount} handover${r.handoverCount === 1 ? "" : "s"} recorded`}
        />
        <StatCard
          label="Difference"
          value={signed(r.difference)}
          hint="Handed over minus recorded. Needs review if not zero."
        />
      </section>
      <p className="text-sm text-slate-600">
        Non-cash payments recorded (electronic transfer or other): {formatRand(r.nonCashRecorded)}. These do not
        need a cash handover.
      </p>

      {isAdmin && isActive ? (
        <HandoverForm eventId={eventId} remaining={remaining} onSaved={changed} />
      ) : null}
      {!isAdmin ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          You have read-only access. Only administrators can record handovers or close events.
        </p>
      ) : null}

      <section aria-labelledby="history-heading" className="space-y-3">
        <h2 id="history-heading" className="text-lg font-semibold text-ink">
          Handover history
        </h2>
        {data.handovers.length === 0 ? (
          <EmptyState title="No handovers recorded yet" />
        ) : (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {data.handovers.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <div>
                  <p className="font-semibold text-ink">{formatRand(h.amount)}</p>
                  <p className="text-xs text-slate-500">
                    {formatDateTime(h.handedOverAt)} - recorded by {h.recordedBy}
                  </p>
                </div>
                {h.note ? <p className="text-slate-600">{h.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {closedResult ? (
        <section role="status" className="rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-900">
          <p className="text-lg font-semibold">{closedResult.reference} is now closed</p>
          <p className="mt-1">
            Expected {formatRand(closedResult.summary.expected)}, recorded {formatRand(closedResult.summary.recorded)},
            outstanding {formatRand(closedResult.summary.outstanding)}.{" "}
            {closedResult.summary.householdsNotFullyPaid} household
            {closedResult.summary.householdsNotFullyPaid === 1 ? "" : "s"} had not paid in full. No further
            payments can be recorded.
          </p>
        </section>
      ) : isActive ? (
        isAdmin ? (
          <ClosePanel
            eventId={eventId}
            reference={data.event.reference}
            r={r}
            onClosed={(result) => {
              setClosedResult(result);
              changed();
            }}
          />
        ) : null
      ) : (
        <p className="rounded-xl border border-slate-300 bg-slate-100 p-4 text-sm text-slate-700">
          This event is closed. No further payments or handovers can be recorded.
        </p>
      )}
    </div>
  );
}

function HandoverForm({
  eventId,
  remaining,
  onSaved,
}: {
  eventId: string;
  remaining: number;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [stage, setStage] = useState<"form" | "confirm">("form");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState<{ duplicate: boolean; r: Reconciliation } | null>(null);

  // One key per handover. A retry of the same handover reuses it, so it cannot be recorded twice.
  const keyRef = useRef("");
  if (!keyRef.current) keyRef.current = newIdempotencyKey();
  const freshKey = () => {
    keyRef.current = newIdempotencyKey();
  };

  const n = parseAmount(amount);
  const moreThanRemaining = n !== null && n > 0 && n > remaining + 1e-9;

  function onReview(e: FormEvent) {
    e.preventDefault();
    setSaved(null);
    setFormError("");
    const errs: Record<string, string> = {};
    if (n === null || n <= 0) errs.amount = "Enter the amount handed over.";
    else if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) errs.amount = "Use at most 2 decimal places.";
    setFieldErrors(errs);
    if (Object.keys(errs).length === 0) setStage("confirm");
  }

  async function submit() {
    if (submitting || n === null) return;
    setSubmitting(true);
    setFormError("");
    try {
      const body = await request<HandoverResult>("/reconciliation", {
        method: "POST",
        body: {
          eventId,
          amount: n,
          ...(note.trim() ? { note: note.trim() } : {}),
          idempotencyKey: keyRef.current,
        },
      });
      setSaved({ duplicate: Boolean(body.duplicate), r: body.data.reconciliation });
      setAmount("");
      setNote("");
      freshKey();
      setStage("form");
      onSaved();
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = err.fieldErrors();
        if (Object.keys(fe).length > 0) {
          setFieldErrors(fe);
          setFormError("Please correct the highlighted fields.");
          setStage("form");
        } else if (err.status === 0) {
          setFormError(
            err.message + " If you are not sure whether it was saved, refresh this page before trying again."
          );
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError("Something went wrong. The handover could not be confirmed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="handover-heading" className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 id="handover-heading" className="text-lg font-semibold text-ink">
        Record a cash handover
      </h2>

      {stage === "confirm" ? (
        <div className="mt-4 space-y-4 rounded-lg border-2 border-gold p-4">
          <p className="font-semibold text-ink">Check before recording</p>
          <p className="text-sm text-slate-700">
            Record a handover of <strong>{formatRand(n)}</strong>
            {note.trim() ? ` (note: ${note.trim()})` : ""}? A recorded handover cannot be deleted from this app.
          </p>
          {moreThanRemaining ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              This is more than the {formatRand(remaining)} of recorded cash still to be handed over. It will be
              recorded and shown as needing review.
            </p>
          ) : null}
          {formError ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {formError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={submit} disabled={submitting} className={primaryButton}>
              {submitting ? "Recording..." : "Confirm and record handover"}
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
        </div>
      ) : (
        <form onSubmit={onReview} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField
            label="Amount handed over (R)"
            htmlFor="ho-amount"
            error={fieldErrors.amount}
            hint={remaining > 0 ? `Recorded cash still to be handed over: ${formatRand(remaining)}` : undefined}
          >
            <input
              id="ho-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                freshKey();
              }}
              aria-invalid={Boolean(fieldErrors.amount)}
              aria-describedby={fieldErrors.amount ? "ho-amount-error" : "ho-amount-hint"}
              className={inputClass}
            />
            {remaining > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setAmount(remaining.toFixed(2));
                  freshKey();
                }}
                className="mt-1 text-sm font-semibold text-ink underline decoration-gold decoration-2 underline-offset-4"
              >
                Fill in the remaining {formatRand(remaining)}
              </button>
            ) : null}
          </FormField>

          <FormField
            label="Note (optional)"
            htmlFor="ho-note"
            error={fieldErrors.note}
            hint="Keep it neutral. Please do not enter personal details."
          >
            <input
              id="ho-note"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={Boolean(fieldErrors.note)}
              aria-describedby={fieldErrors.note ? "ho-note-error" : "ho-note-hint"}
              className={inputClass}
            />
          </FormField>

          <div className="space-y-3 sm:col-span-2">
            {formError ? (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {formError}
              </p>
            ) : null}
            {saved ? (
              <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                {saved.duplicate ? "That handover was already recorded. " : "Handover recorded. "}
                {saved.r.message}
              </p>
            ) : null}
            <button type="submit" className={primaryButton}>
              Review handover
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function ClosePanel({
  eventId,
  reference,
  r,
  onClosed,
}: {
  eventId: string;
  reference: string;
  r: Reconciliation;
  onClosed: (result: CloseResult) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const nothingToReconcile = r.status === "AWAITING_HANDOVER" && Number(r.cashRecorded) === 0;
  const canClose = r.status === "MATCHED" || nothingToReconcile;

  async function close() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await api<CloseResult>(`/funeral-events/${eventId}/close`, { method: "POST" });
      onClosed(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not close the event. Please try again.");
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="close-heading" className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 id="close-heading" className="text-lg font-semibold text-ink">
        Close this event
      </h2>

      {!canClose ? (
        <p className="mt-2 text-sm text-slate-700">
          {reference} cannot be closed yet. {r.message}
        </p>
      ) : confirming ? (
        <div className="mt-3 space-y-3 rounded-lg border-2 border-gold p-4">
          <p className="text-sm text-slate-800">
            Close {reference}? No further payments or handovers can be recorded for it afterwards, including from
            households that have not paid yet. This cannot be undone from this app.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={close} disabled={submitting} className={primaryButton}>
              {submitting ? "Closing..." : "Yes, close the event"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={submitting} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <p className="text-sm text-slate-700">
            {nothingToReconcile
              ? "No cash was recorded for this event, so there is nothing to reconcile."
              : "The cash handed over matches the cash recorded."}{" "}
            You can close the event once you are satisfied the records are complete.
          </p>
          <button type="button" onClick={() => setConfirming(true)} className={primaryButton}>
            Close event
          </button>
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
    </section>
  );
}
