/**
 * db.js — isolated data layer.
 *
 * Currently backed by SQLite (better-sqlite3).
 * To migrate to PostgreSQL: replace the implementation of getProgress()
 * and saveProgress() below. The interface stays the same, nothing else changes.
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
    id      INTEGER PRIMARY KEY CHECK (id = 1),
    data    TEXT    NOT NULL DEFAULT '{}',
    saved_at INTEGER DEFAULT (strftime('%s','now'))
  )
`);

// Ensure exactly one row always exists
db.prepare("INSERT OR IGNORE INTO progress (id, data) VALUES (1, '{}')").run();

// ── Public interface ──────────────────────────────────────────
// Swap these two functions when moving to PostgreSQL.

export function getProgress() {
  const row = db.prepare('SELECT data FROM progress WHERE id = 1').get();
  try { return JSON.parse(row?.data ?? '{}'); } catch { return {}; }
}

export function saveProgress(data) {
  db.prepare(
    "UPDATE progress SET data = ?, saved_at = strftime('%s','now') WHERE id = 1"
  ).run(JSON.stringify(data));
}
