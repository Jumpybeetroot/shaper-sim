# Klipper Input Shaper Simulator

A physics-based resonance prediction and Input Shaper visualization tool for Klipper-based 3D printers.

**Live demo:** https://jumpybeetroot.github.io/shaper-sim/

Unlike calculators that use simple empirical ratios, this simulator mathematically models the physical properties of your printer's gantry, belts, and motors. It ports Klipper's internal PSD calculation logic into real-time TypeScript, letting you see how mechanical changes affect your resonance graphs before touching a wrench.

## Features

- **Physics-based frequency prediction** using mass-spring modeling with belt stiffness, motor magnetic stiffness, and frame rigidity in series
- **Stepper motor presets** — LDO, Moons, and StepperOnline presets with datasheet-backed holding torque, rotor inertia, rated current, resistance, inductance, and rotor tooth data for the speed model
- **Stressed-skin frame stiffness** — models the structural difference between bare extrusions and panels bolted/bonded as a shear web
- **Belt physics** — 6 mm, 9 mm, 10 mm, 12 mm Gates GT2 linear densities; Hz-to-Newton tension conversion via wave equation
- **2WD vs AWD belt segment isolation** — AWD anchors short gantry segments, eliminating the long compliant idler paths of 2WD
- **Klipper shaper scoring** — ZV, MZV, EI, 2HUMP_EI, 3HUMP_EI scored using a TypeScript port of Klipper's `shaper_calibrate.py`. Shaper construction uses Klipper's hardcoded `DEFAULT_DAMPING_RATIO = 0.1` to match what Klipper would actually deploy
- **Damping slider** — affects the PSD curve shape and step response display; does not alter shaper scoring (matching Klipper's real behavior)
- **Mechanical imperfections** — 3D Center of Mass (COM) offsets generating orthogonal Yaw/Pitch/Roll torques, ADXL vs Nozzle sensor offset discrepancies, local nozzle/toolhead flex, bearing preload frictional damping, hose drag, gantry racking, external sway, squishy feet, belt tension asymmetry
- **Nozzle diagnostics** — default recommendations stay ADXL/Klipper-based, while an explicit Nozzle Recs control can run a nozzle-based what-if analysis for print-quality risk
- **Toolhead presets** — StealthBurner applies forward/down COM and nozzle offsets plus a below-baseline printed-toolhead stiffness value to make local nozzle flex visible without changing Klipper's ADXL-first recommendation path
- **PSD mode** — overlays all five shapers as toggleable legend items; shows recommended shaper and max accel per axis
- **Step response mode** — 2nd-order underdamped time-domain view showing how the selected shaper flatlines ringing
- **Snapshot (ghost graphs)** — lock a baseline curve, then watch the live curve shift as you change parameters
- **CSV import** — load Klipper-generated `calibration_data_*.csv` files and overlay the real ADXL data on the simulated PSD (normalized to the simulated peak for shape comparison)
- **Speed simulation** — visualizes operating-speed resonance shifts from voltage-limited stepper torque drop-off plus GT2 belt tooth meshing at `f = v / 2` Hz, while keeping Klipper-compatible shaper recommendations based on standstill structural PSD.

## Running locally

```bash
git clone https://github.com/Jumpybeetroot/shaper-sim.git
cd shaper-sim/shaper-sim-react
npm install
npm run dev
```

Open `http://localhost:5173/`.

## Building

```bash
npm run build
```

Output goes to `shaper-sim-react/dist/`. Deployment to GitHub Pages is automatic on push to `main` via `.github/workflows/deploy.yml`.

## Math & Attribution

The shaper scoring, PSD generation, and step response math are a TypeScript port of Klipper's `shaper_calibrate.py`. Predictive frequency uses $f = \frac{1}{2\pi}\sqrt{K_{total}/M_{total}}$ with belt tension $T = 4\rho L^2 f^2$, magnetic spring stiffness, and frame stiffness in series. See [PHYSICS_REFERENCE.md](PHYSICS_REFERENCE.md) for full derivations.

*Always use a physical ADXL345 for final tuning. Simulated results depend on the accuracy of your input parameters.*

## License

GNU GPLv3. See [LICENSE](LICENSE). Klipper's algorithms are ported under the same license.
