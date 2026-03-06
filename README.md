# ⚔ Sensei · Your Live DSA Coach

An AI-powered mentor for mastering **Data Structures and Algorithms**. Built around the famous **Blind 75** — a curated set of 75 essential coding problems that cover every major DSA pattern asked in technical interviews at top companies.

Sensei watches your code as you type, nudges you when you're stuck, asks questions instead of handing out answers, and tracks your fluency over time using spaced repetition.

![Sensei screenshot](screenshot.png)

---

## Features
- **All 75 Blind 75 problems** with optimal solutions (NeetCode-curated), covering Arrays, Trees, Graphs, DP, Binary Search, Linked Lists, and more
- **Live AI coaching**: Sensei watches your code after 5s of inactivity and nudges you if you're stuck — auto-disables if you stop responding
- **Socratic method**: hints and reviews guide you to the answer rather than giving it away
- **Spaced repetition**: confidence decay, revision queue, cold-solve detection
- **Revision mode**: 20-min timed cold solve, no hints
- XP, streaks, daily goals, per-category progress
- **SQLite persistence**: progress saved server-side, survives page refreshes
- Tab key inserts spaces in the code editor
- Light / dark mode toggle

---

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` from the example:
   ```bash
   cp .env.example .env
   ```

3. Generate tokens and fill in `.env`:
   ```bash
   npm run gen-token   # run twice — once for each token
   ```
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   PROGRESS_TOKEN=<generated>
   VITE_PROGRESS_TOKEN=<same value as PROGRESS_TOKEN>
   ```

4. Run dev server (Vite + Express together):
   ```bash
   npm run dev
   ```

The API key stays in `.env` — never bundled, never in the browser, never committed.

---

## Security
- API key is server-side only (never reaches the browser)
- `POST /api/progress` requires `X-Progress-Token` header — blocks unauthorised writes
- Rate limiting: 60 req/min per IP
- Helmet security headers on all responses
- Body size capped at 16 KB

---

## Deployment (Railway)
1. Push to GitHub
2. Connect repo in Railway → set environment variables:
   - `ANTHROPIC_API_KEY`
   - `PROGRESS_TOKEN`
   - `VITE_PROGRESS_TOKEN` *(must be set before build — Vite bakes it into the bundle)*
3. Add a Volume mounted at `/app/data` for SQLite persistence across redeploys

---

## Stack
- React + Vite (frontend)
- Express (API proxy — keeps the key server-side)
- Claude Sonnet 4.6 (hints/review) + Claude Haiku 4.5 (live peek)
- SQLite via `better-sqlite3` (isolated `db.js` — swap for Postgres by changing only that file)
- Vitest + Supertest (47 tests)

---

## Scripts
| Command | Description |
|---|---|
| `npm run dev` | Start dev server (Vite + Express) |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm test` | Run all 47 tests |
| `npm run gen-token` | Generate a secure random token |
