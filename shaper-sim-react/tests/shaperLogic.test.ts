import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_DAMPING_RATIO,
    SHAPER_MIN_FREQS,
    SHAPERS,
    TEST_DAMPING_RATIOS,
    calculateToolheadModeFactors,
    computeStepperSpeedTorque,
    estimate_remaining_vibrations,
    generate_step_responses,
    generate_psd_curve,
    get_mzv_shaper,
    predict_resonance,
    scoreShapers,
    scoreShapersExact
} from '../src/lib/shaperLogic.ts';
import { getBeltDensity, getBeltTensionN } from '../src/lib/beltUtils.ts';

function assertClose(actual: number, expected: number, tolerance = 1e-12) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `expected ${actual} to be within ${tolerance} of ${expected}`
    );
}

function makeFreqs(maxHz: number, step = 0.5): Float64Array {
    const count = Math.floor(maxHz / step);
    const freqs = new Float64Array(count);
    for (let i = 0; i < count; i++) freqs[i] = (i + 1) * step;
    return freqs;
}

function lorentzian(freqs: Float64Array, center: number, width: number): Float64Array {
    const psd = new Float64Array(freqs.length);
    for (let i = 0; i < freqs.length; i++) {
        psd[i] = 1.0 / (1.0 + Math.pow((freqs[i] - center) / width, 2.0));
    }
    return psd;
}

describe('shaper formulas', () => {
    it('uses Klipper MZV decay over 0.75 pi, not ZV half-period decay', () => {
        const freq = 50.0;
        const damping = 0.1;
        const shaper = get_mzv_shaper(freq, damping);
        const df = Math.sqrt(1.0 - damping * damping);
        const mzvK = Math.exp(-0.75 * damping * Math.PI / df);
        const a1 = 1.0 - 1.0 / Math.sqrt(2.0);

        assertClose(shaper.A[0], a1);
        assertClose(shaper.A[1], (Math.sqrt(2.0) - 1.0) * mzvK);
        assertClose(shaper.A[2], a1 * mzvK * mzvK);
    });
});

describe('scoreShapers Klipper parity', () => {
    it('does not tune shapers below their Klipper minimum frequencies', () => {
        const freqs = makeFreqs(80);
        const psd = lorentzian(freqs, 52, 5);
        const { results } = scoreShapers(psd, freqs, 80, 5);

        for (const [name, minFreq] of Object.entries(SHAPER_MIN_FREQS)) {
            assert.ok(results[name].freq >= minFreq, `${name} tuned below ${minFreq} Hz`);
        }
    });

    it('keeps the highest tested frequency when vibration scores are tied', () => {
        const freqs = makeFreqs(80);
        const psd = new Float64Array(freqs.length);
        const { results } = scoreShapers(psd, freqs, 80, 5);

        for (const name of Object.keys(SHAPER_MIN_FREQS)) {
            assertClose(results[name].freq, 80.0, 1e-9);
        }
    });

    it('can recommend ZV for a narrow single-mode peak when smoothing tradeoff is favorable', () => {
        const freqs = makeFreqs(250);
        const psd = lorentzian(freqs, 60, 60 * 0.02);
        const { best_shaper } = scoreShapers(psd, freqs, 250, 5);

        assert.equal(best_shaper, 'zv');
    });

    it('keeps a separate exact Klipper-style exhaustive recommendation path', () => {
        const freqs = makeFreqs(250);
        const psd = lorentzian(freqs, 60, 60 * 0.02);
        const fast = scoreShapers(psd, freqs, 250, 5);
        const exact = scoreShapersExact(psd, freqs, 250, 5);

        assert.equal(fast.best_shaper, 'zv');
        assert.equal(exact.best_shaper, 'mzv');
    });

    it('reports the worst remaining vibration over Klipper test damping ratios', () => {
        const freqs = makeFreqs(120);
        const psd = lorentzian(freqs, 58, 9);
        const { results } = scoreShapers(psd, freqs, 120, 5);
        const tunedFreq = results.zv.freq;
        const shaper = SHAPERS.zv(tunedFreq, DEFAULT_DAMPING_RATIO);

        let worstFraction = 0.0;
        for (const damping of TEST_DAMPING_RATIOS) {
            const { fraction } = estimate_remaining_vibrations(shaper, damping, freqs, psd);
            if (fraction > worstFraction) worstFraction = fraction;
        }

        assertClose(results.zv.vibrations, worstFraction * 100.0, 1e-9);
    });
});

