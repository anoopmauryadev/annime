import Database from 'better-sqlite3';
const db = new Database(':memory:');
db.exec(`CREATE TABLE anime (id INTEGER PRIMARY KEY, title TEXT, slug TEXT);`);
db.exec(`INSERT INTO anime (title, slug) VALUES ('Black Clover', 'black-clover');`);

let where = "WHERE 1=1";
const params: Record<string, string> = {};

const search = 'bla cl';
const terms = search.trim().split(/\s+/).filter(Boolean);
terms.forEach((term, idx) => {
    where += ` AND (title LIKE @search${idx} OR slug LIKE @search${idx})`;
    params[`search${idx}`] = `%${term}%`;
});

const rows = db.prepare(`SELECT * FROM anime ${where}`).all(params);
console.log('ROWS:', rows);
