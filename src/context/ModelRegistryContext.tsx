import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import MODEL_REGISTRY from '../config/modelRegistry'

// ---------------------------------------------------------------------------
// Storage key helpers (exported so other modules can use them)
// ---------------------------------------------------------------------------
export const keyFor = (id: string) => `enginguity_key_${id}`
export const modelFor = (id: string) => `enginguity_model_${id}`
export const ACTIVE_PROVIDER_KEY = 'enginguity_active_provider'
export const ACTIVE_MODEL_KEY = 'enginguity_active_model'
const USAGE_KEY = 'enginguity_usage'

// ---------------------------------------------------------------------------
// Registry type helpers
// ---------------------------------------------------------------------------
export interface RegistryModel {
  id: string
  name: string
  tier: 'flagship' | 'fast' | 'reasoning' | 'code' | 'balanced'
  context: string
}

export interface RegistryProvider {
  name: string
  color: string
  keyPrefix: string
  docsUrl: string
  baseURL: string
  authHeader: string
  authPrefix?: string
  note?: string
  models: RegistryModel[]
}

export type Registry = Record<string, RegistryProvider>

export const REGISTRY = MODEL_REGISTRY as Registry
export const PROVIDER_IDS = Object.keys(REGISTRY)

// ---------------------------------------------------------------------------
// Usage types
// ---------------------------------------------------------------------------
export interface ProviderUsage {
  requests: number
  tokens: number
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------
interface ModelRegistryContextValue {
  // Active selection
  activeProviderId: string | null
  activeModelId: string | null
  setActive: (providerId: string, modelId: string) => void

  // Key management
  getKey: (providerId: string) => string | null
  saveKey: (providerId: string, key: string, modelId?: string) => void
  removeKey: (providerId: string) => void
  connectedProviderIds: string[]

  // Usage
  todayUsage: Record<string, ProviderUsage>
  trackUsage: (providerId: string, tokensUsed?: number) => void

  // UI state — driven from here so any component can open modals
  gridOpen: boolean
  openGrid: () => void
  closeGrid: () => void
  keyModalProvider: string | null
  openKeyModal: (providerId: string) => void
  closeKeyModal: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readConnectedIds(): string[] {
  return PROVIDER_IDS.filter((id) => !!localStorage.getItem(keyFor(id)))
}

function readTodayUsage(): Record<string, ProviderUsage> {
  const today = new Date().toISOString().slice(0, 10)
  try {
    const raw = localStorage.getItem(USAGE_KEY)
    if (!raw) return {}
    return (JSON.parse(raw) as Record<string, Record<string, ProviderUsage>>)[today] ?? {}
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const ModelRegistryContext = createContext<ModelRegistryContextValue | null>(null)

export function ModelRegistryProvider({ children }: { children: ReactNode }) {
  const [activeProviderId, setActiveProviderIdState] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_PROVIDER_KEY)
  )
  const [activeModelId, setActiveModelIdState] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_MODEL_KEY)
  )
  const [connectedProviderIds, setConnectedProviderIds] = useState<string[]>(readConnectedIds)
  const [todayUsage, setTodayUsage] = useState<Record<string, ProviderUsage>>(readTodayUsage)
  const [gridOpen, setGridOpen] = useState(false)
  const [keyModalProvider, setKeyModalProvider] = useState<string | null>(null)

  // Re-sync when other tabs or components update localStorage
  useEffect(() => {
    const refresh = () => {
      setConnectedProviderIds(readConnectedIds())
      setTodayUsage(readTodayUsage())
      const pid = localStorage.getItem(ACTIVE_PROVIDER_KEY)
      const mid = localStorage.getItem(ACTIVE_MODEL_KEY)
      setActiveProviderIdState(pid)
      setActiveModelIdState(mid)
    }
    window.addEventListener('storage', refresh)
    window.addEventListener('enginguity:registry-updated', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('enginguity:registry-updated', refresh)
    }
  }, [])

