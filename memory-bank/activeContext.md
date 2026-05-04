# Active Context

Last updated: 2026-05-04

## Current Focus

Memory stack is initialized. Recent cleanup removed stale references to the old external memory tool from repo/global agent state.

## Project State

- All core features implemented: physics-based frequency prediction, shaper scoring, PSD/step response modes, CSV overlay, snapshots, speed simulation
- Deployed to GitHub Pages at https://jumpybeetroot.github.io/shaper-sim/
- WIP branch: `wip-local-testing`
- React 19 + Vite 8 + TypeScript 6 + Chart.js 4
- Web Worker handles heavy computation off main thread

## Important Blockers

- None known

## Next Steps

1. Keep Memory Bank files updated as simulator behavior, docs, validation, or workflow state changes.
2. Use the global bootstrap guide for future memory-stack repairs or installs.
3. Run targeted simulator verification when code behavior changes.
