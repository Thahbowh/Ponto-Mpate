import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { api, ApiError } from "@/lib/api";
import { formatRand } from "@/lib/formatters";

interface ShopRef {
  payReference: string;
  amount: string;
  event: { reference: string; title: string };
}

function group(ref: string): string {
  return ref.replace(/(\d{3})(?=\d)/g, "$1 ");
}

const secondaryButton =
  "rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-gold disabled:opacity-60";

/** Shows the numeric reference a member takes to a shop. */
export function ShopReference({
  obligationId,
  existing,
  amount,
}: {
  obligationId: string;
  existing: string | null;
  amount: string;
}) {
  const [ref, setRef] = useState<string | null>(existing);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    if (ref) {
      setOpen(true);
      return;
    }
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<ShopRef>(`/member/contributions/${obligationId}/shop-reference`, { method: "POST" });
      setRef(data.payReference);
      setOpen(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create a reference. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={toggle} disabled={busy} className={secondaryButton}>
        {busy ? "Creating reference..." : open ? "Hide shop reference" : "Pay cash at a shop"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {open && ref ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
          <p className="text-xs uppercase tracking-wide text-slate-500">Your payment reference</p>
          <p className="font-mono text-2xl font-bold tracking-widest text-ink">{group(ref)}</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5">
            <li>Take this reference and {formatRand(amount)} in cash to a participating shop.</li>
            <li>Pay through the shop&apos;s voucher service and dial the USSD code on any phone.</li>
            <li>Enter the reference, check the amount and confirm. You receive a receipt.</li>
          </ol>
          <p className="mt-3 text-xs text-slate-500">
            Demo only: no real shop, voucher or phone network is used. Never share a voucher PIN with anyone.
          </p>
          <Link to="/ussd-demo" className="mt-2 inline-block font-semibold underline decoration-gold decoration-2 underline-offset-4">
            Open the USSD simulator
          </Link>
        </div>
      ) : null}
    </div>
  );
}
