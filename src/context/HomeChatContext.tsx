import { createContext, useCallback, useContext } from 'react'
import { useChatSessions, deriveTitleFromText, type UseChatSessionsResult } from '../hooks/useChatSessions'

export interface HomeMessage {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export const HOME_DEFAULT_MESSAGES: HomeMessage[] = [
  {
    role: 'assistant',
    content: `Hello! I am your ENGINGUITY engineering assistant.

I can help you brainstorm project ideas, explain electrical concepts, draft code, or analyze schematics.

Type a query or describe a project below. If we outline a project, I will extract a blueprint that you can load directly into your workspace.`,
  },
]

type HomeChatContextValue = UseChatSessionsResult<HomeMessage>

const HomeChatContext = createContext<HomeChatContextValue | null>(null)

export function HomeChatProvider({ children }: { children: React.ReactNode }) {
  const deriveTitle = useCallback((msgs: HomeMessage[]) => {
    const firstUser = msgs.find((m) => m.role === 'user')
    return firstUser ? deriveTitleFromText(firstUser.content) : 'New chat'
  }, [])

  const isEmpty = useCallback(
    (msgs: HomeMessage[]) => msgs.length <= 1 || !msgs.some((m) => m.role === 'user'),
    [],
  )

  const result = useChatSessions<HomeMessage>({
    scope: 'home',
    defaultMessages: HOME_DEFAULT_MESSAGES,
    deriveTitle,
    isEmpty,
  })

  return (
    <HomeChatContext.Provider value={result}>
      {children}
    </HomeChatContext.Provider>
  )
}

export function useHomeChat(): HomeChatContextValue {
  const ctx = useContext(HomeChatContext)
  if (!ctx) throw new Error('useHomeChat must be used within HomeChatProvider')
  return ctx
}
