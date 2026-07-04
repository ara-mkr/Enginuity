// Runs the schematic's engine netlist through the MNA solver for the active
// analysis mode and returns a display-ready, structured-cloneable result.
// Simulation numbers only ever come from the solver — errors are thrown with
// actionable messages, never papered over with fabricated data.

import { runAC } from '../../circuit-sim/engine/acAnalysis'
import { solveDC } from '../../circuit-sim/engine/dcAnalysis'
import { runTransient } from '../../circuit-sim/engine/transientAnalysis'
import type { Netlist } from '../../circuit-sim/engine/types'
import type { SimulationSettings } from '../types'

/** Rendering cap: transient runs are coarsened to at most this many points. */
export const MAX_TRANSIENT_POINTS = 5000

export interface DCRunResult {
  kind: 'dc'
  /** Node id → voltage (V). Ground (0) is included at exactly 0. */
  nodeVoltages: Record<number, number>
  /** Component refdes → current (A) through it, positive from its first pin to its second. */
  componentCurrents: Record<string, number>
  warnings: string[]
}

export interface TransientRunResult {
  kind: 'transient'
  time: number[]
  /** Node id → voltage series aligned with `time`. Ground is omitted. */
  nodeVoltages: Record<number, number[]>
  warnings: string[]
}

export interface ACRunResult {
  kind: 'ac'
  frequency: number[]
  /** Node id → gain series (dB) relative to the unit-magnitude stimulus. */
  magnitudeDb: Record<number, number[]>
  phaseDeg: Record<number, number[]>
  /** Refdes of the source used as the AC stimulus. */
  stimulus: string
  warnings: string[]
}

export type AnalysisRunResult = DCRunResult | TransientRunResult | ACRunResult

export function runAnalysis(netlist: Netlist, settings: SimulationSettings): AnalysisRunResult {
  switch (settings.mode) {
    case 'dc':
      return runDCOperatingPoint(netlist)
    case 'transient':
      return runTransientAnalysis(netlist, settings)
    case 'ac':
      return runACSweep(netlist, settings)
  }
}

function runDCOperatingPoint(netlist: Netlist): DCRunResult {
  const dc = solveDC(netlist)
  const nodeVoltages: Record<number, number> = { 0: 0, ...dc.nodeVoltages }
  const voltage = (node: number) => nodeVoltages[node] ?? 0

  // The MNA solution only carries branch currents for devices with a branch
  // unknown (sources, inductors); the rest follow from Ohm's law or the DC
  // device model (capacitor = open, so exactly 0 A).
  const componentCurrents: Record<string, number> = {}
  for (const comp of netlist.components) {
    switch (comp.type) {
      case 'resistor':
        componentCurrents[comp.id] = (voltage(comp.nodes[0]) - voltage(comp.nodes[1])) / comp.value
        break
      case 'capacitor':
        componentCurrents[comp.id] = 0
        break
      case 'isource':
        componentCurrents[comp.id] = comp.value
        break
      default: {
        const branch = dc.branchCurrents[comp.id]
        if (branch !== undefined) componentCurrents[comp.id] = branch
      }
    }
  }

  return { kind: 'dc', nodeVoltages, componentCurrents, warnings: dc.warnings ?? [] }
}

function runTransientAnalysis(netlist: Netlist, settings: SimulationSettings): TransientRunResult {
  const { stopTime, timeStep } = settings.transient
  if (!(stopTime > 0)) throw new Error('Transient stop time must be positive.')
  if (!(timeStep > 0)) throw new Error('Transient time step must be positive.')
  if (timeStep >= stopTime) throw new Error('Transient time step must be smaller than the stop time.')

  const warnings: string[] = []
  let h = timeStep
  if (stopTime / h > MAX_TRANSIENT_POINTS) {
    h = stopTime / MAX_TRANSIENT_POINTS
    warnings.push(
      `Time step coarsened to ${MAX_TRANSIENT_POINTS} points for rendering (requested step was finer).`,
    )
  }

  const result = runTransient(netlist, { startTime: 0, stopTime, timestep: h })
  if (result.warnings) warnings.push(...result.warnings)
  return { kind: 'transient', time: result.time, nodeVoltages: result.nodeVoltages, warnings }
}

function runACSweep(netlist: Netlist, settings: SimulationSettings): ACRunResult {
  const stimulus = netlist.components.find(
    (c) => (c.type === 'vsource' || c.type === 'isource') && c.waveform?.kind === 'sine',
  )
  if (!stimulus) {
    throw new Error('AC analysis needs an AC voltage source in the circuit to use as the stimulus.')
  }

  const { startFreq, stopFreq, pointsPerDecade } = settings.ac
  if (!(startFreq > 0)) throw new Error('AC start frequency must be positive.')
  if (!(stopFreq > startFreq)) throw new Error('AC stop frequency must be above the start frequency.')
  if (!(pointsPerDecade >= 1)) throw new Error('AC sweep needs at least 1 point per decade.')

  const result = runAC(netlist, { startFreq, stopFreq, pointsPerDecade, acSourceId: stimulus.id })
  return {
    kind: 'ac',
    frequency: result.frequency,
    magnitudeDb: result.magnitude_db,
    phaseDeg: result.phase_deg,
    stimulus: stimulus.id,
    warnings: [],
  }
}
