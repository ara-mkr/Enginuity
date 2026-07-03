import { useState, useEffect } from 'react'
import { X, BarChart2, TrendingUp, Loader2, AlertTriangle } from 'lucide-react'
import { useOpenRouter } from '../../context/OpenRouterContext'

function buildDailyData(usageLog) {
  const days = {}
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days[key] = { date: key, label: d.toLocaleDateString('en-US', { weekday: 'short' }), requests: 0, cost: 0 }
  }
  for (const entry of usageLog) {
    const key = new Date(entry.timestamp).toISOString().slice(0, 10)
    if (days[key]) {
      days[key].requests += 1
      days[key].cost += entry.estimatedCost
    }
  }
  return Object.values(days)
}

function buildModelBreakdown(usageLog) {
  const counts = {}
  for (const entry of usageLog.slice(0, 200)) {
    counts[entry.model] = (counts[entry.model] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([model, count]) => ({ model, count }))
}

export function UsageDashboard({ onClose }) {
  const { apiKey, usageLog, totalRequestsToday, models } = useOpenRouter()
  const [keyInfo, setKeyInfo] = useState(null)
  const [keyLoading, setKeyLoading] = useState(false)
  const [keyError, setKeyError] = useState(null)

  const dailyData = buildDailyData(usageLog)
  const modelBreakdown = buildModelBreakdown(usageLog)
  const totalCostEstimate = usageLog.reduce((s, e) => s + (e.estimatedCost ?? 0), 0)
  const maxRequests = Math.max(...dailyData.map((d) => d.requests), 1)

  useEffect(() => {
    if (!apiKey) return
    setKeyLoading(true)
    fetch('https://openrouter.ai/api/v1/auth/key', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
      .then((r) => r.json())
      .then((data) => { setKeyInfo(data?.data ?? null); setKeyLoading(false) })
      .catch(() => { setKeyError('Could not fetch key info'); setKeyLoading(false) })
  }, [apiKey])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(8,8,16,0.9)', backdropFilter: 'blur(8px)', padding: 16,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 560,
        background: 'var(--surface)', border: '1px solid var(--border-bright)',
        borderRadius: 18, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart2 size={16} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Usage Dashboard</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }} data-tooltip="Close">
            <X size={16} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Key info */}
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)',   margin: '0 0 12px' }}>OpenRouter Key</p>
            {keyLoading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 12 }}><Loader2 size={13} className="animate-spin" /> Fetching key info...</div>}
            {keyError && <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b08080', fontSize: 12 }}><AlertTriangle size={13} />{keyError}</div>}
            {keyInfo && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Label', value: keyInfo.label ?? '—' },
                  { label: 'Usage', value: keyInfo.usage != null ? `$${Number(keyInfo.usage).toFixed(4)}` : '—' },
                  { label: 'Limit', value: keyInfo.limit != null ? `$${keyInfo.limit}` : 'None' },
                  { label: 'Remaining', value: keyInfo.limit_remaining != null ? `$${Number(keyInfo.limit_remaining).toFixed(2)}` : '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)', margin: '0 0 2px',  }}>{label}</p>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{value}</p>
                  </div>
                ))}
              </div>
            )}
            {!keyInfo && !keyLoading && !keyError && (
              <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>No key connected</p>
            )}
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              { label: 'Today', value: String(totalRequestsToday) },
              { label: 'Total requests', value: String(usageLog.length) },
              { label: 'Est. spend', value: `~$${totalCostEstimate.toFixed(4)}` },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)', margin: '0 0 4px',   }}>{label}</p>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>

          {/* 7-day bar chart */}
          <div>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)',   margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={11} /> Requests — last 7 days
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
              {dailyData.map((day) => {
                const heightPct = maxRequests > 0 ? (day.requests / maxRequests) * 100 : 0
                const isToday = day.date === new Date().toISOString().slice(0, 10)
                return (
                  <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--text-dim)' }}>{day.requests || ''}</span>
                    <div style={{
                      width: '100%', minHeight: 3,
                      height: `${Math.max(heightPct, day.requests > 0 ? 8 : 3)}%`,
                      background: isToday ? 'var(--accent)' : 'var(--border-bright)',
                      borderRadius: 4, transition: 'all 0.3s',
                    }} title={`${day.date}: ${day.requests} req`} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: isToday ? 'var(--accent)' : 'var(--text-dim)' }}>{day.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Model breakdown */}
          {modelBreakdown.length > 0 && (
            <div>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)',   margin: '0 0 10px' }}>Most used models</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {modelBreakdown.map(({ model, count }) => {
                  const def = models.find((m) => m.id === model)
                  const pct = (count / usageLog.length) * 100
                  return (
                    <div key={model}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text)' }}>
                          {def?.name ?? model.split('/').pop()}
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)' }}>{count} req</span>
                      </div>
                      <div style={{ height: 3, background: 'var(--border)', borderRadius: 2 }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: def?.providerColor ?? 'var(--accent)', borderRadius: 2 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UsageDashboard
