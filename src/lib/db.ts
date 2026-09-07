import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const DB_PATH = path.join(process.cwd(), "data", "anime.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initializeDatabase(_db);
  }
  return _db;
}

function initializeDatabase(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT DEFAULT '',
      is_vip INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      anime_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, anime_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS anime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL DEFAULT 'series',
      poster TEXT DEFAULT '',
      backdrop TEXT DEFAULT '',
      thumbnail TEXT DEFAULT '',
      synopsis TEXT DEFAULT '',
      year INTEGER DEFAULT 2024,
      rating TEXT DEFAULT '',
      status TEXT DEFAULT 'ongoing',
      languages TEXT DEFAULT '[]',
      genres TEXT DEFAULT '[]',
      quality TEXT DEFAULT 'HD',
      is_spotlight INTEGER DEFAULT 0,
      priority INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL,
      season_number INTEGER NOT NULL DEFAULT 1,
      title TEXT DEFAULT '',
      FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL,
      season_id INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      title TEXT DEFAULT '',
      thumbnail TEXT DEFAULT '',
      duration TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE,
      FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER NOT NULL,
      server_name TEXT NOT NULL DEFAULT 'Server 1',
      server_type TEXT NOT NULL DEFAULT 'embed',
      stream_url TEXT NOT NULL,
      server_order INTEGER DEFAULT 0,
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER NOT NULL,
      quality TEXT NOT NULL DEFAULT '720p',
      download_url TEXT NOT NULL,
      file_size TEXT DEFAULT '',
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS episode_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS server_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER NOT NULL,
      server_id INTEGER,
      issue_type TEXT NOT NULL,
      details TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transcode_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER,
      server_id INTEGER,
      status TEXT DEFAULT 'pending',
      progress_text TEXT DEFAULT 'Queued',
      error TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS watch_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      anime_id INTEGER NOT NULL,
      episode_id INTEGER NOT NULL,
      progress_seconds REAL DEFAULT 0,
      duration_seconds REAL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE,
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
      UNIQUE(user_id, anime_id)
    );

    CREATE TABLE IF NOT EXISTS site_broadcasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      theme TEXT DEFAULT 'orange',
      icon TEXT DEFAULT 'sparkles',
      btn_text TEXT DEFAULT '',
      btn_url TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      dismissible INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS access_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_code TEXT UNIQUE NOT NULL,
      claim_token TEXT UNIQUE,
      user_id INTEGER,
      used_by_user_id INTEGER,
      status TEXT DEFAULT 'pending',
      duration_hours INTEGER DEFAULT 48,
      activated_at TEXT,
      expires_at TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_anime_slug ON anime(slug);
    CREATE INDEX IF NOT EXISTS idx_anime_type ON anime(type);
    CREATE INDEX IF NOT EXISTS idx_anime_priority ON anime(priority DESC);
    CREATE INDEX IF NOT EXISTS idx_anime_spotlight ON anime(is_spotlight);
    CREATE INDEX IF NOT EXISTS idx_episodes_anime ON episodes(anime_id);
    CREATE INDEX IF NOT EXISTS idx_episodes_season ON episodes(season_id);
    CREATE INDEX IF NOT EXISTS idx_servers_episode ON servers(episode_id);
    CREATE INDEX IF NOT EXISTS idx_downloads_episode ON downloads(episode_id);
    CREATE INDEX IF NOT EXISTS idx_comments_episode ON episode_comments(episode_id);
    CREATE INDEX IF NOT EXISTS idx_reports_episode ON server_reports(episode_id);
    CREATE INDEX IF NOT EXISTS idx_transcode_server ON transcode_jobs(server_id);
    CREATE INDEX IF NOT EXISTS idx_watch_history_user ON watch_history(user_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_broadcasts_active ON site_broadcasts(is_active);
    CREATE INDEX IF NOT EXISTS idx_access_keys_code ON access_keys(key_code);
    CREATE INDEX IF NOT EXISTS idx_access_keys_claim ON access_keys(claim_token);
    CREATE INDEX IF NOT EXISTS idx_access_keys_used_by ON access_keys(used_by_user_id);

    CREATE TABLE IF NOT EXISTS vip_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      duration_days INTEGER NOT NULL DEFAULT 30,
      is_used INTEGER NOT NULL DEFAULT 0,
      used_by_user_id INTEGER,
      used_by_username TEXT,
      used_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      notes TEXT DEFAULT '',
      FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vip_codes_code ON vip_codes(code);
    CREATE INDEX IF NOT EXISTS idx_vip_codes_used ON vip_codes(is_used);
  `);

  // Migration: Add is_vip, key_expires_at, and vip_expires_at columns to users table if they don't exist
  try {
    db.exec("ALTER TABLE users ADD COLUMN is_vip INTEGER DEFAULT 0");
  } catch {
    // Column already exists, safe to ignore
  }

  try {
    db.exec("ALTER TABLE users ADD COLUMN key_expires_at TEXT");
  } catch {
    // Column already exists, safe to ignore
  }

  try {
    db.exec("ALTER TABLE users ADD COLUMN vip_expires_at TEXT");
  } catch {
    // Column already exists, safe to ignore
  }

  // Seed default site settings if not present
  const defaultSettings: Record<string, string> = {
    telegram_url: "https://t.me/",
    telegram_text: "Join Official Telegram for latest Hindi & Multi-Audio releases!",
    telegram_btn_text: "Join",
    telegram_enabled: "1",
    key_system_enabled: "1",
    shortener_provider: "gplinks",
    shortener_api_url: "https://gplinks.in/api",
    shortener_api_token: "",
    key_duration_hours: "48",
    vip_store_url: "https://t.me/",
    video_intro_enabled: "1",
    video_intro_url: "/brand/anime-zone-intro-4k.mp4",
    video_intro_download_enabled: "0",
  };
  const insertSetting = db.prepare(
    "INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)"
  );
  for (const [key, val] of Object.entries(defaultSettings)) {
    insertSetting.run(key, val);
  }

  // Seed admin user if not exists
  const adminExists = db
    .prepare("SELECT id FROM admin_users WHERE username = ?")
    .get("admin");
  if (!adminExists) {
    const hash = bcrypt.hashSync("admin123", 10);
    db.prepare("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)").run(
      "admin",
      hash
    );
  }

  // Seed sample anime if empty
  const count = db.prepare("SELECT COUNT(*) as c FROM anime").get() as { c: number };
  if (count.c === 0) {
    seedSampleData(db);
  }
}

function seedSampleData(db: Database.Database) {
  const animeData = [
    {
      title: "Kuroko's Basketball",
      slug: "kurokos-basketball",
      type: "series",
      synopsis:
        "Kagami Taiga has just enrolled into Seirin High School when he meets Kuroko Tetsuya of the school's basketball team. Kuroko happens to be the shadowy sixth member of the legendary Generation of Miracles basketball team.",
      year: 2012,
      rating: "8.0",
      status: "completed",
      languages: JSON.stringify(["Hindi", "English", "Japanese"]),
      genres: JSON.stringify(["Comedy", "Drama", "School", "Shounen", "Sports"]),
      quality: "HD",
      is_spotlight: 1,
      priority: 90,
      views: 15420,
    },
    {
      title: "Dragon Ball Super: Super Hero",
      slug: "dragon-ball-super-super-hero",
      type: "movie",
      synopsis:
        "The Red Ribbon Army was once destroyed by Son Goku. Individuals who carry on its spirit have created the ultimate androids - Gamma 1 and Gamma 2.",
      year: 2022,
      rating: "7.5",
      status: "completed",
      languages: JSON.stringify(["Hindi", "English", "Japanese"]),
      genres: JSON.stringify(["Action", "Adventure", "Fantasy"]),
      quality: "HD",
      is_spotlight: 1,
      priority: 95,
      views: 24500,
    },
    {
      title: "Jujutsu Kaisen",
      slug: "jujutsu-kaisen",
      type: "series",
      synopsis:
        "Yuji Itadori is a boy with tremendous physical strength. He lives a normal high school life, but one day everything changes when he encounters a cursed object.",
      year: 2020,
      rating: "8.7",
      status: "ongoing",
      languages: JSON.stringify(["Hindi", "English", "Japanese"]),
      genres: JSON.stringify(["Action", "Fantasy", "Shounen", "Supernatural"]),
      quality: "HD",
      is_spotlight: 1,
      priority: 100,
      views: 52000,
    },
    {
      title: "Demon Slayer",
      slug: "demon-slayer",
      type: "series",
      synopsis:
        "Tanjiro Kamado is a kindhearted boy who sells charcoal for a living. One day, his family is slaughtered by a demon and his younger sister Nezuko is turned into one.",
      year: 2019,
      rating: "8.6",
      status: "ongoing",
      languages: JSON.stringify(["Hindi", "English", "Japanese", "Tamil"]),
      genres: JSON.stringify(["Action", "Fantasy", "Shounen"]),
      quality: "HD",
      is_spotlight: 1,
      priority: 98,
      views: 48000,
    },
    {
      title: "One Piece",
      slug: "one-piece",
      type: "series",
      synopsis:
        "Monkey D. Luffy sets off on an adventure to find the fabled treasure One Piece and become the King of the Pirates.",
      year: 1999,
      rating: "8.9",
      status: "ongoing",
      languages: JSON.stringify(["Hindi", "English", "Japanese"]),
      genres: JSON.stringify(["Action", "Adventure", "Comedy", "Shounen"]),
      quality: "HD",
      is_spotlight: 0,
      priority: 85,
      views: 67000,
    },
    {
      title: "Attack on Titan",
      slug: "attack-on-titan",
      type: "series",
      synopsis:
        "After his hometown is destroyed and his mother is killed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans that have brought humanity to the brink of extinction.",
      year: 2013,
      rating: "9.0",
      status: "completed",
      languages: JSON.stringify(["Hindi", "English", "Japanese", "Telugu"]),
      genres: JSON.stringify(["Action", "Drama", "Fantasy", "Shounen"]),
      quality: "HD",
      is_spotlight: 0,
      priority: 80,
      views: 55000,
    },
    {
      title: "Naruto Shippuden",
      slug: "naruto-shippuden",
      type: "series",
      synopsis:
        "Naruto Uzumaki returns to Konohagakure after two and a half years of training with Jiraiya. Now an older and wiser shinobi, Naruto is ready to face new challenges.",
      year: 2007,
      rating: "8.5",
      status: "completed",
      languages: JSON.stringify(["Hindi", "English", "Japanese", "Tamil", "Telugu"]),
      genres: JSON.stringify(["Action", "Adventure", "Shounen"]),
      quality: "HD",
      is_spotlight: 0,
      priority: 75,
      views: 72000,
    },
    {
      title: "Ben 10: Destroy All Aliens",
      slug: "ben-10-destroy-all-aliens",
      type: "movie",
      synopsis:
        "When Ben's new Omnitrix begins to malfunction, sending out alien DNA pulses that attract an unstoppable hunter, Ben must work to repair it.",
      year: 2012,
      rating: "6.8",
      status: "completed",
      languages: JSON.stringify(["Hindi", "English"]),
      genres: JSON.stringify(["Action", "Animation", "Sci-Fi"]),
      quality: "HD",
      is_spotlight: 0,
      priority: 60,
      views: 18000,
    },
    {
      title: "Doraemon: Nobita's New Dinosaur",
      slug: "doraemon-nobitas-new-dinosaur",
      type: "movie",
      synopsis:
        "Nobita finds a fossilized dinosaur egg and uses Doraemon's gadget to hatch it. Two new species of dinosaurs emerge.",
      year: 2020,
      rating: "7.0",
      status: "completed",
      languages: JSON.stringify(["Hindi", "Japanese"]),
      genres: JSON.stringify(["Adventure", "Animation", "Comedy"]),
      quality: "HD",
      is_spotlight: 0,
      priority: 50,
      views: 22000,
    },
    {
      title: "My Hero Academia",
      slug: "my-hero-academia",
      type: "series",
      synopsis:
        "In a world where most of the population has superpowers, Izuku Midoriya dreams of becoming a hero despite being born without powers.",
      year: 2016,
      rating: "8.4",
      status: "ongoing",
      languages: JSON.stringify(["Hindi", "English", "Japanese"]),
      genres: JSON.stringify(["Action", "Comedy", "Shounen", "School"]),
      quality: "HD",
      is_spotlight: 0,
      priority: 70,
      views: 41000,
    },
  ];

  const insertAnime = db.prepare(`
    INSERT INTO anime (title, slug, type, synopsis, year, rating, status, languages, genres, quality, is_spotlight, priority, views)
    VALUES (@title, @slug, @type, @synopsis, @year, @rating, @status, @languages, @genres, @quality, @is_spotlight, @priority, @views)
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

  const transaction = db.transaction(() => {
    for (const anime of animeData) {
      const result = insertAnime.run(anime);
      const animeId = result.lastInsertRowid as number;
      const seasonResult = insertSeason.run(animeId, 1, "Season 1");
      const seasonId = seasonResult.lastInsertRowid as number;

      const epCount = anime.type === "movie" ? 1 : 3;
      for (let ep = 1; ep <= epCount; ep++) {
        const epTitle =
          anime.type === "movie" ? anime.title : `${anime.title} 1x${ep}`;
        const epResult = insertEpisode.run(animeId, seasonId, ep, epTitle);
        const epId = epResult.lastInsertRowid as number;

        insertServer.run(
          epId,
          "Server 1",
          "embed",
          "https://www.youtube.com/embed/dQw4w9WgXcQ",
          0
        );
        insertServer.run(
          epId,
          "Server 2 - Abyss",
          "embed",
          "https://www.youtube.com/embed/dQw4w9WgXcQ",
          1
        );
      }
    }
  });

  transaction();
}

