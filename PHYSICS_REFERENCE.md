# Physics & Math Reference: Kalico Input Shaper Simulator

This document outlines the math and mechanical theory driving the Input Shaper Simulator. It bridges the gap between empirical 3D printer mechanics and Klipper's internal `shaper_calibrate.py` algorithms.

---

## 1. The Core Mass-Spring System
The foundation of any resonance prediction is the classic harmonic oscillator equation. The natural frequency ($f$) of the toolhead is determined by its mass ($M$) and the stiffness of the spring ($K$) holding it.

$$f = \frac{1}{2\pi} \sqrt{\frac{K_{total}}{M_{total}}}$$

In a 3D printer, the "spring" ($K_{total}$) is a combination of:
1.  **Belt Stiffness** (The physical elasticity of the Gates belts).
2.  **Magnetic Stiffness** (The holding torque of the stepper motors).
3.  **Frame Stiffness** (The rigidity of the aluminum extrusions and printed mounts).

The simulator treats these as springs in series. If any one spring is "soft" (e.g., low motor torque or loose belts), the total system stiffness drops significantly, lowering your resonance frequency.

### Frame Stiffness Ratios (Area Moment of Inertia & Stressed-Skin)
The simulator uses a multiplier from 0.5 to 10.0 to represent the mechanical rigidity of the chassis:
*   **1.0 (Bare 2020 Extrusion):** The baseline reference. A pure space frame with no shear web.
*   **4.0 (Bare 4040 Extrusion):** While a 4040 extrusion has an Area Moment of Inertia ($I$) 16 times greater than 2020, a bare frame's racking stiffness is bottlenecked entirely by the corner joints. Thus, an unpaneled 4040 frame yields roughly a 4x real-world stiffness multiplier over 2020.
*   **5.0 (2020 + 3mm Alu Panels):** A stressed-skin monocoque beats an open space frame. Bolting solid 3mm aluminum panels transforms a 2020 frame into a massive shear web, making it significantly stiffer in racking than an open 4040 frame.
*   **6.5 (2020 + 5mm Alu Panels):** Thicker 5mm aluminum provides even more shear rigidity to a 2020 skeleton.
*   **7.5 (4040 + 3mm Alu Panels):** Combining the massive $I$ of 4040 with the shear strength of 3mm Aluminum side panels.
*   **9.0 (4040 + 5mm Alu Panels):** The ultimate ultra-stiff system combining 4040 and 5mm Aluminum.
*   **10.0+ (CNC Billet / Industrial):** Thick solid plates, cast iron, or epoxy granite bases.

> **Material Note (ACM & PC):** Aluminum Composite Material (ACM) and Polycarbonate (PC) panels are popular, but their shear rigidity is significantly lower than solid aluminum. A 3mm ACM panel will provide less than half the structural stiffness of a 3mm solid aluminum panel because the core is mostly plastic.

> **Mounting Caveat (Bowing & Flopping):** The massive stiffness multipliers for structural panels assume the panels act as a true "stressed skin." To achieve this, the panels must be continuously bolted (e.g., every 100mm) or bonded (VHB tape) to the extrusions. If a panel is only held by printed clips or bolted solely at the corners, the extrusions will still bow and twist independently of the panel under load, reducing your stiffness back to a bare frame baseline.

---

## 2. Belt Physics & Tension
When you "tune" a belt (e.g., plucking a 150mm span and measuring 110Hz), you are setting its static tension. The simulator converts this Hz tuning into a physical Newton force using the wave equation:

$$T = 4 \cdot \rho \cdot L^2 \cdot f^2$$

Where:
*   $T$ = Tension in Newtons
*   $\rho$ = Linear density of the belt (e.g., 0.0084 kg/m for standard 6mm GT2).
*   $L$ = Span length (0.15 meters for a 150mm span).
*   $f$ = Your tuned frequency (Hz).

**Diminishing Returns:** The simulator enforces a dynamic stiffness multiplier curve. Over-tensioning a belt beyond its designed elastic limit yields diminishing returns in stiffness while drastically increasing the drag on the motor bearings.

### AWD Belt Segment Isolation (2WD vs AWD)
The drive configuration has a dramatic impact on effective belt stiffness. The simulator models this as follows:

**2WD (Standard CoreXY):** Both stepper motors sit at the rear of the machine. Each belt loops from a rear motor, through idler pulleys at the front corners, across the gantry (where the toolhead grips it), and back. When the toolhead vibrates, it stretches belt across the **full loop path**, including long runs through compliant idler bearings and flexible mounts. The base belt stiffness is:

$$K_{belt,2WD} = \frac{8 \cdot EA}{L}$$

Where $L$ is the total belt loop length and $EA$ is the tensile rigidity of the belt.

**AWD (All-Wheel Drive CoreXY):** Motors are placed at all four corners. The front and rear motor pairs rigidly anchor both ends of each gantry belt segment. The toolhead can no longer stretch the full belt loop — it is trapped between motor pairs on short, isolated segments. This eliminates the long compliant idler paths entirely and produces roughly **3× the effective belt stiffness** of 2WD:

$$K_{belt,AWD} \approx 3 \times K_{belt,2WD}$$

