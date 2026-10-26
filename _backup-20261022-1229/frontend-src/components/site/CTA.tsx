import { ArrowRight } from "lucide-react";
import gold from "@/assets/gold-texture.jpg";

export function CTA() {
  return (
    <section id="cta" className="relative py-20 md:py-36 bg-cream overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-5">
        <div className="relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] bg-ink text-cream shadow-[var(--shadow-luxe)] noise">
          <img
            src={gold}
            alt=""
            width={1920}
            height={1080}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-30"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink/80 to-ink/95" />
          {/* FIX: orb kept inside with pointer-events-none so it doesn't cause scroll */}
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-gold/30 blur-[100px] animate-glow pointer-events-none" />

          {/* FIX: tighter padding on mobile */}
          <div className="relative px-6 sm:px-12 md:px-20 py-16 sm:py-20 md:py-28 text-center max-w-3xl mx-auto reveal">
            <span className="text-xs tracking-widest uppercase text-gold">
              The next funeral your ward witnesses
            </span>
            {/* FIX: heading scales down on small screens */}
            <h2 className="mt-5 sm:mt-6 font-display text-3xl sm:text-4xl md:text-6xl lg:text-7xl leading-[1.05]">
              Will your community
              <br />
              <span className="text-gold-gradient italic">be ready?</span>
            </h2>
            <p className="mt-6 sm:mt-8 text-base sm:text-lg text-cream/75 max-w-xl mx-auto leading-relaxed">
              Join 5,000+ South Africans who refuse to let grief be borne alone.
              Onboard your ward today, your future self will thank you.
            </p>

            {/* FIX: stacks on mobile, row from sm */}
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              <a
                href="#"
                className="btn-gold group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-base"
              >
                Start your ward
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="#"
                className="inline-flex items-center justify-center px-8 py-4 rounded-full text-base border border-cream/20 hover:border-gold hover:text-gold transition-all"
              >
                Talk to our team
              </a>
            </div>

            <div className="mt-8 sm:mt-10 text-xs uppercase tracking-widest text-cream/40">
              No setup fees · Cancel any time · 30-day pilot
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
