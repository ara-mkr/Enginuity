// Full pipeline tests: schematic components + wires → buildNetlist →
// runAnalysis through the real MNA engine. Numbers are checked against
// closed-form circuit theory, never against the solver's own output.

import { describe, expect, it } from 'vitest'
import { buildNetlist } from '../core/netlist'
import { runAnalysis, MAX_TRANSIENT_POINTS } from '../core/runAnalysis'
import { solveAnalysis } from '../core/solverClient'
import { defaultSimulationSettings, type SimulationSettings } from '../types'
import { asRecord, makeComponent, makeWire } from './helpers'

/** 5V source into R1–R2 series to ground; N2 is the midpoint. */
function dividerCircuit() {
  const V1 = makeComponent('vsource-dc', 'V1', { x: 0, y: 0 }, 0, { voltage: 5 })
  const R1 = makeComponent('resistor', 'R1', { x: 100, y: -60 }, 0, { resistance: 4700 })
  const R2 = makeComponent('resistor', 'R2', { x: 100, y: 0 }, 90, { resistance: 4700 })
  const GND = makeComponent('ground', 'GND', { x: 0, y: 30 })
  const wires = [
    makeWire([{ x: 0, y: -30 }, { x: 0, y: -60 }, { x: 70, y: -60 }]),
    makeWire([{ x: 130, y: -60 }, { x: 130, y: -30 }, { x: 100, y: -30 }]),
    makeWire([{ x: 100, y: 30 }, { x: 0, y: 30 }]),
  ]
  return { components: asRecord([V1, R1, R2, GND]), wires }
}

/** Same layout with the bottom leg swapped for a part built by `make`. */
function rcCircuit(source: ReturnType<typeof makeComponent>) {
  const R1 = makeComponent('resistor', 'R1', { x: 100, y: -60 }, 0, { resistance: 1000 })
  const C1 = makeComponent('capacitor', 'C1', { x: 100, y: 0 }, 90, { capacitance: 1e-6 })
  const GND = makeComponent('ground', 'GND', { x: 0, y: 30 })
  const wires = [
    makeWire([{ x: 0, y: -30 }, { x: 0, y: -60 }, { x: 70, y: -60 }]),
    makeWire([{ x: 130, y: -60 }, { x: 130, y: -30 }, { x: 100, y: -30 }]),
    makeWire([{ x: 100, y: 30 }, { x: 0, y: 30 }]),
  ]
  return { components: asRecord([source, R1, C1, GND]), wires }
}

function settings(patch: Partial<SimulationSettings>): SimulationSettings {
  return { ...defaultSimulationSettings(), ...patch }
}

describe('runAnalysis — DC operating point', () => {
  const build = buildNetlist(dividerCircuit())

  it('solves the divider midpoint and includes ground at exactly 0', () => {
    const result = runAnalysis(build.engineNetlist!, settings({ mode: 'dc' }))
    if (result.kind !== 'dc') throw new Error('expected dc result')
    expect(result.nodeVoltages[0]).toBe(0)
    // One node is 5V (source top), the other 2.5V (midpoint).
    const nonGround = Object.entries(result.nodeVoltages)
      .filter(([n]) => Number(n) !== 0)
      .map(([, v]) => v)
      .sort((a, b) => a - b)
    expect(nonGround[0]).toBeCloseTo(2.5, 9)
    expect(nonGround[1]).toBeCloseTo(5, 9)
  })

  it('derives component currents (Ohm law for resistors, branch for the source)', () => {
    const result = runAnalysis(build.engineNetlist!, settings({ mode: 'dc' }))
    if (result.kind !== 'dc') throw new Error('expected dc result')
    const expected = 5 / 9400
    expect(result.componentCurrents.R1).toBeCloseTo(expected, 9)
    expect(result.componentCurrents.R2).toBeCloseTo(expected, 9)
    expect(Math.abs(result.componentCurrents.V1)).toBeCloseTo(expected, 9)
  })

  it('reports capacitors as open (0 A) in DC', () => {
    const source = makeComponent('vsource-dc', 'V1', { x: 0, y: 0 }, 0, { voltage: 5 })
    const rcBuild = buildNetlist(rcCircuit(source))
    const result = runAnalysis(rcBuild.engineNetlist!, settings({ mode: 'dc' }))
    if (result.kind !== 'dc') throw new Error('expected dc result')
    expect(result.componentCurrents.C1).toBe(0)
    expect(result.componentCurrents.R1).toBeCloseTo(0, 12) // no path: cap blocks
  })
})

