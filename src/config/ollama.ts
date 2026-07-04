// Ollama local provider — zero-cost alternative to OpenRouter.
// Models are not hardcoded; we fetch them live from the running instance.

export const OLLAMA_HOST_STORAGE = 'enginguity_ollama_host'
export const OLLAMA_MODEL_STORAGE = 'enginguity_ollama_model'
export const OLLAMA_PROVIDER_STORAGE = 'enginguity_active_provider'
export const OLLAMA_FALLBACK_STORAGE = 'enginguity_ollama_fallback_timeout'

export const DEFAULT_OLLAMA_HOST = 'http://localhost:11434'

export function getOllamaHost(): string {
  return localStorage.getItem(OLLAMA_HOST_STORAGE) || DEFAULT_OLLAMA_HOST
}

export const OLLAMA_PROVIDER = {
  id: 'ollama',
  name: 'Ollama',
  label: 'Local',
  type: 'local' as const,
  baseURL: DEFAULT_OLLAMA_HOST,
  requiresKey: false,
  requiresInternet: false,
  description: 'Run models locally. Free, private, offline.',
  docsUrl: 'https://ollama.com',
  providerColor: '#6366f1',
}

export interface OllamaTagModel {
  name: string
  size: number
  modified_at?: string
  details?: {
    family?: string
    parameter_size?: string
  }
}

export interface OllamaModel {
  id: string
  name: string
  provider: 'Ollama'
  providerColor: string
  tier: 'reasoning' | 'code' | 'flagship' | 'balanced' | 'fast'
  contextK: number
  sizeGB: string
  family: string
  parameterSize: string | null
  inputPricePer1M: 0
  outputPricePer1M: 0
  free: true
  local: true
  modified_at?: string
}

export interface OllamaFetchResult {
  available: boolean
  models: OllamaModel[]
  error?: string
}

const CONTEXT_MAP: Record<string, number> = {
  'qwen2.5': 128,
  qwen2: 32,
  'llama3.2': 128,
  'llama3.1': 128,
  llama3: 8,
  mistral: 32,
  'deepseek-r1': 64,
  'deepseek-v3': 64,
  gemma2: 8,
  gemma: 8,
  phi3: 128,
  phi4: 16,
  codellama: 16,
  wizard: 32,
  'neural-chat': 8,
  starling: 8,
  orca: 8,
}

export function getOllamaContextWindow(modelName: string): number {
  const lower = modelName.toLowerCase()
  const family = Object.keys(CONTEXT_MAP).find((k) => lower.includes(k))
  return family ? CONTEXT_MAP[family] : 8
}

export function getOllamaModelTier(model: OllamaTagModel): OllamaModel['tier'] {
  const name = model.name.toLowerCase()
  const sizeStr = model.details?.parameter_size || ''
  const sizeNum = parseFloat(sizeStr)

  if (name.includes('r1') || name.includes('think') || name.includes('qwq')) return 'reasoning'
  if (name.includes('code') || name.includes('coder')) return 'code'
  if (sizeNum >= 30) return 'flagship'
  if (sizeNum >= 10) return 'balanced'
  return 'fast'
}

export function formatOllamaModelName(rawName: string): string {
  const [model, tag] = rawName.split(':')
  const displayName = model
    .replace('qwen2.5-coder', 'Qwen 2.5 Coder')
    .replace('qwen2.5', 'Qwen 2.5')
    .replace('qwen2', 'Qwen 2')
    .replace('qwen', 'Qwen ')
    .replace('llama3.2', 'Llama 3.2')
    .replace('llama3.1', 'Llama 3.1')
    .replace('llama3', 'Llama 3')
    .replace('llama', 'Llama ')
    .replace('mistral', 'Mistral')
    .replace('deepseek-r1', 'DeepSeek R1')
    .replace('deepseek-v3', 'DeepSeek V3')
    .replace('deepseek-coder', 'DeepSeek Coder')
    .replace('gemma2', 'Gemma 2')
    .replace('gemma', 'Gemma ')
    .replace('phi4', 'Phi 4')
    .replace('phi3.5', 'Phi 3.5')
    .replace('phi3', 'Phi 3')
    .replace('phi', 'Phi ')
    .replace('codellama', 'Code Llama')
    .replace('nomic-embed-text', 'Nomic Embed')
    .replace('mxbai-embed-large', 'MxBai Embed')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .trim()
  const tagDisplay = tag && tag !== 'latest' ? ` ${tag.toUpperCase()}` : ''
  return displayName + tagDisplay
}

