# Architecture Decisions

## Speed Simulation Architecture
**Decision:** Separate `SpeedParams` interface instead of extending `Imperfections`
**Rationale:** Print speed is an operating condition, not a mechanical defect. Mixing them creates conceptual confusion.
**Implementation:** Optional `speed?: SpeedParams` parameter on `generate_psd_curve`; `print_speed: number = 0` on `predict_resonance`

## Damping Ratio Separation
**Decision:** Shaper construction always uses `DEFAULT_DAMPING_RATIO = 0.1` regardless of UI slider
**Rationale:** Matches Klipper's real behavior. UI slider affects display only, not scoring.
**Critical:** Do not unify these. The slider affects the graph; the scoring stays Klipper-compatible.

## Worker Message Protocol
**Decision:** Two separate message types: `PSD` and `SHAPERS`
**Rationale:** PSD fires on every state change; SHAPERS debounced 600ms for live interactive path
**Implementation:** Shaper results only applied when `psdRequestId` matches latest rendered PSD

## CSV Overlay Normalization
**Decision:** Normalize real ADXL data to simulated peak at render time
**Rationale:** Units differ (simulated: arbitrary 1e5 × Q²; real ADXL: (mm/s²)²/Hz). Normalization makes frequency shapes visually comparable.

## Float Array Loop Pattern
**Decision:** Always use integer index iteration for physics arrays
**Rationale:** `for (let t = 0; t <= duration; t += dt)` causes off-by-one errors. Use `for (let i = 0; i < N; i++) { const t = i * dt; }`

## TypeScript Non-Null Assertions
**Decision:** Use `!` assertions for `best_res` and `best_shaper_obj` in `scoreShapers`
**Rationale:** TypeScript cannot see through the closure that the sweep loop always populates them. Do not "fix" by making variables optional.
