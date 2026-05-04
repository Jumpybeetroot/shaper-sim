# System Patterns

## Architecture Overview

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

## Data Flow

1. User interacts with Sidebar sliders/selects
2. `updateState(key, value)` updates AppState
3. State passes through `sanitizeAppState` before reaching worker
4. Worker receives sanitized state, computes PSD and shaper scores
5. Worker posts results back (two message types: `PSD` and `SHAPERS`)
6. `useMemo` in App.tsx renders Chart.js data from worker results

## Key Patterns

### Worker Message Protocol
- `PSD` — fired on every sanitized state change. Returns predX, predY, freqs, psdX, psdY, nozzle PSDs
- `SHAPERS` — fired separately, debounced 600ms. Returns scoreX, scoreY, scoreTarget, scoringMode, psdRequestId
- Shaper results only applied when `psdRequestId` matches latest rendered PSD

### Damping Separation (CRITICAL)
- Shaper construction: always uses `DEFAULT_DAMPING_RATIO = 0.1` (matches Klipper)
- Shaper scoring: evaluates over Klipper's `[0.075, 0.1, 0.15]` test damping ratios
- UI display: uses `state.dampingRatio` (user's slider)
- Do NOT unify these

### State Sanitization
- All state mutations pass through `sanitizeAppState` / `sanitizeProfiles`
- Never post unsanitized state to worker

### Float Array Loops
- Always use integer index iteration: `for (let i = 0; i < N; i++) { const t = i * dt; }`
- Never use floating-point accumulation for loop bounds

## Naming Conventions

- Components: PascalCase (`Sidebar.tsx`, `ChartDisplay.tsx`)
- Lib modules: camelCase (`shaperLogic.ts`, `csvOverlay.ts`)
- Types: PascalCase interfaces (`AppState`, `SpeedParams`, `Imperfections`)
- Constants: UPPER_SNAKE_CASE (`DEFAULT_DAMPING_RATIO`)

## Safety Patterns

- ErrorBoundary wraps main UI for graceful failure
- State sanitization prevents invalid values reaching physics engine
- Worker isolation prevents computation from blocking UI thread
