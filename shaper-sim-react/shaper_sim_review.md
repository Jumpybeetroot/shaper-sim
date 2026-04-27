# ShaperSim React Codebase Review & Optimization Plan

## 1. Performance & Bottlenecks (Critical)

The most severe issue in the current architecture is the synchronous, heavy math running on the main UI thread during state changes (e.g., when a user drags a slider). 

### The `scoreShapers` Loop
In `App.tsx`, `baseMath` calls `scoreShapers` for both X and Y axes whenever the `state` changes. 
- `scoreShapers` evaluates 5 different shapers.
- For each shaper, it performs a coarse sweep (2.0Hz steps) and a fine sweep (0.2Hz steps) up to `max_hz` (default 400, max 1000). 
- In each sweep iteration, `estimate_remaining_vibrations` loops over the entire `freqs` array (size = `max_hz / 0.5`).
- **Math:** 5 shapers * ~500 sweeps * 2000 frequencies = ~5,000,000 loop iterations per axis. **~10 million iterations total per slider tick.**
- **Impact:** This will cause severe UI lag and frame drops when interacting with the simulation controls. 

### Array Allocations & Garbage Collection
- **`App.tsx` / `baseMath`**: `freqs` is created as a standard JavaScript array `Array.from(...)` instead of a typed array (`Float64Array`).
- **`generate_psd_curve`**: Without an `out_psd` buffer passed in, it allocates a new `Float64Array` on every call.
- **Chart.js Datasets**: `chartData` maps the large physics arrays into an array of thousands of `{ x, y }` objects on every render: `freqs.map((f, i) => ({ x: f, y: psd[i] }))`. This creates immense garbage collection pressure.
- **Impact:** Frequent memory allocations and garbage collection pauses will further stutter the UI.

### LocalStorage Thrashing
- `useEffect` writes the entire state to `localStorage` on every single change to `state`. When dragging a slider, this fires dozens of times per second. 
- Synchronous disk I/O on the main thread contributes to input latency.

---

## 2. Options for Optimization

### A. Web Worker for Physics Calculations
Offload the `predict_resonance`, `generate_psd_curve`, and `scoreShapers` functions to a Web Worker. 
- **Benefit:** Keeps the React UI thread completely unblocked. Sliders will remain silky smooth at 60fps regardless of how heavy the math gets.
- **Implementation:** Create a `shaper.worker.ts` that receives the state parameters, runs the math, and posts the resulting TypedArrays back to the main thread.

### B. Use Typed Arrays (`Float64Array`) exclusively
- Replace all instances of `Array.from({ length: ... })` for numerical physics data with `Float64Array`.
- Pre-allocate a global or memoized buffer for `freqs`, `psdX`, `psdY`, and the intermediate buffers used in `shaperLogic.ts` instead of recreating them on every slider tick. Pass these buffers as the `out_psd` argument to prevent re-allocation.
- For `snapshotData`, instead of spreading `[...psdX]`, use `new Float64Array(psdX)`.

### C. Debounce State Persistence
- Instead of saving to `localStorage` on every render, debounce the `localStorage.setItem` call by ~500ms, or only save it when the user releases the slider (e.g., using `onMouseUp` or a custom hook).

### D. Optimize Chart.js Rendering
- Chart.js supports a performance feature called **Data Decimation** and **Parsing optimization**. 
- Instead of creating `{ x, y }` objects, pass the raw `psd` arrays directly to the chart data and configure Chart.js to map the `freqs` array to the X-axis using `parsing: false`.

---

## 3. Code Errors & TypeScript Improvements

### Over-sensitive `useMemo` dependencies
- The `baseMath` memo in `App.tsx` depends on the entire `state` object. This means if a user changes a setting that has no impact on physics (for example, if a UI-only toggle were added to `state`), it would still trigger the massive 10-million-iteration math recalculation.
- **Fix:** Destructure exactly the mechanical properties needed for physics and use those in the dependency array.

### Swallowed Errors in `localStorage`
- The app loads state inside a `try { setState(...) } catch(e) {}` block. If `localStorage` data is corrupted, it silently fails. It should ideally fall back to merging with `defaultState` to ensure no properties are missing.
- When writing to `localStorage`, it doesn't account for `QuotaExceededError`, which can happen if the browser storage is full.

### TypeScript `any` Usage
- **`Sidebar.tsx`**: Props `scoreX` and `scoreY` are typed as `any`. They should use the return type of `scoreShapers`.
- **`shaperLogic.ts`**: The `memo` argument in `estimate_shaper` is typed as `any`. It should be strongly typed to `{ omega: Float64Array; damping: Float64Array; omega_d: Float64Array; length: number }`.
- **`ChartDisplay.tsx` / `App.tsx`**: Plugins are typed as `any[]`.

### Clamping Input Values
- `updateState` only clamps `maxX`. If a user manually types an invalid number (like `0` or negative) into other inputs like `dampingRatio` or `scv`, it could crash the math functions or result in `NaN` propagating through the `Float64Array`s, breaking the entire chart.

## Summary

The core logic directly ports Klipper's Python implementation successfully, but runs it synchronously in JavaScript's single thread. Implementing a **Web Worker** alongside **TypedArray Buffer reuse** are the most critical next steps to bring this simulator to production-ready performance.
