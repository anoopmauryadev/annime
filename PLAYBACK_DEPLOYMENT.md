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

Upload forms now separate **Source quality** (Auto/360p/480p/720p/1080p) from
**Display quality** (a public badge, or no label). The source choice is stored
with each queued job; the display label is saved per episode and can be edited
without another upload. Anime's existing card badge remains separate.

With auto-transcoding ON, a selected source is prepared first at its actual
resolution. Compatible H.264 video is stream-copied to HLS; AAC audio is also
copied. Unsupported codecs are converted once at source resolution for browser
playback. Lower 360p/480p variants are then generated if below the selected
resolution; a 360p upload is not upscaled to 480p. Original MP4 reuses the
prepared source streams. A wrong source-height selection fails the job rather
than labelling HD as low quality; choose Auto for cropped/unknown resolutions.
Remuxed segment lengths follow existing keyframes and may exceed four seconds.
Auto-transcoding OFF still queues nothing. These changes do not reprocess old
uploads or retrofit source selections into previous jobs.

Original access switches independently control VIP and free viewers. When a
playable Original is unavailable, a completed existing 720p HLS rendition is
offered, or 1080p if 720p is unavailable. This does not create new HD renditions.
Free Auto stays on 360p/480p (360p only when free 480p is OFF). If neither is
ready, it waits and offers an explicit HD choice only when free Original is ON.
HD is never automatically substituted for free Auto.

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

The ready-to-use snippet is `deploy/nginx-protected-media.conf`. After pulling
this commit, copy it outside the app directory so deployments cannot change
the active Nginx configuration accidentally:

```bash
sudo install -m 644 deploy/nginx-protected-media.conf /etc/nginx/snippets/annime-protected-media.conf
```

Back up the actual site configuration identified by `nginx -T`, then add
`include /etc/nginx/snippets/annime-protected-media.conf;` inside its existing
site `server` block, alongside the `/uploads/` location, not inside it. Include
it in every server block that serves this application's uploads. Remove any
duplicate locations for these exact media prefixes before including it. Keep
the image alias and unrelated sites unchanged. Run `sudo nginx -t` and only
reload after it succeeds. This changes routing, not guest/key/VIP settings.
The local application access test does not validate the VPS Nginx config.

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

## Repair old uploads and missing 360p/480p

After deploying this version, preview missing renditions (no queue changes):

```bash
cd /var/www/annime
node scripts/repair-transcodes.cjs
```

To apply the reviewed repair list, stop the worker and back up first:

```bash
pm2 stop annime-transcoder &&
npm run backup &&
node scripts/repair-transcodes.cjs --apply &&
TRANSCODE_THREADS=2 pm2 restart annime-transcoder --update-env &&
pm2 save
```

The repair includes HLS servers whose old jobs were marked complete but lack
360p/480p. It reuses the same output folder and resets retries only for affected
jobs. A completed playlist with missing segments is repaired too. Valid finished
renditions remain untouched. Source files below 480p are not upscaled. Missing
or ambiguous originals are reported for manual mapping. No videos are deleted.
This explicit command can enqueue uploads originally made with transcoding OFF.
It refuses to apply while a worker lock belongs to a running process.

For unexplained delays, collect `pm2 logs annime-transcoder --lines 80 --nostream`
and the repair preview. FFmpeg errors are now retained in worker logs/job errors;
an exhausted retry count is reported as failed rather than left processing.

```bash
npm run build
node scripts/test-playback-access.mjs
```

The test uses disposable data, a local fixture video and port 3198. Set
`PLAYWRIGHT_MODULE` to an installed Playwright module to additionally run Chrome
checks for key-before-login, guest activation, 480p, Original Quality and return
to 360p. It does not modify the production database or contact a real shortener.
