import { describe, expect, it, vi } from 'vitest'
import {
  buildVelxioHealthcheckUrl,
  checkVelxioReachability,
  DEFAULT_VELXIO_DEV_URL,
  normalizeVelxioUrl,
  parseBooleanFlag,
  resolveVelxioConfig,
} from '../velxioConfig'

describe('Velxio config', () => {
  it('defaults to local Velxio in dev without enabling hosted fallback', () => {
    const config = resolveVelxioConfig({}, { isDev: true })

    expect(config.sources).toHaveLength(1)
    expect(config.sources[0]).toMatchObject({
      mode: 'self-hosted',
      url: `${DEFAULT_VELXIO_DEV_URL}/`,
      configured: false,
    })
    expect(config.hostedFallbackAllowed).toBe(false)
    expect(config.disabledReason).toBeNull()
  })

  it('requires an explicit URL or hosted fallback in production', () => {
    const config = resolveVelxioConfig({}, { isDev: false })

    expect(config.sources).toEqual([])
    expect(config.disabledReason).toContain('VITE_VELXIO_URL')
  })

  it('adds hosted fallback only when explicitly enabled', () => {
    const config = resolveVelxioConfig({
      VITE_VELXIO_URL: 'http://localhost:3080',
      VITE_VELXIO_ALLOW_HOSTED_FALLBACK: 'true',
    }, { isDev: false })

    expect(config.sources.map((source) => source.mode)).toEqual(['self-hosted', 'hosted-fallback'])
    expect(config.sources[1].url).toBe('https://velxio.dev/')
  })

  it('rejects unsafe or non-http URLs', () => {
    expect(normalizeVelxioUrl('javascript:alert(1)').ok).toBe(false)
    expect(normalizeVelxioUrl('data:text/html,hello').ok).toBe(false)
    expect(normalizeVelxioUrl('http://user:pass@localhost:3080').ok).toBe(false)
    expect(normalizeVelxioUrl('http://localhost:3080').ok).toBe(true)
  })

  it('builds healthcheck URLs relative to the configured Velxio path', () => {
    expect(buildVelxioHealthcheckUrl('https://example.com/velxio', 'health')).toBe('https://example.com/velxio/health')
    expect(buildVelxioHealthcheckUrl('https://example.com/velxio/', '/status')).toBe('https://example.com/status')
  })

  it('parses boolean flags conservatively', () => {
    expect(parseBooleanFlag('true')).toBe(true)
    expect(parseBooleanFlag('1')).toBe(true)
    expect(parseBooleanFlag('false', true)).toBe(false)
    expect(parseBooleanFlag('surprise', true)).toBe(true)
  })
})

describe('Velxio reachability', () => {
  it('uses no-cors fetch against the healthcheck URL', async () => {
    const config = resolveVelxioConfig({ VITE_VELXIO_URL: 'http://localhost:3080' })
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch

    const result = await checkVelxioReachability(config.sources[0], { fetchImpl, timeoutMs: 50 })

    expect(result.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:3080/', expect.objectContaining({
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
    }))
  })

  it('returns a clean failure when fetch rejects', async () => {
    const config = resolveVelxioConfig({ VITE_VELXIO_URL: 'http://localhost:3080' })
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('network failed')
    }) as unknown as typeof fetch

    const result = await checkVelxioReachability(config.sources[0], { fetchImpl, timeoutMs: 50 })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('Could not reach')
  })
})
