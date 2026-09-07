const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const dbPath = path.join(process.cwd(), 'data', 'anime.db');
if (!fs.existsSync(dbPath)) {
  console.log('Database not found at', dbPath);
  process.exit(1);
}

const db = new Database(dbPath);

// Find servers where stream_url is a direct uploaded video file (.mp4, .mkv, etc.)
const servers = db
  .prepare("SELECT * FROM servers WHERE stream_url LIKE '/uploads/videos/%'")
  .all();

console.log(`\n🎬 Found ${servers.length} direct uploaded video server(s) to transcode to HLS:\n`);

if (servers.length === 0) {
  console.log('✅ All uploaded videos are already transcoded to HLS!');
  process.exit(0);
}

async function transcodeServer(server) {
  const inputRel = server.stream_url;
  const inputPath = path.join(process.cwd(), 'public', inputRel);
  if (!fs.existsSync(inputPath)) {
    console.log(`⚠️ Video file not found on disk: ${inputPath}`);
    return;
  }

  const outputDirName = `ep_${server.episode_id}_${Date.now()}`;
  const hlsBaseDir = path.join(process.cwd(), 'public', 'uploads', 'hls', outputDirName);
  fs.mkdirSync(hlsBaseDir, { recursive: true });

  const masterPlaylistPath = path.join(hlsBaseDir, 'master.m3u8');
  const publicMasterUrl = `/uploads/hls/${outputDirName}/master.m3u8`;

  const profiles = [
    { name: '360p', width: 640, height: 360, bitrate: '800k', audioBitrate: '64k' },
    { name: '720p', width: 1280, height: 720, bitrate: '2400k', audioBitrate: '128k' },
    { name: '1080p', width: 1920, height: 1080, bitrate: '4800k', audioBitrate: '128k' },
  ];

  console.log(`▶️ Transcoding Episode ID ${server.episode_id} (${inputRel})...`);

  for (const p of profiles) {
    const outSegment = path.join(hlsBaseDir, `${p.name}_%03d.ts`);
    const outM3u8 = path.join(hlsBaseDir, `${p.name}.m3u8`);

    const ffmpegArgs = [
      '-y',
      '-i', inputPath,
      '-vf', `scale=w=${p.width}:h=${p.height}:force_original_aspect_ratio=decrease,pad=${p.width}:${p.height}:(ow-iw)/2:(oh-ih)/2`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-b:v', p.bitrate,
      '-maxrate', p.bitrate,
      '-bufsize', `${parseInt(p.bitrate) * 2}k`,
      '-c:a', 'aac',
      '-b:a', p.audioBitrate,
      '-ar', '44100',
      '-ac', '2',
      '-hls_time', '6',
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', outSegment,
      outM3u8,
    ];

    try {
      console.log(`   ⏳ Processing ${p.name}...`);
      await new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', ffmpegArgs, { stdio: 'ignore' });
        proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Exit ${code}`)));
        proc.on('error', reject);
      });
      console.log(`   ✅ ${p.name} ready`);
    } catch (err) {
      console.error(`   ❌ Failed ${p.name}:`, err.message);
    }
  }

  // Write master.m3u8
  let masterContent = '#EXTM3U\n#EXT-X-VERSION:3\n';
  for (const p of profiles) {
    const variantFile = path.join(hlsBaseDir, `${p.name}.m3u8`);
    if (fs.existsSync(variantFile)) {
      const bandwidth = parseInt(p.bitrate) * 1000;
      masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${p.width}x${p.height},NAME="${p.name}"\n${p.name}.m3u8\n`;
    }
  }

  fs.writeFileSync(masterPlaylistPath, masterContent, 'utf8');

  // Update server in DB
  db.prepare(`
    UPDATE servers 
    SET server_name = 'Multi-Quality HD (Auto / 1080p / 720p / 360p)',
        server_type = 'direct',
        stream_url = ?
    WHERE id = ?
  `).run(publicMasterUrl, server.id);

  console.log(`🎉 Done! Server ${server.id} updated with HLS URL: ${publicMasterUrl}\n`);
}

(async () => {
  for (const s of servers) {
    await transcodeServer(s);
  }
  console.log('🏁 All direct videos successfully transcoded to HLS!');
  db.close();
})();