describe('toolhead offset model', () => {
    it('computes rigid-body yaw and tilt from r cross F vector math', () => {
        const com: [number, number, number] = [0, -20, -10];
        const adxl: [number, number, number] = [0, -45, 15];
        const nozzle: [number, number, number] = [0, -35, -40];

        const xFactors = calculateToolheadModeFactors('x', com, adxl, 'adxl', nozzle);
        assertClose(xFactors.yawTorqueMm, 20);
        assertClose(xFactors.yawMeasurementMm, 45);
        assertClose(xFactors.tiltTorqueMm, -10);
        assertClose(xFactors.tiltMeasurementMm, 15);

        const yFactors = calculateToolheadModeFactors('y', com, adxl, 'adxl', nozzle);
        assertClose(yFactors.yawTorqueMm, 0);
        assertClose(yFactors.yawMeasurementMm, 0);
        assertClose(yFactors.tiltTorqueMm, 10);
        assertClose(yFactors.tiltMeasurementMm, -15);
    });

    it('adds nozzle-local flex even when COM torque offsets are zero', () => {
        const freqs = makeFreqs(120);
        const center = 50;
        const base = generate_psd_curve(center, freqs, { axis: 'x', damping_ratio: 0.1 }, undefined, undefined, 'base');
        const adxl = generate_psd_curve(center, freqs, {
            axis: 'x',
            damping_ratio: 0.1,
            com_offset: [0, 0, 0],
            adxl_offset: [0, -45, 15],
            nozzle_offset: [0, -35, -40]
        }, undefined, undefined, 'adxl');
        const nozzle = generate_psd_curve(center, freqs, {
            axis: 'x',
            damping_ratio: 0.1,
            com_offset: [0, 0, 0],
            adxl_offset: [0, -45, 15],
            nozzle_offset: [0, -35, -40]
        }, undefined, undefined, 'nozzle');

        const flexIndex = Math.round((center * 1.35) / 0.5) - 1;
        assert.ok(adxl[flexIndex] > base[flexIndex], 'ADXL offset should see some local-flex participation');
        assert.ok(nozzle[flexIndex] > adxl[flexIndex] * 1.5, 'nozzle lever arm should see stronger local flex than carriage ADXL');
    });
});

