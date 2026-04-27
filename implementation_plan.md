# Goal Description

Implement the "Enable Speed Simulation" functionality in the Kalico Input Shaper Simulator. The UI checkbox and slider (`enableDynamicSpeed`, `printSpeed`) already exist in `AppState` but are not wired to the physics engine. This connects them to two speed-dependent physical effects:

1. **Stepper torque drop-off** — at higher speeds, back-EMF reduces holding torque, which lowers the motor's contribution to system stiffness and shifts the resonance frequency down.
2. **Belt tooth meshing vibration** — a GT2 belt with 2mm pitch meshes at `f = v / 2` Hz. At high speeds this becomes a distinct tonal excitation.

---

## Decisions

### Torque drop-off formula

Apply a speed-dependent multiplier to `Kmotor_total` inside `predict_resonance`:

```ts
const torque_factor = 1.0 / (1.0 + Math.pow(print_speed / 600.0, 1.5));
const Kmotor_total = Kmotor_single * drive_type * torque_factor;
```

Rationale: models the hyperbolic torque-speed curve typical of Nema17 motors. At 600 mm/s the factor is ~0.5, meaning motor stiffness halves. Curve values:

| Speed (mm/s) | torque_factor |
|---|---|
| 0 | 1.00 |
| 100 | 0.94 |
| 200 | 0.87 |
| 300 | 0.79 |
| 500 | 0.61 |

When `print_speed` is 0 (or speed simulation is off), `torque_factor = 1.0` — identical to current behavior.

### Belt meshing peak

Add a Lorentzian peak at `f_mesh = print_speed / 2.0` inside `generate_psd_curve`:

```ts
// Only inject if speed sim is active and print_speed is non-trivial
if (speed > 0) {
    const mesh_freq = speed / 2.0;
    const mesh_amp = base_amplitude * (speed / 2000.0) * 0.5;
    const mesh_w = mesh_freq * damping_ratio * 3.0;
    val += mesh_amp / (1.0 + Math.pow((f - mesh_freq) / mesh_w, 2.0));
}
```

- **Amplitude** scales linearly with speed: at 100 mm/s it's ~2.5% of `base_amplitude`; at 500 mm/s ~12.5%. Small enough to not dominate the chart, visible enough to see it move when scrubbing.
- **Width** uses `damping_ratio * 3.0` — narrower than the broad hose/sway peaks, wider than a true resonance, reflecting real-world tonal spread from slight belt pitch variation.
- **No minimum speed threshold.** The peak is always injected when speed > 0. At very low speeds (< 20 mm/s) the peak appears below 10 Hz at the left edge of most charts; this is expected and harmless.

### Architecture: separate `SpeedParams` instead of extending `Imperfections`

`Imperfections` models mechanical defects of a specific printer build. Print speed is an operating condition, not a defect. Mixing them would create conceptual confusion and make call sites harder to read.

Use a separate optional parameter:

```ts
// shaperLogic.ts
interface SpeedParams {
    print_speed: number; // mm/s
    // belt_pitch is always 2.0 for GT2 — not exposed as a param
}

function generate_psd_curve(
    center_freq: number,
    freqs: Float64Array | number[],
    imperfections: Imperfections = {},
    out_psd?: Float64Array,
    speed?: SpeedParams        // <-- new optional last param
): Float64Array
```

And `predict_resonance` gets `print_speed` as an optional last parameter (default `0`):

```ts
function predict_resonance(
    ..., // existing 12 params unchanged
    print_speed: number = 0
): number
```

This means all existing call sites stay valid with zero changes.

---

## Proposed Changes

### `src/lib/shaperLogic.ts`

1. **Add `cross_twist` to the `Imperfections` interface** (pre-existing gap — it's used at line 275 but missing from the type).

2. **Add `SpeedParams` interface.**

3. **Update `predict_resonance` signature** — add `print_speed: number = 0` as the final parameter. Before the `Keff` calculation, compute and apply `torque_factor`:

   ```ts
   const torque_factor = print_speed > 0
       ? 1.0 / (1.0 + Math.pow(print_speed / 600.0, 1.5))
       : 1.0;
   const Kmotor_total = Kmotor_single * drive_type * torque_factor;
   ```

4. **Update `generate_psd_curve` signature** — add `speed?: SpeedParams` as the final parameter. After the existing imperfection peaks, add the belt mesh peak block guarded by `speed && speed.print_speed > 0`.

### `src/lib/shaper.worker.ts`

In both `predict_resonance` calls, pass `state.enableDynamicSpeed ? state.printSpeed : 0` as the final argument.

In both `generate_psd_curve` calls, pass `state.enableDynamicSpeed ? { print_speed: state.printSpeed } : undefined` as the final argument.

---

## Verification Plan

- **Toggle off** → predicted resonance and PSD must be byte-identical to current behavior (torque_factor = 1.0, no mesh peak).
- **Toggle on at 0 mm/s** → same as off (both effects are zero at v=0).
- **Scrub speed slider** → primary resonance peak shifts left as speed increases; a second narrow peak tracks along at `f = v/2`.
- **At 200 mm/s** → expect roughly 10–15 Hz downward shift in primary resonance vs. static.
- **At 500 mm/s** → mesh peak appears at 250 Hz; verify it's visible but not taller than the primary peak.
- **Performance** — torque_factor is one call per `predict_resonance` invocation (twice per frame). The mesh peak adds one Lorentzian evaluation per frequency bin — O(n), negligible. No performance concern.
