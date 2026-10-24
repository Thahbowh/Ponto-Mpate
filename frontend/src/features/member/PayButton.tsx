import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { api, ApiError } from "@/lib/api";
import type { Checkout } from "@/types/member";

const buttonClass =
  "rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90 disabled:opacity-60";

/** Starts a checkout for one contribution, then opens the payment page. */
export function PayButton({ obligationId, label = "Pay now" }: { obligationId: string; label?: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const checkout = await api<Checkout>("/member/checkout", {
        method: "POST",
        body: { obligationId },
      });
      navigate({ to: "/member/pay/$reference", params: { reference: checkout.reference } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the payment. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={start} disabled={busy} className={buttonClass}>
        {busy ? "Starting..." : label}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
