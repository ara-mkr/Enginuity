import { describe, expect, it } from 'vitest';
import { solveDC } from '../dcAnalysis';
import type { Netlist } from '../types';

describe('solveDC — mosfet (square-law, Newton-Raphson)', () => {
  it('matches the square-law saturation formula at the converged operating point', () => {
    // Vgs = 2V (fixed via a direct gate source), Vdd = 10V through a 1k
    // drain resistor, source grounded. Default params: k=0.001, Vth=1,
    // lambda=0.01, so Vov=1V and the operating point works out to sit
    // solidly in saturation (Vds far above Vov).
    const Vg = 2;
    const Vdd = 10;
    const Rd = 1000;
    const netlist: Netlist = {
      components: [
        { id: 'VG', type: 'vsource', nodes: [1, 0], value: Vg },
        { id: 'VDD', type: 'vsource', nodes: [2, 0], value: Vdd },
        { id: 'Rd', type: 'resistor', nodes: [2, 3], value: Rd },
        { id: 'M1', type: 'mosfet', nodes: [3, 1, 0], value: 0 },
      ],
    };

    const result = solveDC(netlist);
    expect(result.warnings).toBeUndefined();

    const Vds = result.nodeVoltages[3];
    const Vgs = Vg;
    const Vth = 1;
    const k = 0.001;
    const lambda = 0.01;
    const Vov = Vgs - Vth;

    // Confirm the operating point actually landed in saturation before
    // comparing against the saturation formula.
    expect(Vds).toBeGreaterThan(Vov);

    const expectedId = (k / 2) * Vov * Vov * (1 + lambda * Vds);
    const measuredId = (Vdd - Vds) / Rd;

    expect(measuredId).toBeCloseTo(expectedId, 5);
    expect(result.branchCurrents.M1).toBeCloseTo(expectedId, 5);
  });

  it('matches the square-law triode formula when Rd forces low Vds', () => {
    // A small overdrive with a large drain resistor pulls Vds well below
    // Vgs - Vth, forcing the triode branch of the model.
    const Vg = 1.5;
    const Vdd = 5;
    const Rd = 100_000;
    const netlist: Netlist = {
      components: [
        { id: 'VG', type: 'vsource', nodes: [1, 0], value: Vg },
        { id: 'VDD', type: 'vsource', nodes: [2, 0], value: Vdd },
        { id: 'Rd', type: 'resistor', nodes: [2, 3], value: Rd },
        { id: 'M1', type: 'mosfet', nodes: [3, 1, 0], value: 0 },
      ],
    };

    const result = solveDC(netlist);
    expect(result.warnings).toBeUndefined();

    const Vds = result.nodeVoltages[3];
    const Vth = 1;
    const k = 0.001;
    const Vov = Vg - Vth;

    expect(Vds).toBeLessThan(Vov);

    const expectedId = k * (Vov * Vds - (Vds * Vds) / 2);
    const measuredId = (Vdd - Vds) / Rd;

    expect(measuredId).toBeCloseTo(expectedId, 5);
    expect(result.branchCurrents.M1).toBeCloseTo(expectedId, 5);
  });

  it('carries negligible current in cutoff (Vgs below Vth)', () => {
    const netlist: Netlist = {
      components: [
        { id: 'VG', type: 'vsource', nodes: [1, 0], value: 0.5 },
        { id: 'VDD', type: 'vsource', nodes: [2, 0], value: 10 },
        { id: 'Rd', type: 'resistor', nodes: [2, 3], value: 1000 },
        { id: 'M1', type: 'mosfet', nodes: [3, 1, 0], value: 0 },
      ],
    };

    const result = solveDC(netlist);
    expect(result.warnings).toBeUndefined();
    expect(result.nodeVoltages[3]).toBeGreaterThan(9.9);
    expect(Math.abs(result.branchCurrents.M1)).toBeLessThan(1e-9);
  });
});
