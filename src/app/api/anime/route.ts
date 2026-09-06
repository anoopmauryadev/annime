import { getAllAnime } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || undefined;
  const genre = searchParams.get("genre") || undefined;
  const language = searchParams.get("language") || undefined;
  const letter = searchParams.get("letter") || undefined;
  const search = searchParams.get("search") || undefined;
  const sort = searchParams.get("sort") || undefined;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined;
  const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : undefined;

  const anime = getAllAnime({ type, genre, language, letter, search, sort, limit, offset });
  return NextResponse.json(anime);
}
