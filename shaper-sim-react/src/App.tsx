import { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChartDisplay } from './components/ChartDisplay';
import { DraggableOverlay } from './components/DraggableOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import { defaultState } from './types';
import type { AppState } from './types';
import { parseKlipperCsv } from './lib/csvOverlay';
import type { CsvOverlay } from './lib/csvOverlay';
import { SHAPERS, DEFAULT_DAMPING_RATIO, estimate_shaper, generate_step_responses } from './lib/shaperLogic';
import type { ShaperScore, ShaperScoringMode } from './lib/shaperLogic';
import { sanitizeAppState, sanitizeProfiles } from './lib/stateSanitizer';
import { Info, WarningCircle, Camera, XCircle, XCircleIcon, FileArrowUpIcon } from '@phosphor-icons/react';
import type { ChartData, ChartOptions, Plugin, TooltipItem } from 'chart.js';

type GraphMode = 'psd' | 'step';
type ViewAxis = 'x' | 'y';
type ShaperScoreTarget = 'adxl' | 'nozzle';
type ChartPoint = { x: number; y: number };
type LineChartData = ChartData<'line', ChartPoint[], unknown>;
type ShaperScoreSet = { results: Record<string, ShaperScore>; best_shaper: string };
type WorkerResult = {
  predX: number;
  predY: number;
  staticPredX: number;
  staticPredY: number;
  compX: { belt: number; frame: number; motor: number };
  compY: { belt: number; frame: number; motor: number };
  freqs: Float64Array;
  psdX: Float64Array;
  psdY: Float64Array;
  psdX_nozzle: Float64Array;
  psdY_nozzle: Float64Array;
  psdX_nozzle_structural: Float64Array;
  psdY_nozzle_structural: Float64Array;
  scoreX: ShaperScoreSet;
  scoreY: ShaperScoreSet;
  scoringMode: ShaperScoringMode;
  nozzleScoreX?: ShaperScoreSet;
  nozzleScoreY?: ShaperScoreSet;
  nozzleScoringMode?: ShaperScoringMode;
};
type ChartPluginParams = {
  predX: number;
  predY: number;
  viewAxis: ViewAxis;
  psdX: Float64Array;
  psdY: Float64Array;
  graphMode: GraphMode;
};
type WorkerMessage =
  | {
      type: 'PSD';
      requestId: number;
      predX: number;
      predY: number;
      staticPredX: number;
      staticPredY: number;
      compX: { belt: number; frame: number; motor: number };
      compY: { belt: number; frame: number; motor: number };
      freqs: Float64Array;
      psdX: Float64Array;
      psdY: Float64Array;
      psdX_nozzle: Float64Array;
      psdY_nozzle: Float64Array;
      psdX_nozzle_structural: Float64Array;
      psdY_nozzle_structural: Float64Array;
    }
  | {
      type: 'SHAPERS';
      requestId: number;
      scoringMode: ShaperScoringMode;
      scoreTarget: ShaperScoreTarget;
      psdRequestId: number;
      scoreX: ShaperScoreSet;
      scoreY: ShaperScoreSet;
    };
type ShaperWorkerMessage = Extract<WorkerMessage, { type: 'SHAPERS' }>;

const MAX_CHART_POINTS = 1200;
const emptyScoreSet = (): ShaperScoreSet => ({ results: {}, best_shaper: '' });

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

const CSV_COLORS = ['#ff9900', '#ff44aa', '#44ffcc', '#bb44ff', '#ffff44', '#44aaff'];

function formatAccelLimit(maxAccel: number): string {
  return `${(Math.round(maxAccel / 100.0) * 100.0).toLocaleString()} mm/s²`;
}

