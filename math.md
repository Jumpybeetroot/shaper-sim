# Kalico Input Shaper Simulator - Comprehensive Math & Physics Reference

## Introduction
This document contains every mathematical detail needed to fully understand the predictive engine, input shaping logic, and simulation visualization of the `shaper-sim` project. The core logic is a direct port of Klipper3d's `shaper_calibrate.py`, extended with an empirical mechanical model to predict synthetic PSD (Power Spectral Density) curves without physical ADXL data.

---

## 1. Mechanical Predictive Model (Frequency & Compliance)
Located in `predict_resonance(mass_g, belt_EA, tension_N, ...)`

The toolhead is modeled as a 1D spring-mass-damper system. The fundamental resonance frequency $f_0$ is calculated as:
$$ f_0 = \frac{1}{2\pi}\sqrt{\frac{K_{eff}}{M_{eff}}} $$

### 1.1 Effective Stiffness ($K_{eff}$)
Stiffness is modeled as three springs in series (belt, frame, and motor). Therefore:
$$ \frac{1}{K_{eff}} = \frac{1}{K_{belt}} + \frac{1}{K_{frame}} + \frac{1}{K_{motor\_total}} $$

#### A. Belt Stiffness ($K_{belt}$)
The stiffness of a synchronous belt (in N/m) depends on its modulus $EA$ and the free length $L$:
$$ K_{belt\_base} = \frac{8 \cdot EA_{effective}}{L} $$
* $L$ is the user-supplied A/B belt path length (`beltLength`) converted from mm to m. The separate 150 mm value is only used to convert a plucked belt frequency into static tension.
* **Hyperelastic Strain-Stiffening:** Belts stiffen non-linearly as tension increases. The softer elastomer dominates at low strain; as fiberglass/Kevlar cords align under load, the effective modulus rises toward the cord-dominated value:
  $$ stiffening\_factor = 1.0 + \left(1.1 \cdot \left(1 - e^{-tension / tension\_knee}\right)\right) $$
  Where $tension\_knee = 3.0 \cdot \text{belt\_width\_mm}$.
* **AWD Factor:** If the drive type is 4 (AWD), $K_{belt\_base}$ is multiplied by $2.8$. This represents the system-level limit from series compliance: once AWD stiffens the belt path, gantry structure, mounts, shafts, and idlers become the next dominant springs, so the realized gain is below the idealized parallel-drive limit.

#### B. Frame Stiffness ($K_{frame}$)
A completely empirical baseline:
$$ K_{frame} = 500000.0 \cdot (frame\_multiplier)^2 $$

#### C. Motor Stiffness ($K_{motor\_total}$)
The holding torque of the stepper motor acts as a magnetic spring.
$$ \tau_{effective} = (\text{torque\_mNm} / 1000) \cdot saturation\_factor $$
$$ K_{\theta} = \tau_{effective} \cdot \text{rotor\_teeth} $$
For a hybrid stepper, the restoring torque is approximately $\tau(\theta) = \tau_{max}\sin(N_r\theta)$ in mechanical angle. Around equilibrium, the small-signal torsional stiffness is the derivative:
$$ K_{\theta} = \frac{d\tau}{d\theta}\Big|_{\theta=0} = \tau_{max} N_r $$
For a standard 1.8 degree motor, $N_r = 50$, so multiplying by `rotor_teeth` is the analytical small-angle stiffness, not an empirical scale factor.
Linear stiffness from the pulley (radius $r$):
$$ K_{motor\_single} = \frac{K_{\theta}}{r^2} $$
Dynamic drop-off at speed:
$$ torque\_factor = \frac{1}{1 + (v / 600)^{1.5}} $$
$$ K_{motor\_total} = K_{motor\_single} \cdot drive\_type \cdot torque\_factor $$

### 1.2 Effective Mass ($M_{eff}$)
$$ M_{eff} = M_{toolhead\_kg} + M_{belt\_contribution} + M_{rotor\_linear} $$
* **Belt contribution:** $1/3$ of the belt mass ($M_{belt\_total} = \rho_{belt} \cdot L \cdot 1/3$).
* **Rotor linear mass:** $M_{rotor\_single} = \frac{J_{rotor}}{r^2}$.
* **Modal Mass Participation:** The rotor mass is multiplied by an `inertial_coupling_factor` ($0.15$ for 2WD, $0.10$ for AWD) because the belt, pulley mesh, and motor mount compliance prevent all rotor inertia from participating in the primary linear toolhead mode.

---

## 2. Power Spectral Density (PSD) Generation
Located in `generate_psd_curve()`

The synthetic PSD is built by summing multiple Lorentzian curves for different physical phenomena.

### 2.1 The Primary Peak
A standard Lorentzian centered at $f_c$ with damping ratio $\zeta$:
$$ PSD_{primary}(f) = \frac{A_{base}}{1 + \left(\frac{f - f_c}{w}\right)^2} $$
* $A_{base} = 10^5 \cdot \left(\frac{1}{2\zeta}\right)^2$ (Proportional to $Q^2$).
* $w = f_c \cdot \zeta$ (Half Width at Half Maximum).
* This intentionally keeps the existing Lorentzian peak model. An exact 2nd-order transfer function would produce thinner high-frequency tails ($1/f^4$ instead of $1/f^2$), but changing it requires retuning the empirical secondary-peak constants.

