# VPS playback update

This update keeps Bunny integration code but serves playback locally. The new
`bunny_playback_enabled` setting defaults to `0`, even if old Bunny environment
variables are still present. The new `playback_login_required` setting defaults
to `1` to preserve the existing login requirement. Configure **Admin →
Settings → Playback access** to allow guests after key verification.

## Admin playback controls

- **All episodes without login**: guests may watch all episodes after the key
  check (when keys are enabled).
- **First 2 episodes without login**: guests may watch only the first two
  episodes per anime, ordered across seasons. Later episodes require login.
- These guest switches are mutually exclusive. Turn the active one OFF before
  enabling the other. Both OFF means every episode requires login. A single
  persisted mode prevents contradictory settings.
- **480p for free users** OFF leaves free viewers with 360p; VIP may still use
  prepared 480p. This does not turn off 480p transcoding.
- **Original Quality for VIP** OFF blocks Original playback even for VIP.
  Separate VIP download settings remain unchanged. Files are not deleted.

Quality restrictions also apply to direct media requests, not just player menus.
Existing guest access preferences are preserved when upgrading.

## Live activity and video analytics

Admin Dashboard shows active site users and currently watching users. **Admin →
Video Analytics** adds episode popularity, total/average watch time, furthest
watched position, sessions reaching 95%, hourly viewing, recent sessions and
30-second viewing intervals for a selected episode. Filters cover 1/7/30/90 days.

Live counts refresh every 15 seconds and expire after 45 seconds without a
heartbeat. Guests are estimated by browser; signed-in live users by account.
Watch time excludes detected seeks and buffering; reaching 95% does not prove
every earlier second was watched. Client telemetry is approximate and excludes
external iframe players. Detailed recording starts after deployment; historical
page views cannot reconstruct past watching. Raw sessions are retained for 90
days and cleaned up during activity. Reports list up to 200 episodes and 100
recent sessions. Analytics endpoints require admin access; playback samples
require the same episode access as the player.

## Access rules

| Viewer | Key ON | Key OFF |
| --- | --- | --- |
| Guest, login required ON | Key first, then login | Login |
| Guest, login required OFF | Key, then 360p/480p | 360p/480p |
| Logged-in non-VIP | Key, then 360p/480p | 360p/480p |
| Logged-in VIP | 360p/480p and ready Original Quality | Same |

Guest passes belong to the browser cookie. Clearing cookies or using another
browser requires another key. Admin revocation and expiry are checked on media
requests. Original files, higher-quality HLS segments and downloads require VIP
on the server, not just in the player. Existing anonymous page views continue
to contribute to the existing counter; this is a visit counter, not unique viewers.

## Transcoding

New uploads with auto-transcoding ON are processed sequentially: 360p, 480p,
then Original Quality MP4. Each finished low-quality rendition is published
immediately. The player checks for newly available renditions every 10 seconds.
Original Quality preserves source resolution; compatible H.264/AAC streams are
copied, unsupported codecs are encoded to H.264/AAC. Re-encoding can change
visual quality and consumes CPU. Corrupt files may fail; unfinished files are
never advertised as ready.

The worker uses a persisted queue, one job at a time, low CPU priority and one
thread by default (maximum two). CPU usage is reduced, not eliminated. Completed
renditions are retained through retries/restarts.

Uploads made while auto-transcoding is OFF are not queued. Turning it ON later
does not process them. They have no free playback until a low-quality rendition
is prepared. Browser-native MP4/WebM originals without a conversion job remain
available to VIP; their codecs must be supported by the viewer's browser.

Existing HLS is not automatically re-encoded. Its 360p remains available; old
720p/1080p is removed from the adaptive playlist and blocked for non-VIP requests.
Existing files do not magically gain 480p or a converted Original Quality file.
`npm run transcode` is an explicit backfill for original uploads without an
existing pending/processing/completed job; it does not rebuild finished HLS.

## Deploy after these code changes are pushed to your repository

Run as the existing `ubuntu` user, not root or the nonexistent `annime` user.
Back up the database before deploying. Stop only this site's processes during
the build; this creates a short maintenance window.

```bash
cd /var/www/annime
npm run backup
pm2 stop annime-transcoder
pm2 stop annime
git pull --ff-only origin main
npm ci
npm run build
TRANSCODE_WORKER_MODE=external BUNNY_CDN_ENABLED=0 BUNNY_STORAGE_ENABLED=0 pm2 restart annime --update-env
TRANSCODE_THREADS=1 BUNNY_STORAGE_ENABLED=0 pm2 restart annime-transcoder --update-env
pm2 save
pm2 status
curl -I http://127.0.0.1:3000
```

Stop if pull/install/build fails; do not start an unsuccessful build. The new
database table/settings are created automatically by the app. No video files
are deleted or re-encoded just by deploying.

If Nginx has a static `alias`/`root` location for `/uploads/hls/`,
`/uploads/videos/` or `/uploads/downloads/`, it must forward those requests to
the app instead. Otherwise Nginx bypasses the application's VIP/key checks.
Check the actual VPS configuration before changing it:

```bash
sudo nginx -T
```

Apply this pattern inside the existing site server block, replacing any
conflicting media locations (keep existing unrelated configuration):

```nginx
location ^~ /uploads/hls/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_cache off;
}
```

Use the same pattern for `/uploads/videos/` and `/uploads/downloads/`. Validate
with `sudo nginx -t` before `sudo systemctl reload nginx`. Exclude media and
authenticated routes from any Cloudflare cache-everything rule. The retired
Bunny zone may still contain old cached public files; disabling delivery in
the app does not delete or protect those historical CDN copies. Disable that
Pull Zone separately if it should no longer serve them.

## Verification

```bash
npm run build
node scripts/test-playback-access.mjs
```

The test uses disposable data, a local fixture video and port 3198. Set
`PLAYWRIGHT_MODULE` to an installed Playwright module to additionally run Chrome
checks for key-before-login, guest activation, 480p, Original Quality and return
to 360p. It does not modify the production database or contact a real shortener.
