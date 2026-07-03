// Schematic-level data model for the Simulation Tab.
// The solver engine (src/modules/circuit-sim/engine) has its own flat netlist
// types; core/netlist.ts translates from these editor types into that format.

export interface Point {
  x: number
  y: number
}

export type Rotation = 0 | 90 | 180 | 270

export type SchematicComponentType =
  | 'resistor'
  | 'capacitor'
  | 'capacitor-polarized'
  | 'inductor'
  | 'vsource-dc'
  | 'vsource-ac'
  | 'vsource-pulse'
  | 'isource-dc'
  | 'ground'

export interface ComponentInstance {
  id: string
  type: SchematicComponentType
  /** Reference designator, e.g. R1, C2, V1. Grounds share 'GND'. */
  refdes: string
  /** World position of the component origin, grid-snapped. */
  position: Point
  rotation: Rotation
  params: Record<string, number>
}

export interface Wire {
  id: string
  /** Orthogonal polyline, every vertex grid-snapped. */
  points: Point[]
}

export type ProbeKind = 'voltage' | 'current'

export interface Probe {
  id: string
  kind: ProbeKind
  /** World position the probe was dropped at (resolved to a node/branch at solve time). */
  position: Point
  label: string
}

export type AnalysisMode = 'dc' | 'transient' | 'ac'

export interface SimulationSettings {
  mode: AnalysisMode
  transient: { stopTime: number; timeStep: number }
  ac: { startFreq: number; stopFreq: number; pointsPerDecade: number; sweepType: 'log' | 'linear' }
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export interface Circuit {
  id: string
  name: string
  components: Record<string, ComponentInstance>
  wires: Wire[]
  probes: Probe[]
  viewport: Viewport
  simulationSettings: SimulationSettings
  /** Heavy waveform buffers live in IndexedDB keyed by this id, not in the store. */
  lastRunId: string | null
  createdAt: number
  updatedAt: number
}

export const GRID = 10

export function defaultSimulationSettings(): SimulationSettings {
  return {
    mode: 'dc',
    transient: { stopTime: 0.01, timeStep: 1e-5 },
    ac: { startFreq: 1, stopFreq: 1e6, pointsPerDecade: 20, sweepType: 'log' },
  }
}
