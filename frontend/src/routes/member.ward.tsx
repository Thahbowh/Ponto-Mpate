import { createFileRoute } from "@tanstack/react-router";
import { useApi } from "@/lib/useApi";
import type { MemberMe, MemberWard } from "@/types/member";
import { ErrorState, LoadingState } from "@/components/ui/States";

export const Route = createFileRoute("/member/ward")({
  component: WardPage,
  head: () => ({ meta: [{ title: "My ward - Ponto Mpate" }] }),
});

function Counts({ w }: { w: MemberWard }) {
  return (
    <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
      <div>
        <dt className="text-xs text-slate-500">Registered households</dt>
        <dd className="text-xl font-bold text-ink">{w.registeredHouseholds}</dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">Active participating households</dt>
        <dd className="text-xl font-bold text-ink">{w.activeHouseholds}</dd>
      </div>
      <div>
        <dt className="text-xs text-slate-500">Member accounts</dt>
        <dd className="text-xl font-bold text-ink">{w.memberAccounts}</dd>
      </div>
    </dl>
  );
}

function WardPage() {
  const me = useApi<MemberMe>("/member/me");
  const wards = useApi<MemberWard[]>("/member/wards");
  const myWardId = me.data?.membership?.household.ward.id ?? null;
  const mine = wards.data?.find((w) => w.id === myWardId) ?? null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-ink">Ward participation</h1>
        <p className="mt-1 text-sm text-slate-600">
          Only totals are shown. Other households&apos; details are private.
        </p>
      </header>

      {wards.loading && !wards.data ? <LoadingState label="Loading wards..." /> : null}
      {wards.error ? <ErrorState message={wards.error} onRetry={wards.refetch} /> : null}

      {mine ? (
        <section aria-labelledby="mine-heading" className="rounded-xl border-2 border-gold bg-white p-5">
          <h2 id="mine-heading" className="text-lg font-semibold text-ink">
            Your ward: {mine.name}
          </h2>
          <Counts w={mine} />
        </section>
      ) : null}

      {wards.data ? (
        <section aria-labelledby="all-heading" className="space-y-3">
          <h2 id="all-heading" className="text-lg font-semibold text-ink">
            All wards
          </h2>
          <ul className="space-y-3">
            {wards.data.map((w) => (
              <li key={w.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="font-semibold text-ink">{w.name}</p>
                <Counts w={w} />
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">
            Registered households are all households on the ward list. Active participating households are the ones
            currently taking part. Member accounts are the people who have signed up and been approved.
          </p>
        </section>
      ) : null}
    </div>
  );
}
