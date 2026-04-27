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

export interface Shaper {
    A: number[];
    T: number[];
}

export interface Imperfections {
    axis?: 'x' | 'y';
    toolhead_mass?: number;
    toolhead_twist?: number;
    belt_tension_delta?: number;
    gantry_racking?: number;
    external_sway?: number;
    external_sway_freq?: number;
    hose_drag?: number;
    hose_drag_freq?: number;
    z_twist?: number;
    toolhead_stiffness?: number;
    hose_squishy?: number;
    squishy_materials?: number;
    damping_ratio?: number;
    cross_twist?: number;
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

export function predict_resonance(mass_g: number, belt_EA: number, tension_N: number, frame_multiplier: number, belt_length_mm: number, drive_type: number = 2, motor_torque_mNm: number = 550, motor_current_pct: number = 70, motor_rotor_teeth: number = 50, pulley_teeth: number = 20, motor_inertia_g_cm2: number = 84.5, belt_density_kg_m: number = 0.0012): number {
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
    const effective_torque_Nm = (motor_torque_mNm / 1000.0) * saturation_factor;
    const K_theta = effective_torque_Nm * motor_rotor_teeth;
    
    const pulley_radius_m = (pulley_teeth * 2.0) / (2.0 * Math.PI) / 1000.0;
    const Kmotor_single = K_theta / Math.pow(pulley_radius_m, 2);
    
    const Kmotor_total = Kmotor_single * drive_type;
    
    const Keff = 1.0 / (1.0 / Kbelt + 1.0 / Kframe + 1.0 / Kmotor_total);
    
    const J_kg_m2 = motor_inertia_g_cm2 * 1e-7;
    const Mrotor_single = J_kg_m2 / Math.pow(pulley_radius_m, 2);
    const Mrotor_total = Mrotor_single * drive_type;
    
    const Mbelt_total = belt_density_kg_m * L * (1.0 / 3.0);
    
    const inertial_coupling_factor = (drive_type === 4) ? 0.10 : 0.15;
    M = M + (Mrotor_total * inertial_coupling_factor) + Mbelt_total;
    
    const f = (1.0 / (2.0 * Math.PI)) * Math.sqrt(Keff / M);
    return f;
}

export const SHAPERS: Record<string, (f: number, d: number) => Shaper> = {
    zv: get_zv_shaper,
    mzv: get_mzv_shaper,
    ei: get_ei_shaper,
    '2hump_ei': get_2hump_ei_shaper,
    '3hump_ei': get_3hump_ei_shaper
};

// --- PSD Simulation --- //

export function generate_psd_curve(center_freq: number, freqs: Float64Array | number[], imperfections: Imperfections = {}, out_psd?: Float64Array): Float64Array {
    const {
        axis = 'x',
        toolhead_twist = 0,
        belt_tension_delta = 0,
        gantry_racking = 0,
        external_sway = 0,
        external_sway_freq = 18.0,
        hose_drag = 0,
        hose_drag_freq = 5.0,
        z_twist = 0,
        toolhead_stiffness = 1.0,
        hose_squishy = 0,
        squishy_materials = 0,
        damping_ratio = 0.1
    } = imperfections;
    
    const cross_twist = imperfections.cross_twist || 0;

    const base_amplitude = 1e5 * Math.pow(1.0 / (2.0 * damping_ratio), 2);
    const w = center_freq * damping_ratio;
    
    if (!out_psd) {
        out_psd = new Float64Array(freqs.length);
    }

    for (let i = 0; i < freqs.length; i++) {
        const f = freqs[i];
        let val = 0;
        
        val += base_amplitude / (1.0 + Math.pow((f - center_freq) / w, 2.0));
        
        if (toolhead_twist > 0) {
            const offset_factor = toolhead_twist / 30.0; 
            const freq_multiplier = (1.6 - Math.min(0.6, 0.25 * offset_factor)) * toolhead_stiffness;
            const twist_freq = center_freq * freq_multiplier;
            const twist_amp = base_amplitude * offset_factor * 0.8;  
            const twist_w = twist_freq * damping_ratio * 1.333; 
            val += twist_amp / (1.0 + Math.pow((f - twist_freq) / twist_w, 2.0));
        }

        if (cross_twist > 0) {
            const offset_factor = cross_twist / 30.0;
            const cross_multiplier = (1.4 - Math.min(0.5, 0.2 * offset_factor)) * toolhead_stiffness;
            const cross_freq = center_freq * cross_multiplier;
            const cross_amp = base_amplitude * offset_factor * 0.4;
            const cross_w = cross_freq * damping_ratio * 1.333;
            val += cross_amp / (1.0 + Math.pow((f - cross_freq) / cross_w, 2.0));
        }

        if (z_twist > 0) {
            const offset_factor = z_twist / 30.0;
            const z_freq_multiplier = (1.4 - Math.min(0.5, 0.25 * offset_factor)) * toolhead_stiffness;
            const z_freq = center_freq * z_freq_multiplier;
            const z_amp = base_amplitude * offset_factor * 0.6; 
            const z_w = z_freq * damping_ratio * 1.333;
            val += z_amp / (1.0 + Math.pow((f - z_freq) / z_w, 2.0));
        }

        if (external_sway > 0) {
            const sway_freq = external_sway_freq;
            const sway_amp = base_amplitude * (external_sway / 100.0) * 0.25; 
            const broadening_factor = 1.0 + (squishy_materials / 20.0); 
            const sway_w = sway_freq * damping_ratio * (5.8 * broadening_factor); 
            val += sway_amp / (1.0 + Math.pow((f - sway_freq) / sway_w, 2.0));
        }

        if (hose_drag > 0) {
            const drag_freq = hose_drag_freq;
            const drag_amp = base_amplitude * (hose_drag / 100.0) * 0.35;
            const hose_broadening = 1.0 + (hose_squishy / 15.0);
            const drag_w = drag_freq * damping_ratio * (11.6 * hose_broadening);
            val += drag_amp / (1.0 + Math.pow((f - drag_freq) / drag_w, 2.0));
        }

        if (belt_tension_delta > 0) {
            const delta_ratio = (belt_tension_delta / 100.0) * 0.5; 
            const peak2_freq = center_freq * (1.0 - delta_ratio);
            const peak2_amp = base_amplitude * 0.85; 
            const peak2_w = peak2_freq * damping_ratio * 2.0;
            val += peak2_amp / (1.0 + Math.pow((f - peak2_freq) / peak2_w, 2.0));
        }

        if (gantry_racking > 0 && axis === 'y') {
            const racking_freq = center_freq * 1.15;
            const racking_amp = base_amplitude * (gantry_racking / 100.0) * 0.9;
            const racking_w = racking_freq * damping_ratio * 2.0;
            val += racking_amp / (1.0 + Math.pow((f - racking_freq) / racking_w, 2.0));
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

export function scoreShapers(rawPsd: Float64Array | number[], freqs: Float64Array | number[], max_hz: number, scv: number): { results: Record<string, ShaperScore>, best_shaper: string } {
    let best_shaper = '';
    let best_shaper_obj: ShaperScore & { name: string, score: number } | null = null;
    let all_shapers: (ShaperScore & { name: string, score: number })[] = [];
    let results: Record<string, ShaperScore> = {};

    // Memoize the frequency math once for all shaper iterations
    const mathMemo = {
        omega: new Float64Array(freqs.length),
        damping: new Float64Array(freqs.length),
        omega_d: new Float64Array(freqs.length),
        length: freqs.length
    };
    const df = Math.sqrt(1.0 - DEFAULT_DAMPING_RATIO * DEFAULT_DAMPING_RATIO);
    for (let k = 0; k < freqs.length; k++) {
        mathMemo.omega[k] = 2.0 * Math.PI * (freqs[k] as number);
        mathMemo.damping[k] = DEFAULT_DAMPING_RATIO * mathMemo.omega[k];
        mathMemo.omega_d[k] = mathMemo.omega[k] * df;
    }

    const valsBuffer = new Float64Array(freqs.length);

    for (const s of Object.keys(SHAPERS)) {
        let best_res: { freq: number, vibrs: number, smoothing: number, score: number, max_accel: number } | null = null;
        const test_results: { freq: number, vibrs: number, smoothing: number, score: number, max_accel: number }[] = [];

        const testFreq = (f_test: number) => {
            const shaper = SHAPERS[s](f_test, DEFAULT_DAMPING_RATIO);
            const { fraction } = estimate_remaining_vibrations(shaper, DEFAULT_DAMPING_RATIO, freqs, rawPsd, mathMemo, valsBuffer);
            const max_accel = find_shaper_max_accel(shaper, scv);
            const smoothing = get_shaper_smoothing(shaper, 5000, scv);
            
            // Klipper's exact empirical scoring formula
            const shaper_score = smoothing * (Math.pow(fraction, 1.5) + fraction * 0.2 + 0.01);
            
            const res = { freq: f_test, vibrs: fraction, smoothing, score: shaper_score, max_accel };
            test_results.push(res);
            
            if (!best_res || res.vibrs < best_res.vibrs) {
                best_res = res;
            }
        };
        
        // Pass 1: Coarse sweep (2.0 Hz steps) to find the absolute minimum vibration pocket
        for (let f_test = 10.0; f_test <= max_hz; f_test += 2.0) {
            testFreq(f_test);
        }

        // Pass 2: Fine sweep (+/- 2.0 Hz around coarse best_res, 0.2 Hz steps)
        const coarse_best = best_res.freq;
        const fine_min = Math.max(10.0, coarse_best - 2.0);
        const fine_max = Math.min(max_hz, coarse_best + 2.0);
        for (let f_test = fine_min; f_test <= fine_max; f_test += 0.2) {
            testFreq(f_test);
        }

        // Sort ascending by frequency to match Klipper's evaluation order (lowest to highest)
        test_results.sort((a, b) => a.freq - b.freq);

        let selected = best_res;
        for (let i = 0; i < test_results.length; i++) {
            const res = test_results[i];
            if (res.vibrs < best_res.vibrs * 1.1 + 0.0005 && res.score < selected.score) {
                selected = res;
            }
        }

        const final_shaper_result = {
            max_accel: selected.max_accel,
            vibrations: selected.vibrs * 100.0,
            smoothing: selected.smoothing,
            freq: selected.freq,
            score: selected.score,
            name: s
        };
        
        results[s] = final_shaper_result;
        all_shapers.push(final_shaper_result);

        // Klipper's empirical shaper selection logic
        if (!best_shaper_obj || final_shaper_result.score * 1.2 < best_shaper_obj.score ||
            (final_shaper_result.score * 1.05 < best_shaper_obj.score && final_shaper_result.smoothing * 1.1 < best_shaper_obj.smoothing)) {
            best_shaper_obj = final_shaper_result;
            best_shaper = s;
        }
    }

    // Klipper's final override: If ZV is selected but another shaper has >10% better vibration reduction, use it instead.
    if (best_shaper === 'zv') {
        for (const tuned_shaper of all_shapers) {
            if (tuned_shaper.name !== 'zv' && tuned_shaper.vibrations * 1.1 < best_shaper_obj.vibrations) {
                best_shaper = tuned_shaper.name;
                best_shaper_obj = tuned_shaper;
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