describe('runAnalysis — transient', () => {
  it('charges the RC toward 5·(1−e⁻¹) at t = τ', () => {
    const source = makeComponent('vsource-dc', 'V1', { x: 0, y: 0 }, 0, { voltage: 5 })
    const build = buildNetlist(rcCircuit(source))
    const tau = 1e-3 // R=1k, C=1µF
    const result = runAnalysis(
      build.engineNetlist!,
      settings({ mode: 'transient', transient: { stopTime: tau, timeStep: tau / 500 } }),
    )
    if (result.kind !== 'transient') throw new Error('expected transient result')

    // The capacitor node is the one that starts at 0 and rises.
    const risingSeries = Object.entries(result.nodeVoltages)
      .map(([, series]) => series)
      .find((s) => Math.abs(s[0]) < 1e-9 && s[s.length - 1] > 1)
    expect(risingSeries).toBeDefined()
    const expected = 5 * (1 - Math.exp(-1))
    const final = risingSeries![risingSeries!.length - 1]
    expect(Math.abs(final - expected) / expected).toBeLessThan(0.02)
  })

  it('drives the circuit with the AC source sine waveform', () => {
    const source = makeComponent('vsource-ac', 'V1', { x: 0, y: 0 }, 0, {
      amplitude: 1,
      frequency: 10, // f << fc ≈ 159Hz: the cap tracks the source
      phase: 0,
      offset: 0,
    })
    const build = buildNetlist(rcCircuit(source))
    const result = runAnalysis(
      build.engineNetlist!,
      settings({ mode: 'transient', transient: { stopTime: 0.1, timeStep: 5e-5 } }),
    )
    if (result.kind !== 'transient') throw new Error('expected transient result')
    // The source node swings the full ±1V.
    const sourceSeries = Object.values(result.nodeVoltages).find((s) => Math.max(...s) > 0.99)
    expect(sourceSeries).toBeDefined()
    expect(Math.min(...sourceSeries!)).toBeLessThan(-0.99)
  })

  it('coarsens absurdly fine timesteps to the rendering cap and says so', () => {
    const source = makeComponent('vsource-dc', 'V1', { x: 0, y: 0 }, 0, { voltage: 5 })
    const build = buildNetlist(rcCircuit(source))
    const result = runAnalysis(
      build.engineNetlist!,
      settings({ mode: 'transient', transient: { stopTime: 1e-3, timeStep: 1e-9 } }),
    )
    if (result.kind !== 'transient') throw new Error('expected transient result')
    expect(result.time.length).toBeLessThanOrEqual(MAX_TRANSIENT_POINTS + 1)
    expect(result.warnings.some((w) => /coarsened/i.test(w))).toBe(true)
  })

  it('rejects a non-positive stop time with an actionable error', () => {
    const build = buildNetlist(dividerCircuit())
    expect(() =>
      runAnalysis(build.engineNetlist!, settings({ mode: 'transient', transient: { stopTime: 0, timeStep: 1e-6 } })),
    ).toThrow(/stop time/i)
  })
})

describe('runAnalysis — AC sweep', () => {
  it('produces the RC low-pass response: flat passband, −20dB/decade rolloff, −90° phase', () => {
    const source = makeComponent('vsource-ac', 'V1', { x: 0, y: 0 }, 0, {
      amplitude: 1,
      frequency: 1000,
      phase: 0,
      offset: 0,
    })
    const build = buildNetlist(rcCircuit(source))
    const capNode = build.engineNetlist!.components.find((c) => c.id === 'C1')!.nodes[0]

    const result = runAnalysis(
      build.engineNetlist!,
      settings({ mode: 'ac', ac: { startFreq: 1, stopFreq: 1e5, pointsPerDecade: 20, sweepType: 'log' } }),
    )
    if (result.kind !== 'ac') throw new Error('expected ac result')
    expect(result.stimulus).toBe('V1')

    const mag = result.magnitudeDb[capNode]
    const phase = result.phaseDeg[capNode]
    // fc = 1/(2πRC) ≈ 159Hz. At 1Hz the output is within a hair of 0dB.
    expect(Math.abs(mag[0])).toBeLessThan(0.01)
    // At 100kHz: |H| ≈ fc/f → 20·log10(159/100000) ≈ −56dB.
    expect(mag[mag.length - 1]).toBeLessThan(-50)
    // Phase runs from ~0° to ~−90°.
    expect(Math.abs(phase[0])).toBeLessThan(2)
    expect(phase[phase.length - 1]).toBeLessThan(-85)
  })

  it('refuses to run without an AC stimulus source', () => {
    const build = buildNetlist(dividerCircuit())
    expect(() =>
      runAnalysis(build.engineNetlist!, settings({ mode: 'ac' })),
    ).toThrow(/AC voltage source/i)
  })
})

describe('solveAnalysis client', () => {
  it('falls back to a synchronous main-thread solve when workers are unavailable', async () => {
    const build = buildNetlist(dividerCircuit())
    const result = await solveAnalysis(build.engineNetlist!, settings({ mode: 'dc' }))
    expect(result.kind).toBe('dc')
  })

  it('propagates solver errors through the promise', async () => {
    const build = buildNetlist(dividerCircuit())
    await expect(solveAnalysis(build.engineNetlist!, settings({ mode: 'ac' }))).rejects.toThrow(
      /AC voltage source/i,
    )
  })
})
