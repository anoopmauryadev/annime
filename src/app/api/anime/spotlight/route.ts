import { getSpotlightAnime, getAllAnime } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  let anime = getSpotlightAnime();
  if (!anime || anime.length === 0) {
    anime = getAllAnime({ limit: 5 });
  }
  return NextResponse.json(anime);
}