function renderShaperDetail(scoreSet: ShaperScoreSet) {
  const shaper = scoreSet.best_shaper;
  const result = shaper ? scoreSet.results[shaper] : undefined;

  if (!result) {
    return <div className="shaper-detail">Calculating...</div>;
  }

  return (
    <div className="shaper-detail shaper-detail-card">
      <div className="shaper-detail-primary">
        {shaperNames[shaper] ?? shaper.toUpperCase()} @ {result.freq.toFixed(1)} Hz
      </div>
      <div className="shaper-detail-metrics">
        <span className="shaper-metric-label">Smooth limit</span>
        <span className="shaper-metric-value">{formatAccelLimit(result.max_accel)}</span>
        <span className="shaper-metric-label">Residual vib</span>
        <span className="shaper-metric-value">{result.vibrations.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function toChartPoints(freqs: Float64Array, values: ArrayLike<number>, maxPoints = MAX_CHART_POINTS): ChartPoint[] {
  if (freqs.length <= maxPoints || maxPoints < 6) {
    return Array.from(freqs, (f, i) => ({ x: f, y: values[i] }));
  }

  const targetBuckets = Math.max(1, Math.floor(maxPoints / 3));
  const bucketSize = Math.ceil(freqs.length / targetBuckets);
  const points: ChartPoint[] = [];

  for (let start = 0; start < freqs.length; start += bucketSize) {
    const end = Math.min(freqs.length, start + bucketSize);
    let maxIndex = start;
    for (let i = start + 1; i < end; i++) {
      if (values[i] > values[maxIndex]) maxIndex = i;
    }

    for (const idx of [start, maxIndex, end - 1]) {
      const lastPoint = points[points.length - 1];
      if (!lastPoint || lastPoint.x !== freqs[idx]) {
        points.push({ x: freqs[idx], y: values[idx] });
      }
    }
  }

  return points;
}

function peakInfo(freqs: Float64Array, values: Float64Array): { freq: number; value: number } {
  let peakValue = 0;
  let peakFreq = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] > peakValue) {
      peakValue = values[i];
      peakFreq = freqs[i] ?? 0;
    }
  }
  return { freq: peakFreq, value: peakValue };
}

function secondaryDeltaInfo(
  freqs: Float64Array,
  baseValues: Float64Array,
  measuredValues: Float64Array,
  centerFreq: number
): { freq: number; ratio: number } {
  let basePeak = 0;
  for (let i = 0; i < baseValues.length; i++) {
    if (baseValues[i] > basePeak) basePeak = baseValues[i];
  }
  if (basePeak <= 0 || centerFreq <= 0) return { freq: 0, ratio: 0 };

  let maxDelta = 0;
  let maxDeltaFreq = 0;
  const low = centerFreq * 1.08;
  const high = centerFreq * 1.55;
  for (let i = 0; i < measuredValues.length; i++) {
    const f = freqs[i];
    if (f < low || f > high) continue;
    const delta = measuredValues[i] - baseValues[i];
    if (delta > maxDelta) {
      maxDelta = delta;
      maxDeltaFreq = f;
    }
  }
  return { freq: maxDeltaFreq, ratio: maxDelta / basePeak };
}

function loadSavedState(): AppState {
  const saved = localStorage.getItem('shaperSim_state');
  if (!saved) return sanitizeAppState(defaultState);
  try {
    return sanitizeAppState(JSON.parse(saved));
  } catch {
    return sanitizeAppState(defaultState);
  }
}

function loadSavedProfiles(): Record<string, AppState> {
  const saved = localStorage.getItem('shaperSim_profiles');
  if (!saved) return {};
  try {
    return sanitizeProfiles(JSON.parse(saved));
  } catch {
    return {};
  }
}

