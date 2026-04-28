export interface CsvOverlay {
    id: string;
    label: string;
    axis: 'x' | 'y' | 'both';
    freqs: Float64Array;
    psd: Float64Array;
}

function splitCsvLine(line: string): string[] {
    return line.split(',').map((part) => part.trim());
}

export function parseKlipperCsv(text: string, filename: string): CsvOverlay | null {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    if (lines.length < 2) return null;

    const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
    const freqIdx = headers.indexOf('freq');
    if (freqIdx === -1) return null;

    let psdIdx = headers.indexOf('psd_xyz');
    if (psdIdx === -1) psdIdx = headers.indexOf('psd_x');
    if (psdIdx === -1) psdIdx = headers.findIndex((header) => header.startsWith('psd'));
    if (psdIdx === -1) return null;

    const freqs: number[] = [];
    const psd: number[] = [];
    for (let i = 1; i < lines.length; i++) {
        const parts = splitCsvLine(lines[i]);
        const f = Number.parseFloat(parts[freqIdx]);
        const p = Number.parseFloat(parts[psdIdx]);
        if (Number.isFinite(f) && Number.isFinite(p) && f > 0) {
            freqs.push(f);
            psd.push(p);
        }
    }
    if (freqs.length === 0) return null;

    const lower = filename.toLowerCase();
    const axis: CsvOverlay['axis'] =
        /_x[_.]/.test(lower) ? 'x' :
        /_y[_.]/.test(lower) ? 'y' : 'both';

    return {
        id: `${filename}_${Date.now()}`,
        label: filename.replace(/\.csv$/i, ''),
        axis,
        freqs: new Float64Array(freqs),
        psd: new Float64Array(psd)
    };
}
