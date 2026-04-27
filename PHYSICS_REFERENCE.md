# Physics & Math Reference — Klipper Input Shaper Simulator

This document bridges the gap between empirical 3D printer mechanics and Klipper's internal `shaper_calibrate.py` algorithms. The code lives in `shaper-sim-react/src/lib/shaperLogic.ts`.

---

## 1. The Core Mass-Spring System

The natural frequency ($f$) of the toolhead is determined by its mass ($M$) and the total system stiffness ($K_{total}$):

$$f = \frac{1}{2\pi} \sqrt{\frac{K_{total}}{M_{total}}}$$

Three springs act in series:

1. **Belt stiffness** — physical elasticity of the Gates belts
2. **Magnetic stiffness** — the holding torque of the stepper motors
3. **Frame stiffness** — rigidity of the aluminum extrusions and mounts

Because they are in series, the softest spring dominates: loose belts, weak motors, or a flexible frame each independently lower your resonance frequency.

### Frame Stiffness Reference

The simulator uses a multiplier (0.5–10.0) for chassis rigidity. See the sidebar tooltip for values; the key insight is that bolted/bonded panels create a **stressed-skin monocoque** — a shear web that makes even a 2020 frame stiffer in racking than an open 4040 frame.

> **Panel caveats:**
> - Panels must be continuously fastened (every ~100 mm) or bonded with VHB. Printed clips or corner-only bolts do not transfer shear load and add essentially nothing.
> - ACM and polycarbonate composite panels have less than half the shear rigidity of solid aluminum due to their plastic cores.

---

## 2. Belt Physics & Tension

When you pluck a belt span of length $L$ and measure frequency $f$, the static tension is:

$$T = 4 \cdot \rho \cdot L^2 \cdot f^2$$

Where $\rho$ is the linear density of the belt (e.g. 0.0084 kg/m for 6 mm GT2) and $L = 0.15$ m for the standard 150 mm test span.

The simulator converts this tension into a belt spring constant. Over-tensioning yields diminishing stiffness returns while increasing motor bearing load.

### AWD Belt Segment Isolation (2WD vs AWD)

**2WD CoreXY:** Both motors are at the rear. Each belt loops through front corner idlers and back. When the toolhead vibrates, it stretches the full belt loop through compliant idler bearings. Base belt stiffness:

$$K_{belt,2WD} = \frac{8 \cdot EA}{L}$$

**AWD CoreXY:** Motors at all four corners rigidly anchor both ends of each gantry segment. The toolhead can only stretch short, isolated segments — the long compliant idler paths are eliminated. This produces roughly **2.8× the effective belt stiffness** of 2WD:

$$K_{belt,AWD} \approx 2.8 \times K_{belt,2WD}$$

AWD also doubles the motor count, doubling the total magnetic spring stiffness. Combined, these effects produce the 60–80% higher resonance frequencies observed on AWD builds.

**Rotor mass decoupling:** Extra motor rotors add mass, but the rotor sits behind the belt spring (separated by pulley tooth meshing compliance and motor mount elasticity), so the toolhead only feels a fraction of each rotor's effective linear mass. The simulator uses empirical coupling factors of **15% for 2WD** and **10% for AWD**.

---

## 3. Structural Damping Ratio ($\zeta$)

Damping measures how quickly vibrations decay into heat. Counter-intuitively, it often moves inversely with frame stiffness:

| $\zeta$ range | Typical source |
|---|---|
| 0.04–0.07 | Ultra-rigid CNC billet or fully bolted monocoques — "ring like a bell" |
| 0.07–0.10 | Typical tightly bolted aluminum printer |
| 0.10–0.15 | Flexible bare frames or VHB-mounted panels — micro-slip and viscoelastic damping |

### Damping in the Simulator

The damping slider controls two separate things:

- **PSD curve shape and step response display** — uses `state.dampingRatio` directly, so the graph responds to your slider
- **Klipper shaper scoring** — always uses `DEFAULT_DAMPING_RATIO = 0.1`, matching what Klipper hardcodes internally in `shaper_calibrate.py`

This separation is intentional. Klipper's scoring is designed around the 0.1 reference regardless of your measured damping. The slider lets you visualize how a damping measurement affects your PSD and step response without altering the shaper recommendation logic.