Additionally, AWD doubles the motor count from 2 to 4, which doubles the total magnetic spring stiffness ($K_{motor}$). Combined with the belt isolation effect, this produces a total system stiffness increase that yields **significantly higher resonance frequencies** — consistent with the 60-80% frequency gains observed on high-performance AWD builds.

**Rotor Mass Decoupling:** The extra motor rotors do add physical mass to the vibrating system. However, because the rotor sits behind the belt spring (separated by pulley tooth meshing compliance and motor mount elasticity), the toolhead only "feels" approximately **15%** of each rotor's effective linear mass during high-frequency resonance. This low coupling factor is consistent across both 2WD and AWD configurations.

---

## 3. Structural Damping Ratio ($\zeta$)
In Klipper's `[input_shaper]` configuration, you can adjust `damping_ratio_x` and `damping_ratio_y` (which default to `0.1`). Damping is the measure of how quickly mechanical vibrations decay into heat.

Counter-intuitively, the structural damping ratio often moves inversely to frame stiffness:
*   **0.10 - 0.15 (High Damping):** Flexible "bare" frames or panels mounted with VHB foam tape. Flexible frames micro-slip at the corner joints, which burns off vibrational energy via friction. VHB tape acts as a viscoelastic damper, soaking up ringing.
*   **0.07 - 0.10 (Standard):** A typical 3D printer frame with tightly bolted aluminum components.
*   **0.04 - 0.07 (Low Damping):** Ultra-rigid CNC billet frames or fully bolted monocoques. Because solid aluminum has very little internal damping and the frame is too rigid to micro-slip, it will "ring like a bell" for a longer duration. These frames require Klipper's input shaper to do more heavy lifting to cancel out the sustained ringing.

---

## 4. Motor Physics & Magnetic Springs
Stepper motors don't lock rigidly. The rotor is held in place by a magnetic field, which acts exactly like a torsional spring. 

$$K_{magnetic} \approx \frac{Holding Torque \times Current \%}{Step Angle}$$

### Acceleration Smear (High-Speed Torque Loss)
If you run Klipper's `TEST_RESONANCES` (ADXL test), the printer tests at a standstill. The motors have maximum torque, creating a stiff magnetic spring and a high frequency.

During a real print at 500 mm/s, **Back-EMF** generates voltage that fights the stepper driver. The motor loses holding torque drastically at high speeds.
1. Speed increases $\rightarrow$ Torque drops.
2. Torque drops $\rightarrow$ Magnetic spring softens.
3. Spring softens $\rightarrow$ **Resonance frequency drops.**

When you enable **"Speed Simulation"**, the simulator mathematically integrates 15 distinct resonance curves across your acceleration profile (from your slow Square Corner Velocity up to your target Print Speed). This creates a "smeared" resonance band, showing exactly why static Input Shapers struggle at very high speeds.

---

## 5. Klipper Shaper & PSD Math
Once the baseline resonance frequency is predicted, the simulator ports Klipper's exact post-processing math to score the shapers.

1.  **Power Spectral Density (PSD):** We generate a Lorentzian peak centered on our predicted frequency. The width of this peak is defined by the **Damping Ratio** (defaulting to `0.100` to match Klipper's reference frame). 
2.  **Mechanical Imperfections:** Real ADXL graphs aren't perfect single spikes. When you tweak sliders like "Toolhead Twist" or "Hose Drag," the simulator injects secondary frequency harmonics into the PSD curve to mimic racking, drag, and asymmetric twisting.
3.  **Shaper Scoring:** The simulator tests Klipper's algorithms (ZV, MZV, EI, 2HUMP, 3HUMP). For each shaper, it convolves the shaper's response against the PSD curve. 
4.  **The Goal:** It attempts to find the highest frequency that can push the remaining vibrations below Klipper's internal safety threshold ($\approx 5\%$ of the raw PSD amplitude), while keeping the injected Smoothing below $0.12$.

## 6. Time Domain (Step Response)
While Power Spectral Density is great for frequency analysis, humans visualize 3D printing artifacts in the time domain (ringing on the surface of a print).
The simulator generates a classical 2nd-order underdamped Step Response:
$$y(t) = 1 - e^{-\zeta \omega_n t} \left( \cos(\omega_d t) + \frac{\zeta}{\sqrt{1-\zeta^2}} \sin(\omega_d t) \right)$$
Where $\omega_d = \omega_n \sqrt{1-\zeta^2}$ is the damped natural frequency. 

To visualize Input Shaping, the simulator performs a discrete convolution. It takes the unshaped step response $y(t)$ and delays/scales it according to the selected shaper's impulse sequence (the $A_i$ amplitudes and $T_i$ timing delays). 
$$y_{shaped}(t) = \sum \frac{A_i}{\sum A} \cdot y(t - T_i)$$
This proves mathematically why higher damping ($\zeta$) physically settles faster, and how shapers perfectly flatline vibrations precisely when their delayed impulses fire.

By merging true Newtonian mechanics with Klipper's exact Python filtering algorithms, this simulator allows you to virtually "bench test" hardware upgrades before purchasing them!
