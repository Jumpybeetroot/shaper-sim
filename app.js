// App Logic & UI Binding

let chartInstance = null;
// Snapshot captures full context so A/B comparison is unambiguous:
// { psd, shapedPsd, mathFreqs, damping, targetFreq, shaperName }
let snapshotX = null;
let snapshotY = null;

let renderRafId = null;

// Persistent State & Cache
const SimulationState = {
    cachedMaxHz: -1,
    cachedDamping: -1,
    cachedMathFreqs: [],
    cachedMathMemo: null,
    sharedStepPsd: new Float64Array(2000)
};

function getMathCache(max_hz, damping) {
    if (SimulationState.cachedMaxHz === max_hz && SimulationState.cachedDamping === damping && SimulationState.cachedMathMemo) {
        return { mathFreqs: SimulationState.cachedMathFreqs, mathMemo: SimulationState.cachedMathMemo };
    }
    const mathFreqs = [];
    for (let f = 1; f <= max_hz; f += 0.5) { mathFreqs.push(f); }
    
    const mathMemo = {
        omega: new Float64Array(mathFreqs.length),
        damping: new Float64Array(mathFreqs.length),
        omega_d: new Float64Array(mathFreqs.length),
        length: mathFreqs.length
    };
    const dfMemo = Math.sqrt(1.0 - damping * damping);
    for (let k = 0; k < mathFreqs.length; k++) {
        const omega = 2.0 * Math.PI * mathFreqs[k];
        mathMemo.omega[k] = omega;
        mathMemo.damping[k] = damping * omega;
        mathMemo.omega_d[k] = omega * dfMemo;
    }
    
    SimulationState.cachedMaxHz = max_hz;
    SimulationState.cachedDamping = damping;
    SimulationState.cachedMathFreqs = mathFreqs;
    SimulationState.cachedMathMemo = mathMemo;
    
    return { mathFreqs, mathMemo };
}

function calculate_dynamic_psd(mass, imp, mathFreqs, params) {
    let nominalFreq = predict_resonance(mass, params.beltEA, params.tension, params.frame, params.beltLen, params.driveType, params.motorTorque, params.motorCurrent, 50, 20, params.motorInertia, params.beltDensity);
    
    let integratedPsd = new Float64Array(mathFreqs.length);

    if (params.isDynamicSpeed) {
        const steps = 15; // Integrate across 15 speed steps from SCV up to target speed
        
        for (let i = 0; i < steps; i++) {
            const currentSpeed = params.scv + (params.targetSpeed - params.scv) * (i / (steps - 1));
            const torqueMultiplier = Math.exp(-currentSpeed / 430.0);
            const dynamicTorque = params.motorTorque * torqueMultiplier;
            
            const stepFreq = predict_resonance(mass, params.beltEA, params.tension, params.frame, params.beltLen, params.driveType, dynamicTorque, params.motorCurrent, 50, 20, params.motorInertia, params.beltDensity);
            
            generate_psd_curve(stepFreq, mathFreqs, imp, SimulationState.sharedStepPsd);
            
            for (let j = 0; j < mathFreqs.length; j++) {
                integratedPsd[j] += SimulationState.sharedStepPsd[j] / steps;
            }
        }
        return { freq: nominalFreq, psd: integratedPsd };
    } else {
        generate_psd_curve(nominalFreq, mathFreqs, imp, integratedPsd);
        return { freq: nominalFreq, psd: integratedPsd };
    }
}

