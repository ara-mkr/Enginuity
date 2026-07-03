import { useState } from 'react'
import { X, Zap } from 'lucide-react'
import { useOpenRouter } from '../context/OpenRouterContext'
import { OpenRouterSetup } from './OpenRouterSetup'

export function APIKeyBanner() {
  const { isConnected } = useOpenRouter()
  const [dismissed, setDismissed] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)

  if (isConnected || dismissed) return null

  return (
    <>
      <div
        className="flex items-center justify-between px-4 py-2.5 text-sm border-b shrink-0 top-banner"
        style={{
          background: 'rgba(148, 163, 184, 0.06)',
          borderColor: 'rgba(148, 163, 184, 0.18)',
        }}
      >
        <div className="flex items-center gap-2.5" style={{ color: 'var(--text)' }}>
          <Zap size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ fontSize: 13 }}>
            Connect your OpenRouter key to unlock every AI model in one click.
          </span>
          <button
            onClick={() => setSetupOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition-all"
            style={{
              background: 'transparent',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-glow)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            Connect →
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded transition-colors ml-4 shrink-0"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          aria-label="Dismiss"
        >
          <X size={13} />
        </button>
      </div>

      {setupOpen && <OpenRouterSetup onClose={() => setSetupOpen(false)} />}
    </>
  )
}
