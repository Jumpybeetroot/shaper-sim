import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChartDisplay } from './components/ChartDisplay';
import { DraggableOverlay } from './components/DraggableOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { defaultState } from './types';
import type { AppState } from './types';
import { SHAPERS, DEFAULT_DAMPING_RATIO, estimate_shaper, generate_step_responses } from './lib/shaperLogic';
import type { ShaperScore } from './lib/shaperLogic';
import { Info, WarningCircle, Camera, XCircle, XCircleIcon, FileArrowUpIcon } from '@phosphor-icons/react';

const colors: Record<string, string> = {
  zv: '#ff3366',
  mzv: '#00f0ff',
  ei: '#00ff66',
  '2hump_ei': '#ffaa00',
  '3hump_ei': '#9d00ff'
};

const shaperNames: Record<string, string> = {
  zv: 'ZV',
  mzv: 'MZV',
  ei: 'EI',
  '2hump_ei': '2HUMP_EI',
  '3hump_ei': '3HUMP_EI'
};

// --- CSV overlay support ---

interface CsvOverlay {
  id: string;
  label: string;
  // auto-detected from filename: _x_ → x axis only, _y_ → y axis only
  axis: 'x' | 'y' | 'both';
  freqs: Float64Array;
  psd: Float64Array;
}

const CSV_COLORS = ['#ff9900', '#ff44aa', '#44ffcc', '#bb44ff', '#ffff44', '#44aaff'];

function parseKlipperCsv(text: string, filename: string): CsvOverlay | null {
  // Strip comment lines (Klipper raw resonance files start lines with #)
  const lines = text.trim().split(/\r?\n/).filter(l => l && !l.startsWith('#'));
  if (lines.length < 2) return null;

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const freqIdx = headers.indexOf('freq');
  if (freqIdx === -1) return null;

  // Prefer psd_xyz (combined), then psd_x, then any psd_ column
  let psdIdx = headers.indexOf('psd_xyz');
  if (psdIdx === -1) psdIdx = headers.indexOf('psd_x');
  if (psdIdx === -1) psdIdx = headers.findIndex(h => h.startsWith('psd'));
  if (psdIdx === -1) return null;

  const freqs: number[] = [];
  const psd: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const f = parseFloat(parts[freqIdx]);
    const p = parseFloat(parts[psdIdx]);
    if (isFinite(f) && isFinite(p) && f > 0) {
      freqs.push(f);
      psd.push(p);
    }
  }
  if (freqs.length === 0) return null;

  const lower = filename.toLowerCase();
  const axis: 'x' | 'y' | 'both' =
    /_x[_.]/.test(lower) ? 'x' :
    /_y[_.]/.test(lower) ? 'y' : 'both';

  return {
    id: `${filename}_${Date.now()}`,
    label: filename.replace(/\.csv$/i, ''),
    axis,
    freqs: new Float64Array(freqs),
    psd: new Float64Array(psd),
  };
}

