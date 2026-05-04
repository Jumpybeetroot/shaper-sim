# Decisions

## [2026-05-04] Memory Stack Bootstrap

**Decision:** Initialize Memory Bank + Graphify + llm-wiki style memory stack per global bootstrap guide.

**Rationale:** Provides structured, layered project memory that persists across sessions. Separates current state (memory-bank), codebase structure (graphify-out), and durable knowledge (wiki).

**Implementation:** Created scaffold directories and files populated from actual project evidence.

---

## [2026-05-04] Speed Simulation Architecture

**Decision:** Separate `SpeedParams` interface instead of extending `Imperfections`.

**Rationale:** Print speed is an operating condition, not a mechanical defect. Mixing them creates conceptual confusion and makes call sites harder to read.

**Implementation:** Optional `speed?: SpeedParams` parameter on `generate_psd_curve`; `print_speed: number = 0` on `predict_resonance`.

---

## [Date Unknown] Damping Ratio Separation

**Decision:** Shaper construction always uses `DEFAULT_DAMPING_RATIO = 0.1` regardless of UI slider.

**Rationale:** Matches Klipper's real behavior. UI slider affects display only, not scoring. Klipper always uses 0.1 when scoring shapers.

**Implementation:** `SHAPERS[s](freq, DEFAULT_DAMPING_RATIO)` in scoring; `state.dampingRatio` in display.

**Critical:** Do not unify these. The slider affects the graph; the scoring stays Klipper-compatible.

---

## [Date Unknown] Worker Message Protocol

**Decision:** Two separate message types: `PSD` and `SHAPERS`.

**Rationale:** PSD fires on every state change for responsive curves. SHAPERS debounced 600ms for live interactive path to avoid lag during slider movement.

**Implementation:** Shaper results only applied when `psdRequestId` matches latest rendered PSD generation.

---

## [Date Unknown] CSV Overlay Normalization

**Decision:** Normalize real ADXL data to simulated peak at render time.

**Rationale:** Units differ (simulated: arbitrary `1e5 × Q²`; real ADXL: `(mm/s²)²/Hz`). Normalization makes frequency shapes visually comparable without unit conversion.

**Implementation:** `simMax / csvMax` scaling at render time.

---

## [Date Unknown] Float Array Loop Pattern

**Decision:** Always use integer index iteration for physics arrays.

**Rationale:** `for (let t = 0; t <= duration; t += dt)` causes off-by-one errors and artifacts (lines returning to origin). Floating-point accumulation is unreliable for loop bounds.

**Implementation:** `for (let i = 0; i < N; i++) { const t = i * dt; }`

---

## [Date Unknown] Two Scoring Modes

**Decision:** Fast interactive scoring + exact Klipper-style scoring.

**Rationale:** Live slider movement needs fast response (2 Hz coarse → 0.2 Hz fine pass). Exact comparison against Klipper needs exhaustive 0.2 Hz scan + Klipper's final ZV override.

**Implementation:** Fast mode for interactive UI; exact mode from `Exact Klipper` button.