function scoreShapers(axisFreq, rawPsd, memo, mathFreqs, max_hz, scv, damping) {
    let best_shaper = null;
    let best_score = -1;
    let results = {};

    for (const s of Object.keys(shaperNames)) {
        let best_f = axisFreq;
        let best_shaper_score = -1;
        let min_shaper_vib_pct = 1000;
        let best_shaper_accel = 0;

        const testFreq = (f_test) => {
            const shaper = SHAPERS[s](f_test, damping);
            const { fraction } = estimate_remaining_vibrations(shaper, damping, mathFreqs, rawPsd, memo);
            const vibrations_pct = fraction * 100.0;
            const max_accel = find_shaper_max_accel(shaper, scv);

            if (vibrations_pct <= 5.0) {
                if (max_accel > best_shaper_score) {
                    best_shaper_score = max_accel;
                    best_f = f_test;
                    min_shaper_vib_pct = vibrations_pct;
                    best_shaper_accel = max_accel;
                }
            } else if (best_shaper_score === -1 && vibrations_pct < min_shaper_vib_pct) {
                // Fallback track lowest vibrations if none pass
                min_shaper_vib_pct = vibrations_pct;
                best_f = f_test;
                best_shaper_accel = max_accel;
            }
        };

        // Pass 1: Coarse sweep (3.0 Hz steps)
        for (let f_test = 10; f_test <= max_hz; f_test += 3.0) {
            testFreq(f_test);
        }
        
        // Pass 2: Fine sweep (+/- 3.0 Hz around coarse best, 0.5 Hz steps)
        const coarse_best = best_f;
        const fine_min = Math.max(10.0, coarse_best - 3.0);
        const fine_max = Math.min(max_hz, coarse_best + 3.0);
        for (let f_test = fine_min; f_test <= fine_max; f_test += 0.5) {
            testFreq(f_test);
        }

        // Calculate final smoothing for the best chosen frequency
        const final_shaper = SHAPERS[s](best_f, damping);
        const smoothing = get_shaper_smoothing(final_shaper, 5000, scv);

        results[s] = {
            max_accel: best_shaper_accel,
            vibrations: min_shaper_vib_pct,
            smoothing: smoothing,
            freq: best_f
        };

        if (min_shaper_vib_pct <= 5.0) { // Klipper rejects shapers that leave >5% vibrations
            if (best_shaper_accel > best_score) {
                best_score = best_shaper_accel;
                best_shaper = s;
            }
        }
    }

    // Fallback: if all fail 5% threshold, pick the one with lowest vibrations
    if (!best_shaper) {
        let min_vib = 1000;
        for (const s of Object.keys(results)) {
            if (results[s].vibrations < min_vib) {
                min_vib = results[s].vibrations;
                best_shaper = s;
            }
        }
    }
    return { results, best_shaper };
}

// UI Elements
const els = {
    // Simulation settings
    damping: document.getElementById('damping-ratio'),
    dampingVal: document.getElementById('damping-val'),
    scv: document.getElementById('scv'),
    scvVal: document.getElementById('scv-val'),
    
    mass: document.getElementById('toolhead-weight'),
    yMass: document.getElementById('y-gantry-weight'),
    printerSize: document.getElementById('printer-size'),
    beltLength: document.getElementById('belt-length'),
    beltType: document.getElementById('belt-type'),
    beltTune: document.getElementById('belt-tune'),
    tensionVal: document.getElementById('tension-val'),
    frameStiffness: document.getElementById('frame-stiffness'),
    stiffnessVal: document.getElementById('stiffness-val'),
    driveType: document.getElementById('drive-type'),
    motorPreset: document.getElementById('motor-preset'),
    motorTorque: document.getElementById('motor-torque'),
    motorInertia: document.getElementById('motor-inertia'),
    motorCurrent: document.getElementById('motor-current'),
    motorCurrentVal: document.getElementById('motor-current-val'),
    
    // Experimental Physics
    enableDynamicSpeed: document.getElementById('enable-dynamic-speed'),
    speedSliderGroup: document.getElementById('speed-slider-group'),
    printSpeed: document.getElementById('print-speed'),
    printSpeedVal: document.getElementById('print-speed-val'),
    
    // Imperfections
    twistX: document.getElementById('twist-x'),
    twistXVal: document.getElementById('twist-x-val'),
    twistY: document.getElementById('twist-y'),
    twistYVal: document.getElementById('twist-y-val'),
    twistZ: document.getElementById('twist-z'),
    twistZVal: document.getElementById('twist-z-val'),
    thStiff: document.getElementById('toolhead-stiffness'),
    thStiffVal: document.getElementById('th-stiff-val'),
    beltDiff: document.getElementById('belt-tension-diff'),
    beltDiffVal: document.getElementById('belt-diff-val'),
    racking: document.getElementById('gantry-racking'),
    rackingVal: document.getElementById('racking-val'),
    externalSway: document.getElementById('external-sway'),
    swayVal: document.getElementById('sway-val'),
    swayFreq: document.getElementById('external-sway-freq'),
    swayFreqVal: document.getElementById('sway-freq-val'),
    hoseDrag: document.getElementById('hose-drag'),
    hoseDragVal: document.getElementById('hose-drag-val'),
    hoseDragFreq: document.getElementById('hose-drag-freq'),
    hoseDragFreqVal: document.getElementById('hose-drag-freq-val'),
    hoseSquishy: document.getElementById('hose-squishy'),
    hoseSquishyVal: document.getElementById('hose-squishy-val'),
    squishyFeet: document.getElementById('squishy-feet'),
    squishyVal: document.getElementById('squishy-val'),
    
    scaleX: document.getElementById('scale-x'),
    axisToggle: document.getElementById('axis-toggle'),
    graphMode: document.getElementById('graph-mode'),
    shaperSelect: document.getElementById('shaper-select'),
    shaperContainer: document.getElementById('shaper-selector-container'),
    
    predX: document.getElementById('pred-x'),
    predY: document.getElementById('pred-y'),
    klipperConsole: document.getElementById('klipper-console'),
    
    // Profiles and Snapshots
    profileSelect: document.getElementById('profile-select'),
    profileName: document.getElementById('profile-name'),
    btnSaveProfile: document.getElementById('save-profile-btn'),
    btnDeleteProfile: document.getElementById('delete-profile-btn'),
    btnSnapshot: document.getElementById('btn-snapshot'),
    btnClearSnapshot: document.getElementById('btn-clear-snapshot')
};

