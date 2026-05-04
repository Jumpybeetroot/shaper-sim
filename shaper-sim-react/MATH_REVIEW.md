# Math Review — shaper-sim-react

**Date:** 2026-04-27
**Scope:** All physics/mathematics in `shaper-sim-react`, compared against the Klipper Python reference (`shaper_calibrate_klipper.py`) and project documentation (`PHYSICS_REFERENCE.md`, `AGENT.md`).

---

## Verified Correct (Matches Klipper Reference)

| Component | Status | Notes |
|---|---|---|
| **ZV shaper generator** | ✅ | `K = exp(-ζπ/√(1-ζ²))`, `t_d = 1/(f·√(1-ζ²))` — matches Klipper |
| **MZV shaper generator** | ✅ | `0.75` factor in exp, amplitudes `1-1/√2`, `(√2-1)K`, `a₁K²` — matches |
| **EI shaper coefficients** | ✅ | 3rd-order Taylor expansion in `ζ` and `v_tol` — matches Klipper |
| **2-hump / 3-hump EI** | ✅ | Horner-style `_get_shaper_from_expansion_coeffs` — matches Klipper |
| **`get_shaper_smoothing`** | ✅ | `ts` shift, offset_90/180 with `√2`, uses `Math.SQRT2` — matches Klipper |
| **`find_shaper_max_accel`** | ✅ | Bisection with `KLIPPER_TARGET_SMOOTHING = 0.12` — matches Klipper |
| **`estimate_shaper`** | ✅ | `Σ Aᵢ·exp(-ζω·(T_last-Tᵢ))·[sin\|cos](ω_d·Tᵢ)` — matches Klipper's numpy |
| **`estimate_remaining_vibrations`** | ✅ | `max(psd·vals - threshold, 0)` — matches Klipper |
| **Scoring formula** | ✅ | `smoothing × (v¹·⁵ + 0.2v + 0.01)` — matches Klipper |
| **ZV override** | ✅ | If ZV selected, override if another shaper has >10% less vibration — matches Klipper |
| **Belt tension** | ✅ | `T = 4ρL²f²` with `L = 0.15m` — correct wave equation physics |
| **Pulley radius** | ✅ | `(teeth × 2mm) / 2π` — correct GT2 pitch geometry |
| **Rotor inertia conversion** | ✅ | `g·cm² → kg·m²` factor `1e-7` — correct |
| **M_eq = J/r²** | ✅ | Correct physics for rotational-to-linear mass conversion |
| **Step response (2nd order)** | ✅ | `1 - e^{-ζωₙt}[cos(ω_d t) + ζ/√(1-ζ²)·sin(ω_d t)]` — correct |
| **Shaper convolution normalization** | ✅ | `A[j] / ΣA` — mandatory per AGENT.md |
| **Lorentzian primary peak** | ✅ | `base_amp ∝ 1/(4ζ²) = Q²`, HWHM `w = f₀·ζ` — correct for driven chirp |
| **Integer-index time loops** | ✅ | `for (let i = 0; i < N; i++) { const t = i * dt; }` — avoids float-accumulation bugs |
| **Damping separation** | ✅ | Slider ≠ scoring; `scoreShapers` hardcodes 0.1 internally |
| **`scoreShapers` signature** | ✅ | No damping parameter — intentionally Klipper-compatible |
| **Float64Array copies for snapshot** | ✅ | Full arrays copied, not references |

---

## Issues Found

### Issue 1 — [CRITICAL] `scoreShapers` selection iteration direction differs from Klipper

**File:** `shaperLogic.ts` lines 586–594

**Code:**
```typescript
// TypeScript: forward iteration (ascending frequency)
test_results.sort((a, b) => a.freq - b.freq);
for (let i = 0; i < test_results.length; i++) {
    const res = test_results[i];
    if (res.vibrs < best_res!.vibrs * 1.1 + 0.0005 && res.score < selected.score) {
        selected = res;
    }
}
```

**Klipper Python** (`shaper_calibrate.py` line 323):
```python
for res in results[::-1]:  # REVERSE iteration (descending frequency)
    if res.vibrs < best_res.vibrs * 1.1 + .0005 and res.score < selected.score:
        selected = res
```

**Problem:** Klipper iterates from **highest to lowest** frequency, which biases the selection toward higher frequencies when scores are similar. Higher shaper frequencies produce less smoothing (less delay), so Klipper's approach is the desired behavior. The TS iterates from **lowest to highest**, biasing downward.

**Impact:** When two frequencies give nearly identical vibration/smoothing scores, the TS may select a lower frequency than Klipper would, resulting in a more conservative (lower max accel) recommendation — or in edge cases, a different shaper type entirely.

**Fix:** Change the loop to iterate in reverse:
```typescript
for (let i = test_results.length - 1; i >= 0; i--) {
```

---

### Issue 2 — [SIGNIFICANT] Secondary peak width convention inconsistency (documented but unfixed)

**File:** `shaperLogic.ts` lines 367, 383, 391, 399, 407, 414

**Problem:** The primary peak uses HWHM convention (`w = f₀·ζ`). The secondary peaks were tuned against an earlier FWHM convention and still use custom width multipliers that were empirically calibrated before the primary peak was corrected.

**Secondary peak width formulas:**

