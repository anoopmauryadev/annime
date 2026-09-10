import { NextResponse } from "next/server";
import crypto from "crypto";
import { userCookieOptions } from "@/lib/auth";
import { guestId, playbackAccess } from "@/lib/playbackAccess";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const episodeId = Number(new URL(request.url).searchParams.get('episode_id')) || undefined;
  const {user,...access} = playbackAccess(request, episodeId);
  const response = NextResponse.json({...access,is_logged_in:!!user}, {headers:{"Cache-Control":"private, no-store"}});
  if(!guestId(request)) response.cookies.set("playback_guest",crypto.randomBytes(32).toString("hex"),{...userCookieOptions,sameSite:"lax"});
  return response;
}
