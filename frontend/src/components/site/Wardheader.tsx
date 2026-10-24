import { View, Text } from "lucide-react";

// components/app/WardHeader.tsx
type WardHeaderProps = {
  wardNumber: number;
  syncStatus: string; // e.g. "Synced just now"
};

export function WardHeader({ wardNumber, syncStatus }: WardHeaderProps) {
  return (
    <header className="bg-ink">
      {/* Top row: logo + ward badge */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <span className="font-display text-lg text-cream">
          Ponto <span className="text-gold-gradient">Mpate</span>
        </span>

        <span className="rounded-full border border-gold/40 px-3 py-1.5 text-xs font-medium tracking-wide text-gold">
          WARD {wardNumber}
        </span>
      </div>

      {/* Sync status strip */}
      <div className="flex items-center gap-2 bg-cream/5 px-5 py-2.5">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="text-xs text-cream/60">{syncStatus}</span>
      </div>
    </header>
  );
}