function App() {
  const [state, setState] = useState<AppState>(defaultState);
  const [graphMode, setGraphMode] = useState<'psd' | 'step'>('psd');
  const [viewAxis, setViewAxis] = useState<'x' | 'y'>('x');
  const [selectedShaper, setSelectedShaper] = useState<string>('recommended');
  
  const [snapshotData, setSnapshotData] = useState<{psdX: Float64Array, psdY: Float64Array, freqs: Float64Array} | null>(null);
  const [csvOverlays, setCsvOverlays] = useState<CsvOverlay[]>([]);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleCsvImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const promises = Array.from(files).map(
      file => new Promise<CsvOverlay | null>(resolve => {
        const reader = new FileReader();
        reader.onload = ev => resolve(parseKlipperCsv(ev.target?.result as string, file.name));
        reader.readAsText(file);
      })
    );
    Promise.all(promises).then(results => {
      const valid = results.filter((o): o is CsvOverlay => o !== null);
      if (valid.length > 0) setCsvOverlays(prev => [...prev, ...valid]);
    });
    e.target.value = '';
  }, []);

  const removeCsvOverlay = useCallback((id: string) => {
    setCsvOverlays(prev => prev.filter(o => o.id !== id));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('shaperSim_state');
    if (saved) {
      try { setState(() => ({ ...defaultState, ...JSON.parse(saved) })); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      localStorage.setItem('shaperSim_state', JSON.stringify(state));
    }, 300);
    return () => clearTimeout(handler);
  }, [state]);

  const [profiles, setProfiles] = useState<Record<string, AppState>>(() => {
    const saved = localStorage.getItem('shaperSim_profiles');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return {}; }
    }
    return {};
  });

  const saveProfile = useCallback((name: string) => {
    setProfiles(prev => {
        const newProfiles = { ...prev, [name]: state };
        localStorage.setItem('shaperSim_profiles', JSON.stringify(newProfiles));
        return newProfiles;
    });
  }, [state]);

  const deleteProfile = useCallback((name: string) => {
    setProfiles(prev => {
        const newProfiles = { ...prev };
        delete newProfiles[name];
        localStorage.setItem('shaperSim_profiles', JSON.stringify(newProfiles));
        return newProfiles;
    });
  }, []);

  const loadProfile = useCallback((name: string) => {
    if (profiles[name]) {
        setState(profiles[name]);
    }
  }, [profiles]);

  const updateState = useCallback((key: keyof AppState, value: number | boolean | string) => {
    let finalValue = value;
    if (key === 'maxX' && typeof value === 'number') {
      finalValue = Math.min(1000, Math.max(10, value));
    }
    setState(prev => ({ ...prev, [key]: finalValue }));
  }, []);

  const resetToDefault = useCallback(() => {
    if (window.confirm('Reset all simulation parameters to defaults?')) {
      setState(defaultState);
    }
  }, []);

  const [workerResult, setWorkerResult] = useState<{
    predX: number;
    predY: number;
    compX: { belt: number; frame: number; motor: number };
    compY: { belt: number; frame: number; motor: number };
    freqs: Float64Array;
    psdX: Float64Array;
    psdY: Float64Array;
    psdX_nozzle: Float64Array;
    psdY_nozzle: Float64Array;
    scoreX: { results: Record<string, ShaperScore>; best_shaper: string };
    scoreY: { results: Record<string, ShaperScore>; best_shaper: string };
  } | null>(null);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./lib/shaper.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current.onmessage = (e) => {
      const data = e.data;
      if (data.type === 'PSD') {
        setWorkerResult(prev => ({
          ...prev,
          predX: data.predX,
          predY: data.predY,
          compX: data.compX,
          compY: data.compY,
          freqs: data.freqs,
          psdX: data.psdX,
          psdY: data.psdY,
          psdX_nozzle: data.psdX_nozzle,
          psdY_nozzle: data.psdY_nozzle,
          scoreX: prev?.scoreX || { results: {}, best_shaper: '' },
          scoreY: prev?.scoreY || { results: {}, best_shaper: '' }
        }));
      } else if (data.type === 'SHAPERS') {
        setWorkerResult(prev => {
          if (!prev) return null;
          return {
            ...prev,
            scoreX: data.scoreX,
            scoreY: data.scoreY
          };
        });
      }
    };
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Sanitize NaN values once before posting to worker
  const getSafeState = useCallback((): AppState => {
    const safe = { ...state };
    for (const key in safe) {
      const k = key as keyof AppState;
      if (typeof safe[k] === 'number' && isNaN(safe[k] as number)) {
        (safe as Record<string, unknown>)[k] = defaultState[k];
      }
    }
    return safe;
  }, [state]);

  // Instant PSD update for smooth graph interaction
  useEffect(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'PSD', state: getSafeState() });
    }
  }, [getSafeState]);

  // Debounced SHAPERS update for heavy math
  useEffect(() => {
    if (workerRef.current) {
      const handler = setTimeout(() => {
        workerRef.current?.postMessage({ type: 'SHAPERS', state: getSafeState() });
      }, 150);
      return () => clearTimeout(handler);
    }
  }, [getSafeState]);

  const { predX = 0, predY = 0, compX = { belt: 0, frame: 0, motor: 0 }, compY = { belt: 0, frame: 0, motor: 0 }, freqs = new Float64Array(0), psdX = new Float64Array(0), psdY = new Float64Array(0), psdX_nozzle = new Float64Array(0), psdY_nozzle = new Float64Array(0), scoreX = { results: {}, best_shaper: '' }, scoreY = { results: {}, best_shaper: '' } } = workerResult || {};

  const chartData = useMemo(() => {
    if (!workerResult) return { labels: [], datasets: [] };
    const centerFreq = viewAxis === 'x' ? predX : predY;
    const psd = viewAxis === 'x' ? psdX : psdY;
    const psdNozzle = viewAxis === 'x' ? psdX_nozzle : psdY_nozzle;
    const recommendedShaper = viewAxis === 'x' ? scoreX.best_shaper : scoreY.best_shaper;
    const activeShaper = selectedShaper === 'recommended' ? recommendedShaper : selectedShaper;

    if (graphMode === 'step') {
      const score = viewAxis === 'x' ? scoreX : scoreY;
      const shaperFunc = SHAPERS[activeShaper];
      const shaperFreq = score?.results?.[activeShaper]?.freq ?? centerFreq;
      const shaper = shaperFunc ? shaperFunc(shaperFreq, DEFAULT_DAMPING_RATIO) : null;
      const { times, unshaped, shaped: shapedResponse } = generate_step_responses(centerFreq, state.dampingRatio, shaper, 0.250, 0.0005);
      const timeMs = Array.from(times, t => t * 1000);

      const datasets = [
        {
          label: 'Unshaped Step Response',
          data: timeMs.map((t, i) => ({ x: t, y: unshaped[i] })),
          borderColor: '#ffffff',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
        }
      ];
      
      datasets.push({
        label: `Shaped (${shaperNames[activeShaper] || activeShaper})`,
        data: timeMs.map((t, i) => ({ x: t, y: shapedResponse[i] })),
        borderColor: colors[activeShaper] || '#00ff66',
        borderWidth: 3,
        borderDash: [],
        fill: false,
        pointRadius: 0,
      });

      return { labels: [], datasets };
    } else {
      const datasets: any[] = [
        {
          label: `ADXL PSD (${viewAxis.toUpperCase()})`,
          data: Array.from(freqs).map((f, i) => ({ x: f, y: psd[i] })),
          borderColor: 'rgba(255, 255, 255, 0.4)',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          fill: true,
          pointRadius: 0,
          borderWidth: 1,
          borderDash: [2, 2],
        },
        {
          label: `Actual Nozzle PSD (${viewAxis.toUpperCase()})`,
          data: Array.from(freqs).map((f, i) => ({ x: f, y: psdNozzle[i] })),
          borderColor: '#ffffff',
          fill: false,
          pointRadius: 0,
          borderWidth: 2,
        }
      ];

      if (snapshotData) {
        const snapPsd = viewAxis === 'x' ? snapshotData.psdX : snapshotData.psdY;
        datasets.push({
          label: `Snapshot (${viewAxis.toUpperCase()})`,
          data: Array.from(snapshotData.freqs).map((f, i) => ({ x: f, y: snapPsd[i] })),
          borderColor: '#888888',
          borderWidth: 1.5,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
        });
      }

      // CSV overlays — normalize each to the simulated PSD peak so frequency
      // shapes compare directly regardless of unit differences.
      let simMax = 0;
      for (let i = 0; i < psd.length; i++) if (psd[i] > simMax) simMax = psd[i];

      csvOverlays
        .filter(o => o.axis === 'both' || o.axis === viewAxis)
        .forEach((overlay, idx) => {
          let csvMax = 0;
          for (let i = 0; i < overlay.psd.length; i++) if (overlay.psd[i] > csvMax) csvMax = overlay.psd[i];
          const scale = simMax > 0 && csvMax > 0 ? simMax / csvMax : 1;
          datasets.push({
            label: overlay.label,
            data: Array.from(overlay.freqs, (f, i) => ({ x: f, y: overlay.psd[i] * scale })),
            borderColor: CSV_COLORS[idx % CSV_COLORS.length],
            borderWidth: 2,
            borderDash: [],
            fill: false,
            pointRadius: 0,
          });
        });

      const score = viewAxis === 'x' ? scoreX : scoreY;
      Object.keys(SHAPERS).forEach(shaperName => {
        // Only compute the active shaper eagerly; other shapers start hidden
        if (shaperName !== activeShaper) {
          datasets.push({
            label: shaperNames[shaperName],
            data: [],
            borderColor: colors[shaperName],
            borderWidth: 1.5,
            borderDash: [3, 3],
            fill: false,
            pointRadius: 0,
            hidden: true,
          });
          return;
        }

        const shaperFunc = SHAPERS[shaperName];
        const shaperFreq = score?.results?.[shaperName]?.freq ?? centerFreq;
        const shaper = shaperFunc(shaperFreq, DEFAULT_DAMPING_RATIO);
        const response = estimate_shaper(shaper, state.dampingRatio, freqs);
        const smoothedPsd = new Float64Array(psdNozzle.length);
        for (let i = 0; i < psdNozzle.length; i++) smoothedPsd[i] = psdNozzle[i] * response[i];
        
        datasets.push({
          label: `After shaper (${shaperNames[shaperName]}) — nozzle`,
          data: Array.from(freqs).map((f, i) => ({ x: f, y: smoothedPsd[i] })),
          borderColor: '#00ffff',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
        });
      });

      return { labels: [], datasets };
    }
  }, [state.dampingRatio, workerResult, graphMode, selectedShaper, viewAxis, snapshotData, csvOverlays]);

  const chartOptions = useMemo(() => {
    const isStep = graphMode === 'step';
    
    // Calculate Matplotlib-style scientific exponent for the Y-axis
    let psdExponent = 0;
    if (!isStep) {
      const activePsd = viewAxis === 'x' ? psdX : psdY;
      let maxVal = 0;
      for (let i = 0; i < activePsd.length; i++) {
        if (activePsd[i] > maxVal) maxVal = activePsd[i] as number;
      }
      if (maxVal > 0) {
        psdExponent = Math.floor(Math.log10(maxVal));
      }
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            color: 'rgba(255, 255, 255, 0.9)',
            usePointStyle: true,
            padding: 20,
            font: { size: 13, weight: 500 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              const yVal = context.parsed.y;
              if (isStep) return `${context.dataset.label}: ${yVal.toFixed(3)}`;
              return `${context.dataset.label}: ${yVal.toExponential(2)}`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear' as const,
          title: { display: true, text: isStep ? 'Time (ms)' : 'Frequency (Hz)', color: 'rgba(255, 255, 255, 0.9)', font: { weight: 'bold' as const } },
          max: isStep ? undefined : state.maxX,
          ticks: { maxTicksLimit: isStep ? 20 : undefined, color: 'rgba(255, 255, 255, 0.7)' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          title: { 
              display: true, 
              text: isStep ? 'Position (Step Response)' : `Power spectral density (1e${psdExponent})`,
              color: 'rgba(255, 255, 255, 0.9)', font: { weight: 'bold' as const }
          },
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: 'rgba(255, 255, 255, 0.7)',
            callback: function(value: any) {
              if (isStep) return value.toFixed(2);
              if (value === 0) return '0.0';
              
              // Matplotlib style: value divided by the global axis exponent
              return (value / Math.pow(10, psdExponent)).toFixed(1);
            }
          }
        }
      }
    };
  }, [state.maxX, graphMode, viewAxis, psdX, psdY]);

  const chartParamsRef = useRef({ predX, predY, viewAxis, psdX, psdY, graphMode });
  chartParamsRef.current = { predX, predY, viewAxis, psdX, psdY, graphMode };

  const plugins = useMemo(() => {
    return [{
      id: 'verticalLines',
      beforeDraw: (chart: any) => {
        const { predX, predY, viewAxis, psdX, psdY, graphMode } = chartParamsRef.current;
        if (graphMode === 'step') return;
        const ctx = chart.ctx;
        const xAxis = chart.scales.x;
        const yAxis = chart.scales.y;
        
        const drawLine = (val: number, color: string, text: string) => {
            const xPos = xAxis.getPixelForValue(val);
            if (xPos < xAxis.left || xPos > xAxis.right) return;
            
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(xPos, yAxis.top);
            ctx.lineTo(xPos, yAxis.bottom);
            ctx.lineWidth = 2;
            ctx.strokeStyle = color;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            
            ctx.fillStyle = color;
            ctx.font = '12px Inter';
            ctx.fillText(`${text} (${val.toFixed(1)} Hz)`, xPos + 5, yAxis.top + 15);
            ctx.restore();
        };

        const drawHorizontalLine = (yValue: number, color: string, text: string) => {
            const yPos = yAxis.getPixelForValue(yValue);
            if (yPos < yAxis.top || yPos > yAxis.bottom) return;
            
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(xAxis.left, yPos);
            ctx.lineTo(xAxis.right, yPos);
            ctx.lineWidth = 1;
            ctx.strokeStyle = color;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            
            ctx.fillStyle = color;
            ctx.font = '11px Inter';
            ctx.fillText(text, xAxis.right - 110, yPos - 6);
            ctx.restore();
        };

        if (viewAxis === 'x') {
            drawLine(predX, '#ff3366', 'Pred X');
        } else {
            drawLine(predY, '#00f0ff', 'Pred Y');
        }

        let maxPsd = 0;
        const psdData = viewAxis === 'x' ? psdX : psdY;
        if (psdData) {
            for (let i = 0; i < psdData.length; i++) {
                if (psdData[i] > maxPsd) maxPsd = psdData[i];
            }
        }
        const threshold = maxPsd > 0 ? maxPsd / 20.0 : 5000;
        drawHorizontalLine(threshold, 'rgba(255, 60, 60, 0.6)', 'Vibration Threshold');
      }
    }];
  }, [predX, predY, viewAxis, graphMode, psdX, psdY]);

  const klipperConsoleOutput = useMemo(() => {
    if (!workerResult || !scoreX.best_shaper || !scoreY.best_shaper) return 'Calculating shaper recommendations...';
    const displayAccel = (a: number) => Math.round(a / 100.0) * 100.0;
    
    let out = `Calculating shaper recommendations based on ADXL PSD (Klipper-compatible).\nThe 'After shaper' graph overlay shows predicted nozzle vibration after shaping.\n\n`;
    out += `========== X AXIS (${predX.toFixed(1)} Hz) ==========\n`;
    for (const s of Object.keys(shaperNames)) {
        const r = scoreX.results[s];
        out += `Fitted shaper '${s}' frequency = ${r.freq.toFixed(1)} Hz (vibrations = ${r.vibrations.toFixed(1)}%, smoothing ~= ${r.smoothing.toFixed(3)})\n`;
        out += `To avoid too much smoothing with '${s}', suggested max_accel <= ${displayAccel(r.max_accel)} mm/sec^2\n`;
    }
    const recX = scoreX.results[scoreX.best_shaper];
    out += `\nRecommended shaper is ${scoreX.best_shaper} @ ${recX.freq.toFixed(1)} Hz (Max Accel: ${displayAccel(recX.max_accel)} mm/s²)\n\n`;

    out += `========== Y AXIS (${predY.toFixed(1)} Hz) ==========\n`;
    for (const s of Object.keys(shaperNames)) {
        const r = scoreY.results[s];
        out += `Fitted shaper '${s}' frequency = ${r.freq.toFixed(1)} Hz (vibrations = ${r.vibrations.toFixed(1)}%, smoothing ~= ${r.smoothing.toFixed(3)})\n`;
        out += `To avoid too much smoothing with '${s}', suggested max_accel <= ${displayAccel(r.max_accel)} mm/sec^2\n`;
    }
    const recY = scoreY.results[scoreY.best_shaper];
    out += `\nRecommended shaper is ${scoreY.best_shaper} @ ${recY.freq.toFixed(1)} Hz (Max Accel: ${displayAccel(recY.max_accel)} mm/s²)\n`;
    
    return out;
  }, [predX, predY, scoreX, scoreY]);

  return (
    <div className="app-container">
      <Sidebar 
        state={state} 
        updateState={updateState} 
        resetToDefault={resetToDefault}
        profiles={Object.keys(profiles)}
        saveProfile={saveProfile}
        loadProfile={loadProfile}
        deleteProfile={deleteProfile}
      />
      
      <main className="main-content">
        <header className="top-nav">
          <div className="top-nav-title">
            <h1>Predicted ADXL Resonance</h1>
            <p>Power Spectral Density Simulation</p>
          </div>
          <div className="top-nav-controls">
            <div className="toggle-group small-padding">
              {snapshotData ? (
                <button className="nav-btn nav-btn-clear" onClick={() => setSnapshotData(null)}>
                  <XCircle weight="bold" /> Clear
                </button>
              ) : (
                <button className="nav-btn nav-btn-snapshot" onClick={() => {
                  if (workerResult) {
                    setSnapshotData({
                      psdX: new Float64Array(workerResult.psdX),
                      psdY: new Float64Array(workerResult.psdY),
                      freqs: new Float64Array(workerResult.freqs)
                    });
                  }
                }}>
                  <Camera weight="bold" /> Snapshot
                </button>
              )}
            </div>

            <div className="toggle-group small-padding">
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                multiple
                style={{ display: 'none' }}
                onChange={handleCsvImport}
              />
              <button className="nav-btn nav-btn-snapshot" onClick={() => csvInputRef.current?.click()}>
                <FileArrowUpIcon weight="bold" /> Import CSV
              </button>
              {csvOverlays.map((o, idx) => (
                <button
                  key={o.id}
                  className="nav-btn nav-btn-clear"
                  style={{ borderColor: CSV_COLORS[idx % CSV_COLORS.length], color: CSV_COLORS[idx % CSV_COLORS.length] }}
                  onClick={() => removeCsvOverlay(o.id)}
                  title={`Remove ${o.label}`}
                >
                  <XCircleIcon weight="bold" /> {o.label}
                </button>
              ))}
            </div>

            <div className="toggle-group">
              <span className="toggle-label">Graph Mode:</span>
              <select className="toggle-select" value={graphMode} onChange={e => setGraphMode(e.target.value as any)}>
                <option value="psd">Frequency (PSD)</option>
                <option value="step">Time (Step Response)</option>
              </select>
            </div>

            {graphMode === 'step' && (
              <div className="toggle-group">
                <span className="toggle-label">Shaper:</span>
                <select className="toggle-select" value={selectedShaper} onChange={e => setSelectedShaper(e.target.value)}>
                  <option value="recommended">Recommended Best</option>
                  <option value="zv">ZV</option>
                  <option value="mzv">MZV</option>
                  <option value="ei">EI</option>
                  <option value="2hump_ei">2HUMP_EI</option>
                  <option value="3hump_ei">3HUMP_EI</option>
                </select>
              </div>
            )}

            <div className="toggle-group">
              <span className="toggle-label">View Axis:</span>
              <select className="toggle-select" value={viewAxis} onChange={e => setViewAxis(e.target.value as 'x'|'y')}>
                <option value="x">X Axis</option>
                <option value="y">Y Axis</option>
              </select>
            </div>
          </div>
        </header>
        
        <ChartDisplay data={chartData} options={chartOptions} plugins={plugins}>
          <DraggableOverlay defaultPosition={{ top: 24, right: 24 }}>
            <div className="prediction-box mt-0">
              <h4>Predicted Resonance</h4>
              <div className="prediction-freq-list">
                <div className="prediction-item">
                  <span className="axis-label">X Axis</span>
                  <span className="freq-val">{predX.toFixed(1)} Hz</span>
                  {compX && compX.belt > 0 && (
                    <div className="compliance-bar-container">
                      <div className="compliance-bar">
                        <div className="compliance-segment belt" style={{ width: `${compX.belt}%` }} title={`Belt: ${compX.belt.toFixed(1)}%`}></div>
                        <div className="compliance-segment motor" style={{ width: `${compX.motor}%` }} title={`Motor: ${compX.motor.toFixed(1)}%`}></div>
                        <div className="compliance-segment frame" style={{ width: `${compX.frame}%` }} title={`Frame: ${compX.frame.toFixed(1)}%`}></div>
                      </div>
                      <div className="compliance-labels">
                        <span className="label-belt">Belt</span>
                        <span className="label-motor">Motor</span>
                        <span className="label-frame">Frame</span>
                      </div>
                    </div>
                  )}
                  {scoreX?.best_shaper && (
                    <div className="shaper-detail">
                      {Math.round(scoreX.results[scoreX.best_shaper].max_accel / 100.0) * 100.0} mm/s² | {scoreX.best_shaper}
                    </div>
                  )}
                </div>
                <div className="prediction-item">
                  <span className="axis-label">Y Axis</span>
                  <span className="freq-val">{(predY || 0).toFixed(1)} Hz</span>
                  {compY && compY.belt > 0 && (
                    <div className="compliance-bar-container">
                      <div className="compliance-bar">
                        <div className="compliance-segment belt" style={{ width: `${compY.belt}%` }} title={`Belt: ${compY.belt.toFixed(1)}%`}></div>
                        <div className="compliance-segment motor" style={{ width: `${compY.motor}%` }} title={`Motor: ${compY.motor.toFixed(1)}%`}></div>
                        <div className="compliance-segment frame" style={{ width: `${compY.frame}%` }} title={`Frame: ${compY.frame.toFixed(1)}%`}></div>
                      </div>
                      <div className="compliance-labels">
                        <span className="label-belt">Belt</span>
                        <span className="label-motor">Motor</span>
                        <span className="label-frame">Frame</span>
                      </div>
                    </div>
                  )}
                  {scoreY?.best_shaper && (
                    <div className="shaper-detail">
                      {Math.round(scoreY.results[scoreY.best_shaper].max_accel / 100.0) * 100.0} mm/s² | {scoreY.best_shaper}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DraggableOverlay>
        </ChartDisplay>

        <div className="bottom-panels">
          <div className="panel">
            <h3><Info /> About the Math & Attribution</h3>
            <p>This simulator runs a Javascript port of Klipper's internal <code>shaper_calibrate.py</code> math in real-time. The chart shows the maximum acceleration each shaper can sustain before it introduces too much smoothing (defined by the Smoothing Threshold) into your prints.</p>
            <p className="license-text">
              <strong>License & Attribution:</strong> This simulator is open-source and licensed under the <a href="https://github.com/Jumpybeetroot/shaper-sim/blob/main/LICENSE" target="_blank">GNU GPLv3 License</a>. The Input Shaper frequency response and scoring algorithms are mathematically ported directly from the source code of <a href="https://github.com/Klipper3d/klipper" target="_blank">Klipper3d</a>.
            </p>
          </div>
          <div className="panel">
            <h3><WarningCircle /> Predictive Mode</h3>
            <p>The mechanical predictions are rough estimates based on a simplified mass-spring system <em>f = 1/(2π) √(K/M)</em>. Actual results will vary. Always use an ADXL345 accelerometer for precise tuning.</p>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">Simulated Klipper Output</h2>
          <pre className="klipper-console">{klipperConsoleOutput}</pre>
        </div>
      </main>
    </div>
  );
}

function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWrapper;