// ============ Query Helpers ============

export interface AnimeRow {
  id: number;
  title: string;
  slug: string;
  type: string;
  poster: string;
  backdrop: string;
  thumbnail: string;
  synopsis: string;
  year: number;
  rating: string;
  status: string;
  languages: string;
  genres: string;
  quality: string;
  is_spotlight: number;
  priority: number;
  views: number;
  created_at: string;
  updated_at: string;
}

export interface SeasonRow {
  id: number;
  anime_id: number;
  season_number: number;
  title: string;
}

export interface EpisodeRow {
  id: number;
  anime_id: number;
  season_id: number;
  episode_number: number;
  title: string;
  thumbnail: string;
  duration: string;
  created_at: string;
}

export interface ServerRow {
  id: number;
  episode_id: number;
  server_name: string;
  server_type: string;
  stream_url: string;
  server_order: number;
}

export interface DownloadRow {
  id: number;
  episode_id: number;
  quality: string;
  download_url: string;
  file_size: string;
}

// ---- Anime Queries ----

export function getAllAnime(opts?: {
  type?: string;
  genre?: string;
  language?: string;
  letter?: string;
  search?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}): AnimeRow[] {
  const db = getDb();
  let where = "WHERE 1=1";
  const params: Record<string, string | number> = {};

  if (opts?.type) {
    where += " AND a.type = @type";
    params.type = opts.type;
  }
  if (opts?.genre) {
    where += " AND a.genres LIKE @genre";
    params.genre = `%"${opts.genre}"%`;
  }
  if (opts?.language) {
    where += " AND a.languages LIKE @language";
    params.language = `%"${opts.language}"%`;
  }
  if (opts?.letter) {
    if (opts.letter === "0-9") {
      where += " AND a.title GLOB '[0-9]*'";
    } else {
      where += " AND UPPER(SUBSTR(a.title, 1, 1)) = @letter";
      params.letter = opts.letter.toUpperCase();
    }
  }
  if (opts?.search) {
    const searchTerms = opts.search.trim().split(/\s+/).filter(Boolean);
    if (searchTerms.length > 0) {
      searchTerms.forEach((term, idx) => {
        where += ` AND (a.title LIKE @search${idx} OR a.slug LIKE @search${idx})`;
        params[`search${idx}`] = `%${term}%`;
      });
    }
  }

  let orderBy = "ORDER BY a.priority DESC, a.created_at DESC";
  if (opts?.sort === "latest") orderBy = "ORDER BY a.created_at DESC";
  if (opts?.sort === "oldest") orderBy = "ORDER BY a.created_at ASC";
  if (opts?.sort === "views") orderBy = "ORDER BY a.views DESC";
  if (opts?.sort === "title") orderBy = "ORDER BY a.title ASC";
  if (opts?.sort === "rating") orderBy = "ORDER BY a.rating DESC";

  const limit = opts?.limit || 50;
  const offset = opts?.offset || 0;

  return db
    .prepare(
      `SELECT a.* FROM anime a ${where} ${orderBy} LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit, offset }) as AnimeRow[];
}

export function getAnimeBySlug(slug: string): AnimeRow | undefined {
  return getDb()
    .prepare("SELECT * FROM anime WHERE slug = ?")
    .get(slug) as AnimeRow | undefined;
}

export function getAnimeById(id: number): AnimeRow | undefined {
  return getDb()
    .prepare("SELECT * FROM anime WHERE id = ?")
    .get(id) as AnimeRow | undefined;
}

export function getSpotlightAnime(): AnimeRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM anime WHERE is_spotlight = 1 ORDER BY priority DESC LIMIT 6"
    )
    .all() as AnimeRow[];
}

export function getTotalAnimeCount(opts?: {
  type?: string;
  genre?: string;
  letter?: string;
  search?: string;
}): number {
  const db = getDb();
  let where = "WHERE 1=1";
  const params: Record<string, string> = {};
  if (opts?.type) {
    where += " AND type = @type";
    params.type = opts.type;
  }
  if (opts?.genre) {
    where += " AND genres LIKE @genre";
    params.genre = `%"${opts.genre}"%`;
  }
  if (opts?.letter) {
    if (opts.letter === "0-9") {
      where += " AND title GLOB '[0-9]*'";
    } else {
      where += " AND UPPER(SUBSTR(title, 1, 1)) = @letter";
      params.letter = opts.letter.toUpperCase();
    }
  }
  if (opts?.search) {
    where += " AND (title LIKE @search OR slug LIKE @search OR synopsis LIKE @search)";
    params.search = `%${opts.search}%`;
  }
  const result = db.prepare(`SELECT COUNT(*) as c FROM anime ${where}`).get(params) as { c: number };
  return result.c;
}

export function createAnime(data: Partial<AnimeRow>): number {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO anime (title, slug, type, poster, backdrop, thumbnail, synopsis, year, rating, status, languages, genres, quality, is_spotlight, priority)
     VALUES (@title, @slug, @type, @poster, @backdrop, @thumbnail, @synopsis, @year, @rating, @status, @languages, @genres, @quality, @is_spotlight, @priority)`
    )
    .run({
      title: data.title || "",
      slug: data.slug || "",
      type: data.type || "series",
      poster: data.poster || "",
      backdrop: data.backdrop || "",
      thumbnail: data.thumbnail || "",
      synopsis: data.synopsis || "",
      year: data.year || 2024,
      rating: data.rating || "",
      status: data.status || "ongoing",
      languages: data.languages || "[]",
      genres: data.genres || "[]",
      quality: data.quality || "HD",
      is_spotlight: data.is_spotlight || 0,
      priority: data.priority || 0,
    });
  return result.lastInsertRowid as number;
}

