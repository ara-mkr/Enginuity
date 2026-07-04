// Full pipeline tests for the Active palette: schematic placement + wires →
// buildNetlist (including the op-amp macro-expansion) → runAnalysis through
// the real MNA engine, checked against closed-form circuit theory.

import { describe, expect, it } from 'vitest'
import { buildNetlist } from '../core/netlist'
import { runAnalysis } from '../core/runAnalysis'
import { defaultSimulationSettings, type SimulationSettings } from '../types'
import { asRecord, makeComponent, makeWire } from './helpers'

function settings(patch: Partial<SimulationSettings>): SimulationSettings {
  return { ...defaultSimulationSettings(), ...patch }
}

describe('buildNetlist + runAnalysis — diode', () => {
  /** 5V → R1 (1k) → D1 → GND, the classic forward-drop clamp. */
  function diodeClamp() {
    const V1 = makeComponent('vsource-dc', 'V1', { x: 0, y: 0 }, 0, { voltage: 5 })
    const R1 = makeComponent('resistor', 'R1', { x: 100, y: -60 }, 0, { resistance: 1000 })
    // Rotated 90°: anode lands on top (100,-30), cathode on the bottom (100,30).
    const D1 = makeComponent('diode', 'D1', { x: 100, y: 0 }, 90)
    const GND = makeComponent('ground', 'GND', { x: 0, y: 30 })
    const wires = [
      makeWire([{ x: 0, y: -30 }, { x: 0, y: -60 }, { x: 70, y: -60 }]),
      makeWire([{ x: 130, y: -60 }, { x: 130, y: -30 }, { x: 100, y: -30 }]),
      makeWire([{ x: 100, y: 30 }, { x: 0, y: 30 }]),
    ]
    return { components: asRecord([V1, R1, D1, GND]), wires }
  }

  it('translates the diode with anode/cathode orientation intact', () => {
    const build = buildNetlist(diodeClamp())
    expect(build.issues.filter((i) => i.severity === 'error')).toEqual([])
    const d = build.engineNetlist!.components.find((c) => c.id === 'D1')!
    expect(d.type).toBe('diode')
    // Anode shares the resistor's output node, cathode sits on ground.
    expect(d.nodes[1]).toBe(0)
    expect(d.params).toMatchObject({ Is: 1e-14, n: 1 })
  })

  it('solves to a believable silicon forward drop with matching series current', () => {
    const build = buildNetlist(diodeClamp())
    const result = runAnalysis(build.engineNetlist!, settings({ mode: 'dc' }))
    if (result.kind !== 'dc') throw new Error('expected dc result')

    const anodeNode = build.engineNetlist!.components.find((c) => c.id === 'D1')!.nodes[0]
    const vDiode = result.nodeVoltages[anodeNode]
    expect(vDiode).toBeGreaterThan(0.55)
    expect(vDiode).toBeLessThan(0.75)
    expect(result.componentCurrents.D1).toBeCloseTo((5 - vDiode) / 1000, 9)
    expect(result.componentCurrents.R1).toBeCloseTo(result.componentCurrents.D1, 9)
  })
})

describe('buildNetlist + runAnalysis — NPN BJT', () => {
  /** Base-resistor bias: VCC 10V, RB 1M to base, RC 1k to collector, emitter grounded. */
  function biasedNPN() {
    const V1 = makeComponent('vsource-dc', 'V1', { x: 0, y: 0 }, 0, { voltage: 10 })
    const Q1 = makeComponent('bjt-npn', 'Q1', { x: 100, y: 0 }) // c(120,-30) b(70,0) e(120,30)
    const RC = makeComponent('resistor', 'RC', { x: 120, y: -60 }, 90, { resistance: 1000 })
    const RB = makeComponent('resistor', 'RB', { x: 70, y: -60 }, 90, { resistance: 1e6 })
    const GND = makeComponent('ground', 'GND', { x: 0, y: 60 })
    const wires = [
      // VCC rail: source + up and across the top; RB/RC tops sit on it.
      makeWire([{ x: 0, y: -30 }, { x: 0, y: -90 }, { x: 120, y: -90 }]),
      makeWire([{ x: 70, y: -30 }, { x: 70, y: 0 }]), // RB bottom → base
      makeWire([{ x: 0, y: 30 }, { x: 0, y: 60 }]), // source return
      makeWire([{ x: 120, y: 30 }, { x: 120, y: 60 }, { x: 0, y: 60 }]), // emitter → ground
    ]
    return { components: asRecord([V1, Q1, RC, RB, GND]), wires }
  }

  it('bias point matches hand calculation: Ic = β·(VCC − Vbe)/RB', () => {
    const build = buildNetlist(biasedNPN())
    expect(build.issues.filter((i) => i.severity === 'error')).toEqual([])
    const result = runAnalysis(build.engineNetlist!, settings({ mode: 'dc' }))
    if (result.kind !== 'dc') throw new Error('expected dc result')

    const baseNode = build.engineNetlist!.components.find((c) => c.id === 'Q1')!.nodes[1]
    const collectorNode = build.engineNetlist!.components.find((c) => c.id === 'Q1')!.nodes[0]
    const vbe = result.nodeVoltages[baseNode]
    expect(vbe).toBeGreaterThan(0.5)
    expect(vbe).toBeLessThan(0.8)

    const ib = result.componentCurrents['Q1 Ib']
    const ic = result.componentCurrents['Q1 Ic']
    expect(ib).toBeCloseTo((10 - vbe) / 1e6, 9)
    expect(ic / ib).toBeCloseTo(100, 6) // exactly β while forward-active
    expect(result.nodeVoltages[collectorNode]).toBeCloseTo(10 - ic * 1000, 6)
  })
})

