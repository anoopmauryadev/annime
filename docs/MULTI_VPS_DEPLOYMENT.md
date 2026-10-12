# Multi-server rollout: Ubuntu VPS + Windows RDP machine

Updated: 19 September 2026. Code implemented locally; live rollout and measured
capacity are NOT verified. Bunny/VIP-CDN migration (plan step 7) is excluded.

## What this version does

- Main Ubuntu VPS retains the website, SQLite DB, login/key/VIP rules and uploads.
- Admin → Media Servers adds multiple HTTPS media origins, with independent API
  and playback signing keys. Nodes start disabled. Global playback routing and
  distributed transcoding are separate OFF-by-default switches.
- Small HLS playlists remain on the main authorization endpoint. Each segment or
  prepared Original MP4 is checked there, then redirected to a verified replica
  with a 90-second exact-file capability. Main-site cookies are never sent to nodes.
- Eligible nodes must be healthy within 20 seconds and have that exact file.
  Routing uses recent sessions, traffic, CPU and disk headroom. Drain permits
  current assignments; disabling playback stops assignments immediately.
- Hls.js reports a failed replica for its own session and retries at the current
  position. Nodes expire from routing on missing heartbeat. Local protected files
  remain the fallback. Native Safari/MP4 failover relies on retry/reload and health
  expiry; this is not a zero-interruption guarantee.
- A persistent SQLite queue splits each newly queued conversion into 360p, 480p,
  Original jobs. Any worker with the enabled profile can claim one job at a time.
  Leases expire after 90 seconds and renew every 10 seconds. Three attempts maximum;
  admin can retry a failed rendition. Completed 360p publishes before other jobs.
- Sources stream from the main VPS, outputs stream back to private staging, and
  completed renditions publish on main before replication. Main keeps a complete
  source/output copy for recovery. This consumes source/return bandwidth and is
  intentionally simpler than remote-only storage.
- Replication is checksum verified, paths are immutable on media nodes, and only
  confirmed files enter routing. Each background transfer is capped at 20 Mbps.
- Manual pause interrupts the current conversion; resume restarts that rendition.
  Already published qualities remain playable. Disabling new jobs alone does not
  pause an existing one. Automatic pressure control throttles to 10% of one core
  and waits for a 30-second recovery period before restoring quota.
- Linux uses delegated cgroup v2; Windows uses a Job Object CPU hard cap. A quota
  of 100 means one logical CPU, not the whole 8-core server. The worker refuses to
  run if its quota mechanism cannot initialize. Media serving runs separately.
- Nodes do not need SQLite, user accounts, website secrets, or the production DB.

## Current limitations and rollout gates

Local verification on 19 September: production build, TypeScript, media service
authorization/range/checksum tests, coordinator lease/failover tests, and actual
FFmpeg independent-rendition/duration tests passed. These are not live Windows or
Ubuntu service installation tests. Cluster controls remain OFF by default.

If an output folder contains an incomplete older rendition, publication refuses
to report success for it. Repair that job into a new output folder so immutable
replicas and existing viewers cannot receive mixed old/new segments.

1. No live machines have been accessed during this implementation. Windows Job
   Object behavior and Linux cgroup permissions need host verification before
   production enablement. Do not infer OS-level validation from a Mac build.
2. One transcode slot per node; profiles are 360p/480p/Original. Separate 720p
   encoding remains deferred per the existing future-plan requirement.
3. Replicator currently copies prepared HLS files to every enabled, non-draining
   node. It does not automatically evict files or implement a popular-video cache.
   Size storage for the library; no automatic source deletion is performed.
4. Health includes CPU, memory, free disk and traffic served by the media process.
   It does not yet measure all host NIC traffic, disk I/O latency, slow-segment
   histograms, or AWS CPU credits. Check CloudWatch/host metrics during rollout.
5. Main app/DB remains a single point of failure. Existing sessions, downloads and
   source copies still use the main VPS in some paths. Capacity requires sustained
   external tests; previous single-VPS tests are not a cluster capacity result.
