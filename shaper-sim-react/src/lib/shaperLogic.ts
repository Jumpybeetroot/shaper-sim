/**
 * Kalico Input Shaper Simulator Logic
 *
 * ATTRIBUTION NOTICE:
 * The mathematical models for evaluating Input Shapers, calculating frequency
 * responses, and calculating remaining vibrations are direct Javascript/TypeScript ports
 * of the logic found in Klipper3d's 'shaper_calibrate.py' and 'shaper_defs.py'.
 *
 * Klipper3d is licensed under the GNU GPLv3 license.
 * Original source: https://github.com/Klipper3d/klipper (klippy/extras/)
 */

export const SHAPER_VIBRATION_REDUCTION = 20.0;
export const DEFAULT_DAMPING_RATIO = 0.1;
export const KLIPPER_TARGET_SMOOTHING = 0.12;
export const SHAPER_COARSE_STEP_HZ = 2.0;
export const SHAPER_FINE_STEP_HZ = 0.2;
export const SHAPER_FINE_WINDOW_HZ = 2.0;
export const TEST_DAMPING_RATIOS = [0.075, 0.1, 0.15] as const;
export const SHAPER_MIN_FREQS: Record<string, number> = {
    zv: 21.0,
    mzv: 23.0,
    ei: 29.0,
    '2hump_ei': 39.0,
    '3hump_ei': 48.0
};

// --- Toolhead Mode Tuning Constants --- //
// Characteristic carriage-to-nozzle moment arm for a compact toolhead.
const TORSION_NORMALIZER_MM = 70.0;
const YAW_FREQ_MULT = 1.25;           // Yaw torsional mode frequency multiplier
const YAW_FREQ_FLOOR = 1.20;          // Minimum frequency clamp for yaw
const YAW_AMP_COEFF = 0.8;            // Yaw amplitude coefficient
const ROLL_PITCH_FREQ_MULT = 1.15;    // Roll/Pitch torsional mode frequency multiplier
const ROLL_PITCH_FREQ_FLOOR = 1.15;   // Minimum frequency clamp for roll/pitch
const ROLL_PITCH_AMP_COEFF = 0.6;     // Roll/Pitch amplitude coefficient
const LOCAL_FLEX_FREQ_MULT = 1.35;    // Local toolhead/nozzle flex mode multiplier
const LOCAL_FLEX_FREQ_FLOOR = 1.25;   // Minimum frequency clamp for local flex
const LOCAL_FLEX_AMP_COEFF = 0.22;    // Local nozzle-flex amplitude coefficient
const TORSION_DAMPING_WIDTH = 1.333;  // Lorentzian half-width damping factor
const LOCAL_FLEX_DAMPING_WIDTH = 1.6; // Local printed-toolhead flex is more smeared
const PRELOAD_DAMPING_EXP = 1.5;      // Exponent for bearing preload → damping conversion
const CARRIAGE_SENSOR_FLEX_PARTICIPATION = 0.35;
const GT2_BELT_PITCH_MM = 2.0;
const DRIVER_VOLTAGE_UTILIZATION = 0.92;

type Vec3 = [number, number, number];

export interface ToolheadModeFactors {
    yawTorqueMm: number;
    yawMeasurementMm: number;
    tiltTorqueMm: number;
    tiltMeasurementMm: number;
    localFlexLeverMm: number;
    localFlexParticipation: number;
}

export interface Shaper {
    A: number[];
    T: number[];
}

export interface StepperSpeedTorqueParams {
    printSpeed: number;
    pulleyTeeth: number;
    motorRotorTeeth: number;
    motorVoltage: number;
    motorRatedCurrent: number;
    motorResistance: number;
    motorInductance: number;
    motorTorque: number;
    motorCurrentPct: number;
}

export interface StepperSpeedTorqueResult {
    factor: number;
    motorRps: number;
    electricalHz: number;
    availableCurrent: number;
    commandedCurrent: number;
    backEmfVoltage: number;
}

export interface Imperfections {
    axis?: 'x' | 'y';
    belt_tension_delta?: number;
    gantry_racking?: number;
    external_sway?: number;
    external_sway_freq?: number;
    hose_drag?: number;
    hose_drag_freq?: number;
    com_offset?: [number, number, number];
    toolhead_stiffness?: number;
    bearing_preload?: number;
    hose_squishy?: number;
    squishy_materials?: number;
    damping_ratio?: number;
    adxl_offset?: [number, number, number];
    nozzle_offset?: [number, number, number];
}

export interface SpeedParams {
    print_speed: number;
}

// --- Shaper Generators --- //

export function get_zv_shaper(shaper_freq: number, damping_ratio: number): Shaper {
    const df = Math.sqrt(1.0 - Math.pow(damping_ratio, 2));
    const K = Math.exp(-damping_ratio * Math.PI / df);
    const t_d = 1.0 / (shaper_freq * df);
    const A = [1.0, K];
    const T = [0.0, 0.5 * t_d];
    return { A, T };
}

