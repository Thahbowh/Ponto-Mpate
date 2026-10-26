import { createFileRoute, Link } from "@tanstack/react-router";
import { useApi } from "@/lib/useApi";
import { formatDate, formatDateTime, formatRand } from "@/lib/formatters";
import type { Dashboard, Insight, Insights } from "@/types/api";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const Route = createFileRoute("/_app/insights")({
  component: InsightsPage,
  head: () => ({ meta: [{ title: "Insights - Ponto Mpate" }] }),
});

interface ActionTarget {
  to: "/reconciliation" | "/events";
  label: string;
}

const ACTIONS: Record<string, ActionTarget> = {
  CASH_MISMATCH: { to: "/reconciliation", label: "Open reconciliation" },
  AWAITING_HANDOVER: { to: "/reconciliation", label: "Record the handover" },
  LOW_COLLECTION: { to: "/events", label: "View events" },
  WARD_NO_PAYMENTS: { to: "/events", label: "View events" },
  POSSIBLE_DUPLICATE_PAYMENT: { to: "/events", label: "View events" },
};

const TYPE_LABELS: Record<string, string> = {
  CASH_MISMATCH: "Cash needs review",
  AWAITING_HANDOVER: "Awaiting handover",
  LOW_COLLECTION: "Low collection",
  WARD_NO_PAYMENTS: "Ward with no payments",
  POSSIBLE_DUPLICATE_PAYMENT: "Possible duplicate",
};

const secondaryButton =
  "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-gold";

function RateBar({ percent, label }: { percent: number; label: string }) {
  const p = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
      role="progressbar"
      aria-valuenow={Math.round(p)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-full rounded-full bg-gold" style={{ width: `${p}%` }} />
    </div>
  );
}

