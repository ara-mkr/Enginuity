# Collaboration server

This documents the real-time collaboration WebSocket server. The file itself
lives at the repo root — `collaboration-server.js` — not inside `server/`;
this doc is kept at `server/README.md` per the path the rest of the repo
(root `README.md`, `AUDIT_REPORT.md`) already points to. Start it with
`npm run collab` (`node collaboration-server.js`).

## Overview

`collaboration-server.js` is a single-file `ws` (WebSocket) server that hosts
ephemeral, room-based collaboration sessions — cursors, comments, and shared
state for a group of clients editing the same thing at once. Rooms are not
persisted to disk; state lives in memory for the life of the process and is
capped in size (`MAX_ROOM_STATE_BYTES`, `MAX_COMMENTS_PER_ROOM`, etc.). There
is no database and no server-side notion of user identity beyond a
per-connection `userId` the client supplies.

## Trust model

Rooms are created **lazily**, and the trust model follows directly from that:

1. A client sends a `join` message with a `roomId` and a `token`.
2. If `roomId` does not exist yet, the server creates it on the spot and
   treats that joining client's `token` as the room's secret going forward
   (`collaboration-server.js:213-217`, "First joiner establishes the room's
   secret"). Whoever gets there first defines the room.
3. If `roomId` already exists, the presented `token` must match the room's
   stored secret. The comparison SHA-256-hashes both values first (so the
   buffers are always the same length) and compares them with
   `crypto.timingSafeEqual()` to avoid leaking match progress via timing
   (`collaboration-server.js:135-144`).
4. No token at all → `auth_required` error, connection closed with code
   `4001`.
5. Wrong token → `auth_failed` error, connection closed with code `4003`.
6. Rooms have a hard capacity (`MAX_USERS_PER_ROOM = 50`); once full, further
   joins get `room_full` and are closed with code `4004`.
7. When a room becomes empty, its secret is kept alive for
   `ROOM_EMPTY_TTL_MS` (10 minutes) so a legitimate participant can reconnect
   without the room being reclaimed by someone else in the meantime. Only
   after that grace period expires is the room deleted and its `roomId`
   available for a new secret to be established.

The empty-room TTL protects an **abandoned** room from being immediately
hijacked after everyone leaves. It does **not** protect a room at the moment
of its creation — see the known limitation below.

## Known limitation: room hijack via guessable room IDs

Because room creation is lazy and the first joiner's token becomes the
room's canonical secret, **the server has no way to verify who *should* be
first.** If a `roomId` is short, sequential, or otherwise guessable or
enumerable, an attacker can race the room's creation: connect with an
arbitrary token before the real participants join, and become the party the
token comparison trusts from then on. The intended users either get rejected
(`auth_failed`) when they try to join with their real token, or — if the
attacker also relays traffic — can be eavesdropped on.

This is **not** a flaw in the token-comparison logic (`timingSafeEqual`
correctly prevents an attacker from *guessing* a token that already exists).
It's a structural consequence of trusting whoever arrives first at a room ID
that hasn't been created yet. The comparison has nothing to protect once the
attacker *is* the first arrival.

**Mitigation is entirely on room-ID unguessability.** The server enforces no
minimum entropy — see below — so this is the client application's
responsibility, not something the server can fix by itself.

## Room ID requirements

The server validates `roomId` server-side only for shape:
`^[A-Za-z0-9_-]+$`, max 64 characters (`collaboration-server.js:198`). That
check exists to keep the ID safe to use as a map key and log line — it does
**not** enforce a minimum length or any entropy requirement. A room ID of
`"1"` or `"room-2"` passes this validation just as well as a long random one,
and the server has no way to distinguish a deliberately short ID from an
attacker-friendly one.

Given the known limitation above, room IDs **must**:

- Be generated client-side by the app, not typed by a human.
- Carry enough entropy to be practically un-enumerable (the app currently
  generates 128 bits of `crypto.randomUUID()`-derived randomness — see
  `generateRoomId()` in `src/modules/collaboration/useCollaboration.js`).
- Never be short, human-typable codes.
- Never be sequential or incrementing.

The companion room *token* (separate from the room ID, checked in the trust
model above) is likewise generated client-side with
`crypto.randomUUID()` doubled (~72 hex characters of entropy,
`generateToken()` in the same file) and is carried in the URL **fragment**
(`#ctk=...`), never the query string, specifically so it never lands in an
HTTP `Referer` header or a server access log.

## TLS requirement

This server speaks **plain `ws://` only** — it has no native TLS support.
The process itself logs a reminder about this on startup:

```
For production, terminate TLS in front of this server and expose it as wss://.
```

Any production deployment **must** run a reverse proxy or load balancer in
front of it that terminates TLS and forwards plaintext WebSocket traffic to
the server, exposing only `wss://` to clients. For example, with nginx:

```nginx
location /collab/ {
    proxy_pass http://127.0.0.1:3001/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

Client-side, `resolveWsUrl()` in
`src/modules/collaboration/useCollaboration.js` auto-negotiates the scheme
from `window.location.protocol`: an `https:` page connects `wss://`, an
`http:` page connects `ws://`. If `VITE_COLLAB_WS_URL` is set explicitly
(see `.env.example`), make sure it's a `wss://` URL for any deployment
reachable outside localhost — the client will not upgrade the scheme for
you.
