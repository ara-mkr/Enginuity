import { useEffect } from 'react'
import { moduleStateStore } from '../store/moduleState'

/**
 * Publishes a compact summary of a module's state to moduleStateStore so
 * Probe Bot and the observation engine have context for the active module.
 *
 * Pass summaries (counts, names, statuses) — never raw payloads like file
 * contents, element arrays, or AI bodies. The summary is serialized to
 * dedupe publishes, so it must stay small and JSON-safe.
 */
export function useProbeContext(module: string, summary: Record<string, unknown>) {
  const serialized = JSON.stringify(summary)
  useEffect(() => {
    moduleStateStore.publish(module, JSON.parse(serialized))
  }, [module, serialized])
}
