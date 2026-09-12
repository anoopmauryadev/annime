import { getAnimeById, updateAnime, deleteAnime } from "@/lib/db";
import { saveUploadedFile } from "@/lib/upload";
import { requireAdminAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import slugify from "slugify";
import { cleanupAnimeFiles, deleteLocalFileOrDir } from "@/lib/fileCleanup";

export const dynamic = 'force-dynamic';

type RouteContext<T extends string> = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext<'/api/admin/anime/[id]'>) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = await ctx.params;
  const anime = getAnimeById(parseInt(params.id));
  if (!anime) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(anime);
}

export async function PUT(request: Request, ctx: RouteContext<'/api/admin/anime/[id]'>) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const params = await ctx.params;
    const id = parseInt(params.id);
    const existing = getAnimeById(id);
    const formData = await request.formData();
    
    const data: any = {};
    const stringFields = ["title", "type", "synopsis", "rating", "status", "languages", "genres", "quality"];
    stringFields.forEach(f => {
      if (formData.has(f)) data[f] = formData.get(f) as string;
    });
    
    if (formData.has("year")) data.year = parseInt(formData.get("year") as string);
    if (formData.has("is_spotlight")) data.is_spotlight = parseInt(formData.get("is_spotlight") as string);
    if (formData.has("priority")) data.priority = parseInt(formData.get("priority") as string);
    if (formData.has("views")) data.views = parseInt(formData.get("views") as string) || 0;
    if (data.title) data.slug = slugify(data.title, { lower: true, strict: true });
    
    const posterFile = formData.get("poster") as File | null;
    if (posterFile && posterFile.size > 0) {
      if (existing?.poster) deleteLocalFileOrDir(existing.poster);
      data.poster = await saveUploadedFile(posterFile);
    }
    
    const backdropFile = formData.get("backdrop") as File | null;
    if (backdropFile && backdropFile.size > 0) {
      if (existing?.backdrop) deleteLocalFileOrDir(existing.backdrop);
      data.backdrop = await saveUploadedFile(backdropFile);
    }
    
    const thumbnailFile = formData.get("thumbnail") as File | null;
    if (thumbnailFile && thumbnailFile.size > 0) {
      if (existing?.thumbnail) deleteLocalFileOrDir(existing.thumbnail);
      data.thumbnail = await saveUploadedFile(thumbnailFile);
    }
    
    updateAnime(id, data);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/admin/anime/[id]'>) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const params = await ctx.params;
  const animeId = parseInt(params.id);
  await cleanupAnimeFiles(animeId);
  deleteAnime(animeId);
  return NextResponse.json({ success: true });
}
