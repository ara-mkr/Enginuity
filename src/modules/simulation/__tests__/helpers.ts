import type { ComponentInstance, Point, Rotation, SchematicComponentType, Wire } from '../types'
import { getDef } from '../componentDefs'

let counter = 0

export function makeComponent(
  type: SchematicComponentType,
  refdes: string,
  position: Point,
  rotation: Rotation = 0,
  params?: Record<string, number>,
): ComponentInstance {
  const def = getDef(type)
  const defaults: Record<string, number> = {}
  for (const p of def.params) defaults[p.key] = p.defaultValue
  return {
    id: `test-${type}-${++counter}`,
    type,
    refdes,
    position,
    rotation,
    params: { ...defaults, ...params },
  }
}

export function makeWire(points: Point[]): Wire {
  return { id: `wire-${++counter}`, points }
}

export function asRecord(components: ComponentInstance[]): Record<string, ComponentInstance> {
  return Object.fromEntries(components.map((c) => [c.id, c]))
}
