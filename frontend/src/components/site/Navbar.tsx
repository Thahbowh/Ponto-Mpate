import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "@tanstack/react-router";

const links = [
  { href: "#trust", label: "Trust" },
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#impact", label: "Impact" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "py-3" : "py-5"
      }`}
    >
      {/* FIX: added overflow-hidden to prevent horizontal bleed */}
      <div className="mx-auto max-w-7xl px-4 sm:px-5 overflow-hidden">
        <nav
          className={`flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-500 ${
            scrolled ? "glass-dark shadow-[var(--shadow-glass)]" : ""
          }`}
        >
          <a href="#" className="flex items-center gap-2 group shrink-0">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--gradient-gold)] text-ink font-display text-lg font-semibold shadow-[var(--shadow-gold)]">
              P
            </span>
            <span className="font-display text-xl tracking-tight text-cream">
              Ponto <span className="text-gold-gradient">Mpate</span>
            </span>
          </a>

          <ul className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="text-sm text-cream/80 hover:text-gold transition-colors relative after:content-[''] after:absolute after:left-0 after:-bottom-1 after:h-px after:w-0 after:bg-gold after:transition-all hover:after:w-full"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/signin" className="text-sm text-cream/80 hover:text-gold transition-colors">
              Sign in
            </Link>
            <Link
              to="/signin"
              search={{ mode: "signup" }}
              className="btn-gold px-5 py-2.5 rounded-full text-sm"
              >
              Join your ward
            </Link>
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="md:hidden text-cream p-1"
            aria-label="Toggle menu"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </nav>

        {open && (
          <div className="md:hidden mt-2 glass-dark rounded-2xl p-6 animate-fade-up">
            <ul className="flex flex-col gap-4">
              {links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="text-cream/90 hover:text-gold text-lg"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li className="pt-3 border-t border-gold/20 flex flex-col gap-3">
                <Link to="/signin" className="text-cream/80 hover:text-gold text-base transition-colors">
                  Sign in
                </Link>
                <Link
                  to="/signin"
                    search={{ mode: "signup" }}
                    className="btn-gold inline-block px-5 py-2.5 rounded-full text-sm text-center"
                    >
                    Join your ward
                </Link>
              </li>
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}
