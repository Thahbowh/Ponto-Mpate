import { createFileRoute, Link } from "@tanstack/react-router";
import { useApi } from "@/lib/useApi";
import { formatDate, formatDateTime, formatRand, methodLabel } from "@/lib/formatters";
import type { Receipt } from "@/types/api";
import { ErrorState, LoadingState } from "@/components/ui/States";

export const Route = createFileRoute("/_app/receipts/$receiptNumber")({
  component: ReceiptPage,
  head: () => ({ meta: [{ title: "Receipt - Ponto Mpate" }] }),
});

function ReceiptPage() {
  const { receiptNumber } = Route.useParams();
  const { data, loading, error, refetch } = useApi<Receipt>(
    `/receipts/${encodeURIComponent(receiptNumber)}`
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 print:hidden">
        <Link
          to="/record"
          className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-gold"
        >
          &larr; Record contribution
        </Link>
        {data ? (
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90"
          >
            Print receipt
          </button>
        ) : null}
      </div>

      {loading ? <LoadingState label="Loading receipt..." /> : null}
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      {data ? (
        <article
          aria-label={`Receipt ${data.receiptNumber}`}
          className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none"
        >
          <header className="border-b border-slate-200 pb-4 text-center">
            <p className="font-display text-3xl font-semibold text-ink">Ponto Mpate</p>
            <p className="mt-1 text-sm text-slate-600">Contribution receipt</p>
            <p className="mt-3 text-xl font-bold text-ink">{data.receiptNumber}</p>
          </header>

          <dl className="mt-6 space-y-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Amount received</dt>
              <dd className="text-3xl font-bold text-ink">{formatRand(data.amount)}</dd>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Payment method</dt>
                <dd className="font-medium text-slate-900">{methodLabel(data.method)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Date and time</dt>
                <dd className="font-medium text-slate-900">{formatDateTime(data.paidAt)}</dd>
              </div>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Household</dt>
              <dd className="font-medium text-slate-900">
                {data.household.householdName} ({data.household.reference})
              </dd>
              <dd className="text-slate-600">{data.household.ward.name}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Funeral event</dt>
              <dd className="font-medium text-slate-900">
                {data.event.reference} - {data.event.title}
              </dd>
              <dd className="text-slate-600">{formatDate(data.event.eventDate)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Recorded by</dt>
              <dd className="font-medium text-slate-900">{data.recordedBy}</dd>
            </div>
          </dl>

          <footer className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500">
            This receipt reflects the saved record. Printing it does not create a new payment.
          </footer>
        </article>
      ) : null}
    </div>
  );
}