6. Session counts approximate browser sessions (45-second activity window), not
   distinct people. Token revocation takes up to 90 seconds for an already-issued
   capability; new requests always recheck the website policy.
7. Cluster OFF returns playback to protected local serving. Distributed transcoding
   OFF releases/requeues remote work through the monitor before the local worker
   resumes it. Keep the monitor alive during this transition.

## Prepare the main Ubuntu VPS

Back up the DB, deploy the tested commit through the usual deployment procedure,
then confirm the website and local worker are healthy. Keep both cluster toggles OFF.
Do not replace the existing Nginx protected-media rules with a public file alias.

Run from `/var/www/annime` as the existing application user (normally ubuntu):

```bash
npm run backup
pm2 start scripts/cluster-monitor.cjs --name annime-cluster-monitor
pm2 start scripts/cluster-replicator.cjs --name annime-cluster-replicator
pm2 save
```

Run these `pm2 start` commands once; use `pm2 restart NAME` for existing processes.
The website initializes the new tables before these processes start. Schema changes
are additive. Do not copy the live DB to workers.

Create a DNS-only worker origin hostname pointing to this main VPS, with a valid
TLS certificate and the same Next.js upstream. Add `deploy/cluster/main-nginx.conf`
inside its HTTPS server block, then `sudo nginx -t` before reloading. Large uploads
must not travel through an intermediary with smaller body/time limits. The public
website domain, login cookies and SITE_ORIGIN stay unchanged. Worker authentication
uses its own headers, not website cookies. Never expose private staging with alias.

## Register each media machine

1. Choose one DNS hostname per machine, e.g. `media1.YOUR_DOMAIN`, `media2.YOUR_DOMAIN`.
2. Point DNS directly to that machine. Arrange TLS on port 443 and permit port 80
   only if needed for certificate issuance. Node itself binds only 127.0.0.1:4000.
3. Admin → Media Servers → enter name and HTTPS origin → Add server.
4. Save the returned NODE_ID, NODE_API_KEY and MEDIA_SIGNING_KEY locally on that
   machine. API/signing keys are shown only on creation. Do not send them in chat.
5. Create its env file from `deploy/cluster/node-env.example`, replacing every
   placeholder. CLUSTER_ORIGIN points to the main VPS worker origin; SITE_ORIGIN
   is `https://hindianimezone.fun`.
6. Reverse proxy using the provided Caddy example or equivalent Nginx. Restrict
   `/api/*` at the media origin to the main VPS outbound address. Public `/media/*`
   remains reachable but requires signed tokens. Never configure static root/alias.

## Ubuntu media VPS

Install supported Node.js (22 or newer), FFmpeg, Git and an HTTPS reverse proxy.
Clone the repository to `/opt/annime`; media scripts use Node built-ins and do not
need `npm ci` or a Next.js build on the media machine.

```bash
sudo useradd --system --create-home --home-dir /var/lib/annime-media annime-media
sudo install -d -o annime-media -g annime-media -m 700 /var/lib/annime-media/media /var/lib/annime-media/work
sudo install -d -m 750 /etc/annime
```

If the user already exists, skip useradd. Create `/etc/annime/media-node.env` from
the example, protect it (`root:annime-media`, mode 640), and confirm that
`/usr/bin/node` is the installed Node executable. Copy the service templates:

```bash
sudo cp deploy/cluster/annime-media.service /etc/systemd/system/
sudo cp deploy/cluster/annime-media-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now annime-media annime-media-worker
sudo systemctl status annime-media annime-media-worker --no-pager
sudo journalctl -u annime-media-worker -n 40 --no-pager
```

Keep repository readable by the service user; only `/var/lib/annime-media` needs
write access. CPU delegation requires cgroup v2/systemd; verify the service starts
without permission errors before enabling distributed jobs. Do not run this worker
under ordinary PM2: it needs its dedicated delegated systemd service.

## Windows machine accessed through RDP

RDP is the access method, not the streaming endpoint. The machine needs a stable
reachable HTTPS hostname, inbound networking permission, adequate disk, and a
Windows account allowed to run background tasks even after RDP disconnect/logoff.

