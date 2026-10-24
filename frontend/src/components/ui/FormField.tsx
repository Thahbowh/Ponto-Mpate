import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-gold focus:ring-2 focus:ring-gold/30 disabled:bg-slate-100 disabled:text-slate-500 aria-[invalid=true]:border-red-500";

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
