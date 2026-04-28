# AI Agent Instructions — shaper-sim

Hello, fellow AI coding assistant. This file contains critical architectural context and gotchas for the **Klipper Input Shaper Simulator**. Read it carefully before modifying any code.

## 1. Tech Stack

- **React 19 + Vite 8 + TypeScript** — the entire app lives in `shaper-sim-react/`
- **Chart.js 4 + react-chartjs-2** — all graphs (PSD curves, step responses)
- **@phosphor-icons/react 2.1.10** — use the `*Icon` suffix forms (e.g. `FileArrowUpIcon`); bare names are deprecated aliases
- **Web Worker** — heavy computation runs off the main thread in `shaper.worker.ts`
- Vanilla CSS (`index.css`, `App.css`) — no Tailwind, no CSS-in-JS

## 2. File Layout

```
shaper-sim-react/src/
  App.tsx              — main component: state, chart data, worker orchestration, top nav UI
  components/
    Sidebar.tsx        — all sliders, selects, and section controls
    ChartDisplay.tsx   — thin Chart.js wrapper
  lib/
    shaperLogic.ts     — ALL physics & math (predict_resonance, generate_psd_curve,
                         scoreShapers, generate_step_responses, shaper generators)
    shaper.worker.ts   — Web Worker: receives AppState, calls shaperLogic, posts results back
  types.ts             — AppState interface and defaultState
```

## 3. Worker Architecture

Two message types flow through the worker:

- `PSD` — fired on every slider change (debounced 0 ms via requestAnimationFrame). Returns `predX`, `predY`, `freqs`, `psdX`, `psdY`.
- `SHAPERS` — fired separately, debounced 150 ms. Returns `scoreX`, `scoreY` (the shaper scoring results).

The main thread never blocks on computation. Chart rendering happens in a `useMemo` that depends on `workerResult` and other UI state.

## 4. Mathematical Gotchas (CRITICAL)

### A. Damping Separation

**This is intentional and must not be collapsed.**

Klipper always uses `DEFAULT_DAMPING_RATIO = 0.1` when scoring shapers, regardless of the user's measured damping. The simulator matches this:

- **Shaper construction** (`SHAPERS[s](freq, DEFAULT_DAMPING_RATIO)`) — always uses 0.1, matching what Klipper would actually deploy
- **Shaper scoring evaluation** (`estimate_remaining_vibrations`) — pessimizes remaining vibration over Klipper's `[0.075, 0.1, 0.15]` test damping ratios
- **`estimate_shaper` evaluation** (what the chart draws) — uses `state.dampingRatio` (the user's slider) so the visual response is meaningful
- **`generate_psd_curve`** — uses `state.dampingRatio`

Do not unify these. The slider affects the graph; the scoring stays Klipper-compatible.

### B. Input Shaper Normalization (Step Response)

When generating step responses in `generate_step_responses()`, impulse amplitudes **must** be normalized by their sum (`A[j] / sum_A`). Klipper's raw $A_i$ coefficients sum to values > 1.0 (e.g. `1.0 + K` for ZV). Without normalization the position plot settles at the wrong value.

### C. Resonance Peak Conventions

The primary resonance in `generate_psd_curve()` is a Lorentzian with two hardcoded invariants:

- **Width:** `w = center_freq * damping_ratio` — this is HWHM of $|H(\omega)|^2$. An earlier `w = center_freq / Q` was FWHM (peaks 2× too wide). Do not revert.
- **Peak amplitude:** `base_amplitude ∝ Q²` is correct because `TEST_RESONANCES` runs a steady-state chirp, not an impulse. Do not rescale to `1/ζ` or add `f²`/`f⁴` envelopes — Klipper's chirp already balances those.
- **Secondary peaks** (twist, sway, hose, racking) still use width `/Q`. Known inconsistency with the primary peak; their empirical multipliers were tuned against the old convention. Porting the HWHM fix to them requires re-tuning those constants.

### D. Float Array Loops

Never use floating-point accumulation for loop bounds in physics arrays. `for (let t = 0; t <= duration; t += dt)` causes off-by-one errors and artifacts (lines returning to origin). Use integer index iteration: `for (let i = 0; i < N; i++) { const t = i * dt; }`.

### E. Snapshot State Shape

`snapshotData` in `App.tsx` stores `{ psd, shapedPsd, mathFreqs, damping, targetFreq, shaperName }`. Because peak PSD scales with $Q^2$, two arrays captured at different damping ratios are not comparable. The snapshot legend label shows the captured parameters so A/B comparison is unambiguous. Do not reduce the snapshot to a loose array.

### F. `scoreShapers` Signature

```typescript
export function scoreShapers(
  rawPsd: Float64Array | number[],
  freqs: Float64Array | number[],
  max_hz: number,
  scv: number
): { results: Record<string, ShaperScore>, best_shaper: string }
```

The function does not accept a user damping parameter. It constructs shapers at `DEFAULT_DAMPING_RATIO` and evaluates remaining vibration over Klipper's fixed test damping ratios. Do not wire the UI damping slider into scoring.

The interactive scorer intentionally uses a 2 Hz coarse pass followed by a 0.2 Hz fine pass around the best vibration pocket. Do not replace it with an exhaustive 0.2 Hz scan on the live UI path without adding a separate idle/background mode; the exhaustive scan makes slider movement lag badly at high `maxX`.

The UI has two scoring modes: fast interactive scoring for live slider movement and exact Klipper-style scoring from the `Exact Klipper` button. The exact path uses exhaustive 0.2 Hz candidates and Klipper's final ZV override; use it when comparing against Klipper recommendations.

### G. TypeScript Non-Null Assertions in `scoreShapers`

`best_res` and `best_shaper_obj` are typed `| null` but TypeScript cannot see through the closure that the sweep loop always populates them. They are accessed with `!` assertions after the loops. This is intentional — do not "fix" it by making the variables optional throughout.

## 5. Modifying the UI

- All slider/select handlers call `updateState(key, value)` which is typed `(key: keyof AppState, value: number | boolean | string) => void`
- Chart.js option literals need `as const` on union-typed fields (e.g. `position: 'top' as const`, `font: { weight: 'bold' as const }`)
- The worker is created with `new Worker(new URL('./lib/shaper.worker.ts', import.meta.url), { type: 'module' })` — Vite handles bundling it

## 6. CSV Overlay

`parseKlipperCsv(text, filename)` in `App.tsx` handles Klipper's `calibration_data_*.csv` format (columns: `freq,psd_x,psd_y,psd_z,psd_xyz`). It prefers `psd_xyz` → `psd_x` → first `psd_*` column, and auto-detects axis from `_x_`/`_y_` in the filename.

CSV overlays are normalized to the simulated PSD peak at render time (`simMax / csvMax`) because the units differ (simulated: arbitrary `1e5 × Q²`; real ADXL: `(mm/s²)²/Hz`). This makes frequency shapes visually comparable without converting units.

## 7. Save Protocol

After every file change:

```bash
git add .
git commit -m "wip: AI auto-save - [description]"
git push origin wip-local-testing
```

Do not wait for user confirmation. Push immediately after every change.

## 8. Reference Files

- `shaper_calibrate_klipper.py` — Klipper's actual Python source; use this as ground truth when verifying math
- `resonances_x.csv`, `resonances_y.csv` — real ADXL calibration data useful for testing CSV import
- `PHYSICS_REFERENCE.md` — full derivations for the mass-spring model, belt physics, AWD isolation, damping, and motor math
