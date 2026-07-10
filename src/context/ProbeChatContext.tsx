import { createContext, useContext } from 'react'
import { useChatSessions, deriveTitleFromText, type UseChatSessionsResult } from '../hooks/useChatSessions'

export interface ProbeMessage {
  id: string
  type: string
  text: string
  timestamp?: number
  streaming?: boolean
}

const PROBE_DEFAULT_MESSAGES: ProbeMessage[] = [
  { id: 'sys-start', type: 'system', text: 'Probe Bot ready', timestamp: Date.now() },
]

function deriveProbeTitle(messages: ProbeMessage[]): string {
  const first = messages.find((m) => m.type === 'user')
  return deriveTitleFromText(first?.text ?? '')
}

function isProbeEmpty(messages: ProbeMessage[]): boolean {
  return !messages.some((m) => m.type === 'user')
}

type ProbeChatContextValue = UseChatSessionsResult<ProbeMessage>

const ProbeChatContext = createContext<ProbeChatContextValue | null>(null)

export function ProbeChatProvider({ children }: { children: React.ReactNode }) {
  const result = useChatSessions<ProbeMessage>({
    scope: 'probe',
    defaultMessages: PROBE_DEFAULT_MESSAGES,
    deriveTitle: deriveProbeTitle,
    isEmpty: isProbeEmpty,
  })

  return (
    <ProbeChatContext.Provider value={result}>
      {children}
    </ProbeChatContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook is tightly coupled to this provider's context instance
export function useProbeChat(): ProbeChatContextValue {
  const ctx = useContext(ProbeChatContext)
  if (!ctx) throw new Error('useProbeChat must be used within ProbeChatProvider')
  return ctx
}