describe('physics helper behavior', () => {
    it('converts Gates belt tune frequency to static belt tension', () => {
        assertClose(getBeltTensionN(12000, 110), 9.1476, 1e-9);
    });

    it('drops predicted resonance when dynamic speed reduces motor stiffness', () => {
        const tension = getBeltTensionN(12000, 110);
        const density = getBeltDensity(12000);
        const staticResult = predict_resonance(450, 12000, tension, 1, 2200, 2, 550, 100, 50, 20, 84.5, density, 0);
        const speedResult = predict_resonance(450, 12000, tension, 1, 2200, 2, 550, 100, 50, 20, 84.5, density, 500);

        assert.ok(speedResult.f < staticResult.f, `expected ${speedResult.f} to be below ${staticResult.f}`);
    });

    it('makes speed torque drop-off depend on pulley motor revs', () => {
        const factorAtPulley = (pulleyTeeth: number) => computeStepperSpeedTorque({
            printSpeed: 600,
            pulleyTeeth,
            motorRotorTeeth: 50,
            motorVoltage: 24,
            motorRatedCurrent: 2.5,
            motorResistance: 1.2,
            motorInductance: 1.5,
            motorTorque: 550,
            motorCurrentPct: 100
        }).factor;

        const pulley16Factor = factorAtPulley(16);
        const pulley20Factor = factorAtPulley(20);
        const pulley24Factor = factorAtPulley(24);

        assert.ok(pulley16Factor < pulley20Factor, `expected 16T factor ${pulley16Factor} to be below 20T ${pulley20Factor}`);
        assert.ok(pulley20Factor < pulley24Factor, `expected 20T factor ${pulley20Factor} to be below 24T ${pulley24Factor}`);
    });

    it('reduces speed torque loss with higher supply voltage', () => {
        const base = {
            printSpeed: 600,
            pulleyTeeth: 20,
            motorRotorTeeth: 50,
            motorRatedCurrent: 2.5,
            motorResistance: 1.2,
            motorInductance: 1.5,
            motorTorque: 550,
            motorCurrentPct: 100
        };

        const factor24v = computeStepperSpeedTorque({ ...base, motorVoltage: 24 }).factor;
        const factor48v = computeStepperSpeedTorque({ ...base, motorVoltage: 48 }).factor;

        assert.ok(factor48v > factor24v, `expected 48V factor ${factor48v} to exceed 24V ${factor24v}`);
    });

    it('increases speed torque loss with higher phase inductance', () => {
        const base = {
            printSpeed: 500,
            pulleyTeeth: 20,
            motorRotorTeeth: 50,
            motorVoltage: 24,
            motorRatedCurrent: 2.5,
            motorResistance: 1.2,
            motorTorque: 550,
            motorCurrentPct: 100
        };

        const lowInductance = computeStepperSpeedTorque({ ...base, motorInductance: 0.8 }).factor;
        const highInductance = computeStepperSpeedTorque({ ...base, motorInductance: 4.0 }).factor;

        assert.ok(lowInductance > highInductance, `expected low inductance ${lowInductance} to exceed high inductance ${highInductance}`);
    });

    it('does not collapse frequency to zero when speed torque factor reaches zero', () => {
        const tension = getBeltTensionN(12000, 110);
        const density = getBeltDensity(12000);
        // At 800 mm/s with 24V/1.5mH, torque factor = 0. Frequency should
        // settle at a detent-torque floor, NOT collapse to zero or jump up.
        const staticResult = predict_resonance(450, 12000, tension, 1, 2200, 2, 550, 100, 50, 20, 84.5, density, 0);
        const speedResult = predict_resonance(450, 12000, tension, 1, 2200, 2, 550, 100, 50, 20, 84.5, density, 800);
        // Frequency must stay well above zero and below static (monotonic drop)
        assert.ok(speedResult.f > 25, `expected detent-floor freq > 25 Hz, got ${speedResult.f}`);
        assert.ok(speedResult.f < staticResult.f, `expected ${speedResult.f} to be below static ${staticResult.f}`);
    });

    it('keeps speed frequency monotonically decreasing past the torque cliff', () => {
        const args = [450, 12000, getBeltTensionN(12000, 110), 1, 2200, 2, 550, 100, 50, 20, 84.5, getBeltDensity(12000)] as const;
        const f630 = predict_resonance(...args, 630).f;
        const f650 = predict_resonance(...args, 650).f;
        const f800 = predict_resonance(...args, 800).f;
        assert.ok(f650 <= f630, `expected f650 ${f650} <= f630 ${f630}`);
        assert.ok(f800 <= f650 + 1e-9, `expected f800 ${f800} <= f650 ${f650}`);
    });

    it('keeps zero-speed electrical torque factor at full available current', () => {
        const result = computeStepperSpeedTorque({
            printSpeed: 0,
            pulleyTeeth: 20,
            motorRotorTeeth: 50,
            motorVoltage: 12,
            motorRatedCurrent: 2.5,
            motorResistance: 10,
            motorInductance: 20,
            motorTorque: 550,
            motorCurrentPct: 100
        });

        assert.equal(result.factor, 1);
        assert.equal(result.electricalHz, 0);
    });

    it('keeps zero-speed PSD generation equivalent to the static path', () => {
        const freqs = makeFreqs(120);
        const center = 60;
        const base = generate_psd_curve(center, freqs, { damping_ratio: 0.1 });
        const zeroSpeed = generate_psd_curve(center, freqs, { damping_ratio: 0.1 }, undefined, { print_speed: 0 });

        for (let i = 0; i < freqs.length; i++) {
            assertClose(zeroSpeed[i], base[i], 1e-12);
        }
    });

    it('adds a speed-simulation belt mesh peak at v / 2 Hz', () => {
        const freqs = makeFreqs(150);
        const center = 60;
        const base = generate_psd_curve(center, freqs, { damping_ratio: 0.1 });
        const speed = generate_psd_curve(center, freqs, { damping_ratio: 0.1 }, undefined, { print_speed: 200 });

        let bestDelta = 0;
        let bestFreq = 0;
        for (let i = 0; i < freqs.length; i++) {
            const delta = speed[i] - base[i];
            if (delta > bestDelta) {
                bestDelta = delta;
                bestFreq = freqs[i];
            }
        }

        assertClose(bestFreq, 100, 0.5);
        assert.ok(bestDelta > 0);
    });

    it('keeps shaped step response normalized near the commanded final position', () => {
        const shaper = get_mzv_shaper(50, DEFAULT_DAMPING_RATIO);
        const { shaped } = generate_step_responses(50, 0.1, shaper, 0.3, 0.0005);

        assertClose(shaped[shaped.length - 1], 1, 0.005);
    });
});
