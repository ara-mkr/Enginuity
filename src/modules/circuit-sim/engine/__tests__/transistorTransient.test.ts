import { describe, expect, it } from 'vitest';
import { runTransient } from '../transientAnalysis';
import type { Netlist } from '../types';

function assertNoNaN(values: number[]): void {
  for (const v of values) {
    expect(Number.isFinite(v)).toBe(true);
  }
}

describe('runTransient — transistors', () => {
  it('converges an RC-loaded common-emitter bjt amplifier without diverging to NaN', () => {
    const VCC = 10;
    const Rb = 100_000;
    const Rc = 100;
    const C = 1e-6;
    const netlist: Netlist = {
      components: [
        { id: 'VCC', type: 'vsource', nodes: [1, 0], value: VCC },
        { id: 'Rb', type: 'resistor', nodes: [1, 2], value: Rb },
        { id: 'Rc', type: 'resistor', nodes: [1, 3], value: Rc },
        { id: 'Q1', type: 'bjt', nodes: [3, 2, 0], value: 0 },
        // Load capacitor on the collector node.
        { id: 'C1', type: 'capacitor', nodes: [3, 0], value: C },
      ],
    };

    const tau = Rc * C;
    const result = runTransient(netlist, {
      startTime: 0,
      stopTime: 20 * tau,
      timestep: tau / 20,
    });

    assertNoNaN(result.nodeVoltages[2]);
    assertNoNaN(result.nodeVoltages[3]);

    // Should settle near the same collector voltage the DC bias point
    // predicts (Vce comfortably inside the active region for these
    // resistor values, i.e. neither saturated nor cut off).
    const finalVc = result.nodeVoltages[3][result.nodeVoltages[3].length - 1];
    expect(finalVc).toBeGreaterThan(0.3);
    expect(finalVc).toBeLessThan(VCC - 0.1);
  });

  it('converges an RC-loaded common-source mosfet amplifier without diverging to NaN', () => {
    const Vg = 2;
    const Vdd = 10;
    const Rd = 1000;
    const C = 1e-7;
    const netlist: Netlist = {
      components: [
        { id: 'VG', type: 'vsource', nodes: [1, 0], value: Vg },
        { id: 'VDD', type: 'vsource', nodes: [2, 0], value: Vdd },
        { id: 'Rd', type: 'resistor', nodes: [2, 3], value: Rd },
        { id: 'M1', type: 'mosfet', nodes: [3, 1, 0], value: 0 },
        { id: 'C1', type: 'capacitor', nodes: [3, 0], value: C },
      ],
    };

    const tau = Rd * C;
    const result = runTransient(netlist, {
      startTime: 0,
      stopTime: 20 * tau,
      timestep: tau / 20,
    });

    assertNoNaN(result.nodeVoltages[3]);

    const Vth = 1;
    const k = 0.001;
    const lambda = 0.01;
    const Vov = Vg - Vth;

    const finalVds = result.nodeVoltages[3][result.nodeVoltages[3].length - 1];
    expect(finalVds).toBeGreaterThan(Vov);

    const expectedId = (k / 2) * Vov * Vov * (1 + lambda * finalVds);
    const measuredId = (Vdd - finalVds) / Rd;
    expect(Math.abs(measuredId - expectedId) / expectedId).toBeLessThan(0.05);
  });
});
