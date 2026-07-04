// Owns the solve lifecycle for the active circuit: kicks analyses off on the
// solver worker, persists results to blobStore keyed by runId (only the
// pointer lives in the zustand slice), reloads the last run on mount/circuit
// switch, and logs a typed SIMULATION_RUN event per run.

import { useCallback, useEffect, useRef, useState } from 'react'
import { logEvent } from '../../../engine/eventLog'
import type { Circuit } from '../types'
import type { NetlistBuild } from '../core/netlist'
import type { AnalysisRunResult } from '../core/runAnalysis'
import { solveAnalysis } from '../core/solverClient'
import { deleteRunRecord, loadRunRecord, saveRunRecord, type RunRecord } from '../core/runStorage'
import { useSimulationStore } from '../store/circuitStore'

export interface SimulationRunState {
  status: 'idle' | 'running' | 'done' | 'error'
  runId: string | null
  result: AnalysisRunResult | null
  /** circuit.updatedAt at solve time; edits after it mark the result stale. */
  circuitUpdatedAt: number
  error: string | null
}

const IDLE: SimulationRunState = { status: 'idle', runId: null, result: null, circuitUpdatedAt: 0, error: null }

export interface UseSimulationRun {
  runState: SimulationRunState
  /** True when the schematic changed after the shown result was solved. */
  isStale: boolean
  run: () => void
  clear: () => void
}

export function useSimulationRun(circuit: Circuit, build: NetlistBuild): UseSimulationRun {
  const [runState, setRunState] = useState<SimulationRunState>(IDLE)
  const setLastRunId = useSimulationStore((s) => s.setLastRunId)

  // One run at a time per circuit. Claims are validated (never nulled) at
  // resolution: a late solve for a circuit the user switched away from still
  // persists its record but must not paint the current circuit's view.
  const activeSolveRef = useRef<{ circuitId: string; runId: string } | null>(null)
  const currentCircuitIdRef = useRef(circuit.id)
  useEffect(() => {
    currentCircuitIdRef.current = circuit.id
  }, [circuit.id])

  // Results never survive a circuit switch (render-time reset, same idiom as
  // the editor's selection reset).
  const [loadedCircuitId, setLoadedCircuitId] = useState(circuit.id)
  if (circuit.id !== loadedCircuitId) {
    setLoadedCircuitId(circuit.id)
    setRunState(IDLE)
  }

  // Adopt the persisted last run (mount, circuit switch, external change).
  // Only fills an idle slate — an in-flight or fresher in-memory result wins.
  useEffect(() => {
    const lastRunId = circuit.lastRunId
    if (!lastRunId) return
    let cancelled = false
    loadRunRecord(lastRunId)
      .then((record: RunRecord | null) => {
        if (cancelled || !record || record.circuitId !== circuit.id) return
        setRunState((prev) =>
          prev.status !== 'idle'
            ? prev
            : {
                status: 'done',
                runId: record.runId,
                result: record.result,
                circuitUpdatedAt: record.circuitUpdatedAt,
                error: null,
              },
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [circuit.id, circuit.lastRunId])

  const run = useCallback(() => {
    const netlist = build.engineNetlist
    if (!netlist || activeSolveRef.current?.circuitId === circuit.id) return

    const runId = crypto.randomUUID()
    const circuitId = circuit.id
    const previousRunId = circuit.lastRunId
    const settings = circuit.simulationSettings
    const circuitUpdatedAt = circuit.updatedAt
    const componentCount = netlist.components.length

    activeSolveRef.current = { circuitId, runId }
    setRunState({ status: 'running', runId, result: null, circuitUpdatedAt, error: null })

    solveAnalysis(netlist, settings)
      .then(async (result) => {
        if (activeSolveRef.current?.runId === runId) activeSolveRef.current = null
        // Paint only when the user is still looking at this circuit; the
        // record is persisted either way so switching back restores it.
        if (currentCircuitIdRef.current === circuitId) {
          setRunState({ status: 'done', runId, result, circuitUpdatedAt, error: null })
        }
        logEvent('SIMULATION_RUN', {
          analysisType: settings.mode,
          componentCount,
          warningCount: result.warnings.length,
          status: 'success',
          module: 'simulation-lab',
        })
        try {
          await saveRunRecord({ runId, circuitId, circuitUpdatedAt, ranAt: Date.now(), result })
          setLastRunId(circuitId, runId)
          if (previousRunId) deleteRunRecord(previousRunId).catch(() => {})
        } catch {
          // Persistence is best-effort; the in-memory result is already shown.
        }
      })
      .catch((err: Error) => {
        if (activeSolveRef.current?.runId === runId) activeSolveRef.current = null
        logEvent('SIMULATION_RUN', {
          analysisType: settings.mode,
          componentCount,
          status: 'error',
          error: err.message,
          module: 'simulation-lab',
        })
        if (currentCircuitIdRef.current === circuitId) {
          setRunState({ status: 'error', runId: null, result: null, circuitUpdatedAt, error: err.message })
        }
      })
  }, [build.engineNetlist, circuit.id, circuit.lastRunId, circuit.simulationSettings, circuit.updatedAt, setLastRunId])

  const clear = useCallback(() => {
    activeSolveRef.current = null
    setRunState(IDLE)
  }, [])

  const isStale = runState.status === 'done' && circuit.updatedAt > runState.circuitUpdatedAt

  return { runState, isStale, run, clear }
}