  const setActive = useCallback((providerId: string, modelId: string) => {
    localStorage.setItem(ACTIVE_PROVIDER_KEY, providerId)
    localStorage.setItem(ACTIVE_MODEL_KEY, modelId)
    setActiveProviderIdState(providerId)
    setActiveModelIdState(modelId)
  }, [])

  const getKey = useCallback((providerId: string) => {
    return localStorage.getItem(keyFor(providerId))
  }, [])

  const saveKey = useCallback((providerId: string, key: string, modelId?: string) => {
    localStorage.setItem(keyFor(providerId), key)
    const resolvedModel = modelId ?? REGISTRY[providerId]?.models[0]?.id
    if (resolvedModel) localStorage.setItem(modelFor(providerId), resolvedModel)

    // Auto-set as active if nothing active yet
    if (!localStorage.getItem(ACTIVE_PROVIDER_KEY) && resolvedModel) {
      localStorage.setItem(ACTIVE_PROVIDER_KEY, providerId)
      localStorage.setItem(ACTIVE_MODEL_KEY, resolvedModel)
      setActiveProviderIdState(providerId)
      setActiveModelIdState(resolvedModel)
    }

    setConnectedProviderIds(readConnectedIds())
    window.dispatchEvent(new Event('enginguity:registry-updated'))
  }, [])

  const removeKey = useCallback(
    (providerId: string) => {
      localStorage.removeItem(keyFor(providerId))
      const remaining = readConnectedIds()
      setConnectedProviderIds(remaining)

      if (activeProviderId === providerId) {
        if (remaining.length > 0) {
          const next = remaining[0]
          const nextModel =
            localStorage.getItem(modelFor(next)) ?? REGISTRY[next]?.models[0]?.id ?? ''
          localStorage.setItem(ACTIVE_PROVIDER_KEY, next)
          localStorage.setItem(ACTIVE_MODEL_KEY, nextModel)
          setActiveProviderIdState(next)
          setActiveModelIdState(nextModel)
        } else {
          localStorage.removeItem(ACTIVE_PROVIDER_KEY)
          localStorage.removeItem(ACTIVE_MODEL_KEY)
          setActiveProviderIdState(null)
          setActiveModelIdState(null)
        }
      }
      window.dispatchEvent(new Event('enginguity:registry-updated'))
    },
    [activeProviderId]
  )

  const trackUsage = useCallback((providerId: string, tokensUsed = 0) => {
    const today = new Date().toISOString().slice(0, 10)
    try {
      const raw = localStorage.getItem(USAGE_KEY)
      const all: Record<string, Record<string, ProviderUsage>> = raw ? JSON.parse(raw) : {}
      if (!all[today]) all[today] = {}
      if (!all[today][providerId]) all[today][providerId] = { requests: 0, tokens: 0 }
      all[today][providerId].requests += 1
      all[today][providerId].tokens += tokensUsed
      localStorage.setItem(USAGE_KEY, JSON.stringify(all))
      setTodayUsage({ ...all[today] })
    } catch {
      // ignore
    }
  }, [])

  return (
    <ModelRegistryContext.Provider
      value={{
        activeProviderId,
        activeModelId,
        setActive,
        getKey,
        saveKey,
        removeKey,
        connectedProviderIds,
        todayUsage,
        trackUsage,
        gridOpen,
        openGrid: () => setGridOpen(true),
        closeGrid: () => setGridOpen(false),
        keyModalProvider,
        openKeyModal: (id) => setKeyModalProvider(id),
        closeKeyModal: () => setKeyModalProvider(null),
      }}
    >
      {children}
    </ModelRegistryContext.Provider>
  )
}

export function useModelRegistry() {
  const ctx = useContext(ModelRegistryContext)
  if (!ctx) throw new Error('useModelRegistry must be used within ModelRegistryProvider')
  return ctx
}
