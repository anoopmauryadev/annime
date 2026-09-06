const fs = require('fs');
let code = fs.readFileSync('src/lib/db.ts', 'utf8');

const targetCount = `export function getTotalAnimeCount(opts?: {
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
    params.genre = \`%"\${opts.genre}"%\`;
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
    params.search = \`%\${opts.search}%\`;
  }
  const result = db.prepare(\`SELECT COUNT(*) as c FROM anime \${where}\`).get(params) as { c: number };
  return result.c;
}`;

code = code.replace(/export function getTotalAnimeCount[^]*?return row\.c;\n\}/, targetCount);
fs.writeFileSync('src/lib/db.ts', code);
