// Custom "bring your own endpoint" provider — any OpenAI-compatible
// chat-completions API (NVIDIA NIM, Groq, Together, Fireworks, self-hosted
// vLLM…). The user supplies a base URL, an API key, and an exact model ID.
//
// Config (minus the key) persists in localStorage; keys go through
// utils/keyStorage — sessionStorage only, same as the OpenRouter key.
// Requests run from the renderer like every other provider, so a provider
// that doesn't send CORS headers fails here even though curl works — the
// error text has to say that, because fetch() can't tell CORS from a
// network drop.

import { readStoredKey, writeStoredKey, clearStoredKey } from '../utils/keyStorage'

export const CUSTOM_PROVIDERS_STORAGE = 'enginguity_custom_providers'
export const CUSTOM_ACTIVE_STORAGE = 'enginguity_custom_active_id'

export const CUSTOM_PROVIDER_COLOR = '#b09470'

export interface CustomProviderConfig {
  id: string
  /** User-facing display name, e.g. "NVIDIA — DeepSeek R1". */
  label: string
  /** Root of the API, e.g. "https://integrate.api.nvidia.com/v1" — the
   *  adapter appends /chat/completions itself. */
  baseUrl: string
  apiKey: string
  /** Exact model ID as the provider names it, e.g. "deepseek-ai/deepseek-r1". */
  model: string
  /** For providers needing more than the Authorization header. */
  extraHeaders?: Record<string, string>
  createdAt: number
  lastTestedAt?: number
  lastTestStatus?: 'success' | 'failure'
  lastTestError?: string
}

/** Everything except the key, which never touches localStorage. */
type StoredCustomProvider = Omit<CustomProviderConfig, 'apiKey'>

function keyStorageKeyFor(id: string): string {
  return `enginguity_custom_key_${id}`
}

export function loadCustomProviders(): CustomProviderConfig[] {
  try {
    const stored = JSON.parse(
      localStorage.getItem(CUSTOM_PROVIDERS_STORAGE) ?? '[]',
    ) as StoredCustomProvider[]
    if (!Array.isArray(stored)) return []
    return stored.map((p) => ({ ...p, apiKey: readStoredKey(keyStorageKeyFor(p.id)) ?? '' }))
  } catch {
    return []
  }
}

export function persistCustomProviders(providers: CustomProviderConfig[]): void {
  try {
    const stored: StoredCustomProvider[] = providers.map(({ apiKey: _apiKey, ...rest }) => rest)
    localStorage.setItem(CUSTOM_PROVIDERS_STORAGE, JSON.stringify(stored))
  } catch {
    // Storage unavailable — config stays in memory only.
  }
  for (const p of providers) {
    if (p.apiKey) writeStoredKey(keyStorageKeyFor(p.id), p.apiKey)
    else clearStoredKey(keyStorageKeyFor(p.id))
  }
}

export function clearCustomProviderKey(id: string): void {
  clearStoredKey(keyStorageKeyFor(id))
}

export function loadActiveCustomProviderId(): string | null {
  return localStorage.getItem(CUSTOM_ACTIVE_STORAGE)
}

export function persistActiveCustomProviderId(id: string | null): void {
  if (id) localStorage.setItem(CUSTOM_ACTIVE_STORAGE, id)
  else localStorage.removeItem(CUSTOM_ACTIVE_STORAGE)
}

/** Safe to log: the key is masked, everything else passes through. */
export function redactCustomProvider(config: CustomProviderConfig): Record<string, unknown> {
  return { ...config, apiKey: config.apiKey ? '•••redacted•••' : '' }
}

export class CustomProviderError extends Error {
  status: number
  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'CustomProviderError'
    this.status = status
  }
}

export function customChatUrl(baseUrl: string): string {
  return `${baseUrl.trim().replace(/\/+$/, '')}/chat/completions`
}

export interface CustomCallOptions {
  stream?: boolean
  temperature?: number
  maxTokens?: number
  onToken?: (token: string, full: string) => void
  signal?: AbortSignal
}

