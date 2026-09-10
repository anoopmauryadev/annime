import { playbackAccess, playbackServers } from "@/lib/playbackAccess";
import {
  getAnimeBySlug,
  getSeasonsByAnime,
  getEpisodesByAnime,
  getServersByEpisode,
  getDownloadsByEpisode,
  updateAnime,
  incrementAnimeViews,
} from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Home } from "lucide-react";
import VideoPlayer from "@/components/VideoPlayer";
import EpisodeList from "@/components/EpisodeList";
import CommentsSection from "@/components/CommentsSection";
import WatchEpisodeActions from "@/components/WatchEpisodeActions";
import EpisodeDownloads from "@/components/EpisodeDownloads";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { verifyUserToken } from "@/lib/auth";
import { isUserKeyActive } from "@/lib/db";
import { resolveStreamServers } from "@/lib/cdn";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; episode: string }>;
}): Promise<Metadata> {
  const { slug, episode } = await params;
  const anime = getAnimeBySlug(slug);
  if (!anime) return { title: "Episode Not Found — AnimeZone" };

  const [sNum, eNum] = episode.split("x");
  const title = `Watch ${anime.title} Season ${sNum} Episode ${eNum} Hindi Dub & Sub | AnimeZone`;
  const description = `Watch ${anime.title} S${sNum}E${eNum} in 360p or 480p. Original Quality is available to VIP members when ready.`;
  const image = anime.poster || anime.backdrop || "https://hindianimezone.fun/og-image.jpg";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: anime.title }],
      type: "video.episode",
    },
  };
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ slug: string; episode: string }>;
}) {
  const resolvedParams = await params;
  const { slug, episode } = resolvedParams;

  const [seasonStr, epStr] = episode.split("x");
  const seasonNum = parseInt(seasonStr);
  const epNum = parseInt(epStr);

  if (isNaN(seasonNum) || isNaN(epNum)) notFound();

  const anime = getAnimeBySlug(slug);
  if (!anime) notFound();

  // Increment view count on load atomically
  try {
    incrementAnimeViews(anime.id);
  } catch {}

  const seasons = getSeasonsByAnime(anime.id);
  const episodes = getEpisodesByAnime(anime.id);

  const currentSeason = seasons.find((s) => s.season_number === seasonNum);
  if (!currentSeason) notFound();

  const currentEp = episodes.find(
    (e) => e.season_id === currentSeason.id && e.episode_number === epNum
  );
  if (!currentEp) notFound();

  const cookieStore = await cookies();
  const access = playbackAccess(new Request("http://localhost", {headers:{cookie:cookieStore.toString()}}), currentEp.id);
  const servers = playbackServers(currentEp.id,access);
  const downloads = access.is_vip ? getDownloadsByEpisode(currentEp.id) : [];

  // Prev / next episode logic
  const seasonEpisodes = episodes.filter((e) => e.season_id === currentSeason.id);
  const currentIndex = seasonEpisodes.findIndex((e) => e.id === currentEp.id);

  const prevEp = currentIndex > 0 ? seasonEpisodes[currentIndex - 1] : null;
  const nextEp = currentIndex < seasonEpisodes.length - 1 ? seasonEpisodes[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-[#000000] pt-4 pb-20">
      <div className="container mx-auto px-4 space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 overflow-x-auto hide-scrollbar whitespace-nowrap py-1">
          <Link href="/" className="hover:text-[#ff640a] flex items-center gap-1 transition-colors">
            <Home size={14} /> Home
          </Link>
          <span>/</span>
          <Link
            href={`/anime/${anime.slug}`}
            className="hover:text-[#ff640a] transition-colors font-medium"
          >
            {anime.title}
          </Link>
          <span>/</span>
          <span className="text-[#ff640a] font-bold bg-[#ff640a]/10 border border-[#ff640a]/20 px-2 py-0.5 rounded">
            Season {seasonNum} • Episode {epNum}
          </span>
        </div>

        {/* Player & Sidebar Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Main Video Player Column */}
          <div className="lg:col-span-3 flex flex-col gap-5">
            {/* Video Player Box with History tracking */}
            {currentEp.display_quality && <span className="self-start rounded bg-white/10 px-3 py-1 text-sm text-white">{currentEp.display_quality}</span>}
            <VideoPlayer
              servers={servers}
              animeId={anime.id}
              episodeId={currentEp.id}
              title={`${anime.title} · S${seasonNum} E${epNum}${currentEp.title ? ` · ${currentEp.title}` : ""}`}
              nextEpisodeUrl={nextEp ? `/watch/${anime.slug}/${seasonNum}x${nextEp.episode_number}` : undefined}
            />

            {/* Episode Title & Prev/Next / Bookmark / Report Actions Bar */}
            <WatchEpisodeActions
              anime={anime}
              seasonNum={seasonNum}
              epNum={epNum}
              currentEp={currentEp}
              prevEp={prevEp}
              nextEp={nextEp}
              servers={servers}
            />

            {/* Download Links Box (Gated to Logged In Members) */}
            <EpisodeDownloads
              downloads={downloads}
              servers={servers}
              episodeTitle={currentEp.title || `Episode ${epNum}`}
            />

            {/* Episode Comments & Discussion Section */}
            <CommentsSection episodeId={currentEp.id} />
          </div>

          {/* Episode Navigator Sidebar */}
          <div className="lg:col-span-1">
            <EpisodeList
              seasons={seasons}
              episodes={episodes}
              currentAnimeSlug={anime.slug}
              currentSeasonNum={seasonNum}
              currentEpNum={epNum}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
