"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import {
  Key,
  ShieldCheck,
  Sparkles,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Lock,
  Copy,
  Check,
  User,
  Mail,
} from "lucide-react";

function VerifyKeyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, token, isLoading: isAuthLoading, login } = useAuth();

  const claimToken = searchParams.get("claim") || "";
  const [isValidating, setIsValidating] = useState(!!claimToken);
  const [claimData, setClaimData] = useState<any>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  const [manualKey, setManualKey] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const [activateSuccess, setActivateSuccess] = useState<any>(null);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Inline Quick Auth state (if user is not logged in)
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);


  // 1. Origin bridge: If redirected to 127.0.0.1, immediately redirect to localhost
  // so the user's session, watchlist, cookies, and local storage remain unified.
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hostname === "127.0.0.1") {
      const target = window.location.href
        .replace("//127.0.0.1:3000", "//localhost:3000")
        .replace("//127.0.0.1", "//localhost");
      window.location.replace(target);
    }
  }, []);

  // 2. Validate and auto-activate claim token
  useEffect(() => {
    if (!claimToken) {
      setIsValidating(false);
      return;
    }

    setIsValidating(true);
    setClaimError(null);

    // Fetch claim endpoint (server auto-activates for user if known)
    fetch(`/api/keys/claim?claim=${encodeURIComponent(claimToken)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (data.valid || data.success) {
          setClaimData(data);
          if (data.status === "used" || data.already_active || data.activated) {
            setActivateSuccess({
              already_active: !!data.already_active,
              key_code: data.key_code,
              duration_hours: data.duration_hours || 48,
              expires_at: data.expires_at,
            });
          }
        } else {
          setClaimError(data.error || "Invalid or expired verification claim link.");
        }
      })
      .catch(() => {
        setClaimError("Failed to connect to verification server. Please refresh.");
      })
      .finally(() => {
        setIsValidating(false);
      });
  }, [claimToken]);

  // 3. Auto-Activate key once user and valid pending claim are ready
  useEffect(() => {
    if (
      user &&
      claimToken &&
      claimData &&
      claimData.valid &&
      claimData.status === "pending" &&
      !isActivating &&
      !activateSuccess &&
      !activateError
    ) {
      handleClaimActivate();
    }
  }, [user, claimData, claimToken, isActivating, activateSuccess, activateError]);

  // Claim & Activate
  const handleClaimActivate = async (forcedToken?: string) => {
    const activeAuthToken = forcedToken || token;
    if (!claimToken) return;

    setIsActivating(true);
    setActivateError(null);

    try {
      const res = await fetch("/api/keys/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(activeAuthToken ? { Authorization: `Bearer ${activeAuthToken}` } : {}),
        },
        body: JSON.stringify({ claim_token: claimToken }),
      });

      const data = await res.json();
      if (res.ok && (data.success || data.valid)) {
        setActivateSuccess(data);
      } else {
        setActivateError(data.error || "Failed to activate access key.");
      }
    } catch (err: any) {
      setActivateError(err.message || "Network error while activating key.");
    } finally {
      setIsActivating(false);
    }
  };

  // Inline Quick Login / Signup
  const handleQuickAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    try {
      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        authMode === "login"
          ? { emailOrUsername: authUsername, password: authPassword }
          : { username: authUsername, email: authEmail, password: authPassword };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || `Failed to ${authMode}. Please try again.`);
        setAuthLoading(false);
        return;
      }

      // Log user in
      login(data.token, data.user);
      setAuthLoading(false);

      // Immediately activate the pending key for this newly logged-in user
      if (claimToken) {
        handleClaimActivate(data.token);
      }
    } catch (err: any) {
      setAuthError("Network error. Please try again.");
      setAuthLoading(false);
    }
  };

  // Manual key redemption
  const handleManualRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = manualKey.trim().toUpperCase();
    if (!cleanKey) return;

    if (!user) {
      setActivateError("Please log in to your account first to redeem a key.");
      return;
    }

    setIsActivating(true);
    setActivateError(null);

    try {
      const res = await fetch("/api/keys/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ key_code: cleanKey }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActivateSuccess(data);
      } else {
        setActivateError(data.error || "Failed to redeem key code.");
      }
    } catch (err: any) {
      setActivateError(err.message || "Network error while redeeming key.");
    } finally {
      setIsActivating(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12 md:py-16">
      {/* Header Badge */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-4 shadow-lg shadow-amber-500/5">
          <Sparkles className="w-3.5 h-3.5" /> 48-Hour Video Access Pass
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          Unlock Unlimited Anime
        </h1>
        <p className="text-sm text-neutral-400 mt-2 max-w-md mx-auto">
          Activate your verified pass to watch all episodes and movies with zero interruptions for 48 hours.
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* State 1: Activation Success (or already active) */}
        {activateSuccess ? (
          <div className="text-center py-4 space-y-6">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10 animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">
                {activateSuccess.already_active ? "48-Hour Pass is Active!" : "🎉 48-Hour Pass Activated!"}
              </h2>
              <p className="text-xs text-neutral-400 mt-1">
                Your account now has full unlocked access to all anime video players across the entire site.
              </p>
            </div>

            {activateSuccess.key_code && (
              <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
                <div className="text-left">
                  <div className="text-[11px] text-neutral-500 font-medium">YOUR ACCESS KEY</div>
                  <div className="text-lg font-mono font-bold text-amber-400 tracking-wider">
                    {activateSuccess.key_code}
                  </div>
                </div>
                <button
                  onClick={() => copyCode(activateSuccess.key_code)}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-amber-400/90 font-medium bg-amber-500/10 border border-amber-500/20 py-2 rounded-xl">
              <Clock className="w-4 h-4" />
              Valid for {activateSuccess.duration_hours || 48} Hours
            </div>

            <div className="pt-2">
              <Link
                href="/"
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-[0.98]"
              >
                🎬 Start Watching Anime Now <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : isValidating ? (
          /* State 2: Validating Claim */
          <div className="text-center py-10 space-y-4">
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
            <p className="text-sm text-neutral-300 font-medium">
              Verifying your completed shortener task...
            </p>
            <p className="text-xs text-neutral-500">Connecting to authentication server</p>
          </div>
        ) : claimToken && claimData ? (
          /* State 3: Claim Token Verified */
          <div className="space-y-6">
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-semibold text-emerald-300">Shortener Task Completed!</div>
                <div className="text-xs text-neutral-300 mt-0.5">
                  Your 48-Hour access token is verified and ready to activate.
                </div>
              </div>
            </div>

            {claimData.key_code && (
              <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-3.5 flex items-center justify-between">
                <span className="text-xs text-neutral-400">Generated Key:</span>
                <span className="font-mono text-sm font-bold text-amber-400">
                  {claimData.key_code}
                </span>
              </div>
            )}

            {activateError && (
              <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{activateError}</span>
              </div>
            )}

            {/* If user is NOT logged in: Provide instant inline Login / Signup */}
            {!user ? (
              <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-5 space-y-4">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-2">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white">Sign In to Activate Pass</h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Sign in or create a quick account below to bind this 48-Hour pass instantly:
                  </p>
                </div>

                {/* Tabs */}
                <div className="grid grid-cols-2 gap-2 bg-neutral-900 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError(null);
                    }}
                    className={`py-1.5 text-xs font-bold rounded-md transition ${
                      authMode === "login"
                        ? "bg-[#ff640a] text-white shadow"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    Quick Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signup");
                      setAuthError(null);
                    }}
                    className={`py-1.5 text-xs font-bold rounded-md transition ${
                      authMode === "signup"
                        ? "bg-[#ff640a] text-white shadow"
                        : "text-neutral-400 hover:text-white"
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {authError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{authError}</span>
                  </div>
                )}

                <form onSubmit={handleQuickAuth} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                      {authMode === "login" ? "Username or Email" : "Username"}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={authUsername}
                        onChange={(e) => setAuthUsername(e.target.value)}
                        placeholder={authMode === "login" ? "Your username or email" : "Choose a username"}
                        className="w-full bg-neutral-900 text-white text-xs rounded-lg pl-8 pr-3 py-2.5 outline-none border border-neutral-700 focus:border-[#ff640a]"
                      />
                      <User size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                    </div>
                  </div>

                  {authMode === "signup" && (
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                        Email Address
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          required
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="Your email address"
                          className="w-full bg-neutral-900 text-white text-xs rounded-lg pl-8 pr-3 py-2.5 outline-none border border-neutral-700 focus:border-[#ff640a]"
                        />
                        <Mail size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="Enter password"
                        className="w-full bg-neutral-900 text-white text-xs rounded-lg pl-8 pr-3 py-2.5 outline-none border border-neutral-700 focus:border-[#ff640a]"
                      />
                      <Lock size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full mt-2 py-2.5 rounded-lg bg-[#ff640a] hover:bg-[#e05300] text-white font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    {authLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {authMode === "login" ? "Sign In & Activate Key" : "Create Account & Activate"}
                  </button>
                </form>
              </div>
            ) : (
              /* If user IS logged in: Big manual button if not already auto-activated */
              <button
                onClick={() => handleClaimActivate()}
                disabled={isActivating}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-50 active:scale-[0.98]"
              >
                {isActivating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Activating Pass...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Activate 48-Hour Pass Now
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          /* State 4: Direct Visit or Manual Key Input */
          <div className="space-y-6">
            {claimError && (
              <div className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-3.5 text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{claimError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-2">
                Enter Your Access Key Code
              </label>
              <form onSubmit={handleManualRedeem} className="space-y-3">
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    value={manualKey}
                    onChange={(e) => setManualKey(e.target.value)}
                    placeholder="e.g. AZ-ABCD-1234"
                    className="w-full pl-10 pr-4 py-3 bg-neutral-950/70 border border-neutral-800 rounded-xl text-sm text-white placeholder:text-neutral-600 font-mono tracking-wider focus:outline-none focus:border-amber-500 transition"
                  />
                </div>

                {activateError && (
                  <div className="text-xs text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {activateError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isActivating || !manualKey.trim()}
                  className="w-full py-3 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
                >
                  {isActivating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Redeeming...
                    </>
                  ) : (
                    "Redeem Key Code"
                  )}
                </button>
              </form>
            </div>

            <div className="border-t border-neutral-800/80 pt-5 text-center">
              <p className="text-xs text-neutral-400 mb-3">
                Don&apos;t have a key code yet?
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium transition"
              >
                Go to any anime video and click &ldquo;Get Key&rdquo;
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Info / FAQ */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/60">
          <div className="text-xs font-semibold text-white flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> Single-Use Security
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            Each key is generated uniquely and bound to your account for exactly 48 hours. Keys cannot be reused or shared.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/60">
          <div className="text-xs font-semibold text-white flex items-center gap-2 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Want Ad-Free & No Keys?
          </div>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            VIP Members bypass all keys and ads forever, with direct 1080p downloads enabled.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyKeyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      }
    >
      <VerifyKeyContent />
    </Suspense>
  );
}
