/**
 * WatchAnimeWorld Scraper
 * Extracts anime metadata, episodes, and video streaming embed links (Server 1, Server 2, Multi-audio Hindi/Eng/Jap)
 * Usage: node scripts/scrape_animeworld.mjs [--limit=5] [--save-db] [--export-json]
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'anime.db');

const BASE_URL = 'https://watchanimeworld.one';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

async function fetchHtml(url) {
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    console.error(`  [!] Error fetching ${url}: ${err.message}`);
    return null;
  }
}

// 1. Get list of series / movies URLs from archive pages
async function getAnimeUrls(limit = 10) {
  console.log('🔍 Fetching series list from WatchAnimeWorld...');
  const urls = new Set();
  
  // Scrape page 1 of series
  const seriesHtml = await fetchHtml(`${BASE_URL}/series/`);
  if (seriesHtml) {
    const matches = seriesHtml.matchAll(/href=["'](https:\/\/watchanimeworld\.one\/series\/[^"'#?]+)\/["']/g);
    for (const m of matches) {
      const u = m[1].replace(/\/$/, '') + '/';
      if (!u.includes('/page/')) urls.add(u);
      if (urls.size >= limit) break;
    }
  }

  // Scrape page 1 of movies
  if (urls.size < limit) {
    const moviesHtml = await fetchHtml(`${BASE_URL}/movies/`);
    if (moviesHtml) {
      const matches = moviesHtml.matchAll(/href=["'](https:\/\/watchanimeworld\.one\/movies\/[^"'#?]+)\/["']/g);
      for (const m of matches) {
        const u = m[1].replace(/\/$/, '') + '/';
        if (!u.includes('/page/')) urls.add(u);
        if (urls.size >= limit) break;
      }
    }
  }

  return Array.from(urls).slice(0, limit);
}

// 2. Extract single anime detail & episode links
async function scrapeAnimeDetail(animeUrl) {
  console.log(`\n📥 Scraping anime: ${animeUrl}`);
  const html = await fetchHtml(animeUrl);
  if (!html) return null;

  // Title
  const titleMatch = html.match(/<h1[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([^<]+)<\/h1>/i) 
    || html.match(/<title>([^<|-]+)/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Unknown Anime';

  // Slug from URL
  const slug = animeUrl.replace(/https?:\/\/watchanimeworld\.one\/(series|movies)\//, '').replace(/\/$/, '');

  // Poster
  const posterMatch = html.match(/class=["'][^"']*poster[^"']*["'][^>]*src=["']([^"']+)["']/i)
    || html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  const poster = posterMatch ? posterMatch[1] : '';

  // Synopsis
  const synopsisMatch = html.match(/<div[^>]*class=["'][^"']*(description|entry-content|synopsis)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
    || html.match(/property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  let synopsis = '';
  if (synopsisMatch) {
    synopsis = synopsisMatch[2] ? synopsisMatch[2].replace(/<[^>]+>/g, '').trim() : synopsisMatch[1].trim();
  }

  // Genres
  const genres = [];
  const genreMatches = html.matchAll(/\/category\/genre\/([^/"']+)/g);
  for (const gm of genreMatches) {
    const g = decodeURIComponent(gm[1]).replace(/-/g, ' ');
    const capitalized = g.charAt(0).toUpperCase() + g.slice(1);
    if (!genres.includes(capitalized)) genres.push(capitalized);
  }

  // Languages
  const languages = [];
  const langMatches = html.matchAll(/\/category\/language\/([^/"']+)/g);
  for (const lm of langMatches) {
    const l = decodeURIComponent(lm[1]);
    const capitalized = l.charAt(0).toUpperCase() + l.slice(1);
    if (!languages.includes(capitalized)) languages.push(capitalized);
  }
  if (languages.length === 0) languages.push('Hindi', 'English', 'Japanese');

  // Year & Rating
  const yearMatch = html.match(/\/release-year\/(\d{4})/i) || html.match(/\b(20\d\d)\b/);
  const year = yearMatch ? parseInt(yearMatch[1]) : 2024;
  const ratingMatch = html.match(/<span[^>]*class=["'][^"']*rating[^"']*["'][^>]*>([\d.]+)</i)
    || html.match(/(\d\.\d)\s*\/\s*10/);
  const rating = ratingMatch ? ratingMatch[1] : '8.0';

  const type = animeUrl.includes('/movies/') ? 'movie' : 'series';

  // Episode Links
  const episodeLinks = [];
  const epMatches = html.matchAll(/href=["'](https:\/\/watchanimeworld\.one\/episode\/[^"'#?]+)\/["']/g);
  for (const em of epMatches) {
    const u = em[1].replace(/\/$/, '') + '/';
    if (!episodeLinks.includes(u)) episodeLinks.push(u);
  }

  console.log(`  ✓ Title: "${title}" | Type: ${type} | Episodes found: ${episodeLinks.length}`);

  // Scrape each episode's streaming embed servers
  const episodes = [];
  for (let i = 0; i < episodeLinks.length; i++) {
    const epUrl = episodeLinks[i];
    const epData = await scrapeEpisode(epUrl, i + 1);
    if (epData) episodes.push(epData);
    // Be polite with rate limit
    await new Promise(r => setTimeout(r, 400));
  }

  return {
    title,
    slug,
    type,
    poster,
    backdrop: poster,
    synopsis,
    year,
    rating,
    status: 'completed',
    languages,
    genres,
    quality: 'HD',
    is_spotlight: 1,
    priority: 50,
    episodes,
  };
}

// 3. Extract episode streaming servers (Server 1, Server 2, short.icu, zephyrix, etc.)
async function scrapeEpisode(epUrl, defaultEpNum) {
  const html = await fetchHtml(epUrl);
  if (!html) return null;

  // Episode number and title
  const epCodeMatch = epUrl.match(/-(\d+)x(\d+)\/$/);
  const seasonNum = epCodeMatch ? parseInt(epCodeMatch[1]) : 1;
  const episodeNum = epCodeMatch ? parseInt(epCodeMatch[2]) : defaultEpNum;

  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || html.match(/<title>([^<|-]+)/i);
  const title = titleMatch ? titleMatch[1].trim() : `Episode ${episodeNum}`;

  const servers = [];

  // Method A: Direct iframe src or data-src
  const iframeMatches = html.matchAll(/<iframe[^>]+(src|data-src)=["']([^"']+)["'][^>]*>/gi);
  for (const im of iframeMatches) {
    const src = im[2];
    if (src && !src.includes('telegram') && !src.includes('facebook') && !src.includes('disqus')) {
      if (src.includes('player1.php?data=')) {
        // Method B: Base64 multi-audio payload!
        try {
          const encoded = src.split('player1.php?data=')[1];
          if (encoded) {
            const decoded = decodeURIComponent(encoded);
            const jsonStr = Buffer.from(decoded, 'base64').toString('utf-8');
            const items = JSON.parse(jsonStr);
            items.forEach((item) => {
              servers.push({
                name: `Server - ${item.language || 'Multi'} Dub`,
                type: 'embed',
                url: item.link.replace(/\\\//g, '/'),
              });
            });
          }
        } catch (e) {
          // ignore parse error
        }
      } else {
        servers.push({
          name: servers.length === 0 ? 'Server 1 - Main' : `Server ${servers.length + 1}`,
          type: 'embed',
          url: src,
        });
      }
    }
  }

  // De-duplicate servers
  const uniqueServers = [];
  const seenUrls = new Set();
  for (const s of servers) {
    if (!seenUrls.has(s.url)) {
      seenUrls.add(s.url);
      uniqueServers.push(s);
    }
  }

  console.log(`    -> Ep ${seasonNum}x${episodeNum}: Found ${uniqueServers.length} streaming servers`);

  return {
    season_number: seasonNum,
    episode_number: episodeNum,
    title,
    servers: uniqueServers,
  };
}

// 4. Save to SQLite Database
function saveToDatabase(animeList) {
  console.log(`\n💾 Inserting ${animeList.length} scraped anime into database...`);
  const db = new Database(dbPath);

  const insertAnime = db.prepare(`
    INSERT INTO anime (title, slug, type, poster, backdrop, synopsis, year, rating, status, languages, genres, quality, is_spotlight, priority, views)
    VALUES (@title, @slug, @type, @poster, @backdrop, @synopsis, @year, @rating, @status, @languages, @genres, @quality, @is_spotlight, @priority, @views)
  `);

  const insertSeason = db.prepare(`
    INSERT INTO seasons (anime_id, season_number, title) VALUES (?, ?, ?)
  `);

  const insertEpisode = db.prepare(`
    INSERT INTO episodes (anime_id, season_id, episode_number, title) VALUES (?, ?, ?, ?)
  `);

  const insertServer = db.prepare(`
    INSERT INTO servers (episode_id, server_name, server_type, stream_url, server_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const anime of animeList) {
      // Check existing
      const existing = db.prepare('SELECT id FROM anime WHERE slug = ?').get(anime.slug);
      let animeId;
      if (existing) {
        animeId = existing.id;
        console.log(`  [~] Updating existing: ${anime.title}`);
      } else {
        const res = insertAnime.run({
          title: anime.title,
          slug: anime.slug,
          type: anime.type,
          poster: anime.poster,
          backdrop: anime.backdrop,
          synopsis: anime.synopsis,
          year: anime.year,
          rating: anime.rating,
          status: anime.status,
          languages: JSON.stringify(anime.languages),
          genres: JSON.stringify(anime.genres),
          quality: anime.quality,
          is_spotlight: anime.is_spotlight,
          priority: anime.priority,
          views: 1200,
        });
        animeId = res.lastInsertRowid;
        console.log(`  [+] Created anime: ${anime.title} (ID: ${animeId})`);
      }

      // Seasons map
      const seasonsMap = new Map();
      for (const ep of anime.episodes) {
        const sNum = ep.season_number || 1;
        if (!seasonsMap.has(sNum)) {
          let sRow = db.prepare('SELECT id FROM seasons WHERE anime_id = ? AND season_number = ?').get(animeId, sNum);
          if (!sRow) {
            const sRes = insertSeason.run(animeId, sNum, `Season ${sNum}`);
            sRow = { id: sRes.lastInsertRowid };
          }
          seasonsMap.set(sNum, sRow.id);
        }
        const seasonId = seasonsMap.get(sNum);

        // Episode
        let epRow = db.prepare('SELECT id FROM episodes WHERE anime_id = ? AND season_id = ? AND episode_number = ?')
          .get(animeId, seasonId, ep.episode_number);
        let epId;
        if (!epRow) {
          const epRes = insertEpisode.run(animeId, seasonId, ep.episode_number, ep.title);
          epId = epRes.lastInsertRowid;
        } else {
          epId = epRow.id;
        }

        // Servers
        for (let i = 0; i < ep.servers.length; i++) {
          const srv = ep.servers[i];
          const exists = db.prepare('SELECT id FROM servers WHERE episode_id = ? AND stream_url = ?').get(epId, srv.url);
          if (!exists) {
            insertServer.run(epId, srv.name, srv.type, srv.url, i);
          }
        }
      }
    }
  });

  tx();
  console.log('✅ All scraped anime, episodes, and video streaming servers saved into database!');
}

// 5. Main Execution
async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 3;

  console.log(`=============================================`);
  console.log(`🚀 WatchAnimeWorld Scraper Starting (Limit: ${limit})`);
  console.log(`=============================================`);

  const urls = await getAnimeUrls(limit);
  console.log(`Found ${urls.length} anime URLs to scrape.`);

  const scrapedData = [];
  for (const u of urls) {
    const item = await scrapeAnimeDetail(u);
    if (item) scrapedData.push(item);
  }

  // Save JSON
  const jsonPath = path.join(__dirname, '..', 'data', 'scraped_anime.json');
  await fs.writeFile(jsonPath, JSON.stringify(scrapedData, null, 2));
  console.log(`\n📄 Exported JSON: ${jsonPath}`);

  // Save into DB
  saveToDatabase(scrapedData);
  console.log(`\n🎉 Scraping and database import complete!`);
}

main().catch(console.error);
