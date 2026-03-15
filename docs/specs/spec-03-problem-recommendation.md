# Spec 03 — Problem Recommendation

## Status
**Done** — merged in PR #16

## Context
After solving a problem, the Sensei chat went silent. Users had no guidance on what to practice next, leading to random problem selection that may not reinforce the same pattern or build toward adjacent difficulty.

## Change Description
After a problem is first solved (AI confirms with ✓), Sensei appends a recommendation message to the chat suggesting the next problem to attempt.

**Not changing:** AI call logic, revision flow, any other chat behavior.

## Rationale
Spaced repetition and pattern grouping are core to effective interview prep. A deterministic recommendation keeps users on a productive path without requiring AI inference (cheaper, instant, always available).

Alternatives considered:
- AI-generated recommendation — adds latency and cost; overkill for a next-problem suggestion
- Show recommendation in UI outside chat — breaks the existing chat-as-mentor mental model

## Implementation
`getRecommendation(pid, solvedSet)` — pure function, runs outside the component:

Priority order:
1. Same `pat` (pattern), not yet solved → "same Hash Map pattern"
2. Same `cat` (category), not yet solved → "also in Array"
3. Any unsolved problem → generic suggestion
4. All solved → trophy message

Called at the end of `confirmSolved`. Uses the `solved` Set **before** the state update (i.e., the new problem is not yet in the set, so it won't recommend the just-solved problem).

## Affected Components
- `src/App.jsx` — `getRecommendation` helper + `confirmSolved` update

## Acceptance Criteria
- [x] After first solve, a recommendation message appears in chat
- [x] Recommendation names the shared pattern when one exists
- [x] Recommendation does not trigger during revision solves
- [x] Recommendation does not suggest the just-solved problem
- [x] If all problems in the pattern are solved, falls back to category, then any unsolved
