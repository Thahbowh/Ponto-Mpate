import heroImg from "@/assets/hero-community.jpg";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function Hero() {
  return (
    // FIX: added overflow-x-hidden to stop orbs causing horizontal scroll
    <section className="relative min-h-screen overflow-x-hidden bg-ink text-cream noise">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={heroImg}
          alt="Community holding hands in solidarity"
          width={1920}
          height={1280}
          className="h-full w-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/60 to-ink" />
        <div className="absolute inset-0 bg-[var(--gradient-radial-gold)] opacity-60" />
      </div>

      {/* Floating gold orbs — clipped so they don't overflow on mobile */}
      <div className="absolute top-1/4 -left-20 h-72 w-72 rounded-full bg-gold/20 blur-3xl animate-float pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 h-96 w-96 rounded-full bg-gold-deep/20 blur-3xl animate-float [animation-delay:2s] pointer-events-none" />

      {/* FIX: tighter top padding on mobile so content isn't buried under navbar */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-5 pt-32 pb-20 sm:pt-40 sm:pb-24 md:pt-48 md:pb-32">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full glass-dark px-4 py-1.5 mb-6 sm:mb-8 animate-fade-in">
            <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse shrink-0" />
            {/* FIX: smaller text on very small screens */}
            <span className="text-[10px] sm:text-xs tracking-widest uppercase text-cream/90">
              Built for Qwaqwa communities
            </span>
          </div>

          {/* FIX: font scales down on small screens to prevent overflow */}
          <h1 className="font-display text-4xl sm:text-5xl md:text-7xl lg:text-8xl leading-[0.95] animate-fade-up">
            When loss comes,
            <br />
            <span className="text-gold-gradient italic">community arrives.</span>
          </h1>

          <p className="mt-6 sm:mt-8 max-w-2xl text-base sm:text-lg md:text-xl text-cream/75 leading-relaxed animate-fade-up [animation-delay:200ms]">
            Ponto Mpate is the modern ward based funeral support platform helping
            Qwaqwa families carry one another through grief with transparent
            contributions, instant activation, and the dignity every life deserves.
          </p>

          {/* FIX: buttons stack on mobile, side by side from sm up */}
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 animate-fade-up [animation-delay:400ms]">
            <Link
              to="/signin"
              search={{ mode: "signup" }}
              className="btn-gold group inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full text-base"
              >
              Join your ward
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full text-base border border-cream/20 text-cream hover:border-gold hover:text-gold transition-all"
            >
              See how it works
            </a>
          </div>

          {/* FIX: 2 cols on mobile, 4 cols from md up */}
          <div className="mt-12 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 animate-fade-up [animation-delay:600ms]">
            {[
              ["200+", "Families supported"],
              ["34", "Active wards"],
              ["R 5K", "Contributions processed"],
              ["24 hr", "Average activation"],
            ].map(([v, l]) => (
              <div key={l}>
                <div className="font-display text-2xl sm:text-3xl md:text-4xl text-gold-gradient">{v}</div>
                <div className="mt-1 text-[10px] sm:text-xs uppercase tracking-widest text-cream/60">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-cream/50 text-xs tracking-widest uppercase whitespace-nowrap">
        <ShieldCheck size={14} className="text-gold shrink-0" />
        FSCA-aligned · POPIA compliant
      </div>
    </section>
  );
}
