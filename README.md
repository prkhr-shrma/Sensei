# sensei · blind75

AI-powered DSA mentor for Blind 75. Practice problems with live guidance — Sensei watches your code as you type, asks questions instead of giving answers, and tracks your fluency over time.

## Features
- All 75 problems with optimal solutions (NeetCode-curated)
- Live peek: AI watches your code every 4 seconds and nudges you if you drift
- Spaced repetition: confidence decay, revision queue, cold-solve detection
- XP, streaks, daily goals, category progress
- Revision mode: 20-min timed cold solve, no hints

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` from the example:
   ```bash
   cp .env.example .env
   ```
   Then add your [Anthropic API key](https://console.anthropic.com/) to `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. Run (starts both the Express proxy server and Vite dev server):
   ```bash
   npm run dev
   ```

The API key stays in `.env` on your machine — it's never bundled, never in the browser, never committed.

## Stack
- React + Vite (frontend)
- Express (API proxy — keeps the key server-side)
- Claude claude-sonnet-4-20250514
- localStorage for persistence
