import type { ProbeKind, SchematicComponentType } from './types'

export type Tool =
  | { kind: 'select' }
  | { kind: 'wire' }
  | { kind: 'place'; type: SchematicComponentType }
  | { kind: 'probe'; probe: ProbeKind }

export type Selection =
  | { kind: 'component'; id: string }
  | { kind: 'wire'; id: string }
  | { kind: 'probe'; id: string }

export const SELECT_TOOL: Tool = { kind: 'select' }
export const WIRE_TOOL: Tool = { kind: 'wire' }
export const VOLTAGE_PROBE_TOOL: Tool = { kind: 'probe', probe: 'voltage' }
export const CURRENT_PROBE_TOOL: Tool = { kind: 'probe', probe: 'current' }
