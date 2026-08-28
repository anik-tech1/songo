#!/usr/bin/env node

import initSqlJs from "sql.js";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = path.resolve(process.cwd(), "songo.db");
const username = process.argv[2] || "admin";
const password = process.argv[3] || "password";

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
`);

try {
  db.run("INSERT INTO users (username, password_hash) VALUES (?, ?)", [username, password]);
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log(`User "${username}" created.`);
} catch (err) {
  console.error(`Failed to create user: ${err.message}`);
}
