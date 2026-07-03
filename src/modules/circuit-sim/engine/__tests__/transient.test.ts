import { describe, expect, it } from 'vitest';
import { runTransient } from '../transientAnalysis';
import type { Netlist } from '../types';

describe('runTransient', () => {
  it('charges an RC circuit toward the analytical curve at t = 1*tau', () => {
    // 5V source -> 1kΩ -> node 1 -> 1uF cap -> ground. tau = RC = 1ms.
    const R = 1000;
    const C = 1e-6;
    const tau = R * C;
    const netlist: Netlist = {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: 5 },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: R },
        { id: 'C1', type: 'capacitor', nodes: [2, 0], value: C },
      ],
    };

    const result = runTransient(netlist, {
      startTime: 0,
      stopTime: tau,
      timestep: tau / 100,
    });

    const expected = 5 * (1 - Math.exp(-1));
    const actual = result.nodeVoltages[2][result.nodeVoltages[2].length - 1];

    expect(Math.abs(actual - expected) / expected).toBeLessThan(0.02);
  });

  it('is fully charged (within 2%) by t = 5*tau', () => {
    const R = 1000;
    const C = 1e-6;
    const tau = R * C;
    const netlist: Netlist = {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: 5 },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: R },
        { id: 'C1', type: 'capacitor', nodes: [2, 0], value: C },
      ],
    };

    const result = runTransient(netlist, {
      startTime: 0,
      stopTime: 5 * tau,
      timestep: tau / 100,
    });

    const actual = result.nodeVoltages[2][result.nodeVoltages[2].length - 1];
    expect(Math.abs(actual - 5) / 5).toBeLessThan(0.02);
  });

  it('rises the inductor current toward steady-state in a dual RL circuit', () => {
    // 5V source -> 1kΩ -> node 1 -> inductor -> ground. tau = L/R.
    const R = 1000;
    const L = 1;
    const tau = L / R;
    const netlist: Netlist = {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: 5 },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: R },
        { id: 'L1', type: 'inductor', nodes: [2, 0], value: L },
      ],
    };

    const result = runTransient(netlist, {
      startTime: 0,
      stopTime: tau,
      timestep: tau / 100,
    });

    // Current through L flows from node 2 to ground, i.e. into the
    // inductor's branch-current unknown for comp nodes [2, 0].
    const iSteadyState = 5 / R;
    const expected = iSteadyState * (1 - Math.exp(-1));

    // Reconstruct inductor current the same way the engine does: rerun
    // with access to branch currents isn't exposed on TransientResult
    // (only node voltages are, per the Waveforms tab contract), so derive
    // current from the resistor's voltage drop instead — same physical
    // current flows through R1 and L1 in this series loop.
    const v1 = result.nodeVoltages[1][result.nodeVoltages[1].length - 1];
    const v2 = result.nodeVoltages[2][result.nodeVoltages[2].length - 1];
    const actualCurrent = (v1 - v2) / R;

    expect(Math.abs(actualCurrent - expected) / expected).toBeLessThan(0.02);

    // And confirm it keeps rising toward the full steady-state value at
    // 5*tau, the dual of the RC full-charge test above.
    const resultFull = runTransient(netlist, {
      startTime: 0,
      stopTime: 5 * tau,
      timestep: tau / 100,
    });
    const v1f = resultFull.nodeVoltages[1][resultFull.nodeVoltages[1].length - 1];
    const v2f = resultFull.nodeVoltages[2][resultFull.nodeVoltages[2].length - 1];
    const actualFullCurrent = (v1f - v2f) / R;
    expect(Math.abs(actualFullCurrent - iSteadyState) / iSteadyState).toBeLessThan(0.02);
  });

  it('produces a more accurate result with a smaller timestep (real trapezoidal integration)', () => {
    const R = 1000;
    const C = 1e-6;
    const tau = R * C;
    const netlist: Netlist = {
      components: [
        { id: 'V1', type: 'vsource', nodes: [1, 0], value: 5 },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: R },
        { id: 'C1', type: 'capacitor', nodes: [2, 0], value: C },
      ],
    };

    const expected = 5 * (1 - Math.exp(-1));

    const coarse = runTransient(netlist, { startTime: 0, stopTime: tau, timestep: tau / 10 });
    const fine = runTransient(netlist, { startTime: 0, stopTime: tau, timestep: tau / 100 });

    const coarseVoltage = coarse.nodeVoltages[2][coarse.nodeVoltages[2].length - 1];
    const fineVoltage = fine.nodeVoltages[2][fine.nodeVoltages[2].length - 1];

    const coarseError = Math.abs(coarseVoltage - expected);
    const fineError = Math.abs(fineVoltage - expected);

    expect(fineError).toBeLessThan(coarseError);
  });
});
