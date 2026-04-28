import { predict_resonance, generate_psd_curve, scoreShapers, scoreShapersExact } from './shaperLogic';
import { getBeltDensity, getBeltTensionN } from './beltUtils';
import type { AppState } from '../types';
import type { ShaperScoringMode } from './shaperLogic';

type ShaperScoreTarget = 'adxl' | 'nozzle';

interface WorkerRequest {
    type: 'PSD' | 'SHAPERS';
    requestId: number;
    psdRequestId?: number;
    state: AppState;
    scoringMode?: ShaperScoringMode;
    scoreTarget?: ShaperScoreTarget;
}

interface SimulationData {
    predX: number;
    predY: number;
    staticPredX: number;
    staticPredY: number;
    compX: { belt: number; frame: number; motor: number };
    compY: { belt: number; frame: number; motor: number };
    freqs: Float64Array;
    psdX_adxl: Float64Array;
    psdY_adxl: Float64Array;
    psdX_nozzle: Float64Array;
    psdY_nozzle: Float64Array;
    psdX_nozzle_structural: Float64Array;
    psdY_nozzle_structural: Float64Array;
    scorePsdX_adxl: Float64Array;
    scorePsdY_adxl: Float64Array;
    scorePsdX_nozzle: Float64Array;
    scorePsdY_nozzle: Float64Array;
    safeMaxX: number;
}

let cachedSimulation: { key: string; data: SimulationData } | null = null;

function predictAxes(state: AppState, beltDensity: number, tensionN: number, printSpeed: number) {
    const x = predict_resonance(
        state.toolheadWeight,
        state.beltType,
        tensionN,
        state.frameStiffness,
        state.beltLength,
        state.driveType,
        state.motorTorque,
        state.motorCurrent,
        state.motorRotorTeeth,
        state.pulleyTeeth,
        state.motorInertia,
        beltDensity,
        printSpeed,
        state.motorVoltage,
        state.motorRatedCurrent,
        state.motorResistance,
        state.motorInductance
    );

    const y = predict_resonance(
        state.toolheadWeight + state.yGantryWeight,
        state.beltType,
        tensionN,
        state.frameStiffness,
        state.beltLength,
        state.driveType,
        state.motorTorque,
        state.motorCurrent,
        state.motorRotorTeeth,
        state.pulleyTeeth,
        state.motorInertia,
        beltDensity,
        printSpeed,
        state.motorVoltage,
        state.motorRatedCurrent,
        state.motorResistance,
        state.motorInductance
    );

    return { x, y };
}

function computeSimulation(state: AppState): SimulationData {
    const beltDensity = getBeltDensity(state.beltType);
    const tensionN = getBeltTensionN(state.beltType, state.beltTune);
    const printSpeed = state.enableDynamicSpeed ? state.printSpeed : 0;
    const operatingPrediction = predictAxes(state, beltDensity, tensionN, printSpeed);
    const staticPrediction = printSpeed > 0
        ? predictAxes(state, beltDensity, tensionN, 0)
        : operatingPrediction;
    const { f: predX, compliance: compX } = operatingPrediction.x;
    const { f: predY, compliance: compY } = operatingPrediction.y;
    const { f: staticPredX } = staticPrediction.x;
    const { f: staticPredY } = staticPrediction.y;

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
    const psdX_nozzle_structural = printSpeed > 0
        ? generate_psd_curve(predX, freqs, imperfectionsX, undefined, undefined, 'nozzle')
        : psdX_nozzle;
    const psdY_nozzle_structural = printSpeed > 0
        ? generate_psd_curve(predY, freqs, imperfectionsY, undefined, undefined, 'nozzle')
        : psdY_nozzle;

    const scorePsdX_adxl = printSpeed > 0
        ? generate_psd_curve(staticPredX, freqs, imperfectionsX, undefined, undefined, 'adxl')
        : psdX_adxl;
    const scorePsdY_adxl = printSpeed > 0
        ? generate_psd_curve(staticPredY, freqs, imperfectionsY, undefined, undefined, 'adxl')
        : psdY_adxl;
    const scorePsdX_nozzle = printSpeed > 0
        ? generate_psd_curve(staticPredX, freqs, imperfectionsX, undefined, undefined, 'nozzle')
        : psdX_nozzle;
    const scorePsdY_nozzle = printSpeed > 0
        ? generate_psd_curve(staticPredY, freqs, imperfectionsY, undefined, undefined, 'nozzle')
        : psdY_nozzle;

    return {
        predX,
        predY,
        staticPredX,
        staticPredY,
        compX,
        compY,
        freqs,
        psdX_adxl,
        psdY_adxl,
        psdX_nozzle,
        psdY_nozzle,
        psdX_nozzle_structural,
        psdY_nozzle_structural,
        scorePsdX_adxl,
        scorePsdY_adxl,
        scorePsdX_nozzle,
        scorePsdY_nozzle,
        safeMaxX
    };
}

function getSimulation(state: AppState): SimulationData {
    const key = JSON.stringify(state);
    if (cachedSimulation?.key === key) {
        return cachedSimulation.data;
    }

    const data = computeSimulation(state);
    cachedSimulation = { key, data };
    return data;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
    const { type, requestId, state } = e.data;
    const simulation = getSimulation(state);

    if (type === 'PSD') {
        // Do NOT use transferable buffers — the SHAPERS handler may fire
        // before this message is received, and transferred buffers become
        // detached (zero-length), corrupting subsequent scoreShapers() calls.
        self.postMessage({
            type: 'PSD',
            requestId,
            predX: simulation.predX,
            predY: simulation.predY,
            staticPredX: simulation.staticPredX,
            staticPredY: simulation.staticPredY,
            compX: simulation.compX,
            compY: simulation.compY,
            freqs: simulation.freqs,
            psdX: simulation.psdX_adxl,
            psdY: simulation.psdY_adxl,
            psdX_nozzle: simulation.psdX_nozzle,
            psdY_nozzle: simulation.psdY_nozzle,
            psdX_nozzle_structural: simulation.psdX_nozzle_structural,
            psdY_nozzle_structural: simulation.psdY_nozzle_structural
        });
        return;
    }

    if (type === 'SHAPERS') {
        const scoringMode = e.data.scoringMode === 'exact' ? 'exact' : 'interactive';
        const scoreTarget: ShaperScoreTarget = e.data.scoreTarget === 'nozzle' ? 'nozzle' : 'adxl';
        const scorer = scoringMode === 'exact' ? scoreShapersExact : scoreShapers;
        const scoreSourceX = scoreTarget === 'nozzle' ? simulation.scorePsdX_nozzle : simulation.scorePsdX_adxl;
        const scoreSourceY = scoreTarget === 'nozzle' ? simulation.scorePsdY_nozzle : simulation.scorePsdY_adxl;
        const scoreX = scorer(scoreSourceX, simulation.freqs, simulation.safeMaxX, state.scv);
        const scoreY = scorer(scoreSourceY, simulation.freqs, simulation.safeMaxX, state.scv);
        
        self.postMessage({
            type: 'SHAPERS',
            requestId,
            psdRequestId: e.data.psdRequestId ?? requestId,
            scoringMode,
            scoreTarget,
            scoreX,
            scoreY
        });
    }
};