export function updateAnime(id: number, data: Partial<AnimeRow>): void {
  const db = getDb();
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };

  const allowedFields = [
    "title", "slug", "type", "poster", "backdrop", "thumbnail", "synopsis",
    "year", "rating", "status", "languages", "genres", "quality",
    "is_spotlight", "priority", "views",
  ];

  for (const key of allowedFields) {
    if (key in data) {
      fields.push(`${key} = @${key}`);
      params[key] = (data as Record<string, unknown>)[key];
    }
  }

  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");

  db.prepare(`UPDATE anime SET ${fields.join(", ")} WHERE id = @id`).run(params);
}

export function incrementAnimeViews(id: number): number {
  const db = getDb();
  db.prepare("UPDATE anime SET views = COALESCE(views, 0) + 1 WHERE id = ?").run(id);
  const row = db.prepare("SELECT views FROM anime WHERE id = ?").get(id) as { views: number } | undefined;
  return row?.views || 0;
}

export function deleteAnime(id: number): void {
  getDb().prepare("DELETE FROM anime WHERE id = ?").run(id);
}

// ---- Season Queries ----

export function getSeasonsByAnime(animeId: number): SeasonRow[] {
  return getDb()
    .prepare("SELECT * FROM seasons WHERE anime_id = ? ORDER BY season_number")
    .all(animeId) as SeasonRow[];
}

export function createSeason(animeId: number, seasonNumber: number, title: string): number {
  const result = getDb()
    .prepare("INSERT INTO seasons (anime_id, season_number, title) VALUES (?, ?, ?)")
    .run(animeId, seasonNumber, title);
  return result.lastInsertRowid as number;
}

