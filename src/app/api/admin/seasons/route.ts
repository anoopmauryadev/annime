import { getSeasonsByAnime, createSeason, deleteSeason } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anime_id = parseInt(searchParams.get("anime_id") || "0");
  if (!anime_id) return NextResponse.json([]);
  return NextResponse.json(getSeasonsByAnime(anime_id));
}

export async function POST(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const { anime_id, season_number, title } = await request.json();
  const id = createSeason(anime_id, season_number, title);
  return NextResponse.json({ success: true, id });
}

export async function DELETE(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = parseInt(searchParams.get("id") || "0");
  if (id) deleteSeason(id);
  return NextResponse.json({ success: true });
}
