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

The simulator converts this tension into a belt spring constant using the separate user-entered A/B belt path length (`beltLength`). The 150 mm span is only for pluck-frequency tension conversion. Over-tensioning yields diminishing stiffness returns while increasing motor bearing load.

The non-linear tension response is modeled as **hyperelastic strain-stiffening**: at low load the elastomer matrix stretches easily, while at higher load the internal fiberglass/Kevlar cords align and dominate the effective modulus.

### AWD Belt Segment Isolation (2WD vs AWD)

**2WD CoreXY:** Both motors are at the rear. Each belt loops through front corner idlers and back. When the toolhead vibrates, it stretches the full belt loop through compliant idler bearings. Base belt stiffness:

$$K_{belt,2WD} = \frac{8 \cdot EA}{L}$$

**AWD CoreXY:** Motors at all four corners rigidly anchor both ends of each gantry segment. The toolhead can only stretch short, isolated segments — the long compliant idler paths are eliminated. This produces roughly **2.8× the effective belt stiffness** of 2WD:

$$K_{belt,AWD} \approx 2.8 \times K_{belt,2WD}$$

AWD also doubles the motor count, doubling the total magnetic spring stiffness. The 2.8 factor is lower than an idealized 4.0× because the belt is only one spring in a series system; once the belt is stiffened, gantry structure, motor mounts, shafts, and idler bearings absorb more of the remaining compliance. Combined, these effects produce the 60–80% higher resonance frequencies observed on AWD builds.

**Rotor mass decoupling:** Extra motor rotors add mass, but the rotor sits behind the belt spring (separated by pulley tooth meshing compliance and motor mount elasticity), so the toolhead only feels a fraction of each rotor's effective linear mass. The simulator uses modal mass participation factors of **15% for 2WD** and **10% for AWD**.

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

$$\tau(\theta) \approx \tau_{max}\sin(N_r\theta)$$

For small angular vibration around equilibrium:

$$K_{magnetic} = \frac{d\tau}{d\theta}\Big|_{\theta=0} = \tau_{max}N_r$$

For a standard 1.8 degree hybrid stepper, $N_r = 50$ rotor teeth, so multiplying torque by rotor teeth is the analytical small-angle stiffness. It is not an empirical replacement for dividing by the full step angle.

### Speed Simulation & Belt Meshing

Klipper's `TEST_RESONANCES` measures at standstill — maximum torque, stiff magnetic spring, high resonance frequency.

During a real print at high speed, two dynamic effects occur:

1. **Back-EMF Torque Drop-off**: Speed fights the stepper driver. As speed increases, the driver has less voltage headroom to force current through the winding resistance, winding inductance, and motor back-EMF. Lower phase current softens the magnetic spring, which in turn **drops the resonance frequency**.
   The simulator models this with a simplified electrical headroom calculation:
   $$motor\_rps = \frac{v}{pulley\_teeth \cdot 2mm}$$
   $$f_{electrical} = motor\_rps \cdot N_r$$
   $$X_L = 2\pi f_{electrical}L$$
   $$Z = \sqrt{R^2 + X_L^2}$$
   $$V_{bemf} \approx K_t \cdot 2\pi motor\_rps,\quad K_t = \frac{T_{hold}}{I_{rated}}$$
   $$I_{available} = \frac{\sqrt{V_{limit}^2 - V_{bemf}^2}}{Z}$$
   $$TorqueFactor = clamp\left(\frac{I_{available}}{I_{commanded}}, 0, 1\right)$$
   where $V_{limit}$ is 92% of the configured supply voltage. This is still an approximation: it does not model chopper timing, microstep phase angle, driver decay mode, temperature, or a measured torque-speed curve. It is more physically grounded than the old fixed-speed knee because voltage, pulley tooth count, resistance, inductance, rated current, and rotor tooth count all affect high-speed torque.

2. **Belt Tooth Meshing Vibration**: A standard GT2 belt has a 2mm pitch. As it runs over the pulley, the teeth meshing action injects a continuous excitation frequency at:
   $$f_{mesh} = \frac{v}{2} \text{ Hz}$$
   When **Speed Simulation** is enabled, the simulator injects a specific Lorentzian peak into the displayed PSD curve at this frequency. The amplitude scales with speed, producing a distinct, tracking peak that can interact with the primary resonance if their frequencies align.

Speed Simulation changes the displayed operating-speed PSD and predicted operating resonance. It does **not** change default Klipper-compatible scoring. Shaper recommendations continue to score the standstill structural PSD: ADXL by default, or nozzle PSD only when the explicit Nozzle Recs diagnostic path is used. The graph's "After shaper" overlay shapes the structural nozzle vibration but leaves belt-mesh forcing visible because input shapers do not cancel continuous pulley tooth excitation the same way they cancel resonant ringdown.

---

## 5. Klipper Shaper Scoring & PSD Math

The simulator ports Klipper's exact post-processing math from `shaper_calibrate.py`:

