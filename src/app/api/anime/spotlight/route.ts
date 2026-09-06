import { getSpotlightAnime } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  const anime = getSpotlightAnime();
  return NextResponse.json(anime);
}
