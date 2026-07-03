import WebSocket, { WebSocketServer } from 'ws'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

const PORT = process.env.PORT || 3001
const MAX_PAYLOAD_BYTES = 64 * 1024 // 64KB per message
const MAX_ROOM_STATE_BYTES = 2 * 1024 * 1024 // 2MB total room state
const MAX_USERS_PER_ROOM = 50
const MAX_COMMENTS_PER_ROOM = 2000
const MAX_TEXT_LENGTH = 5000
const MAX_NAME_LENGTH = 60
const RATE_LIMIT_WINDOW_MS = 1000
const RATE_LIMIT_MAX_MESSAGES = 40 // per window
const IDLE_TIMEOUT_MS = 5 * 60 * 1000
const ROOM_EMPTY_TTL_MS = 10 * 60 * 1000 // keep an empty room's secret alive for reconnects
const MAX_CONNECTIONS_PER_IP = 20

const wss = new WebSocketServer({ port: PORT, maxPayload: MAX_PAYLOAD_BYTES })

// Per-IP connection counts. Uses the socket's remote address — behind a
// reverse proxy this is the proxy's address, so terminate abuse there too;
// x-forwarded-for is client-spoofable and deliberately not trusted here.
const connectionsPerIp = new Map()

// rooms: Map<roomId, { secret, emptyAt, users: Map<userId, {ws, name, color, cursor, lastSeen}>, state: {} }>
const rooms = new Map()

// A room becoming empty doesn't immediately free its id/secret — that would let
// anyone claim an abandoned room by joining with a fresh token before the
// original participants reconnect. Instead we mark it and sweep it later.
function markEmptyIfUnoccupied(room) {
  if (room.users.size === 0) room.emptyAt = Date.now()
}

// ---- validation helpers ----

const ALLOWED_TYPES = new Set([
  'join', 'leave', 'state_update', 'cursor_move',
  'comment_add', 'comment_resolve', 'comment_reply', 'presence',
])

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function isNonEmptyString(v, maxLen) {
  return typeof v === 'string' && v.length > 0 && v.length <= maxLen
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function byteLength(obj) {
  try {
    return Buffer.byteLength(JSON.stringify(obj))
  } catch {
    return Infinity
  }
}

function sanitizeDelta(delta) {
  if (!isPlainObject(delta)) return null
  const keys = Object.keys(delta)
  if (keys.length === 0 || keys.length > 200) return null
  for (const key of keys) {
    if (FORBIDDEN_KEYS.has(key)) return null
  }
  return delta
}

function clampString(v, maxLen) {
  if (typeof v !== 'string') return ''
  return v.slice(0, maxLen)
}

// ---- room / broadcast helpers ----

function createRoom(secret) {
  // stateBytes tracks the approximate serialized size of `state`
  // incrementally, so enforcing MAX_ROOM_STATE_BYTES doesn't require
  // re-stringifying up to 2MB of room state on every state_update (a CPU
  // amplification lever for a hostile client).
  return { secret, emptyAt: Date.now(), users: new Map(), state: {}, stateBytes: 2 }
}

/**
 * Applies a sanitized delta to room state under the byte cap. Size is
 * accounted per changed key (old value out, new value in), so cost scales
 * with the delta rather than the whole room state.
 */
function applyDelta(room, delta) {
  let deltaBytes = 0
  for (const [key, value] of Object.entries(delta)) {
    const oldValue = room.state[key]
    deltaBytes += byteLength({ [key]: value })
    if (oldValue !== undefined) deltaBytes -= byteLength({ [key]: oldValue })
  }
  if (room.stateBytes + deltaBytes > MAX_ROOM_STATE_BYTES) return false
  Object.assign(room.state, delta)
  room.stateBytes += deltaBytes
  return true
}

function broadcast(room, message, excludeUserId = null) {
  const data = JSON.stringify(message)
  room.users.forEach((user, userId) => {
    if (userId !== excludeUserId && user.ws.readyState === WebSocket.OPEN) {
      user.ws.send(data)
    }
  })
}

function broadcastAll(room, message) {
  broadcast(room, message, null)
}

function presenceList(room) {
  const users = []
  room.users.forEach((user, userId) => {
    users.push({
      id: userId,
      name: user.name,
      color: user.color,
      cursor: user.cursor,
      lastSeen: user.lastSeen,
    })
  })
  return users
}

function sendError(ws, code, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'error', payload: { code, message } }))
  }
}