export function deleteSeason(id: number): void {
  getDb().prepare("DELETE FROM seasons WHERE id = ?").run(id);
}

// ---- Episode Queries ----

export function getEpisodesByAnime(animeId: number): EpisodeRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM episodes WHERE anime_id = ? ORDER BY season_id, episode_number"
    )
    .all(animeId) as EpisodeRow[];
}

export function getEpisodesBySeason(seasonId: number): EpisodeRow[] {
  return getDb()
    .prepare("SELECT * FROM episodes WHERE season_id = ? ORDER BY episode_number")
    .all(seasonId) as EpisodeRow[];
}

export function getEpisodeById(id: number): EpisodeRow | undefined {
  return getDb()
    .prepare("SELECT * FROM episodes WHERE id = ?")
    .get(id) as EpisodeRow | undefined;
}

export function getEpisodeByAnimeAndCode(
  animeId: number,
  seasonNum: number,
  episodeNum: number
): EpisodeRow | undefined {
  return getDb()
    .prepare(
      `SELECT e.* FROM episodes e
       JOIN seasons s ON e.season_id = s.id
       WHERE e.anime_id = ? AND s.season_number = ? AND e.episode_number = ?`
    )
    .get(animeId, seasonNum, episodeNum) as EpisodeRow | undefined;
}

export function createEpisode(data: {
  anime_id: number;
  season_id: number;
  episode_number: number;
  title: string;
  thumbnail?: string;
  duration?: string;
}): number {
  const result = getDb()
    .prepare(
      `INSERT INTO episodes (anime_id, season_id, episode_number, title, thumbnail, duration)
       VALUES (@anime_id, @season_id, @episode_number, @title, @thumbnail, @duration)`
    )
    .run({
      anime_id: data.anime_id,
      season_id: data.season_id,
      episode_number: data.episode_number,
      title: data.title,
      thumbnail: data.thumbnail || "",
      duration: data.duration || "",
    });
  return result.lastInsertRowid as number;
}

export function updateEpisode(
  id: number,
  data: { title?: string; thumbnail?: string; duration?: string }
): void {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };
  if (data.title !== undefined) { fields.push("title = @title"); params.title = data.title; }
  if (data.thumbnail !== undefined) { fields.push("thumbnail = @thumbnail"); params.thumbnail = data.thumbnail; }
  if (data.duration !== undefined) { fields.push("duration = @duration"); params.duration = data.duration; }
  if (fields.length === 0) return;
  getDb().prepare(`UPDATE episodes SET ${fields.join(", ")} WHERE id = @id`).run(params);
}

export function deleteEpisode(id: number): void {
  getDb().prepare("DELETE FROM episodes WHERE id = ?").run(id);
}

// ---- Server Queries ----

export function getServersByEpisode(episodeId: number): ServerRow[] {
  return getDb()
    .prepare("SELECT * FROM servers WHERE episode_id = ? ORDER BY server_order")
    .all(episodeId) as ServerRow[];
}

export function createServer(data: {
  episode_id: number;
  server_name: string;
  server_type: string;
  stream_url: string;
  server_order: number;
}): number {
  const result = getDb()
    .prepare(
      `INSERT INTO servers (episode_id, server_name, server_type, stream_url, server_order)
       VALUES (@episode_id, @server_name, @server_type, @stream_url, @server_order)`
    )
    .run(data);
  return result.lastInsertRowid as number;
}

export function updateServer(
  id: number,
  data: { server_name?: string; server_type?: string; stream_url?: string; server_order?: number }
): void {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };
  if (data.server_name !== undefined) { fields.push("server_name = @server_name"); params.server_name = data.server_name; }
  if (data.server_type !== undefined) { fields.push("server_type = @server_type"); params.server_type = data.server_type; }
  if (data.stream_url !== undefined) { fields.push("stream_url = @stream_url"); params.stream_url = data.stream_url; }
  if (data.server_order !== undefined) { fields.push("server_order = @server_order"); params.server_order = data.server_order; }
  if (fields.length === 0) return;
  getDb().prepare(`UPDATE servers SET ${fields.join(", ")} WHERE id = @id`).run(params);
}

export function deleteServer(id: number): void {
  getDb().prepare("DELETE FROM servers WHERE id = ?").run(id);
}

// ---- Download Queries ----

export function getDownloadsByEpisode(episodeId: number): DownloadRow[] {
  return getDb()
    .prepare("SELECT * FROM downloads WHERE episode_id = ? ORDER BY quality")
    .all(episodeId) as DownloadRow[];
}

export function createDownload(data: {
  episode_id: number;
  quality: string;
  download_url: string;
  file_size?: string;
}): number {
  const result = getDb()
    .prepare(
      `INSERT INTO downloads (episode_id, quality, download_url, file_size)
       VALUES (@episode_id, @quality, @download_url, @file_size)`
    )
    .run({ ...data, file_size: data.file_size || "" });
  return result.lastInsertRowid as number;
}

export function deleteDownload(id: number): void {
  getDb().prepare("DELETE FROM downloads WHERE id = ?").run(id);
}

// ---- Auth Queries ----

export function verifyAdmin(
  username: string,
  password: string
): { id: number; username: string } | null {
  const db = getDb();
  const user = db
    .prepare("SELECT * FROM admin_users WHERE username = ?")
    .get(username) as { id: number; username: string; password_hash: string } | undefined;

  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return { id: user.id, username: user.username };
}

// ---- Regular User Queries ----

export interface UserRow {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  avatar: string;
  is_vip: number;
  key_expires_at?: string | null;
  vip_expires_at?: string | null;
  created_at: string;
}

export function createUser(data: {
  username: string;
  email: string;
  password: string;
}): { id: number; username: string; email: string } {
  const db = getDb();
  const password_hash = bcrypt.hashSync(data.password, 10);
  const result = db
    .prepare(
      `INSERT INTO users (username, email, password_hash)
       VALUES (?, ?, ?)`
    )
    .run(data.username.trim(), data.email.toLowerCase().trim(), password_hash);

  return {
    id: result.lastInsertRowid as number,
    username: data.username.trim(),
    email: data.email.toLowerCase().trim(),
  };
}

export function verifyUser(
  emailOrUsername: string,
  password: string
): { id: number; username: string; email: string; avatar: string; is_vip: number; key_expires_at?: string | null; vip_expires_at?: string | null } | null {
  const db = getDb();
  const identifier = emailOrUsername.toLowerCase().trim();
  const user = db
    .prepare("SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?")
    .get(identifier, identifier) as UserRow | undefined;

  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar || "",
    is_vip: user.is_vip || 0,
    key_expires_at: user.key_expires_at || null,
    vip_expires_at: user.vip_expires_at || null,
  };
}

export function getUserById(id: number): { id: number; username: string; email: string; avatar: string; is_vip: number; key_expires_at?: string | null; vip_expires_at?: string | null } | null {
  const db = getDb();
  const user = db
    .prepare("SELECT id, username, email, avatar, is_vip, key_expires_at, vip_expires_at, created_at FROM users WHERE id = ?")
    .get(id) as UserRow | undefined;

  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar || "",
    is_vip: user.is_vip || 0,
    key_expires_at: user.key_expires_at || null,
    vip_expires_at: user.vip_expires_at || null,
  };
}