1. **PSD generation:** `generate_psd_curve()` produces a Lorentzian peak centered on the predicted resonance frequency. Width = `center_freq * damping_ratio` (HWHM of $|H(\omega)|^2$). Peak amplitude ∝ $Q^2$ because `TEST_RESONANCES` runs a steady-state chirp, not an impulse. A full 2nd-order transfer function would have thinner high-frequency tails, but that model is deferred until the empirical secondary-peak constants can be retuned.

2. **Mechanical imperfections:** Sliders like 3D COM Offsets, Bearing Preload, Hose Drag, and Gantry Racking inject geometrically calculated secondary frequency harmonics into the PSD curve. COM-induced rigid-body modes use the right-hand rule:
   $$\vec{\tau} = \vec{r}_{COM} \times \vec{F}_{axis}$$
   and measure each rotational mode at the ADXL or nozzle location with:
   $$measurement = (\vec{\alpha}_{mode} \times \vec{r}_{sensor}) \cdot \hat{a}_{axis}$$
   This gives X motion yaw from Y COM offset, Y motion yaw from X COM offset, and roll/pitch from Z COM offset. A separate local toolhead/nozzle flex mode is also added from the carriage-to-sensor lever arm, so nozzle-local vibration can appear even when the rigid-body COM torque term is small. The 70 mm torsion normalizer is a characteristic toolhead moment arm; the broad hose/sway/flex multipliers approximate modal smearing and viscoelastic broadening in distributed flexible structures.
   `toolheadStiffness = 1.0` is a stiff printed baseline. Values below 1.0 model flexible printed stacks; the StealthBurner preset uses `0.65` so the local nozzle-flex mode is visibly stronger than the generic baseline. The stiffness scale is still provisional and should not be treated as measured fact; it is a relative what-if control until real modal measurements can calibrate the values.

3. **Shaper scoring:** `scoreShapers()` tests all five shapers using Klipper minimum frequencies (ZV 21Hz, MZV 23Hz, EI 29Hz, 2HUMP_EI 39Hz, 3HUMP_EI 48Hz), high-to-low iteration, and an interactive two-pass search: 2Hz coarse spacing followed by 0.2Hz fine spacing around the best vibration pocket. The Exact Klipper control runs `scoreShapersExact()`, an exhaustive 0.2Hz scan across the full allowed frequency range. Default recommendations always score the standstill ADXL PSD to match Klipper's calibration behavior. The Nozzle Recs button explicitly scores standstill nozzle PSD as a print-quality diagnostic/what-if, not as the default Klipper recommendation. Speed Simulation is rendered as an operating-speed overlay and its belt-mesh peak is excluded from scoring. Scoring uses Klipper's empirical formula:
   $$\text{score} = \text{smoothing} \times \left(v^{1.5} + 0.2v + 0.01\right)$$
   where $v$ = remaining vibration fraction. Shaper construction uses `DEFAULT_DAMPING_RATIO = 0.1`, and remaining vibration is pessimized over Klipper's test damping ratios `[0.075, 0.1, 0.15]`.

4. **Shaper selection:** Follows Klipper's score-threshold logic and allows a fitted result to replace the current best when both vibration and smoothing improve. Fast interactive mode uses a smoothing-aware ZV override so narrow single-mode peaks can still recommend ZV. Exact Klipper mode uses Klipper's final override: if ZV is selected but another shaper gives >10% better residual vibration, use that shaper.

5. **Max acceleration:** `find_shaper_max_accel()` and `get_shaper_smoothing()` match Klipper's smoothing-based accel limit.

---

## 6. Time-Domain Step Response

The simulator generates a classical 2nd-order underdamped step response:

$$y(t) = 1 - e^{-\zeta \omega_n t}\!\left(\cos(\omega_d t) + \frac{\zeta}{\sqrt{1-\zeta^2}}\sin(\omega_d t)\right)$$

where $\omega_d = \omega_n\sqrt{1-\zeta^2}$ is the damped natural frequency.

To visualize input shaping, the simulator convolves this against the shaper's impulse sequence:

$$y_{\text{shaped}}(t) = \sum_i \frac{A_i}{\sum A} \cdot y(t - T_i)$$

Normalization by $\sum A$ is mandatory — Klipper's raw $A_i$ coefficients sum to values > 1.0, so without it the position settles at an incorrect value.

The step response uses `state.dampingRatio` (not the hardcoded 0.1) because it is a visualization of your specific printer's behavior, not a Klipper scoring artifact. It is exact for the single SDOF primary mode at the selected resonance frequency; secondary PSD peaks such as yaw, hose drag, sway, belt delta, and mesh excitation are not included in this time-domain plot.

---

## 7. CSV Overlay Normalization

Klipper's `calibration_data_*.csv` files store PSD in physical units: $(mm/s^2)^2/Hz$. The simulator's synthetic PSD uses arbitrary units ($\propto Q^2$). The two scales are incompatible directly.

At render time, each CSV overlay is normalized to the simulated PSD peak:

$$\text{scale} = \frac{\max(\text{sim PSD})}{\max(\text{CSV PSD})}$$

This makes the frequency shapes visually comparable without a unit conversion. The normalization is applied per-overlay so multiple CSV files can be overlaid simultaneously, each scaled independently to the same simulated baseline.
