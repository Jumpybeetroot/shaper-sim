/**
 * Shared belt density lookup.
 * Extracts the duplicated belt density logic from worker, Sidebar, and physics engine.
 */
export function getBeltDensity(beltType: number): number {
    if (beltType === 18000) return 0.0126; // 9mm GT2
    if (beltType === 20000) return 0.0140; // 10mm GT2
    if (beltType === 25000) return 0.0168; // 12mm GT2
    return 0.0084; // 6mm GT2 (default)
}

export function getBeltTensionN(beltType: number, beltTuneHz: number): number {
    const density = getBeltDensity(beltType);
    return 4 * density * Math.pow(0.15, 2) * Math.pow(beltTuneHz, 2);
}
