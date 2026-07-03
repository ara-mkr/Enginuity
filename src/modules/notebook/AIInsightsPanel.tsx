import { useState } from 'react'
import { ChevronDown, ChevronUp, Loader2, Zap, ArrowRight } from 'lucide-react'
import { useAIProvider } from '../../hooks/useAIProvider'
import { useProjectContext as useProject } from '../../hooks/useProjectContext'
import type { NotebookEntry, SurfaceResult } from './types'

function summarizeEntry(e: NotebookEntry): object {
  const base = { type: e.type, title: e.title, date: e.date, tags: e.tags }
  if ('description' in e) return { ...base, summary: (e as { description: string }).description.slice(0, 200) }
  if ('content' in e) return { ...base, summary: (e as { content: string }).content.slice(0, 200) }
  if ('conclusion' in e) return { ...base, summary: (e as { conclusion: string }).conclusion.slice(0, 200) }
  if ('summary' in e) return { ...base, summary: (e as { summary: string }).summary.slice(0, 200) }
  return base
}

const INSIGHT_META: Record<string, { label: string; color: string }> = {
  recurringIssues:      { label: 'Recurring Issues',       color: '#b08080' },
  unresolvedThreads:    { label: 'Unresolved Threads',     color: '#b09470' },
  decisionsToRevisit:   { label: 'Decisions to Revisit',   color: 'var(--accent)' },
  knowledgeGaps:        { label: 'Knowledge Gaps',         color: '#9485b8' },
  timelineAnomalies:    { label: 'Timeline Anomalies',     color: '#7aaa8a' },
  suggestedNextEntries: { label: 'Suggested Next Entries', color: '#78909c' },
}

interface Props {
  entries: NotebookEntry[]
  onJumpToEntry: (id: string) => void
}

export function AIInsightsPanel({ entries, onJumpToEntry }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SurfaceResult | null>(null)
  const [error, setError] = useState('')
  const { makeRequest } = useAIProvider()
  const { description: projectDescription } = useProject()

  async function surface() {
    setLoading(true)
    setError('')
    try {
      const dateRange = entries.length
        ? `${new Date(entries[entries.length - 1].date).toLocaleDateString()} to ${new Date(entries[0].date).toLocaleDateString()}`
        : 'N/A'

      const prompt = `Here is an engineering notebook with ${entries.length} entries spanning ${dateRange}.
Project context: ${projectDescription ?? 'Not provided'}

Entries (summarized):
${JSON.stringify(entries.map(summarizeEntry), null, 2)}

Please analyze this notebook and return ONLY valid JSON with this structure:
{
  "recurringIssues": [{ "type": "RECURRING_ISSUE", "description": "...", "relatedEntryIds": [] }],
  "unresolvedThreads": [{ "type": "UNRESOLVED_THREAD", "description": "...", "relatedEntryIds": [] }],
  "decisionsToRevisit": [{ "type": "DECISION_REVISIT", "description": "...", "relatedEntryIds": [] }],
  "knowledgeGaps": [{ "type": "KNOWLEDGE_GAP", "description": "...", "relatedEntryIds": [] }],
  "timelineAnomalies": [{ "type": "ANOMALY", "description": "...", "relatedEntryIds": [] }],
  "suggestedNextEntries": [{ "type": "SUGGESTION", "description": "...", "relatedEntryIds": [] }]
}

Use actual entry IDs from the entries array. Return JSON only.`

      const raw = await makeRequest([{ role: 'user', content: prompt }],
        'You are an expert engineering notebook analyst. Analyze patterns, gaps, and insights.', { maxTokens: 2048 })

      const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      setResult(JSON.parse(cleaned))
      setOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const hasInsights = result && Object.values(result).some((arr) => arr.length > 0)

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Zap size={16} style={{ color: 'var(--accent)' }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
            AI Surface Insights
          </span>
          {result && hasInsights && (
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--accent)', background: 'rgba(0,200,255,0.1)', padding: '2px 8px', borderRadius: 10 }}>
              {Object.values(result).reduce((s, a) => s + a.length, 0)} insights
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={surface} disabled={loading || entries.length === 0}
            style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            {result ? 'Re-analyze' : 'Surface Insights'}
          </button>
          {result && (
            <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '0 20px 14px', color: '#b08080', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{error}</div>
      )}

      {/* Insight cards */}
      {open && result && (
        <div style={{ borderTop: '1px solid var(--border)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(Object.entries(result) as [string, SurfaceResult[keyof SurfaceResult]][]).map(([key, insights]) => {
            if (!insights.length) return null
            const meta = INSIGHT_META[key]
            return (
              <div key={key}>
                <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: meta.color,   marginBottom: 10, marginTop: 0 }}>
                  {meta.label}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {insights.map((insight, i) => (
                    <div key={i} style={{
                      padding: '12px 14px', borderRadius: 8,
                      background: `${meta.color}08`, border: `1px solid ${meta.color}20`,
                    }}>
                      <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                        {insight.description}
                      </p>
                      {insight.relatedEntryIds.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {insight.relatedEntryIds.map((id) => (
                            <button key={id} onClick={() => onJumpToEntry(id)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                                background: 'none', border: `1px solid ${meta.color}30`,
                                borderRadius: 4, padding: '2px 8px',
                                color: meta.color, cursor: 'pointer',
                              }}>
                              <ArrowRight size={10} /> Jump to Entry
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
