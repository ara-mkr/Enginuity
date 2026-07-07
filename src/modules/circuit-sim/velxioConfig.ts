export type VelxioMode = 'self-hosted' | 'hosted-fallback'

export interface VelxioSource {
  mode: VelxioMode
  label: string
  url: string
  healthcheckUrl: string
  configured: boolean
}

export interface VelxioConfig {
  sources: VelxioSource[]
  iframeSandbox: string
  iframeAllow: string
  healthcheckPath: string
  newTabFallbackEnabled: boolean
  hostedFallbackAllowed: boolean
  embedMode: 'iframe'
  disabledReason: string | null
  warnings: string[]
}

export interface VelxioReachability {
  ok: boolean
  message: string
}

type EnvLike = Record<string, string | boolean | undefined>

export const DEFAULT_VELXIO_DEV_URL = 'http://localhost:3080'
export const DEFAULT_VELXIO_HOSTED_URL = 'https://velxio.dev'
export const DEFAULT_VELXIO_HEALTHCHECK_PATH = '/'
export const DEFAULT_VELXIO_IFRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-modals allow-pointer-lock'
export const DEFAULT_VELXIO_IFRAME_ALLOW = 'clipboard-read; clipboard-write; fullscreen'

function asString(value: string | boolean | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function parseBooleanFlag(value: string | boolean | undefined, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return fallback

  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

export function normalizeVelxioUrl(rawUrl: string): { ok: true; url: string } | { ok: false; message: string } {
  const trimmed = rawUrl.trim()
  if (!trimmed) return { ok: false, message: 'No Velxio URL was configured.' }

  try {
    const url = new URL(trimmed)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { ok: false, message: 'Velxio URL must use http:// or https://.' }
    }
    if (url.username || url.password) {
      return { ok: false, message: 'Velxio URL must not include embedded credentials.' }
    }
    return { ok: true, url: url.toString() }
  } catch {
    return { ok: false, message: 'Velxio URL is not a valid absolute URL.' }
  }
}

export function buildVelxioHealthcheckUrl(url: string, healthcheckPath = DEFAULT_VELXIO_HEALTHCHECK_PATH): string {
  const path = healthcheckPath.trim() || DEFAULT_VELXIO_HEALTHCHECK_PATH
  const base = new URL(url)

  if (path === '/') return base.toString()
  if (!base.pathname.endsWith('/')) base.pathname = `${base.pathname}/`
  base.search = ''
  base.hash = ''
  return new URL(path, base.toString()).toString()
}

export function isLoopbackVelxioUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return false
  }
}

function createSource(
  rawUrl: string,
  mode: VelxioMode,
  label: string,
  healthcheckPath: string,
  configured: boolean,
  warnings: string[],
): VelxioSource | null {
  const normalized = normalizeVelxioUrl(rawUrl)
  if ('message' in normalized) {
    warnings.push(`${label}: ${normalized.message}`)
    return null
  }

  return {
    mode,
    label,
    url: normalized.url,
    healthcheckUrl: buildVelxioHealthcheckUrl(normalized.url, healthcheckPath),
    configured,
  }
}

export function resolveVelxioConfig(env: EnvLike, options: { isDev?: boolean } = {}): VelxioConfig {
  const isDev = options.isDev ?? false
  const warnings: string[] = []
  const sources: VelxioSource[] = []
  const explicitUrl = asString(env.VITE_VELXIO_URL)
  const hostedFallbackAllowed = parseBooleanFlag(env.VITE_VELXIO_ALLOW_HOSTED_FALLBACK, false)
  const hostedUrl = asString(env.VITE_VELXIO_HOSTED_URL) || DEFAULT_VELXIO_HOSTED_URL
  const rawEmbedMode = asString(env.VITE_VELXIO_EMBED_MODE) || 'iframe'
  const healthcheckPath = asString(env.VITE_VELXIO_HEALTHCHECK_PATH) || DEFAULT_VELXIO_HEALTHCHECK_PATH
  const iframeSandbox = asString(env.VITE_VELXIO_IFRAME_SANDBOX) || DEFAULT_VELXIO_IFRAME_SANDBOX
  const iframeAllow = asString(env.VITE_VELXIO_IFRAME_ALLOW) || DEFAULT_VELXIO_IFRAME_ALLOW
  const newTabFallbackEnabled = parseBooleanFlag(env.VITE_VELXIO_ENABLE_NEW_TAB_FALLBACK, true)

  if (rawEmbedMode !== 'iframe') {
    warnings.push(`Unsupported VITE_VELXIO_EMBED_MODE "${rawEmbedMode}"; using iframe.`)
  }

  if (/^https?:\/\//i.test(healthcheckPath)) {
    warnings.push('VITE_VELXIO_HEALTHCHECK_PATH must be a path, not a full URL; using /.')
  }
  const safeHealthcheckPath = /^https?:\/\//i.test(healthcheckPath)
    ? DEFAULT_VELXIO_HEALTHCHECK_PATH
    : healthcheckPath

  const primaryUrl = explicitUrl || (isDev ? DEFAULT_VELXIO_DEV_URL : '')
  if (primaryUrl) {
    const source = createSource(
      primaryUrl,
      'self-hosted',
      explicitUrl ? 'Self-hosted Velxio' : 'Local Velxio dev service',
      safeHealthcheckPath,
      !!explicitUrl,
      warnings,
    )
    if (source) sources.push(source)
  }

  if (hostedFallbackAllowed) {
    const hostedSource = createSource(
      hostedUrl,
      'hosted-fallback',
      'Velxio hosted fallback',
      safeHealthcheckPath,
      true,
      warnings,
    )
    if (hostedSource && !sources.some((source) => source.url === hostedSource.url)) {
      sources.push(hostedSource)
    }
  }

  const disabledReason = sources.length > 0
    ? null
    : explicitUrl
      ? 'Configured Velxio URL could not be used.'
      : 'Set VITE_VELXIO_URL to a self-hosted Velxio service, or enable VITE_VELXIO_ALLOW_HOSTED_FALLBACK.'

  return {
    sources,
    iframeSandbox,
    iframeAllow,
    healthcheckPath: safeHealthcheckPath,
    newTabFallbackEnabled,
    hostedFallbackAllowed,
    embedMode: 'iframe',
    disabledReason,
    warnings,
  }
}

export function getVelxioConfig(): VelxioConfig {
  return resolveVelxioConfig(import.meta.env, { isDev: import.meta.env.DEV })
}

export async function checkVelxioReachability(
  source: VelxioSource,
  options: {
    fetchImpl?: typeof fetch
    timeoutMs?: number
  } = {},
): Promise<VelxioReachability> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  if (!fetchImpl) {
    return { ok: false, message: 'This browser cannot perform a Velxio reachability check.' }
  }

  const timeoutMs = options.timeoutMs ?? 3500
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs)

  try {
    await fetchImpl(source.healthcheckUrl, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    })
    return { ok: true, message: `${source.label} is reachable.` }
  } catch (error) {
    const message = error instanceof DOMException && error.name === 'AbortError'
      ? `Timed out after ${Math.round(timeoutMs / 1000)}s while checking ${source.url}.`
      : `Could not reach ${source.url}.`
    return { ok: false, message }
  } finally {
    globalThis.clearTimeout(timeout)
  }
}
