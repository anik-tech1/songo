#!/usr/bin/env node

import Database from "better-sqlite3";
import path from "node:path";

const DB_PATH = path.resolve(process.cwd(), "songo.db");
const username = process.argv[2] || "admin";
const password = process.argv[3] || "password";

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

try {
  db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(username, password);
  console.log(`User "${username}" created.`);
} catch (err) {
  console.error(`Failed to create user: ${err.message}`);
}

db.close();
