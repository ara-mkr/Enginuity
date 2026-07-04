// Persistence for solver run results. Waveform buffers are heavy (up to
// 5000 points × N nodes), so per the storage conventions they live in
// blobStore (IndexedDB) keyed by runId — the zustand slice only carries the
// circuit's lastRunId pointer.

import { blobStore } from '../../../engine/blobStore'
import type { AnalysisRunResult } from './runAnalysis'

export interface RunRecord {
  runId: string
  circuitId: string
  /** circuit.updatedAt at solve time — newer edits mean the result is stale. */
  circuitUpdatedAt: number
  ranAt: number
  result: AnalysisRunResult
}

export const runBlobId = (runId: string): string => `sim-run-${runId}`

export async function saveRunRecord(record: RunRecord): Promise<void> {
  await blobStore.save(runBlobId(record.runId), { category: 'simulation-run', ...record })
}

export async function loadRunRecord(runId: string): Promise<RunRecord | null> {
  const blob = await blobStore.get(runBlobId(runId))
  if (!blob || !blob.result || typeof blob.circuitId !== 'string') return null
  return {
    runId: blob.runId ?? runId,
    circuitId: blob.circuitId,
    circuitUpdatedAt: blob.circuitUpdatedAt ?? 0,
    ranAt: blob.ranAt ?? 0,
    result: blob.result as AnalysisRunResult,
  }
}

export async function deleteRunRecord(runId: string): Promise<void> {
  await blobStore.delete(runBlobId(runId))
}
