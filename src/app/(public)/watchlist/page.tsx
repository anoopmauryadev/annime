"use client";

import { useState, useEffect } from "react";
import { Bookmark, Film, Loader2, ArrowRight, LogIn } from "lucide-react";
import Link from "next/link";
import AnimeCard from "@/components/AnimeCard";
import { useAuth } from "@/context/AuthContext";

export default function WatchlistPage() {
  const { user, token, isLoading } = useAuth();
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    fetch("/api/bookmarks", { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => {
        setBookmarks(Array.isArray(data) ? data : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, token, isLoading]);

  return (
    <div className="min-h-screen bg-[#000000] pt-6 pb-20">
      <div className="container mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#ff640a]/10 border border-[#ff640a]/20 text-[#ff640a] rounded-xl">
              <Bookmark size={24} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">My Watchlist</h1>
              <p className="text-xs sm:text-sm text-gray-400">
                Anime and movies saved to your personal queue
              </p>
            </div>
          </div>
          {bookmarks.length > 0 && (
            <span className="text-xs bg-[#141519] border border-white/10 text-gray-300 font-bold px-3 py-1.5 rounded-lg self-start sm:self-center">
              {bookmarks.length} {bookmarks.length === 1 ? "Title" : "Titles"} Saved
            </span>
          )}
        </div>

        {/* Auth Loading / Content */}
        {isLoading || loading ? (
          <div className="py-24 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
            <Loader2 size={24} className="animate-spin text-[#ff640a]" />
            <p className="text-xs">Loading your watchlist...</p>
          </div>
        ) : !user ? (
          /* Not Logged In Prompt */
          <div className="max-w-md mx-auto my-16 bg-[#141519] border border-white/10 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-[#ff640a]/10 text-[#ff640a] flex items-center justify-center mx-auto">
              <LogIn size={28} />
            </div>
            <h2 className="text-xl font-bold text-white">Sign In to View Watchlist</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Create an account or sign in to save anime, track your watch history, and sync across all your devices.
            </p>
            <div className="pt-2 flex gap-3 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-[#ff640a] hover:bg-[#e05300] text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-colors shadow-lg shadow-[#ff640a]/20"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-[#1e1e24] hover:bg-[#282830] text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-colors border border-white/10"
              >
                Create Account
              </Link>
            </div>
          </div>
        ) : bookmarks.length === 0 ? (
          /* Empty Watchlist */
          <div className="max-w-md mx-auto my-16 bg-[#141519]/50 border border-white/5 rounded-2xl p-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-white/5 text-gray-500 flex items-center justify-center mx-auto text-3xl">
              🍿
            </div>
            <h2 className="text-lg font-bold text-white">Your Watchlist is Empty</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              You haven&apos;t saved any anime yet. Browse trending series or movies and tap the bookmark button to add them here.
            </p>
            <div className="pt-2 flex gap-3 justify-center">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 bg-[#ff640a] hover:bg-[#e05300] text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-colors shadow-md"
              >
                Explore Trending <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ) : (
          /* Anime Grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
            {bookmarks.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