export function get_mzv_shaper(shaper_freq: number, damping_ratio: number): Shaper {
    const df = Math.sqrt(1.0 - Math.pow(damping_ratio, 2));
    const K = Math.exp(-0.75 * damping_ratio * Math.PI / df);
    const t_d = 1.0 / (shaper_freq * df);

    const a1 = 1.0 - 1.0 / Math.sqrt(2.0);
    const a2 = (Math.sqrt(2.0) - 1.0) * K;
    const a3 = a1 * K * K;

    const A = [a1, a2, a3];
    const T = [0.0, 0.375 * t_d, 0.75 * t_d];
    return { A, T };
}

export function get_ei_shaper(shaper_freq: number, damping_ratio: number): Shaper {
    const v_tol = 1.0 / SHAPER_VIBRATION_REDUCTION;
    const df = Math.sqrt(1.0 - Math.pow(damping_ratio, 2));
    const t_d = 1.0 / (shaper_freq * df);
    const dr = damping_ratio;

    const a1 = (0.24968 + 0.24961 * v_tol) + ((0.80008 + 1.23328 * v_tol) + (0.49599 + 3.17316 * v_tol) * dr) * dr;
    const a3 = (0.25149 + 0.21474 * v_tol) + ((-0.83249 + 1.41498 * v_tol) + (0.85181 - 4.90094 * v_tol) * dr) * dr;
    const a2 = 1.0 - a1 - a3;

    const t2 = 0.4999 + (((0.46159 + 8.57843 * v_tol) * v_tol) + (((4.26169 - 108.644 * v_tol) * v_tol) + ((1.75601 + 336.989 * v_tol) * v_tol) * dr) * dr) * dr;

    const A = [a1, a2, a3];
    const T = [0.0, t2 * t_d, t_d];
    return { A, T };
}

function _get_shaper_from_expansion_coeffs(shaper_freq: number, damping_ratio: number, t_arr: number[][], a_arr: number[][]): Shaper {
    const tau = 1.0 / shaper_freq;
    const T: number[] = [];
    const A: number[] = [];
    const n = a_arr.length;
    const k = a_arr[0].length;
    for (let i = 0; i < n; i++) {
        let u = t_arr[i][k - 1];
        let v = a_arr[i][k - 1];
        for (let j = 0; j < k - 1; j++) {
            u = u * damping_ratio + t_arr[i][k - j - 2];
            v = v * damping_ratio + a_arr[i][k - j - 2];
        }
        T.push(u * tau);
        A.push(v);
    }
    return { A, T };
}

export function get_2hump_ei_shaper(shaper_freq: number, damping_ratio: number): Shaper {
    const t = [
        [0.0, 0.0, 0.0, 0.0],
        [0.49890, 0.16270, -0.54262, 6.16180],
        [0.99748, 0.18382, -1.58270, 8.17120],
        [1.49920, -0.09297, -0.28338, 1.85710]
    ];
    const a = [
        [0.16054, 0.76699, 2.26560, -1.22750],
        [0.33911, 0.45081, -2.58080, 1.73650],
        [0.34089, -0.61533, -0.68765, 0.42261],
        [0.15997, -0.60246, 1.00280, -0.93145]
    ];
    return _get_shaper_from_expansion_coeffs(shaper_freq, damping_ratio, t, a);
}

export function get_3hump_ei_shaper(shaper_freq: number, damping_ratio: number): Shaper {
    const t = [
        [0.0, 0.0, 0.0, 0.0],
        [0.49974, 0.23834, 0.44559, 12.4720],
        [0.99849, 0.29808, -2.36460, 23.3990],
        [1.49870, 0.10306, -2.01390, 17.0320],
        [1.99960, -0.28231, 0.61536, 5.40450]
    ];
    const a = [
        [0.11275, 0.76632, 3.29160, -1.44380],
        [0.23698, 0.61164, -2.57850, 4.85220],
        [0.30008, -0.19062, -2.14560, 0.13744],
        [0.23775, -0.73297, 0.46885, -2.08650],
        [0.11244, -0.45439, 0.96382, -1.46000]
    ];
    return _get_shaper_from_expansion_coeffs(shaper_freq, damping_ratio, t, a);
}

// --- Smoothing and Accel Math --- //

export function get_shaper_smoothing(shaper: Shaper, accel: number = 5000, scv: number = 5.0): number {
    const { A, T } = shaper;
    const half_accel = accel * 0.5;

    let sum_A = 0.0;
    for (let i = 0; i < A.length; i++) sum_A += A[i];
    const inv_D = 1.0 / sum_A;
    const n = T.length;

    let ts = 0.0;
    for (let i = 0; i < n; i++) ts += A[i] * T[i];
    ts *= inv_D;

    let offset_90 = 0.0;
    let offset_180 = 0.0;
    for (let i = 0; i < n; i++) {
        const dt = T[i] - ts;
        if (T[i] >= ts) {
            offset_90 += A[i] * (scv + half_accel * dt) * dt;
        }
        offset_180 += A[i] * half_accel * dt * dt;
    }
    offset_90 *= inv_D * Math.SQRT2;
    offset_180 *= inv_D;
    return Math.max(offset_90, offset_180);
}