function InsightCard({ insight, tone }: { insight: Insight; tone: "attention" | "info" }) {
  const action = ACTIONS[insight.type];
  const box =
    tone === "attention" ? "border-orange-200 bg-orange-50 text-orange-950" : "border-slate-200 bg-white text-slate-900";
  return (
    <li className={`rounded-xl border p-4 ${box}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">
        {TYPE_LABELS[insight.type] ?? insight.type}
      </p>
      <p className="mt-1 font-semibold">{insight.title}</p>
      <p className="mt-1 text-sm">{insight.detail}</p>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer font-medium">How this was calculated</summary>
        <p className="mt-1">{insight.basis}</p>
      </details>
      {action ? (
        <Link
          to={action.to}
          className="mt-3 inline-block text-sm font-semibold underline decoration-gold decoration-2 underline-offset-4"
        >
          {action.label}
        </Link>
      ) : null}
    </li>
  );
}

function InsightsPage() {
  const insights = useApi<Insights>("/insights");
  const dash = useApi<Dashboard>("/dashboard");

  const attention = insights.data?.insights.filter((i) => i.severity === "attention") ?? [];
  const info = insights.data?.insights.filter((i) => i.severity === "info") ?? [];

  function refreshAll() {
    insights.refetch();
    dash.refetch();
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Reports and insights</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Plain, explainable checks on the saved records. These are prompts to look at the records, not
            conclusions about anyone. Each one shows how it was calculated.
          </p>
        </div>
        <button type="button" onClick={refreshAll} className={secondaryButton}>
          Refresh
        </button>
      </header>

      {insights.loading && !insights.data ? <LoadingState label="Checking the records..." /> : null}
      {insights.error ? <ErrorState message={insights.error} onRetry={insights.refetch} /> : null}

      {insights.data ? (
        <>
          <p className="text-sm text-slate-600" aria-live="polite">
            {insights.data.summary.attention} need{insights.data.summary.attention === 1 ? "s" : ""} attention,{" "}
            {insights.data.summary.info} for information. Checked {formatDateTime(insights.data.generatedAt)}.
          </p>

          <section aria-labelledby="attention-heading" className="space-y-3">
            <h2 id="attention-heading" className="text-lg font-semibold text-ink">
              Needs attention
            </h2>
            {attention.length === 0 ? (
              <EmptyState title="Nothing needs attention right now" hint="The records are consistent at the moment." />
            ) : (
              <ul className="space-y-3">
                {attention.map((i, idx) => (
                  <InsightCard key={`${i.type}-${idx}`} insight={i} tone="attention" />
                ))}
              </ul>
            )}
          </section>

          {info.length > 0 ? (
            <section aria-labelledby="info-heading" className="space-y-3">
              <h2 id="info-heading" className="text-lg font-semibold text-ink">
                For information
              </h2>
              <ul className="space-y-3">
                {info.map((i, idx) => (
                  <InsightCard key={`${i.type}-${idx}`} insight={i} tone="info" />
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="trend-heading" className="space-y-3">
            <h2 id="trend-heading" className="text-lg font-semibold text-ink">
              Collection by event
            </h2>
            {insights.data.trend.length === 0 ? (
              <EmptyState title="No events yet" hint="Trends appear once funeral events exist." />
            ) : (
              <>
                <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                  {insights.data.trend.map((t) => (
                    <li key={t.reference} className="space-y-2 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <p className="font-semibold text-ink">
                          {t.reference}{" "}
                          <span className="font-normal text-slate-500">- {formatDate(t.eventDate)}</span>
                        </p>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={t.status} />
                          <span className="font-semibold text-ink">{t.collectionRate.toFixed(1)}%</span>
                        </div>
                      </div>
                      <RateBar percent={t.collectionRate} label={`${t.reference} collection rate`} />
                    </li>
                  ))}
                </ul>
                {insights.data.trend.length < 3 ? (
                  <p className="text-sm text-slate-600">
                    Trends become more useful as more events are recorded.
                  </p>
                ) : null}
              </>
            )}
          </section>

          <section aria-labelledby="forecast-heading" className="space-y-3">
            <h2 id="forecast-heading" className="text-lg font-semibold text-ink">
              Forecast
            </h2>
            {insights.data.forecast.available ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-2xl font-bold text-ink">
                  {insights.data.forecast.expectedCollectionRate.toFixed(1)}%
                </p>
                <p className="mt-1 text-sm text-slate-700">Typical collection rate for an event</p>
                <p className="mt-2 text-xs text-slate-500">Method: {insights.data.forecast.method}</p>
                <p className="mt-1 text-xs text-slate-500">{insights.data.forecast.caveat}</p>
              </div>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                No forecast is shown yet. {insights.data.forecast.reason} Ponto Mpate will not present a guess as a
                prediction.
              </p>
            )}
          </section>
        </>
      ) : null}

      <section aria-labelledby="ward-heading" className="space-y-3">
        <h2 id="ward-heading" className="text-lg font-semibold text-ink">
          Collection by ward
        </h2>
        {dash.loading && !dash.data ? <LoadingState label="Loading wards..." /> : null}
        {dash.error ? <ErrorState message={dash.error} onRetry={dash.refetch} /> : null}
        {dash.data ? (
          dash.data.wards.length === 0 ? (
            <EmptyState title="No ward figures yet" />
          ) : (
            <>
              <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                {dash.data.wards.map((w) => (
                  <li key={w.id} className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <p className="font-semibold text-ink">{w.name}</p>
                      <p className="text-slate-700">
                        {formatRand(w.recorded)} of {formatRand(w.expected)} ({w.collectionRate}%)
                      </p>
                    </div>
                    <RateBar percent={Number(w.collectionRate)} label={`${w.name} collection rate`} />
                    <p className="text-xs text-slate-500">
                      {w.householdsPaid} of {w.households} contributions paid in full
                    </p>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500">
                Across all events that are not cancelled. These are contributions, so a household that appears
                in several events is counted once for each event.
              </p>
            </>
          )
        ) : null}
      </section>
    </div>
  );
}
