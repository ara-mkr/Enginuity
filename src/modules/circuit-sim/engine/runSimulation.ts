import { runAC } from './acAnalysis'
import { solveDC } from './dcAnalysis'
import { runTransient } from './transientAnalysis'
import type { ParsedNetlist } from './netlistParser'

/** Rendering cap: transient runs are coarsened to at most this many points. */
const MAX_TRANSIENT_POINTS = 5000
const DEFAULT_SWEEP_STEPS = 100

export interface UISimResult {
  type: 'transient' | 'ac' | 'operating_point' | 'dc_sweep'
  data: Record<string, unknown>
  warnings: string[]
}

/**
 * Runs the analysis described by a parsed netlist through the typed MNA
 * engine and maps the numeric-node results back to the netlist's string
 * node names for display. Throws with a descriptive message on invalid
 * netlists or singular systems — there is deliberately no fallback path:
 * simulation numbers only ever come from the solver.
 */
export function runNetlistAnalysis(parsed: ParsedNetlist): UISimResult {
  const { netlist, nodeNames, analysis, acSourceId } = parsed
  const warnings: string[] = []

  if (netlist.components.length === 0) {
    throw new Error('Netlist contains no simulatable components.')
  }

  switch (analysis.type) {
    case 'transient': {
      const tStop = Number(analysis.params.tStop) || 0.01
      let tStep = Number(analysis.params.tStep) || tStop / 1000
      if (tStop / tStep > MAX_TRANSIENT_POINTS) {
        tStep = tStop / MAX_TRANSIENT_POINTS
        warnings.push(
          `Timestep coarsened to ${MAX_TRANSIENT_POINTS} points for rendering (requested step was finer).`
        )
      }
      const result = runTransient(netlist, { startTime: 0, stopTime: tStop, timestep: tStep })
      if (result.warnings) warnings.push(...result.warnings)

      const voltages: Record<string, number[]> = {}
      for (const [node, series] of Object.entries(result.nodeVoltages)) {
        const name = nodeNames[Number(node)]
        if (name && name !== '0') voltages[name] = series
      }
      return { type: 'transient', data: { time: result.time, voltages, currents: {} }, warnings }
    }

    case 'ac': {
      if (!acSourceId) {
        throw new Error('AC analysis needs at least one V or I source to use as the stimulus.')
      }
      const fStart = Number(analysis.params.fStart) || 1
      const fStop = Number(analysis.params.fStop) || 1e6
      const pointsPerDecade = Number(analysis.params.numPoints) || 20
      const result = runAC(netlist, { startFreq: fStart, stopFreq: fStop, pointsPerDecade, acSourceId })

      const probeNode = pickProbeNode(nodeNames)
      const probeNum = Number(
        Object.keys(nodeNames).find((n) => nodeNames[Number(n)] === probeNode)
      )
      return {
        type: 'ac',
        data: {
          frequency: result.frequency,
          magnitude_db: result.magnitude_db[probeNum] ?? [],
          phase_deg: result.phase_deg[probeNum] ?? [],
          probeNode,
        },
        warnings,
      }
    }

    case 'dc_sweep': {
      const sourceId = String(analysis.params.source ?? '')
      const source = netlist.components.find(
        (c) => c.id.toUpperCase() === sourceId.toUpperCase() && (c.type === 'vsource' || c.type === 'isource')
      )
      if (!source) {
        throw new Error(`.DC sweep source "${sourceId}" not found in the netlist.`)
      }
      const start = Number(analysis.params.start) || 0
      const stop = Number(analysis.params.stop) || 0
      const step = Number(analysis.params.step) || 0
      const steps = step > 0 ? Math.min(Math.ceil(Math.abs(stop - start) / step), 2000) : DEFAULT_SWEEP_STEPS

      const sweepVar: number[] = []
      const outputVars: Record<string, number[]> = {}
      for (let i = 0; i <= steps; i++) {
        const v = start + ((stop - start) * i) / steps
        sweepVar.push(v)
        const swept = {
          components: netlist.components.map((c) => (c.id === source.id ? { ...c, value: v } : c)),
        }
        const dc = solveDC(swept)
        if (dc.warnings) {
          for (const w of dc.warnings) {
            const tagged = `At sweep point ${v}: ${w}`
            if (!warnings.includes(tagged)) warnings.push(tagged)
          }
        }
        for (const [node, volt] of Object.entries(dc.nodeVoltages)) {
          const name = nodeNames[Number(node)]
          if (!name || name === '0') continue
          const key = `v(${name})`
          if (!outputVars[key]) outputVars[key] = []
          outputVars[key].push(volt)
        }
      }
      return { type: 'dc_sweep', data: { sweepVar, outputVars }, warnings }
    }

    default: {
      const result = solveDC(netlist)
      if (result.warnings) warnings.push(...result.warnings)
      const nodeVoltages: Record<string, number> = { '0': 0 }
      for (const [node, v] of Object.entries(result.nodeVoltages)) {
        const name = nodeNames[Number(node)]
        if (name) nodeVoltages[name] = v
      }
      return {
        type: 'operating_point',
        data: { nodeVoltages, branchCurrents: result.branchCurrents },
        warnings,
      }
    }
  }
}

/**
 * Which node the single-trace AC plots probe: prefer a node literally
 * named out/vout, otherwise the last node declared in the netlist (the
 * conventional position of the output in hand-written netlists).
 */
function pickProbeNode(nodeNames: Record<number, string>): string {
  const names = Object.entries(nodeNames)
    .filter(([num]) => Number(num) !== 0)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, name]) => name)
  const preferred = names.find((n) => /^v?out$/i.test(n))
  return preferred ?? names[names.length - 1] ?? '0'
}
