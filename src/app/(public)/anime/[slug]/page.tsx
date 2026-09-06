import { getAnimeBySlug, getSeasonsByAnime, getEpisodesByAnime, getAllAnime, incrementAnimeViews } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Play, Star, Calendar, Share2, Film, Tv, Eye, Layers } from "lucide-react";
import AnimeCard from "@/components/AnimeCard";
import BookmarkButton from "@/components/BookmarkButton";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const anime = getAnimeBySlug(slug);
  if (!anime) return { title: "Anime Not Found — AnimeZone" };

  const title = `${anime.title} Hindi Dub & Sub — Watch Online | AnimeZone`;
  const description = anime.synopsis 
    ? anime.synopsis.slice(0, 160) 
    : `Watch ${anime.title} with high quality Hindi and multi-audio dubs free on AnimeZone.`;
  const image = anime.poster || anime.backdrop || "https://animezone.in/og-image.jpg";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: anime.title }],
      type: "video.other",
      siteName: "AnimeZone India",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function AnimePage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const anime = getAnimeBySlug(resolvedParams.slug);

  if (!anime) notFound();

  // Atomically increment views when page is visited
  let currentViews = (anime.views || 0) + 1;
  try {
    currentViews = incrementAnimeViews(anime.id);
  } catch {}

  const seasons = getSeasonsByAnime(anime.id);
  const episodes = getEpisodesByAnime(anime.id);
  const relatedAnime = getAllAnime({ limit: 6 }).filter((a) => a.id !== anime.id).slice(0, 5);

  const parseJsonStr = (str: string) => {
    try {
      return JSON.parse(str);
    } catch {
      return [];
    }
  };
  const languages = parseJsonStr(anime.languages || "[]");
  const genres = parseJsonStr(anime.genres || "[]");

  const firstSeason = seasons.length > 0 ? seasons[0] : null;
  const firstEpisode = episodes.length > 0 ? episodes[0] : null;

  const defaultPoster = "https://m.media-amazon.com/images/M/MV5BN2QyZGU1NWUtNWY2OC00Y2U3LTliMmEtNTE1MmM2NzU1Yzg5XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg";
  const defaultBackdrop = "https://images.alphacoders.com/131/1312646.jpeg";

  return (
    <div className="min-h-screen pb-20 bg-[#000000]">
      {/* 1. Cinematic Backdrop Banner & Header Info */}
      <div className="relative w-full overflow-hidden">
        {/* Backdrop Background Image with Gradients */}
        <div className="absolute inset-0 h-[480px] md:h-[560px] pointer-events-none">
          <img
            src={anime.backdrop || anime.poster || defaultBackdrop}
            alt={anime.title}
            className="w-full h-full object-cover opacity-25 md:opacity-35 scale-105 filter blur-[1px]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#000000] via-[#000000]/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#000000] via-[#000000]/80 to-transparent md:w-3/4" />
        </div>

        {/* Content Container (Normal Flow, No clipping/translating hacks) */}
        <div className="relative container mx-auto px-4 md:px-6 pt-8 md:pt-14 pb-8">
          <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-center md:items-start">
            
            {/* Poster Card */}
            <div className="w-44 sm:w-52 md:w-64 shrink-0 rounded-xl overflow-hidden shadow-2xl aspect-[2/3] bg-[#141519] group relative">
              <img
                src={anime.poster || defaultPoster}
                alt={anime.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-2 left-2 bg-[#ff640a] text-white text-[11px] font-black px-2 py-0.5 rounded shadow-md uppercase">
                {anime.type}
              </div>
            </div>

            {/* Title & Metadata Details */}
            <div className="flex-1 text-center md:text-left flex flex-col justify-start">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
                <span className="bg-white text-black font-black text-xs px-2.5 py-0.5 rounded shadow-sm">
                  {anime.quality || "HD 1080p"}
                </span>
                <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2.5 py-0.5 rounded uppercase">
                  {anime.status || "Ongoing"}
                </span>
                {anime.is_spotlight ? (
                  <span className="bg-yellow-500/20 text-yellow-400 text-xs font-bold px-2.5 py-0.5 rounded">
                    ★ Spotlight
                  </span>
                ) : null}
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-white mb-3 tracking-tight drop-shadow-md">
                {anime.title}
              </h1>

              {/* Badges Row */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 md:gap-4 text-xs sm:text-sm font-semibold mb-3 text-gray-300">
                <span className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded">
                  <Star fill="currentColor" size={15} /> {anime.rating || "8.5"} / 10
                </span>
                <span className="flex items-center gap-1.5 bg-[#141519] px-2.5 py-1 rounded text-gray-300">
                  <Calendar size={15} /> {anime.year || 2024}
                </span>
                <span className="flex items-center gap-1.5 bg-[#141519] px-2.5 py-1 rounded text-gray-300">
                  <Eye size={15} /> {currentViews.toLocaleString()} views
                </span>
                <span className="flex items-center gap-1.5 bg-[#141519] px-2.5 py-1 rounded text-gray-300">
                  <Layers size={15} /> {episodes.length} Episodes
                </span>
              </div>

              {/* Genre Pills */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 mb-3">
                {genres.map((g: string, i: number) => (
                  <span
                    key={i}
                    className="text-xs bg-[#1e1e24] text-gray-300 px-3 py-1 rounded-full font-medium"
                  >
                    {g}
                  </span>
                ))}
              </div>

              {/* Audio Languages */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-6">
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mr-1">Available Audio:</span>
                {languages.map((l: string, i: number) => (
                  <span
                    key={i}
                    className="text-xs bg-[#ff640a]/20 text-[#ff8533] font-bold px-2.5 py-1 rounded"
                  >
                    {l}
                  </span>
                ))}
              </div>

              {/* Play CTA & Watchlist Buttons */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
                {firstEpisode && firstSeason ? (
                  <Link
                    href={`/watch/${anime.slug}/${firstSeason.season_number}x${firstEpisode.episode_number}`}
                    className="inline-flex items-center gap-2.5 bg-[#ff640a] hover:bg-[#e05300] text-white font-black py-3 px-7 rounded-xl transition-all hover:scale-105 shadow-xl text-sm md:text-base uppercase tracking-wider"
                  >
                    <Play fill="currentColor" size={18} /> Watch S{firstSeason.season_number}-E{firstEpisode.episode_number} Now
                  </Link>
                ) : null}
                <BookmarkButton animeId={anime.id} variant="pill" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Synopsis & Episode Grid Section */}
      <div className="container mx-auto px-4 md:px-6 mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Synopsis Card */}
            <div className="bg-[#141519] p-6 rounded-xl shadow-lg">
              <h2 className="text-lg font-black text-white mb-2.5 flex items-center gap-2">
                <span className="w-1 h-5 bg-[#ff640a] rounded-full"></span>
                Storyline & Synopsis
              </h2>
              <p className="text-gray-300 leading-relaxed text-sm md:text-base">
                {anime.synopsis || "Watch full episodes in High Definition with Hindi, English, and multi-audio dubs on Anime Zone India."}
              </p>
            </div>

            {/* Seasons & Episodes Grid */}
            <div className="bg-[#141519] p-6 rounded-xl shadow-lg space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <span className="w-1 h-5 bg-[#ff640a] rounded-full"></span>
                  Episodes ({episodes.length})
                </h2>
                <span className="text-xs text-[#ff640a] font-semibold">{seasons.length} Season(s)</span>
              </div>

              {seasons.length === 0 && episodes.length === 0 && (
                <div className="text-center py-12 text-gray-500 text-sm">
                  Episodes will be uploaded soon. Stay tuned!
                </div>
              )}

              {seasons.map((season) => {
                const seasonEpisodes = episodes.filter((e) => e.season_id === season.id);
                if (seasonEpisodes.length === 0) return null;

                return (
                  <div key={season.id} className="space-y-3">
                    <div className="flex items-center justify-between px-3.5 py-2 bg-[#1e1e24] rounded">
                      <span className="font-bold text-white text-sm">
                        {season.title || `Season ${season.season_number}`}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">{seasonEpisodes.length} Episodes</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {seasonEpisodes.map((ep) => (
                        <Link
                          key={ep.id}
                          href={`/watch/${anime.slug}/${season.season_number}x${ep.episode_number}`}
                          className="group block bg-[#18191f] rounded overflow-hidden hover:bg-[#202129] transition-all shadow-md"
                        >
                          <div className="aspect-video relative bg-black/80 overflow-hidden">
                            <img
                              src={ep.thumbnail || anime.backdrop || anime.poster || defaultBackdrop}
                              alt={ep.title}
                              className="w-full h-full object-cover opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="bg-[#ff640a] p-2 rounded-full text-white shadow-lg">
                                <Play fill="currentColor" size={14} className="ml-0.5" />
                              </div>
                            </div>
                            <div className="absolute bottom-1 right-1 bg-black/80 font-mono font-bold px-1.5 py-0.5 text-[9px] text-white rounded">
                              {season.season_number}x{ep.episode_number}
                            </div>
                          </div>

                          <div className="p-2">
                            <h4 className="text-xs font-bold text-gray-200 group-hover:text-[#ff640a] line-clamp-1 transition-colors">
                              {ep.title || `Episode ${ep.episode_number}`}
                            </h4>
                            <span className="text-[10px] text-gray-500 mt-0.5 block font-mono">
                              Ep #{ep.episode_number}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar: Quick Info & Recommendations */}
          <div className="space-y-6">
            {/* Quick Info Box */}
            <div className="bg-[#141519] p-5 rounded-xl shadow-lg space-y-3">
              <h3 className="font-bold text-white text-sm pb-2.5 border-b border-white/5">
                Information
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-white/[0.03]">
                  <span className="text-gray-400">Type:</span>
                  <span className="font-bold text-white uppercase">{anime.type}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.03]">
                  <span className="text-gray-400">Release Year:</span>
                  <span className="font-bold text-white">{anime.year || "2024"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.03]">
                  <span className="text-gray-400">Status:</span>
                  <span className="font-bold text-emerald-400 uppercase">{anime.status}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.03]">
                  <span className="text-gray-400">Quality:</span>
                  <span className="font-bold text-[#ff640a]">{anime.quality || "HD 1080p"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.03]">
                  <span className="text-gray-400">Rating:</span>
                  <span className="font-bold text-amber-400">★ {anime.rating || "8.5"} / 10</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">Views:</span>
                  <span className="font-bold text-white">{currentViews.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {relatedAnime.length > 0 && (
              <div className="bg-[#141519] p-5 rounded-xl shadow-lg space-y-3">
                <h3 className="font-bold text-white text-sm pb-2.5 border-b border-white/5">
                  You May Also Like
                </h3>
                <div className="space-y-2.5">
                  {relatedAnime.map((rel) => (
                    <Link
                      key={rel.id}
                      href={`/anime/${rel.slug}`}
                      className="flex items-center gap-3 p-1.5 rounded hover:bg-[#1e1e24] transition-all group"
                    >
                      <img
                        src={rel.poster || defaultPoster}
                        alt={rel.title}
                        className="w-11 h-14 object-cover rounded shrink-0 group-hover:scale-105 transition-transform"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-white group-hover:text-[#ff640a] truncate transition-colors">
                          {rel.title}
                        </h4>
                        <p className="text-[11px] text-gray-400 mt-0.5 capitalize">
                          {rel.type} • ★ {rel.rating || "8.0"}
                        </p>
                        <span className="text-[10px] text-[#ff640a] mt-0.5 inline-block">
                          {rel.quality || "HD"}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
