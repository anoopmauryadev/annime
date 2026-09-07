import { getEpisodeById, getServersByEpisode, getDownloadsByEpisode } from "@/lib/db";
import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { isUserKeyActive } from "@/lib/db";

export const dynamic = 'force-dynamic';

type RouteContext<T extends string> = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext<'/api/episodes/[id]'>) {
  const params = await ctx.params;
  const id = parseInt(params.id);
  
  const episode = getEpisodeById(id);
  if (!episode) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
  const user = getUserFromRequest(request);
  const access = user ? isUserKeyActive(user.id) : null;
  const servers = access?.active || access?.is_vip ? getServersByEpisode(id) : [];
  const downloads = access?.is_vip ? getDownloadsByEpisode(id) : [];
  
  return NextResponse.json({ ...episode, servers, downloads });
}
