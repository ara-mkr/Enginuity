// Electrical node extraction — the correctness-critical pass everything else
// builds on. Wires and pins merge into nodes via exact graph connectivity on
// grid-snapped coordinates (union-find), never by proximity. Ground pins all
// collapse into node 0.

import type { Circuit, ComponentInstance, Point, Wire } from '../types'
import { getDef } from '../componentDefs'
import { pinWorldPosition, pointKey, pointOnOrthoSegment, pointsEqual } from './geometry'
import { UnionFind } from './unionFind'

export interface PinLocation {
  componentId: string
  pinName: string
  refdes: string
  position: Point
}

export interface ElectricalNode {
  /** 0 is always the ground/reference node. */
  id: number
  /** Union-find element keys: `pin:<componentId>:<pinName>` and `wire:<wireId>`. */
  members: string[]
  pins: PinLocation[]
  wireIds: string[]
  /** Every grid point belonging to this node (pin positions + wire vertices). */
  points: Point[]
}

export interface NodeDetectionResult {
  nodes: ElectricalNode[]
  /** `${componentId}:${pinName}` → node id */
  nodeOfPin: Map<string, number>
  nodeOfWire: Map<string, number>
  /** Points where 3+ conductor branches meet — rendered as junction dots. */
  junctions: Point[]
  hasGround: boolean
  /** Pins whose union-find group contains nothing but themselves. */
  floatingPins: PinLocation[]
}

const GROUND_KEY = 'ground:0'

function pinKeyOf(componentId: string, pinName: string): string {
  return `pin:${componentId}:${pinName}`
}

function wireKeyOf(wireId: string): string {
  return `wire:${wireId}`
}

function collectPins(components: Record<string, ComponentInstance>): PinLocation[] {
  const pins: PinLocation[] = []
  for (const comp of Object.values(components)) {
    const def = getDef(comp.type)
    for (const pin of def.pins) {
      pins.push({
        componentId: comp.id,
        pinName: pin.name,
        refdes: comp.refdes,
        position: pinWorldPosition(comp.position, comp.rotation, pin.offset),
      })
    }
  }
  return pins
}

/** True when point p is electrically on wire w (vertex or anywhere along a segment). */
function pointTouchesWire(p: Point, w: Wire): boolean {
  for (let i = 0; i < w.points.length - 1; i++) {
    if (pointOnOrthoSegment(p, w.points[i], w.points[i + 1])) return true
  }
  return w.points.length === 1 && pointsEqual(p, w.points[0])
}

