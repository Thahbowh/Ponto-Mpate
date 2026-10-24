import { useState } from "react";
import { Eye, EyeOff, ArrowRight, Phone } from "lucide-react";
import { getRouteApi } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/AuthContext";
import { ApiError } from "@/lib/api";

type Mode = "signin" | "signup" | "phone";
const routeApi = getRouteApi("/signin");

export function SignIn() {
  const { mode: modeFromUrl } = routeApi.useSearch();
  const [mode, setMode] = useState<Mode>(modeFromUrl ?? "signin");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const clearMessages = () => { setError(""); setSuccess(""); };

    async function handleSignUp() {
    clearMessages();
    if (fullName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    if (password.length < 10) {
      setError("Please choose a password of at least 10 characters.");
      return;
    }
    setLoading(true);
    try {
      await register(fullName.trim(), email.trim(), password);
      navigate({ to: "/member" });
    } catch (err) {
      if (err instanceof ApiError) {
        const first = err.details?.[0];
        setError(first ? first.message : err.message);
      } else {
        setError("Could not create your account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }
  async function handleSignIn() {
    clearMessages();
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const signedIn = await login(email.trim(), password);
      navigate({ to: signedIn.role === "MEMBER" ? "/member" : "/dashboard" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Temporary handler until the Ponto Mpate backend is ready.
  function handleNotConnected() {
    clearMessages();
    setLoading(false);
    setError(
      "Authentication is not connected yet. Please try again when the Ponto Mpate backend is ready."
    );
  }


  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4 py-12 noise">
      {/* Background orbs */}
      <div className="fixed top-0 left-0 h-96 w-96 rounded-full bg-gold/10 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-0 right-0 h-96 w-96 rounded-full bg-gold-deep/10 blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 justify-center mb-10">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-gold text-ink font-display text-lg font-semibold shadow-[var(--shadow-gold)]">
          P
        </span>
        <span className="font-display text-2xl font-semibold text-cream">
          Ponto <span className="text-gold-gradient">Mpate</span>
        </span>
        </a>

        {/* Card */}
        <div className="gold-border rounded-3xl p-8 sm:p-10 bg-ink shadow-[var(--shadow-luxe)]">

          {/* Mode tabs */}
          <div className="flex gap-1 p-1 rounded-full bg-base/5 mb-8">
            {(["signin", "signup", "phone"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); clearMessages(); setOtpSent(false); }}
                className={`flex-1 py-2 rounded-full text-sm font-medium transition-all ${
                mode === m
                ? "bg-gold text-ink shadow-[var(--shadow-gold)]"
                : "border border-gold text-bold/60 hover:text-gold"
                }`}
                >
               {m === "signin" ? "Sign in" : m === "signup" ? "Sign up" : "Phone"}
              </button>
            ))}
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="font-display text-3xl text-base leading-tight">
              {mode === "signin" && "Welcome back"}
              {mode === "signup" && "Join your ward"}
              {mode === "phone" && "Sign in with phone"}
            </h1>
            <p className="mt-2 text-sm text-bold/60">
              {mode === "signin" && "Sign in to your Ponto Mpate account"}
              {mode === "signup" && "Create your account and connect with your community"}
              {mode === "phone" && "We'll send a one-time code to your number"}
            </p>
          </div>

          {/* ── EMAIL / PASSWORD FORMS ── */}
          {(mode === "signin" || mode === "signup") && (
            <div className="flex flex-col gap-4">

              {/* Full name — signup only */}
              {mode === "signup" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs uppercase tracking-widest text-base/30">Full name</label>
                  <input
                    type="text"
                    placeholder="Nomsa Dlamini"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-cream/5 border border-gold/40 rounded-xl px-4 py-3 text-ink placeholder:text-cream/30 text-sm outline-none focus:border-gold transition-colors"
                  />
                </div>
              )}

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-widest text-base/30">Email</label>
                <input
                  type="email"
                  placeholder="you@community.co.za"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-cream/5 border border-gold/40 rounded-xl px-4 py-3 text-ink placeholder:text-cream/30 text-sm outline-none focus:border-gold transition-colors"
                />
              </div>

              {/* Phone — signup only */}
              {mode === "signup" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs uppercase tracking-widest text-base/30">Phone number</label>
                  <input
                    type="tel"
                    placeholder="+27821234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-cream/5 border border-gold/40 rounded-xl px-4 py-3 text-ink placeholder:text-cream/30 text-sm outline-none focus:border-gold transition-colors"
                  />
                </div>
              )}

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-widest text-base/30">Password</label>
                  {mode === "signin" && (
                    <button className="text-xs text-gold hover:text-gold-soft transition-colors">
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-cream/5 border border-gold/40 rounded-xl px-4 py-3 pr-11 text-ink placeholder:text-cream/30 text-sm outline-none focus:border-gold transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-cream/40 hover:text-cream transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error / Success */}
              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-xl bg-gold/10 border border-gold/20 px-4 py-3 text-sm text-gold">
                  {success}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={mode === "signin" ? handleSignIn : handleSignUp}
                disabled={loading}
                className="btn-gold group w-full flex items-center justify-center gap-2 py-4 rounded-full text-base mt-2 disabled:opacity-60"
              >
                {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
                {!loading && <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-cream/10" />
                <span className="text-xs text-cream/30 uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-cream/10" />
              </div>

              {/* Google */}
              <button
                onClick={handleNotConnected}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-full border border-cream/15 text-base/80 hover:border-gold hover:text-black transition-all text-sm"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                "Sign-up, phone and Google sign-in are not available in this prototype. Please sign in with an administrator email and password."
              </button>
            </div>
          )}

          {/* ── PHONE OTP FORM ── */}
          {mode === "phone" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-widest text-cream/50">Phone number</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-base/40" />
                  <input
                    type="tel"
                    placeholder="+27821234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={otpSent}
                     className="w-full bg-cream/5 border border-gold/40 rounded-xl px-4 py-3 pr-11 text-ink placeholder:text-cream/30 text-sm outline-none focus:border-gold transition-colors"
                  />
                </div>
              </div>

              {otpSent && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs uppercase tracking-widest text-cream/50">Enter OTP code</label>
                  <input
                    type="text"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    className="w-full bg-cream/5 border border-cream/10 rounded-xl px-4 py-3 text-ink placeholder:text-cream/30 text-sm outline-none focus:border-gold transition-colors tracking-[0.5em] text-center text-lg"
                  />
                </div>
              )}

              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-xl bg-gold/10 border border-gold/20 px-4 py-3 text-sm text-gold">
                  {success}
                </div>
              )}

              <button
                onClick={handleNotConnected}
                disabled={loading}
                className="btn-gold group w-full flex items-center justify-center gap-2 py-4 rounded-full text-base mt-2 disabled:opacity-60"
              >
                {loading ? "Please wait..." : otpSent ? "Verify OTP" : "Send OTP"}
                {!loading && <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />}
              </button>

              {otpSent && (
                <button
                  onClick={() => { setOtpSent(false); setOtp(""); clearMessages(); }}
                  className="text-xs text-cream/40 hover:text-cream transition-colors text-center"
                >
                  Change number
                </button>
              )}
            </div>
          )}

          {/* Bottom link */}
          <p className="mt-8 text-center text-sm text-base/60">
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); clearMessages(); }}
              className="font-semibold text-gold-deep hover:text-gold transition-colors"
              >
             {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-xs text-cream/30 leading-relaxed">
          By continuing you agree to our Terms of Service and Privacy Policy.
          <br />POPIA compliant · Your data stays in South Africa.
        </p>
      </div>
    </div>
  );
}