---

## 4. Motor Physics & Magnetic Springs

The stepper motor rotor is held by a magnetic field that acts as a torsional spring:

$$K_{magnetic} \approx \frac{\text{Holding Torque} \times \text{Current\%}}{\text{Step Angle}}$$

### Acceleration Smear

Klipper's `TEST_RESONANCES` measures at standstill — maximum torque, stiff magnetic spring, high resonance frequency.

During a real print at high speed, back-EMF fights the stepper driver:
1. Speed increases → torque drops
2. Torque drops → magnetic spring softens
3. Spring softens → **resonance frequency drops**

The static input shaper (tuned at standstill) becomes desynchronized from the dynamically shifting frequency during acceleration.

When **Speed Simulation** is enabled, the simulator integrates 15 distinct resonance curves across the acceleration profile (from SCV up to target print speed). The result is a mathematically accurate **acceleration smear** — the primary peak widens and shifts toward lower frequencies, visualizing why static shapers struggle at 500+ mm/s.

---

## 5. Klipper Shaper Scoring & PSD Math

The simulator ports Klipper's exact post-processing math from `shaper_calibrate.py`:

1. **PSD generation:** `generate_psd_curve()` produces a Lorentzian peak centered on the predicted resonance frequency. Width = `center_freq * damping_ratio` (HWHM of $|H(\omega)|^2$). Peak amplitude ∝ $Q^2$ because `TEST_RESONANCES` runs a steady-state chirp, not an impulse.

2. **Mechanical imperfections:** Sliders like Toolhead Twist, Hose Drag, and Gantry Racking inject secondary frequency harmonics into the PSD curve, mimicking real ADXL graphs.

3. **Shaper scoring:** `scoreShapers()` tests all five shapers. For each it runs a coarse 2 Hz sweep followed by a 0.2 Hz fine sweep around the minimum vibration pocket — matching Klipper's two-pass strategy. Scoring uses Klipper's empirical formula:
   $$\text{score} = \text{smoothing} \times \left(v^{1.5} + 0.2v + 0.01\right)$$
   where $v$ = remaining vibration fraction. This function always uses `DEFAULT_DAMPING_RATIO = 0.1` internally, not the user's slider.

4. **Shaper selection:** Mirrors Klipper's selection logic — prefers lower score × 1.2 threshold, with a final override: if ZV is selected but another shaper achieves >10% better vibration reduction, use the better shaper instead.

5. **Max acceleration:** `find_shaper_max_accel()` and `get_shaper_smoothing()` match Klipper's smoothing-based accel limit.

---

## 6. Time-Domain Step Response

The simulator generates a classical 2nd-order underdamped step response:

$$y(t) = 1 - e^{-\zeta \omega_n t}\!\left(\cos(\omega_d t) + \frac{\zeta}{\sqrt{1-\zeta^2}}\sin(\omega_d t)\right)$$

where $\omega_d = \omega_n\sqrt{1-\zeta^2}$ is the damped natural frequency.

To visualize input shaping, the simulator convolves this against the shaper's impulse sequence:

$$y_{\text{shaped}}(t) = \sum_i \frac{A_i}{\sum A} \cdot y(t - T_i)$$

Normalization by $\sum A$ is mandatory — Klipper's raw $A_i$ coefficients sum to values > 1.0, so without it the position settles at an incorrect value.

The step response uses `state.dampingRatio` (not the hardcoded 0.1) because it is a visualization of your specific printer's behavior, not a Klipper scoring artifact.

---

## 7. CSV Overlay Normalization

Klipper's `calibration_data_*.csv` files store PSD in physical units: $(mm/s^2)^2/Hz$. The simulator's synthetic PSD uses arbitrary units ($\propto Q^2$). The two scales are incompatible directly.

At render time, each CSV overlay is normalized to the simulated PSD peak:

$$\text{scale} = \frac{\max(\text{sim PSD})}{\max(\text{CSV PSD})}$$

This makes the frequency shapes visually comparable without a unit conversion. The normalization is applied per-overlay so multiple CSV files can be overlaid simultaneously, each scaled independently to the same simulated baseline.
