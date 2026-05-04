# ShaperSim React Review Status

This note records the current status of the earlier optimization review. The original concerns about synchronous scoring on the React main thread are no longer current.

## Implemented

- Heavy PSD and shaper scoring work runs in `src/lib/shaper.worker.ts`.
- Same-state `PSD` and `SHAPERS` worker requests reuse one cached simulation result inside the worker.
- Live interactive shaper scoring is debounced separately from immediate PSD updates.
- Chart data is downsampled before rendering and uses typed physics arrays internally.
- Saved state and saved profiles are sanitized through `src/lib/stateSanitizer.ts`.
- Klipper CSV parsing lives in `src/lib/csvOverlay.ts` and has unit coverage.
- PSD mode computes real post-shaper nozzle datasets for all five shapers; non-active datasets can start hidden but are toggleable from the legend.
- Speed Simulation renders an operating-speed PSD from voltage-limited motor current, pulley tooth count, and belt-mesh forcing, while shaper recommendations score standstill structural PSDs; belt-mesh forcing remains visible in post-shaper overlays instead of being treated as ringdown.

## Remaining Watch Items

- Exact Klipper scoring is intentionally heavier than interactive scoring and should stay behind the explicit `Exact Klipper` button.
- New UI state fields should be added to `STATE_RANGES` or the select/boolean validation paths before they are persisted or sent to the worker.
- Any future buffer-transfer optimization must preserve the current no-transfer invariant unless `PSD` and `SHAPERS` request ordering is redesigned.