1. Install Node.js 22+, FFmpeg/ffprobe and Git. Make them available in the service
   account's PATH, not only a temporary interactive terminal.
2. Clone the repository to `C:\annime`. No Next.js build or npm install is needed
   for the two node/worker scripts.
3. Create `C:\annime\media-node.env` from the example. Use e.g.:

```text
MEDIA_DIR=C:/AnnimeData/media
TRANSCODE_WORK_DIR=C:/AnnimeData/work
```

4. Create those folders and give a dedicated Windows service account Modify access
   to them and `C:\annime\data\node-logs`; give it Read/Execute on the repository.
5. Configure the HTTPS reverse proxy as a persistent Windows service, with the
   same API restrictions above. Opening RDP port 3389 alone is insufficient.
6. From elevated PowerShell, register startup tasks:

```powershell
cd C:\annime
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\cluster\install-windows.ps1
Start-ScheduledTask -TaskName AnimeZone-media
Start-ScheduledTask -TaskName AnimeZone-worker
Get-ScheduledTaskInfo -TaskName AnimeZone-media
Get-ScheduledTaskInfo -TaskName AnimeZone-worker
Get-Content .\data\node-logs\worker.log -Tail 40
```

The installer asks for the service account credentials locally and gives env-file
read access only to that account, Administrators and SYSTEM. Never paste its
password into chat or Git. Grant “Log on as a batch job” if your Windows policy
requires it. If the provider disallows Job Objects or background service tasks,
use this node for streaming only; leave its transcoding toggle OFF until resolved.
Check task operation after disconnect and after a controlled reboot.

## Enable in stages

1. Main monitor reports node Online; both global switches still OFF.
2. Enable playback on that node, then global Cluster ON. Replicator begins copying
   existing prepared files. Missing replicas continue using protected local files.
3. Confirm a free/guest authorized 360p request works and original/HD remains gated
   according to the existing admin policy. Direct unsigned media-node URL must 403.
4. Confirm a segment returns a 307 to that node and the final response is 200/206.
   Playlists continue on the main domain intentionally.
5. Select node profiles and Accept new transcode jobs; enable Distributed
   transcoding only after the CPU-cap smoke check. Upload a short test clip through
   the existing admin form with auto-transcoding ON.
6. Check 360p appears first, then 480p and Original. OFF at upload must queue nothing.
7. Add the second node identically; verify failure tests below before adding more.

## Tests before increasing user limits

Local code tests:

```bash
node --test scripts/test-cluster.cjs
node scripts/test-cluster-control.mjs
node scripts/test-playback-access.mjs
npm run build
```

From an independent machine (replace playlist with a permitted real quality URL):

```bash
LOAD_TEST_LEVELS="10,25,50" \
LOAD_TEST_MEDIA_ORIGINS="https://media1.YOUR_DOMAIN,https://media2.YOUR_DOMAIN" \
LOAD_TEST_PLAYLIST="https://hindianimezone.fun/uploads/hls/REAL_FOLDER/480p.m3u8" \
node scripts/load-test-playback.mjs
```

Provide LOAD_TEST_COOKIE only locally if that episode requires access. The script
uses a unique media session per simulated viewer and follows only explicitly
allowed media origins without forwarding website cookies. Default transfer budget
remains 2 GiB. Do not interpret transfer-limit aborts as measured server saturation.

Before 100/200/300 targets: test multiple episodes, sustained playback, simultaneous
transcoding and replication, seeking, fresh and warm files, and mixed qualities.
Test drain (new viewers move), disconnect (existing HLS retries use another node or
local source), expired/modified tokens, free-vs-VIP access, worker termination,
lease expiry, pause/resume and restart. Verify CPU quota on each real OS. Record
host network, CPU credits (AWS), disk latency, segment delays and errors. Use
multiple load generators; a single RDP or VPS-originated test is insufficient.

## References for host CPU controls

- https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_cpu_rate_control_information
- https://github.com/systemd/systemd/blob/main/docs/CGROUP_DELEGATION.md
