# Spec 02 — Structured Problem Descriptions + problems.js Split

## Status
**Done** — merged in PR #16

## Context
All 75 Blind 75 problems were defined inline in `App.jsx` (~300 lines). Problem descriptions were plain strings with no examples or constraints. The `desc` field was a single paragraph; there was no `examples` or `constraints` field. This made the left panel less useful than LeetCode's actual problem page.

## Change Description

### What is changing
1. Extract all problem data from `App.jsx` into `src/problems.js` (ES module, `export const P = [...]`)
2. Each problem gains:
   - `examples`: array of `{input, output, explanation?, stdin}` (2–3 per problem)
   - `constraints`: array of constraint strings (LeetCode-accurate)
   - `desc`: rewritten to match LeetCode wording
3. `ProbDesc` component in `App.jsx` renders the structured data with labeled example blocks and a constraints list
4. "▶ Load in Test" button on each example populates the test pane `stdin` field

### What is not changing
- Problem IDs, titles, categories, difficulties, LC numbers, patterns
- Solution code (`sol`), notes (`note`)
- All app logic

## Rationale
Users need accurate problem context to practice effectively. The plain-string descriptions lacked the input/output examples that are essential for understanding edge cases. Splitting into `problems.js` also makes future edits (adding problems, fixing descriptions) easier without touching App.jsx.

## Affected Components
- `src/problems.js` — new file, 1533 lines
- `src/App.jsx` — removed inline P array, added `ProbDesc` component

## Acceptance Criteria
- [x] All 75 problems have at least 2 examples with input/output
- [x] All 75 problems have at least 2 constraints
- [x] `ProbDesc` renders examples in labeled blocks with monospace font
- [x] "▶ Load in Test" populates test stdin and is only shown when `stdin` is present
- [x] Constraints render as a bullet list
- [x] App.jsx no longer contains inline problem data
