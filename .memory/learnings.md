# Key Learnings & Gotchas

## Critical Math Invariants

### Resonance Peak Width
- **Primary peak:** `w = center_freq * damping_ratio` (HWHM of |H(ω)|²)
- **Secondary peaks:** still use `width / Q` (known inconsistency, tuned against old convention)
- **Do not revert** to `w = center_freq / Q` (was FWHM, peaks 2× too wide)

### Peak Amplitude
- `base_amplitude ∝ Q²` is correct (TEST_RESONANCES runs steady-state chirp, not impulse)
- Do not rescale to `1/ζ` or add `f²`/`f⁴` envelopes

### Step Response Normalization
- Impulse amplitudes **must** be normalized by their sum (`A[j] / sum_A`)
- Without normalization, position plot settles at wrong value

## UI/Chart Gotchas

### Chart.js Type Assertions
- Option literals need `as const` on union-typed fields
- Example: `position: 'top' as const`, `font: { weight: 'bold' as const }`

### Phosphor Icons
- Use `*Icon` suffix forms (e.g., `FileArrowUpIcon`)
- Bare names are deprecated aliases

### Worker Creation
- `new Worker(new URL('./lib/shaper.worker.ts', import.meta.url), { type: 'module' })`
- Vite handles bundling

## State Management

### Sanitization Required
- `updateState`, saved state, and saved profiles must pass through `sanitizeAppState` / `sanitizeProfiles`
- Do not post unsanitized state to the worker

### Snapshot State Shape
- `snapshotData` stores `{ psdX, psdY, freqs }` as cloned `Float64Array`s
- Peak PSD scales with Q², so snapshots at different damping ratios are shape comparisons, not absolute amplitude

## Scoring System

### Two Scoring Modes
1. **Fast interactive:** 2 Hz coarse pass → 0.2 Hz fine pass (for live slider movement)
2. **Exact Klipper:** exhaustive 0.2 Hz candidates + Klipper's final ZV override

### Default Recommendations
- Must remain ADXL-based (what Klipper scores from real calibration_data_*.csv)
- Nozzle-based scoring only through explicit `Nozzle Recs` diagnostic path
- Keep nozzle scores in separate fields from `scoreX`/`scoreY`

### Speed Simulation
- Display PSD may shift structural resonance lower and add belt-mesh peak
- Shaper scoring must continue to use standstill structural PSD
- High-speed motor stiffness uses full motor parameters from AppState
