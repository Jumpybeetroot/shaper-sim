# Current Progress & State

## Implementation Status

### Completed Features
- [x] Physics-based frequency prediction (mass-spring model)
- [x] Stepper motor presets (LDO, Moons, StepperOnline)
- [x] Stressed-skin frame stiffness model
- [x] Belt physics (6/9/10/12 mm GT2 linear densities)
- [x] 2WD vs AWD belt segment isolation
- [x] Klipper shaper scoring (ZV, MZV, EI, 2HUMP_EI, 3HUMP_EI)
- [x] Damping slider (affects display, not scoring)
- [x] Mechanical imperfections (COM offsets, ADXL/nozzle offsets, etc.)
- [x] Nozzle diagnostics (explicit Nozzle Recs control)
- [x] Toolhead presets (StealthBurner)
- [x] PSD mode (all five shapers as toggleable legend items)
- [x] Step response mode
- [x] Snapshot (ghost graphs)
- [x] CSV import (Klipper calibration_data_*.csv)
- [x] Speed simulation (torque drop-off + belt meshing)

### In Progress
- [ ] (none currently)

### Planned
- [ ] (none currently)

## Recent Changes
- Speed simulation fully implemented with torque_factor and belt mesh peak
- Implementation plan documented in `implementation_plan.md`

## Testing Status
- Tests in `shaper-sim-react/tests/`
- `appHelpers.test.ts` — app helper tests
- `shaperLogic.test.ts` — shaper logic tests
- Run with: `npm run test`

## Deployment
- Live at: https://jumpybeetroot.github.io/shaper-sim/
- Auto-deploy on push to `main` via GitHub Actions
- WIP branch: `wip-local-testing`

## Reference Files
- `shaper_calibrate_klipper.py` — Klipper's actual Python source (ground truth)
- `resonances_x.csv`, `resonances_y.csv` — real ADXL calibration data
- `PHYSICS_REFERENCE.md` — full derivations for mass-spring model, belt physics, etc.
- `math.md` — additional math documentation
- `MATH_REVIEW.md` — math review notes
