/**
 * Shaper-Sim 2.0 Pre-Built Printer Profiles
 * This file contains baseline mechanical parameters for popular 3D printer platforms.
 */

const PRINTER_PROFILES = {
    "voron_24_350": {
        "name": "Voron 2.4 (350mm)",
        "toolhead_weight": 450,
        "y_gantry_weight": 650,
        "belt_length": 2200,
        "belt_type": "12000",
        "frame_stiffness": 1.0,
        "motor_torque": 550,
        "motor_inertia": 84.5
    },
    "voron_24_250": {
        "name": "Voron 2.4 (250mm)",
        "toolhead_weight": 450,
        "y_gantry_weight": 550,
        "belt_length": 1800,
        "belt_type": "12000",
        "frame_stiffness": 1.5,
        "motor_torque": 550,
        "motor_inertia": 84.5
    },
    "voron_v0": {
        "name": "Voron V0.2 / V0.3",
        "toolhead_weight": 200,
        "y_gantry_weight": 300,
        "belt_length": 1100,
        "belt_type": "12000",
        "frame_stiffness": 2.5,
        "motor_torque": 220,
        "motor_inertia": 18.0
    },
    "ratrig_vcore3_300": {
        "name": "RatRig V-Core 3 (300mm)",
        "toolhead_weight": 550,
        "y_gantry_weight": 900,
        "belt_length": 2400,
        "belt_type": "18000",
        "frame_stiffness": 3.0,
        "motor_torque": 850,
        "motor_inertia": 120.0
    },
    "v-box_v1": {
        "name": "V-Box V1 (Experimental)",
        "toolhead_weight": 400,
        "y_gantry_weight": 500,
        "belt_length": 1600,
        "belt_type": "18000",
        "frame_stiffness": 6.0,
        "motor_torque": 600,
        "motor_inertia": 95.0
    },
    "bambulab_x1c": {
        "name": "Bambu Lab X1-C (Reference)",
        "toolhead_weight": 350,
        "y_gantry_weight": 400,
        "belt_length": 1400,
        "belt_type": "12000",
        "frame_stiffness": 5.0,
        "motor_torque": 450,
        "motor_inertia": 60.0
    }
};

if (typeof module !== 'undefined') {
    module.exports = { PRINTER_PROFILES };
}