export function getUserByEmail(email: string): UserRow | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE LOWER(email) = ?")
    .get(email.toLowerCase().trim()) as UserRow | undefined;
}

export function getUserByUsername(username: string): UserRow | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE LOWER(username) = ?")
    .get(username.toLowerCase().trim()) as UserRow | undefined;
}

// ---- Stats ----

export function getAdminStats() {
  const db = getDb();
  const totalAnime = (db.prepare("SELECT COUNT(*) as c FROM anime").get() as { c: number }).c;
  const totalEpisodes = (db.prepare("SELECT COUNT(*) as c FROM episodes").get() as { c: number }).c;
  const totalViews = (db.prepare("SELECT SUM(views) as c FROM anime").get() as { c: number }).c || 0;
  const spotlightCount = (db.prepare("SELECT COUNT(*) as c FROM anime WHERE is_spotlight = 1").get() as { c: number }).c;
  const seriesCount = (db.prepare("SELECT COUNT(*) as c FROM anime WHERE type = 'series'").get() as { c: number }).c;
  const moviesCount = (db.prepare("SELECT COUNT(*) as c FROM anime WHERE type = 'movie'").get() as { c: number }).c;
  const totalUsers = (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c;
  const totalVipUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE is_vip = 1").get() as { c: number }).c;

  return { totalAnime, totalEpisodes, totalViews, spotlightCount, seriesCount, moviesCount, totalUsers, totalVipUsers };
}

// ---- User Management (Admin) ----

export function getAllUsers(opts?: {
  search?: string;
  vipOnly?: boolean;
  limit?: number;
  offset?: number;
}): any[] {
  const db = getDb();
  let where = "WHERE 1=1";
  const params: Record<string, string | number> = {};

  if (opts?.search) {
    where += " AND (LOWER(username) LIKE @search OR LOWER(email) LIKE @search)";
    params.search = `%${opts.search.toLowerCase()}%`;
  }
  if (opts?.vipOnly) {
    where += " AND is_vip = 1";
  }

  const limit = opts?.limit || 50;
  const offset = opts?.offset || 0;

  return db
    .prepare(
      `SELECT id, username, email, avatar, is_vip, created_at FROM users ${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit, offset }) as any[];
}

export function getUserCount(opts?: { search?: string; vipOnly?: boolean }): number {
  const db = getDb();
  let where = "WHERE 1=1";
  const params: Record<string, string> = {};

  if (opts?.search) {
    where += " AND (LOWER(username) LIKE @search OR LOWER(email) LIKE @search)";
    params.search = `%${opts.search.toLowerCase()}%`;
  }
  if (opts?.vipOnly) {
    where += " AND is_vip = 1";
  }

  return (db.prepare(`SELECT COUNT(*) as c FROM users ${where}`).get(params) as { c: number }).c;
}

export function updateUserVipStatus(userId: number, isVip: boolean): boolean {
  const db = getDb();
  const res = db.prepare("UPDATE users SET is_vip = ?, vip_expires_at = NULL WHERE id = ?").run(isVip ? 1 : 0, userId);
  return res.changes > 0;
}

export function setUserVipByEmail(email: string, isVip: boolean): boolean {
  const db = getDb();
  const res = db.prepare("UPDATE users SET is_vip = ?, vip_expires_at = NULL WHERE LOWER(email) = ?").run(isVip ? 1 : 0, email.toLowerCase().trim());
  return res.changes > 0;
}

export function setUserVipByUsername(username: string, isVip: boolean): boolean {
  const db = getDb();
  const res = db.prepare("UPDATE users SET is_vip = ?, vip_expires_at = NULL WHERE LOWER(username) = ?").run(isVip ? 1 : 0, username.toLowerCase().trim());
  return res.changes > 0;
}

// ---- User Bookmarks / Watchlist ----

export function addBookmark(userId: number, animeId: number) {
  const db = getDb();
  return db
    .prepare("INSERT OR IGNORE INTO user_bookmarks (user_id, anime_id) VALUES (?, ?)")
    .run(userId, animeId);
}

export function removeBookmark(userId: number, animeId: number) {
  const db = getDb();
  return db
    .prepare("DELETE FROM user_bookmarks WHERE user_id = ? AND anime_id = ?")
    .run(userId, animeId);
}

export function isBookmarked(userId: number, animeId: number): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT id FROM user_bookmarks WHERE user_id = ? AND anime_id = ?")
    .get(userId, animeId);
  return !!row;
}

export function getUserBookmarks(userId: number): any[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.*, b.created_at as bookmarked_at
       FROM user_bookmarks b
       JOIN anime a ON a.id = b.anime_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC`
    )
    .all(userId) as any[];

  return rows.map((r) => ({
    ...r,
    languages: JSON.parse(r.languages || "[]"),
    genres: JSON.parse(r.genres || "[]"),
  }));
}

// ---- Episode Comments ----

export interface CommentRow {
  id: number;
  episode_id: number;
  user_id: number;
  username: string;
  avatar: string;
  comment: string;
  created_at: string;
}

export function addComment(data: { episode_id: number; user_id: number; comment: string }) {
  const db = getDb();
  const res = db
    .prepare("INSERT INTO episode_comments (episode_id, user_id, comment) VALUES (?, ?, ?)")
    .run(data.episode_id, data.user_id, data.comment.trim());
  return res.lastInsertRowid;
}

export function getCommentsByEpisode(episodeId: number): CommentRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT c.id, c.episode_id, c.user_id, c.comment, c.created_at, u.username, u.avatar
       FROM episode_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.episode_id = ?
       ORDER BY c.created_at DESC`
    )
    .all(episodeId) as CommentRow[];
}

// ---- Server / Video Reports ----

export function createReport(data: {
  episode_id: number;
  server_id?: number | null;
  issue_type: string;
  details?: string;
}) {
  const db = getDb();
  const res = db
    .prepare(
      "INSERT INTO server_reports (episode_id, server_id, issue_type, details) VALUES (?, ?, ?, ?)"
    )
    .run(data.episode_id, data.server_id || null, data.issue_type, data.details || "");
  return res.lastInsertRowid;
}

export function getReports(): any[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT r.*, e.title as episode_title, e.episode_number, a.title as anime_title, a.slug as anime_slug
       FROM server_reports r
       JOIN episodes e ON e.id = r.episode_id
       JOIN anime a ON a.id = e.anime_id
       ORDER BY r.created_at DESC`
    )
    .all() as any[];
}

export function resolveReport(id: number) {
  const db = getDb();
  return db.prepare("UPDATE server_reports SET status = 'resolved' WHERE id = ?").run(id);
}

// ---- Transcode Jobs ----

export function createTranscodeJob(data: {
  episode_id?: number | null;
  server_id?: number | null;
  status?: string;
  progress_text?: string;
}) {
  const db = getDb();
  const res = db
    .prepare(
      "INSERT INTO transcode_jobs (episode_id, server_id, status, progress_text) VALUES (?, ?, ?, ?)"
    )
    .run(data.episode_id || null, data.server_id || null, data.status || "pending", data.progress_text || "Queued");
  return res.lastInsertRowid as number;
}

