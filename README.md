# Anime Zone

Anime streaming website with a full admin panel, multi-quality HLS playback, VIP and
access-key gating, and optional AWS storage, transcoding and CDN delivery.

## Features

- **Catalog**: anime and movies with seasons, episodes, genres, A–Z browsing, search,
  spotlight banner and top-10 trending.
- **Player**: HLS adaptive playback (360p / 480p) with an Original-quality option, a branded
  intro, continue watching and watch history.
- **Access control**: login, time-limited access keys, guest preview of the first episodes,
  VIP membership, VIP codes and optional free downloads. Every media request is authorized
  by the server.
- **Community**: comments, watchlist, problem reports and site-wide announcements.
- **Admin panel**: upload (resumable, up to 10 GB), transcode status, playback rules,
  analytics, users, keys, maintenance mode.
- **Media pipeline**: FFmpeg transcoding on the server, or AWS MediaConvert. Files can be
  stored on the server or in a private S3 bucket and delivered through CloudFront signed URLs.
- **Scaling**: optional media-node cluster for distributed delivery and transcoding.

## Tech stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, SQLite (`better-sqlite3`),
hls.js, FFmpeg, PM2, Nginx, and the AWS SDK (S3, MediaConvert, CloudFront).

## Architecture

```
Browser ── Nginx ── Next.js app (pages, API, auth, playback rules) ── SQLite
                │            │
                │            ├── transcode-worker (FFmpeg)        PM2 processes
                │            └── cloud-worker (MediaConvert, S3 sync)
                │
                └── Videos: local disk, or S3 / CloudFront via short-lived signed links
```

The app always checks login, key and VIP rules before it serves a playlist or hands out a
signed link. The S3 bucket stays private.

## Getting started

Requirements: Node.js 22+, FFmpeg (`ffmpeg` and `ffprobe` on `PATH`).

```bash
npm install
```

Create `.env.local`:

```
# Signs admin and user sessions. Required in production.
ADMIN_SECRET_KEY=<random string, at least 32 characters>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_VIDEO_BASE_URL=http://localhost:3000
```

```bash
npm run dev
```

The database is created in `data/anime.db` on first start. The first admin login is
written to `data/admin-bootstrap.txt`. Delete that file after you change the password.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | Develop, build and run the app |
| `npm run transcode:worker` | FFmpeg transcode worker |
| `npm run cloud:worker` | AWS MediaConvert and S3 sync worker |
| `npm run cloud:migrate` | Upload existing local videos to S3 once |
| `npm run backup` | Back up the SQLite database |
| `npm run lint` | ESLint |

Tests live in `scripts/test-*.{mjs,cjs}` and run with `node`, for example
`node scripts/test-cloud-delivery.cjs` and `node scripts/test-playback-access.mjs`
(the latter needs FFmpeg and a production build).

## Project structure

```
src/app/(public)   Public pages (home, anime, watch, account, …)
src/app/admin      Admin panel
src/app/api        API routes, including /api/media (authorized media gateway)
src/components     UI components and the video player
src/lib            Database, auth, playback rules, uploads, cloud storage
scripts/           Workers, migrations, maintenance scripts and tests
deploy/            Nginx snippets, cluster and media-node files
docs/              Deployment and operations guides
setup.sh           One-command Ubuntu server installer
```

## Deployment

- New AWS account to live site, step by step: [docs/AWS_FULL_SETUP_GUIDE.md](docs/AWS_FULL_SETUP_GUIDE.md)
- AWS storage, CDN and transcoding reference: [docs/AWS_S3_DEPLOYMENT.md](docs/AWS_S3_DEPLOYMENT.md)
- Updating a running server and playback rules: [docs/PLAYBACK_DEPLOYMENT.md](docs/PLAYBACK_DEPLOYMENT.md)
- Multi-server media cluster: [docs/MULTI_VPS_DEPLOYMENT.md](docs/MULTI_VPS_DEPLOYMENT.md)
- System overview: [docs/ANIME_ZONE_SYSTEM_GUIDE.md](docs/ANIME_ZONE_SYSTEM_GUIDE.md)
