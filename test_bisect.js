const fs = require("fs"); eval(fs.readFileSync("shaper_logic.js", "utf8"));
function _bisect_fix(func) {
    let left = 1.0;
    let right = 1.0;
    if (!func(1e-9)) return 0.0;
    while (!func(left)) { right = left; left *= 0.5; }
    if (right === left) {
        while (func(right)) { left = right; right *= 2.0; }
    }
    while (right - left > 1e-8) {
        const middle = (left + right) * 0.5;
        if (func(middle)) left = middle;
        else right = middle;
    }
    return left;
}
let shaper = get_mzv_shaper(158, 0.1);
let a_bug = find_shaper_max_accel(shaper, 5.0);

function find_shaper_max_accel_fix(shaper, scv) {
    return _bisect_fix((test_accel) => get_shaper_smoothing(shaper, test_accel, scv) <= 0.12);
}
let a_fix = find_shaper_max_accel_fix(shaper, 5.0);
console.log("Buggy:", a_bug);
console.log("Fixed:", a_fix);

