# Project Brief

## Purpose

Klipper Input Shaper Simulator is a physics-based resonance prediction and Input Shaper visualization tool for Klipper-based 3D printers. Unlike calculators that use simple empirical ratios, this simulator mathematically models the physical properties of a printer's gantry, belts, and motors. It ports Klipper's internal PSD calculation logic into real-time TypeScript, letting users see how mechanical changes affect resonance graphs before touching a wrench.

## Current Status

**Active development** — all core features implemented and deployed. Speed simulation (torque drop-off + belt meshing) was the most recent major feature addition.

## Source Of Truth

- **Application code:** `shaper-sim-react/src/`
- **Physics engine:** `shaper-sim-react/src/lib/shaperLogic.ts`
- **Reference implementation:** `shaper_calibrate_klipper.py` (Klipper's actual Python source)
- **Physics derivations:** `PHYSICS_REFERENCE.md`

## Success Criteria

- Predicted resonance frequencies match Klipper's real behavior within engineering tolerance
- Shaper recommendations match Klipper's `shaper_calibrate.py` output
- UI responds in real-time during slider interaction (Web Worker offloads computation)
- CSV overlay enables comparison between simulated and real ADXL calibration data
- Deployed and accessible at https://jumpybeetroot.github.io/shaper-sim/
