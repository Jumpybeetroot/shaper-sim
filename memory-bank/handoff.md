# Handoff

## Read Order

For a new agent session, read in this order:

1. `memory-bank/projectbrief.md` — what is this project?
2. `memory-bank/activeContext.md` — what's happening now?
3. `memory-bank/progress.md` — what's done, what's remaining?
4. `AGENT.md` — project-specific agent instructions and critical gotchas
5. `memory-bank/systemPatterns.md` — architecture patterns and data flow
6. `memory-bank/techContext.md` — tech stack and commands
7. `memory-bank/decisions.md` — why things are built this way

## Current Safety/Operational Posture

- **Git workflow:** Auto-commit after every change, push to `wip-local-testing`
- **Deployment:** Auto-deploy on push to `main` via GitHub Actions
- **State management:** All state mutations through `sanitizeAppState`
- **Worker isolation:** Heavy computation off main thread

## Immediate Next Action

Memory stack bootstrap in progress. Verify scaffold completeness, check Graphify availability, commit and push.

## Critical Gotchas (from AGENT.md)

1. **Damping separation** — shaper construction uses 0.1, UI slider affects display only. Do NOT unify.
2. **Peak width** — primary peak uses HWHM `w = center_freq * damping_ratio`. Do NOT revert to FWHM.
3. **Step response normalization** — impulse amplitudes must be normalized by sum.
4. **Float array loops** — use integer index iteration, never floating-point accumulation.
5. **Non-null assertions** — `best_res` and `best_shaper_obj` use `!` intentionally in `scoreShapers`.
6. **Phosphor icons** — use `*Icon` suffix forms, bare names are deprecated.
7. **Chart.js types** — use `as const` on union-typed option literals.
