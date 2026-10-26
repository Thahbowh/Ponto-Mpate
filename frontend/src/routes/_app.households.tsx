import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatReference } from "@/lib/formatters";
import { useApi } from "@/lib/useApi";
import type { Household, Ward } from "@/types/api";
import { FormField, inputClass } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const Route = createFileRoute("/_app/households")({
  component: HouseholdsPage,
  head: () => ({ meta: [{ title: "Households — Ponto Mpate" }] }),
});

type Tab = "households" | "wards";

const buttonClass =
  "rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90 disabled:opacity-60";

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <StatusBadge status="ACTIVE" />
  ) : (
    <span className="inline-block rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
      Inactive
    </span>
  );
}

function HouseholdsPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("households");
  const wards = useApi<Ward[]>("/wards");
  const everyone = useApi<Household[]>("/households"); // unfiltered, used for ward counts

  const tabClass = (t: Tab) =>
    `rounded-full px-4 py-2 text-sm font-semibold ${
      tab === t ? "bg-ink text-cream" : "bg-white text-slate-700 border border-slate-300 hover:border-gold"
    }`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-ink">Households and wards</h1>
        <p className="mt-1 text-sm text-slate-600">
          Register participating households and manage the wards they belong to.
        </p>
      </header>

      <div role="tablist" aria-label="Households and wards" className="flex gap-2">
        <button
          role="tab"
          type="button"
          aria-selected={tab === "households"}
          className={tabClass("households")}
          onClick={() => setTab("households")}
        >
          Households
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={tab === "wards"}
          className={tabClass("wards")}
          onClick={() => setTab("wards")}
        >
          Wards
        </button>
      </div>

      {wards.loading ? <LoadingState label="Loading wards…" /> : null}
      {wards.error ? <ErrorState message={wards.error} onRetry={wards.refetch} /> : null}

      {wards.data ? (
        tab === "households" ? (
          <HouseholdsTab wards={wards.data} isAdmin={isAdmin} onChanged={everyone.refetch} />
        ) : (
          <WardsTab
            wards={wards.data}
            households={everyone.data ?? []}
            isAdmin={isAdmin}
            onChanged={wards.refetch}
          />
        )
      ) : null}
    </div>
  );
}

/* ----------------------------- Households tab ----------------------------- */

