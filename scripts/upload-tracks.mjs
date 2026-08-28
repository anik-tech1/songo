#!/usr/bin/env node

import "dotenv/config";
import initSqlJs from "sql.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "node:fs";
import path from "node:path";

const B2 = new S3Client({
  region: "eu-central-003",
  endpoint: "https://s3.eu-central-003.backblazeb2.com",
  forcePathStyle: true,
  credentials: {
    accessKeyId: (process.env.B2_KEY_ID || "").trim(),
    secretAccessKey: (process.env.B2_APP_KEY || "").trim(),
  },
});

const BUCKET = process.env.B2_BUCKET || "songo-music";
const DB_PATH = path.resolve(process.cwd(), "songo.db");
const TRACKS_DIR = process.env.TRACKS_DIR || "./tracks";

const SQL = await initSqlJs();

let db;
if (fs.existsSync(DB_PATH)) {
  db = new SQL.Database(fs.readFileSync(DB_PATH));
} else {
  db = new SQL.Database();
}

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT NOT NULL,
    album TEXT DEFAULT '',
    duration_seconds INTEGER DEFAULT 0,
    r2_key TEXT NOT NULL,
    cover_key TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS playlist_songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    song_id INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
  );
`);

if (!fs.existsSync(TRACKS_DIR)) {
  console.error(`Tracks directory not found: ${TRACKS_DIR}`);
  process.exit(1);
}

const files = fs.readdirSync(TRACKS_DIR).filter((f) => f.endsWith(".mp3"));

if (files.length === 0) {
  console.log("No .mp3 files found in", TRACKS_DIR);
  process.exit(0);
}

console.log(`Found ${files.length} tracks. Uploading to B2...`);

for (const file of files) {
  const fileName = path.basename(file, ".mp3");
  const parts = fileName.split(" - ");
  let artist = "Unknown";
  let title = fileName;
  if (parts.length >= 2) {
    artist = parts[0].trim();
    title = parts.slice(1).join(" - ").trim();
  }

  const filePath = path.join(TRACKS_DIR, file);
  const fileBuffer = fs.readFileSync(filePath);
  const b2Key = `tracks/${file}`;

  console.log(`Uploading: ${artist} - ${title}`);

  try {
    const existing = db.exec("SELECT id FROM songs WHERE r2_key = ?", [b2Key]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      console.log(`  Already in DB, skipping`);
      continue;
    }

    await B2.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: b2Key,
        Body: fileBuffer,
        ContentType: "audio/mpeg",
      })
    );
    console.log(`  Uploaded to B2`);

    db.run("INSERT OR IGNORE INTO songs (title, artist, album, r2_key) VALUES (?, ?, ?, ?)", [title, artist, "", b2Key]);
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    console.log(`  Inserted into DB`);
  } catch (err) {
    console.error(`  Failed: ${err.message}`);
  }
}

const data = db.export();
fs.writeFileSync(DB_PATH, Buffer.from(data));
console.log(`Done! ${files.length} tracks processed.`);
