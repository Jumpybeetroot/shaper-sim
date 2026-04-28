import { predict_resonance, generate_psd_curve, scoreShapers, scoreShapersExact } from './shaperLogic';
import { getBeltDensity, getBeltTensionN } from './beltUtils';
import type { AppState } from '../types';
import type { ShaperScoringMode } from './shaperLogic';

interface WorkerRequest {
    type: 'PSD' | 'SHAPERS';
    requestId: number;
    state: AppState;
    scoringMode?: ShaperScoringMode;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
    const { type, requestId, state } = e.data;

    const beltDensity = getBeltDensity(state.beltType);
    const tensionN = getBeltTensionN(state.beltType, state.beltTune);

    const { f: predX, compliance: compX } = predict_resonance(
      state.toolheadWeight,
      state.beltType,
      tensionN,
      state.frameStiffness,
      state.beltLength,
      state.driveType,
      state.motorTorque,
      state.motorCurrent,
      50,
      20,
      state.motorInertia,
      beltDensity,
      state.enableDynamicSpeed ? state.printSpeed : 0
    );

    const { f: predY, compliance: compY } = predict_resonance(
      state.toolheadWeight + state.yGantryWeight,
      state.beltType,
      tensionN,
      state.frameStiffness,
      state.beltLength,
      state.driveType,
      state.motorTorque,
      state.motorCurrent,
      50,
      20,
      state.motorInertia,
      beltDensity,
      state.enableDynamicSpeed ? state.printSpeed : 0
    );

    const safeMaxX = Math.min(1000, Math.max(10, state.maxX || 0));
    const numFreqs = Math.floor(safeMaxX / 0.5);
    const freqs = new Float64Array(numFreqs);
    for (let i = 0; i < numFreqs; i++) {
        freqs[i] = (i + 1) * 0.5;
    }

    const imperfectionsX = {
      external_sway: state.externalSway,
      external_sway_freq: state.externalSwayFreq,
      hose_drag: state.hoseDrag,
      hose_drag_freq: state.hoseDragFreq,
      hose_squishy: state.hoseSquishy,
      squishy_materials: state.squishyFeet,
      toolhead_stiffness: state.toolheadStiffness,
      bearing_preload: state.bearingPreload,
      belt_tension_delta: state.beltTensionDiff,
      com_offset: [state.twistX, state.twistY, state.twistZ] as [number, number, number],
      damping_ratio: state.dampingRatio,
      axis: 'x' as const,
      gantry_racking: 0,
      adxl_offset: state.nozzleMountedADXL 
        ? [state.nozzleOffsetX, state.nozzleOffsetY, state.nozzleOffsetZ] as [number, number, number]
        : [state.adxlOffsetX, state.adxlOffsetY, state.adxlOffsetZ] as [number, number, number],
      nozzle_offset: [state.nozzleOffsetX, state.nozzleOffsetY, state.nozzleOffsetZ] as [number, number, number]
    };

    const imperfectionsY = {
        ...imperfectionsX,
        axis: 'y' as const,
        gantry_racking: state.gantryRacking
    };

    const speedParams = state.enableDynamicSpeed ? { print_speed: state.printSpeed } : undefined;
    const psdX_adxl = generate_psd_curve(predX, freqs, imperfectionsX, undefined, speedParams, 'adxl');
    const psdY_adxl = generate_psd_curve(predY, freqs, imperfectionsY, undefined, speedParams, 'adxl');

    const psdX_nozzle = generate_psd_curve(predX, freqs, imperfectionsX, undefined, speedParams, 'nozzle');
    const psdY_nozzle = generate_psd_curve(predY, freqs, imperfectionsY, undefined, speedParams, 'nozzle');

    if (type === 'PSD') {
        // Do NOT use transferable buffers — the SHAPERS handler may fire
        // before this message is received, and transferred buffers become
        // detached (zero-length), corrupting subsequent scoreShapers() calls.
        self.postMessage({
            type: 'PSD',
            requestId,
            predX,
            predY,
            compX,
            compY,
            freqs,
            psdX: psdX_adxl,
            psdY: psdY_adxl,
            psdX_nozzle,
            psdY_nozzle
        });
        return;
    }

    if (type === 'SHAPERS') {
        const scoringMode = e.data.scoringMode === 'exact' ? 'exact' : 'interactive';
        const scorer = scoringMode === 'exact' ? scoreShapersExact : scoreShapers;
        const scoreX = scorer(psdX_adxl, freqs, safeMaxX, state.scv);
        const scoreY = scorer(psdY_adxl, freqs, safeMaxX, state.scv);
        
        self.postMessage({
            type: 'SHAPERS',
            requestId,
            scoringMode,
            scoreX,
            scoreY
        });
    }
};
