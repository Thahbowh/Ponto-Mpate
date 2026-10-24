import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useApi } from "@/lib/useApi";
import { formatDate, formatRand } from "@/lib/formatters";
import type { EventObligations } from "@/types/api";
import { FormField, inputClass } from "@/components/ui/FormField";
import { StatCard } from "@/components/ui/StatCard";
import { RecordPaymentLink } from "@/features/payments/RecordPaymentLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const Route = createFileRoute("/_app/events/$eventId")({
  component: EventDetailPage,
  head: () => ({ meta: [{ title: "Event — Ponto Mpate" }] }),
});

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const { data, loading, error, refetch } = useApi<EventObligations>(
    `/funeral-events/${eventId}/obligations`
  );
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  const q = search.trim().toLowerCase();
  const rows = (data?.obligations ?? []).filter((o) => {
    const matchesText =
      !q ||
      o.household.householdName.toLowerCase().includes(q) ||
      o.household.reference.toLowerCase().includes(q);
    const matchesStatus = status === "ALL" || o.status === status;
    return matchesText && matchesStatus;
  });

  const barPercent =
    data && Number(data.summary.expected) > 0
      ? Math.min(100, (Number(data.summary.recorded) / Number(data.summary.expected)) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <Link to="/events" className="text-sm font-semibold text-ink underline decoration-gold underline-offset-4">
        ← All events
      </Link>

      {loading ? <LoadingState label="Loading event…" /> : null}
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      {data ? (
        <>
          <header className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-semibold text-ink">{data.event.title}</h1>
              <StatusBadge status={data.event.status} />
            </div>
            <p className="text-sm text-slate-600">
              {data.event.reference} · {formatDate(data.event.eventDate)} · Home ward:{" "}
              {data.event.homeWard.name} · {formatRand(data.event.contributionAmount)} per household
            </p>
            <p className="text-sm text-slate-600">
              Participating wards: {data.event.eligibleWards.map((w) => w.name).join(", ")}
            </p>
            {data.event.status !== "ACTIVE" ? (
              <p role="status" className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700">
                This event is {data.event.status === "CLOSED" ? "closed" : "cancelled"}. No further payments
                can be recorded.
              </p>
            ) : null}
          </header>

          <section aria-label="Event totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Expected" value={formatRand(data.summary.expected)} />
            <StatCard label="Recorded" value={formatRand(data.summary.recorded)} />
            <StatCard label="Outstanding" value={formatRand(data.summary.outstanding)} />
            <StatCard
              label="Households paid"
              value={`${data.summary.householdsPaid} / ${data.summary.households}`}
              hint={`${data.summary.householdsUnpaid} not fully paid`}
            />
          </section>

          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuenow={Math.round(barPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Collection progress"
          >
            <div className="h-full rounded-full bg-gold" style={{ width: `${barPercent}%` }} />
          </div>

          <section aria-labelledby="hh-heading" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="hh-heading" className="text-lg font-semibold text-ink">
                Participating households
              </h2>
              <button
                type="button"
                onClick={refetch}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-gold"
              >
                Refresh
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Search" htmlFor="ob-search" hint="Household name or reference">
                <input
                  id="ob-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Payment status" htmlFor="ob-status">
                <select
                  id="ob-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={inputClass}
                >
                  <option value="ALL">All</option>
                  <option value="UNPAID">Outstanding</option>
                  <option value="PARTIALLY_PAID">Part paid</option>
                  <option value="PAID">Paid</option>
                </select>
              </FormField>
            </div>

            {rows.length === 0 ? (
              <EmptyState
                title={data.obligations.length === 0 ? "No households on this event" : "No households match these filters"}
              />
            ) : (
              <>
                <p className="text-sm text-slate-600" aria-live="polite">
                  Showing {rows.length} of {data.obligations.length} households.
                </p>

                <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th scope="col" className="px-4 py-3">Reference</th>
                        <th scope="col" className="px-4 py-3">Household</th>
                        <th scope="col" className="px-4 py-3">Ward</th>
                        <th scope="col" className="px-4 py-3 text-right">Due</th>
                        <th scope="col" className="px-4 py-3 text-right">Paid</th>
                        <th scope="col" className="px-4 py-3">Status</th>
                        <th scope="col" className="px-4 py-3"><span className="sr-only">Action</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((o) => (
                        <tr key={o.id}>
                          <td className="px-4 py-3 font-mono text-xs text-slate-700">{o.household.reference}</td>
                          <td className="px-4 py-3 font-medium text-ink">{o.household.householdName}</td>
                          <td className="px-4 py-3 text-slate-700">{o.household.ward.name}</td>
                          <td className="px-4 py-3 text-right">{formatRand(o.amountDue)}</td>
                          <td className="px-4 py-3 text-right">{formatRand(o.amountPaid)}</td>
                          <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                          <td className="px-4 py-3"><RecordPaymentLink eventId={data.event.id} householdId={o.household.id} status={o.status} eventStatus={data.event.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="space-y-3 md:hidden">
                  {rows.map((o) => (
                    <li key={o.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-ink">{o.household.householdName}</p>
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="mt-1 font-mono text-xs text-slate-600">
                        {o.household.reference} · {o.household.ward.name}
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        Paid {formatRand(o.amountPaid)} of {formatRand(o.amountDue)}
                      </p>
                      <div className="mt-2"><RecordPaymentLink eventId={data.event.id} householdId={o.household.id} status={o.status} eventStatus={data.event.status} /></div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}


