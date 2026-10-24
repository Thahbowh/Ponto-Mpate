import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/AuthContext";
import { useApi } from "@/lib/useApi";
import { formatDate, formatDateTime, formatRand, methodLabel } from "@/lib/formatters";
import type { Dashboard, Insights } from "@/types/api";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard — Ponto Mpate" }] }),
});

const SHORTCUTS = [
  { to: "/events", label: "Create event" },
  { to: "/households", label: "Register household" },
  { to: "/record", label: "Record contribution" },
] as const;

function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const dash = useApi<Dashboard>("/dashboard");
  const insights = useApi<Insights>("/insights");

  const attention = insights.data?.insights.filter((i) => i.severity === "attention") ?? [];
  const infoCount = insights.data?.summary.info ?? 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-semibold text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Welcome, {user?.name}. Every figure is calculated by the server from saved records.
        </p>
      </header>

      {isAdmin ? (
        <div className="flex flex-wrap gap-3">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90"
            >
              {s.label}
            </Link>
          ))}
        </div>
      ) : null}

      {dash.loading ? <LoadingState label="Loading dashboard…" /> : null}
      {dash.error ? <ErrorState message={dash.error} onRetry={dash.refetch} /> : null}

      {dash.data ? (
        <>
          <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Expected"
              value={formatRand(dash.data.totals.expected)}
              hint={`${dash.data.totals.households} contributions due`}
            />
            <StatCard
              label="Recorded"
              value={formatRand(dash.data.totals.recorded)}
              hint={`${dash.data.totals.collectionRate}% of expected`}
            />
            <StatCard
              label="Outstanding"
              value={formatRand(dash.data.totals.outstanding)}
              hint={`${dash.data.totals.households - dash.data.totals.householdsPaid} contributions not fully paid`}
            />
            <StatCard
              label="Contributions paid"
              value={`${dash.data.totals.householdsPaid} / ${dash.data.totals.households}`}
              hint={`${dash.data.totals.householdsPartiallyPaid} part paid`}
            />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-ink">Funeral events</h2>
            {dash.data.events.length === 0 ? (
              <EmptyState
                title="No funeral events yet"
                hint="Create an event to generate the contributions households owe."
                action={
                  isAdmin ? (
                    <Link
                      to="/events"
                      className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream"
                    >
                      Create event
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <ul className="space-y-3">
                {dash.data.events.map((e) => {
                  const rate = Math.min(100, Number(e.collectionRate));
                  return (
                    <li key={e.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-ink">{e.title}</p>
                          <p className="text-xs text-slate-500">
                            {e.reference} · {e.homeWard} · {formatDate(e.eventDate)}
                          </p>
                        </div>
                        <StatusBadge status={e.status} />
                      </div>
                      <div
                        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200"
                        role="progressbar"
                        aria-valuenow={rate}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${e.reference} collection progress`}
                      >
                        <div className="h-full rounded-full bg-gold" style={{ width: `${rate}%` }} />
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {formatRand(e.recorded)} of {formatRand(e.expected)} recorded (
                        {e.collectionRate}%) · {e.householdsPaid}/{e.households} paid
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-ink">Recent payments</h2>
            {dash.data.recentPayments.length === 0 ? (
              <EmptyState title="No payments recorded yet" />
            ) : (
              <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                {dash.data.recentPayments.map((p, i) => (
                  <li
                    key={`${p.receiptNumber}-${i}`}
                    className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-ink">{p.household.householdName}</p>
                      <p className="text-xs text-slate-500">
                        {p.household.reference} · {p.event} · {p.receiptNumber ?? "No receipt"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-ink">{formatRand(p.amount)}</p>
                      <p className="text-xs text-slate-500">
                        {methodLabel(p.method)} · {formatDateTime(p.paidAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Needs attention</h2>
        {insights.loading ? <LoadingState label="Checking records…" /> : null}
        {insights.error ? <ErrorState message={insights.error} onRetry={insights.refetch} /> : null}
        {insights.data ? (
          attention.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              Nothing needs attention right now.
              {infoCount > 0 ? ` ${infoCount} lower-priority note(s) are on the Insights page.` : ""}
            </p>
          ) : (
            <ul className="space-y-3">
              {attention.map((i, idx) => (
                <li key={`${i.type}-${idx}`} className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <p className="font-semibold text-orange-900">{i.title}</p>
                  <p className="mt-1 text-sm text-orange-900">{i.detail}</p>
                  <details className="mt-2 text-xs text-orange-900">
                    <summary className="cursor-pointer">How this was calculated</summary>
                    <p className="mt-1">{i.basis}</p>
                  </details>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>
    </div>
  );
}
