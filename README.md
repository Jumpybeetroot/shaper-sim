# Kalico Input Shaper Simulator

A highly advanced, physics-based resonance prediction and Input Shaper visualization tool designed for Klipper-based 3D printers. 

Unlike standard calculators that rely on simple empirical ratios, this simulator mathematically models the exact physical properties of your printer's gantry, belts, and motors. It ports Klipper's internal Power Spectral Density (PSD) calculation logic into real-time JavaScript, allowing you to visualize exactly how mechanical changes impact your ADXL resonance graphs before you even touch a wrench.

![Simulator Interface](https://raw.githubusercontent.com/Jumpybeetroot/shaper-sim/main/assets/screenshot.png) <!-- Update image path if needed -->

## Why Use This Simulator?

When tuning a 3D printer for ultra-high speeds, guessing the impact of a heavier hotend, wider belts, or different stepper motors can lead to wasted money and time. This tool replaces the guesswork with deep physics modeling. 

### Key Features

*   **Real-World Component Database:** Select from a built-in database of popular stepper motors (e.g., LDO-42STH48, Kraken, Moons, Excit3D MaxMotor). The tool automatically applies the correct rotor inertia and holding torque to the simulation.
*   **Stressed-Skin Frame Stiffness:** Models the structural difference between open space frames (bare extrusions) and stressed-skin monocoques (bolted aluminum panels), allowing you to predict how paneling upgrades improve rigidity.
*   **Belt Stiffening Physics:** Accurately models the linear density (g/m) and elastic modulus of 6mm, 9mm, 10mm, and 12mm Gates GT2 belts.
*   **Structural Damping Analysis:** Incorporates the inverse relationship between frame stiffness and damping ($\zeta$). Simulates how flexible frames (bare 2020) burn off ringing via joint friction (high damping), while ultra-rigid CNC frames "ring like a bell" (low damping).
*   **AWD Belt Segment Isolation:** Accurately models the mechanical difference between 2WD and AWD CoreXY configurations. In 2WD, toolhead vibrations stretch the full belt loop through compliant idler paths. In AWD, the front and rear motor pairs rigidly anchor the belt, isolating the toolhead to only short, ultra-stiff gantry segments — dramatically increasing belt stiffness and predicted resonance frequency.
*   **Time-Domain Step Response:** Switch the Graph Mode from PSD to Time-Domain to visualize the exact settling behavior of your printer. Watch a mathematical 2nd-order underdamped step response ring out and see exactly how the chosen input shaper sequence flatlines the vibration.
*   **Snapshot Mode (Ghost Graphs):** Take a snapshot of your current resonance or step response curve to lock a "ghost" line on the graph. As you tweak parameters (like adding 100g to the toolhead), you can instantly compare the new curve against your baseline in real-time.

## Experimental Physics: Acceleration Smear

**This is the simulator's flagship feature and explains why perfectly tuned Input Shapers sometimes still leave ringing at 500+ mm/s.**

Ringing typically starts immediately after a sharp corner, when the printer has decelerated down to its Square Corner Velocity (usually 5 mm/s). At this low speed, the motor has maximum holding torque, creating a very stiff "magnetic spring" and a high resonance frequency. 

However, as the toolhead accelerates away from the corner:
1. Print speed increases rapidly.
2. Back-EMF causes the stepper motor to lose holding torque.
3. The magnetic spring softens.
4. **The resonance frequency drops.**

Because Klipper's Input Shaper uses static timing based on standstill ADXL tests, it becomes slightly desynchronized from the actual, dynamically lowering frequency during high-speed acceleration.

By enabling **Speed Simulation (Advanced)**, this tool integrates 15 distinct resonance curves across the acceleration profile (from SCV up to your target Print Speed). The result is a mathematically accurate **Acceleration Smear**—the primary resonance peak visually widens and smears across the lower frequencies, perfectly visualizing the high-speed desynchronization effect!

## How to Run Locally

You can run this simulator in any modern web browser without installing Node.js or complex dependencies. 

1. Clone the repository:
   ```bash
   git clone https://github.com/Jumpybeetroot/shaper-sim.git
   ```
2. Navigate to the directory:
   ```bash
   cd shaper-sim
   ```
3. Start a local web server (Python 3):
   ```bash
   python -m http.server 8080
   ```
4. Open your browser and navigate to: `http://localhost:8080/index.html`

## Math & Attribution

This simulator utilizes a Javascript port of Klipper's internal `shaper_calibrate.py` math. The predictive frequency calculations use a highly refined mass-spring formula: $f = \frac{1}{2\pi} \sqrt{\frac{K}{M}}$, factoring in dynamic torque compliance, belt tension $T = 4 \cdot \rho \cdot L^2 \cdot f^2$, and system inertia.

*Actual results will vary based on frame design, loose screws, and bearing drag. Always use a physical ADXL345 accelerometer for your final tuning!*
