/**
 * db.js — isolated data layer.
 *
 * Currently backed by SQLite (better-sqlite3).
 * To migrate to PostgreSQL: replace the implementation of the functions below.
 * The interface stays the same; nothing else changes.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'progress.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS progress (
    user_id  TEXT    PRIMARY KEY,
    data     TEXT    NOT NULL DEFAULT '{}',
    saved_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    github_id  TEXT UNIQUE NOT NULL,
    username   TEXT NOT NULL,
    avatar_url TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );
`);

// ── Progress (per-user) ───────────────────────────────────────

export function getProgress(userId = 'default') {
  const row = db.prepare('SELECT data FROM progress WHERE user_id = ?').get(userId);
  try { return JSON.parse(row?.data ?? '{}'); } catch { return {}; }
}

export function saveProgress(data, userId = 'default') {
  db.prepare(
    `INSERT INTO progress (user_id, data, saved_at)
     VALUES (?, ?, strftime('%s','now'))
     ON CONFLICT(user_id) DO UPDATE SET
       data = excluded.data,
       saved_at = excluded.saved_at`
  ).run(userId, JSON.stringify(data));
}

// ── Users ─────────────────────────────────────────────────────

export function upsertUser({ id, githubId, username, avatarUrl }) {
  db.prepare(
    `INSERT INTO users (id, github_id, username, avatar_url)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(github_id) DO UPDATE SET
       username = excluded.username,
       avatar_url = excluded.avatar_url`
  ).run(id, githubId, username, avatarUrl);
}

export function getUserByGithubId(githubId) {
  return db.prepare('SELECT * FROM users WHERE github_id = ?').get(githubId);
}
