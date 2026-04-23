# AI Agent Instructions (shaper-sim)

Hello, fellow AI coding assistant! If you are reading this, you are working on the **Kalico Input Shaper Simulator**. This file contains critical architectural rules and context to prevent regressions in this codebase. Read this carefully before modifying any code.

## 1. Tech Stack & Philosophy
* **Pure Vanilla:** This project uses vanilla HTML, CSS, and JavaScript. 
* **No Frameworks:** DO NOT introduce React, Vue, Svelte, TailwindCSS, or any build tools (Webpack/Vite). The app must be able to run by simply opening `index.html` in a browser.
* **Math-Heavy Canvas Rendering:** The graphs (resonance curves, shaper transfer functions) are drawn manually using the HTML5 Canvas API in `app.js`.

## 2. Architecture
The project logic is split between two core files:
1. **`app.js` (UI & Graphics):** Handles DOM interactions, reads the UI sliders, sets up the Canvas elements, and orchestrates the rendering of the Bode plots (magnitude/phase graphs).
2. **`shaper_logic.js` (Physics & Math):** Handles the mathematical modeling of the stepper motors (magnetic stiffness), belt tension, and the complex frequency-domain transfer functions of the Klipper input shapers (MZV, EI, etc.).

## 3. Mathematical "Gotchas" (CRITICAL)

### A. Stepper Motor vs. Belt Stiffness
The physical model in `shaper_logic.js` is not a generic mass-spring system. It specifically models the duality of an FDM 3D printer:
* **Belt Stiffness** scales non-linearly with tension.
* **Stepper Motor Stiffness** acts as a spring in series with the belts, calculated using holding torque, rotor radius, and microstepping compliance.
* **Rule:** If you are modifying the resonant frequency predictions, you must respect the series-spring equation (`1/k_total = 1/k_belt + 1/k_motor`).

### B. Input Shaper Transfer Functions
The shaper algorithms (MZV, EI, 2HUMP_EI, 3HUMP_EI) are implemented by defining their impulse amplitudes and times, then computing the Discrete Time Fourier Transform (DTFT) magnitude across a frequency sweep. 
* DO NOT arbitrarily change the impulse amplitudes or timings; they are strictly derived from the official Klipper mathematical derivations for vibration cancellation.

## 4. Modifying the UI
When adding new sliders to `index.html`:
1. Add the `<input>` slider.
2. Add the corresponding `<span>` for the value display.
3. Map both elements in the `els` and `vals` objects at the top of `app.js`.
4. Ensure `updateValues()` and the main `updateGraphs()` render loop are extracting the value properly.
