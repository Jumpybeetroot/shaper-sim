# Product Context

## Users

- **Primary:** Klipper 3D printer owners tuning input shaper settings
- **Secondary:** 3D printer builders evaluating mechanical designs before assembly
- **Tertiary:** Contributors to Klipper ecosystem tools

## User Goals

1. Understand how mechanical parameters (belt tension, motor stiffness, frame rigidity) affect resonance frequencies
2. Preview shaper recommendations before running physical tests
3. Compare simulated PSD curves against real ADXL345 calibration data
4. Evaluate mechanical modifications (AWD conversion, toolhead upgrades, belt changes) virtually
5. Understand speed-dependent resonance shifts for high-speed printing

## Key Workflows

1. **Parameter exploration:** Adjust sliders for weight, belt type, motor preset, etc. and watch PSD curves update in real-time
2. **CSV comparison:** Import Klipper `calibration_data_*.csv` files and overlay on simulated curves
3. **Snapshot comparison:** Lock a baseline curve, change parameters, observe the delta
4. **Shaper selection:** Review recommended shapers with max acceleration values per axis
5. **Nozzle diagnostics:** Run nozzle-based what-if analysis for print-quality risk assessment
6. **Speed simulation:** Toggle speed effects to see torque drop-off and belt meshing peaks

## UX Expectations

- Real-time response during slider interaction (no perceptible lag)
- Clear visual distinction between simulated curves and CSV overlays
- Toggleable shaper legend items for focused comparison
- Step response view showing how shapers flatten ringing
- Responsive layout for different screen sizes

## Operator Workflow

The tool is used interactively in a browser. No server-side state. All computation happens client-side in a Web Worker. Users typically:
1. Start with a motor preset
2. Adjust printer geometry and belt parameters
3. Import real calibration CSV if available
4. Review shaper recommendations
5. Export/apply settings to their Klipper config
