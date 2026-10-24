import { createFileRoute, Link } from "@tanstack/react-router";
import { useApi } from "@/lib/useApi";
import { formatDate, formatRand } from "@/lib/formatters";
import type { MemberContributions } from "@/types/member";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { PayButton } from "@/features/member/PayButton";
import { ShopReference } from "@/features/member/ShopReference";

export const Route = createFileRoute("/member/contributions")({
  component: ContributionsPage,
  head: () => ({ meta: [{ title: "Contributions - Ponto Mpate" }] }),
});

function ContributionsPage() {
  const { data, loading, error, refetch } = useApi<MemberContributions>("/member/contributions");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-ink">My contributions</h1>
        <p className="mt-1 text-sm text-slate-600">What your household owes for each funeral event, and what is paid.</p>
      </header>

      {loading && !data ? <LoadingState label="Loading contributions..." /> : null}
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      {data && !data.approved ? (
        <EmptyState
          title="Your household membership is not approved yet"
          hint="Once an administrator approves your request, your contributions appear here."
          action={
            <Link to="/member" className="text-sm font-semibold underline">
              Go to Home
            </Link>
          }
        />
      ) : null}

      {data && data.approved && data.summary ? (
        <>
          <section aria-label="Totals" className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total due" value={formatRand(data.summary.due)} />
            <StatCard label="Paid" value={formatRand(data.summary.paid)} />
            <StatCard label="Outstanding" value={formatRand(data.summary.outstanding)} />
          </section>

          {data.items.length === 0 ? (
            <EmptyState title="No contributions yet" hint="Contributions appear when a funeral event includes your household." />
          ) : (
            <ul className="space-y-3">
              {data.items.map((i) => (
                <li key={i.obligationId} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{i.event.title}</p>
                      <p className="text-xs text-slate-500">
                        {i.event.reference} - {formatDate(i.event.eventDate)}
                      </p>
                    </div>
                    <StatusBadge status={i.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    Due {formatRand(i.amountDue)} - paid {formatRand(i.amountPaid)} - outstanding{" "}
                    <strong>{formatRand(i.outstanding)}</strong>
                  </p>
                  {i.event.status !== "ACTIVE" && Number(i.outstanding) > 0 ? (
                    <p className="mt-2 text-sm text-slate-600">
                      This event is closed, so it can no longer be paid online. Please speak to your ward administrator.
                    </p>
                  ) : null}
                  {i.canPay ? (
                    <>
                      <div className="mt-3">
                        {i.pendingCheckout ? (
                          <Link
                            to="/member/pay/$reference"
                            params={{ reference: i.pendingCheckout }}
                            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90"
                          >
                            Continue payment
                          </Link>
                        ) : (
                          <PayButton obligationId={i.obligationId} />
                        )}
                      </div>
                      <ShopReference obligationId={i.obligationId} existing={i.payReference} amount={i.outstanding} />
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
