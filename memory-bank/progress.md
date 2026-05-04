# Progress

Last updated: 2026-05-04

## Completed

- [x] Physics-based frequency prediction (mass-spring model with belt stiffness, motor magnetic stiffness, frame rigidity in series)
- [x] Stepper motor presets (LDO, Moons, StepperOnline with datasheet-backed parameters)
- [x] Stressed-skin frame stiffness model
- [x] Belt physics (6/9/10/12 mm Gates GT2 linear densities, Hz-to-Newton tension conversion)
- [x] 2WD vs AWD belt segment isolation
- [x] Klipper shaper scoring (ZV, MZV, EI, 2HUMP_EI, 3HUMP_EI)
- [x] Damping slider (affects display, not scoring — matches Klipper behavior)
- [x] Mechanical imperfections (3D COM offsets, ADXL/nozzle offsets, toolhead flex, bearing preload, hose drag, gantry racking, external sway, squishy feet, belt tension asymmetry)
- [x] Nozzle diagnostics (explicit Nozzle Recs control)
- [x] Toolhead presets (StealthBurner with COM/nozzle offsets and stiffness)
- [x] PSD mode (all five shapers as toggleable legend items)
- [x] Step response mode (2nd-order underdamped time-domain view)
- [x] Snapshot (ghost graphs) — lock baseline, observe delta
- [x] CSV import (Klipper `calibration_data_*.csv` overlay, normalized to simulated peak)
- [x] Speed simulation (torque drop-off + GT2 belt tooth meshing at f = v/2 Hz)
- [x] Memory stack bootstrap (Memory Bank + wiki + raw scaffold)

## Remaining

- [ ] (none currently planned)

## Known Issues

- Secondary resonance peaks (twist, sway, hose, racking) still use old `width / Q` convention; primary peak uses HWHM `w = center_freq * damping_ratio`. Porting HWHM fix requires re-tuning empirical constants.

## Last Verified

- `npm run test` — passes (appHelpers.test.ts, shaperLogic.test.ts)
- `npm run build` — passes (TypeScript check + Vite build)
- Deployed and accessible at https://jumpybeetroot.github.io/shaper-sim/

## Verification Limits

- No end-to-end browser tests
- No visual regression testing
- Speed simulation not verified against physical measurements
