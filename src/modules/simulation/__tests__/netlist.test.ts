import { describe, expect, it } from 'vitest'
import { buildNetlist } from '../core/netlist'
import { asRecord, makeComponent, makeWire } from './helpers'

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
  return { components: asRecord([V1, R1, R2, GND]), wires, refs: { V1, R1, R2, GND } }
}

describe('buildNetlist — resistor divider', () => {
  const circuit = dividerCircuit()
  const build = buildNetlist(circuit)

  it('produces a solver-ready engine netlist with no issues', () => {
    expect(build.issues).toHaveLength(0)
    expect(build.engineNetlist).not.toBeNull()
    expect(build.engineNetlist!.components).toHaveLength(3)
  })

  it('maps components onto the correct engine nodes', () => {
    const byId = Object.fromEntries(build.engineNetlist!.components.map((c) => [c.id, c]))
    // V1 spans top node → ground
    expect(byId.V1.type).toBe('vsource')
    expect(byId.V1.value).toBe(5)
    expect(byId.V1.nodes[1]).toBe(0)
    // R1 connects V1+ node to the midpoint node
    expect(byId.R1.nodes[0]).toBe(byId.V1.nodes[0])
    expect(byId.R1.nodes[1]).toBe(byId.R2.nodes[0])
    // R2 returns to ground
    expect(byId.R2.nodes[1]).toBe(0)
    // Two distinct non-ground nodes
    expect(byId.V1.nodes[0]).not.toBe(byId.R2.nodes[0])
  })

  it('emits SPICE-style lines with engineering notation', () => {
    expect(build.lines.some((l) => l.startsWith('R1') && l.includes('4.7k'))).toBe(true)
    expect(build.lines.some((l) => l.startsWith('V1') && l.includes('5'))).toBe(true)
  })
})

describe('buildNetlist — topology errors', () => {
  it('blocks and reports when there is no ground reference', () => {
    const { components, wires } = dividerCircuit()
    const noGround = Object.fromEntries(
      Object.entries(components).filter(([, c]) => c.type !== 'ground'),
    )
    const build = buildNetlist({ components: noGround, wires })
    expect(build.engineNetlist).toBeNull()
    expect(build.issues.some((i) => i.severity === 'error' && /ground/i.test(i.message))).toBe(true)
  })

  it('flags exactly which pin is floating', () => {
    const R = makeComponent('resistor', 'R9', { x: 0, y: 0 })
    const build = buildNetlist({ components: asRecord([R]), wires: [] })
    expect(build.engineNetlist).toBeNull()
    expect(build.issues.some((i) => i.message.includes("R9 pin 'a'"))).toBe(true)
    expect(build.issues.some((i) => i.message.includes("R9 pin 'b'"))).toBe(true)
  })

  it('flags a disconnected island with no path to ground', () => {
    const base = dividerCircuit()
    // A second, isolated loop far away: R3 in series with R4, no ground.
    const R3 = makeComponent('resistor', 'R3', { x: 1000, y: 0 })
    const R4 = makeComponent('resistor', 'R4', { x: 1000, y: 100 }, 0)
    const loopWires = [
      makeWire([{ x: 970, y: 0 }, { x: 940, y: 0 }, { x: 940, y: 100 }, { x: 970, y: 100 }]),
      makeWire([{ x: 1030, y: 0 }, { x: 1060, y: 0 }, { x: 1060, y: 100 }, { x: 1030, y: 100 }]),
    ]
    const build = buildNetlist({
      components: { ...base.components, [R3.id]: R3, [R4.id]: R4 },
      wires: [...base.wires, ...loopWires],
    })
    expect(build.engineNetlist).toBeNull()
    expect(
      build.issues.some(
        (i) => i.severity === 'error' && i.message.includes('R3') && i.message.includes('R4'),
      ),
    ).toBe(true)
  })

  it('rejects a zero-value capacitor at netlist level', () => {
    const base = dividerCircuit()
    const C1 = makeComponent('capacitor', 'C1', { x: 100, y: 60 }, 90, { capacitance: 0 })
    // Hang C1 across R2: a at (100,30)→ rotated 90 puts a at (100,30), b at (100,90)
    const gndWire = makeWire([{ x: 100, y: 90 }, { x: 0, y: 90 }, { x: 0, y: 30 }])
    const build = buildNetlist({
      components: { ...base.components, [C1.id]: C1 },
      wires: [...base.wires, gndWire],
    })
    expect(build.issues.some((i) => i.message.includes('C1') && /0 is not physical/.test(i.message))).toBe(true)
    expect(build.engineNetlist).toBeNull()
  })
})
