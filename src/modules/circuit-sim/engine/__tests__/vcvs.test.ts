import { describe, expect, it } from 'vitest';
import { runAC } from '../acAnalysis';
import { solveDC } from '../dcAnalysis';
import { runTransient } from '../transientAnalysis';
import type { Netlist } from '../types';

describe('solveDC — VCVS (E element)', () => {
  it('drives its output branch to gain × the controlling voltage', () => {
    // 3V divider tap controls a gain-4 VCVS driving a 1k load.
    const netlist: Netlist = {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: 6 },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: 1000 },
        { id: 'R2', type: 'resistor', nodes: [2, 0], value: 1000 },
        { id: 'E1', type: 'vcvs', nodes: [3, 0, 2, 0], value: 4 },
        { id: 'RL', type: 'resistor', nodes: [3, 0], value: 1000 },
      ],
    };

    const result = solveDC(netlist);

    expect(result.nodeVoltages[2]).toBeCloseTo(3, 9);
    expect(result.nodeVoltages[3]).toBeCloseTo(12, 9);
    // Output branch current comes straight from the MNA solution: the VCVS
    // sources the load current, 12V / 1k flowing out of the + terminal.
    expect(result.branchCurrents.E1).toBeCloseTo(-12 / 1000, 9);
  });

  it('draws no current through its controlling sense nodes', () => {
    // The control tap hangs off a 1MΩ series resistor; if the sense nodes
    // drew any current the tap voltage would sag below the source value.
    const netlist: Netlist = {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: 2 },
        { id: 'RS', type: 'resistor', nodes: [1, 2], value: 1e6 },
        // 1G bleed so node 2 isn't floating (dangling sense node would be singular).
        { id: 'RB', type: 'resistor', nodes: [2, 0], value: 1e9 },
        { id: 'E1', type: 'vcvs', nodes: [3, 0, 2, 0], value: 1 },
        { id: 'RL', type: 'resistor', nodes: [3, 0], value: 100 },
      ],
    };

    const result = solveDC(netlist);

    // Divider of 1M into 1G barely sags: 2 * (1e9 / 1.001e9) ≈ 1.998.
    const expectedTap = 2 * (1e9 / (1e6 + 1e9));
    expect(result.nodeVoltages[2]).toBeCloseTo(expectedTap, 6);
    expect(result.nodeVoltages[3]).toBeCloseTo(expectedTap, 6);
  });

  it('solves a high-gain inverting amplifier to the ideal closed-loop gain', () => {
    // Classic inverting op-amp topology built directly from a VCVS:
    // Vin -> R1 (1k) -> inverting node, Rf (10k) feedback from output,
    // output = A * (0 - V(inv)) with A = 1e5. Ideal answer: -10 × Vin.
    const netlist: Netlist = {
      components: [
        { id: 'VIN', type: 'vsource', nodes: [1, 0], value: 1 },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: 1000 },
        { id: 'RF', type: 'resistor', nodes: [2, 3], value: 10000 },
        { id: 'E1', type: 'vcvs', nodes: [3, 0, 0, 2], value: 1e5 },
      ],
    };

    const result = solveDC(netlist);

    // Exact finite-gain closed-loop value: -(Rf/R1) / (1 + (1 + Rf/R1)/A).
    const exact = -10 / (1 + 11 / 1e5);
    expect(result.nodeVoltages[3]).toBeCloseTo(exact, 9);
    expect(result.nodeVoltages[3]).toBeCloseTo(-10, 2);
    // Virtual ground at the inverting node.
    expect(Math.abs(result.nodeVoltages[2])).toBeLessThan(1e-3);
  });
});

describe('runTransient — VCVS', () => {
  it('buffers a sine waveform sample-for-sample at unity gain', () => {
    const netlist: Netlist = {
      components: [
        {
          id: 'V1',
          type: 'vsource',
          nodes: [1, 0],
          value: 0,
          waveform: { kind: 'sine', amplitude: 1, frequency: 100, phaseDeg: 0, offset: 0 },
        },
        { id: 'R1', type: 'resistor', nodes: [1, 0], value: 1000 },
        { id: 'E1', type: 'vcvs', nodes: [2, 0, 1, 0], value: 1 },
        { id: 'RL', type: 'resistor', nodes: [2, 0], value: 1000 },
      ],
    };

    const result = runTransient(netlist, { startTime: 0, stopTime: 0.01, timestep: 1e-4 });

    expect(result.warnings).toBeUndefined();
    for (let i = 0; i < result.time.length; i++) {
      expect(result.nodeVoltages[2][i]).toBeCloseTo(result.nodeVoltages[1][i], 9);
      expect(result.nodeVoltages[1][i]).toBeCloseTo(Math.sin(2 * Math.PI * 100 * result.time[i]), 6);
    }
  });
});

describe('runAC — VCVS', () => {
  it('isolates an RC low-pass through an ideal buffer without loading it', () => {
    // RC low-pass (fc ≈ 159 Hz) into a unity VCVS buffer driving a heavy
    // 10Ω load. Without the buffer the load would wreck the corner; through
    // the VCVS the buffered output must match the unloaded RC response.
    const netlist: Netlist = {
      components: [
        {
          id: 'V1',
          type: 'vsource',
          nodes: [1, 0],
          value: 0,
          waveform: { kind: 'sine', amplitude: 1, frequency: 1000, phaseDeg: 0, offset: 0 },
        },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: 1000 },
        { id: 'C1', type: 'capacitor', nodes: [2, 0], value: 1e-6 },
        { id: 'E1', type: 'vcvs', nodes: [3, 0, 2, 0], value: 1 },
        { id: 'RL', type: 'resistor', nodes: [3, 0], value: 10 },
      ],
    };

    const result = runAC(netlist, { startFreq: 1, stopFreq: 1e5, pointsPerDecade: 10, acSourceId: 'V1' });

    const fc = 1 / (2 * Math.PI * 1000 * 1e-6);
    for (let i = 0; i < result.frequency.length; i++) {
      const f = result.frequency[i];
      const theoryDb = -10 * Math.log10(1 + (f / fc) ** 2);
      expect(result.magnitude_db[3][i]).toBeCloseTo(theoryDb, 6);
      expect(result.magnitude_db[3][i]).toBeCloseTo(result.magnitude_db[2][i], 9);
    }
  });
});
