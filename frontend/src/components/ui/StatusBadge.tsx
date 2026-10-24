const STYLES: Record<string, { label: string; className: string }> = {
  PAID: { label: "Paid", className: "bg-green-100 text-green-800 border-green-300" },
  PARTIALLY_PAID: { label: "Part paid", className: "bg-amber-100 text-amber-800 border-amber-300" },
  UNPAID: { label: "Outstanding", className: "bg-slate-100 text-slate-700 border-slate-300" },
  UNDER_REVIEW: { label: "Under review", className: "bg-orange-100 text-orange-800 border-orange-300" },
  ACTIVE: { label: "Active", className: "bg-blue-100 text-blue-800 border-blue-300" },
  CLOSED: { label: "Closed", className: "bg-slate-200 text-slate-700 border-slate-400" },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-800 border-red-300" },
  MATCHED: { label: "Matched", className: "bg-green-100 text-green-800 border-green-300" },
  NEEDS_REVIEW: { label: "Needs review", className: "bg-orange-100 text-orange-800 border-orange-300" },
  AWAITING_HANDOVER: { label: "Awaiting handover", className: "bg-slate-100 text-slate-700 border-slate-300" },
  PENDING: { label: "Pending", className: "bg-amber-100 text-amber-800 border-amber-300" },
  SUCCESSFUL: { label: "Successful", className: "bg-green-100 text-green-800 border-green-300" },
  FAILED: { label: "Failed", className: "bg-red-100 text-red-800 border-red-300" },
  CONFIRMED: { label: "Confirmed", className: "bg-green-100 text-green-800 border-green-300" },
  AWAITING_SETTLEMENT: { label: "Awaiting settlement", className: "bg-amber-100 text-amber-800 border-amber-300" },
  SETTLED: { label: "Settled", className: "bg-green-100 text-green-800 border-green-300" },
  APPROVED: { label: "Approved", className: "bg-green-100 text-green-800 border-green-300" },
  REJECTED: { label: "Declined", className: "bg-red-100 text-red-800 border-red-300" },
};

/** Always shows a text label, so status never depends on colour alone. */
export function StatusBadge({ status }: { status: string }) {
  const s = STYLES[status] ?? { label: status, className: "bg-slate-100 text-slate-700 border-slate-300" };
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.className}`}
    >
      {s.label}
    </span>
  );
}