### 2.2 Toolhead Offset Peaks

The offset model separates rigid-body rotation from local nozzle/toolhead flex.

#### A. Rigid-body yaw and tilt
The simulator now computes COM-induced torque with vector math instead of axis-specific hand rules:
$$ \vec{\tau} = \vec{r}_{COM} \times \vec{F}_{axis} $$
The observed acceleration at the ADXL or nozzle point is the projection of rotational acceleration onto the active measurement axis:
$$ measurement = (\vec{\alpha}_{mode} \times \vec{r}_{sensor}) \cdot \hat{a}_{axis} $$
This reproduces the expected CoreXY geometry:
* X acceleration: Y COM offset drives yaw; Z COM offset drives pitch.
* Y acceleration: X COM offset drives yaw; Z COM offset drives roll.

Amplitudes scale with the product of torque arm and measurement arm:
$$ A_{yaw} \propto \left|\frac{\tau_z}{70}\right|\left|\frac{measurement_z}{70}\right| \cdot 0.8 $$
$$ A_{tilt} \propto \left|\frac{\tau_{roll/pitch}}{70}\right|\left|\frac{measurement_{roll/pitch}}{70}\right| \cdot 0.6 $$
Frequencies are shifted to $f_{yaw}=1.25f_c$ and $f_{tilt}=1.15f_c$, adjusted upward by $\sqrt{toolhead\_stiffness \cdot bearing\_preload}$.

#### B. Local nozzle/toolhead flex
Rigid-body rotation requires both a COM torque arm and a measurement arm. Real printed toolheads can also flex locally between the rail carriage and nozzle, even when a COM offset is near zero. The simulator therefore adds a separate local-flex mode:
$$ A_{flex} \propto \left(\frac{lever_{sensor}}{70}\right)^2 \cdot 0.22 $$
where $lever_{sensor}$ is the distance from the active motion axis to the ADXL/nozzle point. Carriage-mounted ADXL sensors use a partial participation factor of `0.35`; nozzle PSD and nozzle-mounted ADXL sensors use full participation.

The local-flex frequency is centered around $1.35f_c$ and broadened more than rigid-body torsion because printed/plastic toolheads have smeared local modes rather than a single clean oscillator.

* **Characteristic Moment Arm:** `TORSION_NORMALIZER_MM = 70.0` is a representative rail-carriage-to-nozzle/ADXL lever arm for a standard toolhead.
* **Empirical Damping:** rigid-body widths use $w = f \cdot \zeta \cdot 1.333 \cdot \text{bearing\_preload}^{1.5}$; local flex uses a wider `1.6` multiplier.
* **Toolhead Stiffness Scale:** `toolheadStiffness = 1.0` is a stiff printed baseline, not the minimum possible. Flexible printed stacks and StealthBurner-style assemblies can use values below 1.0; the StealthBurner preset uses `0.65` to increase local flex amplitude and lower the flex-mode frequency. These values are provisional model estimates, not measured material facts, and should be treated as relative what-if controls until real modal measurements are available.

### 2.3 Empirical External Peaks
* **Sway:** $w = f_{sway} \cdot \zeta \cdot 5.8 \cdot \text{broadening\_factor}$
* **Hose Drag:** $w = f_{drag} \cdot \zeta \cdot 11.6 \cdot \text{hose\_broadening}$
* **Belt Delta:** $w = f_{belt\_delta} \cdot \zeta \cdot 2.0$
These broadening values approximate modal smearing and viscoelastic broadening. A PTFE tube, umbilical bundle, or flexible belt path is not a single point oscillator; it behaves like a damped distributed structure with many closely spaced modes, so energy spreads over a wider frequency band.

---

## 3. Shaper Generators
Located in `get_*_shaper()`

Input shapers are defined as a series of impulses at specific times ($T_i$) with specific amplitudes ($A_i$).

Let $f_s$ be the shaper frequency, $\zeta$ be the damping ratio.
Define:
$$ \omega_d = 2\pi f_s \sqrt{1 - \zeta^2} $$
$$ t_d = \frac{1}{f_s \sqrt{1 - \zeta^2}} = \frac{2\pi}{\omega_d} $$
For ZV, define the half-period decay factor:
$$ K_{ZV} = e^{-\frac{\zeta \pi}{\sqrt{1 - \zeta^2}}} $$

### 3.1 ZV (Zero Vibration)
2 impulses.
* $A = [1.0, K_{ZV}]$
* $T = [0, 0.5 \cdot t_d]$

### 3.2 MZV (Modified ZV)
3 impulses.
Define the MZV decay factor over $0.375t_d$:
$$ K_{MZV} = e^{-\frac{0.75\zeta \pi}{\sqrt{1 - \zeta^2}}} = K_{ZV}^{0.75} $$
* $A_1 = 1 - \frac{1}{\sqrt{2}}$
* $A_2 = (\sqrt{2} - 1)K_{MZV}$
* $A_3 = A_1 \cdot K_{MZV}^2 = A_1 \cdot K_{ZV}^{1.5}$
* $T = [0, 0.375 \cdot t_d, 0.75 \cdot t_d]$

