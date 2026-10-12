# Anime Zone System Guide

यह document Anime Zone की architecture, authentication, video playback, VIP/key system, uploads, transcoding, downloads और VPS deployment को समझाता है।

## 1. Project structure

यह Next.js 16 और React 19 application है। Frontend और backend दोनों इसी project में हैं।

| Folder/file | उपयोग |
|---|---|
| `src/app/` | Pages और API routes |
| `src/components/` | Reusable UI components |
| `src/lib/` | Database, auth, upload, transcoding और security logic |
| `public/` | Logo, intro animation और media files |
| `data/anime.db` | SQLite database |
| `scripts/` | Testing, manual transcoding और helper scripts |
| `setup.sh` | VPS setup और deployment |

## 2. Public website flow

User home page खोलता है, जहाँ database से anime data लेकर cards, spotlight, search और sections दिखते हैं। Anime page का URL `/anime/anime-slug` होता है। Episode watch page का URL `/watch/anime-slug/episode-number` होता है। Watch page episode, servers, downloads, comments और player data fetch करता है।

मुख्य public APIs:

```text
/api/anime
/api/anime/[slug]
/api/episodes/[id]
/api/comments
/api/history
/api/bookmarks
```

## 3. Database

Database `data/anime.db` में है और `better-sqlite3` से चलता है। Database पहली access पर tables automatically create करता है।

मुख्य tables:

| Table | उपयोग |
|---|---|
| `users` | Registered users, password hash और VIP status |
| `admin_users` | Admin login और session version |
| `anime` | Title, poster, genre, rating और metadata |
| `seasons` | Anime seasons |
| `episodes` | Episode metadata |
| `servers` | Episode video servers |
| `downloads` | Download records |
| `access_keys` | 48-hour keys |
| `vip_codes` | VIP activation codes |
| `transcode_jobs` | FFmpeg job status |
| `watch_history` | Resume playback position |
| `user_bookmarks` | Watchlist |
| `episode_comments` | Comments |
| `site_settings` | Intro और transcoding settings |

Foreign keys data संबंध सुरक्षित रखते हैं और indexes common queries को तेज़ बनाते हैं।

## 4. Login और authentication

Authentication का मुख्य code `src/lib/auth.ts` में है। User login पर password bcrypt hash से verify होता है और HMAC-SHA256 signed token बनता है। यह token `user_token` HTTP-only cookie में store होता है और 30 दिन valid रहता है। Admin के लिए अलग `admin_token` होता है जो 7 दिन valid रहता है।

Admin token में session version भी होती है। Database की `admin_users.session_version` से comparison के कारण password change या session revoke के बाद पुराने admin tokens invalid हो जाते हैं। Production secret `.env.local` में `ADMIN_SECRET_KEY` से आता है।

## 5. Security model

- Protected API routes token और database identity check करते हैं।
- Admin APIs बिना valid admin session के काम नहीं करतीं।
- Sensitive mutation requests में same-origin validation है।
- Login, key generation और comments पर rate limiting है।
- Upload में extension के साथ actual media validation होती है।
- Real path validation path traversal और `../` bypass रोकती है।
- `/uploads/temp` public access से blocked है।
- Media requests proxy होकर authenticated route से serve होती हैं।
- VIP download database में current membership फिर check करता है; केवल token के पुराने `is_vip` field पर भरोसा नहीं करता।

## 6. VIP और 48-hour key flow

Player पहले login check करता है और फिर `/api/keys/status` से current key/VIP status fetch करता है। Access VIP membership या active 48-hour key से मिलता है।

Key flow:

```text
Get Key
→ /api/keys/generate
→ shortener link
→ /api/keys/claim
→ key active
→ player reload
```

Manual key के लिए `/api/keys/redeem` route है। Admin VIP revoke कर सकता है और database check के कारण revoke तुरंत प्रभावी होता है।

## 7. Video upload flow

Admin upload direct या chunked हो सकता है। बड़े files के लिए `src/lib/chunkedUpload.ts` और `/api/admin/upload-chunk` उपयोग होते हैं।

Upload sequence:

```text
Admin authentication
→ file validation
→ temporary upload
→ real media validation
→ /public/uploads/videos में final file
→ servers table record
→ downloads table record
→ setting ON हो तो transcoding queue
```

## 8. Auto-transcoding ON/OFF

Admin setting `site_settings.auto_transcode_enabled` में save होती है। इसे ये तीन upload routes check करते हैं:

