import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { formatDateTime } from "@/lib/formatters";

interface Messages {
  unread: number;
  items: { id: string; title: string; message: string; createdAt: string; read: boolean; event: string | null }[];
}

/** The member's latest messages, for example when a funeral is announced in their ward. */
export function MessagesPanel() {
  const { data, refetch } = useApi<Messages>("/member/notifications");
  const [busyId, setBusyId] = useState("");

  if (!data || data.items.length === 0) return null;

  async function markRead(id: string) {
    if (busyId) return;
    setBusyId(id);
    try {
      await api(`/member/notifications/${id}/read`, { method: "POST" });
      refetch();
    } finally {
      setBusyId("");
    }
  }

  return (
    <section aria-labelledby="messages-heading" className="space-y-3">
      <h2 id="messages-heading" className="text-lg font-semibold text-ink">
        Messages{data.unread > 0 ? ` (${data.unread} new)` : ""}
      </h2>
      <ul className="space-y-3">
        {data.items.slice(0, 5).map((m) => (
          <li
            key={m.id}
            className={`rounded-xl border p-4 text-sm ${m.read ? "border-slate-200 bg-white" : "border-gold bg-amber-50"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-ink">
                {m.title}
                {!m.read ? <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-ink">New</span> : null}
              </p>
              <p className="text-xs text-slate-500">{formatDateTime(m.createdAt)}</p>
            </div>
            <p className="mt-1 text-slate-700">{m.message}</p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <Link to="/member/contributions" className="font-semibold underline decoration-gold decoration-2 underline-offset-4">
                Go to Contributions
              </Link>
              {!m.read ? (
                <button
                  type="button"
                  onClick={() => markRead(m.id)}
                  disabled={busyId !== ""}
                  className="font-semibold text-slate-700 underline disabled:opacity-60"
                >
                  Mark as read
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
