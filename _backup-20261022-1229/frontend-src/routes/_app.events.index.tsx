import { useState } from "react";
import type { FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/AuthContext";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { formatDate, formatRand } from "@/lib/formatters";
import type { EventListItem, Ward } from "@/types/api";
import { FormField, inputClass } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const Route = createFileRoute("/_app/events/")({
  component: EventsPage,
  head: () => ({ meta: [{ title: "Funeral events — Ponto Mpate" }] }),
});

interface CreatedEvent {
  id: string;
  reference: string;
  title: string;
  eventDate: string;
  status: string;
  contributionAmount: string;
  eligibleWards: number;
  households: number;
  expectedTotal: string;
}

const buttonClass =
  "rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90 disabled:opacity-60";

function EventsPage() {
  const { isAdmin } = useAuth();
  const events = useApi<EventListItem[]>("/funeral-events");
  const wards = useApi<Ward[]>("/wards");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "CLOSED" | "CANCELLED">("ALL");

  const rows = (events.data ?? []).filter((e) => status === "ALL" || e.status === status);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-ink">Funeral events</h1>
        <p className="mt-1 text-sm text-slate-600">
          Each event generates one contribution for every participating household. The server decides
          who takes part.
        </p>
      </header>

      {isAdmin ? (
        wards.data ? (
          <CreateEventForm wards={wards.data} onCreated={events.refetch} />
        ) : wards.error ? (
          <ErrorState message={wards.error} onRetry={wards.refetch} />
        ) : (
          <LoadingState label="Loading wards…" />
        )
      ) : (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          You have read-only access. Only administrators can create events.
        </p>
      )}

      <div className="max-w-xs">
        <FormField label="Show events" htmlFor="ev-status">
          <select
            id="ev-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className={inputClass}
          >
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </FormField>
      </div>

      {events.loading ? <LoadingState label="Loading events…" /> : null}
      {events.error ? <ErrorState message={events.error} onRetry={events.refetch} /> : null}

      {events.data ? (
        rows.length === 0 ? (
          <EmptyState
            title={status === "ALL" ? "No funeral events yet" : "No events with this status"}
            hint={status === "ALL" && isAdmin ? "Use the form above to create the first event." : undefined}
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {rows.map((e) => (
              <li key={e.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{e.title}</p>
                    <p className="text-xs text-slate-500">
                      {e.reference} · {formatDate(e.eventDate)}
                    </p>
                  </div>
                  <StatusBadge status={e.status} />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Home ward</dt>
                    <dd className="font-medium text-slate-800">{e.homeWard.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Per household</dt>
                    <dd className="font-medium text-slate-800">{formatRand(e.contributionAmount)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Contributions</dt>
                    <dd className="font-medium text-slate-800">{e._count.obligations}</dd>
                  </div>
                </dl>
                <Link
                  to="/events/$eventId"
                  params={{ eventId: e.id }}
                  className="mt-4 inline-block text-sm font-semibold text-ink underline decoration-gold decoration-2 underline-offset-4"
                >
                  View event →
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

function CreateEventForm({ wards, onCreated }: { wards: Ward[]; onCreated: () => void }) {
  const activeWards = wards.filter((w) => w.isActive);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [homeWardId, setHomeWardId] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [created, setCreated] = useState<CreatedEvent | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFieldErrors({});
    setFormError("");
    setCreated(null);

    const errs: Record<string, string> = {};
    if (title.trim().length < 3) errs.title = "Enter a short neutral label (at least 3 characters).";
    if (!eventDate) errs.eventDate = "Choose the event date.";
    if (!homeWardId) errs.homeWardId = "Choose the home ward.";
    const cleanAmount = amount.trim().replace(",", ".");
    if (cleanAmount && (!Number.isFinite(Number(cleanAmount)) || Number(cleanAmount) <= 0)) {
      errs.contributionAmount = "Enter an amount greater than zero, or leave it blank.";
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const result = await api<CreatedEvent>("/funeral-events", {
        method: "POST",
        body: {
          title: title.trim(),
          eventDate,
          homeWardId,
          ...(cleanAmount ? { contributionAmount: Number(cleanAmount) } : {}),
        },
      });
      setCreated(result);
      setTitle("");
      setAmount("");
      onCreated();
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = err.fieldErrors();
        setFieldErrors(fe);
        setFormError(Object.keys(fe).length > 0 ? "Please correct the highlighted fields." : err.message);
      } else {
        setFormError("Could not create the event. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="create-event-heading" className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 id="create-event-heading" className="text-lg font-semibold text-ink">
        Create a funeral event
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Use a neutral label such as &ldquo;Demo funeral event 3&rdquo;. Please do not enter the name or
        personal details of the person who has died.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField label="Event label" htmlFor="ev-title" error={fieldErrors.title}>
          <input
            id="ev-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={fieldErrors.title ? "ev-title-error" : undefined}
            placeholder="e.g. Demo funeral event 3"
            className={inputClass}
          />
        </FormField>

        <FormField label="Event date" htmlFor="ev-date" error={fieldErrors.eventDate}>
          <input
            id="ev-date"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            aria-invalid={Boolean(fieldErrors.eventDate)}
            aria-describedby={fieldErrors.eventDate ? "ev-date-error" : undefined}
            className={inputClass}
          />
        </FormField>

        <FormField
          label="Home ward"
          htmlFor="ev-ward"
          error={fieldErrors.homeWardId}
          hint="The server adds the neighbouring wards that also contribute."
        >
          <select
            id="ev-ward"
            value={homeWardId}
            onChange={(e) => setHomeWardId(e.target.value)}
            aria-invalid={Boolean(fieldErrors.homeWardId)}
            aria-describedby={fieldErrors.homeWardId ? "ev-ward-error" : "ev-ward-hint"}
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
          label="Amount per household, R (optional)"
          htmlFor="ev-amount"
          error={fieldErrors.contributionAmount}
          hint="Leave blank to use the scheme's default amount."
        >
          <input
            id="ev-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={Boolean(fieldErrors.contributionAmount)}
            aria-describedby={fieldErrors.contributionAmount ? "ev-amount-error" : "ev-amount-hint"}
            placeholder="e.g. 12"
            className={inputClass}
          />
        </FormField>

        <div className="space-y-3 sm:col-span-2">
          {formError ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {formError}
            </p>
          ) : null}
          {created ? (
            <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
              <p className="font-semibold">
                {created.reference} created: {created.title}
              </p>
              <p className="mt-1">
                {created.households} household{created.households === 1 ? "" : "s"} across{" "}
                {created.eligibleWards} ward{created.eligibleWards === 1 ? "" : "s"}, each owing{" "}
                {formatRand(created.contributionAmount)}. Expected total: {formatRand(created.expectedTotal)}.
              </p>
              <Link
                to="/events/$eventId"
                params={{ eventId: created.id }}
                className="mt-2 inline-block font-semibold underline"
              >
                View event →
              </Link>
            </div>
          ) : null}
          <button type="submit" disabled={submitting} className={buttonClass}>
            {submitting ? "Creating…" : "Create event and generate contributions"}
          </button>
        </div>
      </form>
    </section>
  );
}


