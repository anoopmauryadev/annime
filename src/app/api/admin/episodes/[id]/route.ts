import { getEpisodeById, getServersByEpisode, getDownloadsByEpisode, updateEpisode, deleteEpisode } from "@/lib/db";
import { saveUploadedFile } from "@/lib/upload";
import { requireAdminAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { cleanupEpisodeFiles, deleteLocalFileOrDir } from "@/lib/fileCleanup";

export const dynamic = 'force-dynamic';

type RouteContext<T extends string> = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext<'/api/admin/episodes/[id]'>) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = await ctx.params;
  const id = parseInt(params.id);
  
  const episode = getEpisodeById(id);
  if (!episode) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
  const servers = getServersByEpisode(id);
  const downloads = getDownloadsByEpisode(id);
  
  return NextResponse.json({ ...episode, servers, downloads });
}

export async function PUT(request: Request, ctx: RouteContext<'/api/admin/episodes/[id]'>) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const params = await ctx.params;
    const id = parseInt(params.id);
    const existing = getEpisodeById(id);
    const formData = await request.formData();
    
    const data: any = {};
    if (formData.has("title")) data.title = formData.get("title") as string;
    if (formData.has("duration")) data.duration = formData.get("duration") as string;
    
    const thumbFile = formData.get("thumbnail") as File | null;
    if (thumbFile && thumbFile.size > 0) {
      if (existing?.thumbnail) deleteLocalFileOrDir(existing.thumbnail);
      data.thumbnail = await saveUploadedFile(thumbFile);
    }
    
    updateEpisode(id, data);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: RouteContext<'/api/admin/episodes/[id]'>) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const params = await ctx.params;
  const id = parseInt(params.id);
  if (id) {
    cleanupEpisodeFiles(id);
    deleteEpisode(id);
  }
  return NextResponse.json({ success: true });
}
