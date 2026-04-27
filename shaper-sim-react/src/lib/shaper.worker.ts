import { predict_resonance, generate_psd_curve, scoreShapers } from './shaperLogic';
import type { AppState } from '../types';

self.onmessage = (e: MessageEvent<{type: string, state: AppState}>) => {
    const { type, state } = e.data;

    let beltDensity = 0.0084; // default 6mm
    if (state.beltType === 18000) beltDensity = 0.0126; // 9mm
    else if (state.beltType === 20000) beltDensity = 0.0140; // 10mm
    else if (state.beltType === 25000) beltDensity = 0.0168; // 12mm

    const tensionN = 4 * beltDensity * Math.pow(0.15, 2) * Math.pow(state.beltTune, 2);

    const predX = predict_resonance(
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

    const predY = predict_resonance(
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
      belt_tension_delta: state.beltTensionDiff,
      z_twist: state.twistZ,
      damping_ratio: state.dampingRatio,
      axis: 'x' as const,
      toolhead_twist: state.twistX,
      gantry_racking: 0
    };

    const imperfectionsY = {
        ...imperfectionsX,
        axis: 'y' as const,
        toolhead_twist: state.twistY,
        gantry_racking: state.gantryRacking
    };

    const speedParams = state.enableDynamicSpeed ? { print_speed: state.printSpeed } : undefined;
    const psdX = generate_psd_curve(predX, freqs, imperfectionsX, undefined, speedParams);
    const psdY = generate_psd_curve(predY, freqs, imperfectionsY, undefined, speedParams);

    if (type === 'PSD') {
        self.postMessage({
            type: 'PSD',
            predX,
            predY,
            freqs,
            psdX,
            psdY
        }, [freqs.buffer, psdX.buffer, psdY.buffer] as any);
        return;
    }

    if (type === 'SHAPERS') {
        const scoreX = scoreShapers(psdX, freqs, safeMaxX, state.scv);
        const scoreY = scoreShapers(psdY, freqs, safeMaxX, state.scv);
        
        self.postMessage({
            type: 'SHAPERS',
            scoreX,
            scoreY
        });
    }
};
