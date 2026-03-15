# Spec 01 — Resizable Panes

## Status
**Done** — merged in PR #16

## Context
The 3-panel LeetCode-style layout had fixed widths (left 38%, right 300px, test pane 180px). Users could not resize any panel, forcing suboptimal use of screen space.

## Change Description
Add drag handles between all resizable boundaries:
- Left ↔ Center panel (vertical divider)
- Center ↔ Right panel (vertical divider)
- Editor ↔ Test pane (horizontal divider inside center panel)

**Not changing:** layout structure, panel content, any business logic.

## Rationale
Screen real estate is a primary constraint in a coding tool. Users reading a long problem description need a wider left panel; users debugging need a taller test pane. Fixed widths hurt usability.

Alternatives considered:
- CSS `resize` property — does not work reliably cross-browser for flex children
- External library (react-resizable-panels) — unnecessary dependency for 3 drag handles

## Implementation
- `useState` for `leftW` (default 420px), `rightW` (default 300px), `testH` (default 180px)
- `dragRef` ref holds `{type, startX/Y, startVal}` during drag
- Single `mousemove` / `mouseup` listener registered on `window` via `useEffect`
- Drag handles: 4px-wide divs with `cursor: col-resize` / `row-resize`

## Affected Components
- `src/App.jsx` — layout and drag state only

## Acceptance Criteria
- [x] Left/center vertical divider is draggable; left panel width changes
- [x] Center/right vertical divider is draggable; right panel width changes
- [x] Editor/test horizontal divider is draggable; test pane height changes
- [x] Drag does not cause layout thrash or flicker
- [x] All other features work unchanged
