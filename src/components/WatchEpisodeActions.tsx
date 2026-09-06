"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import ReportModal from "@/components/ReportModal";
import BookmarkButton from "@/components/BookmarkButton";

interface WatchEpisodeActionsProps {
  anime: {
    id: number;
    title: string;
    slug: string;
    type: string;
  };
  seasonNum: number;
  epNum: number;
  currentEp: {
    id: number;
    title?: string;
  };
  prevEp: { episode_number: number } | null;
  nextEp: { episode_number: number } | null;
  servers: any[];
}

export default function WatchEpisodeActions({
  anime,
  seasonNum,
  epNum,
  currentEp,
  prevEp,
  nextEp,
  servers,
}: WatchEpisodeActionsProps) {
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#141519] p-4 sm:p-5 rounded-xl border border-white/5 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-[#ff640a] text-white font-black text-[10px] px-2 py-0.5 rounded uppercase">
              {anime.type}
            </span>
            <span className="text-xs text-[#ff640a] font-mono font-bold">
              S{seasonNum}:E{epNum}
            </span>
          </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-black text-white">
            {anime.title}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {currentEp.title || `Episode ${epNum}`}
          </p>
        </div>

        {/* Action Buttons: Prev/Next, Bookmark, Report */}
        <div className="flex items-center flex-wrap gap-2 self-start sm:self-center shrink-0">
          {/* Bookmark Button */}
          <BookmarkButton animeId={anime.id} />

          {/* Report Issue Button */}
          <button
            onClick={() => setReportOpen(true)}
            title="Report video or audio issue"
            className="flex items-center gap-1.5 bg-[#1e1e24] hover:bg-red-500/20 hover:border-red-500/40 border border-white/10 text-gray-300 hover:text-red-400 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
          >
            <Flag size={13} />
            <span className="hidden md:inline">Report Issue</span>
          </button>

          {/* Prev Episode */}
          {prevEp ? (
            <Link
              href={`/watch/${anime.slug}/${seasonNum}x${prevEp.episode_number}`}
              className="flex items-center gap-1.5 bg-[#1e1e24] hover:bg-[#282830] border border-white/10 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-md"
            >
              <ChevronLeft size={16} /> Previous
            </Link>
          ) : (
            <button
              disabled
              className="flex items-center gap-1.5 bg-white/5 border border-white/5 text-gray-600 px-3.5 py-2 rounded-lg text-xs font-bold cursor-not-allowed opacity-50"
            >
              <ChevronLeft size={16} /> Previous
            </button>
          )}

          {/* Next Episode */}
          {nextEp ? (
            <Link
              href={`/watch/${anime.slug}/${seasonNum}x${nextEp.episode_number}`}
              className="flex items-center gap-1.5 bg-[#ff640a] hover:bg-[#e05300] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-[#ff640a]/20"
            >
              Next <ChevronRight size={16} />
            </Link>
          ) : (
            <button
              disabled
              className="flex items-center gap-1.5 bg-white/5 border border-white/5 text-gray-600 px-4 py-2 rounded-lg text-xs font-bold cursor-not-allowed opacity-50"
            >
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Report Modal */}
      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        episodeId={currentEp.id}
        servers={servers}
      />
    </>
  );
}
