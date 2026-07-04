import { describe, expect, it } from 'vitest';
import { runTransient } from '../transientAnalysis';
import { solveDC } from '../dcAnalysis';
import { runAC } from '../acAnalysis';
import { evaluateTimer555Latch } from '../timer555';
import type { Netlist } from '../types';

/** Times of upward crossings of `level` in a sampled series. */
function risingCrossings(time: number[], series: number[], level: number): number[] {
  const crossings: number[] = [];
  for (let i = 1; i < series.length; i++) {
    if (series[i - 1] < level && series[i] >= level) {
      // Linear-interpolate the crossing instant.
      const t = (level - series[i - 1]) / (series[i] - series[i - 1]);
      crossings.push(time[i - 1] + t * (time[i] - time[i - 1]));
    }
  }
  return crossings;
}

function fallingCrossings(time: number[], series: number[], level: number): number[] {
  const crossings: number[] = [];
  for (let i = 1; i < series.length; i++) {
    if (series[i - 1] >= level && series[i] < level) {
      const t = (level - series[i - 1]) / (series[i] - series[i - 1]);
      crossings.push(time[i - 1] + t * (time[i] - time[i - 1]));
    }
  }
  return crossings;
}

describe('evaluateTimer555Latch', () => {
  const Vcc = 5;
  it('sets output high when trigger drops below 1/3 Vcc', () => {
    expect(evaluateTimer555Latch(Vcc, Vcc / 3 - 0.1, 0, false)).toBe(true);
  });
  it('resets output low when threshold rises above 2/3 Vcc', () => {
    expect(evaluateTimer555Latch(Vcc, Vcc, (2 * Vcc) / 3 + 0.1, true)).toBe(false);
  });
  it('holds state in the middle band', () => {
    expect(evaluateTimer555Latch(Vcc, Vcc / 2, Vcc / 2, true)).toBe(true);
    expect(evaluateTimer555Latch(Vcc, Vcc / 2, Vcc / 2, false)).toBe(false);
  });
  it('reset dominates a simultaneous set', () => {
    expect(evaluateTimer555Latch(Vcc, 0, Vcc, true)).toBe(false);
  });
});

describe('runTransient — 555 astable', () => {
  // Nodes: 1=vcc, 0=gnd, 2=dis, 3=thr/trig, 4=out.
  const Vcc = 5;
  const Ra = 1000;
  const Rb = 1000;
  const C = 1e-6;

  function astable(): Netlist {
    return {
      components: [
        { id: 'VCC', type: 'vsource', nodes: [1, 0], value: Vcc },
        { id: 'RA', type: 'resistor', nodes: [1, 2], value: Ra },
        { id: 'RB', type: 'resistor', nodes: [2, 3], value: Rb },
        { id: 'C1', type: 'capacitor', nodes: [3, 0], value: C },
        { id: 'RL', type: 'resistor', nodes: [4, 0], value: 100000 },
        { id: 'U1', type: 'timer555', nodes: [1, 0, 3, 3, 2, 4], value: 0 },
      ],
    };
  }

  it('oscillates with period T ≈ 0.693·(Ra+2Rb)·C', () => {
    const result = runTransient(astable(), { startTime: 0, stopTime: 12e-3, timestep: 2e-6 });
    const out = result.nodeVoltages[4];

    // Output swings rail-to-rail.
    expect(Math.max(...out)).toBeGreaterThan(4.5);
    expect(Math.min(...out)).toBeLessThan(0.5);

    const rises = risingCrossings(result.time, out, Vcc / 2);
    expect(rises.length).toBeGreaterThanOrEqual(4);
    // Skip the first period: it includes the power-up charge from Vc≈0.
    const periods: number[] = [];
    for (let i = 2; i < rises.length; i++) periods.push(rises[i] - rises[i - 1]);
    const avgPeriod = periods.reduce((a, b) => a + b, 0) / periods.length;

    const expectedT = 0.693 * (Ra + 2 * Rb) * C; // ≈ 2.079 ms
    expect(Math.abs(avgPeriod - expectedT) / expectedT).toBeLessThan(0.05);
  });

  it('has a ~2/3 high duty cycle (charge through Ra+Rb, discharge through Rb)', () => {
    const result = runTransient(astable(), { startTime: 0, stopTime: 12e-3, timestep: 2e-6 });
    const out = result.nodeVoltages[4];

    const rises = risingCrossings(result.time, out, Vcc / 2);
    const falls = fallingCrossings(result.time, out, Vcc / 2);
    // Measure a STEADY cycle, not the first: the power-up charge runs from
    // Vc≈0 (not 1/3·Vcc), so the first high time is atypically long.
    const rise0 = rises[1];
    const fall0 = falls.find((f) => f > rise0)!;
    const rise1 = rises.find((r) => r > fall0)!;
    const highTime = fall0 - rise0;
    const period = rise1 - rise0;

    // Duty = (Ra+Rb)/(Ra+2Rb) = 2000/3000 = 0.667.
    expect(highTime / period).toBeCloseTo((Ra + Rb) / (Ra + 2 * Rb), 1);
  });
});

