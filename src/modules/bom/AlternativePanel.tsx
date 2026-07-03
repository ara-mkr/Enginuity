import { X, Check, AlertTriangle, ArrowRight } from 'lucide-react'
import type { BOMItem, AlternativePart } from './types'

interface Props {
  row: BOMItem | null
  alternatives: AlternativePart[]
  loading: boolean
  onClose: () => void
  onSwap: (selected: AlternativePart) => void
}

export function AlternativePanel({ row, alternatives, loading, onClose, onSwap }: Props) {
  if (!row) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 440,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border-bright)',
        boxShadow: '-8px 0 24px rgba(0,0,0,0.5)',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideIn 0.25s ease-out',
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <span className="label" style={{ fontSize: 9, display: 'block', marginBottom: 2 }}>
            Find Alternatives
          </span>
          <h3
            style={{
              margin: 0,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 16,
              color: 'var(--accent)',
              fontWeight: 700,
            }}
          >
            {row.part_number || row.value}
          </h3>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: 4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Original Specs */}
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
          <span className="label" style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 8, display: 'block' }}>
            Original Component Specs
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Description</span>
              <span style={{ color: 'var(--text)', textAlign: 'right', maxWidth: 220 }} className="truncate" title={row.description}>
                {row.description}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Value</span>
              <span style={{ color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>{row.value || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Package</span>
              <span style={{ color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>{row.package || '—'}</span>
            </div>
            {row.manufacturer && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Manufacturer</span>
                <span style={{ color: 'var(--text)' }}>{row.manufacturer}</span>
              </div>
            )}
          </div>
        </div>

        {/* Alternatives List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span className="label" style={{ fontSize: 9, color: 'var(--text-dim)' }}>
            Suggested Alternatives
          </span>

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 0' }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: '2px solid rgba(0,200,255,0.1)',
                  borderTopColor: 'var(--accent)',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)' }}>
                Looking up compatible parts…
              </span>
            </div>
          )}

          {!loading && alternatives.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No alternative parts found.
            </div>
          )}

          {!loading && alternatives.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {alternatives.map((alt, i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-bright)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <h4
                        style={{
                          margin: 0,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 13,
                          fontWeight: 700,
                          color: 'var(--text)',
                        }}
                      >
                        {alt.partNumber}
                      </h4>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                        {alt.manufacturer}
                      </span>
                    </div>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        background: alt.dropInCompatible ? 'rgba(34,197,94,0.08)' : 'rgba(255,171,64,0.08)',
                        color: alt.dropInCompatible ? '#7aaa8a' : '#b09470',
                        border: `1px solid ${alt.dropInCompatible ? '#7aaa8a24' : '#b0947024'}`,
                      }}
                    >
                      {alt.dropInCompatible ? (
                        <>
                          <Check size={10} /> Drop-in
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={10} /> Near Fit
                        </>
                      )}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    <div style={{ marginBottom: 4 }}>
                      <strong style={{ color: 'var(--text)', fontSize: 10,   }}>Differences:</strong>{' '}
                      {alt.differences}
                    </div>
                    {alt.notes && (
                      <div>
                        <strong style={{ color: 'var(--text)', fontSize: 10,   }}>Notes:</strong>{' '}
                        {alt.notes}
                      </div>
                    )}
                  </div>

                  <button
                    className="btn"
                    onClick={() => onSwap(alt)}
                    style={{
                      background: 'rgba(0,200,255,0.08)',
                      borderColor: 'rgba(0,200,255,0.2)',
                      color: 'var(--accent)',
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '6px 0',
                      borderRadius: 6,
                      marginTop: 4,
                    }}
                  >
                    Swap in BOM <ArrowRight size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
