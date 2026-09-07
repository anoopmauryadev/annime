import { NextResponse } from 'next/server';
import { getAllAnime, createAnime, createSeason, createEpisode, createServer } from '@/lib/db';
import { saveUploadedFile } from '@/lib/upload';
import { requireAdminAuth } from '@/lib/auth';
import slugify from 'slugify';

export const dynamic = 'force-dynamic';
export const maxDuration = 1800; // 30 minutes for slow mobile uploads

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || '';
  const anime = getAllAnime({ search, sort: sort === 'priority' ? undefined : sort });
  if (sort === 'priority') {
    anime.sort((a, b) => b.priority - a.priority);
  }
  return NextResponse.json(anime);
}

export async function POST(req: Request) {
  // 1. Admin Authentication Check
  const auth = requireAdminAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const data: any = {};
    const keys = ['title', 'type', 'synopsis', 'year', 'rating', 'status', 'quality', 'priority'];
    keys.forEach(k => { if (formData.has(k)) data[k] = formData.get(k); });
    if (formData.has('languages')) data.languages = formData.get('languages');
    if (formData.has('genres')) data.genres = formData.get('genres');
    data.is_spotlight = formData.get('is_spotlight') === 'true' || formData.get('is_spotlight') === '1' ? 1 : 0;
    
    // Slug generation
    data.slug = slugify((data.title as string) || 'anime', { lower: true, strict: true }) + '-' + Date.now().toString().slice(-4);
    
    // File uploads for images with extension validation
    const posterFile = formData.get('poster') as File | null;
    if (posterFile && posterFile.size > 0) {
      data.poster = await saveUploadedFile(posterFile);
    }
    const backdropFile = formData.get('backdrop') as File | null;
    if (backdropFile && backdropFile.size > 0) {
      data.backdrop = await saveUploadedFile(backdropFile);
    }
    const thumbnailFile = formData.get('thumbnail') as File | null;
    if (thumbnailFile && thumbnailFile.size > 0) {
      data.thumbnail = await saveUploadedFile(thumbnailFile);
    }

    const animeId = createAnime(data);

    // Check if anime video file or stream URL was also uploaded directly with anime
    const videoFile = formData.get('video') as File | null;
    const streamUrl = formData.get('stream_url') as string | null;

    if ((videoFile && videoFile.size > 0) || (streamUrl && streamUrl.trim())) {
      const seasonId = createSeason(animeId, 1, 'Season 1');
      const epTitle = data.type === 'movie' ? data.title : `${data.title} 1x1`;
      const epId = createEpisode({
        anime_id: animeId,
        season_id: seasonId,
        episode_number: 1,
        title: epTitle,
        thumbnail: data.thumbnail || data.poster || '',
        duration: (formData.get('duration') as string) || '',
      });

      if (videoFile && videoFile.size > 0) {
        const videoUrl = await saveUploadedFile(videoFile, 'videos');
        createServer({
          episode_id: epId,
          server_name: (formData.get('server_name') as string) || 'Server 1 (Uploaded Video)',
          server_type: 'direct',
          stream_url: videoUrl,
          server_order: 0,
        });
      } else if (streamUrl && streamUrl.trim()) {
        createServer({
          episode_id: epId,
          server_name: (formData.get('server_name') as string) || 'Server 1',
          server_type: (formData.get('server_type') as string) || 'embed',
          stream_url: streamUrl.trim(),
          server_order: 0,
        });
      }
    }

    return NextResponse.json({ success: true, id: animeId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
