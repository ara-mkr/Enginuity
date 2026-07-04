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

  it('adaptive stepping matches the analytic RC charge within tolerance', () => {
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

    // Deliberately coarse max step (τ/4): fixed stepping at this h would be
    // visibly wrong; the controller must refine it to hold tolerance.
    const result = runTransient(netlist, {
      startTime: 0,
      stopTime: tau,
      timestep: tau / 4,
      adaptive: true,
    });

    for (let i = 0; i < result.time.length; i++) {
      const expected = 5 * (1 - Math.exp(-result.time[i] / tau));
      expect(Math.abs(result.nodeVoltages[2][i] - expected)).toBeLessThan(0.03);
    }
    // The axis is still monotonic and lands exactly on stopTime.
    for (let i = 1; i < result.time.length; i++) {
      expect(result.time[i]).toBeGreaterThan(result.time[i - 1]);
    }
    expect(result.time[result.time.length - 1]).toBeCloseTo(tau, 12);
  });

  it('adaptive stepping refines around a pulse edge and stretches out on the flat', () => {
    const R = 1000;
    const C = 1e-6;
    const tau = R * C;
    const stopTime = 10 * tau;
    const netlist: Netlist = {
      components: [
        {
          id: 'V1',
          type: 'vsource',
          nodes: [1, 0],
          value: 0,
          // Instant edge at t = 5τ, then flat for the rest of the run.
          waveform: { kind: 'pulse', v1: 0, v2: 5, delay: 5 * tau, rise: 0, fall: 0, width: stopTime, period: 2 * stopTime },
        },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: R },
        { id: 'C1', type: 'capacitor', nodes: [2, 0], value: C },
      ],
    };

    const hMax = tau;
    const result = runTransient(netlist, { startTime: 0, stopTime, timestep: hMax, adaptive: true });

    const dts: number[] = [];
    for (let i = 1; i < result.time.length; i++) dts.push(result.time[i] - result.time[i - 1]);

    // Before the edge nothing moves: the controller should be running at
    // (or very near) the max step. Around/after the edge it must refine.
    expect(Math.max(...dts)).toBeGreaterThan(hMax * 0.99);
    expect(Math.min(...dts)).toBeLessThan(hMax / 4);

    // And the refined waveform still lands on the analytic response after
    // the edge: V(t) = 5(1 − e^(−(t−5τ)/τ)).
    const last = result.time.length - 1;
    const expected = 5 * (1 - Math.exp(-(result.time[last] - 5 * tau) / tau));
    expect(Math.abs(result.nodeVoltages[2][last] - expected)).toBeLessThan(0.05);
  });

  it('tighter adaptive tolerance takes more steps', () => {
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

    const loose = runTransient(netlist, { startTime: 0, stopTime: tau, timestep: tau / 4, adaptive: true, reltol: 1e-2 });
    const tight = runTransient(netlist, { startTime: 0, stopTime: tau, timestep: tau / 4, adaptive: true, reltol: 1e-5 });
    expect(tight.time.length).toBeGreaterThan(loose.time.length);
  });

  it('records current series: RC charge follows I(t) = (V/R)·e^(−t/τ) for every device in the loop', () => {
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

    const result = runTransient(netlist, { startTime: 0, stopTime: tau, timestep: tau / 100 });

    const iR = result.componentCurrents['R1'];
    const iC = result.componentCurrents['C1'];
    const iV = result.componentCurrents['V1'];
    expect(iR).toHaveLength(result.time.length);

    // t=0 (exact IC solve): the full 5V sits across R, so I = 5mA.
    expect(iR[0]).toBeCloseTo(5 / R, 6);
    expect(iC[0]).toBeCloseTo(5 / R, 6);

    // t=τ: decayed to e⁻¹ of the initial current.
    const last = result.time.length - 1;
    const expected = (5 / R) * Math.exp(-1);
    expect(Math.abs(iR[last] - expected) / expected).toBeLessThan(0.02);

    // Series loop: the same current flows through every element at every
    // sample (source branch current is measured INTO its + terminal, so it
    // carries the opposite sign).
    for (let i = 0; i < result.time.length; i++) {
      expect(iC[i]).toBeCloseTo(iR[i], 9);
      expect(iV[i]).toBeCloseTo(-iR[i], 9);
    }
  });

  it('records the inductor branch-current series directly', () => {
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

    const result = runTransient(netlist, { startTime: 0, stopTime: tau, timestep: tau / 100 });

    const iL = result.componentCurrents['L1'];
    // Cold start: 0 A at t=0, rising toward (V/R)(1−e^(−t/τ)).
    expect(iL[0]).toBe(0);
    const last = result.time.length - 1;
    const expected = (5 / R) * (1 - Math.exp(-1));
    expect(Math.abs(iL[last] - expected) / expected).toBeLessThan(0.02);
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
