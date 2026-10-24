import { useEffect } from "react";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { LoadingState } from "@/components/ui/States";

export const Route = createFileRoute("/member")({
  component: MemberLayout,
});

const NAV = [
  { to: "/member", label: "Home" },
  { to: "/member/contributions", label: "Contributions" },
  { to: "/member/payments", label: "Payments" },
  { to: "/member/ward", label: "My ward" },
] as const;

function MemberLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/signin" });
    else if (user.role !== "MEMBER") navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  if (loading || !user || user.role !== "MEMBER") {
    return (
      <div className="grid min-h-screen place-items-center bg-stone-50">
        <LoadingState label={loading ? "Checking your session..." : "Redirecting..."} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-slate-900">
      <header className="bg-ink print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gold font-display text-lg font-semibold text-ink">
              P
            </span>
            <span className="font-display text-xl font-semibold text-cream">Ponto Mpate</span>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate({ to: "/signin" });
            }}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-cream/80 hover:bg-white/10"
          >
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
        <nav aria-label="Member" className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/member" }}
              className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-cream/80 hover:bg-white/10 data-[status=active]:bg-gold data-[status=active]:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
