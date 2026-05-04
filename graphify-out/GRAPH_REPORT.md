# Graph Report - shaper-sim  (2026-05-04)

## Corpus Check
- 18 files · ~29,987 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 120 nodes · 173 edges · 9 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 11|Community 11]]

## God Nodes (most connected - your core abstractions)
1. `ShaperCalibrate` - 18 edges
2. `CalibrationData` - 8 edges
3. `scoreShapersWithMode()` - 8 edges
4. `calculateToolheadModeFactors()` - 7 edges
5. `sanitizeAppState()` - 7 edges
6. `computeSimulation()` - 6 edges
7. `rotationalMeasurementMm()` - 5 edges
8. `sanitizeNumericKey()` - 5 edges
9. `generate_psd_curve()` - 4 edges
10. `addFrequencyCandidate()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `loadSavedState()` --calls--> `sanitizeAppState()`  [INFERRED]
  shaper-sim-react\src\App.tsx → shaper-sim-react\src\lib\stateSanitizer.ts
- `loadSavedProfiles()` --calls--> `sanitizeProfiles()`  [INFERRED]
  shaper-sim-react\src\App.tsx → shaper-sim-react\src\lib\stateSanitizer.ts
- `computeSimulation()` --calls--> `generate_psd_curve()`  [INFERRED]
  shaper-sim-react\src\lib\shaper.worker.ts → shaper-sim-react\src\lib\shaperLogic.ts
- `applyMotorPreset()` --calls--> `getMotorPreset()`  [INFERRED]
  shaper-sim-react\src\components\Sidebar.tsx → shaper-sim-react\src\lib\motorPresets.ts
- `computeSimulation()` --calls--> `getBeltDensity()`  [INFERRED]
  shaper-sim-react\src\lib\shaper.worker.ts → shaper-sim-react\src\lib\beltUtils.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (2): CalibrationData, ShaperCalibrate

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (9): _bisect(), estimate_remaining_vibrations(), estimate_shaper(), _evaluate_step(), find_shaper_max_accel(), generate_step_responses(), get_2hump_ei_shaper(), get_3hump_ei_shaper() (+1 more)

### Community 2 - "Community 2"
Cohesion: 0.24
Nodes (11): parseKlipperCsv(), splitCsvLine(), allowedString(), clamp(), coerceFiniteNumber(), hasMotorOverride(), isRecord(), nearestAllowed() (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.2
Nodes (8): getBeltDensity(), getBeltTensionN(), computeSimulation(), getSimulation(), predictAxes(), computeStepperSpeedTorque(), predict_resonance(), factorAtPulley()

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (2): loadSavedProfiles(), loadSavedState()

### Community 5 - "Community 5"
Cohesion: 0.28
Nodes (9): addFineShaperFreqs(), addFrequencyCandidate(), buildExactShaperFreqs(), buildInteractiveShaperFreqs(), isScoreBetter(), scoreShapers(), scoreShapersExact(), scoreShapersWithMode() (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.25
Nodes (2): applyMotorPreset(), getMotorPreset()

### Community 7 - "Community 7"
Cohesion: 0.29
Nodes (8): axisVector(), calculateToolheadModeFactors(), cross(), distanceFromActiveAxis(), dot(), rotationalMeasurementMm(), rotationVector(), sameOffset()

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (2): generate_psd_curve(), lorentzianAt()

## Knowledge Gaps
- **Thin community `Community 0`** (26 nodes): `shaper_calibrate_klipper.py`, `CalibrationData`, `.add_data()`, `.get_datasets()`, `.get_psd()`, `.__init__()`, `.normalize_to_frequencies()`, `.set_numpy()`, `ShaperCalibrate`, `.apply_params()`, `.background_process_exec()`, `._bisect()`, `.calc_freq_response()`, `._escape_for_csv()`, `._estimate_remaining_vibrations()`, `._estimate_shaper()`, `.find_best_shaper()`, `.find_shaper_max_accel()`, `.fit_shaper()`, `._get_shaper_smoothing()`, `.__init__()`, `.process_accelerometer_data()`, `._psd()`, `.save_calibration_data()`, `.save_params()`, `._split_into_windows()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 4`** (12 nodes): `App.tsx`, `main.tsx`, `' '()`, `applyShaperMessage()`, `emptyScoreSet()`, `formatAccelLimit()`, `loadSavedProfiles()`, `loadSavedState()`, `peakInfo()`, `renderShaperDetail()`, `secondaryDeltaInfo()`, `toChartPoints()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 6`** (8 nodes): `applyMotorPreset()`, `handleChange()`, `RangeControl()`, `ScaleLegend()`, `updateCustomMotorNumber()`, `getMotorPreset()`, `Sidebar.tsx`, `motorPresets.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (2 nodes): `generate_psd_curve()`, `lorentzianAt()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `sanitizeAppState()` connect `Community 2` to `Community 4`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._