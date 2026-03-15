# Spec 04 — Code Persistence Per Problem

## Status
**Done** — merged in PR #16

## Context
Switching problems discarded whatever code was in the editor. Users who partially solved a problem and switched away to check another lost their work. There was no per-problem code storage.

## Change Description
The editor's code is saved to `localStorage` (keyed by problem ID) on every keystroke, debounced 500ms. When switching to a problem, the saved code is restored if present; otherwise the default template is shown.

**Not changing:** server-side progress storage, solved/history state, any other persistence.

## Rationale
Code is the primary work artifact in this app. Losing it on navigation is a critical usability gap. `localStorage` is the right scope — it's per-device, zero-latency, requires no server round-trip, and code drafts are not worth syncing across devices at this stage.

Alternatives considered:
- Save to server with progress — too heavy, adds API calls on every keystroke
- Save on problem switch only — misses browser close / crash scenarios

## Implementation
- `codeSaveTimer` ref holds the debounce timeout handle
- In CodeMirror `onChange`: `clearTimeout(codeSaveTimer.current)` then `setTimeout(() => localStorage.setItem('code_<id>', val), 500)`
- In `selectProb`: `localStorage.getItem('code_<prob.id>')` → use saved or fall back to `TMPL`

Storage key format: `code_<problem_id>` (e.g. `code_1`, `code_42`)

## Affected Components
- `src/App.jsx` — `codeSaveTimer` ref, CodeMirror `onChange`, `selectProb`

## Acceptance Criteria
- [x] Typing in the editor saves code within 500ms
- [x] Switching to another problem and back restores the previously typed code
- [x] A problem with no saved code shows the default template
- [x] Saving does not block the UI (debounced, non-blocking)
