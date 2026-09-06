import { addBookmark, removeBookmark, getUserBookmarks, isBookmarked } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/bookmarks — get user's bookmarks
// GET /api/bookmarks?anime_id=X — check if specific anime is bookmarked
export async function GET(request: Request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const animeId = searchParams.get("anime_id");

  if (animeId) {
    const bookmarked = isBookmarked(user.id, parseInt(animeId));
    return NextResponse.json({ bookmarked });
  }

  const bookmarks = getUserBookmarks(user.id);
  return NextResponse.json(bookmarks);
}

// POST /api/bookmarks — add bookmark
export async function POST(request: Request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const body = await request.json();
  const { anime_id } = body;

  if (!anime_id) {
    return NextResponse.json({ error: "anime_id required" }, { status: 400 });
  }

  addBookmark(user.id, parseInt(anime_id));
  return NextResponse.json({ success: true, bookmarked: true });
}

// DELETE /api/bookmarks — remove bookmark
export async function DELETE(request: Request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const animeId = searchParams.get("anime_id");

  if (!animeId) {
    return NextResponse.json({ error: "anime_id required" }, { status: 400 });
  }

  removeBookmark(user.id, parseInt(animeId));
  return NextResponse.json({ success: true, bookmarked: false });
}
