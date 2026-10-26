import {
  TrendingUp, BellRing, Building2, FileHeart,
  LayoutDashboard, CreditCard, UserCircle, BarChart3, Megaphone,
} from "lucide-react";

const features = [
  { icon: TrendingUp, title: "Contribution tracking", desc: "Live ledger of every member's standing, contributions and ward balance." },
  { icon: BellRing, title: "Smart notifications", desc: "SMS, WhatsApp & push alerts the moment a family needs the ward." },
  { icon: Building2, title: "Ward management", desc: "Tools for ward leaders: member rolls, meetings, and decision logs." },
  { icon: FileHeart, title: "Funeral support requests", desc: "Verified, documented requests with end-to-end audit trail." },
  { icon: LayoutDashboard, title: "Admin dashboard", desc: "A single command center for treasurers, secretaries and chairs." },
  { icon: CreditCard, title: "Payment integration", desc: "PayShap, debit order, EFT and card. Built for the South African rails." },
  { icon: UserCircle, title: "Member profiles", desc: "Beneficiaries, dependents and contact tree are kept private, kept ready." },
  { icon: BarChart3, title: "Analytics", desc: "Health metrics for every ward: contributions, payouts, growth, retention." },
  { icon: Megaphone, title: "Community announcements", desc: "Broadcast condolences, meetings and ward news beautifully." },
];

export function Features() {
  return (
    <section id="features" className="relative py-20 md:py-36 bg-cream overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-5">
        <div className="max-w-3xl reveal">
          <span className="text-xs tracking-widest uppercase text-gold-deep font-medium">
            Everything your ward needs
          </span>
          {/* FIX: responsive heading */}
          <h2 className="mt-4 font-display text-3xl sm:text-4xl md:text-6xl leading-tight">
            A platform as serious as
            <br />
            <span className="italic">the moment it serves.</span>
          </h2>
        </div>

        {/* FIX: 1 col mobile, 2 cols sm, 3 cols lg */}
        <div className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="reveal group relative p-6 sm:p-7 rounded-2xl bg-card border border-border hover:border-gold/50 hover:shadow-[var(--shadow-gold)] transition-all duration-500 overflow-hidden"
              style={{ transitionDelay: `${(i % 3) * 80}ms` }}
            >
              <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gold/0 group-hover:bg-gold/10 blur-2xl transition-all duration-700" />
              <div className="relative">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-ink text-gold group-hover:scale-110 transition-transform">
                  <f.icon size={20} />
                </div>
                <h3 className="mt-5 font-display text-lg sm:text-xl">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
