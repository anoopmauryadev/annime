"use client";
import { useState } from "react";
import Link from "next/link";
import { Play, Search } from "lucide-react";

export default function EpisodeList({
  seasons,
  episodes,
  currentAnimeSlug,
  currentSeasonNum,
  currentEpNum,
}: {
  seasons: any[];
  episodes: any[];
  currentAnimeSlug: string;
  currentSeasonNum: number;
  currentEpNum: number;
}) {
  const [activeSeason, setActiveSeason] = useState(currentSeasonNum);
  const [searchFilter, setSearchFilter] = useState("");

  const filteredEpisodes = episodes
    .filter((e) => {
      const season = seasons.find((s) => s.id === e.season_id);
      return season && season.season_number === activeSeason;
    })
    .filter((e) => {
      if (!searchFilter.trim()) return true;
      const titleMatch = (e.title || "").toLowerCase().includes(searchFilter.toLowerCase());
      const numMatch = String(e.episode_number).includes(searchFilter);
      return titleMatch || numMatch;
    });

  return (
    <div className="bg-[#141519] rounded-xl border border-white/5 overflow-hidden flex flex-col h-[560px] shadow-2xl">
      {/* Header with Season Tabs */}
      <div className="p-4 border-b border-white/5 bg-[#18191f]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black text-white text-sm tracking-tight flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#ff640a] rounded-full"></span>
            Episodes
          </h3>
          <span className="text-[11px] text-gray-400 font-mono font-bold bg-white/5 px-2 py-0.5 rounded">
            {filteredEpisodes.length} Total
          </span>
        </div>

        {/* Season Tabs */}
        {seasons.length > 1 && (
          <div className="flex overflow-x-auto gap-1.5 hide-scrollbar pb-2 mb-2">
            {seasons.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSeason(s.season_number)}
                className={`px-3 py-1 text-xs font-bold rounded whitespace-nowrap transition-all ${
                  activeSeason === s.season_number
                    ? "bg-[#ff640a] text-white shadow-md shadow-[#ff640a]/30"
                    : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                {s.title || `Season ${s.season_number}`}
              </button>
            ))}
          </div>
        )}

        {/* Quick Episode Search Input */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter episode # or title..."
            className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#ff640a] transition-colors"
          />
        </div>
      </div>

      {/* Episode Item List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 hide-scrollbar">
        {filteredEpisodes.length === 0 ? (
          <div className="text-center py-10 text-xs text-gray-500">No episodes match your search.</div>
        ) : (
          filteredEpisodes.map((ep) => {
            const isCurrent = activeSeason === currentSeasonNum && ep.episode_number === currentEpNum;
            return (
              <Link
                key={ep.id}
                href={`/watch/${currentAnimeSlug}/${activeSeason}x${ep.episode_number}`}
                className={`flex items-center gap-3 p-2 rounded-lg transition-all group ${
                  isCurrent
                    ? "bg-[#ff640a]/15 border border-[#ff640a]/40 shadow-md shadow-[#ff640a]/10"
                    : "hover:bg-white/5 border border-transparent"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded shrink-0 flex items-center justify-center text-xs font-bold font-mono transition-colors ${
                    isCurrent
                      ? "bg-[#ff640a] text-white shadow-sm shadow-[#ff640a]/40"
                      : "bg-white/10 text-gray-300 group-hover:bg-white/20 group-hover:text-white"
                  }`}
                >
                  {isCurrent ? <Play fill="currentColor" size={12} /> : ep.episode_number}
                </div>

                <div className="flex-1 min-w-0">
                  <h4
                    className={`text-xs font-bold truncate transition-colors ${
                      isCurrent ? "text-[#ff8533]" : "text-gray-300 group-hover:text-white"
                    }`}
                  >
                    {ep.title || `Episode ${ep.episode_number}`}
                  </h4>
                  <span className="text-[10px] text-gray-500 block font-mono">
                    S{activeSeason}:E{ep.episode_number}
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
