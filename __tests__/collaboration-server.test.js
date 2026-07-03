// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import WebSocket from 'ws'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_PATH = path.join(__dirname, '..', 'collaboration-server.js')
const TEST_PORT = 39811

let serverProcess

function waitForServerReady() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server did not start in time')), 10000)
    serverProcess.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Collaboration Server running')) {
        clearTimeout(timer)
        resolve()
      }
    })
    serverProcess.stderr.on('data', (chunk) => {
      // Surface unexpected startup errors immediately instead of timing out silently.
      const text = chunk.toString()
      if (text.includes('Error') || text.includes('EADDRINUSE')) {
        clearTimeout(timer)
        reject(new Error(text))
      }
    })
  })
}

beforeAll(async () => {
  serverProcess = spawn('node', [SERVER_PATH], {
    env: { ...process.env, PORT: String(TEST_PORT) },
  })
  await waitForServerReady()
}, 15000)

afterAll(() => {
  serverProcess?.kill()
})

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`)
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}

function nextMessage(ws) {
  return new Promise((resolve) => {
    ws.once('message', (raw) => resolve(JSON.parse(raw)))
  })
}

function nextClose(ws) {
  return new Promise((resolve) => {
    ws.once('close', (code) => resolve(code))
  })
}

function uniqueRoom(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

describe('collaboration-server auth', () => {
  it('rejects a join with no token and closes with 4001', async () => {
    const ws = await connect()
    const roomId = uniqueRoom('no-token')
    ws.send(JSON.stringify({ type: 'join', roomId, userId: 'u1' }))
    const msg = await nextMessage(ws)
    expect(msg).toEqual({ type: 'error', payload: { code: 'auth_required', message: expect.any(String) } })
    const closeCode = await nextClose(ws)
    expect(closeCode).toBe(4001)
  })

  it('treats an oversized token (>256 chars) as absent', async () => {
    const ws = await connect()
    const roomId = uniqueRoom('big-token')
    ws.send(JSON.stringify({ type: 'join', roomId, userId: 'u1', payload: { token: 'x'.repeat(300) } }))
    const msg = await nextMessage(ws)
    expect(msg.payload.code).toBe('auth_required')
    ws.close()
  })

  it('lets the first joiner establish the room secret and grants state_sync', async () => {
    const ws = await connect()
    const roomId = uniqueRoom('create')
    ws.send(JSON.stringify({ type: 'join', roomId, userId: 'u1', payload: { token: 'secret-abc', name: 'Alice' } }))
    const msg = await nextMessage(ws)
    expect(msg.type).toBe('state_sync')
    expect(msg.payload.users).toHaveLength(1)
    ws.close()
  })

  it('rejects a second joiner presenting the wrong token, with correct token still working', async () => {
    const roomId = uniqueRoom('wrong-token')

    const owner = await connect()
    owner.send(JSON.stringify({ type: 'join', roomId, userId: 'owner', payload: { token: 'correct-secret', name: 'Owner' } }))
    await nextMessage(owner)

    const attacker = await connect()
    attacker.send(JSON.stringify({ type: 'join', roomId, userId: 'attacker', payload: { token: 'guessed-secret', name: 'Eve' } }))
    const attackerMsg = await nextMessage(attacker)
    expect(attackerMsg).toEqual({ type: 'error', payload: { code: 'auth_failed', message: expect.any(String) } })
    expect(await nextClose(attacker)).toBe(4003)

    const guest = await connect()
    guest.send(JSON.stringify({ type: 'join', roomId, userId: 'guest', payload: { token: 'correct-secret', name: 'Bob' } }))
    const guestMsg = await nextMessage(guest)
    expect(guestMsg.type).toBe('state_sync')

    owner.close()
    guest.close()
  })

  it('does not crash the server when a token contains multi-byte characters (regression: timingSafeEqual length mismatch)', async () => {
    const roomId = uniqueRoom('multibyte')

    const owner = await connect()
    owner.send(JSON.stringify({ type: 'join', roomId, userId: 'owner', payload: { token: 'a'.repeat(64), name: 'Owner' } }))
    await nextMessage(owner)

    const attacker = await connect()
    const multiByteToken = 'éèê'.repeat(50) // accented chars, 2 bytes each in UTF-8
    attacker.send(JSON.stringify({ type: 'join', roomId, userId: 'attacker', payload: { token: multiByteToken, name: 'Eve' } }))
    const attackerMsg = await nextMessage(attacker)
    expect(attackerMsg.payload.code).toBe('auth_failed')
    attacker.close()

    // Server must still be alive and responsive after handling the malformed token.
    const guest = await connect()
    guest.send(JSON.stringify({ type: 'join', roomId, userId: 'guest', payload: { token: 'a'.repeat(64), name: 'Bob' } }))
    const guestMsg = await nextMessage(guest)
    expect(guestMsg.type).toBe('state_sync')

    owner.close()
    guest.close()
  })

  it('prevents an abandoned room from being reclaimed with a different token before the TTL grace period expires', async () => {
    const roomId = uniqueRoom('hijack')

    const owner = await connect()
    owner.send(JSON.stringify({ type: 'join', roomId, userId: 'owner', payload: { token: 'owner-secret', name: 'Owner' } }))
    await nextMessage(owner)
    owner.close()
    await nextClose(owner)

    // Immediately after the room empties, an attacker tries to claim it with a fresh token.
    const attacker = await connect()
    attacker.send(JSON.stringify({ type: 'join', roomId, userId: 'attacker', payload: { token: 'attacker-secret', name: 'Eve' } }))
    const attackerMsg = await nextMessage(attacker)
    expect(attackerMsg.payload.code).toBe('auth_failed')
    attacker.close()

    // The original owner must still be able to reconnect with the original token.
    const rejoined = await connect()
    rejoined.send(JSON.stringify({ type: 'join', roomId, userId: 'owner', payload: { token: 'owner-secret', name: 'Owner' } }))
    const rejoinedMsg = await nextMessage(rejoined)
    expect(rejoinedMsg.type).toBe('state_sync')
    rejoined.close()
  })
})

describe('collaboration-server validation', () => {
  it('drops a state_update delta containing __proto__ without polluting Object.prototype', async () => {
    const roomId = uniqueRoom('proto')
    const owner = await connect()
    owner.send(JSON.stringify({ type: 'join', roomId, userId: 'owner', payload: { token: 'secret', name: 'Owner' } }))
    await nextMessage(owner)

    owner.send(JSON.stringify({
      type: 'state_update',
      roomId,
      userId: 'owner',
      payload: { delta: { __proto__: { polluted: true } } },
    }))
    await new Promise((r) => setTimeout(r, 150))

    expect({}.polluted).toBeUndefined()
    owner.close()
  })

  it('ignores a message whose roomId contains disallowed characters', async () => {
    const owner = await connect()
    owner.send(JSON.stringify({ type: 'join', roomId: '../etc/passwd', userId: 'owner', payload: { token: 'secret' } }))
    // No response should arrive for an invalid roomId — confirm the connection is still alive
    // by sending a valid join afterwards and getting a normal reply.
    const roomId = uniqueRoom('after-invalid')
    owner.send(JSON.stringify({ type: 'join', roomId, userId: 'owner', payload: { token: 'secret' } }))
    const msg = await nextMessage(owner)
    expect(msg.type).toBe('state_sync')
    owner.close()
  })

  it('rejects acting as a userId/roomId the connection never joined', async () => {
    const roomId = uniqueRoom('impersonate')
    const owner = await connect()
    owner.send(JSON.stringify({ type: 'join', roomId, userId: 'owner', payload: { token: 'secret' } }))
    await nextMessage(owner)

    // This connection never joined as "someone-else" — the state_update must be silently ignored.
    owner.send(JSON.stringify({
      type: 'state_update',
      roomId,
      userId: 'someone-else',
      payload: { delta: { voltage: 99 } },
    }))

    const second = await connect()
    second.send(JSON.stringify({ type: 'join', roomId, userId: 'second', payload: { token: 'secret' } }))
    const syncMsg = await nextMessage(second)
    expect(syncMsg.payload.state.voltage).toBeUndefined()

    owner.close()
    second.close()
  })
})

describe('collaboration-server rate limiting', () => {
  it('drops messages beyond the per-connection rate limit with a rate_limited error, without dropping the connection', async () => {
    const roomId = uniqueRoom('rate')
    const ws = await connect()
    ws.send(JSON.stringify({ type: 'join', roomId, userId: 'u1', payload: { token: 'secret' } }))
    await nextMessage(ws)

    let sawRateLimited = false
    const collected = []
    ws.on('message', (raw) => collected.push(JSON.parse(raw)))

    for (let i = 0; i < 80; i++) {
      ws.send(JSON.stringify({ type: 'presence', roomId, userId: 'u1', payload: {} }))
    }
    await new Promise((r) => setTimeout(r, 300))
    sawRateLimited = collected.some((m) => m.type === 'error' && m.payload.code === 'rate_limited')

    expect(sawRateLimited).toBe(true)
    expect(ws.readyState).toBe(WebSocket.OPEN)
    ws.close()
  })
})

describe('collaboration-server comments', () => {
  it('broadcasts comment replies with the author name (no blank authors before resync)', async () => {
    const roomId = uniqueRoom('reply')

    const alice = await connect()
    alice.send(JSON.stringify({ type: 'join', roomId, userId: 'alice', payload: { token: 's3cret', name: 'Alice' } }))
    await nextMessage(alice) // state_sync

    const bob = await connect()
    bob.send(JSON.stringify({ type: 'join', roomId, userId: 'bob', payload: { token: 's3cret', name: 'Bob' } }))
    await nextMessage(bob) // state_sync

    const aliceInbox = []
    alice.on('message', (raw) => aliceInbox.push(JSON.parse(raw)))

    alice.send(JSON.stringify({ type: 'comment_add', roomId, userId: 'alice', payload: { text: 'Check R3', position: { type: 'general' } } }))
    await new Promise((r) => setTimeout(r, 200))
    const added = aliceInbox.find((m) => m.type === 'comment_add')
    expect(added).toBeTruthy()
    const commentId = added.payload.comment.id

    bob.send(JSON.stringify({ type: 'comment_reply', roomId, userId: 'bob', payload: { commentId, text: 'Looks fine to me' } }))
    await new Promise((r) => setTimeout(r, 200))

    const reply = aliceInbox.find((m) => m.type === 'comment_reply')
    expect(reply).toBeTruthy()
    expect(reply.payload.commentId).toBe(commentId)
    expect(reply.payload.userName).toBe('Bob')
    expect(reply.payload.text).toBe('Looks fine to me')
    expect(reply.payload.createdAt).toEqual(expect.any(Number))

    alice.close()
    bob.close()
  })
})