### 3.3 EI (Extra Insensitive)
3 impulses. Coefficients $a_1, a_2, a_3$ and timing $t_2$ are derived using a 3rd-order Taylor expansion in $\zeta$ and $v_{tol}$ (where $v_{tol} = 1/20 = 0.05$). Matches Klipper source perfectly.
*(2-hump EI and 3-hump EI use Horner's method on pre-computed polynomial expansion coefficients).*

---

## 4. Shaper Scoring and Smoothing
Located in `get_shaper_smoothing()` and `scoreShapers()`

### 4.1 Residual Vibration Amplitude (`estimate_shaper`)
To predict how much a shaper reduces vibration at a given frequency $f$, Klipper evaluates the residual vibration amplitude at the final impulse time.
For a shaper with impulses $(A_i, T_i)$:
$$ S = \sum_i \left( A_i \cdot e^{-\zeta \omega (T_{last} - T_i)} \sin(\omega_d T_i) \right) $$
$$ C = \sum_i \left( A_i \cdot e^{-\zeta \omega (T_{last} - T_i)} \cos(\omega_d T_i) \right) $$
$$ Magnitude(f) = \frac{\sqrt{S^2 + C^2}}{\sum_i A_i} $$
This magnitude scales the raw PSD to estimate remaining vibrations.

### 4.2 Calculating Smoothing (`get_shaper_smoothing`)
Smoothing defines how much the corner path is deformed (delayed) by the shaper.
Let $a_{half} = accel / 2$.
First, calculate the center of mass of the impulses:
$$ t_s = \frac{\sum (A_i \cdot T_i)}{\sum A_i} $$
Calculate the offsets for 90-degree and 180-degree corners:
$$ \Delta t = T_i - t_s $$
$$ offset_{90} = \sum_{T_i \ge t_s} A_i \cdot (SCV + a_{half} \cdot \Delta t) \cdot \Delta t $$
$$ offset_{180} = \sum_{all} A_i \cdot a_{half} \cdot \Delta t^2 $$
Finally:
$$ Max Smoothing = \max\left( \frac{offset_{90} \cdot \sqrt{2}}{\sum A_i}, \frac{offset_{180}}{\sum A_i} \right) $$

### 4.3 Max Acceleration Bisection
The simulator bisects test accelerations to find the exact acceleration where $Max Smoothing = 0.12$ (Klipper's target smoothing).

### 4.4 Shaper Score Formula
$$ Score = Smoothing_{max} \cdot (vibr_{frac}^{1.5} + vibr_{frac} \cdot 0.2 + 0.01) $$
Lower is better. The simulator uses Klipper's shaper minimum frequencies (ZV 21Hz, MZV 23Hz, EI 29Hz, 2HUMP_EI 39Hz, 3HUMP_EI 48Hz), evaluates high-to-low, and runs two scoring paths:
* **Fast interactive:** a 2Hz coarse pass followed by a 0.2Hz fine pass around the best vibration pocket. This keeps slider movement responsive.
* **Exact Klipper-style:** an exhaustive 0.2Hz scan across the full allowed frequency range.
Remaining vibration is pessimized across $\zeta = [0.075, 0.1, 0.15]$ while shapers are still constructed with Klipper's default $\zeta = 0.1$.
When scores are tied, the higher shaper frequency is preferred because its shorter impulse train creates less smoothing delay. Fast mode uses a smoothing-aware ZV override; exact mode uses Klipper's final ZV override based on >10% better residual vibration.

Default recommendations always score the simulated ADXL PSD, matching Klipper's calibration path. The nozzle PSD is shown as a print-quality diagnostic. Users can explicitly run a nozzle-based what-if recommendation, but that mode is labeled separately and is not the default Klipper recommendation.

---

## 5. Time Domain Step Response (`generate_step_responses`)

To visualize the time-domain ringing, we evaluate the exact step response of a single 2nd-order underdamped resonance mode:
$$ \omega_n = 2\pi f_c $$
$$ \omega_d = \omega_n \sqrt{1 - \zeta^2} $$
The unshaped response to a step input $u(t) = 1$ is:
$$ y(t) = 1 - e^{-\zeta \omega_n t} \left( \cos(\omega_d t) + \frac{\zeta}{\sqrt{1 - \zeta^2}} \sin(\omega_d t) \right) $$
The shaped response is just the superposition of delayed and scaled unshaped responses:
$$ y_{shaped}(t) = \sum_j \left( \frac{A_j}{\sum A_i} \cdot y(t - T_j) \right) $$
*(For $t < T_j$, $y(t - T_j) = 0$)*.

This implementation is exact for the single SDOF mode at $f_c$. It is a visualization of the primary mode only; secondary PSD peaks such as yaw, hose drag, sway, belt delta, and mesh excitation are not included in the step-response plot.
