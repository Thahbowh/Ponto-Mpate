import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/ussd-demo")({
  component: UssdDemo,
  head: () => ({ meta: [{ title: "USSD simulator - Ponto Mpate" }] }),
});

const BASE: string = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";

function UssdDemo() {
  const [started, setStarted] = useState(false);
  const [screen, setScreen] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [ended, setEnded] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sessionId = useRef("");

  async function send(next: string[]) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/ussd/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, text: next.join("*") }),
      });
      const body = (await res.text()).trim();
      if (body.startsWith("CON ") || body.startsWith("END ")) {
        setScreen(body.slice(4));
        setEnded(body.startsWith("END "));
        setAnswers(next);
      } else {
        setError("The simulator is not available right now.");
      }
    } catch {
      setError("Could not reach the server. Nothing was recorded.");
    } finally {
      setBusy(false);
    }
  }

  function dial() {
    sessionId.current = crypto.randomUUID();
    setStarted(true);
    setEnded(false);
    setInput("");
    send([]);
  }

  function reply(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const clean = input.replace(/[*#]/g, "").trim();
    if (!clean) {
      setError("Type a reply first.");
      return;
    }
    setInput("");
    send([...answers, clean]);
  }

  function reset() {
    setStarted(false);
    setScreen("");
    setAnswers([]);
    setEnded(false);
    setInput("");
    setError("");
  }

  const button =
    "rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90 disabled:opacity-60";
  const ghost =
    "rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-gold disabled:opacity-60";

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-sm space-y-5">
        <Link to="/" className="text-sm font-semibold underline decoration-gold decoration-2 underline-offset-4">
          Back to Ponto Mpate
        </Link>
        <header>
          <h1 className="font-display text-3xl font-semibold text-ink">USSD simulator</h1>
          <p className="mt-1 text-sm text-slate-600">
            Shows how a member with a basic phone could pay a contribution at a shop. This is a simulation: no real
            voucher, money or phone network is used.
          </p>
        </header>

        <section aria-label="Phone screen" className="rounded-3xl border-4 border-slate-700 bg-slate-800 p-4">
          <pre
            aria-live="polite"
            className="min-h-48 whitespace-pre-wrap rounded-lg bg-slate-900 p-3 font-mono text-sm leading-relaxed text-emerald-200"
          >
            {started ? (busy && !screen ? "Connecting..." : screen) : "Dial *134*000# (demo code) to begin."}
          </pre>
        </section>

        {error ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {!started ? (
          <button type="button" onClick={dial} className={button}>
            Dial *134*000#
          </button>
        ) : ended ? (
          <button type="button" onClick={reset} className={button}>
            Start a new session
          </button>
        ) : (
          <form onSubmit={reply} className="space-y-3">
            <label htmlFor="ussd-reply" className="block text-sm font-medium text-slate-800">
              Your reply
            </label>
            <input
              id="ussd-reply"
              inputMode="numeric"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
            />
            <div className="flex gap-3">
              <button type="submit" disabled={busy} className={button}>
                {busy ? "Sending..." : "Send"}
              </button>
              <button type="button" onClick={reset} disabled={busy} className={ghost}>
                End session
              </button>
            </div>
          </form>
        )}

        <p className="text-xs text-slate-500">
          Try: reply 1, then your 9-digit household reference (shown on the Contributions page), then 1 to confirm. The
          simulator never asks for a voucher PIN.
        </p>
      </div>
    </div>
  );
}

