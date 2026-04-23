// App Logic & UI Binding

let chartInstance = null;
let snapshotDataX = null;
let snapshotDataY = null;
let snapshotMathFreqs = null;

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
                            return `${context.dataset.label}: ${context.raw.toExponential(2)}`;
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
                
                // Draw Klipper Vibration Threshold (approx 5% of 1e5 base amplitude)
                drawHorizontalLine(5000, 'rgba(255, 60, 60, 0.6)', 'Vibration Threshold');
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
    
    els.tensionVal.textContent = `${hz} Hz (~${tension.toFixed(1)} N)`;
    
    const motorTorque = parseFloat(els.motorTorque.value);
    const motorCurrent = parseFloat(els.motorCurrent.value);
    const motorInertia = parseFloat(els.motorInertia.value);
    
    // Simulate Klipper's ADXL Post-Processing
    const max_hz = parseFloat(els.scaleX.value);
    const mathFreqs = [];
    for (let f = 1; f <= max_hz; f += 0.5) { mathFreqs.push(f); }
    
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
    
    // Helper to calculate PSD with optional acceleration smearing
    const calculate_dynamic_psd = (mass, imp) => {
        let nominalFreq = predict_resonance(mass, beltEA, tension, frame, beltLen, driveType, motorTorque, motorCurrent, 50, 20, motorInertia, beltDensity);
        
        if (els.enableDynamicSpeed && els.enableDynamicSpeed.checked) {
            const targetSpeed = parseFloat(els.printSpeed.value);
            const scv = parseFloat(els.scv.value);
            
            let integratedPsd = new Array(mathFreqs.length).fill(0);
            const steps = 15; // Integrate across 15 speed steps from SCV up to target speed
            
            for (let i = 0; i < steps; i++) {
                const currentSpeed = scv + (targetSpeed - scv) * (i / (steps - 1));
                const torqueMultiplier = Math.exp(-currentSpeed / 430.0);
                const dynamicTorque = motorTorque * torqueMultiplier;
                
                const stepFreq = predict_resonance(mass, beltEA, tension, frame, beltLen, driveType, dynamicTorque, motorCurrent, 50, 20, motorInertia, beltDensity);
                const stepPsd = generate_psd_curve(stepFreq, mathFreqs, imp);
                
                for (let j = 0; j < mathFreqs.length; j++) {
                    integratedPsd[j] += stepPsd[j] / steps;
                }
            }
            return { freq: nominalFreq, psd: integratedPsd };
        } else {
            const psd = generate_psd_curve(nominalFreq, mathFreqs, imp);
            return { freq: nominalFreq, psd: psd };
        }
    };
    
    const resX = calculate_dynamic_psd(mX, impX);
    const resY = calculate_dynamic_psd(mY, impY);
    
    const freqX = resX.freq;
    const freqY = resY.freq;
    const psdX = resX.psd;
    const psdY = resY.psd;
    
    // Store globally so the chart renderer doesn't have to recalculate
    window.currentPsdX = psdX;
    window.currentPsdY = psdY;
    
    const klipperTargetSmoothing = 0.12;
    
    const scoreShapers = (axisFreq, rawPsd) => {
        let best_shaper = null;
        let best_score = -1;
        let results = {};
        
        for (let s in shaperNames) {
            let best_f = axisFreq;
            let best_shaper_score = -1;
            let min_shaper_vib = 1000;
            let best_shaper_accel = 0;
            
            // Sweep frequencies up to the chosen max_hz
            for (let f_test = 10; f_test <= max_hz; f_test += 1.0) {
                let shaper = SHAPERS[s](f_test, damping);
                let response = get_shaper_response(shaper, mathFreqs);
                let vibrations = calculate_remaining_vibrations(rawPsd, response);
                let max_accel = find_max_accel(shaper, scv, klipperTargetSmoothing);
                
                if (vibrations <= 5.0) {
                    if (max_accel > best_shaper_score) {
                        best_shaper_score = max_accel;
                        best_f = f_test;
                        min_shaper_vib = vibrations;
                        best_shaper_accel = max_accel;
                    }
                } else if (best_shaper_score === -1 && vibrations < min_shaper_vib) {
                    // Fallback track lowest vibrations if none pass
                    min_shaper_vib = vibrations;
                    best_f = f_test;
                    best_shaper_accel = max_accel;
                }
            }
            
            // Calculate final smoothing for the best chosen frequency
            let final_shaper = SHAPERS[s](best_f, damping);
            let smoothing = get_shaper_smoothing(final_shaper, 5000, scv);
            
            results[s] = { 
                max_accel: best_shaper_accel, 
                vibrations: min_shaper_vib, 
                smoothing: smoothing,
                freq: best_f
            };
            
            if (min_shaper_vib <= 5.0) { // Klipper rejects shapers that leave >5% vibrations
                if (best_shaper_accel > best_score) {
                    best_score = best_shaper_accel;
                    best_shaper = s;
                }
            }
        }
        
        // Fallback: if all fail 5% threshold, pick the one with lowest vibrations
        if (!best_shaper) {
            let min_vib = 1000;
            for (let s in results) {
                if (results[s].vibrations < min_vib) {
                    min_vib = results[s].vibrations;
                    best_shaper = s;
                }
            }
        }
        return { results, best_shaper };
    };
    
    const scoreX = scoreShapers(freqX, psdX);
    const scoreY = scoreShapers(freqY, psdY);
    
    const recX = scoreX.results[scoreX.best_shaper];
    const recY = scoreY.results[scoreY.best_shaper];
    
    // Store best shapers globally so the graph can plot them
    window.bestShaperX = scoreX.best_shaper;
    window.bestShaperY = scoreY.best_shaper;
    
    els.predX.textContent = `Predicted X: ${freqX.toFixed(1)} Hz (Max Accel: ${recX.max_accel} mm/s² | Smoothing ~${recX.smoothing.toFixed(3)})`;
    els.predY.textContent = `Predicted Y: ${freqY.toFixed(1)} Hz (Max Accel: ${recY.max_accel} mm/s² | Smoothing ~${recY.smoothing.toFixed(3)})`;
    
    els.predX.dataset.val = freqX;
    els.predY.dataset.val = freqY;
    
    // Generate Simulated Klipper Console Output
    let out = `Calculating shaper recommendations based on predicted ADXL PSD physics...\n\n`;
    out += `========== X AXIS (${freqX.toFixed(1)} Hz) ==========\n`;
    for (let s in shaperNames) {
        let r = scoreX.results[s];
        out += `Fitted shaper '${s}' frequency = ${r.freq.toFixed(1)} Hz (vibrations = ${r.vibrations.toFixed(1)}%, smoothing ~= ${r.smoothing.toFixed(3)})\n`;
        out += `To avoid too much smoothing with '${s}', suggested max_accel <= ${r.max_accel} mm/sec^2\n`;
    }
    out += `\nRecommended shaper is ${scoreX.best_shaper} @ ${recX.freq.toFixed(1)} Hz (Max Accel: ${recX.max_accel} mm/s²)\n\n`;

    out += `========== Y AXIS (${freqY.toFixed(1)} Hz) ==========\n`;
    for (let s in shaperNames) {
        let r = scoreY.results[s];
        out += `Fitted shaper '${s}' frequency = ${r.freq.toFixed(1)} Hz (vibrations = ${r.vibrations.toFixed(1)}%, smoothing ~= ${r.smoothing.toFixed(3)})\n`;
        out += `To avoid too much smoothing with '${s}', suggested max_accel <= ${r.max_accel} mm/sec^2\n`;
    }
    out += `\nRecommended shaper is ${scoreY.best_shaper} @ ${recY.freq.toFixed(1)} Hz (Max Accel: ${recY.max_accel} mm/s²)\n`;
    
    els.klipperConsole.textContent = out;
}