export function updateTranscodeJob(
  id: number,
  data: { status?: string; progress_text?: string; error?: string }
) {
  const db = getDb();
  return db
    .prepare(
      `UPDATE transcode_jobs 
       SET status = COALESCE(?, status), 
           progress_text = COALESCE(?, progress_text), 
           error = COALESCE(?, error), 
           updated_at = datetime('now') 
       WHERE id = ?`
    )
    .run(data.status || null, data.progress_text || null, data.error || null, id);
}

export function getTranscodeJobByServer(serverId: number) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM transcode_jobs WHERE server_id = ? ORDER BY id DESC LIMIT 1")
    .get(serverId) as any;
}

export function deleteComment(id: number, userId?: number): boolean {
  const db = getDb();
  if (userId) {
    const res = db.prepare("DELETE FROM episode_comments WHERE id = ? AND user_id = ?").run(id, userId);
    return res.changes > 0;
  }
  const res = db.prepare("DELETE FROM episode_comments WHERE id = ?").run(id);
  return res.changes > 0;
}

// ---- Watch History / Continue Watching ----
export function upsertWatchHistory(data: {
  user_id: number;
  anime_id: number;
  episode_id: number;
  progress_seconds: number;
  duration_seconds: number;
}) {
  const db = getDb();
  return db
    .prepare(
      `INSERT INTO watch_history (user_id, anime_id, episode_id, progress_seconds, duration_seconds, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, anime_id) DO UPDATE SET
         episode_id = excluded.episode_id,
         progress_seconds = excluded.progress_seconds,
         duration_seconds = excluded.duration_seconds,
         updated_at = datetime('now')`
    )
    .run(
      data.user_id,
      data.anime_id,
      data.episode_id,
      data.progress_seconds,
      data.duration_seconds
    );
}

export function getUserWatchHistory(userId: number, limit: number = 10): any[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT h.*, 
              a.title as anime_title, 
              a.slug as anime_slug, 
              a.poster as anime_poster, 
              a.type as anime_type,
              e.episode_number,
              e.title as episode_title,
              s.season_number
       FROM watch_history h
       JOIN anime a ON h.anime_id = a.id
       JOIN episodes e ON h.episode_id = e.id
       JOIN seasons s ON e.season_id = s.id
       WHERE h.user_id = ?
       ORDER BY h.updated_at DESC
       LIMIT ?`
     )
     .all(userId, limit);
}

export function getEpisodeWatchProgress(userId: number, episodeId: number): any {
  const db = getDb();
  return db
    .prepare("SELECT * FROM watch_history WHERE user_id = ? AND episode_id = ?")
    .get(userId, episodeId);
}

export function getAllDownloadsWithDetails(limit: number = 50): any[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT d.*, 
              e.episode_number, 
              e.title as episode_title, 
              s.season_number,
              a.id as anime_id,
              a.title as anime_title, 
              a.slug as anime_slug, 
              a.poster as anime_poster,
              a.type as anime_type
       FROM downloads d
       JOIN episodes e ON d.episode_id = e.id
       JOIN seasons s ON e.season_id = s.id
       JOIN anime a ON e.anime_id = a.id
       ORDER BY d.id DESC
       LIMIT ?`
    )
    .all(limit);
}

// ---- Site Settings (Telegram, etc.) ----
export function getSiteSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM site_settings").all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  return settings;
}

export function setSiteSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

export function setSiteSettings(settings: Record<string, string>): void {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      stmt.run(key, String(value));
    }
  })();
}

// ---- Site Broadcasts / Announcements ----
export interface BroadcastRow {
  id: number;
  title: string;
  message: string;
  theme: string;
  icon: string;
  btn_text: string;
  btn_url: string;
  is_active: number;
  dismissible: number;
  created_at: string;
  updated_at: string;
}

export function getAllBroadcasts(): BroadcastRow[] {
  const db = getDb();
  return db.prepare("SELECT * FROM site_broadcasts ORDER BY id DESC").all() as BroadcastRow[];
}

export function getActiveBroadcast(): BroadcastRow | null {
  const db = getDb();
  const res = db
    .prepare("SELECT * FROM site_broadcasts WHERE is_active = 1 ORDER BY id DESC LIMIT 1")
    .get() as BroadcastRow | undefined;
  return res || null;
}

export function createBroadcast(data: {
  title: string;
  message: string;
  theme?: string;
  icon?: string;
  btn_text?: string;
  btn_url?: string;
  is_active?: number;
  dismissible?: number;
}): number {
  const db = getDb();
  const res = db
    .prepare(
      `INSERT INTO site_broadcasts (title, message, theme, icon, btn_text, btn_url, is_active, dismissible)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      data.title.trim(),
      data.message.trim(),
      data.theme || "orange",
      data.icon || "sparkles",
      data.btn_text?.trim() || "",
      data.btn_url?.trim() || "",
      data.is_active !== undefined ? data.is_active : 1,
      data.dismissible !== undefined ? data.dismissible : 1
    );
  return Number(res.lastInsertRowid);
}

export function updateBroadcast(
  id: number,
  data: Partial<Omit<BroadcastRow, "id" | "created_at">>
): void {
  const db = getDb();
  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined && key !== "id") {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }

  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE site_broadcasts SET ${fields.join(", ")} WHERE id = ?`).run(...values);
}

export function deleteBroadcast(id: number): boolean {
  const db = getDb();
  const res = db.prepare("DELETE FROM site_broadcasts WHERE id = ?").run(id);
  return res.changes > 0;
}

// ---- Access Keys & 48-Hour Subscription System ----

export interface AccessKeyRow {
  id: number;
  key_code: string;
  claim_token: string | null;
  user_id: number | null;
  used_by_user_id: number | null;
  status: "pending" | "used" | "revoked";
  duration_hours: number;
  activated_at: string | null;
  expires_at: string | null;
  ip_address: string | null;
  created_at: string;
  used_by_username?: string | null;
  used_by_email?: string | null;
  creator_username?: string | null;
}

export function generateFormattedKeyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let part1 = "";
  let part2 = "";
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
    part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `AZ-${part1}-${part2}`;
}

export function createAccessKey(data: {
  key_code?: string;
  claim_token?: string;
  user_id?: number;
  duration_hours?: number;
  ip_address?: string;
}): AccessKeyRow {
  const db = getDb();
  let key_code = data.key_code?.trim().toUpperCase() || generateFormattedKeyCode();
  const duration_hours = data.duration_hours || 48;
  const claim_token = data.claim_token || null;
  const user_id = data.user_id || null;
  const ip_address = data.ip_address || null;

  let inserted = false;
  let lastId: number | bigint = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = db
        .prepare(
          `INSERT INTO access_keys (key_code, claim_token, user_id, duration_hours, ip_address, status)
           VALUES (?, ?, ?, ?, ?, 'pending')`
        )
        .run(key_code, claim_token, user_id, duration_hours, ip_address);
      lastId = res.lastInsertRowid;
      inserted = true;
      break;
    } catch (err: any) {
      if (!data.key_code && err?.message?.includes("UNIQUE constraint failed: access_keys.key_code")) {
        key_code = generateFormattedKeyCode();
      } else {
        throw err;
      }
    }
  }

  if (!inserted) {
    throw new Error("Failed to generate unique access key");
  }

  return db.prepare("SELECT * FROM access_keys WHERE id = ?").get(lastId) as AccessKeyRow;
}

