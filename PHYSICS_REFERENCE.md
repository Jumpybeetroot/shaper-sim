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

---

## 3. Motor Physics & Magnetic Springs
Stepper motors don't lock rigidly. The rotor is held in place by a magnetic field, which acts exactly like a torsional spring. 

$$K_{magnetic} \approx \frac{Holding Torque \times Current \%}{Step Angle}$$

### Inertial Decoupling (The AWD Problem)
In standard CoreXY (2WD), the toolhead mass dominates the equation. In All-Wheel Drive (AWD), you add two extra stepper motors. If you blindly add the rotor mass of these motors to your toolhead, the math predicts a massive drop in resonance.
**The Fix:** Our simulator physically decouples rotational inertia. We only apply a 15% `inertial_coupling_factor` for the rotors, accurately modeling how AWD increases driving force *without* imposing a massive linear mass penalty on the system.

### Acceleration Smear (High-Speed Torque Loss)
If you run Klipper's `TEST_RESONANCES` (ADXL test), the printer tests at a standstill. The motors have maximum torque, creating a stiff magnetic spring and a high frequency.

During a real print at 500 mm/s, **Back-EMF** generates voltage that fights the stepper driver. The motor loses holding torque drastically at high speeds.
1. Speed increases $\rightarrow$ Torque drops.
2. Torque drops $\rightarrow$ Magnetic spring softens.
3. Spring softens $\rightarrow$ **Resonance frequency drops.**

When you enable **"Speed Simulation"**, the simulator mathematically integrates 15 distinct resonance curves across your acceleration profile (from your slow Square Corner Velocity up to your target Print Speed). This creates a "smeared" resonance band, showing exactly why static Input Shapers struggle at very high speeds.

---

## 4. Klipper Shaper & PSD Math
Once the baseline resonance frequency is predicted, the simulator ports Klipper's exact post-processing math to score the shapers.

1.  **Power Spectral Density (PSD):** We generate a Lorentzian peak centered on our predicted frequency. The width of this peak is defined by the **Damping Ratio** (defaulting to `0.100` to match Klipper's reference frame). 
2.  **Mechanical Imperfections:** Real ADXL graphs aren't perfect single spikes. When you tweak sliders like "Toolhead Twist" or "Hose Drag," the simulator injects secondary frequency harmonics into the PSD curve to mimic racking, drag, and asymmetric twisting.
3.  **Shaper Scoring:** The simulator tests Klipper's algorithms (ZV, MZV, EI, 2HUMP, 3HUMP). For each shaper, it convolves the shaper's response against the PSD curve. 
4.  **The Goal:** It attempts to find the highest frequency that can push the remaining vibrations below Klipper's internal safety threshold ($\approx 5\%$ of the raw PSD amplitude), while keeping the injected Smoothing below $0.12$.

By merging true Newtonian mechanics with Klipper's exact Python filtering algorithms, this simulator allows you to virtually "bench test" hardware upgrades before purchasing them!
