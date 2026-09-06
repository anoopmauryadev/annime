import { getAllAnime, getTotalAnimeCount } from "@/lib/db";
import AnimeCard from "@/components/AnimeCard";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default async function SeriesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  const animeList = getAllAnime({ type: 'series', sort: 'latest', limit, offset });
  const total = getTotalAnimeCount({ type: 'series' });
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
        <h1 className="text-3xl font-black text-white">All Series</h1>
        <span className="bg-white/10 text-gray-300 px-2 py-1 rounded text-sm font-bold">{total} Results</span>
      </div>

      {animeList.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {animeList.map(anime => (
            <AnimeCard key={anime.id} anime={anime} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-400">No series found.</div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-12">
          {page > 1 && (
            <Link href={`/series?page=${page - 1}`} className="p-2 bg-[#1a1a2e] hover:bg-violet-600 rounded-lg text-white transition-colors">
              <ChevronLeft size={20} />
            </Link>
          )}
          
          <div className="flex gap-1">
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const p = page > 3 && totalPages > 5 ? page - 2 + i : i + 1;
              if (p > totalPages) return null;
              return (
                <Link 
                  key={p} 
                  href={`/series?page=${p}`}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg font-bold transition-colors ${page === p ? 'bg-violet-600 text-white' : 'bg-[#1a1a2e] text-gray-400 hover:bg-white/10 hover:text-white'}`}
                >
                  {p}
                </Link>
              );
            })}
          </div>

          {page < totalPages && (
            <Link href={`/series?page=${page + 1}`} className="p-2 bg-[#1a1a2e] hover:bg-violet-600 rounded-lg text-white transition-colors">
              <ChevronRight size={20} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
