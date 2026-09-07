import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import Database from "better-sqlite3";

const root = process.cwd();
const databasePath = path.join(root, "data", "anime.db");
const backupPath = path.join(root, "data", "security-backup-20260908.db");
if (fs.existsSync(databasePath) && !fs.existsSync(backupPath)) {
  // SQLite's online backup includes committed WAL data while the old app is running.
  const source = new Database(databasePath, { readonly: true });
  try {
    await source.backup(`${backupPath}.partial`);
    fs.chmodSync(`${backupPath}.partial`, 0o600);
    fs.renameSync(`${backupPath}.partial`, backupPath);
  } finally { source.close(); }
}
if (fs.existsSync(backupPath)) fs.chmodSync(backupPath, 0o600);

const source = fs.readFileSync(path.join(root, "src/lib/db.ts"), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const require = createRequire(import.meta.url);
const loaded = { exports: {} };
new Function("require", "module", "exports", code)(require, loaded, loaded.exports);
const database = loaded.exports.getDb();
const columns = database.prepare("PRAGMA table_info(admin_users)").all();
if (!columns.some((column) => column.name === "session_version")) throw new Error("Admin session migration failed");
database.close();
console.log("PASS: security database migration applied; recovery backup retained.");
