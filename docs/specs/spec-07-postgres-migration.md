# Spec 07 — Railway PostgreSQL Migration

## Status
**Pending** — not yet implemented

## Context
The app currently uses `better-sqlite3` (local SQLite file at `data/progress.db`) for three tables: `progress`, `users`, `sessions`. On Railway, the ephemeral filesystem means the SQLite file is wiped on every redeploy, losing all user progress. There is also no space to grow the database on the deployed instance.

`db.js` is already designed as an isolated data layer with the comment:
> "To migrate to PostgreSQL: replace the implementation of the functions below. The interface stays the same; nothing else changes."

## Change Description

### What is changing
- Replace `better-sqlite3` with `pg` (node-postgres) in `db.js`
- All exported functions become `async` (currently synchronous)
- `server.js` `await`s all `db.*` calls
- Add Railway PostgreSQL addon (provisioned via Railway dashboard)
- Connection via `DATABASE_URL` environment variable (Railway injects this automatically)
- Schema migration: run `CREATE TABLE IF NOT EXISTS` on startup (same DDL, just via `pg`)

### What is not changing
- Table schemas (`progress`, `users`, `sessions`)
- Function signatures (names stay identical — `getProgress`, `saveProgress`, `upsertUser`, etc.)
- `createSessionStore` (re-implemented using `connect-pg-simple` instead of the custom SQLite store)
- All `server.js` route logic (only `await` keywords added at call sites)
- All frontend code — zero changes

## Rationale
SQLite on an ephemeral filesystem is not viable for production. PostgreSQL is the standard Railway-native choice: Railway provides a managed PostgreSQL addon, injects `DATABASE_URL`, handles backups, and scales independently of the app container. The isolated `db.js` layer makes this migration surgical — no scattered DB calls to update.

Alternatives considered:
- PlanetScale (MySQL) — extra complexity, no clear benefit over Railway's native Postgres
- Turso (libSQL edge) — interesting but immature; adds a vendor dependency for no gain here
- Persist SQLite via Railway volume — volumes are available but add ops complexity; Postgres is simpler long-term

## Impact
- **Affected components:** `db.js` (full rewrite), `server.js` (add `await` at ~8 call sites), `package.json` (swap dependency)
- **User-visible:** none during normal operation; progress is preserved across deploys (improvement)
- **Backward compatibility:** existing user data in SQLite is lost on first deploy to Postgres — acceptable since the app is pre-GA. Document this in the PR.
- **Dev environment:** developers need a local Postgres instance or a `.env` with a Postgres `DATABASE_URL`; add a `docker-compose.yml` with a `postgres` service for convenience

## Architectural Change

```
Before:
  server.js → db.js → better-sqlite3 → data/progress.db (ephemeral file)

After:
  server.js → db.js → pg → Railway PostgreSQL (persistent, managed)
```

## Acceptance Criteria
- [ ] `npm install pg connect-pg-simple` / `npm uninstall better-sqlite3`
- [ ] `db.js` exports the same functions, all async, backed by `pg`
- [ ] `server.js` awaits all db calls; no unhandled promise rejections
- [ ] Sessions persist across server restarts (via `connect-pg-simple`)
- [ ] User progress persists across Railway redeploys
- [ ] `npm test` — all existing server tests pass (mock or test-DB)
- [ ] CI green on PR
- [ ] Local dev works with `DATABASE_URL=postgresql://localhost/sensei_dev`

## Branch
`chore/backend-postgres-migration`