function HouseholdsTab({
  wards,
  isAdmin,
  onChanged,
}: {
  wards: Ward[];
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [wardId, setWardId] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");

  // Wait until the user stops typing before asking the server
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (wardId) params.set("wardId", wardId);
  const list = useApi<Household[]>(`/households${params.toString() ? `?${params}` : ""}`);

  const rows = (list.data ?? []).filter((h) =>
    status === "all" ? true : status === "active" ? h.isActive : !h.isActive
  );

  const filtersActive = Boolean(search || wardId || status !== "all");

  return (
    <div className="space-y-6">
      {isAdmin ? (
        <RegisterHouseholdForm
          wards={wards}
          onRegistered={() => {
            list.refetch();
            onChanged();
          }}
        />
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          You have read-only access. Only administrators can register households.
        </p>
      )}

      <section aria-label="Find households" className="grid gap-3 sm:grid-cols-3">
        <FormField label="Search" htmlFor="hh-search" hint="Household name, house number or reference">
          <input
            id="hh-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="e.g. Dlamini, 12 or 402 030"
            className={inputClass}
          />
        </FormField>
        <FormField label="Ward" htmlFor="hh-ward">
          <select
            id="hh-ward"
            value={wardId}
            onChange={(e) => setWardId(e.target.value)}
            className={inputClass}
          >
            <option value="">All wards</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Status" htmlFor="hh-status">
          <select
            id="hh-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as "all" | "active" | "inactive")}
            className={inputClass}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FormField>
      </section>

      {list.loading ? <LoadingState label="Loading households…" /> : null}
      {list.error ? <ErrorState message={list.error} onRetry={list.refetch} /> : null}

      {list.data ? (
        rows.length === 0 ? (
          <EmptyState
            title={filtersActive ? "No households match these filters" : "No households registered yet"}
            hint={
              filtersActive
                ? "Try a different search or clear the filters."
                : isAdmin
                  ? "Use the form above to register the first household."
                  : undefined
            }
          />
        ) : (
          <>
            <p className="text-sm text-slate-600" aria-live="polite">
              Showing {rows.length} household{rows.length === 1 ? "" : "s"}
              {list.data.length >= 200 ? " (the first 200; refine your search to see others)" : ""}.
            </p>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-3">Reference</th>
                    <th scope="col" className="px-4 py-3">Household</th>
                    <th scope="col" className="px-4 py-3">Ward</th>
                    <th scope="col" className="px-4 py-3">House no.</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((h) => (
                    <tr key={h.id}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700">{formatReference(h.reference)}</td>
                      <td className="px-4 py-3 font-medium text-ink">{h.householdName}</td>
                      <td className="px-4 py-3 text-slate-700">{h.ward.name}</td>
                      <td className="px-4 py-3 text-slate-700">{h.houseNumber ?? "-"}</td>
                      <td className="px-4 py-3"><ActiveBadge active={h.isActive} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="space-y-3 md:hidden">
              {rows.map((h) => (
                <li key={h.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-ink">{h.householdName}</p>
                    <ActiveBadge active={h.isActive} />
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-600">{formatReference(h.reference)}</p>
                  <p className="mt-1 text-sm text-slate-700">{h.ward.name}{h.houseNumber ? ` - house ${h.houseNumber}` : ""}</p>
                </li>
              ))}
            </ul>
          </>
        )
      ) : null}
    </div>
  );
}

function RegisterHouseholdForm({
  wards,
  onRegistered,
}: {
  wards: Ward[];
  onRegistered: () => void;
}) {
  const activeWards = wards.filter((w) => w.isActive);
  const [householdName, setHouseholdName] = useState("");
  const [wardId, setWardId] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [reference, setReference] = useState("");
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
    if (householdName.trim().length < 2) {
      errs.householdName = "Enter the household's name (at least 2 characters).";
    }
    if (!wardId) errs.wardId = "Choose a ward.";
    if (houseNumber.trim().length < 1) errs.houseNumber = "Enter the house number.";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const created = await api<Household>("/households", {
        method: "POST",
        body: {
          householdName: householdName.trim(),
          wardId,
          houseNumber: houseNumber.trim(),
          ...(reference.trim() ? { reference: reference.trim() } : {}),
        },
      });
      setSuccess(`Registered ${created.householdName} (${formatReference(created.reference)}) in ${created.ward.name}.`);
      setHouseholdName("");
      setHouseNumber("");
      setReference("");
      onRegistered();
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = err.fieldErrors();
        setFieldErrors(fe);
        setFormError(Object.keys(fe).length > 0 ? "Please correct the highlighted fields." : err.message);
      } else {
        setFormError("Could not register the household. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="register-heading" className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 id="register-heading" className="text-lg font-semibold text-ink">
        Register a household
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Use a neutral label for the household. Please do not enter personal details beyond what is needed.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Household name" htmlFor="hh-name" error={fieldErrors.householdName}>
          <input
            id="hh-name"
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
            aria-invalid={Boolean(fieldErrors.householdName)}
            aria-describedby={fieldErrors.householdName ? "hh-name-error" : undefined}
            placeholder="e.g. Demo Sithole household"
            className={inputClass}
          />
        </FormField>

        <FormField label="Ward" htmlFor="hh-ward-new" error={fieldErrors.wardId}>
          <select
            id="hh-ward-new"
            value={wardId}
            onChange={(e) => setWardId(e.target.value)}
            aria-invalid={Boolean(fieldErrors.wardId)}
            aria-describedby={fieldErrors.wardId ? "hh-ward-new-error" : undefined}
            className={inputClass}
          >
            <option value="">Choose a ward…</option>
            {activeWards.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="House number"
          htmlFor="hh-house"
          error={fieldErrors.houseNumber}
          hint="For example 12 or 345A"
        >
          <input
            id="hh-house"
            value={houseNumber}
            onChange={(e) => setHouseNumber(e.target.value)}
            aria-invalid={Boolean(fieldErrors.houseNumber)}
            aria-describedby={fieldErrors.houseNumber ? "hh-house-error" : "hh-house-hint"}
            className={inputClass}
          />
        </FormField>
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium text-ink">Household reference</p>
          <p className="mt-1">
            Created automatically when you register the household. It is also the number the household uses to pay at
            a shop.
          </p>
        </div>

        <div className="space-y-3 sm:col-span-2 lg:col-span-4">
          {formError ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {formError}
            </p>
          ) : null}
          {success ? (
            <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {success}
            </p>
          ) : null}
          <button type="submit" disabled={submitting} className={buttonClass}>
            {submitting ? "Registering…" : "Register household"}
          </button>
        </div>
      </form>
    </section>
  );
}

/* -------------------------------- Wards tab -------------------------------- */

function WardsTab({
  wards,
  households,
  isAdmin,
  onChanged,
}: {
  wards: Ward[];
  households: Household[];
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const counts = new Map<string, number>();
  for (const h of households) {
    if (h.isActive) counts.set(h.wardId, (counts.get(h.wardId) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      {isAdmin ? <CreateWardForm onCreated={onChanged} /> : null}

      {wards.length === 0 ? (
        <EmptyState title="No wards yet" hint={isAdmin ? "Create the first ward above." : undefined} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {wards.map((w) => (
            <li key={w.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-ink">{w.name}</p>
                <ActiveBadge active={w.isActive} />
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {counts.get(w.id) ?? 0} active household{(counts.get(w.id) ?? 0) === 1 ? "" : "s"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateWardForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
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

    if (name.trim().length < 2) {
      setFieldErrors({ name: "Enter a ward name (at least 2 characters)." });
      return;
    }

    setSubmitting(true);
    try {
      const ward = await api<Ward>("/wards", { method: "POST", body: { name: name.trim() } });
      setSuccess(`Created ${ward.name}.`);
      setName("");
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = err.fieldErrors();
        setFieldErrors(fe);
        setFormError(Object.keys(fe).length > 0 ? "Please correct the highlighted field." : err.message);
      } else {
        setFormError("Could not create the ward. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="ward-heading" className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 id="ward-heading" className="text-lg font-semibold text-ink">
        Create a ward
      </h2>
      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4 sm:max-w-md">
        <FormField label="Ward name" htmlFor="ward-name" error={fieldErrors.name}>
          <input
            id="ward-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "ward-name-error" : undefined}
            placeholder="e.g. Demo Ward 5"
            className={inputClass}
          />
        </FormField>
        {formError ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {formError}
          </p>
        ) : null}
        {success ? (
          <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </p>
        ) : null}
        <button type="submit" disabled={submitting} className={buttonClass}>
          {submitting ? "Creating…" : "Create ward"}
        </button>
      </form>
    </section>
  );
}


