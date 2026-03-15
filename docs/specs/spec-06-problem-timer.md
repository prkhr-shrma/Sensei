# Spec 06 — Problem Timer

## Status
**Done** — merged in PR #16

## Context
Users had no sense of how long they had been working on a problem. Interview preparation requires time awareness — knowing when you've been stuck too long (signal to look at a hint) or tracking personal solve times.

## Change Description
A per-problem timer appears in the center panel's top bar. It starts on the first keystroke (not on problem load, to avoid counting reading time), counts up in seconds, and changes state on meaningful events.

**Not changing:** revision timer (separate concern), XP logic, any other state.

## Rationale
Starting on first keystroke is deliberate: reading and planning time should not penalise the displayed solve time. Turning red at 30 min gives a concrete signal to seek a hint rather than thrashing. Turning green on solve gives positive feedback.

Alternatives considered:
- Start timer on problem load — inflates time with reading; misleading
- Count-down timer — arbitrary limit; discourages thinking; creates pressure that hurts learning

## Implementation
State: `timerSecs`, `timerRunning`, `timerSolved`
Refs: `timerRef` (interval handle), `hasTyped` (boolean, reset on problem switch)

Flow:
- CodeMirror `onChange`: if `!hasTyped.current` → `hasTyped.current = true; setTimerRunning(true)`
- `useEffect([timerRunning])`: starts/clears `setInterval(() => setTimerSecs(s => s+1), 1000)`
- `selectProb`: resets `timerSecs=0, timerRunning=false, timerSolved=false, hasTyped.current=false`
- `confirmSolved`: `clearInterval(timerRef.current); setTimerRunning(false); setTimerSolved(true)`

Display in editor top bar:
- Not started: `--:--`
- Running <30min: `MM:SS` (neutral colour)
- Running ≥30min: `MM:SS` in red + ⚠
- Solved: `MM:SS` in green + ✓

## Affected Components
- `src/App.jsx` — timer state/refs, CodeMirror onChange, selectProb, confirmSolved, editor top bar JSX

## Acceptance Criteria
- [x] Timer shows `--:--` before first keystroke
- [x] Timer starts counting on first keystroke
- [x] Timer resets when switching problems
- [x] Timer turns red with ⚠ after 30 minutes
- [x] Timer turns green with ✓ when problem is solved
- [x] Timer does not affect revision mode
