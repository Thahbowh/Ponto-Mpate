import { Eye, Zap, Users, Activity } from "lucide-react";

const items = [
  {
    icon: Eye,
    title: "Radical transparency",
    desc: "Every rand contributed, every payout made is visible to every member in real time. No hidden ledgers, no surprises.",
  },
  {
    icon: Zap,
    title: "Fast emergency support",
    desc: "When a family is in mourning, support is activated within 24 hours. Dignity cannot wait on paperwork.",
  },
  {
    icon: Users,
    title: "Local accountability",
    desc: "Ward leaders elected by members. Decisions stay close to the people they serve, never outsourced.",
  },
  {
    icon: Activity,
    title: "Live contribution tracking",
    desc: "Members see their standing, their ward's health, and every transaction logged on an immutable timeline.",
  },
];

export function Trust() {
  return (
    <section id="trust" className="relative py-20 md:py-36 bg-cream overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-5">
        <div className="max-w-2xl reveal">
          <span className="text-xs tracking-widest uppercase text-gold-deep font-medium">
            Why communities trust us
          </span>
          {/* FIX: smaller heading on mobile */}
          <h2 className="mt-4 font-display text-3xl sm:text-4xl md:text-6xl leading-tight">
            Trust isn't claimed.
            <br />
            <span className="italic text-muted-foreground">It's witnessed.</span>
          </h2>
        </div>

        {/* FIX: single column on mobile, 2 cols from sm up */}
        <div className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-2 gap-px bg-border rounded-3xl overflow-hidden shadow-[var(--shadow-luxe)]">
          {items.map((it, i) => (
            <div
              key={it.title}
              className="reveal group relative bg-card p-8 md:p-12 transition-colors hover:bg-ink hover:text-cream"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-ink text-gold group-hover:bg-gold group-hover:text-ink transition-all">
                <it.icon size={24} />
              </div>
              <h3 className="mt-6 font-display text-xl sm:text-2xl md:text-3xl">{it.title}</h3>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground group-hover:text-cream/70 transition-colors">
                {it.desc}
              </p>
              <div className="absolute top-6 right-6 font-display text-sm text-gold/40">
                0{i + 1}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
