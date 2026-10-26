import { useState } from "react";
import type { FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/AuthContext";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { formatRand, formatDate } from "@/lib/formatters";
import type { MemberContributions, MemberMe, MemberWard } from "@/types/member";
import { FormField, inputClass } from "@/components/ui/FormField";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { PayButton } from "@/features/member/PayButton";
import { ShopReference } from "@/features/member/ShopReference";
import { MessagesPanel } from "@/features/member/MessagesPanel";

export const Route = createFileRoute("/member/")({
  component: MemberHome,
  head: () => ({ meta: [{ title: "Home - Ponto Mpate" }] }),
});

const primaryButton =
  "rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90 disabled:opacity-60";

function MemberHome() {
  const { user } = useAuth();
  const me = useApi<MemberMe>("/member/me");
  const status = me.data?.membership?.status ?? null;
  const approved = status === "APPROVED";
  const contributions = useApi<MemberContributions>(approved ? "/member/contributions" : null);

  const dueNow = (contributions.data?.items ?? []).filter((i) => i.canPay).slice(0, 3);
  const summary = contributions.data?.summary ?? null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-ink">Welcome, {user?.name}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Keep track of your household&apos;s contributions to the community.
        </p>
      </header>

      <MessagesPanel />

      {me.loading && !me.data ? <LoadingState label="Loading your account..." /> : null}
      {me.error ? <ErrorState message={me.error} onRetry={me.refetch} /> : null}

      {me.data && (status === null || status === "REJECTED") ? (
        <JoinHouseholdForm declined={status === "REJECTED"} onJoined={me.refetch} />
      ) : null}

      {me.data && status === "PENDING" && me.data.membership ? (
        <section role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">Waiting for approval</h2>
            <StatusBadge status="PENDING" />
          </div>
          <p className="mt-2 text-sm">
            Your request to join household {me.data.membership.household.reference} in{" "}
            {me.data.membership.household.ward.name} has been sent. A ward administrator will check it. Once it is
            approved you will see your contributions here.
          </p>
          <button type="button" onClick={me.refetch} className="mt-3 text-sm font-semibold underline">
            Check again
          </button>
        </section>
      ) : null}

      {approved && me.data?.membership ? (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Your household</p>
            <p className="text-lg font-semibold text-ink">{me.data.membership.household.householdName}</p>
            <p className="text-sm text-slate-600">
              {me.data.membership.household.reference} - {me.data.membership.household.ward.name}
            </p>
          </section>

          {contributions.loading && !contributions.data ? <LoadingState label="Loading contributions..." /> : null}
          {contributions.error ? (
            <ErrorState message={contributions.error} onRetry={contributions.refetch} />
          ) : null}

          {summary ? (
            <>
              <section aria-label="Contribution summary" className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Amount due now" value={formatRand(summary.outstanding)} />
                <StatCard label="Paid so far" value={formatRand(summary.paid)} />
                <StatCard
                  label="Contributions open"
                  value={summary.contributionsOutstanding}
                  hint="Funeral events still to pay"
                />
              </section>

              {dueNow.length === 0 ? (
                <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                  You are up to date. There is nothing to pay right now.
                </p>
              ) : (
                <section aria-labelledby="due-heading" className="space-y-3">
                  <h2 id="due-heading" className="text-lg font-semibold text-ink">
                    Ready to pay
                  </h2>
                  <ul className="space-y-3">
                    {dueNow.map((i) => (
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
                          Outstanding <strong>{formatRand(i.outstanding)}</strong>
                        </p>
                        <div className="mt-3">
                          {i.pendingCheckout ? (
                            <Link
                              to="/member/pay/$reference"
                              params={{ reference: i.pendingCheckout }}
                              className={primaryButton}
                            >
                              Continue payment
                            </Link>
                          ) : (
                            <PayButton obligationId={i.obligationId} />
                          )}
                        </div>
                        <ShopReference obligationId={i.obligationId} existing={i.payReference} amount={i.outstanding} />
                      </li>
                    ))}
                  </ul>
                  <Link to="/member/contributions" className="text-sm font-semibold underline">
                    See all contributions
                  </Link>
                </section>
              )}
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function JoinHouseholdForm({ declined, onJoined }: { declined: boolean; onJoined: () => void }) {
  const wards = useApi<MemberWard[]>("/member/wards");
  const [wardId, setWardId] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFieldErrors({});
    setFormError("");

    const errs: Record<string, string> = {};
    if (!wardId) errs.wardId = "Choose your ward.";
    if (reference.trim().length < 3) errs.householdReference = "Enter your household reference.";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      await api("/member/household/join", {
        method: "POST",
        body: { wardId, householdReference: reference.trim() },
      });
      onJoined();
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = err.fieldErrors();
        setFieldErrors(fe);
        setFormError(Object.keys(fe).length > 0 ? "Please correct the highlighted fields." : err.message);
      } else {
        setFormError("Could not send your request. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="join-heading" className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 id="join-heading" className="text-lg font-semibold text-ink">
        Join your household
      </h2>
      {declined ? (
        <p role="status" className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          Your last request was not approved. Please check the reference with your ward administrator and try again.
        </p>
      ) : null}
      <p className="mt-2 text-sm text-slate-600">
        Choose your ward and enter the household reference your ward administrator gave you. An administrator checks
        every request before it is approved.
      </p>

      {wards.loading ? <LoadingState label="Loading wards..." /> : null}
      {wards.error ? <ErrorState message={wards.error} onRetry={wards.refetch} /> : null}

      {wards.data ? (
        <form onSubmit={onSubmit} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
          <FormField label="Ward" htmlFor="join-ward" error={fieldErrors.wardId}>
            <select
              id="join-ward"
              value={wardId}
              onChange={(e) => setWardId(e.target.value)}
              aria-invalid={Boolean(fieldErrors.wardId)}
              aria-describedby={fieldErrors.wardId ? "join-ward-error" : undefined}
              className={inputClass}
            >
              <option value="">Choose your ward...</option>
              {wards.data.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Household reference"
            htmlFor="join-ref"
            error={fieldErrors.householdReference}
            hint="For example DEMO-W2-004"
          >
            <input
              id="join-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              aria-invalid={Boolean(fieldErrors.householdReference)}
              aria-describedby={fieldErrors.householdReference ? "join-ref-error" : "join-ref-hint"}
              className={inputClass}
            />
          </FormField>

          <div className="space-y-3 sm:col-span-2">
            {formError ? (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {formError}
              </p>
            ) : null}
            <button type="submit" disabled={submitting} className={primaryButton}>
              {submitting ? "Sending..." : "Send request"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}


