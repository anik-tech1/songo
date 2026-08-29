import type { Env } from "./types";

export async function ensureSchema(env: Env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT DEFAULT '',
      duration_seconds INTEGER DEFAULT 0,
      r2_key TEXT NOT NULL UNIQUE,
      cover_key TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS playlist_songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      song_id INTEGER NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    )`),
  ]);
}

export async function seedDefaultUser(env: Env) {
  const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind("admin").first();
  if (existing) return;
  await env.DB.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").bind("admin", "password").run();
}

export async function seedFromB2(env: Env) {
  const { listB2Tracks } = await import("./storage");
  const existing = await env.DB.prepare("SELECT count(*) as c FROM songs").first<{ c: number }>();
  if (existing && existing.c > 0) return;

  const keys = await listB2Tracks(env);
  const stmt = env.DB.prepare("INSERT OR IGNORE INTO songs (title, artist, album, r2_key) VALUES (?, ?, ?, ?)");
  const batch = keys.map((key) => {
    const fileName = key.replace("tracks/", "").replace(".mp3", "");
    const parts = fileName.split(" - ");
    let artist = "Unknown";
    let title = fileName;
    if (parts.length >= 2) {
      artist = parts[0].trim();
      title = parts.slice(1).join(" - ").trim();
    }
    return stmt.bind(title, artist, "", key);
  });

  await env.DB.batch(batch);
}
