import { createFileRoute, Link } from "@tanstack/react-router";
import { useApi } from "@/lib/useApi";
import type { Receipt } from "@/types/api";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { ReceiptView } from "@/features/payments/ReceiptView";

export const Route = createFileRoute("/member/receipts/$receiptNumber")({
  component: MemberReceiptPage,
  head: () => ({ meta: [{ title: "Receipt - Ponto Mpate" }] }),
});

function MemberReceiptPage() {
  const { receiptNumber } = Route.useParams();
  const { data, loading, error, refetch } = useApi<Receipt>(
    `/member/receipts/${encodeURIComponent(receiptNumber)}`
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 print:hidden">
        <Link
          to="/member/payments"
          className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-gold"
        >
          Back to payments
        </Link>
        {data ? (
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90"
          >
            Print receipt
          </button>
        ) : null}
      </div>

      {loading && !data ? <LoadingState label="Loading receipt..." /> : null}
      {error ? <ErrorState message={error} onRetry={refetch} /> : null}
      {data ? <ReceiptView data={data} /> : null}
    </div>
  );
}
