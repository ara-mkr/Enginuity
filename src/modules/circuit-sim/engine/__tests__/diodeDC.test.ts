import { describe, expect, it } from 'vitest';
import { solveDC } from '../dcAnalysis';
import type { Netlist } from '../types';

describe('solveDC — diode (Newton-Raphson)', () => {
  it('converges a forward-biased diode clamp to a believable silicon forward drop', () => {
    // 5V source, 1k resistor into a diode to ground (forward biased: anode at
    // node 1, cathode at ground).
    const netlist: Netlist = {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: 5 },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: 1000 },
        { id: 'D1', type: 'diode', nodes: [2, 0], value: 0 },
      ],
    };

    const result = solveDC(netlist);

    expect(result.warnings).toBeUndefined();

    const Vdiode = result.nodeVoltages[2];
    expect(Vdiode).toBeGreaterThan(0.55);
    expect(Vdiode).toBeLessThan(0.75);

    const expectedResistorCurrent = (5 - Vdiode) / 1000;
    expect(result.branchCurrents.D1).toBeCloseTo(expectedResistorCurrent, 6);
  });

  it('passes negligible current when the diode is reverse-biased', () => {
    // Same circuit, diode flipped: cathode at node 2, anode at ground, so
    // the diode sees the node reverse-biased.
    const netlist: Netlist = {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: 5 },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: 1000 },
        { id: 'D1', type: 'diode', nodes: [0, 2], value: 0 },
      ],
    };

    const result = solveDC(netlist);

    expect(result.warnings).toBeUndefined();

    // Essentially no current flows, so almost no drop across the resistor —
    // node 2 sits close to the full 5V, and the diode current is negligible.
    expect(result.nodeVoltages[2]).toBeGreaterThan(4.99);
    expect(Math.abs(result.branchCurrents.D1)).toBeLessThan(1e-12);
  });

  it('flags non-convergence via warnings instead of returning silently, without throwing', () => {
    const netlist: Netlist = {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: 5 },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: 1000 },
        { id: 'D1', type: 'diode', nodes: [2, 0], value: 0 },
      ],
    };

    let result;
    expect(() => {
      result = solveDC(netlist, { maxIterations: 2 });
    }).not.toThrow();

    expect(result!.warnings).toBeDefined();
    expect(result!.warnings!.length).toBeGreaterThan(0);
    expect(result!.warnings![0]).toMatch(/did not converge/i);
  });

  it('is a complete no-op for netlists with no nonlinear components (Phase 1 parity)', () => {
    const netlist: Netlist = {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: 10 },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: 1000 },
        { id: 'R2', type: 'resistor', nodes: [2, 0], value: 1000 },
      ],
    };

    const result = solveDC(netlist);

    expect(result.warnings).toBeUndefined();
    expect(result.nodeVoltages[1]).toBeCloseTo(10, 9);
    expect(result.nodeVoltages[2]).toBeCloseTo(5, 9);
  });
});
