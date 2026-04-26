const fs = require("fs"); eval(fs.readFileSync("shaper_logic.js", "utf8")); 
function debug_resonance(mass_g, belt_EA, tension_N, frame_multiplier, belt_length_mm, drive_type = 2, motor_torque_mNm = 550, motor_current_pct = 100, motor_rotor_teeth = 50, pulley_teeth = 20, motor_inertia_g_cm2 = 84.5, belt_density_kg_m = 0.0084) {
    let M = mass_g / 1000.0;
    let L = belt_length_mm / 1000.0;
    let width_mm = belt_EA / 2000.0;
    let tension_knee = 3.0 * width_mm;
    let stiffening_factor = 1.0 + (1.1 * (1.0 - Math.exp(-tension_N / tension_knee))); 
    let effective_EA = belt_EA * stiffening_factor;
    let Kbelt = (8.0 * effective_EA) / L; 
    if (drive_type === 4) Kbelt *= 2.0;
    let Kframe = 250000.0 * Math.pow(frame_multiplier, 2.0);
    let current_ratio = motor_current_pct / 100.0;
    let saturation_factor = current_ratio;
    if (current_ratio > 1.0) saturation_factor = 1.0 + 0.5 * (1.0 - Math.exp(-2.0 * (current_ratio - 1.0)));
    let effective_torque_Nm = (motor_torque_mNm / 1000.0) * saturation_factor;
    let K_theta = effective_torque_Nm * motor_rotor_teeth;
    let pulley_radius_m = (pulley_teeth * 2.0) / (2.0 * Math.PI) / 1000.0;
    let Kmotor_single = K_theta / Math.pow(pulley_radius_m, 2);
    let Kmotor_total = Kmotor_single * drive_type;
    let Keff = 1.0 / (1.0 / Kbelt + 1.0 / Kframe + 1.0 / Kmotor_total);
    console.log({M, Mrotor: Kmotor_single * drive_type * 0.15, Kbelt, Kframe, Kmotor_total, Keff});
    return (1.0 / (2.0 * Math.PI)) * Math.sqrt(Keff / (M + (motor_inertia_g_cm2*1e-7/Math.pow(pulley_radius_m,2)*drive_type*0.15) + belt_density_kg_m*L/3.0));
}
console.log(debug_resonance(500, 18000, 50, 1.5, 2000, 4, 550, 100, 50, 20, 84.5, 0.0126));

