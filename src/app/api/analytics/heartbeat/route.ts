import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getUserFromRequest,isSameOriginMutation,userCookieOptions } from '@/lib/auth';
import { guestId,playbackAccess } from '@/lib/playbackAccess';
import { getEpisodeById } from '@/lib/db';
import { recordPresence,recordPlayback,type PlaybackSample } from '@/lib/videoAnalytics';
import { rateLimit } from '@/lib/rateLimit';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
  if(!isSameOriginMutation(request)) return NextResponse.json({error:'Forbidden'},{status:403});
  const existing=guestId(request),token=crypto.randomBytes(32).toString('hex');
  const visitor=existing || crypto.createHash('sha256').update(token).digest('hex');
  const limited=rateLimit(request,'analytics',180,60000,visitor);if(limited)return limited;
  const body=await request.json().catch(()=>null);
  if(!body || typeof body!=='object')return NextResponse.json({error:'Invalid sample'},{status:400});
  const user=getUserFromRequest(request);
  if(body.episode_id!==undefined) {
    const {session_id,episode_id,position,duration,state}=body;
    if(typeof session_id!=='string' || !/^[a-f0-9-]{36}$/.test(session_id) || !Number.isSafeInteger(episode_id) ||
      !Number.isFinite(position) || !Number.isFinite(duration) || position<0 || duration<=0 || duration>43200 || position>duration+1 ||
      !['playing','paused','buffering','seeking','ended'].includes(state))return NextResponse.json({error:'Invalid sample'},{status:400});
    if(!getEpisodeById(episode_id))return NextResponse.json({error:'Not found'},{status:404});
    if(!playbackAccess(request,episode_id).can_play)return NextResponse.json({error:'Playback access required'},{status:403});
    if(!recordPlayback(visitor,user?.id || null,body as PlaybackSample))return NextResponse.json({error:'Session mismatch'},{status:403});
  } else if(body.visible!==true) return new NextResponse(null,{status:204});
  if(body.visible===true || body.state==='playing')recordPresence(visitor,user?.id || null);
  const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
  if(!existing)response.cookies.set('playback_guest',token,{...userCookieOptions,sameSite:'lax'});
  return response;
}