```text
src/app/api/admin/upload-video/route.ts
src/app/api/admin/episodes/route.ts
src/app/api/admin/anime/route.ts
```

Behavior:

```text
OFF करके upload
→ original video save
→ FFmpeg शुरू नहीं

बाद में ON
→ पुराने OFF videos automatically transcode नहीं

ON के बाद नया upload
→ HLS queue में add
```

Toggle पहले से चल रही FFmpeg process को cancel नहीं करता।

## 9. Transcoding system

मुख्य file `src/lib/transcoder.ts` है। ON होने पर 360p, 720p और 1080p HLS variants बनते हैं। प्रत्येक variant में H.264 video, AAC audio, 4-second segments और `.m3u8` playlist होती है। अंत में `master.m3u8` बनती है।

Local development में controlled in-memory queue है। VPS production में अलग PM2 worker और SQLite-backed persistent queue है:

- Default एक समय में केवल 1 heavy FFmpeg job चलता है।
- Default FFmpeg threads 2 हैं।
- `TRANSCODE_THREADS` thread count बदल सकता है।
- `annime-transcoder` worker website process से अलग FFmpeg jobs चलाता है।
- Worker restart पर `processing` job वापस queue में आती है।
- Failed job अधिकतम तीन attempts तक retry होती है।

Upload request transcoding पूरा होने का इंतज़ार नहीं करती। Original video पहले available रहता है; HLS तैयार होने पर server record master playlist पर update होता है।

## 10. Player और intro

Player files:

```text
src/components/VideoPlayer.tsx
src/components/PlayerControls.tsx
src/components/BrandIntro.tsx
```

Player में play/pause, seek, ±10 seconds, mute, speed, fullscreen, quality, subtitles, next episode और resume playback हैं। Playback sequence है:

```text
Login check
→ key/VIP check
→ access allow
→ intro check
→ intro play
→ main video play
```

Website intro overlay के रूप में चलता है और original uploaded MP4 में automatically merge नहीं होता।

## 11. Direct और HLS playback

Upload के समय original video URL server में save होता है। Transcoding complete होने पर URL HLS master playlist पर बदलता है:

```text
/uploads/hls/ep_xxx/master.m3u8
```

Player Hls.js और browser native HLS fallback दोनों support करता है।

## 12. Download system

Download routes हैं:

```text
src/app/api/downloads/route.ts
src/app/api/downloads/with-intro/route.ts
```

Download से पहले login, current VIP membership, database-registered URL और secure file path check होते हैं। Large files range requests और streaming के साथ भेजी जाती हैं। `video_intro_download_enabled` ON होने पर intro और video का merged file तैयार होता है। Website intro और download intro अलग settings हैं।

## 13. Protected media

`src/proxy.ts` protected paths को `/api/media/[...path]` route पर rewrite करता है। इस route में authentication और realpath validation के बाद ही video stream होती है। इसलिए protected video को केवल direct public URL से bypass नहीं किया जा सकता।

## 14. Admin panel

Admin panel से anime, seasons, episodes, servers, users, VIP codes, keys, intro, transcoding, broadcasts, spotlight और reports manage किए जा सकते हैं। सभी sensitive admin APIs `/api/admin/*` के अंतर्गत हैं।

## 15. VPS deployment

`setup.sh` Node.js और FFmpeg install करता है, restricted `annime` user बनाता है, permissions set करता है, database migration और production build चलाता है, फिर PM2 और Nginx configure करता है। Production में app और FFmpeg को `root` user से नहीं चलाना चाहिए।

Setup दो PM2 processes चलाता है: `annime` web application और `annime-transcoder` persistent FFmpeg worker। SQLite का consistent daily backup सुबह 3:15 पर `data/backups/` में बनता है और default 14 दिन रखा जाता है। Manual backup के लिए `npm run backup` चलाया जा सकता है। Server request errors और worker events structured JSON logs में लिखे जाते हैं।

VPS पर पुराने FFmpeg jobs देखने के लिए:

```bash
ps aux | grep ffmpeg | grep -v grep
```

नई build deploy करने के बाद:

```bash
npm run build
pm2 restart annime
```

## 16. Complete workflow

```text
Admin upload
→ file validation
→ original file save
→ server/download records
→ auto-transcode setting check
→ ON होने पर queue
→ HLS variants और master playlist
→ server URL update
→ user login
→ key/VIP authorization
→ intro animation
→ protected video playback
```

इस flow में transcoding change ने login, key system, VIP download, intro authorization या media security को नहीं बदला है।
