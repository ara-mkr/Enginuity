// Promise interface over the solver worker. The worker is created lazily on
// the first solve and reused; if workers are unavailable (tests, exotic
// embeds) or the worker crashes, the solve runs synchronously on the main
// thread instead — same math, same errors, just blocking.

import type { Netlist } from '../../circuit-sim/engine/types'
import type { SimulationSettings } from '../types'
import { runAnalysis, type AnalysisRunResult } from './runAnalysis'

interface SolveResponse {
  id: number
  ok: boolean
  result?: AnalysisRunResult
  error?: string
}

type Pending = { resolve: (r: AnalysisRunResult) => void; reject: (e: Error) => void }

let worker: Worker | null = null
let workerBroken = false
let seq = 0
const pending = new Map<number, Pending>()

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === 'undefined') return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    workerBroken = true
    return null
  }
  worker.onmessage = (e: MessageEvent<SolveResponse>) => {
    const { id, ok, result, error } = e.data
    const p = pending.get(id)
    if (!p) return
    pending.delete(id)
    if (ok && result) p.resolve(result)
    else p.reject(new Error(error ?? 'Solver failed.'))
  }
  // A load/runtime failure of the worker itself (not a solver error — those
  // come back as ok:false). Fail everything in flight and fall back to
  // main-thread solves from here on.
  worker.onerror = () => {
    for (const p of pending.values()) p.reject(new Error('Solver worker crashed — falling back to main thread on the next run.'))
    pending.clear()
    worker?.terminate()
    worker = null
    workerBroken = true
  }
  return worker
}

export function solveAnalysis(netlist: Netlist, settings: SimulationSettings): Promise<AnalysisRunResult> {
  const w = getWorker()
  if (!w) {
    return new Promise((resolve, reject) => {
      try {
        resolve(runAnalysis(netlist, settings))
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }
  return new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    w.postMessage({ id, netlist, settings })
  })
}
