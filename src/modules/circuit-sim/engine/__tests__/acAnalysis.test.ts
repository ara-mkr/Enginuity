import { describe, expect, it } from 'vitest';
import { runAC } from '../acAnalysis';
import type { Netlist } from '../types';

/** Interpolates the frequency at which magnitude_db crosses `targetDb`. */
function interpolateCrossingFreq(frequency: number[], magnitudeDb: number[], targetDb: number): number {
  for (let i = 0; i < magnitudeDb.length - 1; i++) {
    const a = magnitudeDb[i];
    const b = magnitudeDb[i + 1];
    if ((a - targetDb) * (b - targetDb) <= 0 && a !== b) {
      const t = (targetDb - a) / (b - a);
      // Interpolate in log-frequency space, since the sweep is log-spaced.
      const logA = Math.log10(frequency[i]);
      const logB = Math.log10(frequency[i + 1]);
      return Math.pow(10, logA + t * (logB - logA));
    }
  }
  throw new Error(`No crossing of ${targetDb} dB found in swept range.`);
}

function closestIndex(frequency: number[], target: number): number {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < frequency.length; i++) {
    const diff = Math.abs(frequency[i] - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

describe('runAC — RC low-pass filter', () => {
  // Source -> R -> node 2 -> C -> ground, output taken at node 2.
  const R = 1000;
  const C = 1e-7;
  const fCutoff = 1 / (2 * Math.PI * R * C);

  function rcNetlist(): Netlist {
    return {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: 1 },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: R },
        { id: 'C1', type: 'capacitor', nodes: [2, 0], value: C },
      ],
    };
  }

  it('has its -3dB point at 1/(2*pi*R*C)', () => {
    const result = runAC(rcNetlist(), {
      startFreq: fCutoff / 100,
      stopFreq: fCutoff * 100,
      pointsPerDecade: 50,
      acSourceId: 'V1',
    });

    const crossing = interpolateCrossingFreq(result.frequency, result.magnitude_db[2], -3);
    expect(Math.abs(crossing - fCutoff) / fCutoff).toBeLessThan(0.02);
  });

  it('is near 0dB a decade below cutoff and rolls off at ~-20dB/decade above it', () => {
    const result = runAC(rcNetlist(), {
      startFreq: fCutoff / 1000,
      stopFreq: fCutoff * 1000,
      pointsPerDecade: 50,
      acSourceId: 'V1',
    });

    const lowIdx = closestIndex(result.frequency, fCutoff / 10);
    expect(result.magnitude_db[2][lowIdx]).toBeGreaterThan(-0.5);

    const highIdx = closestIndex(result.frequency, fCutoff * 100);
    const highIdxTimes10 = closestIndex(result.frequency, fCutoff * 1000);
    const slope = result.magnitude_db[2][highIdxTimes10] - result.magnitude_db[2][highIdx];
    expect(slope).toBeCloseTo(-20, 0);
  });

  it('phase is near 0deg well below cutoff and near -90deg well above it', () => {
    const result = runAC(rcNetlist(), {
      startFreq: fCutoff / 1000,
      stopFreq: fCutoff * 1000,
      pointsPerDecade: 50,
      acSourceId: 'V1',
    });

    const lowIdx = closestIndex(result.frequency, fCutoff / 1000);
    expect(Math.abs(result.phase_deg[2][lowIdx])).toBeLessThan(1);

    const highIdx = closestIndex(result.frequency, fCutoff * 100);
    expect(Math.abs(result.phase_deg[2][highIdx] - -90)).toBeLessThan(1);
  });
});

describe('runAC — RLC series resonance', () => {
  // Source -> R -> node 2 -> L -> node 3 -> C -> ground, output at node 3.
  const R = 10;
  const L = 1e-3;
  const C = 1e-9;
  const fResonance = 1 / (2 * Math.PI * Math.sqrt(L * C));

  function rlcNetlist(): Netlist {
    return {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: 1 },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: R },
        { id: 'L1', type: 'inductor', nodes: [2, 3], value: L },
        { id: 'C1', type: 'capacitor', nodes: [3, 0], value: C },
      ],
    };
  }

  it('peaks at the output near f = 1/(2*pi*sqrt(L*C))', () => {
    const result = runAC(rlcNetlist(), {
      startFreq: fResonance / 20,
      stopFreq: fResonance * 20,
      pointsPerDecade: 200,
      acSourceId: 'V1',
    });

    let peakIdx = 0;
    for (let i = 1; i < result.magnitude_db[3].length; i++) {
      if (result.magnitude_db[3][i] > result.magnitude_db[3][peakIdx]) peakIdx = i;
    }
    const peakFreq = result.frequency[peakIdx];

    expect(Math.abs(peakFreq - fResonance) / fResonance).toBeLessThan(0.02);
  });
});
