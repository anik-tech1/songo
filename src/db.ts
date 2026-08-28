import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = path.resolve(process.cwd(), "songo.db");

let db: SqlJsDatabase;

export async function initDb(): Promise<SqlJsDatabase> {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT DEFAULT '',
      duration_seconds INTEGER DEFAULT 0,
      r2_key TEXT NOT NULL,
      cover_key TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS playlist_songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      song_id INTEGER NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    )
  `);

  const defaultUser = process.env.DEFAULT_USER || "admin";
  const defaultPass = process.env.DEFAULT_PASS || "password";

  const existing = db.exec("SELECT id FROM users WHERE username = ?", [defaultUser]);
  if (existing.length === 0 || existing[0].values.length === 0) {
    db.run("INSERT INTO users (username, password_hash) VALUES (?, ?)", [defaultUser, defaultPass]);
    console.log(`Created default user: ${defaultUser}`);
  }

  saveDb();
  return db;
}

export async function seedFromB2() {
  const { listB2Tracks } = await import("./storage");
  const existing = db.exec("SELECT count(*) as c FROM songs");
  const count = existing[0].values[0][0] as number;
  if (count > 0) {
    console.log(`DB already has ${count} songs, skipping seed.`);
    return;
  }

  console.log("DB empty, seeding from B2...");
  const keys = await listB2Tracks();
  console.log(`Found ${keys.length} files in B2.`);

  for (const key of keys) {
    const fileName = key.replace("tracks/", "").replace(".mp3", "");
    const parts = fileName.split(" - ");
    let artist = "Unknown";
    let title = fileName;
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts.slice(1).join(" - ").trim();
    }
    db.run("INSERT OR IGNORE INTO songs (title, artist, album, r2_key) VALUES (?, ?, ?, ?)", [title, artist, "", key]);
  }

  saveDb();
  console.log(`Seeded ${keys.length} songs from B2.`);
}

export function getDb(): SqlJsDatabase {
  if (!db) throw new Error("Database not initialized. Call initDb() first.");
  return db;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export interface UserPayload {
  userId: number;
  username: string;
}
