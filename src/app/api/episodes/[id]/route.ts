import { playbackAccess, playbackServers } from "@/lib/playbackAccess";
import { getEpisodeById, getDownloadsByEpisode } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

type RouteContext<T extends string> = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext<'/api/episodes/[id]'>) {
  const params = await ctx.params;
  const id = parseInt(params.id);
  
  const episode = getEpisodeById(id);
  if (!episode) return NextResponse.json({ error: "Not found" }, { status: 404 });
  
  const access = playbackAccess(request, id);
  const servers = playbackServers(id,access);
  const downloads = access.is_vip ? getDownloadsByEpisode(id) : [];
  
  return NextResponse.json({ ...episode, servers, downloads }, {headers:{"Cache-Control":"private, no-store"}});
}
