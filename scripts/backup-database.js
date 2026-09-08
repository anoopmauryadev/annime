const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const source = path.join(root, "data", "anime.db");
const backupDir = path.join(root, "data", "backups");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const destination = path.join(backupDir, `anime-${stamp}.db`);
const retentionDays = Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS || 14));

async function main() {
  if (!fs.existsSync(source)) throw new Error("Database file does not exist");
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });

  const db = new Database(source, { readonly: true, fileMustExist: true });
  try {
    await db.backup(destination);
  } finally {
    db.close();
  }
  fs.chmodSync(destination, 0o600);

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  for (const name of fs.readdirSync(backupDir)) {
    if (!/^anime-.*\.db$/.test(name)) continue;
    const file = path.join(backupDir, name);
    if (fs.statSync(file).mtimeMs < cutoff) fs.unlinkSync(file);
  }
  console.log(JSON.stringify({ time: new Date().toISOString(), level: "info", service: "database-backup", destination }));
}

main().catch((error) => {
  console.error(JSON.stringify({
    time: new Date().toISOString(), level: "error", service: "database-backup",
    message: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
