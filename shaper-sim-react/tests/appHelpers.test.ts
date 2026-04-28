import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { defaultState } from '../src/types.ts';
import { parseKlipperCsv } from '../src/lib/csvOverlay.ts';
import { sanitizeAppState, sanitizeProfiles } from '../src/lib/stateSanitizer.ts';

describe('sanitizeAppState', () => {
    it('uses MGN12 Z0 as the default X-rail bearing preload', () => {
        assert.equal(defaultState.bearingPreload, 0.85);
        assert.equal(sanitizeAppState({}).bearingPreload, 0.85);
    });

    it('returns defaults for unreadable or non-object values', () => {
        assert.deepEqual(sanitizeAppState(null), defaultState);
        assert.deepEqual(sanitizeAppState('not-json'), defaultState);
    });

    it('merges missing fields and preserves valid saved values', () => {
        const state = sanitizeAppState({
            dampingRatio: 0.08,
            driveType: 4,
            beltType: 18000,
            motorPreset: 'custom',
            motorVoltage: 48,
            pulleyTeeth: 24,
            enableDynamicSpeed: true
        });

        assert.equal(state.dampingRatio, 0.08);
        assert.equal(state.driveType, 4);
        assert.equal(state.beltType, 18000);
        assert.equal(state.motorPreset, 'custom');
        assert.equal(state.motorVoltage, 48);
        assert.equal(state.pulleyTeeth, 24);
        assert.equal(state.enableDynamicSpeed, true);
        assert.equal(state.toolheadWeight, defaultState.toolheadWeight);
        assert.equal(state.motorRatedCurrent, defaultState.motorRatedCurrent);
    });

    it('rejects non-finite numbers and wrong primitive types', () => {
        const state = sanitizeAppState({
            dampingRatio: Number.NaN,
            scv: Number.POSITIVE_INFINITY,
            enableDynamicSpeed: 'true',
            nozzleMountedADXL: 1
        });

        assert.equal(state.dampingRatio, defaultState.dampingRatio);
        assert.equal(state.scv, defaultState.scv);
        assert.equal(state.enableDynamicSpeed, defaultState.enableDynamicSpeed);
        assert.equal(state.nozzleMountedADXL, defaultState.nozzleMountedADXL);
    });

    it('clamps numeric fields to UI-safe ranges', () => {
        const state = sanitizeAppState({
            dampingRatio: -1,
            maxX: 5000,
            toolheadStiffness: 99,
            motorVoltage: 100,
            motorRatedCurrent: 99,
            motorResistance: -5,
            motorInductance: 100,
            motorRotorTeeth: 999,
            pulleyTeeth: 2,
            twistY: -999,
            beltTensionDiff: 75
        });

        assert.equal(state.dampingRatio, 0.01);
        assert.equal(state.maxX, 1000);
        assert.equal(state.toolheadStiffness, 3);
        assert.equal(state.motorVoltage, 60);
        assert.equal(state.motorRatedCurrent, 6);
        assert.equal(state.motorResistance, 0.05);
        assert.equal(state.motorInductance, 50);
        assert.equal(state.motorRotorTeeth, 100);
        assert.equal(state.pulleyTeeth, 10);
        assert.equal(state.twistY, -100);
        assert.equal(state.beltTensionDiff, 50);
    });

    it('falls back for invalid select-like values', () => {
        const state = sanitizeAppState({
            driveType: 3,
            beltType: 999,
            bearingPreload: 0.9,
            motorPreset: 'mystery-motor'
        });

        assert.equal(state.driveType, defaultState.driveType);
        assert.equal(state.beltType, defaultState.beltType);
        assert.equal(state.bearingPreload, defaultState.bearingPreload);
        assert.equal(state.motorPreset, defaultState.motorPreset);
    });

    it('migrates removed estimated motor presets to custom when motor values are saved', () => {
        const state = sanitizeAppState({
            motorPreset: 'ldo-kraken',
            motorTorque: 800,
            motorInertia: 138,
            motorRatedCurrent: 3,
            motorResistance: 1.1,
            motorInductance: 2.2
        });

        assert.equal(state.motorPreset, 'custom');
        assert.equal(state.motorTorque, 800);
        assert.equal(state.motorInertia, 138);
        assert.equal(state.motorRatedCurrent, 3);
    });
});

describe('sanitizeProfiles', () => {
    it('sanitizes each named profile and drops blank profile names', () => {
        const profiles = sanitizeProfiles({
            fast: { ...defaultState, maxX: 9999, driveType: 4 },
            ' ': { ...defaultState, maxX: 500 },
            broken: null
        });

        assert.deepEqual(Object.keys(profiles).sort(), ['broken', 'fast']);
        assert.equal(profiles.fast.maxX, 1000);
        assert.equal(profiles.fast.driveType, 4);
        assert.deepEqual(profiles.broken, defaultState);
    });
});

describe('parseKlipperCsv', () => {
    it('prefers psd_xyz over axis-specific PSD columns', () => {
        const overlay = parseKlipperCsv(
            '# Klipper resonance data\nfreq,psd_x,psd_y,psd_xyz\n10,1,2,9\n20,3,4,8\n',
            'calibration_data_x_2026.csv'
        );

        assert.ok(overlay);
        assert.equal(overlay.axis, 'x');
        assert.deepEqual(Array.from(overlay.freqs), [10, 20]);
        assert.deepEqual(Array.from(overlay.psd), [9, 8]);
    });

    it('falls back to the first PSD column and detects Y-axis filenames', () => {
        const overlay = parseKlipperCsv(
            'freq,psd_z\n15,1.5\n30,2.5\n',
            'calibration_data_y_axis.csv'
        );

        assert.ok(overlay);
        assert.equal(overlay.axis, 'y');
        assert.deepEqual(Array.from(overlay.psd), [1.5, 2.5]);
    });

    it('returns null for invalid files or rows without usable samples', () => {
        assert.equal(parseKlipperCsv('freq,accel\n10,20\n', 'bad.csv'), null);
        assert.equal(parseKlipperCsv('freq,psd_x\nbad,nope\n', 'bad.csv'), null);
        assert.equal(parseKlipperCsv('', 'empty.csv'), null);
    });
});
