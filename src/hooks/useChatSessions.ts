// Persistent chat sessions stored in localStorage. Survives tab switches and reloads.
// Generic over the message shape so Home (role+content) and Probe Bot (id+type+text)
// can both use the same hook.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const SESSIONS_KEY = 'enginguity_chat_sessions_v1'
const ACTIVE_KEY_PREFIX = 'enginguity_chat_active_'

interface RawSession<T> {
  id: string
  scope: string
  title: string
  messages: T[]
  createdAt: number
  updatedAt: number
}

interface Store<T> {
  sessions: RawSession<T>[]
}

function readStore<T>(): Store<T> {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (!raw) return { sessions: [] }
    const parsed = JSON.parse(raw) as Store<T>
    return parsed?.sessions ? parsed : { sessions: [] }
  } catch {
    return { sessions: [] }
  }
}

function writeStore<T>(store: Store<T>): void {
  try {
    // Cap total stored messages so localStorage doesn't bloat. Keep most-recent 50 sessions.
    const trimmed = {
      sessions: [...store.sessions]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 50),
    }
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(trimmed))
  } catch {
    // Quota exceeded — silently fail rather than blow up the chat.
  }
}

function readActiveId(scope: string): string | null {
  return localStorage.getItem(ACTIVE_KEY_PREFIX + scope)
}

