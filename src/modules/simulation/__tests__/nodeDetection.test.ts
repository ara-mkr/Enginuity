import { describe, expect, it } from 'vitest'
import { detectNodes } from '../core/nodeDetection'
import { asRecord, makeComponent, makeWire } from './helpers'

describe('detectNodes — resistor divider (Phase 1 acceptance circuit)', () => {
  // V1 vertical at origin (pos up), R1 horizontal on top, R2 vertical on the
  // right leg, ground touching V1.neg pin-to-pin.
  //   V1.pos (0,-30) ─ wire ─ R1.a (70,-60)
  //   R1.b (130,-60) ─ wire ─ R2.a (100,-30)   [R2 rotated 90°]
  //   R2.b (100,30) ─ wire ─ V1.neg (0,30) = GND.ref (0,30)
  const V1 = makeComponent('vsource-dc', 'V1', { x: 0, y: 0 })
  const R1 = makeComponent('resistor', 'R1', { x: 100, y: -60 })
  const R2 = makeComponent('resistor', 'R2', { x: 100, y: 0 }, 90)
  const GND = makeComponent('ground', 'GND', { x: 0, y: 30 })
  const wires = [
    makeWire([{ x: 0, y: -30 }, { x: 0, y: -60 }, { x: 70, y: -60 }]),
    makeWire([{ x: 130, y: -60 }, { x: 130, y: -30 }, { x: 100, y: -30 }]),
    makeWire([{ x: 100, y: 30 }, { x: 0, y: 30 }]),
  ]
  const result = detectNodes({ components: asRecord([V1, R1, R2, GND]), wires })

  it('finds exactly three electrical nodes', () => {
    expect(result.nodes).toHaveLength(3)
  })

  it('assigns ground node 0 to V1.neg, R2.b and the ground pin', () => {
    expect(result.hasGround).toBe(true)
    expect(result.nodeOfPin.get(`${V1.id}:neg`)).toBe(0)
    expect(result.nodeOfPin.get(`${R2.id}:b`)).toBe(0)
    expect(result.nodeOfPin.get(`${GND.id}:ref`)).toBe(0)
  })

  it('merges V1.pos with R1.a and R1.b with R2.a into distinct nodes', () => {
    const top = result.nodeOfPin.get(`${V1.id}:pos`)
    const mid = result.nodeOfPin.get(`${R1.id}:b`)
    expect(top).toBe(result.nodeOfPin.get(`${R1.id}:a`))
    expect(mid).toBe(result.nodeOfPin.get(`${R2.id}:a`))
    expect(top).not.toBe(mid)
    expect(top).not.toBe(0)
    expect(mid).not.toBe(0)
  })

  it('reports no floating pins', () => {
    expect(result.floatingPins).toHaveLength(0)
  })

  it('places a junction dot where V1.neg, GND.ref and the return wire meet', () => {
    expect(result.junctions).toContainEqual({ x: 0, y: 30 })
  })
})

describe('detectNodes — wire topology rules', () => {
  it('connects a T-junction (endpoint on mid-segment) and dots it', () => {
    const wires = [
      makeWire([{ x: 0, y: 0 }, { x: 100, y: 0 }]),
      makeWire([{ x: 50, y: 0 }, { x: 50, y: 50 }]),
    ]
    const result = detectNodes({ components: {}, wires })
    expect(result.nodes).toHaveLength(1)
    expect(result.junctions).toContainEqual({ x: 50, y: 0 })
  })

  it('does NOT connect two wires crossing mid-segment, and draws no dot', () => {
    const wires = [
      makeWire([{ x: 0, y: 0 }, { x: 100, y: 0 }]),
      makeWire([{ x: 50, y: -50 }, { x: 50, y: 50 }]),
    ]
    const result = detectNodes({ components: {}, wires })
    expect(result.nodes).toHaveLength(2)
    expect(result.junctions).toHaveLength(0)
  })

  it('does not dot a plain corner where two wires join end-to-end', () => {
    const wires = [
      makeWire([{ x: 0, y: 0 }, { x: 50, y: 0 }]),
      makeWire([{ x: 50, y: 0 }, { x: 50, y: 50 }]),
    ]
    const result = detectNodes({ components: {}, wires })
    expect(result.nodes).toHaveLength(1)
    expect(result.junctions).toHaveLength(0)
  })

  it('connects a pin that lands on a wire mid-segment', () => {
    const R = makeComponent('resistor', 'R1', { x: 0, y: 0 }) // pins at (±30, 0)
    const wire = makeWire([{ x: 30, y: -40 }, { x: 30, y: 40 }]) // passes through pin b
    const result = detectNodes({ components: asRecord([R]), wires: [wire] })
    expect(result.nodeOfPin.get(`${R.id}:b`)).toBe(result.nodeOfWire.get(wire.id))
  })

  it('flags unconnected pins as floating', () => {
    const R = makeComponent('resistor', 'R1', { x: 0, y: 0 })
    const result = detectNodes({ components: asRecord([R]), wires: [] })
    expect(result.floatingPins).toHaveLength(2)
    expect(result.hasGround).toBe(false)
  })

  it('merges every ground symbol into node 0', () => {
    const g1 = makeComponent('ground', 'GND', { x: 0, y: 0 })
    const g2 = makeComponent('ground', 'GND', { x: 200, y: 0 })
    const result = detectNodes({ components: asRecord([g1, g2]), wires: [] })
    expect(result.nodeOfPin.get(`${g1.id}:ref`)).toBe(0)
    expect(result.nodeOfPin.get(`${g2.id}:ref`)).toBe(0)
  })

  it('respects rotation when computing pin positions', () => {
    // Rotated 90°: pin a (-30,0) → (0,-30), pin b (30,0) → (0,30)
    const R = makeComponent('resistor', 'R1', { x: 0, y: 0 }, 90)
    const wire = makeWire([{ x: 0, y: 30 }, { x: 60, y: 30 }])
    const result = detectNodes({ components: asRecord([R]), wires: [wire] })
    expect(result.nodeOfPin.get(`${R.id}:b`)).toBe(result.nodeOfWire.get(wire.id))
    expect(result.nodeOfPin.get(`${R.id}:a`)).not.toBe(result.nodeOfWire.get(wire.id))
  })
})
