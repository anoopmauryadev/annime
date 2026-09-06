"use client";
import Link from "next/link";
import AnimeCard from "./AnimeCard";
import { ChevronRight } from "lucide-react";

export default function AnimeSection({
  title,
  subtitle,
  animeList,
  viewMoreLink,
}: {
  title: string;
  subtitle?: string;
  animeList: any[];
  viewMoreLink?: string;
}) {
  if (!animeList || animeList.length === 0) return null;

  return (
    <section className="py-3">
      {/* Section Header */}
      <div className="flex items-end justify-between mb-3.5">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2.5 tracking-tight">
            <span className="w-1 h-5 bg-[#ff640a] rounded-full"></span>
            {title}
          </h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5 ml-3.5">{subtitle}</p>}
        </div>

        {viewMoreLink && (
          <Link
            href={viewMoreLink}
            className="text-xs font-bold text-[#ff640a] hover:text-[#ff8533] transition-colors flex items-center gap-0.5 uppercase tracking-wider shrink-0"
          >
            <span>View All</span>
            <ChevronRight size={16} />
          </Link>
        )}
      </div>

      {/* Scrollable Cards */}
      <div className="flex overflow-x-auto gap-3.5 md:gap-4 lg:gap-4.5 pb-2 hide-scrollbar snap-x">
        {animeList.map((anime) => (
          <div key={anime.id} className="w-[42vw] sm:w-[26vw] md:w-[19vw] lg:w-[14.5vw] shrink-0 snap-start">
            <AnimeCard anime={anime} />
          </div>
        ))}
      </div>
    </section>
  );
}
