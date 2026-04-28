import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_DAMPING_RATIO,
    SHAPER_MIN_FREQS,
    SHAPERS,
    TEST_DAMPING_RATIOS,
    estimate_remaining_vibrations,
    get_mzv_shaper,
    scoreShapers,
    scoreShapersExact
} from '../src/lib/shaperLogic.ts';

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