export function generateBulkKeys(count: number, durationHours: number = 48): string[] {
  const db = getDb();
  const createdCodes: string[] = [];
  const stmt = db.prepare(
    `INSERT INTO access_keys (key_code, claim_token, user_id, duration_hours, status)
     VALUES (?, NULL, NULL, ?, 'pending')`
  );

  const insertTx = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      let inserted = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateFormattedKeyCode();
        try {
          stmt.run(code, durationHours);
          createdCodes.push(code);
          inserted = true;
          break;
        } catch (err: any) {
          if (!err?.message?.includes("UNIQUE constraint failed")) {
            throw err;
          }
        }
      }
      if (!inserted) {
        throw new Error("Failed to generate batch of unique access keys");
      }
    }
  });

  insertTx();
  return createdCodes;
}

export function getKeyByCode(keyCode: string): AccessKeyRow | undefined {
  const db = getDb();
  const clean = keyCode.trim().toUpperCase();
  return db.prepare("SELECT * FROM access_keys WHERE key_code = ?").get(clean) as AccessKeyRow | undefined;
}

export function getKeyByClaimToken(claimToken: string): AccessKeyRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM access_keys WHERE claim_token = ?").get(claimToken.trim()) as AccessKeyRow | undefined;
}

export function redeemAccessKey(
  keyCode: string,
  userId: number
): { success: boolean; error?: string; key_code?: string; duration_hours?: number; expires_at?: string } {
  const db = getDb();
  const clean = keyCode.trim().toUpperCase();
  const key = db.prepare("SELECT * FROM access_keys WHERE key_code = ?").get(clean) as AccessKeyRow | undefined;

  if (!key) {
    return { success: false, error: "Invalid Key Code. Please check and try again." };
  }

  if (key.status === "revoked") {
    return { success: false, error: "This key has been revoked by admin." };
  }

  if (key.status === "used" || key.used_by_user_id) {
    return { success: false, error: "This key has already been redeemed and is single-use only." };
  }

  const duration = key.duration_hours || 48;
  let newExpiresAt: string = "";

  const redeemTx = db.transaction(() => {
    // 1. Mark key as used
    db.prepare(
      `UPDATE access_keys
       SET status = 'used',
           used_by_user_id = ?,
           activated_at = datetime('now'),
           expires_at = datetime('now', '+' || ? || ' hours')
       WHERE id = ?`
    ).run(userId, duration, key.id);

    // 2. Extend user's key_expires_at
    db.prepare(
      `UPDATE users
       SET key_expires_at = datetime(
         MAX(COALESCE(key_expires_at, datetime('now')), datetime('now')),
         '+' || ? || ' hours'
       )
       WHERE id = ?`
    ).run(duration, userId);

    const userRow = db.prepare("SELECT key_expires_at FROM users WHERE id = ?").get(userId) as { key_expires_at: string };
    newExpiresAt = userRow.key_expires_at;
  });

  redeemTx();

  return {
    success: true,
    key_code: key.key_code,
    duration_hours: duration,
    expires_at: newExpiresAt,
  };
}

export function claimAndActivateKey(
  claimToken: string,
  userId: number
): { success: boolean; error?: string; key_code?: string; duration_hours?: number; expires_at?: string } {
  const db = getDb();
  const key = db.prepare("SELECT * FROM access_keys WHERE claim_token = ?").get(claimToken.trim()) as AccessKeyRow | undefined;

  if (!key) {
    return { success: false, error: "Invalid or expired verification claim link." };
  }

  if (key.status === "revoked") {
    return { success: false, error: "This key has been revoked." };
  }

  if (key.status === "used") {
    // If it was already claimed, return active success with details
    const activeUserId = userId || key.used_by_user_id;
    const activeStatus = activeUserId ? isUserKeyActive(activeUserId) : null;
    return {
      success: true,
      key_code: key.key_code,
      duration_hours: key.duration_hours,
      expires_at: activeStatus?.expires_at || undefined,
    };
  }

  // Redeem the key code for this user
  return redeemAccessKey(key.key_code, userId);
}

export function isUserKeyActive(userId: number): {
  active: boolean;
  is_vip: boolean;
  key_system_disabled?: boolean;
  remaining_hours: number;
  remaining_days?: number;
  expires_at: string | null;
  vip_expires_at?: string | null;
} {
  const db = getDb();
  const user = db
    .prepare(
      `SELECT id, username, email, is_vip, key_expires_at, vip_expires_at,
              datetime('now') as current_time
       FROM users WHERE id = ?`
    )
    .get(userId) as { id: number; username: string; email: string; is_vip: number; key_expires_at: string | null; vip_expires_at: string | null; current_time: string } | undefined;

  if (!user) {
    return { active: false, is_vip: false, remaining_hours: 0, expires_at: null };
  }

  // VIP Check (with expiration handling)
  if (user.is_vip === 1) {
    if (user.vip_expires_at) {
      const vipExpTime = new Date(user.vip_expires_at + (user.vip_expires_at.endsWith("Z") ? "" : "Z")).getTime();
      const nowTime = Date.now();
      if (vipExpTime > nowTime) {
        const remainingDays = Math.max(1, Math.ceil((vipExpTime - nowTime) / (1000 * 60 * 60 * 24)));
        const remainingHours = Math.max(1, Math.ceil((vipExpTime - nowTime) / (1000 * 60 * 60)));
        return {
          active: true,
          is_vip: true,
          remaining_hours: remainingHours,
          remaining_days: remainingDays,
          expires_at: user.vip_expires_at,
          vip_expires_at: user.vip_expires_at,
        };
      } else {
        // VIP expired — revoke VIP status
        db.prepare("UPDATE users SET is_vip = 0 WHERE id = ?").run(userId);
        user.is_vip = 0;
      }
    } else {
      // Lifetime VIP (no expiration)
      return { active: true, is_vip: true, remaining_hours: 9999, expires_at: null, vip_expires_at: null };
    }
  }

  // Check if system is globally disabled in site_settings
  const settings = getSiteSettings();
  if (settings.key_system_enabled === "0") {
    return { active: true, is_vip: false, key_system_disabled: true, remaining_hours: 9999, expires_at: null };
  }

  if (user.key_expires_at) {
    const expireTime = new Date(user.key_expires_at + "Z").getTime();
    const nowTime = Date.now();
    if (expireTime > nowTime) {
      const remainingHours = Math.max(1, Math.ceil((expireTime - nowTime) / (1000 * 60 * 60)));
      return {
        active: true,
        is_vip: false,
        remaining_hours: remainingHours,
        expires_at: user.key_expires_at,
      };
    }
  }

  return {
    active: false,
    is_vip: false,
    remaining_hours: 0,
    expires_at: user.key_expires_at || null,
  };
}

