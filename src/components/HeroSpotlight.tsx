"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Info, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

export default function HeroSpotlight() {
  const [spotlights, setSpotlights] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    fetch('/api/anime/spotlight')
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : (d.data || []);
        setSpotlights(list);
      })
      .catch(() => setSpotlights([]));
  }, []);

  useEffect(() => {
    if (spotlights.length <= 1) return;
    const t = setInterval(() => setCurrent(c => (c + 1) % spotlights.length), 6000);
    return () => clearInterval(t);
  }, [spotlights.length]);

  if (!spotlights.length) {
    return (
      <div className="relative w-full h-[45vh] md:h-[65vh] bg-gradient-to-r from-[#141519] via-[#0a0a0c] to-[#000000] flex items-center justify-center p-6">
        <div className="text-center max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff640a]/20 text-[#ff640a] text-xs font-semibold mb-4">
            <Sparkles size={14} /> Featured Anime
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-3">Watch Hindi & Multi-Audio Anime</h1>
          <p className="text-gray-400 text-sm md:text-base mb-6">
            Admin panel se kisi bhi anime ka Spotlight ON karein, wo yahan hero banner me display hoga.
          </p>
          <Link href="/admin/spotlight" className="inline-flex items-center gap-2 bg-[#ff640a] hover:bg-[#e05300] text-white font-bold py-2.5 px-6 rounded text-sm transition-transform hover:scale-105">
            Manage Spotlight
          </Link>
        </div>
      </div>
    );
  }

  const anime = spotlights[current] || spotlights[0];
  
  const parseJsonStr = (str: string) => { 
    try { return JSON.parse(str); } catch { return []; } 
  };
  const languages = parseJsonStr(anime.languages || "[]");

  const fallbackBackdrops = [
    "https://images.alphacoders.com/131/1312646.jpeg",
    "https://images.alphacoders.com/112/1126212.jpg",
    "https://images.alphacoders.com/605/605592.png",
  ];
  const bgImage = anime.backdrop || anime.poster || fallbackBackdrops[current % fallbackBackdrops.length];

  return (
    <div className="relative w-full h-[50vh] md:h-[70vh] bg-black overflow-hidden group">
      {/* Background Banner */}
      <img 
        src={bgImage} 
        alt={anime.title} 
        className="absolute inset-0 w-full h-full object-cover opacity-60 md:opacity-75 transition-all duration-1000 scale-105" 
      />
      
      {/* Crunchyroll Seamless Gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#000000] via-[#000000]/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#000000] via-[#000000]/80 to-transparent md:w-3/4" />
      
      {/* Content */}
      <div className="absolute inset-0 container mx-auto px-4 md:px-6 flex flex-col justify-end md:justify-center pb-8 md:pb-0 z-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold mb-2 uppercase tracking-wider text-[#ff640a]">
            <span>SPOTLIGHT #{current + 1}</span>
          </div>

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mb-3 line-clamp-2 md:line-clamp-none drop-shadow-lg">
            {anime.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-2 mb-4 text-xs font-semibold">
            <span className="bg-[#ff640a] text-white px-2 py-0.5 rounded font-bold uppercase">{anime.type}</span>
            <span className="bg-white/10 text-white px-2 py-0.5 rounded backdrop-blur-sm">{anime.quality || "HD"}</span>
            {languages.slice(0, 4).map((lang: string, i: number) => (
              <span key={i} className="bg-black/60 text-gray-200 px-2 py-0.5 rounded backdrop-blur-sm">
                {lang}
              </span>
            ))}
          </div>

          <p className="text-gray-300 text-sm md:text-base mb-6 line-clamp-3 md:line-clamp-4 max-w-xl">
            {anime.synopsis || "Watch the latest episodes in high definition with multi-audio dubs."}
          </p>
          
          <div className="flex items-center gap-3">
            <Link 
              href={`/anime/${anime.slug}`} 
              className="flex items-center gap-2 bg-[#ff640a] hover:bg-[#e05300] text-white font-bold py-3 px-6 md:px-8 rounded transition-all hover:scale-105 uppercase tracking-wide text-sm shadow-lg"
            >
              <Play fill="currentColor" size={16} /> Watch Now
            </Link>
            <Link 
              href={`/anime/${anime.slug}`} 
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-6 rounded backdrop-blur-sm transition-all text-sm uppercase tracking-wide"
            >
              <Info size={16} /> Details
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {spotlights.length > 1 && (
        <>
          <button 
            onClick={() => setCurrent(c => (c - 1 + spotlights.length) % spotlights.length)} 
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-[#ff640a] text-white rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all z-20 hidden md:block"
            aria-label="Previous slide"
          >
            <ChevronLeft size={24} />
          </button>
          <button 
            onClick={() => setCurrent(c => (c + 1) % spotlights.length)} 
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-[#ff640a] text-white rounded-full backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all z-20 hidden md:block"
            aria-label="Next slide"
          >
            <ChevronRight size={24} />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
            {spotlights.map((_, i) => (
              <button 
                key={i} 
                onClick={() => setCurrent(i)} 
                className={`h-1.5 rounded-full transition-all ${i === current ? 'bg-[#ff640a] w-6' : 'bg-white/30 hover:bg-white/50 w-2'}`} 
                aria-label={`Go to slide ${i + 1}`} 
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
