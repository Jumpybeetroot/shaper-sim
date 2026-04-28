import { defaultState } from '../types.ts';
import type { AppState } from '../types.ts';
import { MOTOR_PRESET_IDS } from './motorPresets.ts';

type NumericKey = {
    [K in keyof AppState]: AppState[K] extends number ? K : never;
}[keyof AppState];

type BooleanKey = {
    [K in keyof AppState]: AppState[K] extends boolean ? K : never;
}[keyof AppState];

export interface NumericRange {
    min: number;
    max: number;
}

export const DRIVE_TYPES = [2, 4] as const;
export const BELT_TYPES = [12000, 18000, 20000, 25000] as const;
export const MOTOR_PRESETS = MOTOR_PRESET_IDS;
export const BEARING_PRELOADS = [0.7, 0.85, 1, 1.15, 1.2] as const;

export const STATE_RANGES: Record<NumericKey, NumericRange> = {
    dampingRatio: { min: 0.01, max: 0.2 },
    scv: { min: 1, max: 20 },
    maxX: { min: 50, max: 1000 },
    driveType: { min: 2, max: 4 },
    toolheadWeight: { min: 1, max: 5000 },
    yGantryWeight: { min: 0, max: 10000 },
    printerSize: { min: 1, max: 2000 },
    beltLength: { min: 1, max: 10000 },
    beltType: { min: 12000, max: 25000 },
    beltTune: { min: 50, max: 400 },
    frameStiffness: { min: 0.5, max: 10 },
    motorTorque: { min: 1, max: 3000 },
    motorInertia: { min: 0, max: 1000 },
    motorCurrent: { min: 10, max: 150 },
    motorRatedCurrent: { min: 0.1, max: 6 },
    motorResistance: { min: 0.05, max: 20 },
    motorInductance: { min: 0.05, max: 50 },
    motorVoltage: { min: 12, max: 60 },
    motorRotorTeeth: { min: 25, max: 100 },
    pulleyTeeth: { min: 10, max: 40 },
    printSpeed: { min: 0, max: 1000 },
    twistX: { min: -100, max: 100 },
    twistY: { min: -100, max: 100 },
    twistZ: { min: -100, max: 100 },
    adxlOffsetX: { min: -100, max: 100 },
    adxlOffsetY: { min: -100, max: 100 },
    adxlOffsetZ: { min: -100, max: 100 },
    nozzleOffsetX: { min: -100, max: 100 },
    nozzleOffsetY: { min: -100, max: 100 },
    nozzleOffsetZ: { min: -100, max: 100 },
    toolheadStiffness: { min: 0.4, max: 3 },
    bearingPreload: { min: 0.7, max: 1.2 },
    beltTensionDiff: { min: 0, max: 50 },
    gantryRacking: { min: 0, max: 100 },
    externalSway: { min: 0, max: 100 },
    externalSwayFreq: { min: 5, max: 35 },
    squishyFeet: { min: 0, max: 100 },
    hoseDrag: { min: 0, max: 100 },
    hoseDragFreq: { min: 5, max: 35 },
    hoseSquishy: { min: 0, max: 100 }
};

const BOOLEAN_KEYS: BooleanKey[] = ['enableDynamicSpeed', 'nozzleMountedADXL'];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim() !== '') {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
    }
    return null;
}

function clamp(value: number, range: NumericRange): number {
    return Math.min(range.max, Math.max(range.min, value));
}

function nearestAllowed(value: number, allowed: readonly number[], fallback: number): number {
    for (const candidate of allowed) {
        if (Math.abs(candidate - value) < 1e-9) return candidate;
    }
    return fallback;
}

function allowedString(value: unknown, allowed: readonly string[], fallback: string): string {
    return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}

function hasMotorOverride(source: Record<string, unknown>): boolean {
    const motorKeys: NumericKey[] = [
        'motorTorque',
        'motorInertia',
        'motorCurrent',
        'motorRatedCurrent',
        'motorResistance',
        'motorInductance',
        'motorVoltage',
        'motorRotorTeeth',
        'pulleyTeeth'
    ];

    return motorKeys.some(key => coerceFiniteNumber(source[key]) !== null);
}

function sanitizeNumericKey(key: NumericKey, source: Record<string, unknown>, target: AppState): void {
    const parsed = coerceFiniteNumber(source[key]);
    if (parsed === null) return;

    if (key === 'driveType') {
        target.driveType = nearestAllowed(parsed, DRIVE_TYPES, defaultState.driveType);
        return;
    }
    if (key === 'beltType') {
        target.beltType = nearestAllowed(parsed, BELT_TYPES, defaultState.beltType);
        return;
    }
    if (key === 'bearingPreload') {
        target.bearingPreload = nearestAllowed(parsed, BEARING_PRELOADS, defaultState.bearingPreload);
        return;
    }

    (target as Record<NumericKey, number>)[key] = clamp(parsed, STATE_RANGES[key]);
}

export function sanitizeAppState(value: unknown): AppState {
    const clean: AppState = { ...defaultState };
    if (!isRecord(value)) return clean;

    for (const key of Object.keys(STATE_RANGES) as NumericKey[]) {
        sanitizeNumericKey(key, value, clean);
    }

    for (const key of BOOLEAN_KEYS) {
        if (typeof value[key] === 'boolean') {
            clean[key] = value[key] as AppState[typeof key];
        }
    }

    clean.motorPreset = allowedString(value.motorPreset, MOTOR_PRESETS, defaultState.motorPreset);
    if (typeof value.motorPreset === 'string' && !MOTOR_PRESETS.includes(value.motorPreset as (typeof MOTOR_PRESETS)[number]) && hasMotorOverride(value)) {
        clean.motorPreset = 'custom';
    }
    return clean;
}

export function sanitizeProfiles(value: unknown): Record<string, AppState> {
    if (!isRecord(value)) return {};

    const clean: Record<string, AppState> = {};
    for (const [name, profile] of Object.entries(value)) {
        if (name.trim()) {
            clean[name] = sanitizeAppState(profile);
        }
    }
    return clean;
}
