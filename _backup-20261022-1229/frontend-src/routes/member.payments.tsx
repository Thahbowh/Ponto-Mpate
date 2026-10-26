import { createFileRoute, Link } from "@tanstack/react-router";
import { useApi } from "@/lib/useApi";
import { formatDateTime, formatRand, methodLabel } from "@/lib/formatters";
import type { MemberPayments } from "@/types/member";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const Route = createFileRoute("/member/payments")({
  component: PaymentsPage,
  head: () => ({ meta: [{ title: "Payments - Ponto Mpate" }] }),
});

function PaymentsPage() {
  const { data, loading, error, refetch } = useApi<MemberPayments>("/member/payments");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-ink">Payment history</h1>
        <p className="mt-1 text-sm text-slate-600">Payments recorded for your household, and your online payment attempts.</p>
      </header>

      {loading && !data ? <LoadingState label="Loading payments..." /> : null}
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      {data && !data.approved ? (
        <EmptyState title="Your household membership is not approved yet" />
      ) : null}

      {data && data.approved ? (
        <>
          <section aria-labelledby="paid-heading" className="space-y-3">
            <h2 id="paid-heading" className="text-lg font-semibold text-ink">
              Recorded payments
            </h2>
            {data.payments.length === 0 ? (
              <EmptyState title="No payments recorded yet" />
            ) : (
              <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                {data.payments.map((p, idx) => (
                  <li key={`${p.receiptNumber}-${idx}`} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                    <div>
                      <p className="font-semibold text-ink">{formatRand(p.amount)}</p>
                      <p className="text-xs text-slate-500">
                        {p.event.reference} - {methodLabel(p.method)} - {formatDateTime(p.paidAt)}
                      </p>
                    </div>
                    {p.receiptNumber ? (
                      <Link
                        to="/member/receipts/$receiptNumber"
                        params={{ receiptNumber: p.receiptNumber }}
                        className="font-semibold underline decoration-gold decoration-2 underline-offset-4"
                      >
                        Receipt {p.receiptNumber}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.attempts.length > 0 ? (
            <section aria-labelledby="attempts-heading" className="space-y-3">
              <h2 id="attempts-heading" className="text-lg font-semibold text-ink">
                Online payment attempts
              </h2>
              <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                {data.attempts.map((a) => (
                  <li key={a.reference} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                    <div>
                      <p className="font-semibold text-ink">{formatRand(a.amount)}</p>
                      <p className="text-xs text-slate-500">
                        {a.event.reference} - {formatDateTime(a.createdAt)} - {a.reference}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={a.status} />
                      {a.status === "PENDING" ? (
                        <Link
                          to="/member/pay/$reference"
                          params={{ reference: a.reference }}
                          className="font-semibold underline"
                        >
                          Continue
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
