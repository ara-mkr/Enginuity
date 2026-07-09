// Dev-only reverse proxy that makes the hosted Velxio simulator embeddable.
//
// The Circuit Simulator route embeds Velxio from http://localhost:3080 — the
// self-hosted Docker container. On machines without Docker that port is dead,
// and the hosted https://velxio.dev cannot be framed directly because it sends
// X-Frame-Options: SAMEORIGIN. This plugin starts a loopback-only HTTP server
// (default http://127.0.0.1:3081) that forwards requests to the hosted Velxio
// and strips only the frame-blocking response headers, so the dev embed works
// with zero local setup. The client still prefers the Docker service — the
// proxy is the next source in line (see velxioConfig.resolveVelxioConfig) and
// only exists in dev; production builds never list a dev-proxy source.
//
// The proxy binds 127.0.0.1 (never the LAN), streams bodies untouched in both
// directions (compression included), and does not carry Enginguity state:
// the iframe origin is the proxy itself, so only Velxio's own cookies and
// requests ever pass through here.

import type { Plugin } from 'vite'
import { createServer, request as httpRequest } from 'node:http'
import type { IncomingHttpHeaders, OutgoingHttpHeaders, Server } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { pipeline } from 'node:stream'

export const DEFAULT_VELXIO_PROXY_PORT = 3081
export const DEFAULT_VELXIO_PROXY_TARGET = 'https://velxio.dev'

// Hop-by-hop headers per RFC 9110 §7.6.1; they describe one connection and
// must not be replayed on the next one.
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

export function buildUpstreamRequestHeaders(
  headers: IncomingHttpHeaders,
  target: URL,
  localOrigin: string,
): OutgoingHttpHeaders {
  const out: OutgoingHttpHeaders = {}
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue
    const key = name.toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(key) || key === 'host') continue
    if (key === 'origin') {
      out[name] = target.origin
      continue
    }
    if (key === 'referer' && typeof value === 'string' && value.startsWith(localOrigin)) {
      out[name] = target.origin + value.slice(localOrigin.length)
      continue
    }
    out[name] = value
  }
  out.host = target.host
  return out
}

export function sanitizeUpstreamResponseHeaders(
  headers: IncomingHttpHeaders,
  target: URL,
  localOrigin: string,
): OutgoingHttpHeaders {
  const out: OutgoingHttpHeaders = {}
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue
    const key = name.toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(key)) continue
    // The whole point of the proxy: allow the app to frame Velxio.
    if (key === 'x-frame-options') continue
    // HSTS from the upstream host must not be re-announced for 127.0.0.1.
    if (key === 'strict-transport-security') continue
    if (key === 'content-security-policy' || key === 'content-security-policy-report-only') {
      const scrubbed = (Array.isArray(value) ? value : [value])
        .map((policy) => policy
          .split(';')
          .map((directive) => directive.trim())
          .filter((directive) => directive && !/^frame-ancestors\b/i.test(directive))
          .join('; '))
        .filter(Boolean)
      if (scrubbed.length > 0) out[name] = scrubbed.length === 1 ? scrubbed[0] : scrubbed
      continue
    }
    if (key === 'location' && typeof value === 'string' && value.startsWith(target.origin)) {
      out[name] = localOrigin + value.slice(target.origin.length)
      continue
    }
    if (key === 'set-cookie') {
      // Re-scope cookies to the proxy origin: Domain=velxio.dev would be
      // rejected, and Secure would be dropped on plain-http loopback.
      out[name] = (Array.isArray(value) ? value : [value]).map((cookie) => cookie
        .split(';')
        .map((part) => part.trim())
        .filter((part) => part && !/^domain=/i.test(part) && !/^secure$/i.test(part))
        .join('; '))
      continue
    }
    out[name] = value
  }
  out['x-velxio-dev-proxy'] = '1'
  return out
}

export function createVelxioProxyServer(target: URL, localOrigin: string): Server {
  const requestUpstream = target.protocol === 'https:' ? httpsRequest : httpRequest

  const server = createServer((req, res) => {
    const upstreamUrl = new URL(req.url ?? '/', target)
    const upstreamReq = requestUpstream(upstreamUrl, {
      method: req.method,
      headers: buildUpstreamRequestHeaders(req.headers, target, localOrigin),
    }, (upstreamRes) => {
      res.writeHead(
        upstreamRes.statusCode ?? 502,
        sanitizeUpstreamResponseHeaders(upstreamRes.headers, target, localOrigin),
      )
      // pipeline (not .pipe) so a mid-stream disconnect on either side is
      // swallowed instead of surfacing as an 'error' that kills the dev server.
      pipeline(upstreamRes, res, () => {})
    })

    upstreamReq.on('error', (error) => {
      if (res.headersSent) {
        res.destroy()
        return
      }
      res.writeHead(502, { 'content-type': 'text/plain', 'x-velxio-dev-proxy': '1' })
      res.end(`Velxio dev proxy could not reach ${target.origin}: ${error.message}`)
    })
    res.on('close', () => upstreamReq.destroy())
    pipeline(req, upstreamReq, () => {})
  })

  // Velxio runs fully in-browser; no WebSocket passthrough is implemented.
  server.on('upgrade', (_req, socket) => socket.destroy())
  return server
}

function parsePort(raw: string | undefined): number {
  if (!raw) return DEFAULT_VELXIO_PROXY_PORT
  const port = Number.parseInt(raw, 10)
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : DEFAULT_VELXIO_PROXY_PORT
}

function parseBooleanFlag(raw: string | undefined, fallback: boolean): boolean {
  if (typeof raw !== 'string') return fallback
  const normalized = raw.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

export function velxioProxyPlugin(): Plugin {
  return {
    name: 'enginguity-velxio-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      const env = server.config.env
      const logger = server.config.logger
      if (!parseBooleanFlag(env.VITE_VELXIO_DEV_PROXY, true)) return

      const rawTarget = (env.VITE_VELXIO_HOSTED_URL ?? '').trim() || DEFAULT_VELXIO_PROXY_TARGET
      let target: URL
      try {
        target = new URL(rawTarget)
      } catch {
        logger.warn(`[velxio-proxy] VITE_VELXIO_HOSTED_URL is not a valid URL (${rawTarget}); proxy disabled.`)
        return
      }
      if (!['http:', 'https:'].includes(target.protocol)) {
        logger.warn(`[velxio-proxy] VITE_VELXIO_HOSTED_URL must be http(s) (${rawTarget}); proxy disabled.`)
        return
      }

      const port = parsePort(env.VITE_VELXIO_DEV_PROXY_PORT)
      const localOrigin = `http://127.0.0.1:${port}`
      const proxy = createVelxioProxyServer(target, localOrigin)

      // A dev-server restart closes the old proxy asynchronously, so the new
      // one may briefly lose the bind race; retry before assuming the port is
      // genuinely taken (e.g. by a real Velxio container).
      let attempts = 0
      const listen = () => proxy.listen(port, '127.0.0.1')
      proxy.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE' && attempts < 3) {
          attempts += 1
          setTimeout(listen, 250)
          return
        }
        if (error.code === 'EADDRINUSE') {
          logger.info(`[velxio-proxy] port ${port} is already in use — leaving it to the service running there.`)
          return
        }
        logger.warn(`[velxio-proxy] failed to start: ${error.message}`)
      })
      proxy.on('listening', () => {
        logger.info(`[velxio-proxy] embeddable Velxio at ${localOrigin} → ${target.origin}`)
      })
      listen()

      server.httpServer?.once('close', () => {
        proxy.closeAllConnections()
        proxy.close()
      })
    },
  }
}
