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

2. Run dev server:
   ```bash
   npm run dev
   ```

3. On first launch, enter your [Anthropic API key](https://console.anthropic.com/). It's stored locally in your browser — never sent anywhere except Anthropic's API.

## Stack
- React + Vite
- Claude claude-sonnet-4-20250514 (direct browser API)
- localStorage for persistence