export async function fetchOllamaModels(host: string = getOllamaHost()): Promise<OllamaFetchResult> {
  try {
    const response = await fetch(`${host}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) return { available: false, models: [] }
    const data = (await response.json()) as { models?: OllamaTagModel[] }
    const raw = data.models || []
    const models: OllamaModel[] = raw.map((m) => ({
      id: m.name,
      name: formatOllamaModelName(m.name),
      provider: 'Ollama',
      providerColor: OLLAMA_PROVIDER.providerColor,
      tier: getOllamaModelTier(m),
      contextK: getOllamaContextWindow(m.name),
      sizeGB: (m.size / 1e9).toFixed(1),
      family: m.details?.family || 'unknown',
      parameterSize: m.details?.parameter_size || null,
      inputPricePer1M: 0,
      outputPricePer1M: 0,
      free: true,
      local: true,
      modified_at: m.modified_at,
    }))
    return { available: true, models }
  } catch (err) {
    return {
      available: false,
      models: [],
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function fetchOllamaVersion(host: string = getOllamaHost()): Promise<string | null> {
  try {
    const res = await fetch(`${host}/api/version`, { signal: AbortSignal.timeout(2000) })
    if (!res.ok) return null
    const data = (await res.json()) as { version?: string }
    return data.version || null
  } catch {
    return null
  }
}

// Ollama native /api/chat endpoint.
// We use the native API (not the OpenAI-compat /v1 endpoint) so we can pass
// `think: false`. Without that, reasoning models like Qwen 3.5 burn the entire
// token budget on chain-of-thought and emit no `content` — the chatbot shows
// nothing. Native streaming is newline-delimited JSON, not SSE.

export interface OllamaCallOptions {
  stream?: boolean
  temperature?: number
  maxTokens?: number
  onToken?: (token: string, full: string) => void
  /** Fires once, from the final chunk's native timing counters. */
  onMetrics?: (metrics: OllamaMetrics) => void
  signal?: AbortSignal
  // Let reasoning models think before answering. Default false because most
  // users want a direct reply, not a planning trace.
  think?: boolean
}

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OllamaChatChunk {
  message?: { role?: string; content?: string }
  done?: boolean
  eval_count?: number
  eval_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
}

// ── Token-rate metering ──────────────────────────────────────────────────
// The native /api/chat endpoint reports actual token counts and generation
// time in its final chunk (the OpenAI-compat endpoint hides these — the
// whole reason tok/s used to be blocked). callOllama records the rate per
// model and broadcasts it so any mounted surface can show live speed.

export const OLLAMA_TOKRATE_STORAGE = 'enginguity_ollama_tokrate'
export const OLLAMA_METRICS_EVENT = 'enginguity:ollama-metrics'

export interface OllamaMetrics {
  model: string
  /** Generated (completion) tokens — actual count, not a chars/4 estimate. */
  evalCount: number
  /** Prompt tokens actually processed (absent on some cache hits). */
  promptEvalCount: number | null
  /** Generation speed in tokens/second. */
  tokensPerSecond: number
  at: number
}

function extractMetrics(model: string, chunk: OllamaChatChunk): OllamaMetrics | null {
  if (!chunk.done || !chunk.eval_count || !chunk.eval_duration) return null
  return {
    model,
    evalCount: chunk.eval_count,
    promptEvalCount: chunk.prompt_eval_count ?? null,
    // eval_duration is nanoseconds.
    tokensPerSecond: chunk.eval_count / (chunk.eval_duration / 1e9),
    at: Date.now(),
  }
}

function recordMetrics(metrics: OllamaMetrics): void {
  if (typeof window === 'undefined') return
  try {
    const map = JSON.parse(localStorage.getItem(OLLAMA_TOKRATE_STORAGE) || '{}') as Record<string, OllamaMetrics>
    map[metrics.model] = metrics
    localStorage.setItem(OLLAMA_TOKRATE_STORAGE, JSON.stringify(map))
  } catch {
    // metering is best-effort; never let it break a chat response
  }
  window.dispatchEvent(new CustomEvent(OLLAMA_METRICS_EVENT, { detail: metrics }))
}

/** Last recorded generation rate for a model, or null before its first run. */
export function getOllamaTokenRate(model: string): OllamaMetrics | null {
  if (typeof window === 'undefined') return null
  try {
    const map = JSON.parse(localStorage.getItem(OLLAMA_TOKRATE_STORAGE) || '{}') as Record<string, OllamaMetrics>
    return map[model] ?? null
  } catch {
    return null
  }
}

export async function callOllama(
  model: string,
  messages: OllamaMessage[],
  systemPrompt: string | undefined,
  options: OllamaCallOptions = {},
  host: string = getOllamaHost(),
): Promise<string> {
  const allMessages: OllamaMessage[] = [
    ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
    ...messages,
  ]

  const stream = options.stream !== false

  const response = await fetch(`${host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: allMessages,
      stream,
      think: options.think ?? false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 2048,
      },
    }),
    signal: options.signal ?? AbortSignal.timeout(120000),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error || `Ollama error: ${response.status}`)
  }

  if (stream) {
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) continue
        try {
          const parsed = JSON.parse(line) as OllamaChatChunk
          const token = parsed.message?.content ?? ''
          if (token) {
            fullText += token
            options.onToken?.(token, fullText)
          }
          const metrics = extractMetrics(model, parsed)
          if (metrics) {
            recordMetrics(metrics)
            options.onMetrics?.(metrics)
          }
        } catch {
          // ignore partial json
        }
      }
    }
    return fullText
  }

  const data = (await response.json()) as OllamaChatChunk
  const metrics = extractMetrics(model, data)
  if (metrics) {
    recordMetrics(metrics)
    options.onMetrics?.(metrics)
  }
  return data.message?.content ?? ''
}

