import type { SchematicComponentType } from './types'

export type Tool =
  | { kind: 'select' }
  | { kind: 'wire' }
  | { kind: 'place'; type: SchematicComponentType }

export type Selection =
  | { kind: 'component'; id: string }
  | { kind: 'wire'; id: string }

export const SELECT_TOOL: Tool = { kind: 'select' }
export const WIRE_TOOL: Tool = { kind: 'wire' }
