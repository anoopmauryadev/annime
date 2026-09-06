import { getAllAnime } from "@/lib/db";
import HeroSpotlight from "@/components/HeroSpotlight";
import AnimeSection from "@/components/AnimeSection";
import TopTenTrending from "@/components/TopTenTrending";
import AlphabetFilter from "@/components/AlphabetFilter";
import ContinueWatching from "@/components/ContinueWatching";

export const dynamic = "force-dynamic";

export default function Home() {
  const latestSeries = getAllAnime({ type: "series", sort: "latest", limit: 14 });
  const latestMovies = getAllAnime({ type: "movie", sort: "latest", limit: 14 });
  const popular = getAllAnime({ sort: "views", limit: 14 });
  const topRated = getAllAnime({ sort: "rating", limit: 14 });
  const allTrending = getAllAnime({ sort: "views", limit: 10 });

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* 1. Hero Spotlight Carousel */}
      <HeroSpotlight />

      {/* 2. Main Content Container */}
      <div className="container mx-auto px-4 space-y-6 pt-4">
        {/* Continue Watching (Logged in users with history) */}
        <ContinueWatching />

        {/* Top 10 Trending Leaderboard */}
        <TopTenTrending animeList={allTrending} />

        {/* Latest Series Section */}
        <AnimeSection
          title="Latest Series"
          subtitle="Recently updated Hindi, Tamil, Telugu & Subbed anime series"
          animeList={latestSeries}
          viewMoreLink="/series"
        />

        {/* Latest Movies Section */}
        <AnimeSection
          title="Latest Movies"
          subtitle="Full length anime movies with multi-audio dubs"
          animeList={latestMovies}
          viewMoreLink="/movies"
        />

        {/* Most Popular */}
        <AnimeSection
          title="Most Popular Anime"
          subtitle="Top rated by community and most watched"
          animeList={popular}
        />

        {/* Top Rated */}
        <AnimeSection
          title="Top Rated All Time"
          subtitle="Highest rating anime on Anime Zone"
          animeList={topRated}
        />

        {/* A-Z Alphabet Filter at the bottom */}
        <div className="pt-4">
          <AlphabetFilter />
        </div>
      </div>
    </div>
  );
}
