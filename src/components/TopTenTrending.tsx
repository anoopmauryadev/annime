"use client";
import { useState } from "react";
import Link from "next/link";
import { Flame, Star, Play } from "lucide-react";

export default function TopTenTrending({ animeList }: { animeList: any[] }) {
  const [tab, setTab] = useState<"today" | "week" | "month">("today");

  const sortedList = [...animeList].slice(0, 10);

  const getRankColor = (index: number) => {
    if (index === 0) return "text-[#ff640a]";
    if (index === 1) return "text-[#ffa114]";
    if (index === 2) return "text-[#ffd000]";
    return "text-gray-500";
  };

  const parseJsonStr = (str: string) => {
    try { return JSON.parse(str); } catch { return []; }
  };

  if (!sortedList || sortedList.length === 0) return null;

  return (
    <div className="py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 bg-[#ff640a] rounded-full"></span>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            Top 10 Trending
          </h2>
        </div>

        {/* Period Tabs */}
        <div className="flex items-center bg-[#141519] p-1 rounded-lg self-start sm:self-auto">
          {(["today", "week", "month"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                tab === t
                  ? "bg-[#ff640a] text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Top 10 Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sortedList.map((anime, index) => {
          const languages = parseJsonStr(anime.languages || "[]");
          const rankNumber = String(index + 1).padStart(2, "0");

          return (
            <Link
              key={anime.id}
              href={`/anime/${anime.slug}`}
              className="group flex items-center gap-3 p-2 rounded-lg bg-[#141519] hover:bg-[#1e1e24] transition-all"
            >
              {/* Big Stylized Rank Number */}
              <div
                className={`w-10 text-center font-black text-2xl font-mono shrink-0 ${getRankColor(
                  index
                )}`}
              >
                {rankNumber}
              </div>

              {/* Poster Thumbnail */}
              <div className="relative w-12 h-16 shrink-0 rounded overflow-hidden bg-black/40">
                <img
                  src={anime.poster || "https://images.alphacoders.com/605/605592.png"}
                  alt={anime.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white group-hover:text-[#ff640a] transition-colors truncate">
                  {anime.title}
                </h3>
                
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                  <span className="capitalize font-semibold text-gray-300">{anime.type}</span>
                  <span>•</span>
                  <span className="flex items-center gap-0.5 text-amber-400 font-semibold">
                    <Star size={11} fill="currentColor" /> {anime.rating || "8.5"}
                  </span>
                </div>

                <div className="flex items-center gap-1 mt-1.5">
                  {languages.slice(0, 2).map((l: string, i: number) => (
                    <span
                      key={i}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/40 text-gray-300"
                    >
                      {l}
                    </span>
                  ))}
                  {anime.quality && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#ff640a]/20 text-[#ff8533]">
                      {anime.quality}
                    </span>
                  )}
                </div>
              </div>

              {/* Play CTA Icon */}
              <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-[#ff640a] flex items-center justify-center text-gray-400 group-hover:text-white transition-all shrink-0 mr-2">
                <Play size={13} fill="currentColor" className="ml-0.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
