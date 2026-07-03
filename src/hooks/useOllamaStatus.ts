import { useCallback, useEffect, useState } from 'react'
import {
  fetchOllamaModels,
  fetchOllamaVersion,
  getOllamaHost,
  type OllamaModel,
} from '../config/ollama'

export interface OllamaStatus {
  running: boolean
  models: OllamaModel[]
  checking: boolean
  version: string | null
  error?: string
}

const INITIAL: OllamaStatus = {
  running: false,
  models: [],
  checking: true,
  version: null,
}

export function useOllamaStatus(pollMs = 30000): OllamaStatus & { recheck: () => Promise<void> } {
  const [status, setStatus] = useState<OllamaStatus>(INITIAL)

  const check = useCallback(async () => {
    setStatus((s) => ({ ...s, checking: true }))
    const host = getOllamaHost()
    const result = await fetchOllamaModels(host)
    if (result.available) {
      const version = await fetchOllamaVersion(host)
      setStatus({ running: true, models: result.models, checking: false, version })
    } else {
      setStatus({
        running: false,
        models: [],
        checking: false,
        version: null,
        error: result.error,
      })
    }
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  useEffect(() => {
    if (pollMs <= 0) return
    const id = setInterval(() => {
      void check()
    }, pollMs)
    return () => clearInterval(id)
  }, [check, pollMs])

  return { ...status, recheck: check }
}
