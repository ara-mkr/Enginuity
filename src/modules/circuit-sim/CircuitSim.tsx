import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { AlertTriangle, ExternalLink, GitFork, Info, RefreshCcw, RotateCcw, Zap } from 'lucide-react'
import { logEvent } from '../../engine/eventLog'
import { useProbeContext } from '../../hooks/useProbeContext'
import { VelxioEmbed, type VelxioEmbedStatus } from './VelxioEmbed'
import {
  checkVelxioReachability,
  getVelxioConfig,
  isLoopbackVelxioUrl,
  type VelxioSource,
} from './velxioConfig'

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

function urlOrigin(url: string) {
  try {
    return new URL(url).origin
  } catch {
    return 'invalid-url'
  }
}

function useSmallViewport(maxWidth = 760) {
  const [isSmall, setIsSmall] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth < maxWidth : false
  ))

  useEffect(() => {
    const onResize = () => setIsSmall(window.innerWidth < maxWidth)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [maxWidth])

  return isSmall
}

function statusCopy(status: VelxioEmbedStatus, source: VelxioSource | null) {
  if (status === 'ready') {
    if (source?.mode === 'hosted-fallback') return 'Hosted fallback'
    if (source?.mode === 'dev-proxy') return 'Hosted (dev proxy)'
    return 'Self-hosted'
  }
  if (status === 'checking') return 'Checking'
  if (status === 'disabled') return 'Not configured'
  return 'Unavailable'
}

function statusColor(status: VelxioEmbedStatus, source: VelxioSource | null) {
  if (status === 'ready' && source?.mode === 'hosted-fallback') return 'var(--warning-muted)'
  if (status === 'ready') return '#7aaa8a'
  if (status === 'checking') return 'var(--accent)'
  if (status === 'disabled') return 'var(--text-dim)'
  return 'var(--danger-muted)'
}

const iconButtonStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 6,
  border: '1px solid var(--border-bright)',
  background: 'var(--surface)',
  color: 'var(--text-muted)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
}

