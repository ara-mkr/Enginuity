// Dedicated worker that runs MNA analyses off the main thread so long
// transient sweeps can't freeze the schematic editor. Pure request/response:
// { id, netlist, settings } in → { id, ok, result | error } out.

import { runAnalysis } from './runAnalysis'
import type { Netlist } from '../../circuit-sim/engine/types'
import type { SimulationSettings } from '../types'

interface SolveRequest {
  id: number
  netlist: Netlist
  settings: SimulationSettings
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<SolveRequest>) => void) | null
  postMessage(message: unknown): void
}

scope.onmessage = (e: MessageEvent<SolveRequest>) => {
  const { id, netlist, settings } = e.data
  try {
    const result = runAnalysis(netlist, settings)
    scope.postMessage({ id, ok: true, result })
  } catch (err) {
    scope.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