function _bisect(func: (val: number) => boolean): number {
    let left = 1.0;
    let right = 1.0;
    if (!func(1e-9) || isNaN(left)) return 0.0;

    let iterations = 0;
    while (!func(left) && left > 1e-15 && iterations < 100) {
        right = left;
        left *= 0.5;
        iterations++;
    }
    if (right === left) {
        iterations = 0;
        while (func(right) && right < 1e9 && iterations < 100) {
            right *= 2.0;
            iterations++;
        }
    }
    iterations = 0;
    while (right - left > 1e-8 && iterations < 100) {
        const middle = (left + right) * 0.5;
        if (func(middle)) {
            left = middle;
        } else {
            right = middle;
        }
        iterations++;
    }
    return left;
}

export function find_shaper_max_accel(shaper: Shaper, scv: number): number {
    return _bisect(
        (test_accel) => get_shaper_smoothing(shaper, test_accel, scv) <= KLIPPER_TARGET_SMOOTHING
    );
}

// --- Predictive Mechanical Model --- //

export function computeStepperSpeedTorque(params: StepperSpeedTorqueParams): StepperSpeedTorqueResult {
    const safePulleyTeeth = Math.max(1, params.pulleyTeeth);
    const safeRotorTeeth = Math.max(1, params.motorRotorTeeth);
    const motorRps = Math.max(0, params.printSpeed) / (safePulleyTeeth * GT2_BELT_PITCH_MM);
    const electricalHz = motorRps * safeRotorTeeth;
    const commandedCurrent = Math.max(0.001, params.motorRatedCurrent * (params.motorCurrentPct / 100.0));

    if (motorRps <= 0) {
        return {
            factor: 1,
            motorRps,
            electricalHz,
            availableCurrent: commandedCurrent,
            commandedCurrent,
            backEmfVoltage: 0
        };
    }

    const resistance = Math.max(0.001, params.motorResistance);
    const inductanceH = Math.max(0.000001, params.motorInductance / 1000.0);
    const voltageLimit = Math.max(0, params.motorVoltage * DRIVER_VOLTAGE_UTILIZATION);
    const torqueConstant = Math.max(0, params.motorTorque / 1000.0) / Math.max(0.001, params.motorRatedCurrent);
    const mechanicalOmega = motorRps * 2.0 * Math.PI;
    const backEmfVoltage = torqueConstant * mechanicalOmega;
    const inductiveReactance = 2.0 * Math.PI * electricalHz * inductanceH;
    const phaseImpedance = Math.hypot(resistance, inductiveReactance);
    const currentVoltageHeadroom = Math.sqrt(Math.max(0, voltageLimit * voltageLimit - backEmfVoltage * backEmfVoltage));
    const availableCurrent = phaseImpedance > 0 ? currentVoltageHeadroom / phaseImpedance : commandedCurrent;
    const factor = Math.min(1, Math.max(0, availableCurrent / commandedCurrent));

    return {
        factor,
        motorRps,
        electricalHz,
        availableCurrent,
        commandedCurrent,
        backEmfVoltage
    };
}

export function predict_resonance(mass_g: number, belt_EA: number, tension_N: number, frame_multiplier: number, belt_length_mm: number, drive_type: number = 2, motor_torque_mNm: number = 550, motor_current_pct: number = 70, motor_rotor_teeth: number = 50, pulley_teeth: number = 20, motor_inertia_g_cm2: number = 84.5, belt_density_kg_m: number = 0.0012, print_speed: number = 0, motor_voltage: number = 24, motor_rated_current: number = 2.5, motor_resistance: number = 1.2, motor_inductance: number = 1.5): { f: number, compliance: { belt: number, frame: number, motor: number } } {
    let M = mass_g / 1000.0;
    const L = belt_length_mm / 1000.0;
    
    const width_mm = belt_EA / 2000.0;
    const tension_knee = 3.0 * width_mm; 
    const stiffening_factor = 1.0 + (1.1 * (1.0 - Math.exp(-tension_N / tension_knee))); 
    const effective_EA = belt_EA * stiffening_factor;

    let Kbelt = (8.0 * effective_EA) / L; 
    
    if (drive_type === 4) {
        Kbelt *= 2.8;
    }
    
    const Kframe = 500000.0 * Math.pow(frame_multiplier, 2.0);
    
    const current_ratio = motor_current_pct / 100.0;
    let saturation_factor = current_ratio;
    if (current_ratio > 1.0) {
        saturation_factor = 1.0 + 0.5 * (1.0 - Math.exp(-2.0 * (current_ratio - 1.0)));
    }
    const speedTorque = computeStepperSpeedTorque({
        printSpeed: print_speed,
        pulleyTeeth: pulley_teeth,
        motorRotorTeeth: motor_rotor_teeth,
        motorVoltage: motor_voltage,
        motorRatedCurrent: motor_rated_current,
        motorResistance: motor_resistance,
        motorInductance: motor_inductance,
        motorTorque: motor_torque_mNm,
        motorCurrentPct: motor_current_pct
    });
    const effective_torque_Nm = (motor_torque_mNm / 1000.0) * saturation_factor * speedTorque.factor;
    const K_theta = effective_torque_Nm * motor_rotor_teeth;
    
    const pulley_radius_m = (pulley_teeth * 2.0) / (2.0 * Math.PI) / 1000.0;
    const Kmotor_single = K_theta / Math.pow(pulley_radius_m, 2);
    const Kmotor_total = Math.max(Kmotor_single * drive_type, 1e-9);
    
    const Keff = 1.0 / (1.0 / Kbelt + 1.0 / Kframe + 1.0 / Kmotor_total);
    
    const J_kg_m2 = motor_inertia_g_cm2 * 1e-7;
    const Mrotor_single = J_kg_m2 / Math.pow(pulley_radius_m, 2);
    const Mrotor_total = Mrotor_single * drive_type;
    
    const Mbelt_total = belt_density_kg_m * L * (1.0 / 3.0);
    
    const inertial_coupling_factor = (drive_type === 4) ? 0.10 : 0.15;
    M = M + (Mrotor_total * inertial_coupling_factor) + Mbelt_total;
    
    const f = (1.0 / (2.0 * Math.PI)) * Math.sqrt(Keff / M);

    const C_belt = 1.0 / Kbelt;
    const C_frame = 1.0 / Kframe;
    const C_motor = 1.0 / Kmotor_total;
    const C_total = C_belt + C_frame + C_motor;

    return {
        f,
        compliance: {
            belt: (C_belt / C_total) * 100,
            frame: (C_frame / C_total) * 100,
            motor: (C_motor / C_total) * 100
        }
    };
}

