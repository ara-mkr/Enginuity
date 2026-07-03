import { describe, expect, it } from 'vitest';
import { solveDC } from '../dcAnalysis';
import type { Netlist } from '../types';
import { validateNetlist } from '../validate';

const TOLERANCE = 1e-9;

describe('solveDC', () => {
  it('solves a simple equal voltage divider', () => {
    // 10V source between node 1 and ground, 1k from node 1 to node 2,
    // 1k from node 2 to ground. Expect node 2 = exactly 5V.
    const netlist: Netlist = {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: 10 },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: 1000 },
        { id: 'R2', type: 'resistor', nodes: [2, 0], value: 1000 },
      ],
    };

    const result = solveDC(netlist);

    expect(result.nodeVoltages[1]).toBeCloseTo(10, 9);
    expect(result.nodeVoltages[2]).toBeCloseTo(5, 9);
    expect(Math.abs(result.nodeVoltages[2] - 5)).toBeLessThan(TOLERANCE);
  });

  it('solves an unequal voltage divider', () => {
    // 12V source, 2k then 1k. Expect node 2 = 12 * 1k/(2k+1k) = 4V.
    const netlist: Netlist = {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: 12 },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: 2000 },
        { id: 'R2', type: 'resistor', nodes: [2, 0], value: 1000 },
      ],
    };

    const result = solveDC(netlist);

    const expected = 12 * (1000 / (2000 + 1000));
    expect(Math.abs(result.nodeVoltages[2] - expected)).toBeLessThan(TOLERANCE);
  });

  it('solves a current source into a resistor to ground', () => {
    // 1mA current source into node 1, 1k resistor from node 1 to ground.
    // Expect node 1 = 1V (Ohm's law, V = IR).
    const netlist: Netlist = {
      components: [
        { id: 'I1', type: 'isource', nodes: [0, 1], value: 0.001 },
        { id: 'R1', type: 'resistor', nodes: [1, 0], value: 1000 },
      ],
    };

    const result = solveDC(netlist);

    expect(Math.abs(result.nodeVoltages[1] - 1)).toBeLessThan(TOLERANCE);
  });

  it('solves two resistors in parallel from a voltage source', () => {
    // Verify the current drawn from the source matches V/Rparallel.
    const V = 5;
    const R1 = 1000;
    const R2 = 2000;
    const netlist: Netlist = {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: V },
        { id: 'R1', type: 'resistor', nodes: [1, 0], value: R1 },
        { id: 'R2', type: 'resistor', nodes: [1, 0], value: R2 },
      ],
    };

    const result = solveDC(netlist);

    const rParallel = 1 / (1 / R1 + 1 / R2);
    const expectedSourceCurrent = -V / rParallel; // current flows out of + terminal into the circuit

    expect(Math.abs(result.nodeVoltages[1] - V)).toBeLessThan(TOLERANCE);
    expect(Math.abs(result.branchCurrents['V1'] - expectedSourceCurrent)).toBeLessThan(TOLERANCE);
  });

  it('fails validation and throws when there is no ground reference at all', () => {
    const netlist: Netlist = {
      components: [
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: 1000 },
        { id: 'R2', type: 'resistor', nodes: [2, 1], value: 1000 },
      ],
    };

    const validation = validateNetlist(netlist);
    expect(validation.errors.length).toBeGreaterThan(0);

    expect(() => solveDC(netlist)).toThrow();
  });
});

describe('validateNetlist', () => {
  it('flags a voltage source with both terminals on the same node', () => {
    const netlist: Netlist = {
      components: [
        { id: 'V1', type: 'vsource', nodes: [0, 0], value: 5 },
        { id: 'R1', type: 'resistor', nodes: [0, 0], value: 1000 },
      ],
    };

    const result = validateNetlist(netlist);
    expect(result.errors.some((e) => e.includes('V1'))).toBe(true);
  });

  it('flags two conflicting parallel voltage sources between the same nodes', () => {
    const netlist: Netlist = {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: 5 },
        { id: 'V2', type: 'vsource', nodes: [1, 0], value: 10 },
      ],
    };

    const result = validateNetlist(netlist);
    expect(result.errors.some((e) => e.includes('V1') && e.includes('V2'))).toBe(true);
  });

  it('does not flag two parallel voltage sources with matching values', () => {
    const netlist: Netlist = {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: 5 },
        { id: 'V2', type: 'vsource', nodes: [1, 0], value: 5 },
        { id: 'R1', type: 'resistor', nodes: [1, 0], value: 1000 },
      ],
    };

    const result = validateNetlist(netlist);
    expect(result.errors.length).toBe(0);
  });

  it('warns about a floating node with only one connection', () => {
    const netlist: Netlist = {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: 5 },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: 1000 },
      ],
    };

    const result = validateNetlist(netlist);
    expect(result.warnings.some((w) => w.includes('2'))).toBe(true);
  });
});

describe('matrix solver', () => {
  it('throws a specific error for a singular matrix', () => {
    // Two nodes with no ground reference produce a singular MNA matrix.
    const netlist: Netlist = {
      components: [{ id: 'R1', type: 'resistor', nodes: [1, 2], value: 1000 }],
    };

    expect(() => solveDC(netlist)).toThrow(/invalid netlist|singular/i);
  });
});
