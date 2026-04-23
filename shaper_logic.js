/**
 * Kalico Input Shaper Simulator Logic
 *
 * ATTRIBUTION NOTICE:
 * The mathematical models for evaluating Input Shapers, calculating frequency
 * responses, and calculating remaining vibrations are direct Javascript ports
 * of the logic found in Klipper3d's 'shaper_calibrate.py' and 'shaper_defs.py'.
 *
 * Klipper3d is licensed under the GNU GPLv3 license.
 * Original source: https://github.com/Klipper3d/klipper (klippy/extras/)
 */

const SHAPER_VIBRATION_REDUCTION = 20.0;
const DEFAULT_DAMPING_RATIO = 0.1;
const KLIPPER_TARGET_SMOOTHING = 0.12;

// --- Shaper Generators --- //

function get_zv_shaper(shaper_freq, damping_ratio) {
    let df = Math.sqrt(1.0 - Math.pow(damping_ratio, 2));
    let K = Math.exp(-damping_ratio * Math.PI / df);
    let t_d = 1.0 / (shaper_freq * df);
    let A = [1.0, K];
    let T = [0.0, 0.5 * t_d];
    return { A, T };
}

function get_mzv_shaper(shaper_freq, damping_ratio) {
    let df = Math.sqrt(1.0 - Math.pow(damping_ratio, 2));
    let K = Math.exp(-0.75 * damping_ratio * Math.PI / df);
    let t_d = 1.0 / (shaper_freq * df);

    let a1 = 1.0 - 1.0 / Math.sqrt(2.0);
    let a2 = (Math.sqrt(2.0) - 1.0) * K;
    let a3 = a1 * K * K;

    let A = [a1, a2, a3];
    let T = [0.0, 0.375 * t_d, 0.75 * t_d];
    return { A, T };
}

function get_ei_shaper(shaper_freq, damping_ratio) {
    let v_tol = 1.0 / SHAPER_VIBRATION_REDUCTION;
    let df = Math.sqrt(1.0 - Math.pow(damping_ratio, 2));
    let t_d = 1.0 / (shaper_freq * df);
    let dr = damping_ratio;

    let a1 = (0.24968 + 0.24961 * v_tol) + ((0.80008 + 1.23328 * v_tol) + (0.49599 + 3.17316 * v_tol) * dr) * dr;
    let a3 = (0.25149 + 0.21474 * v_tol) + ((-0.83249 + 1.41498 * v_tol) + (0.85181 - 4.90094 * v_tol) * dr) * dr;
    let a2 = 1.0 - a1 - a3;

    let t2 = 0.4999 + (((0.46159 + 8.57843 * v_tol) * v_tol) + (((4.26169 - 108.644 * v_tol) * v_tol) + ((1.75601 + 336.989 * v_tol) * v_tol) * dr) * dr) * dr;

    let A = [a1, a2, a3];
    let T = [0.0, t2 * t_d, t_d];
    return { A, T };
}

