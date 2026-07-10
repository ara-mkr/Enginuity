import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import OPENROUTER_MODELS, {
  OR_KEY_STORAGE,
  OR_MODEL_STORAGE,
  OR_USAGE_STORAGE,
  OR_DEFAULT_MODEL,
} from '../config/openrouterModels'
import { OLLAMA_MODEL_STORAGE, OLLAMA_PROVIDER_STORAGE } from '../config/ollama'
import { logEvent } from '../engine/eventLog'
import { readStoredKey, writeStoredKey, clearStoredKey } from '../utils/keyStorage'

export type ProviderId = 'openrouter' | 'ollama' | 'both'

export interface ORModel {
  id: string
  name: string
  provider: string
  providerColor: string
  tier: string
  contextK: number
  inputPricePer1M: number
  outputPricePer1M: number
  tags: string[]
  recommended?: boolean
  free?: boolean
}

export interface UsageEntry {
  timestamp: number
  model: string
  estimatedCost: number
  module: string
}

interface OpenRouterContextValue {
  apiKey: string | null
  isConnected: boolean
  activeModelId: string
  setModelId: (id: string) => void
  models: ORModel[]
  saveKey: (key: string) => void
  clearKey: () => void
  setupOpen: boolean
  openSetup: () => void
  closeSetup: () => void
  pickerOpen: boolean
  openPicker: () => void
  closePicker: () => void
  usageLog: UsageEntry[]
  logUsage: (model: string, estimatedCost: number, module?: string) => void
  totalRequestsToday: number
  // Provider routing — 'ollama' uses local Ollama; 'openrouter' uses cloud;
  // 'both' prefers Ollama and falls back to OpenRouter on slow/missing models.
  activeProvider: ProviderId
  setActiveProvider: (p: ProviderId) => void
  ollamaModelId: string | null
  setOllamaModelId: (id: string) => void
}

const OpenRouterContext = createContext<OpenRouterContextValue | null>(null)

function readUsageLog(): UsageEntry[] {
  try {
    return JSON.parse(localStorage.getItem(OR_USAGE_STORAGE) ?? '[]')
  } catch {
    return []
  }
}

export function OpenRouterProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(() => readStoredKey(OR_KEY_STORAGE))
  const [activeModelId, setActiveModelIdState] = useState<string>(
    () => localStorage.getItem(OR_MODEL_STORAGE) ?? OR_DEFAULT_MODEL
  )
  const [setupOpen, setSetupOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [usageLog, setUsageLog] = useState<UsageEntry[]>(readUsageLog)
  const [activeProvider, setActiveProviderState] = useState<ProviderId>(() => {
    // A previously stored 'custom' (retired provider) falls back to OpenRouter.
    const v = localStorage.getItem(OLLAMA_PROVIDER_STORAGE)
    return v === 'ollama' || v === 'both' ? v : 'openrouter'
  })
  const [ollamaModelId, setOllamaModelIdState] = useState<string | null>(
    () => localStorage.getItem(OLLAMA_MODEL_STORAGE),
  )

  const setActiveProvider = useCallback((p: ProviderId) => {
    setActiveProviderState((prev) => {
      if (prev !== p) {
        logEvent('PROVIDER_SWITCHED', { oldProvider: prev, newProvider: p, module: 'ai' })
      }
      return p
    })
    localStorage.setItem(OLLAMA_PROVIDER_STORAGE, p)
    window.dispatchEvent(new CustomEvent('enginguity:provider-changed', { detail: p }))
  }, [])

  const setOllamaModelId = useCallback((id: string) => {
    setOllamaModelIdState(id)
    localStorage.setItem(OLLAMA_MODEL_STORAGE, id)
    window.dispatchEvent(new CustomEvent('enginguity:ollama-model-changed', { detail: id }))
  }, [])

  const saveKey = useCallback((key: string) => {
    writeStoredKey(OR_KEY_STORAGE, key)
    setApiKeyState(key)
  }, [])

  const clearKey = useCallback(() => {
    clearStoredKey(OR_KEY_STORAGE)
    setApiKeyState(null)
    setSetupOpen(true)
  }, [])

  const setModelId = useCallback((id: string) => {
    setActiveModelIdState((prevId) => {
      if (prevId !== id) {
        logEvent('MODEL_SWITCHED', {
          oldModel: prevId,
          newModel: id,
          module: 'ai'
        })
      }
      return id
    })
    localStorage.setItem(OR_MODEL_STORAGE, id)
    window.dispatchEvent(new CustomEvent('enginguity:model-changed', { detail: id }))
  }, [])

  const logUsage = useCallback((model: string, estimatedCost: number, module = 'unknown') => {
    setUsageLog((prev) => {
      const entry: UsageEntry = { timestamp: Date.now(), model, estimatedCost, module }
      const updated = [entry, ...prev].slice(0, 1000)
      localStorage.setItem(OR_USAGE_STORAGE, JSON.stringify(updated))
      return updated
    })
  }, [])

  // Sync across tabs. The key itself is per-tab (sessionStorage), so only
  // the model choice and usage log react to storage events from other tabs.
  useEffect(() => {
    const handler = () => {
      setActiveModelIdState(localStorage.getItem(OR_MODEL_STORAGE) ?? OR_DEFAULT_MODEL)
      setUsageLog(readUsageLog())
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const totalRequestsToday = usageLog.filter(
    (e) => new Date(e.timestamp).toISOString().slice(0, 10) === today
  ).length

  return (
    <OpenRouterContext.Provider
      value={{
        apiKey,
        isConnected: !!apiKey || ((activeProvider === 'ollama' || activeProvider === 'both') && !!ollamaModelId),
        activeModelId,
        setModelId,
        models: OPENROUTER_MODELS,
        saveKey,
        clearKey,
        setupOpen,
        openSetup: () => setSetupOpen(true),
        closeSetup: () => setSetupOpen(false),
        pickerOpen,
        openPicker: () => setPickerOpen(true),
        closePicker: () => setPickerOpen(false),
        usageLog,
        logUsage,
        totalRequestsToday,
        activeProvider,
        setActiveProvider,
        ollamaModelId,
        setOllamaModelId,
      }}
    >
      {children}
    </OpenRouterContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook is tightly coupled to this provider's context instance
export function useOpenRouter() {
  const ctx = useContext(OpenRouterContext)
  if (!ctx) throw new Error('useOpenRouter must be within OpenRouterProvider')
  return ctx
}
