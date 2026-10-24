import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  HandCoins,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  Scale,
  Store,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { LoadingState } from "@/components/ui/States";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/events", label: "Funeral events", icon: CalendarDays },
  { to: "/households", label: "Households", icon: Users },
  { to: "/requests", label: "Join requests", icon: UserCheck },
  { to: "/vouchers", label: "Shop vouchers", icon: Store },
  { to: "/record", label: "Record contribution", icon: HandCoins },
  { to: "/reconciliation", label: "Reconciliation", icon: Scale },
  { to: "/insights", label: "Insights", icon: Lightbulb },
] as const;

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-gold font-display text-lg font-semibold text-ink">
        P
      </span>
      <span className="font-display text-xl font-semibold text-cream">Ponto Mpate</span>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-cream/80 transition-colors hover:bg-white/10 data-[status=active]:bg-gold data-[status=active]:text-ink"
        >
          <item.icon size={18} aria-hidden="true" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function AppLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/signin" });
    else if (user.role === "MEMBER") navigate({ to: "/member" });
  }, [loading, user, navigate]);

  if (loading || !user || user.role === "MEMBER") {
    return (
      <div className="grid min-h-screen place-items-center bg-stone-50">
        <LoadingState label={loading ? "Checking your session..." : "Redirecting..."} />
      </div>
    );
  }

  const signOut = () => {
    logout();
    navigate({ to: "/signin" });
  };

  const roleLabel = user.role === "ADMIN" ? "Administrator" : "Viewer (read only)";

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900 lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between bg-ink px-4 py-6 lg:sticky lg:top-0 lg:flex lg:h-screen print:hidden">
        <div className="space-y-8">
          <Logo />
          <NavLinks />
        </div>
        <div className="space-y-3 border-t border-white/10 pt-4">
          <div>
            <p className="text-sm font-semibold text-cream">{user.name}</p>
            <p className="text-xs text-cream/60">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-cream/80 hover:bg-white/10"
          >
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar and menu */}
      <div className="lg:hidden print:hidden">
        <div className="flex items-center justify-between bg-ink px-4 py-3">
          <Logo />
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="rounded-lg p-2 text-cream hover:bg-white/10"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen ? (
          <div className="space-y-4 bg-ink px-4 pb-4">
            <NavLinks onNavigate={() => setMenuOpen(false)} />
            <div className="border-t border-white/10 pt-3">
              <p className="text-sm font-semibold text-cream">{user.name}</p>
              <p className="text-xs text-cream/60">{roleLabel}</p>
              <button
                type="button"
                onClick={signOut}
                className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-cream/80 hover:bg-white/10"
              >
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

