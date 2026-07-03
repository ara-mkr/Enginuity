import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { readStoredKey, writeStoredKey, clearStoredKey } from '../utils/keyStorage'

const STORAGE_KEY = 'enginguity_api_key'

interface APIKeyContextValue {
  apiKey: string | null
  setApiKey: (key: string) => void
  clearApiKey: () => void
  hasKey: boolean
}

const APIKeyContext = createContext<APIKeyContextValue | null>(null)

export function APIKeyProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string | null>(
    () => readStoredKey(STORAGE_KEY)
  )

  const setApiKey = useCallback((key: string) => {
    writeStoredKey(STORAGE_KEY, key)
    setApiKeyState(key)
  }, [])

  const clearApiKey = useCallback(() => {
    clearStoredKey(STORAGE_KEY)
    setApiKeyState(null)
  }, [])

  return (
    <APIKeyContext.Provider value={{ apiKey, setApiKey, clearApiKey, hasKey: !!apiKey }}>
      {children}
    </APIKeyContext.Provider>
  )
}

export function useAPIKey() {
  const ctx = useContext(APIKeyContext)
  if (!ctx) throw new Error('useAPIKey must be used within APIKeyProvider')
  return ctx
}