function handleInputEvents(e) {
    if (e && e.target === els.printerSize) {
        const pSize = parseFloat(els.printerSize.value) || 350;
        els.beltLength.value = (pSize * 4) + 800;
    }

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
    
    updatePredictions();
    generateChartData();
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
    
    const freqX = parseFloat(els.predX.dataset.val);
    const freqY = parseFloat(els.predY.dataset.val);
    
    const targetFreq = viewAxis === 'x' ? freqX : freqY;
    
    const mathFreqs = [];
    for (let f = 1; f <= parseFloat(els.scaleX.value); f += 0.5) { mathFreqs.push(f); }
    
    const psd = viewAxis === 'x' ? window.currentPsdX : window.currentPsdY;
    
    // Globally save current raw psd to be captured by snapshot button
    window.currentRawPsd = psd;
    window.currentMathFreqs = mathFreqs;
    
    const datasets = [];
    
    // Add Snapshot Dataset if exists
    const snapshotData = viewAxis === 'x' ? snapshotDataX : snapshotDataY;
    if (snapshotData && snapshotMathFreqs) {
        datasets.push({
            label: 'Snapshot PSD',
            data: snapshotMathFreqs.map((f, i) => ({x: f, y: snapshotData[i]})),
            borderColor: 'rgba(255, 255, 255, 0.3)',
            borderWidth: 2,
            borderDash: [5, 5],
            fill: true,
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            pointRadius: 0,
            pointHoverRadius: 0,
            tension: 0.4
        });
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
    
    const recommendedShaper = viewAxis === 'x' ? window.bestShaperX : window.bestShaperY;
    const currentDamping = parseFloat(els.damping.value);
    
    Object.keys(SHAPERS).forEach(shaper_name => {
        const shaper_func = SHAPERS[shaper_name];
        const shaper = shaper_func(targetFreq, currentDamping); 
        const response = get_shaper_response(shaper, mathFreqs);
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
            if (viewAxis === 'x') {
                snapshotDataX = [...window.currentRawPsd];
            } else {
                snapshotDataY = [...window.currentRawPsd];
            }
            snapshotMathFreqs = [...window.currentMathFreqs];
            els.btnClearSnapshot.style.display = 'flex';
            updatePredictions();
        });

        els.btnClearSnapshot.addEventListener('click', () => {
            snapshotDataX = null;
            snapshotDataY = null;
            snapshotMathFreqs = null;
            els.btnClearSnapshot.style.display = 'none';
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
