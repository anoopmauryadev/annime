import { getSeasonsByAnime, createSeason, deleteSeason, getAnimeById } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const body = await request.json().catch(() => null);
  if (!body || !Number.isSafeInteger(body.anime_id) || body.anime_id <= 0 ||
      !Number.isSafeInteger(body.season_number) || body.season_number < 1 ||
      typeof body.title !== 'string' || body.title.length > 200) {
    return NextResponse.json({error:'Enter a valid season number and title.'},{status:400});
  }
  if (!getAnimeById(body.anime_id)) return NextResponse.json({error:'Anime not found.'},{status:404});
  try {
    const id = createSeason(body.anime_id, body.season_number, body.title.trim() || `Season ${body.season_number}`);
    return NextResponse.json({ success: true, id });
  } catch(error) {
    if(error instanceof Error && error.message==='SEASON_ALREADY_EXISTS') {
      return NextResponse.json({error:`Season ${body.season_number} already exists. Select it or use a different number.`},{status:409});
    }
    throw error;
  }
}

export async function DELETE(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = parseInt(searchParams.get("id") || "0");
  if (id) {
    const { cleanupSeasonFiles } = await import("@/lib/fileCleanup");
    await cleanupSeasonFiles(id);
    deleteSeason(id);
  }
  return NextResponse.json({ success: true });
}
