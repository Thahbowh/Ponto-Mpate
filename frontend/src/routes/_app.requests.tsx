import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/AuthContext";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { formatDateTime } from "@/lib/formatters";
import type { JoinRequest } from "@/types/member";
import { FormField, inputClass } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";

export const Route = createFileRoute("/_app/requests")({
  component: RequestsPage,
  head: () => ({ meta: [{ title: "Join requests - Ponto Mpate" }] }),
});

function RequestsPage() {
  const { isAdmin } = useAuth();
  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const { data, loading, error, refetch } = useApi<JoinRequest[]>(`/membership-requests?status=${status}`);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");

  async function decide(id: string, action: "approve" | "reject") {
    if (busyId) return;
    setBusyId(id);
    setMessage("");
    setProblem("");
    try {
      await api(`/membership-requests/${id}/${action}`, { method: "POST" });
      setMessage(action === "approve" ? "Request approved." : "Request declined.");
      refetch();
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Could not update the request. Please try again.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-ink">Join requests</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Members ask to be linked to a household. Approve a request only if you recognise the member as part of that
          household. Approval is what stops a household being claimed by the wrong person.
        </p>
      </header>

      <div className="max-w-xs">
        <FormField label="Show requests" htmlFor="rq-status">
          <select
            id="rq-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className={inputClass}
          >
            <option value="PENDING">Waiting for a decision</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Declined</option>
          </select>
        </FormField>
      </div>

      {message ? (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          {message}
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {problem}
        </p>
      ) : null}

      {loading && !data ? <LoadingState label="Loading requests..." /> : null}
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      {data ? (
        data.length === 0 ? (
          <EmptyState title="No requests here" hint={status === "PENDING" ? "New requests will appear when members ask to join a household." : undefined} />
        ) : (
          <ul className="space-y-3">
            {data.map((r) => (
              <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{r.user.name}</p>
                    <p className="text-xs text-slate-500">{r.user.email}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  Wants to join <strong>{r.household.householdName}</strong> ({r.household.reference}) in{" "}
                  {r.household.ward.name}
                </p>
                <p className="text-xs text-slate-500">Requested {formatDateTime(r.requestedAt)}</p>
                {isAdmin && r.status === "PENDING" ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => decide(r.id, "approve")}
                      disabled={busyId !== ""}
                      className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90 disabled:opacity-60"
                    >
                      {busyId === r.id ? "Working..." : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(r.id, "reject")}
                      disabled={busyId !== ""}
                      className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-gold disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