// Colors matching CSS
const colors = {
    zv: '#ff3366',
    mzv: '#00f0ff',
    ei: '#00ff66',
    '2hump_ei': '#ffaa00',
    '3hump_ei': '#9d00ff'
};

const shaperNames = {
    zv: 'ZV',
    mzv: 'MZV',
    ei: 'EI',
    '2hump_ei': '2HUMP_EI',
    '3hump_ei': '3HUMP_EI'
};

function initChart() {
    const ctx = document.getElementById('accelChart').getContext('2d');
    
    Chart.defaults.color = '#adb5bd';
    Chart.defaults.font.family = "'Inter', sans-serif";
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 13, weight: '500' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 17, 26, 0.9)',
                    titleColor: '#00f0ff',
                    bodyFont: { size: 14 },
                    padding: 12,
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const isStepMode = els.graphMode && els.graphMode.value === 'step';
                            const yVal = context.parsed.y;
                            if (isStepMode) {
                                return `${context.dataset.label}: ${yVal.toFixed(3)}`;
                            }
                            return `${context.dataset.label}: ${yVal.toExponential(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Resonance Frequency (Hz)'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Power spectral density'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if (value === 0) return 0;
                            return value.toExponential(1); // Format like Klipper e.g., 1.0e+5
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'verticalLines',
            beforeDraw: (chart) => {
                const predX = parseFloat(els.predX.dataset.val);
                const predY = parseFloat(els.predY.dataset.val);
                
                if (isNaN(predX) || isNaN(predY)) return;

                const ctx = chart.ctx;
                const xAxis = chart.scales.x;
                const yAxis = chart.scales.y;
                
                const isStepMode = els.graphMode && els.graphMode.value === 'step';
                if (isStepMode) return; // Don't draw frequency markers on time chart
                
                const drawLine = (val, color, text) => {
                    const maxX = parseFloat(els.scaleX.value) || 100;
                    if (val < 1 || val > maxX) return;
                    
                    // Since it's a category scale starting at 1Hz, calculate fractional position
                    const fraction = (val - 1) / (maxX - 1);
                    const xPos = xAxis.left + fraction * (xAxis.right - xAxis.left);
                    
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
                
                const drawHorizontalLine = (yValue, color, text) => {
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
                
                const viewAxis = els.axisToggle.value;
                if (viewAxis === 'x') {
                    drawLine(predX, '#ff3366', 'Pred X');
                } else {
                    drawLine(predY, '#00f0ff', 'Pred Y');
                }
                
                // Draw Klipper Vibration Threshold (max PSD / 20)
                let maxPsd = 0;
                if (window.currentRawPsd) {
                    for (let i = 0; i < window.currentRawPsd.length; i++) {
                        if (window.currentRawPsd[i] > maxPsd) maxPsd = window.currentRawPsd[i];
                    }
                }
                const threshold = maxPsd > 0 ? maxPsd / 20.0 : 5000;
                drawHorizontalLine(threshold, 'rgba(255, 60, 60, 0.6)', 'Vibration Threshold');
            }
        }]
    });
}


function updatePredictions() {
    const mX = parseFloat(els.mass.value);
    const mY = mX + parseFloat(els.yMass.value);
    const beltEA = parseFloat(els.beltType.value);
    const frame = parseFloat(els.frameStiffness.value);
    const driveType = parseInt(els.driveType.value);
    const beltLen = parseFloat(els.beltLength.value);
    const scv = parseFloat(els.scv.value);
    const damping = parseFloat(els.damping.value);
    
    // Real-world Gates GT2 belt densities (approx 1.4 g/m per mm width)
    let beltDensity = 0.0084; // default 6mm (8.4 g/m)
    if (beltEA === 18000) beltDensity = 0.0126; // 9mm
    else if (beltEA === 20000) beltDensity = 0.0140; // 10mm
    else if (beltEA === 25000) beltDensity = 0.0168; // 12mm
    
    const hz = parseFloat(els.beltTune.value);
    const span_m = 0.15;
    const rho = beltDensity;
    const tension = 4 * rho * Math.pow(span_m, 2) * Math.pow(hz, 2);
    
    const motorTorque = parseFloat(els.motorTorque.value);
    const motorCurrent = parseFloat(els.motorCurrent.value);
    const motorInertia = parseFloat(els.motorInertia.value);
    
    // Simulate Klipper's ADXL Post-Processing
    const max_hz = parseFloat(els.scaleX.value);
    
    const { mathFreqs, mathMemo } = getMathCache(max_hz, damping);
    
    const impX = { 
        axis: 'x',
        toolhead_mass: mX,
        toolhead_twist: parseFloat(els.twistX.value), 
        cross_twist: parseFloat(els.twistY.value),
        z_twist: parseFloat(els.twistZ.value),
        toolhead_stiffness: parseFloat(els.thStiff.value),
        belt_tension_delta: parseFloat(els.beltDiff.value),
        gantry_racking: parseFloat(els.racking.value),
        external_sway: parseFloat(els.externalSway.value),
        external_sway_freq: parseFloat(els.swayFreq.value),
        hose_drag: parseFloat(els.hoseDrag.value),
        hose_drag_freq: parseFloat(els.hoseDragFreq.value),
        hose_squishy: parseFloat(els.hoseSquishy.value),
        squishy_materials: parseFloat(els.squishyFeet.value),
        damping_ratio: damping 
    };
    const impY = { 
        axis: 'y',
        toolhead_mass: mY,
        toolhead_twist: parseFloat(els.twistY.value), 
        cross_twist: parseFloat(els.twistX.value),
        z_twist: parseFloat(els.twistZ.value),
        toolhead_stiffness: parseFloat(els.thStiff.value),
        belt_tension_delta: parseFloat(els.beltDiff.value),
        gantry_racking: parseFloat(els.racking.value),
        external_sway: parseFloat(els.externalSway.value),
        external_sway_freq: parseFloat(els.swayFreq.value),
        hose_drag: parseFloat(els.hoseDrag.value),
        hose_drag_freq: parseFloat(els.hoseDragFreq.value),
        hose_squishy: parseFloat(els.hoseSquishy.value),
        squishy_materials: parseFloat(els.squishyFeet.value),
        damping_ratio: damping 
    };
    
    const dynParams = {
        beltEA, tension, frame, beltLen, driveType, motorTorque, motorCurrent, motorInertia, beltDensity,
        isDynamicSpeed: els.enableDynamicSpeed && els.enableDynamicSpeed.checked,
        targetSpeed: parseFloat(els.printSpeed.value),
        scv
    };
    
    const resX = calculate_dynamic_psd(mX, impX, mathFreqs, dynParams);
    const resY = calculate_dynamic_psd(mY, impY, mathFreqs, dynParams);
    
    const freqX = resX.freq;
    const freqY = resY.freq;
    const psdX = resX.psd;
    const psdY = resY.psd;
    
    // Store globally so the chart renderer doesn't have to recalculate
    window.currentPsdX = psdX;
    window.currentPsdY = psdY;

    // Update tension label
    updateLabels(hz, tension, freqX, freqY, null, null, null, null);
    
    const scoreX = scoreShapers(freqX, psdX, mathMemo, mathFreqs, max_hz, scv, damping);
    const scoreY = scoreShapers(freqY, psdY, mathMemo, mathFreqs, max_hz, scv, damping);
    
    const recX = scoreX.results[scoreX.best_shaper];
    const recY = scoreY.results[scoreY.best_shaper];
    
    // Store best shapers globally so the graph can plot them
    window.bestShaperX = scoreX.best_shaper;
    window.bestShaperY = scoreY.best_shaper;
    
    updateLabels(hz, tension, freqX, freqY, recX, recY, scoreX, scoreY);
}

function updateLabels(hz, tension, freqX, freqY, recX, recY, scoreX, scoreY) {
    if (hz !== null && tension !== null) {
        els.tensionVal.textContent = `${hz} Hz (~${tension.toFixed(1)} N)`;
    }
    
    const displayAccel = (a) => Math.round(a / 100.0) * 100.0;
    
    if (recX && recY && scoreX && scoreY) {
        els.predX.textContent = `Predicted X: ${freqX.toFixed(1)} Hz (Max Accel: ${displayAccel(recX.max_accel)} mm/s² | Smoothing ~${recX.smoothing.toFixed(3)})`;
        els.predY.textContent = `Predicted Y: ${freqY.toFixed(1)} Hz (Max Accel: ${displayAccel(recY.max_accel)} mm/s² | Smoothing ~${recY.smoothing.toFixed(3)})`;
        
        els.predX.dataset.val = freqX;
        els.predY.dataset.val = freqY;
        
        // Generate Simulated Klipper Console Output
        let out = `Calculating shaper recommendations based on predicted ADXL PSD physics...\n\n`;
        out += `========== X AXIS (${freqX.toFixed(1)} Hz) ==========\n`;
        for (const s of Object.keys(shaperNames)) {
            const r = scoreX.results[s];
            out += `Fitted shaper '${s}' frequency = ${r.freq.toFixed(1)} Hz (vibrations = ${r.vibrations.toFixed(1)}%, smoothing ~= ${r.smoothing.toFixed(3)})\n`;
            out += `To avoid too much smoothing with '${s}', suggested max_accel <= ${displayAccel(r.max_accel)} mm/sec^2\n`;
        }
        out += `\nRecommended shaper is ${scoreX.best_shaper} @ ${recX.freq.toFixed(1)} Hz (Max Accel: ${displayAccel(recX.max_accel)} mm/s²)\n\n`;

        out += `========== Y AXIS (${freqY.toFixed(1)} Hz) ==========\n`;
        for (const s of Object.keys(shaperNames)) {
            const r = scoreY.results[s];
            out += `Fitted shaper '${s}' frequency = ${r.freq.toFixed(1)} Hz (vibrations = ${r.vibrations.toFixed(1)}%, smoothing ~= ${r.smoothing.toFixed(3)})\n`;
            out += `To avoid too much smoothing with '${s}', suggested max_accel <= ${displayAccel(r.max_accel)} mm/sec^2\n`;
        }
        out += `\nRecommended shaper is ${scoreY.best_shaper} @ ${recY.freq.toFixed(1)} Hz (Max Accel: ${displayAccel(recY.max_accel)} mm/s²)\n`;
        
        els.klipperConsole.textContent = out;
    }
}

function handleInputEvents(e) {
    if (e && e.target === els.printerSize) {
        const pSize = parseFloat(els.printerSize.value) || 350;
        els.beltLength.value = (pSize * 4) + 800;
    }

    updateInputLabels();
    
    // 2. Debounce the heavy math
    if (!renderRafId) {
        renderRafId = requestAnimationFrame(() => {
            updatePredictions();
            generateChartData();
            renderRafId = null;
        });
    }
}

function updateInputLabels() {
    // Update displays
    els.dampingVal.textContent = parseFloat(els.damping.value).toFixed(3);
    els.scvVal.textContent = parseFloat(els.scv.value).toFixed(1);
    
    const fStiff = parseFloat(els.frameStiffness.value);
    els.stiffnessVal.textContent = fStiff.toFixed(1);
    
    els.motorCurrentVal.textContent = `${els.motorCurrent.value}%`;
    
    els.twistXVal.textContent = `${els.twistX.value} mm`;
    els.twistYVal.textContent = `${els.twistY.value} mm`;
    els.twistZVal.textContent = `${els.twistZ.value} mm`;
    
    let thLabel = "ABS/PETG";
    const thV = parseFloat(els.thStiff.value);
    if (thV < 0.8) thLabel = "Soft PLA / Flex";
    else if (thV > 1.8) thLabel = "SLM Metal";
    else if (thV > 1.3) thLabel = "CF Nylon / Alum";
    els.thStiffVal.textContent = `${thV.toFixed(1)}x (${thLabel})`;
    
    els.beltDiffVal.textContent = `${els.beltDiff.value}%`;
    els.rackingVal.textContent = `${els.racking.value}%`;
    els.swayVal.textContent = `${els.externalSway.value}%`;
    els.swayFreqVal.textContent = `${els.swayFreq.value} Hz`;
    els.hoseDragVal.textContent = `${els.hoseDrag.value}%`;
    els.hoseDragFreqVal.textContent = `${els.hoseDragFreq.value} Hz`;
    els.hoseSquishyVal.textContent = `${els.hoseSquishy.value}%`;
    els.squishyVal.textContent = `${els.squishyFeet.value}%`;
    
    // Experimental Physics
    if (els.enableDynamicSpeed && els.speedSliderGroup && els.printSpeedVal && els.printSpeed) {
        if (els.enableDynamicSpeed.checked) {
            els.speedSliderGroup.style.opacity = '1';
            els.speedSliderGroup.style.pointerEvents = 'auto';
        } else {
            els.speedSliderGroup.style.opacity = '0.5';
            els.speedSliderGroup.style.pointerEvents = 'none';
        }
        els.printSpeedVal.textContent = `${els.printSpeed.value} mm/s`;
    }
}

function requestChartData() {
    if (!renderRafId) {
        renderRafId = requestAnimationFrame(() => {
            generateChartData();
            renderRafId = null;
        });
    }
}

// Attach event listeners to all inputs
const inputs = [
    els.damping, els.scv, 
    els.mass, els.yMass, els.printerSize, els.beltLength, els.beltType, els.beltTune, els.frameStiffness, els.driveType,
    els.motorTorque, els.motorInertia, els.motorCurrent,
    els.scaleX, els.axisToggle, els.twistX, els.twistY, els.twistZ, els.thStiff, els.externalSway, els.swayFreq, els.hoseDrag, els.hoseDragFreq, els.hoseSquishy, els.squishyFeet,
    els.beltDiff, els.racking,
    els.enableDynamicSpeed, els.printSpeed
];
inputs.forEach(input => {
    if (input) {
        input.addEventListener('input', handleInputEvents);
    }
});

if (els.axisToggle) els.axisToggle.addEventListener('change', requestChartData);
if (els.graphMode) {
    els.graphMode.addEventListener('change', () => {
        if (els.shaperContainer) {
            if (els.graphMode.value === 'step') {
                els.shaperContainer.classList.remove('hidden');
            } else {
                els.shaperContainer.classList.add('hidden');
            }
        }
        requestChartData();
    });
}
if (els.shaperSelect) els.shaperSelect.addEventListener('change', requestChartData);

const motorPresets = {
    'ldo-48': { torque: 550, inertia: 84.5 },
    'ldo-40': { torque: 450, inertia: 54.0 },
    'ldo-kraken': { torque: 800, inertia: 138.0 },
    'moons': { torque: 550, inertia: 82.0 },
    'stepperonline': { torque: 590, inertia: 82.0 },
    'excit3d-max': { torque: 560, inertia: 82.0 }
};

els.motorPreset.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val !== 'custom' && motorPresets[val]) {
        els.motorTorque.value = motorPresets[val].torque;
        els.motorInertia.value = motorPresets[val].inertia;
        handleInputEvents(); // update UI and predictions
    }
});

els.motorTorque.addEventListener('input', () => { els.motorPreset.value = 'custom'; });
els.motorInertia.addEventListener('input', () => { els.motorPreset.value = 'custom'; });

function generateChartData() {
    const viewAxis = els.axisToggle.value;
    const isStepMode = els.graphMode && els.graphMode.value === 'step';
    
    const freqX = parseFloat(els.predX.dataset.val);
    const freqY = parseFloat(els.predY.dataset.val);
    const targetFreq = viewAxis === 'x' ? freqX : freqY;
    const currentDamping = parseFloat(els.damping.value);
    const recommendedShaper = viewAxis === 'x' ? window.bestShaperX : window.bestShaperY;
    
    const datasets = [];
    
    if (isStepMode) {
        // --- TIME DOMAIN (STEP RESPONSE) ---
        chartInstance.options.scales.x.title.text = 'Time (ms)';
        chartInstance.options.scales.y.title.text = 'Position (Step Response)';
        chartInstance.options.scales.y.ticks.callback = function(value) { return value.toFixed(2); };
        
        // Let chart.js handle Y max dynamically based on overshoot
        delete chartInstance.options.scales.y.max;
        if (chartInstance.options.scales.x) {
            delete chartInstance.options.scales.x.max;
        }
        
        const manualShaper = els.shaperSelect ? els.shaperSelect.value : 'recommended';
        const activeShaperName = manualShaper === 'recommended' ? recommendedShaper : manualShaper;
        const shaper_func = SHAPERS[activeShaperName];
        const shaper = shaper_func ? shaper_func(targetFreq, currentDamping) : null;
        
        const { times, unshaped, shaped } = generate_step_responses(targetFreq, currentDamping, shaper, 0.250, 0.0005);
        
        const timeMs = Array.from(times, t => t * 1000); // ms as numbers for linear scale
        
        datasets.push({
            label: 'Unshaped Step Response',
            data: timeMs.map((t, i) => ({x: t, y: unshaped[i]})),
            borderColor: '#ffffff',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 6,
            tension: 0.1
        });
        
        datasets.push({
            label: `Shaped (${shaperNames[activeShaperName] || activeShaperName})`,
            data: timeMs.map((t, i) => ({x: t, y: shaped[i]})),
            borderColor: colors[activeShaperName] || '#00ff66',
            borderWidth: 3,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 6,
            tension: 0.1
        });
        
        // Use numeric {x,y} data points only; clear old labels and force a
        // linear scale so Chart.js interprets x as time in milliseconds.
        chartInstance.data.labels = [];
        chartInstance.options.scales.x.type = 'linear';
        chartInstance.data.datasets = datasets;

        // Limit number of x-axis ticks for the time-domain view
        chartInstance.options.scales.x.ticks = {
            maxTicksLimit: 20
        };
        
    } else {
        // --- FREQUENCY DOMAIN (PSD) ---
        chartInstance.options.scales.x.title.text = 'Resonance Frequency (Hz)';
        chartInstance.options.scales.y.title.text = 'Power spectral density';
        chartInstance.options.scales.y.ticks.callback = function(value) { if (value === 0) return 0; return value.toExponential(1); };
        
        const mathFreqs = [];
        for (let f = 1; f <= parseFloat(els.scaleX.value); f += 0.5) { mathFreqs.push(f); }
        
        const psd = viewAxis === 'x' ? window.currentPsdX : window.currentPsdY;
        window.currentRawPsd = psd;
        window.currentMathFreqs = mathFreqs;
        
        const snap = viewAxis === 'x' ? snapshotX : snapshotY;
        if (snap) {
            const tag = `ζ=${snap.damping.toFixed(3)}, ${snap.targetFreq.toFixed(1)} Hz`;
            datasets.push({
                label: `Snapshot raw (${tag})`,
                data: snap.mathFreqs.map((f, i) => ({x: f, y: snap.psd[i]})),
                borderColor: 'rgba(255, 255, 255, 0.3)',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: true,
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                pointRadius: 0,
                pointHoverRadius: 0,
                tension: 0.4
            });
            if (snap.shapedPsd && snap.shaperName) {
                const snapShaperDisplay = shaperNames[snap.shaperName] || snap.shaperName;
                const snapShaperColor = colors[snap.shaperName] || '#888888';
                datasets.push({
                    label: `Snapshot ${snapShaperDisplay} (${tag})`,
                    data: snap.mathFreqs.map((f, i) => ({x: f, y: snap.shapedPsd[i]})),
                    borderColor: snapShaperColor,
                    borderWidth: 1.5,
                    borderDash: [2, 6],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    tension: 0.4
                });
            }
        }

        datasets.push({
            label: 'Raw PSD',
            data: mathFreqs.map((f, i) => ({x: f, y: psd[i]})),
            borderColor: '#ffffff',
            borderWidth: 2,
            fill: true,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            pointRadius: 0,
            pointHoverRadius: 6,
            tension: 0.4
        });
        
        Object.keys(SHAPERS).forEach(shaper_name => {
            const shaper_func = SHAPERS[shaper_name];
            const shaper = shaper_func(targetFreq, currentDamping);
            const response = estimate_shaper(shaper, currentDamping, mathFreqs);
            const smoothed_psd = psd.map((val, i) => val * response[i]);
            
            datasets.push({
                label: shaperNames[shaper_name] || shaper_name,
                data: mathFreqs.map((f, i) => ({x: f, y: smoothed_psd[i]})),
                borderColor: colors[shaper_name] || '#888',
                borderWidth: 1.5,
                borderDash: [5, 5],
                pointRadius: 0,
                pointHoverRadius: 6,
                hidden: shaper_name !== recommendedShaper, 
                tension: 0.4
            });
        });
        
        chartInstance.data.labels = mathFreqs;
        chartInstance.data.datasets = datasets;
        chartInstance.options.scales.x.max = parseFloat(els.scaleX.value);

        // Revert to default scale type (category when labels are present)
        chartInstance.options.scales.x.type = 'category';

        // Reset tick limits
        if (chartInstance.options.scales.x.ticks) {
            delete chartInstance.options.scales.x.ticks.maxTicksLimit;
        }
    }
    
    chartInstance.update();
}

window.addEventListener('load', () => {
    document.fonts.ready.then(() => {
        try {
            initChart();
            handleInputEvents();
        
        // --- Snapshots ---
        els.btnSnapshot.addEventListener('click', () => {
            const viewAxis = els.axisToggle.value;
            const rawPsd = [...window.currentRawPsd];
            const mathFreqs = [...window.currentMathFreqs];
            const damping = parseFloat(els.damping.value);
            const targetFreq = parseFloat(
                viewAxis === 'x' ? els.predX.dataset.val : els.predY.dataset.val
            );
            const shaperName = viewAxis === 'x' ? window.bestShaperX : window.bestShaperY;

            let shapedPsd = null;
            if (shaperName && SHAPERS[shaperName]) {
                const shaper = SHAPERS[shaperName](targetFreq, damping);
                const response = estimate_shaper(shaper, damping, mathFreqs);
                shapedPsd = rawPsd.map((v, i) => v * response[i]);
            }

            const snap = { psd: rawPsd, shapedPsd, mathFreqs, damping, targetFreq, shaperName };
            if (viewAxis === 'x') snapshotX = snap;
            else snapshotY = snap;

            els.btnClearSnapshot.classList.remove('hidden');
            updatePredictions();
        });

        els.btnClearSnapshot.addEventListener('click', () => {
            snapshotX = null;
            snapshotY = null;
            els.btnClearSnapshot.classList.add('hidden');
            updatePredictions();
        });

        // --- Profiles (localStorage) ---
        const STORAGE_KEY = 'shaper_sim_profiles';
        
        function loadSavedProfilesList() {
            const profiles = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
            // Clear all except the first default option
            while (els.profileSelect.options.length > 1) {
                els.profileSelect.remove(1);
            }
            for (let name in profiles) {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                els.profileSelect.appendChild(opt);
            }
        }
        
        els.btnSaveProfile.addEventListener('click', () => {
            const name = els.profileName.value.trim();
            if (!name) return alert('Please enter a profile name');
            
            const currentVals = {};
            inputs.forEach(inp => {
                if (inp) {
                    currentVals[inp.id] = inp.value;
                }
            });
            
            let profiles = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
            profiles[name] = currentVals;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
            
            loadSavedProfilesList();
            els.profileSelect.value = name;
            els.profileName.value = '';
        });
        
        els.profileSelect.addEventListener('change', () => {
            const name = els.profileSelect.value;
            if (!name) return;
            
            const profiles = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
            const profile = profiles[name];
            if (profile) {
                inputs.forEach(inp => {
                    if (inp && profile[inp.id] !== undefined) {
                        inp.value = profile[inp.id];
                    }
                });
                handleInputEvents(); // This forces updatePredictions and text displays
            }
        });
        
        els.btnDeleteProfile.addEventListener('click', () => {
            const name = els.profileSelect.value;
            if (!name) return;
            
            let profiles = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
            delete profiles[name];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
            
            loadSavedProfilesList();
            els.profileSelect.value = '';
        });

        // Initialize list
        loadSavedProfilesList();
    } catch (e) {
        console.error("Initialization error:", e);
        document.body.innerHTML += `<div style="position:fixed; top:0; left:0; right:0; background:red; color:white; padding:20px; z-index:9999;">Initialization Error: ${e.message}<br><pre>${e.stack}</pre></div>`;
    }
    });
});
