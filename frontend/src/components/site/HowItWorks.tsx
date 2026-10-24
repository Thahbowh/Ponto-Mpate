import { UserPlus, Wallet, Bell, HeartHandshake } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    n: "01",
    title: "Join your ward",
    desc: "Verify your identity and join a community ward of trusted neighbours. Onboarding takes under five minutes.",
  },
  {
    icon: Wallet,
    n: "02",
    title: "Contribute together",
    desc: "A small, predictable contribution, auto-collected through secure local payment rails. R12 keeps a family standing.",
  },
  {
    icon: Bell,
    n: "03",
    title: "Activate support",
    desc: "When loss occurs, a single request triggers verified ward wide notification and immediate payout coordination.",
  },
  {
    icon: HeartHandshake,
    n: "04",
    title: "Stand together",
    desc: "Funds reach the family within 48 hours. The ward gathers physically and financially through every step.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative py-20 md:py-36 bg-ink text-cream overflow-x-hidden noise">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-96 w-[600px] bg-gold/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-5">
        <div className="text-center max-w-2xl mx-auto reveal">
          <span className="text-xs tracking-widest uppercase text-gold font-medium">
            How it works
          </span>
          {/* FIX: smaller heading on mobile */}
          <h2 className="mt-4 font-display text-3xl sm:text-4xl md:text-6xl leading-tight">
            Four steps from <span className="text-gold-gradient italic">stranger</span> to family.
          </h2>
          <p className="mt-6 text-cream/70 text-base sm:text-lg">
            Designed with the rhythm of Qwaqwa community life, not against it.
          </p>
        </div>

        {/* FIX: 1 col on mobile, 2 cols on md, 4 cols on lg */}
        <div className="mt-12 sm:mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="reveal group relative p-6 sm:p-8 rounded-3xl glass-dark hover:border-gold/40 transition-all duration-500 hover:-translate-y-2"
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="font-display text-5xl sm:text-6xl text-gold/20 group-hover:text-gold/40 transition-colors">
                {s.n}
              </div>
              <div className="mt-4 grid h-12 w-12 place-items-center rounded-xl bg-gold/10 text-gold group-hover:bg-gold group-hover:text-ink transition-all">
                <s.icon size={22} />
              </div>
              <h3 className="mt-5 font-display text-xl sm:text-2xl">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-cream/65">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
