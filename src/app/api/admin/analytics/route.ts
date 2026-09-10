import { NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/auth';
import { videoAnalytics } from '@/lib/videoAnalytics';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  if(!requireAdminAuth(request).authorized)return NextResponse.json({error:'Unauthorized'},{status:401});
  const query=new URL(request.url).searchParams;
  const days=Number(query.get('days') || 7),episode=Number(query.get('episode_id') || 0);
  if(![1,7,30,90].includes(days) || !Number.isSafeInteger(episode) || episode<0)return NextResponse.json({error:'Invalid filter'},{status:400});
  return NextResponse.json(videoAnalytics(days,episode || undefined),{headers:{'Cache-Control':'private, no-store'}});
}
