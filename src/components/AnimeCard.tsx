"use client";
import Link from "next/link";
import { Play } from "lucide-react";
import BookmarkButton from "@/components/BookmarkButton";

export default function AnimeCard({ anime }: { anime: any }) {
  const parseJsonStr = (str: string) => { 
    try { return JSON.parse(str); } catch { return []; } 
  };
  const languages = parseJsonStr(anime.languages || "[]");

  const defaultPoster = "https://m.media-amazon.com/images/M/MV5BN2QyZGU1NWUtNWY2OC00Y2U3LTliMmEtNTE1MmM2NzU1Yzg5XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg";

  return (
    <div className="group flex flex-col gap-2 w-full select-none">
      <Link href={`/anime/${anime.slug}`} className="relative rounded-lg overflow-hidden aspect-[2/3] bg-[#141519] block shadow-md">
        <img 
          src={anime.poster || defaultPoster} 
          alt={anime.title} 
          onError={(e) => { e.currentTarget.src = defaultPoster; }}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
        />
        
        {/* Top Badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1">
          {anime.quality && (
            <span className="bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">{anime.quality}</span>
          )}
        </div>
        
        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
          <BookmarkButton animeId={anime.id} />
          <span className="bg-[#ff640a] text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">{anime.type}</span>
        </div>

        {/* Play Overlay */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-[#ff640a] p-3 rounded-full text-white shadow-xl transform scale-75 group-hover:scale-100 transition-transform">
            <Play fill="currentColor" size={20} className="ml-0.5" />
          </div>
        </div>

        {/* Bottom Audio Tags */}
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-wrap gap-1">
          {languages.slice(0, 3).map((lang: string, idx: number) => (
            <span key={idx} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-gray-200 backdrop-blur-sm">{lang}</span>
          ))}
        </div>
      </Link>
      
      {/* Title & Metadata below poster */}
      <div className="flex flex-col gap-0.5">
        <Link href={`/anime/${anime.slug}`} className="font-bold text-white text-sm line-clamp-2 hover:text-[#ff640a] transition-colors leading-snug">
          {anime.title}
        </Link>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {anime.year && <span>{anime.year}</span>}
          {anime.rating && <span>• ★ {anime.rating}</span>}
        </div>
      </div>
    </div>
  );
}
