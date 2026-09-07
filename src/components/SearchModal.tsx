"use client";
import { useState, useEffect, useRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SearchModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onOpen = () => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 100); };
    window.addEventListener("open-search-modal", onOpen);
    return () => window.removeEventListener("open-search-modal", onOpen);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/anime?search=${encodeURIComponent(query)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data : (data.data || []));
        }
      } catch (err) {}
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0f0f1a]/95 backdrop-blur-md p-4 sm:p-6 md:p-10">
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between mb-8">
        <div className="flex-1 relative flex items-center">
          <Search className="absolute left-4 text-gray-400" size={24} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search anime, series, movies..."
            className="w-full bg-[#1a1a2e] text-white text-lg sm:text-2xl rounded-full py-4 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-xl"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-4 p-1 text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          )}
        </div>
        <button onClick={() => setIsOpen(false)} className="ml-4 sm:ml-8 p-3 bg-white/5 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition-colors">
          <X size={28} />
        </button>
      </div>

      <div className="flex-1 w-full max-w-4xl mx-auto overflow-y-auto hide-scrollbar">
        {loading && <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-violet-500" size={32} /></div>}
        
        {!loading && query && results.length === 0 && (
          <div className="text-center text-gray-400 mt-10 text-lg">No results found for "{query}"</div>
        )}

        {!loading && results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-20">
            {results.map(anime => (
              <div 
                key={anime.id} 
                onClick={() => { setIsOpen(false); router.push(`/anime/${anime.slug}`); }}
                className="cursor-pointer group relative rounded-xl overflow-hidden bg-[#1a1a2e] transition-transform hover:scale-105"
              >
                <div className="aspect-[2/3] relative">
                  <img src={anime.poster || "/placeholder.jpg"} alt={anime.title} className="w-full h-full object-cover group-hover:brightness-110 transition-all" />
                  <div className="absolute top-2 right-2 bg-black/70 text-xs font-bold px-2 py-0.5 rounded text-white backdrop-blur-sm">
                    {anime.type === 'movie' ? 'Movie' : 'Series'}
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-sm text-white line-clamp-1 group-hover:text-violet-400 transition-colors">{anime.title}</h3>
                  <p className="text-xs text-gray-400 mt-1">{anime.year || "N/A"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