describe('buildNetlist + runAnalysis — NMOS', () => {
  /** Gate at 3V, 5V drain supply through RD 1k, source grounded. */
  function nmosSaturation() {
    const VG = makeComponent('vsource-dc', 'VG', { x: 0, y: 0 }, 0, { voltage: 3 })
    const M1 = makeComponent('mosfet-nmos', 'M1', { x: 100, y: 0 }) // d(120,-30) g(70,0) s(120,30)
    const VD = makeComponent('vsource-dc', 'VD', { x: 240, y: 0 }, 0, { voltage: 5 })
    const RD = makeComponent('resistor', 'RD', { x: 180, y: -60 }, 0, { resistance: 1000 })
    const G1 = makeComponent('ground', 'GND', { x: 0, y: 60 })
    const G2 = makeComponent('ground', 'GND', { x: 240, y: 60 })
    const G3 = makeComponent('ground', 'GND', { x: 120, y: 60 })
    const wires = [
      makeWire([{ x: 0, y: -30 }, { x: 70, y: -30 }, { x: 70, y: 0 }]), // VG → gate
      makeWire([{ x: 240, y: -30 }, { x: 240, y: -60 }, { x: 210, y: -60 }]), // VD → RD
      makeWire([{ x: 150, y: -60 }, { x: 120, y: -60 }, { x: 120, y: -30 }]), // RD → drain
      makeWire([{ x: 0, y: 30 }, { x: 0, y: 60 }]),
      makeWire([{ x: 240, y: 30 }, { x: 240, y: 60 }]),
      makeWire([{ x: 120, y: 30 }, { x: 120, y: 60 }]), // source → ground
    ]
    return { components: asRecord([VG, M1, VD, RD, G1, G2, G3]), wires }
  }

  it('sits in saturation at the closed-form drain current', () => {
    const build = buildNetlist(nmosSaturation())
    expect(build.issues.filter((i) => i.severity === 'error')).toEqual([])
    const result = runAnalysis(build.engineNetlist!, settings({ mode: 'dc' }))
    if (result.kind !== 'dc') throw new Error('expected dc result')

    // Id = (k/2)·Vov²·(1+λ·Vds) with Vds = 5 − 1000·Id:
    // Id·1.02 = 0.002·1.05 → Id ≈ 2.0588 mA, Vds ≈ 2.94 V (> Vov = 2, saturation).
    const drainNode = build.engineNetlist!.components.find((c) => c.id === 'M1')!.nodes[0]
    expect(result.componentCurrents.M1).toBeCloseTo(0.0021 / 1.02, 7)
    expect(result.nodeVoltages[drainNode]).toBeCloseTo(5 - 1000 * (0.0021 / 1.02), 5)
  })
})

