import { describe, expect, it } from 'vitest';
import { runTransient } from '../transientAnalysis';
import { sourceValueAt, waveformValueAt } from '../waveforms';
import type { Component, Netlist, SourceWaveform } from '../types';

describe('waveformValueAt', () => {
  const sine: SourceWaveform = { kind: 'sine', amplitude: 2, frequency: 1000, phaseDeg: 0, offset: 1 };

  it('evaluates a sine at its quarter-period peak and at zero crossings', () => {
    expect(waveformValueAt(sine, 0)).toBeCloseTo(1, 12); // offset only
    expect(waveformValueAt(sine, 0.25e-3)).toBeCloseTo(3, 9); // offset + amplitude
    expect(waveformValueAt(sine, 0.5e-3)).toBeCloseTo(1, 9);
    expect(waveformValueAt(sine, 0.75e-3)).toBeCloseTo(-1, 9);
  });

  it('applies phase in degrees', () => {
    const shifted: SourceWaveform = { kind: 'sine', amplitude: 1, frequency: 50, phaseDeg: 90, offset: 0 };
    expect(waveformValueAt(shifted, 0)).toBeCloseTo(1, 12); // sin(90°) = 1
  });

  const pulse: SourceWaveform = {
    kind: 'pulse',
    v1: 0,
    v2: 5,
    delay: 1e-3,
    rise: 1e-4,
    fall: 2e-4,
    width: 4e-4,
    period: 2e-3,
  };

  it('walks a pulse through delay, rise, high, fall, and low', () => {
    expect(waveformValueAt(pulse, 0)).toBe(0); // before delay
    expect(waveformValueAt(pulse, 1e-3 + 0.5e-4)).toBeCloseTo(2.5, 9); // mid-rise
    expect(waveformValueAt(pulse, 1e-3 + 3e-4)).toBe(5); // high plateau
    expect(waveformValueAt(pulse, 1e-3 + 5e-4 + 1e-4)).toBeCloseTo(2.5, 9); // mid-fall
    expect(waveformValueAt(pulse, 1e-3 + 9e-4)).toBe(0); // low
  });

  it('repeats with the period', () => {
    const oneCycleLater = 2e-3;
    expect(waveformValueAt(pulse, 1e-3 + 3e-4 + oneCycleLater)).toBe(5);
    expect(waveformValueAt(pulse, 1e-3 + 9e-4 + oneCycleLater)).toBe(0);
  });

  it('handles instant edges (rise = fall = 0) without dividing by zero', () => {
    const square: SourceWaveform = { kind: 'pulse', v1: -1, v2: 1, delay: 0, rise: 0, fall: 0, width: 5e-4, period: 1e-3 };
    expect(waveformValueAt(square, 1e-6)).toBe(1);
    expect(waveformValueAt(square, 5e-4 + 1e-6)).toBe(-1);
    expect(Number.isFinite(waveformValueAt(square, 0))).toBe(true);
  });
});

describe('sourceValueAt', () => {
  it('returns the DC value when no waveform is attached', () => {
    const comp: Component = { id: 'V1', type: 'vsource', nodes: [1, 0], value: 12 };
    expect(sourceValueAt(comp, 0)).toBe(12);
    expect(sourceValueAt(comp, 1)).toBe(12);
  });
});

describe('runTransient with time-varying sources', () => {
  it('passes a sine source through a resistive divider at half amplitude', () => {
    // V1 (2V peak, 1kHz) -> R1 1k -> node 2 -> R2 1k -> ground: V(2) = V1/2.
    const netlist: Netlist = {
      components: [
        {
          id: 'V1',
          type: 'vsource',
          nodes: [1, 0],
          value: 0,
          waveform: { kind: 'sine', amplitude: 2, frequency: 1000, phaseDeg: 0, offset: 0 },
        },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: 1000 },
        { id: 'R2', type: 'resistor', nodes: [2, 0], value: 1000 },
      ],
    };
    const result = runTransient(netlist, { startTime: 0, stopTime: 1e-3, timestep: 1e-6 });

    // Resistive circuit: the divider tracks the instantaneous source exactly.
    const quarterPeriodIdx = result.time.findIndex((t) => Math.abs(t - 0.25e-3) < 1e-9);
    expect(quarterPeriodIdx).toBeGreaterThan(-1);
    expect(result.nodeVoltages[1][quarterPeriodIdx]).toBeCloseTo(2, 6);
    expect(result.nodeVoltages[2][quarterPeriodIdx]).toBeCloseTo(1, 6);
  });

  it('solves initial conditions at the waveform t=0 value, not the DC placeholder', () => {
    // Sine with 90° phase starts at full amplitude; the divider must show
    // half of that at the very first sample.
    const netlist: Netlist = {
      components: [
        {
          id: 'V1',
          type: 'vsource',
          nodes: [1, 0],
          value: 0, // DC placeholder deliberately different from the t=0 value
          waveform: { kind: 'sine', amplitude: 4, frequency: 100, phaseDeg: 90, offset: 0 },
        },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: 1000 },
        { id: 'R2', type: 'resistor', nodes: [2, 0], value: 1000 },
      ],
    };
    const result = runTransient(netlist, { startTime: 0, stopTime: 1e-3, timestep: 1e-5 });
    expect(result.time[0]).toBe(0);
    expect(result.nodeVoltages[2][0]).toBeCloseTo(2, 6);
  });

  it('charges an RC toward v2 after a pulse rising edge', () => {
    // Pulse 0→5V at t=1ms with instant edges into R=1k, C=1µF (tau=1ms).
    // At t = 1ms + tau the cap sits near 5·(1−e⁻¹).
    const tau = 1e-3;
    const netlist: Netlist = {
      components: [
        {
          id: 'V1',
          type: 'vsource',
          nodes: [1, 0],
          value: 0,
          waveform: { kind: 'pulse', v1: 0, v2: 5, delay: 1e-3, rise: 0, fall: 0, width: 10e-3, period: 20e-3 },
        },
        { id: 'R1', type: 'resistor', nodes: [1, 2], value: 1000 },
        { id: 'C1', type: 'capacitor', nodes: [2, 0], value: 1e-6 },
      ],
    };
    const result = runTransient(netlist, { startTime: 0, stopTime: 2e-3, timestep: tau / 200 });

    // Before the edge the output rests at 0.
    const preEdgeIdx = result.time.findIndex((t) => Math.abs(t - 0.9e-3) < 1e-9);
    expect(Math.abs(result.nodeVoltages[2][preEdgeIdx])).toBeLessThan(1e-9);

    const expected = 5 * (1 - Math.exp(-1));
    const lastIdx = result.time.length - 1; // t = 2ms = edge + 1·tau
    expect(Math.abs(result.nodeVoltages[2][lastIdx] - expected) / expected).toBeLessThan(0.02);
  });
});
