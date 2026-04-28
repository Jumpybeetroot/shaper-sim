export interface MotorPreset {
    label: string;
    torque: number;
    inertia: number;
    ratedCurrent: number;
    resistance: number;
    inductance: number;
    rotorTeeth: number;
    runCurrent: number;
}

export const MOTOR_PRESET_VALUES = {
    'ldo-48': {
        label: 'LDO-42STH48-2504AC',
        torque: 550,
        inertia: 84.5,
        ratedCurrent: 2.5,
        resistance: 1.2,
        inductance: 1.5,
        rotorTeeth: 50,
        runCurrent: 100,
    },
    'ldo-48-2804ah': {
        label: 'LDO-42STH48-2804AH',
        torque: 420,
        inertia: 84.5,
        ratedCurrent: 2.8,
        resistance: 0.7,
        inductance: 0.6,
        rotorTeeth: 50,
        runCurrent: 100,
    },
    'ldo-48-2004mah-vrn': {
        label: 'LDO-42STH48-2004MAH(VRN) (0.9 deg)',
        torque: 400,
        inertia: 68.0,
        ratedCurrent: 2.0,
        resistance: 1.45,
        inductance: 2.0,
        rotorTeeth: 100,
        runCurrent: 100,
    },
    moons: {
        label: 'Moons MS17HD6P4200',
        torque: 630,
        inertia: 82.0,
        ratedCurrent: 2.0,
        resistance: 1.3,
        inductance: 2.9,
        rotorTeeth: 50,
        runCurrent: 100,
    },
    'moons-ha2p4200': {
        label: 'Moons MS17HA2P4200 (0.9 deg)',
        torque: 390,
        inertia: 57.0,
        ratedCurrent: 2.0,
        resistance: 1.05,
        inductance: 2.8,
        rotorTeeth: 100,
        runCurrent: 100,
    },
    stepperonline: {
        label: 'StepperOnline 17HS19-2004S1',
        torque: 590,
        inertia: 82.0,
        ratedCurrent: 2.0,
        resistance: 1.6,
        inductance: 3.0,
        rotorTeeth: 50,
        runCurrent: 100,
    }
} as const satisfies Record<string, MotorPreset>;

export const MOTOR_PRESET_IDS = ['custom', 'ldo-48', 'ldo-48-2804ah', 'ldo-48-2004mah-vrn', 'moons', 'moons-ha2p4200', 'stepperonline'] as const;
export type MotorPresetId = typeof MOTOR_PRESET_IDS[number];

export const MOTOR_PRESET_OPTIONS: Array<{ id: MotorPresetId; label: string }> = [
    { id: 'custom', label: 'Custom...' },
    ...Object.entries(MOTOR_PRESET_VALUES).map(([id, preset]) => ({
        id: id as MotorPresetId,
        label: preset.label
    }))
];

export function getMotorPreset(id: string): MotorPreset | null {
    return MOTOR_PRESET_VALUES[id as keyof typeof MOTOR_PRESET_VALUES] ?? null;
}