describe('buildNetlist + runAnalysis — op-amp macro-model', () => {
  /** Non-inverting amplifier: gain 1 + Rf/Rg = 11, Vin 0.5V → Vout 5.5V. */
  function nonInvertingAmp(source = makeComponent('vsource-dc', 'VIN', { x: 0, y: 0 }, 0, { voltage: 0.5 })) {
    const U1 = makeComponent('opamp', 'U1', { x: 100, y: 0 }) // inp(70,-10) inn(70,10) out(130,0)
    const RF = makeComponent('resistor', 'RF', { x: 100, y: 30 }, 0, { resistance: 10000 }) // (70,30)-(130,30)
    const RG = makeComponent('resistor', 'RG', { x: 70, y: 80 }, 90, { resistance: 1000 }) // (70,50)-(70,110)
    const G1 = makeComponent('ground', 'GND', { x: 0, y: 60 })
    const G2 = makeComponent('ground', 'GND', { x: 70, y: 140 })
    const wires = [
      makeWire([{ x: 0, y: -30 }, { x: 40, y: -30 }, { x: 40, y: -10 }, { x: 70, y: -10 }]), // VIN → in+
      makeWire([{ x: 0, y: 30 }, { x: 0, y: 60 }]),
      makeWire([{ x: 70, y: 10 }, { x: 70, y: 50 }]), // in− down to RG (RF's left pin taps this run)
      makeWire([{ x: 130, y: 0 }, { x: 130, y: 30 }]), // out → RF right pin
      makeWire([{ x: 70, y: 110 }, { x: 70, y: 140 }]), // RG → ground
    ]
    return { components: asRecord([source, U1, RF, RG, G1, G2]), wires }
  }

  it('macro-expands into Rin + VCVS + Rout on a private internal node', () => {
    const build = buildNetlist(nonInvertingAmp())
    expect(build.issues.filter((i) => i.severity === 'error')).toEqual([])
    const ids = build.engineNetlist!.components.map((c) => c.id)
    expect(ids).toContain('U1#RIN')
    expect(ids).toContain('U1#E')
    expect(ids).toContain('U1#ROUT')

    // The VCVS-to-Rout node exists nowhere on the schematic.
    const internalNode = build.engineNetlist!.components.find((c) => c.id === 'U1#E')!.nodes[0]
    const schematicNodes = new Set(build.detection.nodes.map((n) => n.id))
    expect(schematicNodes.has(internalNode)).toBe(false)

    // One SPICE line for the op-amp itself, none for the internals.
    expect(build.lines.filter((l) => l.startsWith('U1')).length).toBe(1)
  })

  it('DC solves the non-inverting amplifier to gain 11 and hides internal nodes', () => {
    const build = buildNetlist(nonInvertingAmp())
    const result = runAnalysis(build.engineNetlist!, settings({ mode: 'dc' }))
    if (result.kind !== 'dc') throw new Error('expected dc result')

    const outPinNode = build.engineNetlist!.components.find((c) => c.id === 'U1#ROUT')!.nodes[1]
    // Ideal 5.5V; finite gain (1e5) and Rout (75Ω into a 11k feedback path) cost ~0.1%.
    expect(result.nodeVoltages[outPinNode]).toBeGreaterThan(5.45)
    expect(result.nodeVoltages[outPinNode]).toBeLessThan(5.51)

    // Virtual short: in− tracks in+ at 0.5V.
    const innNode = build.engineNetlist!.components.find((c) => c.id === 'U1#RIN')!.nodes[1]
    expect(result.nodeVoltages[innNode]).toBeCloseTo(0.5, 3)

    // Internal macro node is filtered from the visible result set.
    const internalNode = build.engineNetlist!.components.find((c) => c.id === 'U1#E')!.nodes[0]
    expect(result.nodeVoltages[internalNode]).toBeUndefined()

    // Currents table: the op-amp shows one entry (its sourced output current),
    // internals stay hidden.
    expect(result.componentCurrents.U1).toBeDefined()
    expect(result.componentCurrents['U1#RIN']).toBeUndefined()
    expect(result.componentCurrents['U1#E']).toBeUndefined()
    // Sourcing 5.5V into Rf+Rg = 11k → ~0.5 mA out of the output pin.
    expect(result.componentCurrents.U1).toBeCloseTo(5.5 / 11000, 4)
  })

  it('transient currents report the op-amp under its refdes and hide macro internals', () => {
    const source = makeComponent('vsource-ac', 'VIN', { x: 0, y: 0 }, 0, {
      amplitude: 0.5,
      frequency: 1000,
      phase: 0,
      offset: 0,
    })
    const build = buildNetlist(nonInvertingAmp(source))
    const result = runAnalysis(
      build.engineNetlist!,
      settings({ mode: 'transient', transient: { stopTime: 1e-3, timeStep: 1e-6 } }),
    )
    if (result.kind !== 'transient') throw new Error('expected transient result')

    const currents = result.componentCurrents!
    expect(currents.U1).toBeDefined()
    expect(currents['U1#RIN']).toBeUndefined()
    expect(currents['U1#E']).toBeUndefined()
    expect(currents['U1#ROUT']).toBeUndefined()

    // At the sine peak the amp sources ~5.5V into the 11k feedback path.
    const peak = Math.max(...currents.U1)
    expect(peak).toBeGreaterThan((5.5 / 11000) * 0.95)
    expect(peak).toBeLessThan((5.5 / 11000) * 1.05)
  })

  it('AC currents report the op-amp under its refdes and hide macro internals', () => {
    const source = makeComponent('vsource-ac', 'VIN', { x: 0, y: 0 }, 0, {
      amplitude: 1,
      frequency: 1000,
      phase: 0,
      offset: 0,
    })
    const build = buildNetlist(nonInvertingAmp(source))
    const result = runAnalysis(
      build.engineNetlist!,
      settings({ mode: 'ac', ac: { startFreq: 1, stopFreq: 1e4, pointsPerDecade: 5, sweepType: 'log' } }),
    )
    if (result.kind !== 'ac') throw new Error('expected ac result')

    expect(result.currentMagDb!.U1).toBeDefined()
    expect(result.currentMagDb!['U1#RIN']).toBeUndefined()
    expect(result.currentPhaseDeg!.U1).toBeDefined()
    // Output sources 11V (gain 11 × 1V stimulus) into 11k → 1 mA → −60 dBA.
    for (const db of result.currentMagDb!.U1) {
      expect(db).toBeCloseTo(20 * Math.log10(11 / 11000), 1)
    }
  })

  it('AC sweep shows the flat 20.8 dB closed-loop gain', () => {
    const source = makeComponent('vsource-ac', 'VIN', { x: 0, y: 0 }, 0, {
      amplitude: 1,
      frequency: 1000,
      phase: 0,
      offset: 0,
    })
    const build = buildNetlist(nonInvertingAmp(source))
    const result = runAnalysis(
      build.engineNetlist!,
      settings({ mode: 'ac', ac: { startFreq: 1, stopFreq: 1e4, pointsPerDecade: 5, sweepType: 'log' } }),
    )
    if (result.kind !== 'ac') throw new Error('expected ac result')

    const outPinNode = build.engineNetlist!.components.find((c) => c.id === 'U1#ROUT')!.nodes[1]
    const expectedDb = 20 * Math.log10(11)
    for (const db of result.magnitudeDb[outPinNode]) {
      expect(db).toBeCloseTo(expectedDb, 1)
    }
    // Internal node series are filtered here too.
    const internalNode = build.engineNetlist!.components.find((c) => c.id === 'U1#E')!.nodes[0]
    expect(result.magnitudeDb[internalNode]).toBeUndefined()
  })
})

