function initializeCluster(db) {
  db.pragma('busy_timeout = 5000');
  db.exec(`CREATE TABLE IF NOT EXISTS cluster_nodes (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE,
    api_key TEXT NOT NULL, signing_key TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
    draining INTEGER NOT NULL DEFAULT 0, transcode_enabled INTEGER NOT NULL DEFAULT 0,
    max_sessions INTEGER NOT NULL DEFAULT 75, max_mbps INTEGER NOT NULL DEFAULT 150,
    cpu_quota INTEGER NOT NULL DEFAULT 100, last_seen INTEGER NOT NULL DEFAULT 0,
    metrics TEXT NOT NULL DEFAULT '{}', error TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS cluster_files (
    node_id INTEGER NOT NULL REFERENCES cluster_nodes(id) ON DELETE CASCADE,
    path TEXT NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL,
    PRIMARY KEY(node_id,path)
  );
  CREATE TABLE IF NOT EXISTS cluster_jobs (
    id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES transcode_jobs(id) ON DELETE CASCADE,
    quality TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', node_id INTEGER,
    attempt INTEGER NOT NULL DEFAULT 0, lease TEXT, expires INTEGER NOT NULL DEFAULT 0,
    error TEXT NOT NULL DEFAULT '', UNIQUE(parent_id,quality)
  );
  CREATE TABLE IF NOT EXISTS cluster_sessions (
    id TEXT PRIMARY KEY, node_id INTEGER NOT NULL, touched INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cluster_audit (
    id INTEGER PRIMARY KEY, at TEXT NOT NULL DEFAULT (datetime('now')), action TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cluster_failures (
    session_id TEXT NOT NULL, node_id INTEGER NOT NULL, until INTEGER NOT NULL,
    PRIMARY KEY(session_id,node_id)
  );`);
  const columns=db.prepare('PRAGMA table_info(cluster_nodes)').all().map(c=>c.name);
  if(!columns.includes('paused'))db.exec('ALTER TABLE cluster_nodes ADD COLUMN paused INTEGER NOT NULL DEFAULT 0');
  if(!columns.includes('profiles'))db.exec("ALTER TABLE cluster_nodes ADD COLUMN profiles TEXT NOT NULL DEFAULT '360p,480p,original'");
  if(!db.prepare('PRAGMA table_info(cluster_files)').all().some(c=>c.name==='mtime_ms'))db.exec('ALTER TABLE cluster_files ADD COLUMN mtime_ms REAL NOT NULL DEFAULT 0');
}
module.exports = {initializeCluster};
