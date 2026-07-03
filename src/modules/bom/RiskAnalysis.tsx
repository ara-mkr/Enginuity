import { AlertTriangle, ShieldCheck, ShieldAlert, Cpu } from 'lucide-react'
import type { RiskAnalysisResult } from './types'

interface Props {
  report: RiskAnalysisResult | null
  loading: boolean
  onAnalyze: () => void
  onSelectPart?: (partNumber: string) => void
}

export function RiskAnalysis({ report, loading, onAnalyze, onSelectPart }: Props) {
  const getTrafficLightColor = (rating?: 'LOW' | 'MEDIUM' | 'HIGH') => {
    if (rating === 'LOW') return '#7aaa8a' // Green
    if (rating === 'MEDIUM') return '#b09470' // Yellow
    if (rating === 'HIGH') return '#b08080' // Red
    return 'var(--text-dim)'
  }

  const getRiskIcon = (rating?: 'LOW' | 'MEDIUM' | 'HIGH') => {
    if (rating === 'LOW') return <ShieldCheck size={20} style={{ color: '#7aaa8a' }} />
    if (rating === 'HIGH') return <ShieldAlert size={20} style={{ color: '#b08080' }} />
    return <AlertTriangle size={20} style={{ color: '#b09470' }} />
  }

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="label" style={{ fontSize: 11,  }}>
          Supply Chain Risk Analysis
        </span>
        {!loading && report && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>Rating:</span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                fontWeight: 700,
                color: getTrafficLightColor(report.overallRating),
                background: `${getTrafficLightColor(report.overallRating)}18`,
                padding: '2px 8px',
                borderRadius: 4,
                border: `1px solid ${getTrafficLightColor(report.overallRating)}30`,
              }}
            >
              {report.overallRating}
            </span>
          </div>
        )}
      </div>

      {!report && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0, maxWidth: 360 }}>
            Analyze component manufacturers, lifecycles, and shortage history using AI to evaluate supply chain risks.
          </p>
          <button
            className="btn"
            onClick={onAnalyze}
            style={{
              background: 'transparent',
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              padding: '6px 12px',
              borderRadius: 6,
            }}
          >
            <Cpu size={12} /> Run Risk Analysis
          </button>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 0' }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: '2px solid rgba(0,200,255,0.1)',
              borderTopColor: 'var(--accent)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--accent)' }}>
            Evaluating supply chain vulnerabilities…
          </span>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {!loading && report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Summary report block */}
          <div
            style={{
              display: 'flex',
              gap: 14,
              padding: 14,
              borderRadius: 8,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ marginTop: 2 }}>{getRiskIcon(report.overallRating)}</div>
            <p style={{ fontSize: 12, lineHeight: 1.6, margin: 0, color: 'var(--text)' }}>
              {report.reportSummary}
            </p>
          </div>

          {/* Risk Items */}
          {report.riskItems.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="label" style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                Vulnerabilities Found
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                {report.riskItems.map((item, i) => {
                  const itemColor =
                    item.riskType === 'eol'
                      ? '#b08080'
                      : item.riskType === 'single_source'
                      ? '#b09470'
                      : '#9485b8'
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <button
                          onClick={() => onSelectPart?.(item.partNumber)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            color: 'var(--accent)',
                            fontSize: 12,
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          {item.partNumber}
                        </button>
                        <span
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 9,
                            
                            color: itemColor,
                            background: `${itemColor}14`,
                            padding: '1px 6px',
                            borderRadius: 4,
                            border: `1px solid ${itemColor}22`,
                          }}
                        >
                          {item.riskType.replace('_', ' ')}
                        </span>
                      </div>
                      <p style={{ margin: '2px 0 0', color: 'var(--text)', fontSize: 11, lineHeight: 1.5 }}>
                        {item.description}
                      </p>
                      {item.suggestion && (
                        <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: 11, fontStyle: 'italic' }}>
                          <span style={{ color: '#b8d4f0' }}>◈</span> Suggestion: {item.suggestion}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px 0', textAlign: 'center', color: '#7aaa8a', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
              ✓ No critical supply chain issues detected.
            </div>
          )}

          {/* Action re-analyze */}
          <button
            className="btn"
            onClick={onAnalyze}
            style={{
              alignSelf: 'flex-start',
              fontSize: 10,
              padding: '4px 10px',
              fontFamily: "'JetBrains Mono', monospace",
              background: 'transparent',
              borderColor: 'var(--border)',
            }}
          >
            Re-run Analysis
          </button>
        </div>
      )}
    </div>
  )
}