// Pull a model with progress streaming.
export interface PullProgress {
  status: string
  completed?: number
  total?: number
  digest?: string
}

export async function pullOllamaModel(
  name: string,
  onProgress: (p: PullProgress) => void,
  host: string = getOllamaHost(),
): Promise<void> {
  const response = await fetch(`${host}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, stream: true }),
  })
  if (!response.ok) {
    throw new Error(`Pull failed: ${response.status}`)
  }
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        onProgress(JSON.parse(line) as PullProgress)
      } catch {
        // ignore
      }
    }
  }
}

export async function deleteOllamaModel(name: string, host: string = getOllamaHost()): Promise<void> {
  const res = await fetch(`${host}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
}

// Recommendation guide shown in setup + model manager.
export const OLLAMA_RECOMMENDATIONS = {
  general_engineering: {
    model: 'qwen2.5:7b',
    reason:
      'Best balance of speed and quality for most tasks. Strong at math, code, and technical analysis.',
    minRAM: '8GB',
    pullCommand: 'ollama pull qwen2.5:7b',
  },
  coding_firmware: {
    model: 'qwen2.5-coder:7b',
    reason:
      'Specifically trained on code. Best for firmware review, debug console, and code generation.',
    minRAM: '8GB',
    pullCommand: 'ollama pull qwen2.5-coder:7b',
  },
  reasoning_analysis: {
    model: 'deepseek-r1:7b',
    reason:
      'Chain-of-thought reasoning. Best for complex circuit analysis, formula derivation, and BOM review.',
    minRAM: '8GB',
    pullCommand: 'ollama pull deepseek-r1:7b',
  },
  low_ram: {
    model: 'llama3.2:3b',
    reason:
      'Runs on 4GB RAM. Fast responses. Good for quick questions and basic analysis.',
    minRAM: '4GB',
    pullCommand: 'ollama pull llama3.2:3b',
  },
  high_end: {
    model: 'qwen2.5:32b',
    reason:
      'Near-cloud quality locally. Needs a good GPU. Best overall local model for serious engineering work.',
    minRAM: '24GB',
    pullCommand: 'ollama pull qwen2.5:32b',
  },
} as const

// Curated catalog of popular pullable models, grouped by use case.
export const OLLAMA_CATALOG = {
  engineering: [
    { name: 'qwen2.5:7b', size: '4.7GB' },
    { name: 'qwen2.5:14b', size: '9.0GB' },
    { name: 'deepseek-r1:7b', size: '4.7GB' },
  ],
  coding: [
    { name: 'qwen2.5-coder:7b', size: '4.7GB' },
    { name: 'codellama:7b', size: '3.8GB' },
    { name: 'deepseek-coder:6.7b', size: '3.8GB' },
  ],
  fast: [
    { name: 'llama3.2:3b', size: '2.0GB' },
    { name: 'qwen2.5:3b', size: '2.0GB' },
    { name: 'phi3.5:3.8b', size: '2.2GB' },
  ],
  powerful: [
    { name: 'qwen2.5:32b', size: '19GB' },
    { name: 'deepseek-r1:32b', size: '19GB' },
    { name: 'llama3.1:70b', size: '40GB' },
  ],
} as const

export function detectCorsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /cors|cross.origin|failed to fetch|networkerror/i.test(msg)
}