export function detectNodes(circuit: Pick<Circuit, 'components' | 'wires'>): NodeDetectionResult {
  const pins = collectPins(circuit.components)
  const wires = circuit.wires
  const uf = new UnionFind()

  for (const pin of pins) uf.add(pinKeyOf(pin.componentId, pin.pinName))
  for (const w of wires) uf.add(wireKeyOf(w.id))

  // Wire ↔ wire: connected when a vertex of one lies anywhere on the other.
  // Mid-segment crossings share no vertex, so they correctly stay separate.
  for (let i = 0; i < wires.length; i++) {
    for (let j = i + 1; j < wires.length; j++) {
      const a = wires[i]
      const b = wires[j]
      const touch =
        a.points.some((p) => pointTouchesWire(p, b)) ||
        b.points.some((p) => pointTouchesWire(p, a))
      if (touch) uf.union(wireKeyOf(a.id), wireKeyOf(b.id))
    }
  }

  // Pin ↔ wire: pin sits on a vertex or anywhere along a segment.
  for (const pin of pins) {
    for (const w of wires) {
      if (pointTouchesWire(pin.position, w)) {
        uf.union(pinKeyOf(pin.componentId, pin.pinName), wireKeyOf(w.id))
      }
    }
  }

  // Pin ↔ pin: direct contact.
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      if (pointsEqual(pins[i].position, pins[j].position)) {
        uf.union(
          pinKeyOf(pins[i].componentId, pins[i].pinName),
          pinKeyOf(pins[j].componentId, pins[j].pinName),
        )
      }
    }
  }

  // All ground symbols collapse into one reference group.
  const groundComponents = Object.values(circuit.components).filter((c) => c.type === 'ground')
  const hasGround = groundComponents.length > 0
  if (hasGround) {
    uf.add(GROUND_KEY)
    for (const g of groundComponents) uf.union(GROUND_KEY, pinKeyOf(g.id, 'ref'))
  }

  // ── Assign node numbers: ground = 0, the rest 1..N in deterministic order ──
  const groups = uf.groups()
  const groundRoot = hasGround ? uf.find(GROUND_KEY) : null

  const nonGroundRoots = [...groups.keys()].filter((r) => r !== groundRoot)
  // Sort by smallest member key so numbering is stable across re-runs.
  nonGroundRoots.sort((a, b) => (groups.get(a)![0] < groups.get(b)![0] ? -1 : 1))

  const nodeIdOfRoot = new Map<string, number>()
  if (groundRoot) nodeIdOfRoot.set(groundRoot, 0)
  let next = 1
  for (const root of nonGroundRoots) nodeIdOfRoot.set(root, next++)

  const pinByKey = new Map(pins.map((p) => [pinKeyOf(p.componentId, p.pinName), p]))
  const wireById = new Map(wires.map((w) => [w.id, w]))

  const nodes: ElectricalNode[] = []
  const nodeOfPin = new Map<string, number>()
  const nodeOfWire = new Map<string, number>()

  for (const [root, members] of groups) {
    const id = nodeIdOfRoot.get(root)!
    const nodePins: PinLocation[] = []
    const wireIds: string[] = []
    const pointSet = new Map<string, Point>()

    for (const member of members) {
      if (member === GROUND_KEY) continue
      if (member.startsWith('pin:')) {
        const pin = pinByKey.get(member)!
        nodePins.push(pin)
        nodeOfPin.set(`${pin.componentId}:${pin.pinName}`, id)
        pointSet.set(pointKey(pin.position), pin.position)
      } else {
        const wireId = member.slice('wire:'.length)
        wireIds.push(wireId)
        nodeOfWire.set(wireId, id)
        for (const p of wireById.get(wireId)!.points) pointSet.set(pointKey(p), p)
      }
    }

    nodes.push({ id, members, pins: nodePins, wireIds, points: [...pointSet.values()] })
  }
  nodes.sort((a, b) => a.id - b.id)

  // ── Junction dots: degree ≥ 3 at any candidate point ────────────────────────
  // Candidates are pin positions and wire vertices; a wire passing straight
  // through a candidate contributes 2 branches, an endpoint 1, an interior
  // corner vertex 2, a pin 1. Crossings without a vertex never become
  // candidates, so they never get a dot (and were never connected above).
  const candidates = new Map<string, Point>()
  for (const pin of pins) candidates.set(pointKey(pin.position), pin.position)
  for (const w of wires) for (const p of w.points) candidates.set(pointKey(p), p)

  const junctions: Point[] = []
  for (const p of candidates.values()) {
    let degree = 0
    let entities = 0
    for (const pin of pins) {
      if (pointsEqual(pin.position, p)) {
        degree += 1
        entities += 1
      }
    }
    for (const w of wires) {
      let wireDegree = 0
      for (let i = 0; i < w.points.length - 1; i++) {
        const a = w.points[i]
        const b = w.points[i + 1]
        if (pointsEqual(p, a)) wireDegree += 1
        else if (pointsEqual(p, b)) wireDegree += 1
        else if (pointOnOrthoSegment(p, a, b)) wireDegree += 2
      }
      if (wireDegree > 0) {
        degree += wireDegree
        entities += 1
      }
    }
    if (degree >= 3 && entities >= 2) junctions.push(p)
  }

  // ── Floating pins: alone in their group ────────────────────────────────────
  const floatingPins = pins.filter((pin) => {
    const members = groups.get(uf.find(pinKeyOf(pin.componentId, pin.pinName)))!
    return members.length === 1
  })

  return { nodes, nodeOfPin, nodeOfWire, junctions, hasGround, floatingPins }
}
