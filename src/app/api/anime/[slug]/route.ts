import { getAnimeBySlug, getSeasonsByAnime, getEpisodesByAnime, updateAnime } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

type RouteContext<T extends string> = { params: Promise<{ slug: string }> };

export async function GET(request: Request, ctx: RouteContext<'/api/anime/[slug]'>) {
  const params = await ctx.params;
  const anime = getAnimeBySlug(params.slug);
  
  if (!anime) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  updateAnime(anime.id, { views: anime.views + 1 });
  
  const seasons = getSeasonsByAnime(anime.id);
  const allEpisodes = getEpisodesByAnime(anime.id);
  
  const episodesBySeason: Record<number, typeof allEpisodes> = {};
  for (const ep of allEpisodes) {
    if (!episodesBySeason[ep.season_id]) episodesBySeason[ep.season_id] = [];
    episodesBySeason[ep.season_id].push(ep);
  }

  return NextResponse.json({
    ...anime,
    views: anime.views + 1,
    seasons,
    episodes: episodesBySeason
  });
}