function writeActiveId(scope: string, id: string): void {
  localStorage.setItem(ACTIVE_KEY_PREFIX + scope, id)
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export interface ChatSession<T> {
  id: string
  title: string
  messages: T[]
  createdAt: number
  updatedAt: number
}

export interface UseChatSessionsResult<T> {
  messages: T[]
  setMessages: React.Dispatch<React.SetStateAction<T[]>>
  sessions: ChatSession<T>[]
  activeSessionId: string
  startNewSession: () => void
  switchToSession: (id: string) => void
  deleteSession: (id: string) => void
  renameSession: (id: string, title: string) => void
}

interface Options<T> {
  scope: string
  defaultMessages: T[]
  // Extract a title from a snapshot of messages. Called when archiving.
  deriveTitle: (messages: T[]) => string
  // Whether the messages array is "empty" (i.e. only the default greeting).
  // Used to avoid archiving empty sessions when starting a new one.
  isEmpty?: (messages: T[]) => boolean
}

/**
 * useChatSessions — persistent chat state with session archive.
 *
 * Each scope ("home", "probe", etc.) has its own active session whose messages
 * survive tab switches and reloads. Calling startNewSession() archives the
 * current session (if it has any user content) and opens a fresh one.
 */
export function useChatSessions<T>({
  scope,
  defaultMessages,
  deriveTitle,
  isEmpty,
}: Options<T>): UseChatSessionsResult<T> {
  // Stable ref to default so the lazy initializer doesn't need it in deps.
  const defaultRef = useRef(defaultMessages)

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const existing = readActiveId(scope)
    if (existing) {
      const store = readStore<T>()
      const found = store.sessions.find((s) => s.id === existing && s.scope === scope)
      if (found) return existing
    }
    // No active session — create a fresh one.
    const id = newId()
    const store = readStore<T>()
    const session: RawSession<T> = {
      id,
      scope,
      title: 'New chat',
      messages: defaultRef.current,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    writeStore<T>({ sessions: [session, ...store.sessions] })
    writeActiveId(scope, id)
    return id
  })

  const [messages, setMessagesState] = useState<T[]>(() => {
    const store = readStore<T>()
    const session = store.sessions.find((s) => s.id === activeSessionId)
    return session?.messages ?? defaultRef.current
  })

  const [sessions, setSessions] = useState<ChatSession<T>[]>(() =>
    readStore<T>()
      .sessions.filter((s) => s.scope === scope)
      .map(({ scope: _, ...rest }) => rest),
  )

  // Persist messages on every change for the active session.
  useEffect(() => {
    const store = readStore<T>()
    const idx = store.sessions.findIndex((s) => s.id === activeSessionId)
    if (idx === -1) {
      // Active session vanished from storage somehow — re-create it.
      store.sessions.unshift({
        id: activeSessionId,
        scope,
        title: deriveTitle(messages) || 'New chat',
        messages,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    } else {
      store.sessions[idx].messages = messages
      store.sessions[idx].updatedAt = Date.now()
      // Auto-update title if it's still the placeholder
      if (store.sessions[idx].title === 'New chat') {
        const derived = deriveTitle(messages)
        if (derived && derived !== 'New chat') store.sessions[idx].title = derived
      }
    }
    writeStore<T>(store)
    setSessions(
      store.sessions
        .filter((s) => s.scope === scope)
        .map(({ scope: _, ...rest }) => rest),
    )
  }, [messages, activeSessionId, scope, deriveTitle])

  const setMessages: React.Dispatch<React.SetStateAction<T[]>> = useCallback(
    (next) => {
      setMessagesState((prev) => (typeof next === 'function' ? (next as (p: T[]) => T[])(prev) : next))
    },
    [],
  )

  const startNewSession = useCallback(() => {
    // Don't archive if current session is effectively empty (just greeting).
    const empty = isEmpty?.(messages) ?? false
    const id = newId()
    const store = readStore<T>()

    if (empty) {
      // Reuse the current session id for the new chat (no archive).
      const idx = store.sessions.findIndex((s) => s.id === activeSessionId)
      if (idx >= 0) {
        store.sessions[idx].messages = defaultRef.current
        store.sessions[idx].title = 'New chat'
        store.sessions[idx].updatedAt = Date.now()
      }
    } else {
      // Insert a brand-new session at the top.
      store.sessions.unshift({
        id,
        scope,
        title: 'New chat',
        messages: defaultRef.current,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
    writeStore<T>(store)

    if (!empty) {
      writeActiveId(scope, id)
      setActiveSessionId(id)
    }
    setMessagesState(defaultRef.current)
  }, [messages, activeSessionId, scope, isEmpty])

  const switchToSession = useCallback(
    (id: string) => {
      const store = readStore<T>()
      const target = store.sessions.find((s) => s.id === id && s.scope === scope)
      if (!target) return
      writeActiveId(scope, id)
      setActiveSessionId(id)
      setMessagesState(target.messages)
    },
    [scope],
  )

  const deleteSession = useCallback(
    (id: string) => {
      const store = readStore<T>()
      const remaining = store.sessions.filter((s) => s.id !== id)
      writeStore<T>({ sessions: remaining })
      setSessions(
        remaining
          .filter((s) => s.scope === scope)
          .map(({ scope: _, ...rest }) => rest),
      )
      // If we deleted the active session, switch to most recent or create new.
      if (id === activeSessionId) {
        const next = remaining.find((s) => s.scope === scope)
        if (next) {
          writeActiveId(scope, next.id)
          setActiveSessionId(next.id)
          setMessagesState(next.messages)
        } else {
          const fresh = newId()
          const newSession: RawSession<T> = {
            id: fresh,
            scope,
            title: 'New chat',
            messages: defaultRef.current,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
          writeStore<T>({ sessions: [newSession, ...remaining] })
          writeActiveId(scope, fresh)
          setActiveSessionId(fresh)
          setMessagesState(defaultRef.current)
          setSessions([
            {
              id: fresh,
              title: 'New chat',
              messages: defaultRef.current,
              createdAt: newSession.createdAt,
              updatedAt: newSession.updatedAt,
            },
          ])
        }
      }
    },
    [activeSessionId, scope],
  )

  const renameSession = useCallback(
    (id: string, title: string) => {
      const store = readStore<T>()
      const idx = store.sessions.findIndex((s) => s.id === id)
      if (idx === -1) return
      store.sessions[idx].title = title.trim() || 'Untitled'
      store.sessions[idx].updatedAt = Date.now()
      writeStore<T>(store)
      setSessions(
        store.sessions
          .filter((s) => s.scope === scope)
          .map(({ scope: _, ...rest }) => rest),
      )
    },
    [scope],
  )

  // Sync across tabs (chat open in two windows).
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== SESSIONS_KEY) return
      const store = readStore<T>()
      setSessions(
        store.sessions
          .filter((s) => s.scope === scope)
          .map(({ scope: _, ...rest }) => rest),
      )
      const session = store.sessions.find((s) => s.id === activeSessionId)
      if (session) setMessagesState(session.messages)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [activeSessionId, scope])

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.updatedAt - a.updatedAt),
    [sessions],
  )

  return {
    messages,
    setMessages,
    sessions: sortedSessions,
    activeSessionId,
    startNewSession,
    switchToSession,
    deleteSession,
    renameSession,
  }
}

// Generic title derivation: take the first non-greeting user message,
// truncate to 50 chars, strip newlines.
export function deriveTitleFromText(text: string): string {
  if (!text) return 'New chat'
  const cleaned = text.trim().replace(/\s+/g, ' ')
  if (!cleaned) return 'New chat'
  return cleaned.length > 50 ? cleaned.slice(0, 47) + '...' : cleaned
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}
