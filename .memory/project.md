# Project Memory — Klipper Input Shaper Simulator

## Overview
Physics-based resonance prediction and Input Shaper visualization tool for Klipper 3D printers. Live demo: https://jumpybeetroot.github.io/shaper-sim/

## Tech Stack
- **Frontend:** React 19 + Vite 8 + TypeScript 6
- **Charts:** Chart.js 4 + react-chartjs-2
- **Icons:** @phosphor-icons/react 2.1.10 (use `*Icon` suffix forms)
- **Styling:** Vanilla CSS (no Tailwind, no CSS-in-JS)
- **Computation:** Web Worker (`shaper.worker.ts`) for heavy physics math
- **Testing:** Node.js native test runner with `--experimental-strip-types`

## File Structure
```
shaper-sim-react/src/
  App.tsx              — main component: state, charts, worker orchestration, top nav
  components/
    Sidebar.tsx        — sliders, selects, section controls
    ChartDisplay.tsx   — Chart.js wrapper
    DraggableOverlay.tsx — draggable overlay component
    ErrorBoundary.tsx  — error boundary
  lib/
    stateSanitizer.ts  — AppState/profile migration, validation, UI-safe ranges
    csvOverlay.ts      — Klipper CSV parser
    shaperLogic.ts     — ALL physics & math (core engine)
    shaper.worker.ts   — Web Worker: receives AppState, caches results, posts back
    motorPresets.ts    — stepper motor preset data
    beltUtils.ts       — belt-related utilities
  types.ts             — AppState interface and defaultState
```

## Key Architecture Decisions
1. **Worker isolation** — heavy computation off main thread; two message types: `PSD` and `SHAPERS`
2. **Damping separation** — shaper construction uses Klipper's DEFAULT_DAMPING_RATIO=0.1; UI slider affects display only
3. **Speed simulation** — separate from imperfections; operating condition vs mechanical defect
4. **CSV overlay normalization** — real ADXL data normalized to simulated peak for shape comparison

## Build & Deploy
- Dev: `npm run dev` → http://localhost:5173/
- Build: `npm run build` → `shaper-sim-react/dist/`
- Deploy: GitHub Pages via `.github/workflows/deploy.yml` on push to `main`
- Tests: `npm run test` (Node.js native test runner)

## Git Workflow
- WIP branch: `wip-local-testing`
- Auto-commit after every change: `git add . && git commit -m "wip: AI auto-save - [description]" && git push origin wip-local-testing`
