# AI Agent Instructions (shaper-sim)

## Journal

At the start of a session, create a new journal file at the root of
the working directory: `journal-N.md`, where N is one higher than
the highest existing `journal-*.md` (start at 1 if none exist).

Append an entry for every non-trivial action you take. Write it as
you do the work, not as a summary at the end.

Each entry should include:
- ISO timestamp (`YYYY-MM-DD HH:MM`)
- One-line summary
- The exact command, if one was run, and the actual result or
  output (not a paraphrase)
- Files edited and why
- Hypotheses and whether they held up
- Dead-ends, with a note on why the thing didn't work
- Links read during research
- Decisions made and the reasoning behind them

Before starting new work, or after a context compaction, read the
current journal to orient yourself. If this is a fresh attempt at a
task you've tried before, skim the previous `journal-*.md` files
too.

Hello, fellow AI coding assistant! If you are reading this, you are working on the **Kalico Input Shaper Simulator**. This file contains critical architectural rules and context to prevent regressions in this codebase. Read this carefully before modifying any code.

## 1. Tech Stack & Philosophy
* **Pure Vanilla:** This project uses vanilla HTML, CSS, and JavaScript. 
* **No Frameworks:** DO NOT introduce React, Vue, Svelte, TailwindCSS, or any build tools (Webpack/Vite). The app must be able to run by simply opening `index.html` in a browser.
* **Chart.js Rendering:** The graphs (PSD curves, Step Responses) are drawn using the `Chart.js` library in `app.js`, wrapped dynamically around an HTML5 canvas.

## 2. Architecture
The project logic is split between two core files:
1. **`app.js` (UI & Graphics):** Handles DOM interactions, reads the UI sliders, sets up `Chart.js`, and orchestrates the dynamic rendering of both Frequency (PSD) and Time (Step Response) plots via `generateChartData()`.
2. **`shaper_logic.js` (Physics & Math):** Handles the mathematical modeling of the stepper motors (magnetic stiffness), belt tension, mechanical imperfection modeling, and the complex convolutions for Klipper input shapers.

## 3. Mathematical "Gotchas" (CRITICAL)

### A. Stepper Motor vs. Belt Stiffness
The physical model in `shaper_logic.js` is not a generic mass-spring system. It specifically models the duality of an FDM 3D printer:
* **Belt Stiffness** scales non-linearly with tension.
* **Stepper Motor Stiffness** acts as a spring in series with the belts, calculated using holding torque, rotor radius, and microstepping compliance.
* **Rule:** If you are modifying the resonant frequency predictions, you must respect the series-spring equation (`1/k_total = 1/k_belt + 1/k_motor`).

### B. Input Shaper Transfer Functions & Normalization
The shaper algorithms (ZV, MZV, EI, 2HUMP_EI, 3HUMP_EI) are implemented by defining their impulse amplitudes ($A_i$) and times ($T_i$).
* **Frequency Domain:** We compute the discrete Fourier transform magnitude across a frequency sweep. Klipper's math scales these internally.
* **Time Domain (CRITICAL):** When generating the step response in `generate_step_responses()`, you **MUST** normalize the impulse amplitudes by their sum (`A[j] / sum_A`). Because Klipper's raw $A_i$ coefficients sum to a value $> 1.0$ (e.g. $1.0 + K$ for ZV), failing to normalize will cause the position plot to settle at an incorrect value.

### C. Resonance Peak (Lorentzian) Conventions
The primary resonance in `generate_psd_curve()` is a Lorentzian with two hardcoded invariants that are easy to "fix" in the wrong direction:
* **Width:** `w = center_freq * damping_ratio`. This is the HWHM (half-width at half-max) of $|H(\omega)|^2$ near resonance. An earlier `w = center_freq / Q` was FWHM — peaks were 2× too wide. Do **not** revert to `/Q`.
* **Peak amplitude:** `base_amplitude` $\propto Q^2 = 1/(2\zeta)^2$ is correct because `TEST_RESONANCES` runs a **steady-state chirp**, not an impulse. Do **not** rescale to $1/\zeta$ under a "fixed-energy impulse" argument. Do **not** add $f^2$ / $f^4$ envelopes on top — Klipper's chirp balances those, so adding them makes plots less realistic, not more.
* **Secondary peaks (twist, sway, hose, split, racking)** still compute width as `/Q`. Known inconsistency with the primary peak; their empirical multipliers (`1.5`, `0.345/broadening_factor`, etc.) were tuned against the old convention, so porting the HWHM fix requires re-tuning those constants.

### D. Snapshot State Shape
`snapshotX` / `snapshotY` in `app.js` store the full capture context: `{ psd, shapedPsd, mathFreqs, damping, targetFreq, shaperName }`. This is intentional — because peak PSD scales with $Q^2$, two bare PSD arrays captured at different damping ratios are not directly comparable. The legend label on snapshot datasets must show the captured parameters (`ζ=…, … Hz`) so A/B comparison is unambiguous. Don't reduce the snapshot back to a loose array.

### E. Float Array Indexing in Loops
When populating sized arrays (like `Float64Array`) in physics loops, never use floating-point accumulation for loop bounds (e.g., `for(let t = 0; t <= duration; t += dt)`). Floating-point inaccuracies will cause off-by-one errors and spurious artifacts (like lines returning to the origin). Always use integer-based index iteration (e.g., `for(let i = 0; i < N; i++) { let t = i * dt; }`).

### F. Chart.js Scale Management
When switching between linear scales (e.g., Step Response) and category scales (e.g., PSD) in Chart.js, do not use `delete chartInstance.options.scales.x.type` as the library might incorrectly persist the linear scale settings. Explicitly set the scale type instead (e.g., `chartInstance.options.scales.x.type = 'category'`).

## 4. Modifying the UI
When adding new sliders to `index.html`:
1. Add the `<input>` slider.
2. Add the corresponding `<span>` for the value display.
3. Map both elements in the `els` object at the top of `app.js`.
4. Ensure `handleInputEvents()` updates the display span and triggers `generateChartData()` to update the graphs.

## 5. Save Protocol (Auto-commit & Push)
After every change (creating, modifying, or deleting any file), the agent MUST immediately commit and push to the WIP GitHub branch (`wip-local-testing`).

Execute these commands without waiting for user confirmation:
```bash
git add .
git commit -m "wip: AI auto-save - [brief description of what changed]"
git push origin wip-local-testing
```

- Do NOT wait for the user to ask before committing.
- Do NOT wait for the user to ask before pushing.
- If the `wip-local-testing` branch does not exist, create it first: `git checkout -b wip-local-testing`
- If the push fails due to upstream tracking, set it: `git push -u origin wip-local-testing`
