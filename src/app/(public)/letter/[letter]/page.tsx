import { getAllAnime, getTotalAnimeCount } from "@/lib/db";
import AnimeCard from "@/components/AnimeCard";
import Link from "next/link";
import AlphabetFilter from "@/components/AlphabetFilter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";

export default async function LetterPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ letter: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  
  const letter = resolvedParams.letter;
  if (!letter) notFound();

  const page = parseInt(resolvedSearchParams.page || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  const queryOpts = { letter: letter === '0-9' ? '0-9' : letter, sort: 'latest', limit, offset };
  const animeList = getAllAnime(queryOpts);
  const total = getTotalAnimeCount({ letter: letter === "0-9" ? "0-9" : letter });
  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <AlphabetFilter />
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
          <h1 className="text-3xl font-black text-white">Letter: {letter.toUpperCase()}</h1>
          <span className="bg-white/10 text-gray-300 px-2 py-1 rounded text-sm font-bold">{total} Results</span>
        </div>

        {animeList.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {animeList.map(anime => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-gray-400">No items found starting with '{letter}'.</div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-12">
            {page > 1 && (
              <Link href={`/letter/${letter}?page=${page - 1}`} className="p-2 bg-[#1a1a2e] hover:bg-violet-600 rounded-lg text-white transition-colors">
                <ChevronLeft size={20} />
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/letter/${letter}?page=${page + 1}`} className="p-2 bg-[#1a1a2e] hover:bg-violet-600 rounded-lg text-white transition-colors">
                <ChevronRight size={20} />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
