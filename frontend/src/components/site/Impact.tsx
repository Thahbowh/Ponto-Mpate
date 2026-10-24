import { useEffect, useRef, useState } from "react";
import t1 from "@/assets/testimonial-1.jpg";
import t2 from "@/assets/testimonial-2.jpg";
import t3 from "@/assets/testimonial-3.jpg";
import { Quote, ChevronLeft, ChevronRight } from "lucide-react";

const stats = [
  { value: +200, suffix: "+", label: "Families helped" },
  { value: +34, suffix: "", label: "Active wards" },
  { value: 5, prefix: "R ", suffix: "K", label: "Contributions processed" },
  { value: 50, suffix: "%", label: "Member retention" },
];

const testimonials = [
  {
    img: t1,
    name: "Gogo Nomsa Motaung",
    role: "Ward 13, Bolata",
    quote:
      "When my brother passed, the ward was at my door before sunset. I have never felt so held by people I once only nodded to in the street.",
  },
  {
    img: t2,
    name: "Sipho Mahlangu",
    role: "Ward Treasurer, Mangaung",
    quote:
      "For the first time, I can show every member exactly where each rand goes. Ponto Mpate gave us the dignity of doing this work properly.",
  },
  {
    img: t3,
    name: "Lerato Mokoena",
    role: "Member, Ward 14, Theosane",
    quote:
      "My mother taught me ubuntu. This platform taught me how to scale it for our whole street, then our whole township.",
  },
];

function Counter({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        const start = performance.now();
        const dur = 1800;
        const tick = (now: number) => {
          const p = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setN(Math.floor(eased * value));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [value]);
  return <span ref={ref}>{prefix}{n.toLocaleString()}{suffix}</span>;
}

export function Impact() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % testimonials.length), 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="impact" className="relative py-20 md:py-36 bg-ink text-cream overflow-x-hidden noise">
      <div className="absolute bottom-0 right-0 h-[500px] w-[500px] bg-gold-deep/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-5">
        <div className="max-w-2xl reveal">
          <span className="text-xs tracking-widest uppercase text-gold font-medium">Community impact</span>
          <h2 className="mt-4 font-display text-3xl sm:text-4xl md:text-6xl leading-tight">
            Numbers tell part of it.
            <br />
            <span className="text-gold-gradient italic">People tell the rest.</span>
          </h2>
        </div>

        {/* FIX: stats grid — 2 cols on mobile, 4 cols md+ */}
        <div className="mt-12 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-cream/10 rounded-3xl overflow-hidden">
          {stats.map((s) => (
            <div key={s.label} className="bg-ink p-6 sm:p-8 md:p-10 reveal">
              <div className="font-display text-3xl sm:text-4xl md:text-5xl text-gold-gradient">
                <Counter value={s.value} prefix={s.prefix} suffix={s.suffix} />
              </div>
              <div className="mt-2 text-[10px] sm:text-xs uppercase tracking-widest text-cream/60">{s.label}</div>
            </div>
          ))}
        </div>

        {/* FIX: stack on mobile, side by side on lg */}
        <div className="mt-16 sm:mt-20 grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 items-center reveal">
          {/* FIX: square image — reasonable size on mobile */}
          <div className="lg:col-span-5 w-full max-w-sm mx-auto lg:max-w-none">
            <div className="relative aspect-square rounded-3xl overflow-hidden gold-border">
              {testimonials.map((t, idx) => (
                <img
                  key={t.name}
                  src={t.img}
                  alt={t.name}
                  width={512}
                  height={512}
                  loading="lazy"
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                    idx === i ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
            </div>
          </div>

          <div className="lg:col-span-7">
            <Quote size={36} className="text-gold mb-5 sm:mb-6" />
            {/* FIX: min-height reduced on mobile so it doesn't leave too much gap */}
            <div className="relative min-h-[200px] sm:min-h-[180px]">
              {testimonials.map((t, idx) => (
                <blockquote
                  key={t.name}
                  className={`absolute inset-0 transition-all duration-700 ${
                    idx === i ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
                  }`}
                >
                  <p className="font-display text-xl sm:text-2xl md:text-3xl leading-snug text-cream">
                    "{t.quote}"
                  </p>
                  <footer className="mt-5 sm:mt-6">
                    <div className="font-medium text-gold">{t.name}</div>
                    <div className="text-sm text-cream/60">{t.role}</div>
                  </footer>
                </blockquote>
              ))}
            </div>

            <div className="mt-8 sm:mt-10 flex items-center gap-4">
              <button
                onClick={() => setI((p) => (p - 1 + testimonials.length) % testimonials.length)}
                className="h-11 w-11 grid place-items-center rounded-full border border-cream/20 hover:border-gold hover:text-gold transition"
                aria-label="Previous"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setI((p) => (p + 1) % testimonials.length)}
                className="h-11 w-11 grid place-items-center rounded-full border border-cream/20 hover:border-gold hover:text-gold transition"
                aria-label="Next"
              >
                <ChevronRight size={18} />
              </button>
              <div className="flex gap-1.5 ml-2">
                {testimonials.map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-1 rounded-full transition-all ${
                      idx === i ? "w-8 bg-gold" : "w-2 bg-cream/30"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
