import { Mail } from "lucide-react";
import {
  FaFacebookF,
  FaInstagram,
  FaXTwitter,
  FaLinkedinIn,
} from "react-icons/fa6";

const cols = [
  {
    title: "Platform",
    links: ["How it works", "Features", "Wards", "Pricing", "Security"],
  },
  {
    title: "Community",
    links: ["Stories", "Ward directory", "Leaders", "Events", "Blog"],
  },
  {
    title: "Company",
    links: ["About", "Careers", "Partners", "Press", "Contact"],
  },
];

export function Footer() {
  return (
    <footer className="relative bg-ink text-cream pt-16 sm:pt-20 pb-10 noise overflow-x-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 sm:gap-12 pb-12 sm:pb-14 border-b border-cream/10">
          {/* Brand + newsletter */}
          <div className="lg:col-span-5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--gradient-gold)] text-ink font-display text-lg font-semibold shrink-0">
                P
              </span>
              <span className="font-display text-2xl">
                Ponto <span className="text-gold-gradient">Mpate</span>
              </span>
            </div>
            <p className="mt-5 text-cream/65 max-w-md leading-relaxed text-sm sm:text-base">
              A modern home for an ancient practice. Built in South Africa, for QWaQwa
              communities, so no family ever stands alone.
            </p>

            {/* FIX: email form is full-width on mobile */}
            <div className="mt-8 w-full max-w-md">
              <label className="text-xs uppercase tracking-widest text-cream/50">
                Stay close
              </label>
              <div className="mt-3 flex glass-dark rounded-full p-1.5">
                <Mail size={18} className="ml-3 self-center text-cream/50 shrink-0" />
                <input
                  type="email"
                  placeholder="you@community.co.za"
                  className="flex-1 min-w-0 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-cream/40"
                />
                <button
                  type="button"
                  className="btn-gold px-4 py-2 rounded-full text-sm shrink-0"
                >
                  Subscribe
                </button>
              </div>
            </div>
          </div>

          {/* FIX: nav cols — 3 equal columns even on mobile */}
          <div className="lg:col-span-7 grid grid-cols-3 gap-6 sm:gap-8">
            {cols.map((c) => (
              <div key={c.title}>
                <h4 className="font-display text-sm sm:text-base text-gold mb-3 sm:mb-4">{c.title}</h4>
                <ul className="space-y-2 sm:space-y-3">
                  {c.links.map((l) => (
                    <li key={l}>
                      <a href="#" className="text-xs sm:text-sm text-cream/70 hover:text-gold transition-colors">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* FIX: bottom bar stacks cleanly on mobile */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-5 sm:gap-6 text-center sm:text-left">
          <div className="text-xs text-cream/50">
            © {new Date().getFullYear()} Ponto Mpate (Pty) Ltd · Qwaqwa, South Africa
          </div>
          <div className="flex items-center gap-3">
            {[FaFacebookF, FaInstagram, FaXTwitter, FaLinkedinIn].map((Icon, i) => (
              <a
              key={i}
              href="#"
              className="h-10 w-10 grid place-items-center rounded-full border border-cream/15 text-cream/70 hover:border-gold hover:text-gold hover:-translate-y-0.5 transition-all"
              aria-label={["Facebook", "Instagram", "X", "LinkedIn"][i]}
              >
             <Icon size={16} />
             </a>
            ))}
          </div>
          <div className="flex gap-5 text-xs text-cream/50">
            <a href="#" className="hover:text-gold transition">Privacy</a>
            <a href="#" className="hover:text-gold transition">Terms</a>
            <a href="#" className="hover:text-gold transition">POPIA</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
