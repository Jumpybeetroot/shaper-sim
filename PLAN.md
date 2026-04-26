# Shaper-Sim 2.0 Implementation Steps

This document outlines the concise, step-by-step execution plan along with the exact mathematical formulas needed for the five new major features in Shaper-Sim.

> [!IMPORTANT]
> ## User Review Required
> Please review the step-by-step execution flow and the integrated mathematical models. Let me know if the formulas align with your expectations for the physics engine!

---

## 1. Real ADXL Data Import (Digital Twin Tuning) [DONE]

### Step-by-Step Implementation:
1.  **[x] HTML/CSS Updates:** Add visually distinct `<div id="drop-zone">` and a hidden `<input type="file" id="csv-upload">` in `index.html`.
2.  **[x] File Parsing (`app.js`):** Add `dragover`/`drop` listeners. Use `FileReader` to parse the CSV string. Ensure handling of Klipper's CSV header format (`#freq,psd_x,psd_y,psd_z,psd_xyz`).
3.  **[x] Normalization Logic & Math:** 
    *   **Formula:** $ScaleFactor = \frac{\max(PSD_{simulated})}{\max(PSD_{csv})}$
    *   **Application:** Multiply every $Y$ value in the CSV dataset by $ScaleFactor$ before graphing to align peaks visually. Add a UI checkbox to toggle "Normalize Heights".
4.  **[x] Chart Integration:** Update `initChart()` with `realDataX` and `realDataY` datasets (dashed lines, semi-transparent fills).

## 2. Pre-Built Printer Profiles

### Step-by-Step Implementation:
1.  **Data Architecture:** Create `profiles.js` containing a `const PRINTER_PROFILES` database.
2.  **UI Updates:** Populate the `#profile-select` element dynamically from the `PRINTER_PROFILES` dictionary.
3.  **Application Logic:** On the `<select>` change event, iterate over the profile's keys to set the corresponding HTML slider `value`s, then call `updateSimulation()`.
4.  **Custom Saves:** Attach a click listener to `#save-profile-btn` to serialize current slider values into a JSON object and push it to `localStorage.setItem('shaper_sim:custom_profiles')` (namespaced) with a `schema_version` field.

## 3. Kinematic-Specific Coupling & Cross-Gantry

### Step-by-Step Implementation:
1.  **UI Additions:** 
    *   "Kinematics Type": Cartesian | CoreXY (Cartesian disables the Move Direction slider).
    *   Expand "Drive Config": 2WD | AWD-parallel | AWD-cross-gantry.
    *   Add 2D bed canvas to click and set carriage position.
    *   "Move Direction" slider (0°-45°) - active only for CoreXY.
2.  **Position-dependent Belt Length (`shaper_logic.js`):**
    *   Use $L_{active}$ computed from carriage position to motor-pulley anchor: $L_{active} = \max(L_{active\_A}, L_{active\_B})$.
    *   Scale nominal stiffness: $K_{belt}(x,y) = K_{belt,nominal} \cdot \frac{L_{nominal}}{L_{active}(x,y)}$ (applied before AWD doubling).
3.  **CoreXY Directional Excitation:**
    *   Inject extra power for diagonal moves: $\text{amp}_{primary}^{diag} = \text{amp}_{primary} \cdot (1 + 0.25 \cdot |\sin(2\theta)|)$.
4.  **Cross-Gantry AWD Racking Resistance:**
    *   Model as a reduction to the existing racking peak: $\text{racking\_amp}_{AWD} = \text{racking\_amp}_{2WD} \cdot \frac{1}{1 + \beta}$.
    *   $\beta = 0$ (Standard CoreXY), $\beta = 1.0$ (AWD parallel), $\beta = 2.0$ (Cross-gantry AWD).

## 4. Motor Torque & Back-EMF Curves

### Step-by-Step Implementation:
1.  **UI Updates:** Add sliders for `Supply Voltage (V)` (12-60), `Motor Inductance (mH)` (1-10), `Rated Current (A)` (0.5-3.0), and `Print Speed (mm/s)` (0-800).
2.  **Torque Curve Canvas:** Add a secondary `<canvas id="torqueChart">` to visualize $T_{actual}(v)$ for v ∈ [0, 1000] mm/s. Mark corner speed where $E_{bemf} = V_{supply} / 2$.
3.  **Back-EMF & Current Ceiling Math (`shaper_logic.js`):**
    *   $\omega_{mech} = \frac{v_{linear} / 1000}{r_{pulley}}$
    *   $\omega_{elec} = \omega_{mech} \cdot N_{rotor}$
    *   $K_e = \frac{T_{holding}}{I_{rated}}$
    *   $E_{bemf} = K_e \cdot \omega_{elec}$
    *   $V_{avail} = \max(0, V_{supply} - E_{bemf})$
    *   $I_{max}(\omega) = \frac{V_{avail}}{\omega_{elec} \cdot L_{inductance}}$
    *   $T_{actual}(\omega) = T_{holding} \cdot \min(1, \frac{I_{max}(\omega)}{I_{rated}})$
4.  **Coupling to Resonance:**
    *   Enforce a detent floor so stiffness doesn't collapse to zero: $K_{motor}^{dyn}(\omega) = K_{motor}^{static} \cdot \left(\gamma + (1-\gamma) \cdot \frac{T_{actual}}{T_{holding}}\right)$, where $\gamma = 0.5$.
    *   Update `predict_resonance()` to accept the new parameters and apply this factor to `Kmotor_single`.

## 5. Interactive 3D Printer Visualizer

### Step-by-Step Implementation:
1.  **Setup:** Add the `Three.js` CDN script and a `<div id="visualizer-container">`.
2.  **Scene Initialization:** Build a generic wireframe representing the printer (Z-pillars, X/Y gantry, Toolhead cube).
3.  **Animation Loop Math:** Hook into `requestAnimationFrame(time)`.
    *   Clamp amplitude $A \propto 1/f^2$ for visualizer amplitude.
    *   **Toolhead X Displacement:** $\Delta X = A \cdot \sin(time \cdot 2\pi \cdot f_{sim\_x})$
    *   **Toolhead Y Displacement:** $\Delta Y = A \cdot \sin(time \cdot 2\pi \cdot f_{sim\_y})$
4.  **Mode Visualization Math:** 
    *   **Racking:** Apply a shear matrix to the Y-gantry proportional to $\sin(time \cdot 2\pi \cdot f_{sim\_y}) \times \text{Racking \%}$.
    *   **Frame Sway:** Rotate the Z-pillars by angle $\theta = \sin(time \cdot 2\pi \cdot f_{sim\_x}) \times (\text{Sway \% converted to radians})$.
