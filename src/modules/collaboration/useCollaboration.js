import { useState, useEffect, useRef, useCallback } from 'react'
import { logEvent } from '../../engine/eventLog'

const COLORS = ['#00c8ff', '#ff6b6b', '#b388ff', '#00e676', '#ffab40', '#ff4081']
const HEARTBEAT_INTERVAL = 15000
const CURSOR_THROTTLE_MS = Math.floor(1000 / 30) // 30fps

function resolveWsUrl() {
  const configured = import.meta.env?.VITE_COLLAB_WS_URL
  if (configured) return configured
  // Same-origin default: honors https pages (wss) and avoids mixed-content blocking.
  const isSecure = window.location.protocol === 'https:'
  const protocol = isSecure ? 'wss' : 'ws'
  const host = isSecure ? window.location.hostname : 'localhost'
  const port = import.meta.env?.VITE_COLLAB_WS_PORT || 3001
  return `${protocol}://${host}:${port}`
}

const WS_URL = resolveWsUrl()

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function generateToken() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID() + window.crypto.randomUUID()
  }
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join('')
}

// Room IDs are human-shareable but must still be unguessable: a short/predictable
// ID lets an attacker race or enumerate a room before legitimate users connect
// (see server join semantics). Use 128 bits of crypto-strong randomness, formatted
// as dashed groups of 4 uppercase hex chars to match the existing display style.
function generateRoomId() {
  const toGroups = (hex) => hex.toUpperCase().match(/.{1,4}/g).join('-')
  if (window.crypto?.randomUUID) {
    return toGroups(window.crypto.randomUUID().replace(/-/g, ''))
  }
  if (window.crypto?.getRandomValues) {
    const bytes = window.crypto.getRandomValues(new Uint8Array(16))
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return toGroups(hex)
  }
  const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase()
  return [seg(), seg(), seg(), seg(), seg(), seg(), seg(), seg()].join('-')
}

function getRoomFromUrl() {
  const params = new URLSearchParams(window.location.search)
  return params.get('room')
}

