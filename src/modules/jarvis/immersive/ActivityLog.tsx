import type { LogEntry } from '../types'

interface Props {
  log: LogEntry[]
  canvasItemCount: number
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
}

export function ActivityLog({ log, canvasItemCount }: Props) {
  const recent = log.slice(-6)
  return (
    <div
      style={{
        position: 'absolute',
        right: 32,
        top: 80,
        width: 220,
        maxWidth: 180,
        pointerEvents: 'none',
        background: 'rgba(0, 20, 50, 0.45)',
        border: '1px solid rgba(0, 150, 220, 0.35)',
        borderRadius: 6,
        padding: 14,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 4,
      }}
    >
      <div
        style={{
          fontFamily: '"Geist Mono", monospace',
          fontSize: 9,
          color: 'rgba(0,200,255,0.9)',
          letterSpacing: '0.18em',
          borderBottom: '1px solid rgba(0,150,220,0.35)',
          paddingBottom: 8,
          marginBottom: 12,
        }}
      >
        ACTIVITY LOG
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minHeight: 240 }}>
        {recent.length === 0 && (
          <div
            style={{
              fontSize: 10,
              color: 'rgba(0,160,210,0.65)',
              fontFamily: '"Geist Mono", monospace',
              fontStyle: 'italic',
            }}
          >
            — awaiting input
          </div>
        )}
        {recent.map((entry) => {
          const prefix = entry.role === 'user' ? '›' : entry.role === 'jarvis' ? '⟡' : '—'
          const prefixColor =
            entry.role === 'user'
              ? 'rgba(0,200,255,0.85)'
              : entry.role === 'jarvis'
              ? 'rgba(0,220,255,0.95)'
              : 'rgba(0,160,210,0.65)'
          const isSystem = entry.role === 'system'
          return (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 6,
                animation: 'jarvis-fade-in 300ms ease',
              }}
            >
              <div
                style={{
                  fontFamily:
                    entry.role === 'jarvis' ? '"Geist", "DM Sans", sans-serif' : '"Geist Mono", monospace',
                  fontSize: isSystem ? 9 : 10,
                  color: isSystem ? 'rgba(0,160,210,0.65)' : 'rgba(0,190,240,0.85)',
                  fontStyle: isSystem ? 'italic' : 'normal',
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <span style={{ color: prefixColor, marginRight: 4 }}>{prefix}</span>
                {truncate(entry.text, 22)}
              </div>
              <div
                style={{
                  fontFamily: '"Geist Mono", monospace',
                  fontSize: 8,
                  color: 'rgba(0,160,210,0.65)',
                  flexShrink: 0,
                }}
              >
                {formatTime(entry.timestamp)}
              </div>
            </div>
          )
        })}
      </div>

      <div
        style={{
          marginTop: 16,
          paddingTop: 8,
          borderTop: '1px solid rgba(0,100,180,0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: '"Geist Mono", monospace',
        }}
      >
        <span style={{ fontSize: 9, color: 'rgba(0,160,210,0.75)', letterSpacing: '0.2em' }}>
          CANVAS ITEMS
        </span>
        <span style={{ fontSize: 11, color: 'rgba(0,220,255,0.98)' }}>
          {String(canvasItemCount).padStart(2, '0')}
        </span>
      </div>
    </div>
  )
}