function App() {
  const [state, setState] = useState<AppState>(loadSavedState);
  const [graphMode, setGraphMode] = useState<GraphMode>('psd');
  const [viewAxis, setViewAxis] = useState<ViewAxis>('x');
  const [selectedShaper, setSelectedShaper] = useState<string>('recommended');
  const [recommendationSource, setRecommendationSource] = useState<ShaperScoreTarget>('adxl');
  const [exactPending, setExactPending] = useState(false);
  const [nozzlePending, setNozzlePending] = useState(false);
  
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
    const handler = setTimeout(() => {
      localStorage.setItem('shaperSim_state', JSON.stringify(state));
    }, 300);
    return () => clearTimeout(handler);
  }, [state]);

  const [profiles, setProfiles] = useState<Record<string, AppState>>(loadSavedProfiles);

  const saveProfile = useCallback((name: string) => {
    setProfiles(prev => {
        const newProfiles = sanitizeProfiles({ ...prev, [name]: state });
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
        setState(sanitizeAppState(profiles[name]));
    }
  }, [profiles]);

  const updateState = useCallback((key: keyof AppState, value: number | boolean | string) => {
    setState(prev => sanitizeAppState({ ...prev, [key]: value }));
  }, []);

  const resetToDefault = useCallback(() => {
    if (window.confirm('Reset all simulation parameters to defaults?')) {
      setState(sanitizeAppState(defaultState));
    }
  }, []);

  const [workerResult, setWorkerResult] = useState<WorkerResult | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const psdRequestIdRef = useRef(0);
  const latestPsdResultIdRef = useRef(0);
  const shaperRequestIdRef = useRef(0);
  const pendingShaperMessageRef = useRef<ShaperWorkerMessage | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./lib/shaper.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const data = e.data;
      const applyShaperMessage = (message: ShaperWorkerMessage) => {
        setExactPending(false);
        setNozzlePending(false);
        if (message.scoreTarget === 'nozzle') setRecommendationSource('nozzle');
        setWorkerResult(prev => {
          if (!prev) return null;
          if (message.scoreTarget === 'nozzle') {
            return {
              ...prev,
              nozzleScoreX: message.scoreX,
              nozzleScoreY: message.scoreY,
              nozzleScoringMode: message.scoringMode
            };
          }
          return {
            ...prev,
            scoreX: message.scoreX,
            scoreY: message.scoreY,
            scoringMode: message.scoringMode
          };
        });
      };

      if (data.type === 'PSD') {
        if (data.requestId !== psdRequestIdRef.current) return;
        latestPsdResultIdRef.current = data.requestId;
        setWorkerResult(prev => ({
          ...prev,
          predX: data.predX,
          predY: data.predY,
          staticPredX: data.staticPredX,
          staticPredY: data.staticPredY,
          compX: data.compX,
          compY: data.compY,
          freqs: data.freqs,
          psdX: data.psdX,
          psdY: data.psdY,
          psdX_nozzle: data.psdX_nozzle,
          psdY_nozzle: data.psdY_nozzle,
          psdX_nozzle_structural: data.psdX_nozzle_structural,
          psdY_nozzle_structural: data.psdY_nozzle_structural,
          scoreX: emptyScoreSet(),
          scoreY: emptyScoreSet(),
          scoringMode: 'interactive',
          nozzleScoreX: undefined,
          nozzleScoreY: undefined,
          nozzleScoringMode: undefined
        }));
        const pending = pendingShaperMessageRef.current;
        if (pending && pending.psdRequestId === data.requestId && pending.requestId === shaperRequestIdRef.current) {
          pendingShaperMessageRef.current = null;
          applyShaperMessage(pending);
        }
      } else if (data.type === 'SHAPERS') {
        if (data.requestId !== shaperRequestIdRef.current) return;
        if (data.psdRequestId !== latestPsdResultIdRef.current) {
          if (data.psdRequestId === psdRequestIdRef.current) {
            pendingShaperMessageRef.current = data;
          }
          return;
        }
        applyShaperMessage(data);
      }
    };
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const getSafeState = useCallback((): AppState => {
    return sanitizeAppState(state);
  }, [state]);

  // Instant PSD update for smooth graph interaction
  useEffect(() => {
    if (workerRef.current) {
      const requestId = ++psdRequestIdRef.current;
      shaperRequestIdRef.current += 1;
      pendingShaperMessageRef.current = null;
      setExactPending(false);
      setNozzlePending(false);
      setRecommendationSource('adxl');
      setWorkerResult(prev => prev ? {
        ...prev,
        scoreX: emptyScoreSet(),
        scoreY: emptyScoreSet(),
        scoringMode: 'interactive',
        nozzleScoreX: undefined,
        nozzleScoreY: undefined,
        nozzleScoringMode: undefined
      } : prev);
      workerRef.current.postMessage({ type: 'PSD', requestId, state: getSafeState() });
    }
  }, [getSafeState]);

  // Debounced SHAPERS update for heavy math. Keep this long enough that
  // slider drags update PSD immediately without queueing repeated rescoring.
  useEffect(() => {
    if (workerRef.current) {
      const handler = setTimeout(() => {
        const requestId = ++shaperRequestIdRef.current;
        setExactPending(false);
        setNozzlePending(false);
        workerRef.current?.postMessage({ type: 'SHAPERS', requestId, psdRequestId: psdRequestIdRef.current, state: getSafeState(), scoringMode: 'interactive', scoreTarget: 'adxl' });
      }, 600);
      return () => clearTimeout(handler);
    }
  }, [getSafeState]);

  const runExactScoring = useCallback(() => {
    if (!workerRef.current) return;
    const requestId = ++shaperRequestIdRef.current;
    setExactPending(true);
    setNozzlePending(false);
    setRecommendationSource('adxl');
    workerRef.current.postMessage({ type: 'SHAPERS', requestId, psdRequestId: psdRequestIdRef.current, state: getSafeState(), scoringMode: 'exact', scoreTarget: 'adxl' });
  }, [getSafeState]);

  const runNozzleScoring = useCallback(() => {
    if (!workerRef.current) return;
    const requestId = ++shaperRequestIdRef.current;
    setNozzlePending(true);
    setExactPending(false);
    workerRef.current.postMessage({ type: 'SHAPERS', requestId, psdRequestId: psdRequestIdRef.current, state: getSafeState(), scoringMode: 'interactive', scoreTarget: 'nozzle' });
  }, [getSafeState]);

  const { predX = 0, predY = 0, staticPredX = predX, staticPredY = predY, compX = { belt: 0, frame: 0, motor: 0 }, compY = { belt: 0, frame: 0, motor: 0 }, freqs = new Float64Array(0), psdX = new Float64Array(0), psdY = new Float64Array(0), psdX_nozzle = new Float64Array(0), psdY_nozzle = new Float64Array(0), psdX_nozzle_structural = psdX_nozzle, psdY_nozzle_structural = psdY_nozzle, scoreX = emptyScoreSet(), scoreY = emptyScoreSet(), scoringMode = 'interactive', nozzleScoreX, nozzleScoreY, nozzleScoringMode = 'interactive' } = workerResult || {};
  const hasNozzleScores = !!nozzleScoreX?.best_shaper && !!nozzleScoreY?.best_shaper;
  const activeScoreX = recommendationSource === 'nozzle' && nozzleScoreX ? nozzleScoreX : scoreX;
  const activeScoreY = recommendationSource === 'nozzle' && nozzleScoreY ? nozzleScoreY : scoreY;
  const activeScoringMode = recommendationSource === 'nozzle' ? nozzleScoringMode : scoringMode;
  const hasActiveScores = !!activeScoreX.best_shaper && !!activeScoreY.best_shaper;

  const chartData = useMemo<LineChartData>(() => {
    if (!workerResult) return { labels: [], datasets: [] };
    const centerFreq = viewAxis === 'x' ? predX : predY;
    const psd = viewAxis === 'x' ? psdX : psdY;
    const psdNozzle = viewAxis === 'x' ? psdX_nozzle : psdY_nozzle;
    const psdNozzleStructural = viewAxis === 'x' ? psdX_nozzle_structural : psdY_nozzle_structural;
    const recommendedShaper = viewAxis === 'x' ? activeScoreX.best_shaper : activeScoreY.best_shaper;
    const activeShaper = selectedShaper === 'recommended' ? recommendedShaper : selectedShaper;

    if (graphMode === 'step') {
      const score = viewAxis === 'x' ? activeScoreX : activeScoreY;
      const shaperFunc = SHAPERS[activeShaper];
      const shaperFreq = score?.results?.[activeShaper]?.freq ?? centerFreq;
      const shaper = shaperFunc ? shaperFunc(shaperFreq, DEFAULT_DAMPING_RATIO) : null;
      const { times, unshaped, shaped: shapedResponse } = generate_step_responses(centerFreq, state.dampingRatio, shaper, 0.250, 0.0005);
      const timeMs = Array.from(times, t => t * 1000);

      const datasets: LineChartData['datasets'] = [
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
      const datasets: LineChartData['datasets'] = [
        {
          label: `ADXL PSD (${viewAxis.toUpperCase()})`,
          data: toChartPoints(freqs, psd),
          borderColor: 'rgba(255, 255, 255, 0.4)',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          fill: true,
          pointRadius: 0,
          borderWidth: 1,
          borderDash: [2, 2],
        },
        {
          label: `Actual Nozzle PSD (${viewAxis.toUpperCase()})`,
          data: toChartPoints(freqs, psdNozzle),
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
          data: toChartPoints(snapshotData.freqs, snapPsd),
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
          const scaledPsd = new Float64Array(overlay.psd.length);
          for (let i = 0; i < overlay.psd.length; i++) scaledPsd[i] = overlay.psd[i] * scale;
          datasets.push({
            label: overlay.label,
            data: toChartPoints(overlay.freqs, scaledPsd),
            borderColor: CSV_COLORS[idx % CSV_COLORS.length],
            borderWidth: 2,
            borderDash: [],
            fill: false,
            pointRadius: 0,
          });
        });

      const score = viewAxis === 'x' ? activeScoreX : activeScoreY;
      if (score.best_shaper) {
        Object.keys(SHAPERS).forEach(shaperName => {
          const isActive = shaperName === activeShaper;
          const shaperFunc = SHAPERS[shaperName];
          const shaperFreq = score.results[shaperName]?.freq ?? centerFreq;
          const shaper = shaperFunc(shaperFreq, DEFAULT_DAMPING_RATIO);
          const response = estimate_shaper(shaper, state.dampingRatio, freqs);
          const smoothedPsd = new Float64Array(psdNozzle.length);
          for (let i = 0; i < psdNozzle.length; i++) {
            const structural = psdNozzleStructural[i] ?? 0;
            const operating = psdNozzle[i] ?? 0;
            const speedOnly = Math.max(0, operating - structural);
            smoothedPsd[i] = structural * response[i] + speedOnly;
          }
          
          datasets.push({
            label: `After ${recommendationSource === 'nozzle' ? 'nozzle diagnostic' : 'Klipper'} shaper (${shaperNames[shaperName]}) — nozzle`,
            data: toChartPoints(freqs, smoothedPsd),
            borderColor: isActive ? '#00ffff' : colors[shaperName],
            borderWidth: isActive ? 2.5 : 1.5,
            borderDash: isActive ? [5, 5] : [3, 3],
            fill: false,
            pointRadius: 0,
            hidden: !isActive,
          });
        });
      }

      return { labels: [], datasets };
    }
  }, [
    state.dampingRatio,
    workerResult,
    graphMode,
    selectedShaper,
    viewAxis,
    snapshotData,
    csvOverlays,
    predX,
    predY,
    psdX,
    psdY,
    psdX_nozzle,
    psdY_nozzle,
    psdX_nozzle_structural,
    psdY_nozzle_structural,
    activeScoreX,
    activeScoreY,
    recommendationSource,
    freqs
  ]);

  const chartOptions = useMemo<ChartOptions<'line'>>(() => {
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
      parsing: false,
      normalized: true,
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
            label: function(context: TooltipItem<'line'>) {
              const yVal = context.parsed.y;
              if (yVal === null) return `${context.dataset.label}: n/a`;
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
            callback: function(value: string | number) {
              const numericValue = typeof value === 'number' ? value : Number(value);
              if (!Number.isFinite(numericValue)) return String(value);
              if (isStep) return numericValue.toFixed(2);
              if (numericValue === 0) return '0.0';
              
              // Matplotlib style: value divided by the global axis exponent
              return (numericValue / Math.pow(10, psdExponent)).toFixed(1);
            }
          }
        }
      }
    };
  }, [state.maxX, graphMode, viewAxis, psdX, psdY]);

  const chartParamsRef = useRef<ChartPluginParams>({ predX, predY, viewAxis, psdX, psdY, graphMode });
  useLayoutEffect(() => {
    chartParamsRef.current = { predX, predY, viewAxis, psdX, psdY, graphMode };
  }, [predX, predY, viewAxis, psdX, psdY, graphMode]);

  const plugins = useMemo<Plugin<'line'>[]>(() => {
    return [{
      id: 'verticalLines',
      beforeDraw: (chart) => {
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
  }, []);

  const nozzleDiagnostics = useMemo(() => {
    if (!workerResult) return null;
    const xAdxl = peakInfo(freqs, psdX);
    const xNozzle = peakInfo(freqs, psdX_nozzle);
    const yAdxl = peakInfo(freqs, psdY);
    const yNozzle = peakInfo(freqs, psdY_nozzle);
    const xSecondary = secondaryDeltaInfo(freqs, psdX, psdX_nozzle, predX);
    const ySecondary = secondaryDeltaInfo(freqs, psdY, psdY_nozzle, predY);
    const ratio = (nozzle: number, adxl: number) => adxl > 0 ? nozzle / adxl : 0;
    return {
      xRatio: ratio(xNozzle.value, xAdxl.value),
      yRatio: ratio(yNozzle.value, yAdxl.value),
      xAdxlFreq: xAdxl.freq,
      xNozzleFreq: xNozzle.freq,
      yAdxlFreq: yAdxl.freq,
      yNozzleFreq: yNozzle.freq,
      xSecondaryRatio: xSecondary.ratio,
      xSecondaryFreq: xSecondary.freq,
      ySecondaryRatio: ySecondary.ratio,
      ySecondaryFreq: ySecondary.freq
    };
  }, [workerResult, freqs, predX, predY, psdX, psdY, psdX_nozzle, psdY_nozzle]);

  const klipperConsoleOutput = useMemo(() => {
    if (!workerResult || !hasActiveScores) return 'Calculating shaper recommendations...';
    const displayAccel = (a: number) => Math.round(a / 100.0) * 100.0;
    const modeLabel = activeScoringMode === 'exact'
      ? 'Exact Klipper-style exhaustive scan'
      : 'Fast interactive scan';
    const speedSuffix = state.enableDynamicSpeed ? ' standstill structural' : '';
    const sourceLabel = recommendationSource === 'nozzle'
      ? `NOZZLE DIAGNOSTIC${speedSuffix} PSD (not Klipper default)`
      : `ADXL${speedSuffix} PSD (Klipper default)`;
    
    let out = `${modeLabel} based on ${sourceLabel}.\nThe 'After shaper' graph overlay shows predicted nozzle vibration after shaping.\n`;
    if (state.enableDynamicSpeed) {
      out += `Speed simulation is displayed on the graph at ${state.printSpeed} mm/s; shaper scoring ignores belt-mesh forcing.\n`;
    }
    if (recommendationSource === 'nozzle') {
      out += `Klipper's default ADXL recommendations remain available; this output is an explicit nozzle what-if analysis.\n`;
    }
    const consolePredX = state.enableDynamicSpeed ? staticPredX : predX;
    const consolePredY = state.enableDynamicSpeed ? staticPredY : predY;
    out += `\n`;
    out += `========== X AXIS (${consolePredX.toFixed(1)} Hz) ==========\n`;
    for (const s of Object.keys(shaperNames)) {
        const r = activeScoreX.results[s];
        out += `Fitted shaper '${s}' frequency = ${r.freq.toFixed(1)} Hz (vibrations = ${r.vibrations.toFixed(1)}%, smoothing ~= ${r.smoothing.toFixed(3)})\n`;
        out += `To avoid too much smoothing with '${s}', suggested max_accel <= ${displayAccel(r.max_accel)} mm/sec^2\n`;
    }
    const recX = activeScoreX.results[activeScoreX.best_shaper];
    out += `\nRecommended shaper is ${activeScoreX.best_shaper} @ ${recX.freq.toFixed(1)} Hz (Max Accel: ${displayAccel(recX.max_accel)} mm/s²)\n`;
    if (recommendationSource === 'nozzle' && scoreX.best_shaper) {
      const adxlRecX = scoreX.results[scoreX.best_shaper];
      out += `Klipper ADXL baseline: ${scoreX.best_shaper} @ ${adxlRecX.freq.toFixed(1)} Hz\n`;
    }
    out += `\n`;

    out += `========== Y AXIS (${consolePredY.toFixed(1)} Hz) ==========\n`;
    for (const s of Object.keys(shaperNames)) {
        const r = activeScoreY.results[s];
        out += `Fitted shaper '${s}' frequency = ${r.freq.toFixed(1)} Hz (vibrations = ${r.vibrations.toFixed(1)}%, smoothing ~= ${r.smoothing.toFixed(3)})\n`;
        out += `To avoid too much smoothing with '${s}', suggested max_accel <= ${displayAccel(r.max_accel)} mm/sec^2\n`;
    }
    const recY = activeScoreY.results[activeScoreY.best_shaper];
    out += `\nRecommended shaper is ${activeScoreY.best_shaper} @ ${recY.freq.toFixed(1)} Hz (Max Accel: ${displayAccel(recY.max_accel)} mm/s²)\n`;
    if (recommendationSource === 'nozzle' && scoreY.best_shaper) {
      const adxlRecY = scoreY.results[scoreY.best_shaper];
      out += `Klipper ADXL baseline: ${scoreY.best_shaper} @ ${adxlRecY.freq.toFixed(1)} Hz\n`;
    }
    
    return out;
  }, [workerResult, hasActiveScores, predX, predY, staticPredX, staticPredY, scoreX, scoreY, activeScoreX, activeScoreY, activeScoringMode, recommendationSource, state.enableDynamicSpeed, state.printSpeed]);

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

            <div className="toggle-group small-padding">
              <button
                className="nav-btn nav-btn-snapshot"
                onClick={runExactScoring}
                disabled={exactPending}
                title="Run exhaustive Klipper-style shaper scan"
              >
                <WarningCircle weight="bold" /> {exactPending ? 'Exact...' : 'Exact Klipper'}
              </button>
              <button
                className="nav-btn nav-btn-snapshot"
                onClick={runNozzleScoring}
                disabled={nozzlePending}
                title="Run an explicit nozzle-based what-if recommendation"
              >
                <WarningCircle weight="bold" /> {nozzlePending ? 'Nozzle...' : 'Nozzle Recs'}
              </button>
              {recommendationSource === 'nozzle' && hasNozzleScores && (
                <button
                  className="nav-btn nav-btn-clear"
                  onClick={() => setRecommendationSource('adxl')}
                  title="Return to Klipper's default ADXL-based recommendations"
                >
                  <XCircle weight="bold" /> Use ADXL
                </button>
              )}
            </div>

            <div className="toggle-group">
              <span className="toggle-label">Graph Mode:</span>
              <select className="toggle-select" value={graphMode} onChange={e => setGraphMode(e.target.value as GraphMode)}>
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
              <select className="toggle-select" value={viewAxis} onChange={e => setViewAxis(e.target.value as ViewAxis)}>
                <option value="x">X Axis</option>
                <option value="y">Y Axis</option>
              </select>
            </div>
          </div>
        </header>
        
        <ChartDisplay data={chartData} options={chartOptions} plugins={plugins}>
          <DraggableOverlay defaultPosition={{ top: 24, right: 24 }}>
            <div className="prediction-box mt-0">
              <h4>{recommendationSource === 'nozzle' ? 'Nozzle Diagnostic Recs' : 'Klipper ADXL Recs'}</h4>
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
                        <span className="label-belt">Belt {Math.round(compX.belt)}%</span>
                        <span className="label-motor">Motor {Math.round(compX.motor)}%</span>
                        <span className="label-frame">Frame {Math.round(compX.frame)}%</span>
                      </div>
                    </div>
                  )}
                  {hasActiveScores ? renderShaperDetail(activeScoreX) : <div className="shaper-detail">Calculating...</div>}
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
                        <span className="label-belt">Belt {Math.round(compY.belt)}%</span>
                        <span className="label-motor">Motor {Math.round(compY.motor)}%</span>
                        <span className="label-frame">Frame {Math.round(compY.frame)}%</span>
                      </div>
                    </div>
                  )}
                  {hasActiveScores ? renderShaperDetail(activeScoreY) : <div className="shaper-detail">Calculating...</div>}
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
              <strong>License & Attribution:</strong> This simulator is open-source and licensed under the <a href="https://github.com/Jumpybeetroot/shaper-sim/blob/main/LICENSE" target="_blank" rel="noreferrer">GNU GPLv3 License</a>. The Input Shaper frequency response and scoring algorithms are mathematically ported directly from the source code of <a href="https://github.com/Klipper3d/klipper" target="_blank" rel="noreferrer">Klipper3d</a>.
            </p>
          </div>
          <div className="panel">
            <h3><WarningCircle /> Predictive Mode</h3>
            <p>The mechanical predictions are rough estimates based on a simplified mass-spring system <em>f = 1/(2π) √(K/M)</em>. Actual results will vary. Always use an ADXL345 accelerometer for precise tuning.</p>
          </div>
          <div className="panel">
            <h3><WarningCircle /> Nozzle Diagnostic</h3>
            {nozzleDiagnostics ? (
              <p>
                Klipper recommendations use ADXL PSD by default. Nozzle PSD peak ratios are X {nozzleDiagnostics.xRatio.toFixed(2)}x
                {' '}({nozzleDiagnostics.xNozzleFreq.toFixed(1)} Hz nozzle vs {nozzleDiagnostics.xAdxlFreq.toFixed(1)} Hz ADXL)
                and Y {nozzleDiagnostics.yRatio.toFixed(2)}x ({nozzleDiagnostics.yNozzleFreq.toFixed(1)} Hz nozzle vs {nozzleDiagnostics.yAdxlFreq.toFixed(1)} Hz ADXL).
                Secondary nozzle humps add X {(nozzleDiagnostics.xSecondaryRatio * 100).toFixed(0)}% near {nozzleDiagnostics.xSecondaryFreq.toFixed(1)} Hz
                and Y {(nozzleDiagnostics.ySecondaryRatio * 100).toFixed(0)}% near {nozzleDiagnostics.ySecondaryFreq.toFixed(1)} Hz relative to the ADXL primary peak.
                Use <strong>Nozzle Recs</strong> only as an explicit print-quality what-if.
              </p>
            ) : (
              <p>Nozzle diagnostics will appear after the first PSD calculation.</p>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">{recommendationSource === 'nozzle' ? 'Nozzle Diagnostic Output' : 'Simulated Klipper Output'}</h2>
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