export function getAllAccessKeys(opts: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}): { keys: AccessKeyRow[]; total: number } {
  const db = getDb();
  const page = Math.max(1, opts.page || 1);
  const limit = Math.min(100, Math.max(1, opts.limit || 25));
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (opts.status && opts.status !== "all") {
    whereClauses.push("k.status = ?");
    params.push(opts.status);
  }

  if (opts.search && opts.search.trim()) {
    const term = `%${opts.search.trim()}%`;
    whereClauses.push("(k.key_code LIKE ? OR u.username LIKE ? OR u.email LIKE ?)");
    params.push(term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const totalRow = db
    .prepare(
      `SELECT COUNT(*) as count
       FROM access_keys k
       LEFT JOIN users u ON k.used_by_user_id = u.id
       ${whereSql}`
    )
    .get(...params) as { count: number };

  const keys = db
    .prepare(
      `SELECT k.*,
              u.username as used_by_username,
              u.email as used_by_email,
              c.username as creator_username
       FROM access_keys k
       LEFT JOIN users u ON k.used_by_user_id = u.id
       LEFT JOIN users c ON k.user_id = c.id
       ${whereSql}
       ORDER BY k.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as AccessKeyRow[];

  return { keys, total: totalRow.count };
}

export function revokeAccessKey(id: number): boolean {
  const db = getDb();
  const res = db.prepare("UPDATE access_keys SET status = 'revoked' WHERE id = ?").run(id);
  return res.changes > 0;
}

export function deleteAccessKey(id: number): boolean {
  const db = getDb();
  const res = db.prepare("DELETE FROM access_keys WHERE id = ?").run(id);
  return res.changes > 0;
}

// ---- VIP Codes System ----

export interface VipCodeRow {
  id: number;
  code: string;
  duration_days: number;
  is_used: number;
  used_by_user_id?: number | null;
  used_by_username?: string | null;
  used_at?: string | null;
  created_at: string;
  notes?: string | null;
}

function generateRandomVipCode(): string {
  // Format: VIP-XXXX-XXXX-XXXX with uppercase alphanumeric characters
  const segment1 = crypto.randomBytes(2).toString("hex").toUpperCase();
  const segment2 = crypto.randomBytes(2).toString("hex").toUpperCase();
  const segment3 = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `VIP-${segment1}-${segment2}-${segment3}`;
}

export function generateVipCodes(
  count: number = 1,
  durationDays: number = 30,
  notes: string = ""
): { createdCount: number; codes: string[] } {
  const db = getDb();
  const actualCount = Math.max(1, Math.min(count, 100));
  const validDuration = durationDays > 0 ? durationDays : 30;

  const insertStmt = db.prepare(
    `INSERT INTO vip_codes (code, duration_days, notes) VALUES (?, ?, ?)`
  );

  const generated: string[] = [];

  const runTx = db.transaction(() => {
    for (let i = 0; i < actualCount; i++) {
      let inserted = false;
      let attempts = 0;
      while (!inserted && attempts < 10) {
        const code = generateRandomVipCode();
        try {
          insertStmt.run(code, validDuration, notes.trim());
          generated.push(code);
          inserted = true;
        } catch (err: any) {
          if (err?.code === "SQLITE_CONSTRAINT_UNIQUE") {
            attempts++;
          } else {
            throw err;
          }
        }
      }
    }
  });

  runTx();
  return { createdCount: generated.length, codes: generated };
}

export function getAllVipCodes(opts: {
  status?: "all" | "unused" | "used";
  search?: string;
  page?: number;
  limit?: number;
} = {}): { codes: VipCodeRow[]; total: number } {
  const db = getDb();
  const page = Math.max(1, opts.page || 1);
  const limit = Math.max(1, Math.min(opts.limit || 50, 200));
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const params: any[] = [];

  if (opts.status === "unused") {
    whereClauses.push("is_used = 0");
  } else if (opts.status === "used") {
    whereClauses.push("is_used = 1");
  }

  if (opts.search && opts.search.trim()) {
    const term = `%${opts.search.trim()}%`;
    whereClauses.push("(code LIKE ? OR used_by_username LIKE ? OR notes LIKE ?)");
    params.push(term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const totalRow = db
    .prepare(`SELECT COUNT(*) as count FROM vip_codes ${whereSql}`)
    .get(...params) as { count: number };

  const codes = db
    .prepare(
      `SELECT * FROM vip_codes
       ${whereSql}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as VipCodeRow[];

  return { codes, total: totalRow.count };
}

export function deleteVipCode(id: number): boolean {
  const db = getDb();
  const res = db.prepare("DELETE FROM vip_codes WHERE id = ?").run(id);
  return res.changes > 0;
}

export function redeemVipCode(
  rawCode: string,
  userId: number,
  username: string
): { success: boolean; message: string; vip_expires_at?: string; duration_days?: number } {
  const db = getDb();
  const code = (rawCode || "").trim().toUpperCase();

  if (!code) {
    return { success: false, message: "Please enter a VIP code." };
  }

  const tx = db.transaction(() => {
    // 1. Check code in DB
    const vipCode = db
      .prepare("SELECT * FROM vip_codes WHERE UPPER(code) = ?")
      .get(code) as VipCodeRow | undefined;

    if (!vipCode) {
      return { success: false, message: "Invalid VIP code. Please verify and try again." };
    }

    if (vipCode.is_used === 1) {
      return { success: false, message: "This VIP code has already been used." };
    }

    // 2. Fetch current user VIP status to support time stacking
    const user = db
      .prepare("SELECT is_vip, vip_expires_at FROM users WHERE id = ?")
      .get(userId) as { is_vip: number; vip_expires_at: string | null } | undefined;

    if (!user) {
      return { success: false, message: "User account not found." };
    }

    // Determine baseline date
    const now = new Date();
    let baseDate = now;

    if (user.is_vip === 1 && user.vip_expires_at) {
      const existingExpiry = new Date(user.vip_expires_at);
      if (!isNaN(existingExpiry.getTime()) && existingExpiry > now) {
        // Active VIP already, stack time on top of existing expiration
        baseDate = existingExpiry;
      }
    }

    const durationDays = vipCode.duration_days || 30;
    const newExpiry = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const newExpiryStr = newExpiry.toISOString();

    // 3. Mark code as used
    db.prepare(
      `UPDATE vip_codes
       SET is_used = 1, used_by_user_id = ?, used_by_username = ?, used_at = datetime('now')
       WHERE id = ?`
    ).run(userId, username, vipCode.id);

    // 4. Update user's VIP status and expiration
    db.prepare(
      `UPDATE users
       SET is_vip = 1, vip_expires_at = ?
       WHERE id = ?`
    ).run(newExpiryStr, userId);

    return {
      success: true,
      message: `VIP subscription activated for ${durationDays} days!`,
      vip_expires_at: newExpiryStr,
      duration_days: durationDays,
    };
  });

  return tx();
}