| Peak | Width formula | Effective multiplier |
|---|---|---|
| Yaw | `twist_freq · ζ · 1.333 · preload^1.5` | ~1.33× baseline |
| Roll/Pitch | `rp_freq · ζ · 1.333 · preload^1.5` | ~1.33× baseline |
| External sway | `sway_freq · ζ · 5.8 · (1 + squishy/20)` | ~5.8× baseline |
| Hose drag | `drag_freq · ζ · 11.6 · (1 + hose_squishy/15)` | ~11.6× baseline |
| Belt tension delta | `peak2_freq · ζ · 2.0` | ~2.0× baseline |
| Gantry racking | `racking_freq · ζ · 2.0` | ~2.0× baseline |
| Belt meshing | `mesh_freq · ζ · 3.0` | ~3.0× baseline |

**Impact:** The visual width of secondary peaks is approximately **2× too narrow** now that the primary was fixed from FWHM to HWHM. The amplitude multipliers also need re-tuning since narrower peaks concentrate the same energy into a tighter frequency band, making them appear taller than intended.

**Per AGENT.md:** "Secondary peaks (twist, sway, hose, racking) still use width `/Q`. Known inconsistency with the primary peak; their empirical multipliers were tuned against the old convention. Porting the HWHM fix to them requires re-tuning those constants."

**Fix:** Requires empirical re-validation of ~10 constants (width multipliers and amplitude coefficients for all secondary peaks). Beyond the scope of a code review.

---

### Issue 3 — [MINOR] Dead NaN check in `_bisect`

**File:** `shaperLogic.ts` line 184

**Code:**
```typescript
if (!func(1e-9) || isNaN(left)) return 0.0;
```

**Problem:** `left` is assigned `1.0` on the previous line and never reassigned before this check. `isNaN(1.0)` is always `false`. This is dead code.

**Klipper Python** (line 332):
```python
if not func(1e-9):
    return 0.
```

No NaN check at all. The TS port likely intended `isNaN(func(1e-9))` but wrote `isNaN(left)` by mistake.

**Impact:** None — the dead check is harmless but indicates a copy-paste error.

**Fix:** Remove `|| isNaN(left)` from the condition, or correct to `isNaN(func(1e-9))`:
```typescript
if (!func(1e-9)) return 0.0;
```

---

### Issue 4 — [MINOR] Motor stiffness formula differs from documented formula

**File:** `shaperLogic.ts` line 243

**Code:**
```typescript
const K_theta = effective_torque_Nm * motor_rotor_teeth;  // rotor_teeth = 50 (hardcoded)
```

**PHYSICS_REFERENCE.md documents:**
```
K_magnetic ≈ Holding Torque × Current% / Step Angle
```

For a 1.8° stepper, step angle = π/90 ≈ 0.0349 rad. The theoretical `K_θ` would be `T_hold / 0.0349 ≈ T_hold × 28.6`. The code uses `T_hold × 50` (number of rotor teeth), which is ~1.75× the theoretical value.

**Impact:** The motor stiffness contribution is ~1.75× higher than the theoretical model would predict. Since the entire model is empirical (tuned to match real ADXL data), this may simply be an undocumented empirical correction that compensates for other unmodeled effects (detent torque, driver microstepping stiffness, etc.).

**Fix:** Either update the documentation to describe the empirical formula, or switch to the documented step-angle formula. If the current value produces visually correct results against real ADXL data, updating the documentation is the simpler and safer path.

---

### Issue 5 — [MINOR] Inertial coupling factors undocumented

**File:** `shaperLogic.ts` line 261

**Code:**
```typescript
const inertial_coupling_factor = (drive_type === 4) ? 0.10 : 0.15;
```

**Problem:** PHYSICS_REFERENCE.md mentions "empirical coupling factors of 15% for 2WD and 10% for AWD" but provides no derivation. These values were likely determined by tuning until simulated PSD shapes visually matched real ADXL data.

**Impact:** Low — empirical parameters are reasonable for a predictive model. But if a user changes rotor inertia, the coupling factor may need to scale (mass ratio between rotor effective mass and toolhead mass is not constant).

---

## Consistency with AGENT.md Guardrails

| Guardrail | Compliance | Notes |
|---|---|---|
| Damping separation (slider ≠ scoring) | ✅ | `generate_psd_curve` uses `state.damping`; `scoreShapers` hardcodes 0.1 |
| Amplitude normalization | ✅ | `A[j] / sum_A` in step response |
| HWHM convention on primary peak | ✅ | `w = f₀·ζ`, amplitude ∝ Q² |
| Float array integer-index loops | ✅ | All time stepping uses integer counters |
| `scoreShapers` no damping param | ✅ | Signature has no damping parameter |
| Non-null assertions intentional | ✅ | `best_res!` and `best_shaper_obj!` used after guaranteed-population loops |
| Snapshot state shape | ✅ | Stores full copies of Float64Arrays, not loose arrays |

---

## Summary

The math is in excellent shape overall — the Klipper port is faithful across all five shaper generators, the scoring pipeline, the time-domain simulation, and the mechanical model.

**Highest priority fix:** Issue 1 (iteration direction in `scoreShapers` selection) — a one-line change that would make the simulator match Klipper's frequency selection behavior.

**Acknowledged technical debt:** Issue 2 (secondary peak widths) — requires empirical re-tuning of ~10 constants.

**Minor issues:** Issues 3–5 are low-risk and primarily documentation/cleanup concerns.
