"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Lock, Mail, User, AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

function SignupForm() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create account. Please try again.");
        setLoading(false);
        return;
      }

      login(data.token, data.user);
      window.location.href = redirectUrl;
    } catch (err: any) {
      setError("Network error. Please check your connection.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-[#141519] p-6 sm:p-8 rounded-2xl shadow-2xl">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-1 mb-3">
            <span className="text-3xl font-black text-white">Anime</span>
            <span className="text-3xl font-black text-[#ff640a]">Zone</span>
          </Link>
          <h1 className="text-xl font-bold text-white">Create Your Account</h1>
          <p className="text-xs text-gray-400 mt-1">Join Anime Zone to watch in multi-audio HD</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-xs text-red-400">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username (e.g. naruto99)"
                className="w-full bg-[#1e1e24] text-white text-sm rounded-lg pl-10 pr-4 py-2.5 outline-none focus:ring-1 focus:ring-[#ff640a] transition-all"
              />
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full bg-[#1e1e24] text-white text-sm rounded-lg pl-10 pr-4 py-2.5 outline-none focus:ring-1 focus:ring-[#ff640a] transition-all"
              />
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full bg-[#1e1e24] text-white text-sm rounded-lg pl-10 pr-4 py-2.5 outline-none focus:ring-1 focus:ring-[#ff640a] transition-all"
              />
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full bg-[#1e1e24] text-white text-sm rounded-lg pl-10 pr-4 py-2.5 outline-none focus:ring-1 focus:ring-[#ff640a] transition-all"
              />
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[#ff640a] hover:bg-[#e05300] text-white font-bold py-2.5 px-4 rounded-lg text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Create Account"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-white/5 text-center text-xs text-gray-400">
          <span>Already have an account? </span>
          <Link
            href={`/login${redirectUrl !== "/" ? `?redirect=${encodeURIComponent(redirectUrl)}` : ""}`}
            className="text-[#ff640a] font-bold hover:underline"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[85vh] flex items-center justify-center">
          <Loader2 className="animate-spin text-[#ff640a]" size={32} />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
