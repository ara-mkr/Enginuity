import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  type CustomProviderConfig,
  CUSTOM_PROVIDERS_STORAGE,
  callCustomProvider,
  customChatUrl,
  loadCustomProviders,
  persistCustomProviders,
  redactCustomProvider,
  testCustomProviderConnection,
} from '../customProviders'

const config: CustomProviderConfig = {
  id: 'p1',
  label: 'NVIDIA — DeepSeek R1',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  apiKey: 'nvapi-secret-test-key',
  model: 'deepseek-ai/deepseek-r1',
  createdAt: 1,
}

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

beforeEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('customChatUrl', () => {
  it('appends /chat/completions and strips trailing slashes', () => {
    expect(customChatUrl('https://api.example.com/v1')).toBe('https://api.example.com/v1/chat/completions')
    expect(customChatUrl('https://api.example.com/v1//')).toBe('https://api.example.com/v1/chat/completions')
  })
})

describe('callCustomProvider', () => {
  it('sends the OpenAI-shaped body with auth and extra headers, returns the content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'OK' } }] }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const text = await callCustomProvider(
      { ...config, extraHeaders: { 'X-Extra': 'yes' } },
      [{ role: 'user', content: 'hi' }],
      'be brief',
      { stream: false },
    )

    expect(text).toBe('OK')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer nvapi-secret-test-key')
    expect(init.headers['X-Extra']).toBe('yes')
    const body = JSON.parse(init.body)
    expect(body.model).toBe('deepseek-ai/deepseek-r1')
    expect(body.messages[0]).toEqual({ role: 'system', content: 'be brief' })
    expect(body.stream).toBe(false)
  })

  it('maps 401 to an authentication message naming the provider', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 401 })))
    await expect(
      callCustomProvider(config, [{ role: 'user', content: 'hi' }], undefined, { stream: false }),
    ).rejects.toThrow(/Authentication failed.*API key/)
  })

  it('maps 404 to a base-URL/model-ID message that names the model', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 404 })))
    await expect(
      callCustomProvider(config, [{ role: 'user', content: 'hi' }], undefined, { stream: false }),
    ).rejects.toThrow(/base URL.*deepseek-ai\/deepseek-r1/)
  })

  it('maps 429 to a retry-shortly message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 429 })))
    await expect(
      callCustomProvider(config, [{ role: 'user', content: 'hi' }], undefined, { stream: false }),
    ).rejects.toThrow(/Rate limited/)
  })

  it('maps a fetch TypeError (network drop or CORS block) to the explicit CORS message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(
      callCustomProvider(config, [{ role: 'user', content: 'hi' }], undefined, { stream: false }),
    ).rejects.toThrow(/CORS/)
  })

  it('rejects a 200 with a non-OpenAI shape as not fully compatible', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ unexpected: true })))
    await expect(
      callCustomProvider(config, [{ role: 'user', content: 'hi' }], undefined, { stream: false }),
    ).rejects.toThrow(/not be fully OpenAI-compatible/)
  })

  it('parses an SSE stream and fires onToken per delta', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n',
      'data: [DONE]\n',
    ].join('')
    const encoder = new TextEncoder()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/event-stream' }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sse))
          controller.close()
        },
      }),
    }))

    const tokens: string[] = []
    const text = await callCustomProvider(
      config,
      [{ role: 'user', content: 'hi' }],
      undefined,
      { onToken: (t) => tokens.push(t) },
    )

    expect(text).toBe('Hello')
    expect(tokens).toEqual(['Hel', 'lo'])
  })

  it('falls back to JSON parsing when the provider ignores stream:true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'single-shot' } }] }),
    ))
    const text = await callCustomProvider(config, [{ role: 'user', content: 'hi' }], undefined, {})
    expect(text).toBe('single-shot')
  })
})

describe('testCustomProviderConnection', () => {
  it('reports success with a latency on a working endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'OK' } }] }),
    ))
    const result = await testCustomProviderConnection(config)
    expect(result.success).toBe(true)
    expect(result.latencyMs).toBeTypeOf('number')
  })

  it('reports the real 401 error instead of a generic failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 401 })))
    const result = await testCustomProviderConnection(config)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Authentication failed/)
  })
})

describe('persistence', () => {
  it('round-trips configs, keeping the key out of localStorage', () => {
    persistCustomProviders([config])

    expect(localStorage.getItem(CUSTOM_PROVIDERS_STORAGE)).not.toContain('nvapi-secret-test-key')

    const loaded = loadCustomProviders()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].label).toBe(config.label)
    expect(loaded[0].apiKey).toBe('nvapi-secret-test-key')
  })

  it('loads a provider with an empty key after the session key is gone', () => {
    persistCustomProviders([config])
    sessionStorage.clear()
    const loaded = loadCustomProviders()
    expect(loaded[0].apiKey).toBe('')
  })
})

describe('redactCustomProvider', () => {
  it('masks the key and preserves the rest', () => {
    const redacted = redactCustomProvider(config)
    expect(JSON.stringify(redacted)).not.toContain('nvapi-secret-test-key')
    expect(redacted.baseUrl).toBe(config.baseUrl)
  })
})
