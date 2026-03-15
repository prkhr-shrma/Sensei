# Spec 05 — Activity Heatmap

## Status
**Done** — merged in PR #16

## Context
The Dashboard showed category progress bars, XP, and a revision queue, but no longitudinal view of practice consistency. Users had no way to see whether they were maintaining a steady habit or letting gaps form.

## Change Description
Add a GitHub-style 52-week activity heatmap to the bottom of the Dashboard. Each cell represents one day; colour intensity reflects how many problems were first solved that day.

**Not changing:** existing dashboard cards, history data structure, any solve logic.

## Rationale
Habit visibility drives habit formation. The heatmap is a well-understood pattern (GitHub, LeetCode both use it) that gives an immediate read on consistency without requiring any new data — `history[pid].firstSolved` timestamps are already stored.

Alternatives considered:
- Line chart of solves per week — less scannable, harder to spot gaps
- Just a streak counter — already present in header; doesn't show the shape of the habit

## Implementation
`Heatmap({history})` component — stateless, pure render:

1. Build `counts` map: `{dateKey: n}` from `Object.values(history).forEach(({firstSolved}) => ...)`
   Date key format matches `todayKey()`: `"${year}-${month}-${date}"` (month is 0-indexed)
2. Compute 53 week columns ending today, aligned to Sunday week start
3. Render: month labels row → 7-row day grid (Mon/Wed/Fri labels on left)
4. Colour scale: `0` → `var(--border)`, `1` → `#166534`, `2` → `#15803d`, `3` → `#16a34a`, `4+` → `#4ade80`
5. Legend (Less … More) bottom-right

Placed full-width at the bottom of the dashboard flex-wrap container via `flexBasis: '100%'`.

## Affected Components
- `src/App.jsx` — `Heatmap` component + dashboard JSX

## Acceptance Criteria
- [x] Heatmap renders 52 weeks of cells in the Dashboard view
- [x] Days with 0 solves show a dim cell; days with solves show green proportional to count
- [x] Month labels appear correctly above each new month
- [x] Tooltip on hover shows date and solve count
- [x] Heatmap is horizontally scrollable on small screens
- [x] Renders correctly in both dark and light mode