// The room token is a shared secret. It travels in the URL #fragment —
// fragments are never sent in HTTP requests, so the token can't land in
// server or proxy access logs, and browsers strip fragments from Referer
// headers. It must never go back into the query string.
export function getTokenFromUrl() {
  const m = window.location.hash.match(/(?:^#|&)ctk=([^&]+)/)
  if (m) {
    try { return decodeURIComponent(m[1]) } catch { return m[1] }
  }
  // Legacy links carried ?token= in the query string; accept it once —
  // setRoomInUrl rewrites the URL with the token moved into the fragment.
  const params = new URLSearchParams(window.location.search)
  return params.get('token')
}

export function setRoomInUrl(roomId, token) {
  const url = new URL(window.location.href)
  url.searchParams.set('room', roomId)
  url.searchParams.delete('token')
  url.hash = token ? `ctk=${encodeURIComponent(token)}` : ''
  window.history.replaceState({}, '', url.toString())
}

// Same-tab reload fallback: sessionStorage is scoped to the tab and cleared
// when it closes, so the token survives a refresh without any URL exposure.
const TOKEN_STORE_PREFIX = 'enginguity_collab_token_'

export function loadStoredToken(roomId) {
  try { return sessionStorage.getItem(TOKEN_STORE_PREFIX + roomId) } catch { return null }
}

export function storeToken(roomId, token) {
  try { sessionStorage.setItem(TOKEN_STORE_PREFIX + roomId, token) } catch { /* quota/priv-mode — fragment still covers reloads */ }
}

export function clearStoredToken(roomId) {
  try { sessionStorage.removeItem(TOKEN_STORE_PREFIX + roomId) } catch { /* already gone */ }
}

export function useCollaboration(initialRoomId, userName) {
  const [connected, setConnected] = useState(false)
  const [users, setUsers] = useState([])
  const roomId = initialRoomId || getRoomFromUrl() || null
  const [activeRoomId, setActiveRoomId] = useState(roomId)
  const [authError, setAuthError] = useState(null)

  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const heartbeatRef = useRef(null)
  const reconnectAttempts = useRef(0)
  const stateUpdateCallbacks = useRef([])
  const lastCursorSend = useRef(0)
  const roomTokenRef = useRef(roomId ? getTokenFromUrl() || loadStoredToken(roomId) || generateToken() : null)

  const localUser = useRef({
    id: generateId(),
    name: userName || 'Engineer',
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  })

  const send = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  // Marks a socket as deliberately closed (unmount, leaveRoom, or being
  // replaced by a new connection) so its onclose does NOT schedule a
  // reconnect. Client-initiated closes surface as code 1005/1000, which the
  // close-code allowlist alone can't distinguish from a dropped connection —
  // without this flag every unmount spawned a ghost socket that rejoined the
  // room after cleanup had already run. Flag lives on the socket itself so
  // replacing the socket can't leave a stale global bit behind.
  const closeSocket = useCallback((ws) => {
    if (!ws) return
    ws.intentionallyClosed = true
    ws.close()
  }, [])

  const connect = useCallback((rid) => {
    closeSocket(wsRef.current)

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      reconnectAttempts.current = 0
      ws.send(JSON.stringify({
        type: 'join',
        roomId: rid,
        userId: localUser.current.id,
        payload: {
          name: localUser.current.name,
          color: localUser.current.color,
          token: roomTokenRef.current,
        },
      }))

      logEvent('COLLABORATION_STARTED', {
        roomId: rid,
        userId: localUser.current.id,
        userName: localUser.current.name,
        module: 'collaboration'
      })
      // Heartbeat
      heartbeatRef.current = setInterval(() => {
        ws.send(JSON.stringify({
          type: 'presence',
          roomId: rid,
          userId: localUser.current.id,
          payload: {},
        }))
      }, HEARTBEAT_INTERVAL)
    }

    ws.onmessage = (e) => {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }

      switch (msg.type) {
        case 'state_sync':
          setUsers(msg.payload.users || [])
          stateUpdateCallbacks.current.forEach((cb) => cb(msg.payload.state, true))
          break
        case 'presence':
          setUsers(msg.payload.users || [])
          break
        case 'state_update':
          stateUpdateCallbacks.current.forEach((cb) => cb(msg.payload?.delta, false))
          break
        case 'cursor_move':
          setUsers((prev) => prev.map((u) =>
            u.id === msg.userId ? { ...u, cursor: msg.payload.position } : u
          ))
          break
        case 'comment_add':
        case 'comment_resolve':
        case 'comment_reply':
          stateUpdateCallbacks.current.forEach((cb) => cb({ _commentEvent: msg }, false))
          break
        case 'error':
          if (msg.payload?.code === 'auth_required' || msg.payload?.code === 'auth_failed') {
            setAuthError(msg.payload.message || 'Unable to join room.')
          }
          break
      }
    }

    ws.onclose = (e) => {
      setConnected(false)
      clearInterval(heartbeatRef.current)
      // We closed this socket on purpose — no reconnect.
      if (ws.intentionallyClosed) return
      // Don't retry on auth/room-capacity failures — the token or room won't fix itself.
      if (e.code === 4001 || e.code === 4003 || e.code === 4004) return
      // Exponential backoff reconnect
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
      reconnectAttempts.current++
      reconnectTimerRef.current = setTimeout(() => connect(rid), delay)
    }

    ws.onerror = () => {}
  }, [closeSocket])

  useEffect(() => {
    if (!activeRoomId) return

    setAuthError(null)
    if (roomTokenRef.current) storeToken(activeRoomId, roomTokenRef.current)
    setRoomInUrl(activeRoomId, roomTokenRef.current)
    connect(activeRoomId)

    const onUnload = () => {
      send({
        type: 'leave',
        roomId: activeRoomId,
        userId: localUser.current.id,
        payload: {},
      })
    }
    window.addEventListener('beforeunload', onUnload)

    return () => {
      window.removeEventListener('beforeunload', onUnload)
      clearTimeout(reconnectTimerRef.current)
      clearInterval(heartbeatRef.current)
      onUnload()
      closeSocket(wsRef.current)
    }
  }, [activeRoomId, connect, send, closeSocket])

  const sendStateUpdate = useCallback((delta) => {
    if (!activeRoomId) return
    send({
      type: 'state_update',
      roomId: activeRoomId,
      userId: localUser.current.id,
      payload: { delta },
    })
  }, [activeRoomId, send])

  const sendCursorMove = useCallback((position) => {
    const now = Date.now()
    if (now - lastCursorSend.current < CURSOR_THROTTLE_MS) return
    lastCursorSend.current = now
    if (!activeRoomId) return
    send({
      type: 'cursor_move',
      roomId: activeRoomId,
      userId: localUser.current.id,
      payload: { position },
    })
  }, [activeRoomId, send])

  const addComment = useCallback((comment) => {
    if (!activeRoomId) return
    send({
      type: 'comment_add',
      roomId: activeRoomId,
      userId: localUser.current.id,
      payload: comment,
    })
  }, [activeRoomId, send])

  const resolveComment = useCallback((commentId) => {
    if (!activeRoomId) return
    send({
      type: 'comment_resolve',
      roomId: activeRoomId,
      userId: localUser.current.id,
      payload: { commentId },
    })
  }, [activeRoomId, send])

  const replyComment = useCallback((commentId, text) => {
    if (!activeRoomId) return
    send({
      type: 'comment_reply',
      roomId: activeRoomId,
      userId: localUser.current.id,
      payload: { commentId, text },
    })
  }, [activeRoomId, send])

  const onStateUpdate = useCallback((callback) => {
    stateUpdateCallbacks.current.push(callback)
    return () => {
      stateUpdateCallbacks.current = stateUpdateCallbacks.current.filter((cb) => cb !== callback)
    }
  }, [])

  const startSession = useCallback((name) => {
    const newRoomId = generateRoomId()
    if (name) localUser.current.name = name
    roomTokenRef.current = generateToken()
    setActiveRoomId(newRoomId)
    return newRoomId
  }, [])

  const joinRoom = useCallback((rid, name, token) => {
    if (name) localUser.current.name = name
    roomTokenRef.current = token || getTokenFromUrl() || loadStoredToken(rid) || generateToken()
    setActiveRoomId(rid)
  }, [])

  const leaveRoom = useCallback(() => {
    if (activeRoomId) {
      send({
        type: 'leave',
        roomId: activeRoomId,
        userId: localUser.current.id,
        payload: {},
      })
    }
    clearTimeout(reconnectTimerRef.current)
    clearInterval(heartbeatRef.current)
    closeSocket(wsRef.current)
    setConnected(false)
    setUsers([])
    if (activeRoomId) clearStoredToken(activeRoomId)
    setActiveRoomId(null)
    roomTokenRef.current = null
    const url = new URL(window.location.href)
    url.searchParams.delete('room')
    url.searchParams.delete('token')
    url.hash = ''
    window.history.replaceState({}, '', url.toString())
  }, [activeRoomId, send, closeSocket])

  return {
    connected,
    users,
    authError,
    sendStateUpdate,
    sendCursorMove,
    addComment,
    resolveComment,
    replyComment,
    onStateUpdate,
    roomId: activeRoomId,
    roomToken: roomTokenRef.current,
    localUser: localUser.current,
    startSession,
    joinRoom,
    leaveRoom,
  }
}
