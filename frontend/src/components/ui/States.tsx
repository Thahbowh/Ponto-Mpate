import type { ReactNode } from "react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 p-6 text-slate-600">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-ink" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
      <p className="font-semibold">Something went wrong</p>
      <p className="mt-1 text-sm">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="font-semibold text-slate-800">{title}</p>
      {hint ? <p className="mt-1 text-sm text-slate-600">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