function _get_shaper_from_expansion_coeffs(shaper_freq, damping_ratio, t_arr, a_arr) {
    let tau = 1.0 / shaper_freq;
    let T = [];
    let A = [];
    let n = a_arr.length;
    let k = a_arr[0].length;
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

function get_2hump_ei_shaper(shaper_freq, damping_ratio) {
    let t = [
        [0.0, 0.0, 0.0, 0.0],
        [0.49890, 0.16270, -0.54262, 6.16180],
        [0.99748, 0.18382, -1.58270, 8.17120],
        [1.49920, -0.09297, -0.28338, 1.85710]
    ];
    let a = [
        [0.16054, 0.76699, 2.26560, -1.22750],
        [0.33911, 0.45081, -2.58080, 1.73650],
        [0.34089, -0.61533, -0.68765, 0.42261],
        [0.15997, -0.60246, 1.00280, -0.93145]
    ];
    return _get_shaper_from_expansion_coeffs(shaper_freq, damping_ratio, t, a);
}

function get_3hump_ei_shaper(shaper_freq, damping_ratio) {
    let t = [
        [0.0, 0.0, 0.0, 0.0],
        [0.49974, 0.23834, 0.44559, 12.4720],
        [0.99849, 0.29808, -2.36460, 23.3990],
        [1.49870, 0.10306, -2.01390, 17.0320],
        [1.99960, -0.28231, 0.61536, 5.40450]
    ];
    let a = [
        [0.11275, 0.76632, 3.29160, -1.44380],
        [0.23698, 0.61164, -2.57850, 4.85220],
        [0.30008, -0.19062, -2.14560, 0.13744],
        [0.23775, -0.73297, 0.46885, -2.08650],
        [0.11244, -0.45439, 0.96382, -1.46000]
    ];
    return _get_shaper_from_expansion_coeffs(shaper_freq, damping_ratio, t, a);
}

// --- Smoothing and Accel Math --- //
// Ported verbatim from Klipper's ShaperCalibrate._get_shaper_smoothing,
// ._bisect, and .find_shaper_max_accel (klippy/extras/shaper_calibrate.py).

function get_shaper_smoothing(shaper, accel = 5000, scv = 5.0) {
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

function _bisect(func) {
    let left = 1.0;
    let right = 1.0;
    if (!func(1e-9)) return 0.0;

    while (!func(left)) {
        right = left;
        left *= 0.5;
    }
    if (right === left) {
        while (func(right)) {
            right *= 2.0;
        }
    }
    while (right - left > 1e-8) {
        const middle = (left + right) * 0.5;
        if (func(middle)) {
            left = middle;
        } else {
            right = middle;
        }
    }
    return left;
}

function find_shaper_max_accel(shaper, scv) {
    return _bisect(
        (test_accel) => get_shaper_smoothing(shaper, test_accel, scv) <= KLIPPER_TARGET_SMOOTHING
    );
}

// --- Predictive Mechanical Model --- //

function predict_resonance(mass_g, belt_EA, tension_N, frame_multiplier, belt_length_mm, drive_type = 2, motor_torque_mNm = 550, motor_current_pct = 70, motor_rotor_teeth = 50, pulley_teeth = 20, motor_inertia_g_cm2 = 84.5, belt_density_kg_m = 0.0012) {
    // M = mass in kg
    let M = mass_g / 1000.0;
    let L = belt_length_mm / 1000.0;
    
    // Non-linear belt stiffening: 
    // Belts exhibit a higher elastic modulus under tension as slack is removed.
    // However, there are significant diminishing returns once the belt is fully taut.
    // We scale the "tautness" threshold based on belt width (a wider belt needs more tension to pull all its cords tight).
    let width_mm = belt_EA / 2000.0;
    let tension_knee = 5.0 * width_mm; // 30N for 6mm, 45N for 9mm, 60N for 12mm
    let stiffening_factor = 1.0 + (1.5 * (1.0 - Math.exp(-tension_N / tension_knee))); 
    let effective_EA = belt_EA * stiffening_factor;

    // CoreXY Stiffness Model: Both A and B belts act in parallel.
    let Kbelt = (8.0 * effective_EA) / L; 
    
    // If AWD (drive_type == 4), the maximum unsupported belt length is halved, doubling the stiffness
    if (drive_type === 4) {
        Kbelt *= 2.0;
    }
    
    // Baseline frame/gantry stiffness.
    // A standard 2020 extrusion gantry might be ~500,000 N/m effective at the toolhead.
    // We make the frame multiplier exponential to simulate the massive rigidity difference 
    // between acrylic (0.5^2 = 0.25) and thick aluminum plates (3.0^2 = 9.0) or solid CNC (5.0^2 = 25.0).
    let Kframe = 500000.0 * Math.pow(frame_multiplier, 2.0);
    
    // Motor Rotor Magnetic Spring Stiffness
    // K_theta (Nm/rad) = Holding_Torque_Nm * Rotor_Teeth
    // Run current and microstepping compliance reduces effective holding torque
    // Overdriving past 100% hits magnetic saturation with diminishing returns
    let current_ratio = motor_current_pct / 100.0;
    let saturation_factor = current_ratio;
    if (current_ratio > 1.0) {
        // Asymptotic curve: limits max torque gain to +50% no matter how much current is pushed
        saturation_factor = 1.0 + 0.5 * (1.0 - Math.exp(-2.0 * (current_ratio - 1.0)));
    }
    let effective_torque_Nm = (motor_torque_mNm / 1000.0) * saturation_factor;
    let K_theta = effective_torque_Nm * motor_rotor_teeth;
    
    // Convert torsional stiffness to linear stiffness at the belt: K_linear = K_theta / R^2
    // R = pulley radius in meters. Pitch = 2mm.
    let pulley_radius_m = (pulley_teeth * 2.0) / (2.0 * Math.PI) / 1000.0;
    let Kmotor_single = K_theta / Math.pow(pulley_radius_m, 2);
    
    // CoreXY uses 2 motors in parallel. AWD uses 4.
    let Kmotor_total = Kmotor_single * drive_type;
    
    // Series stiffness: the frame, belts, and motor rotors all flex under load.
    let Keff = 1.0 / (1.0 / Kbelt + 1.0 / Kframe + 1.0 / Kmotor_total);
    
    // Dynamic Mass Additions
    // 1. Motor Rotor Inertia
    let J_kg_m2 = motor_inertia_g_cm2 * 1e-7;
    let Mrotor_single = J_kg_m2 / Math.pow(pulley_radius_m, 2);
    let Mrotor_total = Mrotor_single * drive_type;
    
    // 2. Belt Mass
    let Mbelt_total = belt_density_kg_m * (L / 2.0) * (1.0 / 3.0);
    
    // Decouple rotor mass: because it sits behind the stretchy belt spring, the toolhead 
    // doesn't "feel" the full mass of the rotors during high-frequency resonance.
    // We apply an empirical coupling factor (e.g., 15%) to prevent the 1-DOF math from collapsing.
    let inertial_coupling_factor = 0.15;
    M = M + (Mrotor_total * inertial_coupling_factor) + Mbelt_total;
    
    // f = 1/(2pi) * sqrt(K/M)
    let f = (1.0 / (2.0 * Math.PI)) * Math.sqrt(Keff / M);
    return f;
}

const SHAPERS = {
    zv: get_zv_shaper,
    mzv: get_mzv_shaper,
    ei: get_ei_shaper,
    '2hump_ei': get_2hump_ei_shaper,
    '3hump_ei': get_3hump_ei_shaper
};

// --- PSD Simulation --- //

function generate_psd_curve(center_freq, freqs, imperfections = {}) {
    const {
        axis = 'x',
        toolhead_mass = 500,
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
    
    // Also extract cross_twist safely, defaulting to 0 if missing
    const cross_twist = imperfections.cross_twist || 0;

    const base_amplitude = 1e5;
    
    // Q factor based on damping ratio. Default damping 0.1 -> Q=5
    // Lower damping = sharper, taller peak
    const Q = 1.0 / (2.0 * damping_ratio);
    const w = center_freq / Q; 
    
    return freqs.map(f => {
        let val = 0;
        
        // 1. Primary Resonance Peak (Lorentzian)
        val += base_amplitude / (1.0 + Math.pow((f - center_freq) / w, 2.0));
        
        // 2. Secondary Resonance Peak (Toolhead Twist / COM Offset)
        if (toolhead_twist > 0) {
            // Torque and inertia both scale with mass. Since the primary peak is normalized 
            // to a constant base_amplitude, mass cancels out of the relative ratios!
            // The relative amplitude and frequency shift depend ONLY on the offset distance.
            const offset_factor = toolhead_twist / 30.0; // Normalized around 30mm offset
            
            // Frequency drops as the COM offset moves further out, but depends heavily on toolhead stiffness
            const freq_multiplier = (1.6 - Math.min(0.6, 0.25 * offset_factor)) * toolhead_stiffness;
            const twist_freq = center_freq * freq_multiplier;
            
            // Amplitude ratio scales with the offset distance
            const twist_amp = base_amplitude * offset_factor * 0.8;  
            
            const twist_w = twist_freq / (Q * 1.5); // Twist is usually less damped
            val += twist_amp / (1.0 + Math.pow((f - twist_freq) / twist_w, 2.0));
        }

        // 2.5 Cross-Axis Twist Coupling (Bleed-over)
        if (cross_twist > 0) {
            const offset_factor = cross_twist / 30.0;
            const cross_multiplier = (1.4 - Math.min(0.5, 0.2 * offset_factor)) * toolhead_stiffness;
            const cross_freq = center_freq * cross_multiplier;
            
            const cross_amp = base_amplitude * offset_factor * 0.4;
            
            const cross_w = cross_freq / (Q * 1.5);
            val += cross_amp / (1.0 + Math.pow((f - cross_freq) / cross_w, 2.0));
        }

        // 2.8 Z-Axis Tall Extruder Twist
        if (z_twist > 0) {
            const offset_factor = z_twist / 30.0;
            const z_freq_multiplier = (1.4 - Math.min(0.5, 0.25 * offset_factor)) * toolhead_stiffness;
            const z_freq = center_freq * z_freq_multiplier;
            
            const z_amp = base_amplitude * offset_factor * 0.6; // More violent due to lever arm
            const z_w = z_freq / (Q * 1.5);
            val += z_amp / (1.0 + Math.pow((f - z_freq) / z_w, 2.0));
        }

        // 2.9 External Sway (Wobbly Table / Soft Feet)
        if (external_sway > 0) {
            // Sway happens at very low frequencies, controlled by external_sway_freq.
            const sway_freq = external_sway_freq;
            const sway_amp = base_amplitude * (external_sway / 100.0) * 0.25; // Low power compared to belt resonances
            
            // Squishy materials dynamically broaden the peak (lower Q factor) by introducing non-linear damping
            const broadening_factor = 1.0 + (squishy_materials / 20.0); 
            const sway_w = sway_freq / (Q * (0.345 / broadening_factor)); // Very wide bandwidth because it's a slow wallow
            
            val += sway_amp / (1.0 + Math.pow((f - sway_freq) / sway_w, 2.0));
        }

        // 2.95 Umbilical/Hose Drag
        if (hose_drag > 0) {
            // Hose drag usually acts as a highly damped, low frequency mass (like a bungee cord)
            // It adds a very wide hump to the low frequency spectrum.
            const drag_freq = hose_drag_freq;
            const drag_amp = base_amplitude * (hose_drag / 100.0) * 0.35;
            
            // Damping (Squishy) broadens the peak and makes it more sluggish
            const hose_broadening = 1.0 + (hose_squishy / 15.0);
            
            // Very low Q (high damping) because hoses absorb energy rather than ring
            const drag_w = drag_freq / (Q * (0.1725 / hose_broadening));
            
            val += drag_amp / (1.0 + Math.pow((f - drag_freq) / drag_w, 2.0));
        }

        // 3. Unequal Belt Tension (Split Peak)
        if (belt_tension_delta > 0) {
            // Frequency scales with sqrt(Tension). A 30% tension difference yields ~14% frequency split.
            const delta_ratio = (belt_tension_delta / 100.0) * 0.5; 
            const peak2_freq = center_freq * (1.0 - delta_ratio);
            const peak2_amp = base_amplitude * 0.85; 
            const peak2_w = peak2_freq / Q;
            val += peak2_amp / (1.0 + Math.pow((f - peak2_freq) / peak2_w, 2.0));
        }



        // 5. Gantry Racking (Y-Axis Asymmetry)
        if (gantry_racking > 0 && axis === 'y') {
            // Distinct secondary peak predominately on Y axis due to twisting racking modes
            const racking_freq = center_freq * 1.15;
            const racking_amp = base_amplitude * (gantry_racking / 100.0) * 0.9;
            const racking_w = racking_freq / Q;
            val += racking_amp / (1.0 + Math.pow((f - racking_freq) / racking_w, 2.0));
        }
        return val;
    });
}

// Ported from Klipper's ShaperCalibrate._estimate_shaper.
// Returns the shaper magnitude response |H(f)| evaluated against a test
// damping ratio. The impulse sequence is damping-weighted
// (W_i = A_i * exp(-damping * (T_last - T_i))) and frequency is the
// damped natural frequency omega_d = omega * sqrt(1 - dr^2).
function estimate_shaper(shaper, test_damping_ratio, freqs) {
    const { A, T } = shaper;
    const n = A.length;
    let sum_A = 0.0;
    for (let i = 0; i < n; i++) sum_A += A[i];
    const inv_D = 1.0 / sum_A;
    const T_last = T[n - 1];
    const df = Math.sqrt(1.0 - test_damping_ratio * test_damping_ratio);

    const out = new Float64Array(freqs.length);
    for (let k = 0; k < freqs.length; k++) {
        const omega = 2.0 * Math.PI * freqs[k];
        const damping = test_damping_ratio * omega;
        const omega_d = omega * df;
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

// Ported from Klipper's ShaperCalibrate._estimate_remaining_vibrations.
// Returns { fraction, vals } where `fraction` is in [0, 1]; callers that
// want a percentage should multiply by 100 at the display site.
function estimate_remaining_vibrations(shaper, test_damping_ratio, freqs, psd) {
    const vals = estimate_shaper(shaper, test_damping_ratio, freqs);
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
