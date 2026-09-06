"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface HistoryItem {
  id: number;
  anime_id: number;
  episode_id: number;
  progress_seconds: number;
  duration_seconds: number;
  updated_at: string;
  anime_title: string;
  anime_slug: string;
  anime_poster: string;
  anime_type: string;
  episode_number: number;
  episode_title?: string;
  season_number: number;
}

export default function ContinueWatching() {
  const { user, token } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    fetch("/api/history?limit=6", { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.history)) {
          setHistory(data.history);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, token]);

  if (!user || loading || history.length === 0) {
    return null;
  }

  const defaultPoster =
    "https://m.media-amazon.com/images/M/MV5BN2QyZGU1NWUtNWY2OC00Y2U3LTliMmEtNTE1MmM2NzU1Yzg5XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg";

  return (
    <section className="space-y-3.5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[#ff640a]/10 text-[#ff640a] rounded-lg border border-[#ff640a]/20">
            <Clock size={16} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              Continue Watching
            </h2>
            <p className="text-xs text-gray-400">Pick up right where you left off</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 sm:gap-4">
        {history.map((item) => {
          const duration = item.duration_seconds || 1;
          const progress = Math.min(
            100,
            Math.max(5, Math.round((item.progress_seconds / duration) * 100))
          );

          return (
            <Link
              key={item.id}
              href={`/watch/${item.anime_slug}/${item.season_number}x${item.episode_number}`}
              className="group relative rounded-xl overflow-hidden bg-[#141519] border border-white/5 hover:border-[#ff640a]/50 transition-all flex flex-col shadow-lg"
            >
              {/* Poster Container with Aspect Ratio */}
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/60">
                <img
                  src={item.anime_poster || defaultPoster}
                  alt={item.anime_title}
                  onError={(e) => {
                    e.currentTarget.src = defaultPoster;
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80 group-hover:opacity-100"
                />

                {/* Season & Episode Tag */}
                <div className="absolute top-2 left-2 bg-black/80 text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded backdrop-blur-sm border border-white/10">
                  S{item.season_number}:E{item.episode_number}
                </div>

                {/* Hover Play Button */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-[#ff640a] text-white flex items-center justify-center shadow-xl transform scale-75 group-hover:scale-100 transition-transform">
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                  </div>
                </div>

                {/* Progress Bar at Bottom of Image */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60">
                  <div
                    className="h-full bg-[#ff640a] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Title & Episode info */}
              <div className="p-2.5 space-y-0.5">
                <h3 className="text-xs font-bold text-white truncate group-hover:text-[#ff640a] transition-colors">
                  {item.anime_title}
                </h3>
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>Episode {item.episode_number}</span>
                  <span className="text-[#ff640a] font-medium">{progress}%</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
