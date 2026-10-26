import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatRand } from "@/lib/formatters";

interface CloseResult {
  id: string;
  reference: string;
  status: string;
  summary: {
    expected: string;
    recorded: string;
    outstanding: string;
    householdsNotFullyPaid: number;
  };
}

const primaryButton =
  "rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90 disabled:opacity-60";
const secondaryButton =
  "rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-gold disabled:opacity-60";

/** Lets an administrator close an active event. The server decides whether it is allowed. */
export function CloseEventButton({
  eventId,
  reference,
  title,
  status,
  onClosed,
}: {
  eventId: string;
  reference: string;
  title: string;
  status: string;
  onClosed?: () => void;
}) {
  const { isAdmin } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CloseResult | null>(null);

  async function close() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<CloseResult>(`/funeral-events/${eventId}/close`, { method: "POST" });
      setResult(data);
      setConfirming(false);
      onClosed?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not close the event. Please try again.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div role="status" className="mt-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
        <p className="font-semibold">{result.reference} is now closed</p>
        <p className="mt-1">
          Expected {formatRand(result.summary.expected)}, recorded {formatRand(result.summary.recorded)}, outstanding{" "}
          {formatRand(result.summary.outstanding)}. {result.summary.householdsNotFullyPaid} household
          {result.summary.householdsNotFullyPaid === 1 ? "" : "s"} had not paid in full. No further payments can be
          recorded.
        </p>
      </div>
    );
  }

  if (!isAdmin || status !== "ACTIVE") return null;

  return (
    <div className="mt-3">
      {confirming ? (
        <div className="space-y-3 rounded-lg border-2 border-gold bg-white p-4">
          <p className="text-sm text-slate-800">
            Close {reference} ({title})? No further payments or handovers can be recorded for it afterwards, including
            from households that have not paid yet. This cannot be undone from this app.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={close} disabled={busy} className={primaryButton}>
              {busy ? "Closing..." : "Yes, close the event"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setError("");
            setConfirming(true);
          }}
          className={secondaryButton}
        >
          Close event
        </button>
      )}

      {error ? (
        <div role="alert" className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
          <p>{error}</p>
          {error.startsWith("Cannot close") ? (
            <Link to="/reconciliation" className="mt-2 inline-block font-semibold underline">
              Open reconciliation
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
