import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api, ApiError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { formatRand } from "@/lib/formatters";
import type { Checkout, DemoPayResult } from "@/types/member";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ErrorState, LoadingState } from "@/components/ui/States";

export const Route = createFileRoute("/member/pay/$reference")({
  component: PayPage,
  head: () => ({ meta: [{ title: "Pay - Ponto Mpate" }] }),
});

type Outcome = "success" | "fail" | "cancel";

const primaryButton =
  "rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90 disabled:opacity-60";
const secondaryButton =
  "rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-gold disabled:opacity-60";

function PayPage() {
  const { reference } = Route.useParams();
  const ref = encodeURIComponent(reference);
  const { data, loading, error, refetch } = useApi<Checkout>(`/member/checkout/${ref}`);
  const [busy, setBusy] = useState<Outcome | "">("");
  const [problem, setProblem] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);

  async function run(outcome: Outcome) {
    if (busy) return;
    setBusy(outcome);
    setProblem("");
    try {
      const result = await api<DemoPayResult>(`/member/checkout/${ref}/demo-pay`, {
        method: "POST",
        body: { outcome },
      });
      setReceipt(result.receiptNumber);
      refetch(); // what is shown comes from the server, not from the button that was clicked
    } catch (err) {
      setProblem(err instanceof ApiError ? err.message : "Something went wrong. Please check your payment history before trying again.");
    } finally {
      setBusy("");
    }
  }

  const receiptNumber = data?.receiptNumber ?? receipt;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold text-ink">Pay your contribution</h1>
      </header>

      {loading && !data ? <LoadingState label="Loading checkout..." /> : null}
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}

      {data ? (
        <>
          {data.mode === "demo" ? (
            <p role="note" className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-sm text-amber-950">
              <strong>Demo mode.</strong> This is a practice payment. No real money moves, and no card or bank details
              are collected.
            </p>
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Funeral event</dt>
                <dd className="font-medium text-slate-900">
                  {data.event.reference} - {data.event.title}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Status</dt>
                <dd>
                  <StatusBadge status={data.status} />
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Amount</dt>
                <dd className="text-3xl font-bold text-ink">{formatRand(data.amount)}</dd>
              </div>
            </dl>
          </section>

          {data.status === "PENDING" ? (
            data.mode === "demo" ? (
              <section aria-labelledby="demo-heading" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
                <h2 id="demo-heading" className="text-lg font-semibold text-ink">
                  Choose what the practice payment does
                </h2>
                <p className="text-sm text-slate-600">
                  Your payment is only confirmed after the server verifies the result it receives from the payment
                  provider. Pressing a button here does not confirm anything by itself.
                </p>
                {problem ? (
                  <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {problem}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => run("success")} disabled={busy !== ""} className={primaryButton}>
                    {busy === "success" ? "Processing..." : `Pay ${formatRand(data.amount)} (demo)`}
                  </button>
                  <button type="button" onClick={() => run("fail")} disabled={busy !== ""} className={secondaryButton}>
                    {busy === "fail" ? "Processing..." : "Simulate a failed payment"}
                  </button>
                  <button type="button" onClick={() => run("cancel")} disabled={busy !== ""} className={secondaryButton}>
                    {busy === "cancel" ? "Cancelling..." : "Cancel"}
                  </button>
                </div>
              </section>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                Online payments are not available at the moment. Please pay your ward administrator.
              </p>
            )
          ) : null}

          {data.status === "SUCCESSFUL" ? (
            <section role="status" className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-5 text-green-900">
              <h2 className="text-xl font-semibold">Payment confirmed</h2>
              <p className="text-sm">
                The payment was verified and saved{receiptNumber ? `. Your receipt number is ${receiptNumber}.` : "."}
              </p>
              <div className="flex flex-wrap gap-3">
                {receiptNumber ? (
                  <Link
                    to="/member/receipts/$receiptNumber"
                    params={{ receiptNumber }}
                    className={primaryButton}
                  >
                    View / print receipt
                  </Link>
                ) : null}
                <Link to="/member/contributions" className={secondaryButton}>
                  Back to contributions
                </Link>
              </div>
            </section>
          ) : null}

          {data.status === "FAILED" || data.status === "CANCELLED" ? (
            <section role="status" className="space-y-3 rounded-xl border border-slate-300 bg-slate-100 p-5 text-slate-800">
              <h2 className="text-xl font-semibold">
                {data.status === "FAILED" ? "The payment was not completed" : "Checkout cancelled"}
              </h2>
              <p className="text-sm">Nothing was charged and no payment was recorded. You can try again from your contributions.</p>
              <Link to="/member/contributions" className={secondaryButton}>
                Back to contributions
              </Link>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