function tokensMatch(a, b) {
  // Hash first so both buffers are always exactly 32 bytes — comparing raw,
  // padded strings can produce mismatched byte lengths for multi-byte input
  // (JS string length is UTF-16 code units, not UTF-8 bytes), and
  // crypto.timingSafeEqual throws synchronously on unequal-length buffers,
  // which would crash the whole server from a single malformed token.
  const digestA = crypto.createHash('sha256').update(String(a), 'utf8').digest()
  const digestB = crypto.createHash('sha256').update(String(b), 'utf8').digest()
  return crypto.timingSafeEqual(digestA, digestB)
}

wss.on('connection', (ws, req) => {
  const remoteIp = req.socket.remoteAddress || 'unknown'
  const ipCount = (connectionsPerIp.get(remoteIp) || 0) + 1
  if (ipCount > MAX_CONNECTIONS_PER_IP) {
    sendError(ws, 'too_many_connections', 'Connection limit reached for this address.')
    ws.close(4006, 'too_many_connections')
    return
  }
  connectionsPerIp.set(remoteIp, ipCount)

  let currentUserId = null
  let currentRoomId = null
  let rateWindowStart = Date.now()
  let rateMessageCount = 0

  ws.isAlive = true
  ws.on('pong', () => { ws.isAlive = true })

  ws.on('message', (raw) => {
    try {
      handleMessage(raw)
    } catch (err) {
      // A single malformed message must never take down the whole server.
      console.error('Error handling message:', err)
    }
  })

  function handleMessage(raw) {
    // Rate limit per connection
    const now = Date.now()
    if (now - rateWindowStart > RATE_LIMIT_WINDOW_MS) {
      rateWindowStart = now
      rateMessageCount = 0
    }
    rateMessageCount++
    if (rateMessageCount > RATE_LIMIT_MAX_MESSAGES) {
      sendError(ws, 'rate_limited', 'Too many messages, slow down.')
      return
    }

    let msg
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    if (!isPlainObject(msg)) return

    const { type, roomId, userId, payload } = msg

    if (!ALLOWED_TYPES.has(type)) return
    if (!isNonEmptyString(roomId, 64) || !/^[A-Za-z0-9_-]+$/.test(roomId)) return
    if (!isNonEmptyString(userId, 64) || !/^[A-Za-z0-9_-]+$/.test(userId)) return

    // Any connection must have joined the room it claims to act in
    if (type !== 'join' && (currentUserId !== userId || currentRoomId !== roomId)) return

    switch (type) {
      case 'join': {
        const token = isNonEmptyString(payload?.token, 256) ? payload.token : null
        if (!token) {
          sendError(ws, 'auth_required', 'A room token is required to join.')
          ws.close(4001, 'auth_required')
          return
        }

        let room = rooms.get(roomId)
        if (!room) {
          // First joiner establishes the room's secret (shared link token)
          room = createRoom(token)
          rooms.set(roomId, room)
        } else if (!tokensMatch(room.secret, token)) {
          sendError(ws, 'auth_failed', 'Invalid room token.')
          ws.close(4003, 'auth_failed')
          return
        }

        if (room.users.size >= MAX_USERS_PER_ROOM) {
          sendError(ws, 'room_full', 'This room is full.')
          ws.close(4004, 'room_full')
          return
        }

        currentUserId = userId
        currentRoomId = roomId
        room.emptyAt = null

        room.users.set(userId, {
          ws,
          name: clampString(payload?.name, MAX_NAME_LENGTH) || 'Anonymous',
          color: /^#[0-9a-fA-F]{3,8}$/.test(payload?.color || '') ? payload.color : '#00c8ff',
          cursor: null,
          lastSeen: Date.now(),
        })

        ws.send(JSON.stringify({
          type: 'state_sync',
          payload: {
            state: room.state,
            users: presenceList(room),
          },
        }))

        broadcastAll(room, {
          type: 'presence',
          payload: { users: presenceList(room) },
        })
        break
      }

      case 'leave': {
        const room = rooms.get(roomId)
        if (!room) return
        room.users.delete(userId)
        broadcast(room, {
          type: 'presence',
          payload: { users: presenceList(room) },
        })
        markEmptyIfUnoccupied(room)
        break
      }

      case 'state_update': {
        const room = rooms.get(roomId)
        if (!room) return
        const delta = sanitizeDelta(payload?.delta)
        if (delta) {
          if (!applyDelta(room, delta)) {
            sendError(ws, 'state_too_large', 'Room state limit exceeded.')
            return
          }
        }
        broadcast(room, {
          type: 'state_update',
          userId,
          payload: { delta },
        }, userId)
        break
      }

      case 'cursor_move': {
        const room = rooms.get(roomId)
        if (!room) return
        const user = room.users.get(userId)
        if (!user) return
        const position = payload?.position
        if (!isPlainObject(position) || typeof position.x !== 'number' || typeof position.y !== 'number') return
        user.cursor = { x: position.x, y: position.y }
        user.lastSeen = Date.now()
        broadcast(room, {
          type: 'cursor_move',
          userId,
          payload: {
            position: user.cursor,
            name: user.name,
            color: user.color,
          },
        }, userId)
        break
      }

      case 'comment_add': {
        const room = rooms.get(roomId)
        if (!room) return
        if (!room.state.comments) room.state.comments = []
        if (room.state.comments.length >= MAX_COMMENTS_PER_ROOM) {
          sendError(ws, 'too_many_comments', 'Comment limit reached for this room.')
          return
        }
        const user = room.users.get(userId)
        const comment = {
          id: uuidv4(),
          userId,
          userName: user?.name || 'Anonymous',
          userColor: user?.color || '#00c8ff',
          text: clampString(payload?.text, MAX_TEXT_LENGTH),
          position: isPlainObject(payload?.position) ? payload.position : { type: 'general' },
          resolved: false,
          createdAt: Date.now(),
          replies: [],
        }
        room.state.comments.push(comment)
        room.stateBytes += byteLength(comment)
        broadcastAll(room, {
          type: 'comment_add',
          payload: { comment },
        })
        break
      }

      case 'comment_resolve': {
        const room = rooms.get(roomId)
        if (!room) return
        if (room.state.comments) {
          const c = room.state.comments.find((c) => c.id === payload?.commentId)
          if (c) c.resolved = true
        }
        broadcastAll(room, {
          type: 'comment_resolve',
          payload: { commentId: payload?.commentId },
        })
        break
      }

      case 'comment_reply': {
        const room = rooms.get(roomId)
        if (!room) return
        const user = room.users.get(userId)
        // The broadcast carries the same reply object that lands in room
        // state, so clients can render the author immediately instead of
        // showing a blank name until the next full state_sync.
        const reply = {
          userId,
          userName: user?.name || 'Anonymous',
          text: clampString(payload?.text, MAX_TEXT_LENGTH),
          createdAt: Date.now(),
        }
        if (room.state.comments) {
          const c = room.state.comments.find((c) => c.id === payload?.commentId)
          if (c) {
            c.replies.push(reply)
            room.stateBytes += byteLength(reply)
          }
        }
        broadcastAll(room, {
          type: 'comment_reply',
          payload: { commentId: payload?.commentId, ...reply },
        })
        break
      }

      case 'presence': {
        const room = rooms.get(roomId)
        if (!room) return
        const user = room.users.get(userId)
        if (user) user.lastSeen = Date.now()
        break
      }
    }
  }

  ws.on('close', () => {
    const remaining = (connectionsPerIp.get(remoteIp) || 1) - 1
    if (remaining <= 0) connectionsPerIp.delete(remoteIp)
    else connectionsPerIp.set(remoteIp, remaining)

    if (currentUserId && currentRoomId) {
      const room = rooms.get(currentRoomId)
      if (room) {
        room.users.delete(currentUserId)
        broadcast(room, {
          type: 'presence',
          payload: { users: presenceList(room) },
        })
        markEmptyIfUnoccupied(room)
      }
    }
  })

  ws.on('error', () => {})
})

// Drop dead connections and idle users; reap rooms that have been empty past the grace TTL
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      ws.terminate()
      return
    }
    ws.isAlive = false
    ws.ping()
  })

  const now = Date.now()
  rooms.forEach((room, roomId) => {
    room.users.forEach((user, userId) => {
      if (now - user.lastSeen > IDLE_TIMEOUT_MS) {
        room.users.delete(userId)
        if (user.ws.readyState === WebSocket.OPEN) user.ws.close(4005, 'idle_timeout')
      }
    })
    markEmptyIfUnoccupied(room)
    if (room.users.size === 0 && room.emptyAt && now - room.emptyAt > ROOM_EMPTY_TTL_MS) {
      rooms.delete(roomId)
    }
  })
}, 30000)

wss.on('close', () => clearInterval(heartbeatInterval))

console.log(`ENGINGUITY Collaboration Server running on ws://localhost:${PORT}`)
console.log('For production, terminate TLS in front of this server and expose it as wss://.')
console.log('Press Ctrl+C to stop.')