export const SHAPERS: Record<string, (f: number, d: number) => Shaper> = {
    zv: get_zv_shaper,
    mzv: get_mzv_shaper,
    ei: get_ei_shaper,
    '2hump_ei': get_2hump_ei_shaper,
    '3hump_ei': get_3hump_ei_shaper
};

// --- PSD Simulation --- //

function cross(a: Vec3, b: Vec3): Vec3 {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

function dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function axisVector(axis: 'x' | 'y'): Vec3 {
    return axis === 'x' ? [1, 0, 0] : [0, 1, 0];
}

function rotationVector(index: 0 | 1 | 2): Vec3 {
    return index === 0 ? [1, 0, 0] : index === 1 ? [0, 1, 0] : [0, 0, 1];
}

function rotationalMeasurementMm(rotationAxisIndex: 0 | 1 | 2, measurementOffset: Vec3, measurementAxis: Vec3): number {
    return dot(cross(rotationVector(rotationAxisIndex), measurementOffset), measurementAxis);
}

function distanceFromActiveAxis(offset: Vec3, axis: 'x' | 'y'): number {
    return axis === 'x'
        ? Math.hypot(offset[1], offset[2])
        : Math.hypot(offset[0], offset[2]);
}

function sameOffset(a: Vec3, b?: Vec3): boolean {
    return !!b && Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9 && Math.abs(a[2] - b[2]) < 1e-9;
}

export function calculateToolheadModeFactors(
    axis: 'x' | 'y',
    comOffset: Vec3,
    measurementOffset: Vec3,
    target: 'adxl' | 'nozzle' | 'base' = 'adxl',
    nozzleOffset?: Vec3
): ToolheadModeFactors {
    if (target === 'base') {
        return {
            yawTorqueMm: 0,
            yawMeasurementMm: 0,
            tiltTorqueMm: 0,
            tiltMeasurementMm: 0,
            localFlexLeverMm: 0,
            localFlexParticipation: 0
        };
    }

    const measurementAxis = axisVector(axis);
    const torque = cross(comOffset, measurementAxis);
    const tiltAxisIndex: 0 | 1 = axis === 'x' ? 1 : 0;
    const localFlexParticipation = target === 'nozzle' || sameOffset(measurementOffset, nozzleOffset)
        ? 1.0
        : CARRIAGE_SENSOR_FLEX_PARTICIPATION;

    return {
        yawTorqueMm: torque[2],
        yawMeasurementMm: rotationalMeasurementMm(2, measurementOffset, measurementAxis),
        tiltTorqueMm: torque[tiltAxisIndex],
        tiltMeasurementMm: rotationalMeasurementMm(tiltAxisIndex, measurementOffset, measurementAxis),
        localFlexLeverMm: distanceFromActiveAxis(measurementOffset, axis),
        localFlexParticipation
    };
}

function lorentzianAt(f: number, centerFreq: number, width: number, amplitude: number): number {
    return amplitude / (1.0 + Math.pow((f - centerFreq) / width, 2.0));
}

export function generate_psd_curve(center_freq: number, freqs: Float64Array | number[], imperfections: Imperfections = {}, out_psd?: Float64Array, speed?: SpeedParams, target: 'adxl' | 'nozzle' | 'base' = 'adxl'): Float64Array {
    const {
        axis = 'x',
        belt_tension_delta = 0,
        gantry_racking = 0,
        external_sway = 0,
        external_sway_freq = 18.0,
        hose_drag = 0,
        hose_drag_freq = 5.0,
        com_offset = [0, 0, 0],
        toolhead_stiffness = 1.0,
        bearing_preload = 1.0,
        hose_squishy = 0,
        squishy_materials = 0,
        damping_ratio = 0.1
    } = imperfections;

    const base_amplitude = 1e5 * Math.pow(1.0 / (2.0 * damping_ratio), 2);
    const w = center_freq * damping_ratio;
    
    if (!out_psd) {
        out_psd = new Float64Array(freqs.length);
    }

    // Choose which physical point is being measured. Klipper recommendations
    // use the ADXL point; nozzle analysis is an explicit diagnostic path.
    let sensor_offset: Vec3 = [0, 0, 0];
    if (target === 'adxl' && imperfections.adxl_offset) {
        sensor_offset = imperfections.adxl_offset;
    } else if (target === 'nozzle' && imperfections.nozzle_offset) {
        sensor_offset = imperfections.nozzle_offset;
    }
    const modeFactors = calculateToolheadModeFactors(
        axis,
        com_offset,
        sensor_offset,
        target,
        imperfections.nozzle_offset
    );
    const stiffness_multiplier = toolhead_stiffness * bearing_preload;
    const preload_damping_factor = Math.pow(bearing_preload, PRELOAD_DAMPING_EXP);

    for (let i = 0; i < freqs.length; i++) {
        const f = freqs[i];
        let val = 0;
        
        // 1. Main Peak (Translational)
        val += lorentzianAt(f, center_freq, w, base_amplitude);

        // 2. Yaw Secondary Peak
        if (Math.abs(modeFactors.yawTorqueMm) > 0 && Math.abs(modeFactors.yawMeasurementMm) > 0) {
            const torque_factor = Math.abs(modeFactors.yawTorqueMm) / TORSION_NORMALIZER_MM;
            const measurement_factor = Math.abs(modeFactors.yawMeasurementMm) / TORSION_NORMALIZER_MM;
            const combined_factor = torque_factor * measurement_factor;
            
            const freq_multiplier = Math.max(YAW_FREQ_FLOOR, YAW_FREQ_MULT * Math.sqrt(stiffness_multiplier));
            const twist_freq = center_freq * freq_multiplier;
            
            const twist_amp = (base_amplitude * combined_factor * YAW_AMP_COEFF) / (stiffness_multiplier * preload_damping_factor);  
            const twist_w = twist_freq * damping_ratio * TORSION_DAMPING_WIDTH * preload_damping_factor; 
            val += lorentzianAt(f, twist_freq, twist_w, twist_amp);
        }

        // 3. Roll/Pitch Secondary Peak
        if (Math.abs(modeFactors.tiltTorqueMm) > 0 && Math.abs(modeFactors.tiltMeasurementMm) > 0) {
            const torque_factor = Math.abs(modeFactors.tiltTorqueMm) / TORSION_NORMALIZER_MM;
            const measurement_factor = Math.abs(modeFactors.tiltMeasurementMm) / TORSION_NORMALIZER_MM;
            const combined_factor = torque_factor * measurement_factor;

            const freq_multiplier = Math.max(ROLL_PITCH_FREQ_FLOOR, ROLL_PITCH_FREQ_MULT * Math.sqrt(stiffness_multiplier));
            const rp_freq = center_freq * freq_multiplier;
            
            const rp_amp = (base_amplitude * combined_factor * ROLL_PITCH_AMP_COEFF) / (stiffness_multiplier * preload_damping_factor); 
            const rp_w = rp_freq * damping_ratio * TORSION_DAMPING_WIDTH * preload_damping_factor;
            val += lorentzianAt(f, rp_freq, rp_w, rp_amp);
        }

        // 4. Local measurement-point flex. This represents deformation between
        // the carriage and nozzle/toolhead-mounted sensor, so it does not require
        // a non-zero COM offset like rigid-body yaw/pitch/roll does.
        if (modeFactors.localFlexLeverMm > 0 && modeFactors.localFlexParticipation > 0) {
            const lever_factor = modeFactors.localFlexLeverMm / TORSION_NORMALIZER_MM;
            const freq_multiplier = Math.max(LOCAL_FLEX_FREQ_FLOOR, LOCAL_FLEX_FREQ_MULT * Math.sqrt(toolhead_stiffness));
            const flex_freq = center_freq * freq_multiplier;
            const flex_amp = (base_amplitude * lever_factor * lever_factor * LOCAL_FLEX_AMP_COEFF * modeFactors.localFlexParticipation) /
                (Math.pow(toolhead_stiffness, 1.25) * preload_damping_factor);
            const flex_w = flex_freq * damping_ratio * LOCAL_FLEX_DAMPING_WIDTH * preload_damping_factor;
            val += lorentzianAt(f, flex_freq, flex_w, flex_amp);
        }

        if (external_sway > 0) {
            const sway_freq = external_sway_freq;
            const sway_amp = base_amplitude * (external_sway / 100.0) * 0.25; 
            const broadening_factor = 1.0 + (squishy_materials / 20.0); 
            const sway_w = sway_freq * damping_ratio * (5.8 * broadening_factor); 
            val += lorentzianAt(f, sway_freq, sway_w, sway_amp);
        }

        if (hose_drag > 0) {
            const drag_freq = hose_drag_freq;
            const drag_amp = base_amplitude * (hose_drag / 100.0) * 0.35;
            const hose_broadening = 1.0 + (hose_squishy / 15.0);
            const drag_w = drag_freq * damping_ratio * (11.6 * hose_broadening);
            val += lorentzianAt(f, drag_freq, drag_w, drag_amp);
        }

        if (belt_tension_delta > 0) {
            const delta_ratio = (belt_tension_delta / 100.0) * 0.5; 
            const peak2_freq = center_freq * (1.0 - delta_ratio);
            const peak2_amp = base_amplitude * 0.85; 
            const peak2_w = peak2_freq * damping_ratio * 2.0;
            val += lorentzianAt(f, peak2_freq, peak2_w, peak2_amp);
        }

        if (gantry_racking > 0 && axis === 'y') {
            const racking_freq = center_freq * 1.15;
            const racking_amp = base_amplitude * (gantry_racking / 100.0) * 0.9;
            const racking_w = racking_freq * damping_ratio * 2.0;
            val += lorentzianAt(f, racking_freq, racking_w, racking_amp);
        }

        if (speed && speed.print_speed > 0) {
            const v = speed.print_speed;
            const mesh_freq = v / 2.0;
            const mesh_amp = base_amplitude * (v / 2000.0) * 0.5;
            const mesh_w = mesh_freq * damping_ratio * 3.0;
            val += lorentzianAt(f, mesh_freq, mesh_w, mesh_amp);
        }
        
        out_psd[i] = val;
    }
    return out_psd;
}

// --- Time Domain Simulation --- //

function _evaluate_step(t: number, wn: number, wd: number, damping_ratio: number, z_over_sqrt: number): number {
    if (t < 0) return 0.0;
    const envelope = Math.exp(-damping_ratio * wn * t);
    const osc = Math.cos(wd * t) + z_over_sqrt * Math.sin(wd * t);
    return 1.0 - envelope * osc;
}

export function generate_step_responses(center_freq: number, damping_ratio: number, shaper: Shaper | null, t_max: number = 0.250, dt: number = 0.0005) {
    const wn = 2.0 * Math.PI * center_freq;
    const dr = Math.min(damping_ratio, 0.999);
    const wd = wn * Math.sqrt(1.0 - dr * dr);
    const z_over_sqrt = dr / Math.sqrt(1.0 - dr * dr);
    
    let sum_A = 0.0;
    if (shaper && shaper.A) {
        for (let j = 0; j < shaper.A.length; j++) sum_A += shaper.A[j];
    }
    
    const num_steps = Math.floor(t_max / dt) + 1;
    const times = new Float64Array(num_steps);
    const unshaped = new Float64Array(num_steps);
    const shaped = new Float64Array(num_steps);
    
    for (let i = 0; i < num_steps; i++) {
        const t = i * dt;
        times[i] = t;
        unshaped[i] = _evaluate_step(t, wn, wd, dr, z_over_sqrt);
        
        let y_shaped = 0;
        if (shaper && shaper.A && shaper.T && sum_A > 0) {
            for (let j = 0; j < shaper.A.length; j++) {
                y_shaped += (shaper.A[j] / sum_A) * _evaluate_step(t - shaper.T[j], wn, wd, dr, z_over_sqrt);
            }
        } else {
            y_shaped = unshaped[i];
        }
        shaped[i] = y_shaped;
    }
    
    return { times, unshaped, shaped };
}

export function estimate_shaper(shaper: Shaper, test_damping_ratio: number, freqs: Float64Array | number[], memo: { omega: Float64Array, damping: Float64Array, omega_d: Float64Array, length: number } | null = null, outBuffer: Float64Array | null = null): Float64Array {
    const { A, T } = shaper;
    const n = A.length;
    let sum_A = 0.0;
    for (let i = 0; i < n; i++) sum_A += A[i];
    const inv_D = 1.0 / sum_A;
    const T_last = T[n - 1];
    
    const useMemo = memo && memo.length === freqs.length;
    const df = Math.sqrt(1.0 - test_damping_ratio * test_damping_ratio);

    const out = outBuffer || new Float64Array(freqs.length);
    for (let k = 0; k < freqs.length; k++) {
        const omega = useMemo ? memo.omega[k] : 2.0 * Math.PI * freqs[k];
        const damping = useMemo ? memo.damping[k] : test_damping_ratio * omega;
        const omega_d = useMemo ? memo.omega_d[k] : omega * df;
        
        let S = 0.0;
        let C = 0.0;
        for (let i = 0; i < n; i++) {
            const w = A[i] * Math.exp(-damping * (T_last - T[i]));
            S += w * Math.sin(omega_d * T[i]);
            C += w * Math.cos(omega_d * T[i]);
        }
        out[k] = Math.sqrt(S * S + C * C) * inv_D;
    }
    return out;
}

export function estimate_remaining_vibrations(shaper: Shaper, test_damping_ratio: number, freqs: Float64Array | number[], psd: Float64Array | number[], memo: { omega: Float64Array, damping: Float64Array, omega_d: Float64Array, length: number } | null = null, outBuffer: Float64Array | null = null): { fraction: number, vals: Float64Array } {
    const vals = estimate_shaper(shaper, test_damping_ratio, freqs, memo, outBuffer);
    let psd_max = 0.0;
    for (let i = 0; i < psd.length; i++) if (psd[i] > psd_max) psd_max = psd[i];
    const vibr_threshold = psd_max / SHAPER_VIBRATION_REDUCTION;

    let remaining = 0.0;
    let all_vib = 0.0;
    for (let i = 0; i < psd.length; i++) {
        const r = vals[i] * psd[i] - vibr_threshold;
        if (r > 0) remaining += r;
        const a = psd[i] - vibr_threshold;
        if (a > 0) all_vib += a;
    }
    const fraction = all_vib > 0 ? remaining / all_vib : 0.0;
    return { fraction, vals };
}

export interface ShaperScore {
    max_accel: number;
    vibrations: number;
    smoothing: number;
    freq: number;
}

export type ShaperScoringMode = 'interactive' | 'exact';

interface ShaperCandidate {
    max_accel: number;
    vibrs: number;
    smoothing: number;
    freq: number;
    score: number;
}

type InternalShaperScore = ShaperScore & {
    name: string;
    score: number;
    vibrs: number;
};

function buildMathMemo(freqs: Float64Array | number[], damping_ratio: number) {
    const df = Math.sqrt(1.0 - damping_ratio * damping_ratio);
    const memo = {
        omega: new Float64Array(freqs.length),
        damping: new Float64Array(freqs.length),
        omega_d: new Float64Array(freqs.length),
        length: freqs.length
    };
    for (let k = 0; k < freqs.length; k++) {
        memo.omega[k] = 2.0 * Math.PI * (freqs[k] as number);
        memo.damping[k] = damping_ratio * memo.omega[k];
        memo.omega_d[k] = memo.omega[k] * df;
    }
    return memo;
}

function isScoreBetter(candidate: ShaperCandidate, selected: ShaperCandidate): boolean {
    const eps = 1e-12;
    return candidate.score < selected.score - eps ||
        (Math.abs(candidate.score - selected.score) <= eps && candidate.freq > selected.freq);
}

function isVibrationBetter(candidate: ShaperCandidate, selected: ShaperCandidate): boolean {
    const eps = 1e-12;
    return candidate.vibrs < selected.vibrs - eps ||
        (Math.abs(candidate.vibrs - selected.vibrs) <= eps && candidate.freq > selected.freq);
}

function toInternalScore(name: string, candidate: ShaperCandidate): InternalShaperScore {
    return {
        max_accel: candidate.max_accel,
        vibrations: candidate.vibrs * 100.0,
        vibrs: candidate.vibrs,
        smoothing: candidate.smoothing,
        freq: candidate.freq,
        score: candidate.score,
        name
    };
}

function addFrequencyCandidate(candidates: number[], seen: Set<string>, freq: number): void {
    const rounded = Math.round(freq * 10.0) / 10.0;
    const key = rounded.toFixed(1);
    if (!seen.has(key)) {
        seen.add(key);
        candidates.push(rounded);
    }
}

function buildInteractiveShaperFreqs(minFreq: number, maxHz: number): number[] {
    const startFreq = maxHz >= minFreq ? minFreq : Math.max(SHAPER_FINE_STEP_HZ, maxHz);
    const candidates: number[] = [];
    const seen = new Set<string>();

    addFrequencyCandidate(candidates, seen, maxHz);
    const coarseSteps = Math.max(0, Math.floor((maxHz - startFreq) / SHAPER_COARSE_STEP_HZ + 1e-9));
    for (let i = coarseSteps; i >= 0; i--) {
        addFrequencyCandidate(candidates, seen, startFreq + i * SHAPER_COARSE_STEP_HZ);
    }
    return candidates.sort((a, b) => b - a);
}

function addFineShaperFreqs(candidates: number[], seen: Set<string>, centerFreq: number, minFreq: number, maxHz: number): void {
    const fineMin = Math.max(minFreq, centerFreq - SHAPER_FINE_WINDOW_HZ);
    const fineMax = Math.min(maxHz, centerFreq + SHAPER_FINE_WINDOW_HZ);
    const steps = Math.max(0, Math.floor((fineMax - fineMin) / SHAPER_FINE_STEP_HZ + 1e-9));
    for (let i = steps; i >= 0; i--) {
        addFrequencyCandidate(candidates, seen, fineMin + i * SHAPER_FINE_STEP_HZ);
    }
}

function buildExactShaperFreqs(minFreq: number, maxHz: number): number[] {
    const startFreq = maxHz >= minFreq ? minFreq : Math.max(SHAPER_FINE_STEP_HZ, maxHz);
    const candidates: number[] = [];
    const seen = new Set<string>();
    const steps = Math.max(0, Math.floor((maxHz - startFreq) / SHAPER_FINE_STEP_HZ + 1e-9));
    for (let i = steps; i >= 0; i--) {
        addFrequencyCandidate(candidates, seen, startFreq + i * SHAPER_FINE_STEP_HZ);
    }
    return candidates;
}

function scoreShapersWithMode(rawPsd: Float64Array | number[], freqs: Float64Array | number[], max_hz: number, scv: number, mode: ShaperScoringMode): { results: Record<string, ShaperScore>, best_shaper: string } {
    let best_shaper = '';
    let best_shaper_obj: InternalShaperScore | null = null;
    const all_shapers: InternalShaperScore[] = [];
    const results: Record<string, ShaperScore> = {};

    const mathMemos = TEST_DAMPING_RATIOS.map((dr) => buildMathMemo(freqs, dr));
    const valsBuffer = new Float64Array(freqs.length);

    for (const s of Object.keys(SHAPERS)) {
        let best_res: ShaperCandidate | null = null;
        const test_results: ShaperCandidate[] = [];

        const testFreq = (f_test: number) => {
            const shaper = SHAPERS[s](f_test, DEFAULT_DAMPING_RATIO);
            let fraction = 0.0;
            for (let i = 0; i < TEST_DAMPING_RATIOS.length; i++) {
                const res = estimate_remaining_vibrations(
                    shaper, TEST_DAMPING_RATIOS[i], freqs, rawPsd, mathMemos[i], valsBuffer
                );
                if (res.fraction > fraction) fraction = res.fraction;
            }
            const max_accel = find_shaper_max_accel(shaper, scv);
            const smoothing = get_shaper_smoothing(shaper, 5000, scv);
            
            // Klipper's exact empirical scoring formula
            const shaper_score = smoothing * (Math.pow(fraction, 1.5) + fraction * 0.2 + 0.01);
            
            const res = { freq: f_test, vibrs: fraction, smoothing, score: shaper_score, max_accel };
            test_results.push(res);
            
            if (!best_res || isVibrationBetter(res, best_res)) {
                best_res = res;
            }
        };
        
        const minFreq = Math.min(SHAPER_MIN_FREQS[s] ?? 10.0, max_hz);
        if (mode === 'exact') {
            for (const f_test of buildExactShaperFreqs(minFreq, max_hz)) {
                testFreq(f_test);
            }
        } else {
            const candidateFreqs = buildInteractiveShaperFreqs(minFreq, max_hz);
            const seenFreqs = new Set(candidateFreqs.map((freq) => freq.toFixed(1)));
            for (const f_test of candidateFreqs) {
                testFreq(f_test);
            }
            addFineShaperFreqs(candidateFreqs, seenFreqs, best_res!.freq, minFreq, max_hz);
            for (const f_test of candidateFreqs.sort((a, b) => b - a)) {
                if (!test_results.some((res) => Math.abs(res.freq - f_test) < 1e-9)) {
                    testFreq(f_test);
                }
            }
        }

        let selected = best_res!;
        for (let i = test_results.length - 1; i >= 0; i--) {
            const res = test_results[i];
            if (res.vibrs < best_res!.vibrs * 1.1 + 0.0005 && isScoreBetter(res, selected)) {
                selected = res;
            }
        }

        let final_shaper_result = toInternalScore(s, selected);
        
        // Klipper's empirical shaper selection logic
        if (!best_shaper_obj || final_shaper_result.score * 1.2 < best_shaper_obj.score ||
            (final_shaper_result.score * 1.05 < best_shaper_obj.score && final_shaper_result.smoothing * 1.1 < best_shaper_obj.smoothing)) {
            best_shaper_obj = final_shaper_result;
            best_shaper = s;
        }

        // Klipper can still pick another fitted frequency if it improves both
        // vibration and smoothing against the current global best shaper.
        if (best_shaper_obj) {
            for (let i = test_results.length - 1; i >= 0; i--) {
                const res = test_results[i];
                if (res.vibrs < best_shaper_obj.vibrs && res.smoothing < best_shaper_obj.smoothing) {
                    final_shaper_result = toInternalScore(s, res);
                    best_shaper_obj = final_shaper_result;
                    best_shaper = s;
                }
            }
        }

        results[s] = final_shaper_result;
        all_shapers.push(final_shaper_result);
    }

    // Klipper's final override: If ZV is selected but another shaper has >10% better vibration reduction, use it instead.
    if (best_shaper === 'zv') {
        for (const tuned_shaper of all_shapers) {
            const hasBetterVibrations = tuned_shaper.name !== 'zv' && tuned_shaper.vibrs * 1.1 < best_shaper_obj!.vibrs;
            const shouldOverride = mode === 'exact'
                ? hasBetterVibrations
                : hasBetterVibrations && tuned_shaper.score * 1.2 < best_shaper_obj!.score;
            if (shouldOverride) {
                best_shaper = tuned_shaper.name;
                break;
            }
        }
    }

    // Fallback if somehow no shaper was selected
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

export function scoreShapers(rawPsd: Float64Array | number[], freqs: Float64Array | number[], max_hz: number, scv: number): { results: Record<string, ShaperScore>, best_shaper: string } {
    return scoreShapersWithMode(rawPsd, freqs, max_hz, scv, 'interactive');
}

export function scoreShapersExact(rawPsd: Float64Array | number[], freqs: Float64Array | number[], max_hz: number, scv: number): { results: Record<string, ShaperScore>, best_shaper: string } {
    return scoreShapersWithMode(rawPsd, freqs, max_hz, scv, 'exact');
}
