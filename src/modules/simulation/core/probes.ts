// Resolves dropped probes against the live schematic: a voltage probe binds
// to whatever electrical node its point sits on (pin or anywhere along a
// wire), a current probe binds to the component whose body it was dropped
// on. Resolution is recomputed from detection every render — probes never
// store node ids, so re-wiring around a probe just works.

import type { Circuit, ComponentInstance, Point, Probe } from '../types'
import { getDef } from '../componentDefs'
import { pointOnOrthoSegment, pointsEqual } from './geometry'
import type { NodeDetectionResult } from './nodeDetection'

export interface ResolvedProbe {
  probe: Probe
  /** Voltage probes: the node under the tip, or null when dangling in space. */
  nodeId: number | null
  /** Current probes: the component under the tip, or null when dangling. */
  component: ComponentInstance | null
}

function nodeAtPoint(
  point: Point,
  circuit: Pick<Circuit, 'wires'>,
  detection: NodeDetectionResult,
): number | null {
  for (const node of detection.nodes) {
    if (node.pins.some((pin) => pointsEqual(pin.position, point))) return node.id
  }
  for (const wire of circuit.wires) {
    for (let i = 0; i < wire.points.length - 1; i++) {
      if (pointOnOrthoSegment(point, wire.points[i], wire.points[i + 1])) {
        return detection.nodeOfWire.get(wire.id) ?? null
      }
    }
  }
  return null
}

function componentAtPoint(
  point: Point,
  components: Record<string, ComponentInstance>,
): ComponentInstance | null {
  let best: ComponentInstance | null = null
  let bestDist = Infinity
  for (const comp of Object.values(components)) {
    if (comp.type === 'ground') continue
    const def = getDef(comp.type)
    const rotated = comp.rotation === 90 || comp.rotation === 270
    const w = rotated ? def.bounds.h : def.bounds.w
    const h = rotated ? def.bounds.w : def.bounds.h
    const dx = Math.abs(point.x - comp.position.x)
    const dy = Math.abs(point.y - comp.position.y)
    if (dx > w / 2 + 4 || dy > h / 2 + 4) continue
    const dist = Math.hypot(dx, dy)
    if (dist < bestDist) {
      best = comp
      bestDist = dist
    }
  }
  return best
}

export function resolveProbes(
  circuit: Pick<Circuit, 'components' | 'wires' | 'probes'>,
  detection: NodeDetectionResult,
): ResolvedProbe[] {
  return circuit.probes.map((probe) =>
    probe.kind === 'voltage'
      ? { probe, nodeId: nodeAtPoint(probe.position, circuit, detection), component: null }
      : { probe, nodeId: null, component: componentAtPoint(probe.position, circuit.components) },
  )
}

/**
 * The componentCurrents key a current probe reads: most components report
 * under their refdes; BJTs report split currents, where the collector
 * current is the one a clamp-style probe would show.
 */
export function currentKeyFor(component: ComponentInstance): string {
  return component.type === 'bjt-npn' ? `${component.refdes} Ic` : component.refdes
}
