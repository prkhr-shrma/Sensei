/**
 * db.js — isolated data layer.
 *
 * Backed by PostgreSQL (pg).
 * Connection string read from DATABASE_URL environment variable.
 * Railway injects this automatically when a Postgres addon is attached.
 */
import pg from 'pg';
import connectPg from 'connect-pg-simple';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ── Schema init (called once at server startup) ───────────────

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS progress (
      user_id  TEXT    PRIMARY KEY,
      data     TEXT    NOT NULL DEFAULT '{}',
      saved_at BIGINT  DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );

    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      github_id  TEXT UNIQUE NOT NULL,
      username   TEXT NOT NULL,
      avatar_url TEXT,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
    );
  `);
}

// ── Session store (connect-pg-simple manages its own table) ───

export function createSessionStore(session) {
  const PgStore = connectPg(session);
  return new PgStore({
    pool,
    createTableIfMissing: true,
  });
}

// ── Progress (per-user) ───────────────────────────────────────

export async function getProgress(userId = 'default') {
  const { rows } = await pool.query(
    'SELECT data FROM progress WHERE user_id = $1',
    [userId]
  );
  try { return JSON.parse(rows[0]?.data ?? '{}'); } catch { return {}; }
}

export async function saveProgress(data, userId = 'default') {
  await pool.query(
    `INSERT INTO progress (user_id, data, saved_at)
     VALUES ($1, $2, EXTRACT(EPOCH FROM NOW())::BIGINT)
     ON CONFLICT (user_id) DO UPDATE SET
       data     = EXCLUDED.data,
       saved_at = EXTRACT(EPOCH FROM NOW())::BIGINT`,
    [userId, JSON.stringify(data)]
  );
}

// ── Users ─────────────────────────────────────────────────────

export async function upsertUser({ id, githubId, username, avatarUrl }) {
  await pool.query(
    `INSERT INTO users (id, github_id, username, avatar_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (github_id) DO UPDATE SET
       username   = EXCLUDED.username,
       avatar_url = EXCLUDED.avatar_url`,
    [id, githubId, username, avatarUrl]
  );
}

export async function getUserByGithubId(githubId) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE github_id = $1',
    [githubId]
  );
  return rows[0] ?? null;
}
