import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataDir = path.join(__dirname, "..", "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "mentaflow.sqlite");
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
id TEXT PRIMARY KEY,
name TEXT NOT NULL,
email TEXT UNIQUE NOT NULL,
password_hash TEXT,
google_id TEXT UNIQUE,
avatar_url TEXT,
tier TEXT NOT NULL DEFAULT 'free',
is_owner INTEGER NOT NULL DEFAULT 0,
created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mindmaps (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
title TEXT NOT NULL,
data TEXT NOT NULL,
created_at TEXT NOT NULL DEFAULT (datetime('now')),
updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS boards (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
title TEXT NOT NULL,
data TEXT NOT NULL,
created_at TEXT NOT NULL DEFAULT (datetime('now')),
updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS whiteboards (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
title TEXT NOT NULL,
data TEXT NOT NULL,
created_at TEXT NOT NULL DEFAULT (datetime('now')),
updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_messages (
id TEXT PRIMARY KEY,
user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
role TEXT NOT NULL,
content TEXT NOT NULL,
created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

export default db;
