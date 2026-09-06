"use client";

import { useState, useEffect } from "react";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface BookmarkButtonProps {
  animeId: number;
  initialBookmarked?: boolean;
  variant?: "icon" | "pill";
  className?: string;
  onToggle?: (bookmarked: boolean) => void;
}

export default function BookmarkButton({
  animeId,
  initialBookmarked = false,
  variant = "icon",
  className = "",
  onToggle,
}: BookmarkButtonProps) {
  const { user, token } = useAuth();
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !animeId) return;

    let mounted = true;
    const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(`/api/bookmarks?anime_id=${animeId}`, {
      headers: authHeaders,
    })
      .then((res) => res.json())
      .then((data) => {
        if (mounted && typeof data.bookmarked === "boolean") {
          setBookmarked(data.bookmarked);
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [animeId, user, token]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push("/login");
      return;
    }

    if (loading) return;
    setLoading(true);

    const nextState = !bookmarked;
    setBookmarked(nextState);

    try {
      const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      if (nextState) {
        const res = await fetch("/api/bookmarks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({ anime_id: animeId }),
        });
        if (!res.ok) throw new Error("Failed to save bookmark");
      } else {
        const res = await fetch(`/api/bookmarks?anime_id=${animeId}`, {
          method: "DELETE",
          headers: authHeaders,
        });
        if (!res.ok) throw new Error("Failed to remove bookmark");
      }
      onToggle?.(nextState);
    } catch {
      // Revert on failure
      setBookmarked(!nextState);
    } finally {
      setLoading(false);
    }
  };

  if (variant === "pill") {
    return (
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md ${
          bookmarked
            ? "bg-[#ff640a]/20 border border-[#ff640a] text-[#ff640a] hover:bg-[#ff640a]/30"
            : "bg-[#1e1e24] hover:bg-[#282830] border border-white/10 text-white"
        } ${className}`}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin text-[#ff640a]" />
        ) : bookmarked ? (
          <BookmarkCheck size={16} className="text-[#ff640a]" />
        ) : (
          <Bookmark size={16} />
        )}
        <span>{bookmarked ? "In Watchlist" : "Add to Watchlist"}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={bookmarked ? "Remove from Watchlist" : "Add to Watchlist"}
      className={`p-1.5 rounded-full backdrop-blur-md transition-transform hover:scale-110 ${
        bookmarked
          ? "bg-[#ff640a] text-white shadow-lg shadow-[#ff640a]/30"
          : "bg-black/60 hover:bg-black/80 text-white/80 hover:text-white"
      } ${className}`}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : bookmarked ? (
        <BookmarkCheck size={14} />
      ) : (
        <Bookmark size={14} />
      )}
    </button>
  );
}