export default function CircuitSim() {
  const config = useMemo(() => getVelxioConfig(), [])
  const isSmallViewport = useSmallViewport()
  const [status, setStatus] = useState<VelxioEmbedStatus>('checking')
  const [selectedSource, setSelectedSource] = useState<VelxioSource | null>(null)
  const [message, setMessage] = useState('Checking Velxio availability.')
  const [healthCheckToken, setHealthCheckToken] = useState(0)
  const [iframeReloadToken, setIframeReloadToken] = useState(0)

  const fallbackSource = selectedSource ?? config.sources[0] ?? null

  useProbeContext('circuit-sim', {
    integration: 'velxio',
    status,
    selectedMode: selectedSource?.mode ?? null,
    configuredSources: config.sources.length,
    hostedFallbackAllowed: config.hostedFallbackAllowed,
  })

  useEffect(() => {
    let cancelled = false

    async function runCheck() {
      if (!config.sources.length) {
        setSelectedSource(null)
        setStatus('disabled')
        setMessage(config.disabledReason ?? 'Velxio simulator is not configured.')
        return
      }

      setStatus('checking')
      setSelectedSource(config.sources[0])
      setMessage('Checking Velxio availability.')

      const failures: string[] = []
      for (const source of config.sources) {
        const result = await checkVelxioReachability(source)
        if (cancelled) return

        if (result.ok) {
          setSelectedSource(source)
          setStatus('ready')
          setMessage(result.message)
          logEvent('VELXIO_HEALTH_CHECKED', {
            module: 'circuit-sim',
            status: 'success',
            mode: source.mode,
            origin: urlOrigin(source.url),
          })
          return
        }

        failures.push(result.message)
      }

      if (cancelled) return
      setSelectedSource(config.sources[0])
      setStatus('unavailable')
      const hasDevProxy = config.sources.some((source) => source.mode === 'dev-proxy')
      setMessage([
        failures[0] ?? 'Could not reach the configured Velxio service.',
        isLoopbackVelxioUrl(config.sources[0].url)
          ? hasDevProxy
            ? 'Start the local Velxio Docker service with docker compose -f docker-compose.velxio.yml up -d, or restart the dev server (npm run dev) so its built-in hosted Velxio proxy can serve the simulator.'
            : 'Start the local Velxio Docker service with docker compose -f docker-compose.velxio.yml up -d.'
          : 'Check the Velxio URL, TLS setup, and iframe/CSP policy for this deployment.',
      ].join(' '))
      logEvent('VELXIO_HEALTH_CHECKED', {
        module: 'circuit-sim',
        status: 'error',
        origin: urlOrigin(config.sources[0].url),
      })
    }

    runCheck()
    return () => { cancelled = true }
  }, [config, healthCheckToken])

  const retry = useCallback(() => {
    setIframeReloadToken((value) => value + 1)
    setHealthCheckToken((value) => value + 1)
  }, [])

  const reloadIframe = useCallback(() => {
    setIframeReloadToken((value) => value + 1)
  }, [])

  const mixedContentWarning = useMemo(() => {
    if (!fallbackSource || typeof window === 'undefined') return null
    const pageProtocol = window.location.protocol
    const sourceUrl = new URL(fallbackSource.url)
    if (pageProtocol === 'https:' && sourceUrl.protocol === 'http:' && !isLoopbackVelxioUrl(fallbackSource.url)) {
      return 'This page is served over HTTPS while Velxio is HTTP. Use HTTPS or a reverse proxy for production embeds.'
    }
    return null
  }, [fallbackSource])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
      background: 'var(--bg)',
      color: 'var(--text)',
    }}>
      <header style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          border: '1px solid var(--border-bright)',
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
          flexShrink: 0,
        }}>
          <Zap size={18} aria-hidden="true" />
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 9 }}>
            <h1 style={{
              margin: 0,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 17,
              fontWeight: 700,
              color: 'var(--text)',
            }}>
              Circuit Simulator
            </h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 24,
              padding: '3px 8px',
              borderRadius: 999,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: statusColor(status, selectedSource),
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              whiteSpace: 'nowrap',
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: statusColor(status, selectedSource),
              }} />
              {statusCopy(status, selectedSource)}
            </span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 9,
            marginTop: 3,
            color: 'var(--text-muted)',
            fontSize: 12,
          }}>
            <span>Powered by Velxio</span>
            <a
              href="https://velxio.dev"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'none' }}
            >
              Site
            </a>
            <a
              href="https://github.com/davidmonterocrespo24/velxio"
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', textDecoration: 'none' }}
            >
              <GitFork size={12} aria-hidden="true" />
              Source
            </a>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {!isSmallViewport && fallbackSource && (
          <div style={{
            maxWidth: 360,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'var(--text-dim)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
          }}>
            {fallbackSource.url}
          </div>
        )}

        <button
          type="button"
          aria-label="Retry Velxio health check"
          title="Retry Velxio health check"
          onClick={retry}
          style={iconButtonStyle}
        >
          <RefreshCcw size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Reload simulator"
          title="Reload simulator"
          onClick={reloadIframe}
          disabled={status !== 'ready'}
          style={{ ...iconButtonStyle, opacity: status === 'ready' ? 1 : 0.4, cursor: status === 'ready' ? 'pointer' : 'not-allowed' }}
        >
          <RotateCcw size={15} aria-hidden="true" />
        </button>
        {fallbackSource && config.newTabFallbackEnabled && (
          <button
            type="button"
            aria-label="Open Velxio in new tab"
            title="Open Velxio in new tab"
            onClick={() => openExternal(fallbackSource.url)}
            style={iconButtonStyle}
          >
            <ExternalLink size={15} aria-hidden="true" />
          </button>
        )}
      </header>

      {(isSmallViewport || mixedContentWarning || config.warnings.length > 0) && (
        <div style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 18px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          color: mixedContentWarning ? 'var(--warning-muted)' : 'var(--text-muted)',
          fontSize: 12,
          lineHeight: 1.45,
        }}>
          {mixedContentWarning ? <AlertTriangle size={14} aria-hidden="true" /> : <Info size={14} aria-hidden="true" />}
          <span>
            {mixedContentWarning
              ?? (isSmallViewport
                ? 'Velxio works best on a larger display; the simulator can still be opened here or in a new tab.'
                : config.warnings[0])}
          </span>
        </div>
      )}

      <VelxioEmbed
        source={fallbackSource}
        status={status}
        message={message}
        reloadToken={iframeReloadToken}
        sandbox={config.iframeSandbox}
        allow={config.iframeAllow}
        allowNewTab={config.newTabFallbackEnabled}
        onRetry={retry}
        onReload={reloadIframe}
      />

      <footer style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '7px 18px',
        borderTop: '1px solid var(--border)',
        color: 'var(--text-dim)',
        fontSize: 11,
        background: 'var(--bg)',
      }}>
        <span>Velxio is integrated as a separately hosted AGPLv3 service; no Velxio source is vendored in Enginguity.</span>
        <a
          href="https://github.com/davidmonterocrespo24/velxio/blob/master/LICENSE"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          AGPLv3
        </a>
      </footer>
    </div>
  )
}