describe('runTransient — 555 monostable', () => {
  // Nodes: 1=vcc, 0=gnd, 2=thr/dis, 3=trig, 4=out.
  const Vcc = 5;
  const Ra = 10000;
  const C = 1e-6;

  function monostable(): Netlist {
    return {
      components: [
        { id: 'VCC', type: 'vsource', nodes: [1, 0], value: Vcc },
        { id: 'RA', type: 'resistor', nodes: [1, 2], value: Ra },
        { id: 'C1', type: 'capacitor', nodes: [2, 0], value: C },
        { id: 'RL', type: 'resistor', nodes: [4, 0], value: 100000 },
        // Trigger idles high at Vcc, dips to 0 briefly at t = 2 ms to fire the one-shot.
        {
          id: 'VTRIG',
          type: 'vsource',
          nodes: [3, 0],
          value: Vcc,
          waveform: { kind: 'pulse', v1: Vcc, v2: 0, delay: 2e-3, rise: 1e-6, fall: 1e-6, width: 50e-6, period: 1 },
        },
        { id: 'U1', type: 'timer555', nodes: [1, 0, 3, 2, 2, 4], value: 0 },
      ],
    };
  }

  it('produces a single output pulse of width ≈ 1.1·Ra·C', () => {
    const result = runTransient(monostable(), { startTime: 0, stopTime: 20e-3, timestep: 5e-6 });
    const out = result.nodeVoltages[4];

    const rises = risingCrossings(result.time, out, Vcc / 2);
    const falls = fallingCrossings(result.time, out, Vcc / 2);
    // Exactly one output pulse.
    expect(rises).toHaveLength(1);
    expect(falls).toHaveLength(1);

    const width = falls[0] - rises[0];
    const expectedWidth = 1.1 * Ra * C; // ≈ 11 ms
    expect(Math.abs(width - expectedWidth) / expectedWidth).toBeLessThan(0.05);
    // Fires right after the trigger at 2 ms.
    expect(rises[0]).toBeGreaterThan(2e-3);
    expect(rises[0]).toBeLessThan(2.5e-3);
  });

  it('records the output-current series aligned with the waveform', () => {
    const result = runTransient(monostable(), { startTime: 0, stopTime: 20e-3, timestep: 5e-6 });
    const iOut = result.componentCurrents['U1'];
    expect(iOut).toHaveLength(result.time.length);
    // While high, the output sources current into the 100k load: ~5V/100k = 50µA.
    expect(Math.max(...iOut)).toBeGreaterThan(40e-6);
  });
});

describe('555 rejects non-transient analyses with actionable errors', () => {
  // A minimal circuit carrying a 555 plus an AC source (so runAC reaches the
  // timer stamp instead of failing on a missing stimulus first).
  function net(): Netlist {
    return {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: 5 },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: 1000 },
        { id: 'C1', type: 'capacitor', nodes: [2, 0], value: 1e-6 },
        { id: 'U1', type: 'timer555', nodes: [1, 0, 2, 2, 3, 4], value: 0 },
        { id: 'RL', type: 'resistor', nodes: [4, 0], value: 100000 },
        { id: 'RD', type: 'resistor', nodes: [3, 0], value: 100000 },
      ],
    };
  }

  it('solveDC refuses the 555 and points to transient analysis', () => {
    expect(() => solveDC(net())).toThrow(/555.*transient/is);
  });

  it('runAC refuses the 555 and points to transient analysis', () => {
    expect(() => runAC(net(), { startFreq: 1, stopFreq: 1e3, pointsPerDecade: 5, acSourceId: 'V1' })).toThrow(
      /555.*transient/is
    );
  });
});
