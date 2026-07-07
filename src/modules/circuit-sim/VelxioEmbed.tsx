import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { AlertTriangle, ExternalLink, Loader2, RefreshCcw, RotateCcw } from 'lucide-react'
import type { VelxioSource } from './velxioConfig'

export type VelxioEmbedStatus = 'checking' | 'ready' | 'unavailable' | 'disabled'

interface VelxioEmbedProps {
  source: VelxioSource | null
  status: VelxioEmbedStatus
  message: string
  reloadToken: number
  sandbox: string
  allow: string
  allowNewTab: boolean
  onRetry: () => void
  onReload: () => void
}

const frameShellStyle: CSSProperties = {
  position: 'relative',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  background: 'var(--editor-bg)',
  borderTop: '1px solid var(--border)',
}

const centerStateStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'var(--bg)',
  zIndex: 2,
}

const actionButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  minHeight: 36,
  padding: '8px 12px',
  borderRadius: 6,
  border: '1px solid var(--border-bright)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontFamily: "'DM Sans', system-ui, sans-serif",
  fontSize: 13,
  cursor: 'pointer',
}

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

function StatePanel({
  icon,
  title,
  message,
  source,
  allowNewTab,
  onRetry,
}: {
  icon: ReactNode
  title: string
  message: string
  source: VelxioSource | null
  allowNewTab: boolean
  onRetry: () => void
}) {
  return (
    <div style={centerStateStyle}>
      <div style={{
        width: 'min(520px, 100%)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface)',
        padding: 22,
        boxShadow: '0 18px 50px rgba(0,0,0,0.22)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>{icon}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)' }}>{message}</p>
        {source && (
          <div style={{
            marginTop: 14,
            padding: '10px 12px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg-2)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: 'var(--text-dim)',
            wordBreak: 'break-all',
          }}>
            {source.url}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onRetry} style={actionButtonStyle}>
            <RefreshCcw size={14} aria-hidden="true" />
            Retry
          </button>
          {source && allowNewTab && (
            <button type="button" onClick={() => openExternal(source.url)} style={actionButtonStyle}>
              <ExternalLink size={14} aria-hidden="true" />
              Open in new tab
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function VelxioEmbed({
  source,
  status,
  message,
  reloadToken,
  sandbox,
  allow,
  allowNewTab,
  onRetry,
  onReload,
}: VelxioEmbedProps) {
  const frameKey = source && status === 'ready' ? `${source.url}:${reloadToken}` : null
  const [frameState, setFrameState] = useState<{
    key: string | null
    phase: 'idle' | 'loaded' | 'timeout' | 'error'
  }>({ key: null, phase: 'idle' })
  const visibleFrameState = frameState.key === frameKey
    ? frameState.phase
    : frameKey
      ? 'loading'
      : 'idle'

  useEffect(() => {
    if (!frameKey) return

    const timeout = window.setTimeout(() => {
      setFrameState((current) => (
        current.key === frameKey && current.phase === 'loaded'
          ? current
          : { key: frameKey, phase: 'timeout' }
      ))
    }, 12000)

    return () => window.clearTimeout(timeout)
  }, [frameKey])

  const loadMessage = useMemo(() => {
    if (!source) return 'Checking Velxio availability.'
    return `Loading ${source.label}.`
  }, [source])

  if (status === 'checking') {
    return (
      <div style={frameShellStyle}>
        <div style={centerStateStyle} role="status" aria-live="polite">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13 }}>
            <Loader2 size={17} aria-hidden="true" />
            {message || 'Checking Velxio availability.'}
          </div>
        </div>
      </div>
    )
  }

  if (status === 'disabled') {
    return (
      <div style={frameShellStyle}>
        <StatePanel
          icon={<AlertTriangle size={19} aria-hidden="true" />}
          title="Velxio simulator is not configured"
          message={message}
          source={source}
          allowNewTab={allowNewTab}
          onRetry={onRetry}
        />
      </div>
    )
  }

  if (status === 'unavailable') {
    return (
      <div style={frameShellStyle}>
        <StatePanel
          icon={<AlertTriangle size={19} aria-hidden="true" />}
          title="Velxio simulator is not available"
          message={message}
          source={source}
          allowNewTab={allowNewTab}
          onRetry={onRetry}
        />
      </div>
    )
  }

  if (!source) {
    return (
      <div style={frameShellStyle}>
        <StatePanel
          icon={<AlertTriangle size={19} aria-hidden="true" />}
          title="Velxio simulator is not available"
          message="No Velxio URL is available for this session."
          source={null}
          allowNewTab={allowNewTab}
          onRetry={onRetry}
        />
      </div>
    )
  }

  const frameUnavailable = visibleFrameState === 'timeout' || visibleFrameState === 'error'

  return (
    <div style={frameShellStyle}>
      {!frameUnavailable && visibleFrameState !== 'loaded' && (
        <div style={centerStateStyle} role="status" aria-live="polite">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13 }}>
            <Loader2 size={17} aria-hidden="true" />
            {loadMessage}
          </div>
        </div>
      )}

      {frameUnavailable && (
        <StatePanel
          icon={<AlertTriangle size={19} aria-hidden="true" />}
          title="Velxio iframe did not finish loading"
          message="The Velxio service responded to the availability check, but the embedded simulator did not load in time. Reload the simulator or open it in a new tab."
          source={source}
          allowNewTab={allowNewTab}
          onRetry={onRetry}
        />
      )}

      <iframe
        key={frameKey ?? 'velxio-frame'}
        title="Velxio circuit simulator"
        src={source.url}
        sandbox={sandbox}
        allow={allow}
        referrerPolicy="no-referrer"
        onLoad={() => setFrameState({ key: frameKey, phase: 'loaded' })}
        onError={() => setFrameState({ key: frameKey, phase: 'error' })}
        style={{
          display: frameUnavailable ? 'none' : 'block',
          width: '100%',
          height: '100%',
          border: 'none',
          background: '#050505',
        }}
      />

      {visibleFrameState === 'loaded' && (
        <button
          type="button"
          aria-label="Reload Velxio simulator"
          title="Reload Velxio simulator"
          onClick={onReload}
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            zIndex: 1,
            width: 36,
            height: 36,
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(8,8,8,0.76)',
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          <RotateCcw size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