describe('buildNetlist + runAnalysis — 555 timer', () => {
  // Each 555 pin taps its own node so the pin→engine-node ORDER is checkable:
  // resistors coincide a-pin-on-U1-pin, b-pin-on-a-ground; vcc via a source.
  function timerCircuit() {
    const U1 = makeComponent('timer555', 'U1', { x: 200, y: 0 })
    const VCC = makeComponent('vsource-dc', 'VCC', { x: 200, y: -20 }, 0, { voltage: 5 }) // pos(200,-50)=vcc
    const GNDv = makeComponent('ground', 'GND', { x: 200, y: 10 }) // VCC.neg(200,10)
    const GNDg = makeComponent('ground', 'GND', { x: 200, y: 50 }) // U1.gnd
    const RT = makeComponent('resistor', 'RT', { x: 190, y: -20 }, 0, { resistance: 100000 }) // a(160,-20)=trig
    const GNDt = makeComponent('ground', 'GND', { x: 220, y: -20 })
    const RH = makeComponent('resistor', 'RH', { x: 190, y: 20 }, 0, { resistance: 100000 }) // a(160,20)=thr
    const GNDh = makeComponent('ground', 'GND', { x: 220, y: 20 })
    const RD = makeComponent('resistor', 'RD', { x: 190, y: 0 }, 0, { resistance: 100000 }) // a(160,0)=dis
    const GNDd = makeComponent('ground', 'GND', { x: 220, y: 0 })
    const RO = makeComponent('resistor', 'RO', { x: 270, y: 0 }, 0, { resistance: 100000 }) // a(240,0)=out
    const GNDo = makeComponent('ground', 'GND', { x: 300, y: 0 })
    return {
      circuit: { components: asRecord([U1, VCC, GNDv, GNDg, RT, GNDt, RH, GNDh, RD, GNDd, RO, GNDo]), wires: [] },
      U1,
    }
  }

  it('maps the six schematic pins to the engine node order [vcc, gnd, trig, thr, dis, out]', () => {
    const { circuit, U1 } = timerCircuit()
    const build = buildNetlist(circuit)
    expect(build.issues.filter((i) => i.severity === 'error')).toEqual([])

    const timer = build.engineNetlist!.components.find((c) => c.type === 'timer555')!
    const nodeOf = (pin: string) => build.detection.nodeOfPin.get(`${U1.id}:${pin}`)
    expect(timer.nodes).toEqual([
      nodeOf('vcc'),
      nodeOf('gnd'),
      nodeOf('trig'),
      nodeOf('thr'),
      nodeOf('dis'),
      nodeOf('out'),
    ])
    expect(nodeOf('gnd')).toBe(0)
    // One SPICE line for the whole IC, no macro internals leaking out.
    expect(build.lines.filter((l) => l.startsWith('U1')).length).toBe(1)
  })

  it('refuses a DC operating-point run and names the 555', () => {
    const { circuit } = timerCircuit()
    const build = buildNetlist(circuit)
    expect(() => runAnalysis(build.engineNetlist!, settings({ mode: 'dc' }))).toThrow(/555/)
  })
})