export interface CustomProviderMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string }
    delta?: { content?: string }
  }>
}

function statusError(status: number, bodyText: string, config: CustomProviderConfig): CustomProviderError {
  if (status === 401 || status === 403) {
    return new CustomProviderError(status, `Authentication failed (HTTP ${status}) — check the API key for "${config.label}".`)
  }
  if (status === 404) {
    return new CustomProviderError(
      status,
      `Not found (HTTP 404) — check the base URL and that the model ID "${config.model}" is correct.`,
    )
  }
  if (status === 429) {
    return new CustomProviderError(429, 'Rate limited by the provider — this is not a config problem, retry shortly.')
  }
  return new CustomProviderError(status, `Provider request failed (HTTP ${status}): ${bodyText.slice(0, 200)}`)
}

function networkError(config: CustomProviderConfig): Error {
  // fetch() throws the same TypeError for a dead network and a CORS block —
  // indistinguishable from JS, which is why the message spells both out.
  return new Error(
    `Could not reach ${config.baseUrl}. Either the base URL is wrong, the network is down, ` +
      `or this provider blocks direct browser requests (CORS) — some APIs only allow ` +
      `server-side calls. If the same request works via curl, it's CORS.`,
  )
}

/**
 * One chat-completions round trip against an OpenAI-compatible endpoint.
 * Streams SSE when the provider honours `stream: true`; some providers
 * ignore the flag and return plain JSON, so the response content-type
 * decides which parser runs — never a hang either way.
 */
export async function callCustomProvider(
  config: CustomProviderConfig,
  messages: CustomProviderMessage[],
  systemPrompt: string | undefined,
  options: CustomCallOptions = {},
): Promise<string> {
  const allMessages: CustomProviderMessage[] = [
    ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
    ...messages,
  ]
  const stream = options.stream !== false

  let response: Response
  try {
    response = await fetch(customChatUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        ...(config.extraHeaders ?? {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages: allMessages,
        max_tokens: options.maxTokens ?? 4000,
        temperature: options.temperature ?? 0.7,
        stream,
      }),
      signal: options.signal ?? AbortSignal.timeout(120000),
    })
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) throw err
    throw networkError(config)
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '')
    throw statusError(response.status, bodyText, config)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (stream && contentType.includes('text/event-stream')) {
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    let buffer = ''
    let streamDone = false

    while (!streamDone) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') { streamDone = true; break }
        try {
          const parsed = JSON.parse(data) as ChatCompletionResponse
          const token = parsed.choices?.[0]?.delta?.content ?? ''
          if (token) {
            fullText += token
            options.onToken?.(token, fullText)
          }
        } catch {
          // ignore partial JSON
        }
      }
    }
    return fullText
  }

  // Non-streaming (or the provider ignored `stream: true`).
  let data: ChatCompletionResponse
  try {
    data = (await response.json()) as ChatCompletionResponse
  } catch {
    throw new Error('Unexpected response — this provider may not be fully OpenAI-compatible.')
  }
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new Error('Unexpected response shape — this provider may not be fully OpenAI-compatible.')
  }
  options.onToken?.(content, content)
  return content
}

export interface CustomProviderTestResult {
  success: boolean
  error?: string
  latencyMs?: number
}

/** Minimal live probe used by the Test Connection button. */
export async function testCustomProviderConnection(
  config: CustomProviderConfig,
): Promise<CustomProviderTestResult> {
  const start = performance.now()
  try {
    await callCustomProvider(
      config,
      [{ role: 'user', content: 'Reply with OK.' }],
      undefined,
      // Reasoning models can burn a tiny budget on thinking and return an
      // empty string — an empty 200 is still a pass, so 64 tokens is plenty.
      { stream: false, maxTokens: 64, signal: AbortSignal.timeout(30000) },
    )
    return { success: true, latencyMs: Math.round(performance.now() - start) }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return { success: false, error: 'Timed out after 30s — the endpoint accepted the connection but never answered.' }
    }
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
