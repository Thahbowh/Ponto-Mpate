import { useState } from "react";
import type { FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/AuthContext";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { formatDateTime, formatRand } from "@/lib/formatters";
import type { VoucherSummary } from "@/types/voucher";
import { FormField, inputClass } from "@/components/ui/FormField";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const Route = createFileRoute("/_app/vouchers")({
  component: VouchersPage,
  head: () => ({ meta: [{ title: "Shop vouchers - Ponto Mpate" }] }),
});

function VouchersPage() {
  const { isAdmin } = useAuth();
  const { data, loading, error, refetch } = useApi<VoucherSummary>("/vouchers");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Shop vouchers</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Cash payments made at participating shops. A payment is confirmed when the provider verifies it, and
            settled only when the money reaches the scheme. These are different things, so they are shown separately.
            Fees here are simulated.
          </p>
        </div>
        <button
          type="button"
          onClick={refetch}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-gold"
        >
          Refresh
        </button>
      </header>

      {loading && !data ? <LoadingState label="Loading voucher payments..." /> : null}
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      {data ? (
        <>
          <section aria-label="Voucher totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Confirmed (gross)" value={formatRand(data.totals.gross)} hint={`${data.counts.confirmed} payments`} />
            <StatCard label="Provider fees" value={formatRand(data.totals.fees)} hint="Simulated" />
            <StatCard label="Net to the scheme" value={formatRand(data.totals.net)} />
            <StatCard label="Awaiting settlement" value={formatRand(data.totals.awaiting)} />
            <StatCard label="Reported as settled" value={formatRand(data.totals.settled)} />
          </section>

          {data.counts.awaitingOver24h > 0 ? (
            <p role="status" className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
              {data.counts.awaitingOver24h} payment{data.counts.awaitingOver24h === 1 ? " has" : "s have"} waited more
              than 24 hours for settlement. The target is 24 hours, subject to the provider&apos;s agreement.
            </p>
          ) : null}
          {data.counts.rejected > 0 ? (
            <p role="status" className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
              {data.counts.rejected} voucher payment{data.counts.rejected === 1 ? " was" : "s were"} confirmed by the
              provider but could not be applied. Check them below and follow them up with the provider.
            </p>
          ) : null}
          <p className="text-sm text-slate-600">
            Settled within 24 hours: {data.counts.settledWithin24h} of {data.counts.settledCount}.
          </p>

          {isAdmin ? <SettlementForm onDone={refetch} /> : null}

          <section aria-labelledby="tx-heading" className="space-y-3">
            <h2 id="tx-heading" className="text-lg font-semibold text-ink">
              Transactions
            </h2>
            {data.transactions.length === 0 ? (
              <EmptyState title="No voucher payments yet" hint="Payments appear here after a member completes the USSD steps." />
            ) : (
              <ul className="space-y-3">
                {data.transactions.map((t) => (
                  <li key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-ink">
                          {t.event} - {t.household}
                        </p>
                        <p className="font-mono text-xs text-slate-500">{t.providerReference}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={t.status === "REJECTED" ? "NEEDS_REVIEW" : t.status} />
                        {t.status === "CONFIRMED" ? <StatusBadge status={t.settlementStatus} /> : null}
                      </div>
                    </div>
                    <p className="mt-2 text-slate-700">
                      Gross {formatRand(t.grossAmount)} - fee {formatRand(t.providerFee)} - net {formatRand(t.netAmount)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(t.createdAt)}
                      {t.receiptNumber ? ` - receipt ${t.receiptNumber}` : ""}
                      {t.settlementBatch ? ` - batch ${t.settlementBatch}` : ""}
                    </p>
                    {t.note ? <p className="mt-1 text-xs text-orange-900">{t.note}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function SettlementForm({ onDone }: { onDone: () => void }) {
  const [batch, setBatch] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFieldErrors({});
    setFormError("");
    setSuccess("");

    const errs: Record<string, string> = {};
    if (batch.trim().length < 3) errs.batchReference = "Enter the provider's batch reference.";
    const n = Number(amount.trim().replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) errs.reportedAmount = "Enter the total from the settlement report.";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const result = await api<{ batchReference: string; transactions: number; amount: string }>(
        "/vouchers/settlements",
        { method: "POST", body: { batchReference: batch.trim(), reportedAmount: n } }
      );
      setSuccess(`Batch ${result.batchReference} recorded: ${result.transactions} payment(s), ${formatRand(result.amount)} settled.`);
      setBatch("");
      setAmount("");
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = err.fieldErrors();
        setFieldErrors(fe);
        setFormError(Object.keys(fe).length > 0 ? "Please correct the highlighted fields." : err.message);
      } else {
        setFormError("Could not record the settlement. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="settle-heading" className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 id="settle-heading" className="text-lg font-semibold text-ink">
        Record a settlement report
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Enter the batch reference and the total from the provider&apos;s settlement report. Payments are only marked
        settled when the total matches what is awaiting settlement.
      </p>
      <form onSubmit={onSubmit} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Batch reference" htmlFor="st-batch" error={fieldErrors.batchReference}>
          <input
            id="st-batch"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            aria-invalid={Boolean(fieldErrors.batchReference)}
            aria-describedby={fieldErrors.batchReference ? "st-batch-error" : undefined}
            placeholder="e.g. SETTLE-2026-001"
            className={inputClass}
          />
        </FormField>
        <FormField label="Reported total (R)" htmlFor="st-amount" error={fieldErrors.reportedAmount}>
          <input
            id="st-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={Boolean(fieldErrors.reportedAmount)}
            aria-describedby={fieldErrors.reportedAmount ? "st-amount-error" : undefined}
            className={inputClass}
          />
        </FormField>
        <div className="space-y-3 sm:col-span-2">
          {formError ? (
            <p role="alert" className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
              {formError}
            </p>
          ) : null}
          {success ? (
            <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
              {success}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90 disabled:opacity-60"
          >
            {submitting ? "Recording..." : "Record settlement"}
          </button>
        </div>
      </form>
    </section>
  );
}
