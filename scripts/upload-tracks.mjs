#!/usr/bin/env node

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const B2 = new S3Client({
  region: "us-west-004",
  endpoint: "https://s3.us-west-004.backblazeb2.com",
  credentials: {
    accessKeyId: process.env.B2_KEY_ID || "",
    secretAccessKey: process.env.B2_APP_KEY || "",
  },
});

const BUCKET = process.env.B2_BUCKET || "songo-music";
const DB_PATH = path.resolve(process.cwd(), "songo.db");
const TRACKS_DIR = process.env.TRACKS_DIR || "./tracks";

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
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

const insert = db.prepare("INSERT OR IGNORE INTO songs (title, artist, album, r2_key) VALUES (?, ?, ?, ?)");

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
    await B2.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: b2Key,
        Body: fileBuffer,
        ContentType: "audio/mpeg",
      })
    );
    console.log(`  Uploaded to B2`);

    insert.run(title, artist, "", b2Key);
    console.log(`  Inserted into DB`);
  } catch (err: any) {
    console.error(`  Failed: ${err.message}`);
  }
}

console.log(`Done! ${files.length} tracks processed.`);
db.close();
