import { useState, useEffect, useRef, useCallback } from 'react'
import { X, RefreshCw, ChevronRight } from 'lucide-react'
import owlMark from '../../assets/owl-mark.png'
import { useEnginguityStore } from '../../engine/persistenceEngine'

// ─── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY      = 'enginguity_session_briefing'
const LAST_SEEN_KEY    = 'enginguity_last_seen'
const ABSENCE_THRESH   = 4 * 60 * 60 * 1000  // 4 hours

// ─── Helpers ───────────────────────────────────────────────────────────────────

function safeJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function relTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 3_600_000)   return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000)  return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(ts).toLocaleDateString()
}

function gatherContext() {
  const notebook     = safeJson('enginguity_notebook', [])
  const bom          = safeJson('enginguity_bom_current', [])
  const files        = safeJson('enginguity_file_history', [])
  const ideas        = safeJson('enginguity_saved_ideas', [])
  const scmBoms      = safeJson('enginguity_scm_boms', [])
  const canvas       = useEnginguityStore.getState().jarvisCanvas?.items ?? []
  const project      = safeJson('enginguity_project', {})
  const eventLog     = safeJson('enginguity_event_log', [])
  const lastSeen     = localStorage.getItem(LAST_SEEN_KEY)
  const absenceHours = lastSeen ? ((Date.now() - Number(lastSeen)) / 3_600_000).toFixed(1) : 'unknown'

  // Unresolved problems
  const openProblems = notebook.filter(e => e.tags?.includes('problem') && !e.resolved)

  // Supply chain alerts
  const scmAlerts = []
  scmBoms.forEach(b => (b.items || []).forEach(i => (i.alerts || []).forEach(a => scmAlerts.push({ part: i.partNumber, type: a.type, detail: a.detail }))))

  // Recent events since last seen
  const recentEvents = lastSeen
    ? eventLog.filter(e => e.timestamp > Number(lastSeen)).slice(-20)
    : eventLog.slice(-10)

  return {
    projectName:  project.name || 'your project',
    absenceHours,
    notebookCount: notebook.length,
    openProblems: openProblems.slice(0, 5).map(e => e.title || 'Untitled'),
    bomCount:     bom.length,
    filesCount:   files.length,
    ideasCount:   ideas.length,
    scmAlerts:    scmAlerts.slice(0, 5),
    recentEvents: recentEvents.map(e => ({ type: e.type, ts: e.timestamp })),
    canvasItems:  canvas.length,
    lastCanvasCmd: canvas[canvas.length - 1]?.fromCommand || null,
  }
}

function buildBriefingPrompt(ctx) {
  return `You are Ohma, an AI engineering assistant. The user has returned to Enginguity after ${ctx.absenceHours} hours away.

Project: ${ctx.projectName}
Open problems in notebook: ${ctx.openProblems.length > 0 ? ctx.openProblems.join('; ') : 'none'}
Supply chain alerts: ${ctx.scmAlerts.length > 0 ? ctx.scmAlerts.map(a => `${a.part} (${a.type})`).join('; ') : 'none'}
Recent activity since last visit: ${ctx.recentEvents.length} events (types: ${[...new Set(ctx.recentEvents.map(e => e.type))].join(', ') || 'none'})
Canvas items: ${ctx.canvasItems} (last command: "${ctx.lastCanvasCmd || 'none'}")
BOM items: ${ctx.bomCount}, Files loaded: ${ctx.filesCount}, Ideas saved: ${ctx.ideasCount}

Write a friendly, concise "welcome back" briefing in 2-3 sentences. Highlight what needs attention most urgently. If there are open problems or supply chain alerts, mention them first. Be conversational, not robotic. Do NOT use bullet points or headers. Speak directly to the user as "you".`
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function SessionBriefing() {
  const [visible, setVisible]     = useState(false)
  const [briefing, setBriefing]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [ctx, setCtx]             = useState(null)
  const [history, setHistory]     = useState(() => safeJson(STORAGE_KEY, []))
  const [showHistory, setShowHistory] = useState(false)
  const hasChecked = useRef(false)

  const loadBriefing = useCallback(async (context, force = false) => {
    setLoading(true)
    setBriefing('')
    try {
      const prompt = buildBriefingPrompt(context)
      const apiKey = localStorage.getItem('enginguity_openrouter_key')
      if (!apiKey) {
        setBriefing(`Welcome back! You've been away for ${context.absenceHours} hours. You have ${context.openProblems.length} open problem(s) and ${context.scmAlerts.length} supply chain alert(s) to review.`)
        setLoading(false)
        return
      }

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://enginguity.app',
          'X-Title': 'Enginguity',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3-haiku',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
          temperature: 0.7,
        }),
      })

      const data = await res.json()
      const text = data.choices?.[0]?.message?.content?.trim() || 'Welcome back! Check your notebook and supply chain for updates.'
      setBriefing(text)

      // Save to history
      const entry = { id: Date.now(), ts: Date.now(), briefing: text, context }
      const updated = [entry, ...safeJson(STORAGE_KEY, [])].slice(0, 10)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      setHistory(updated)

      // Dispatch for Jarvis voice
      window.dispatchEvent(new CustomEvent('enginguity_session_briefing_ready', { detail: { briefing: text } }))
    } catch {
      setBriefing(`Welcome back! You've been away for ${context.absenceHours} hours. Check your open problems and supply chain status.`)
    }
    setLoading(false)
  }, [])

  // ── Check on mount ──
  useEffect(() => {
    if (hasChecked.current) return
    hasChecked.current = true

    const lastSeen = localStorage.getItem(LAST_SEEN_KEY)
    const now = Date.now()

    if (lastSeen && (now - Number(lastSeen)) >= ABSENCE_THRESH) {
      const context = gatherContext()
      setCtx(context)
      setVisible(true)
      loadBriefing(context)
    }

    // Update last seen timestamp on page load
    const updateLastSeen = () => localStorage.setItem(LAST_SEEN_KEY, String(Date.now()))
    updateLastSeen()
    window.addEventListener('beforeunload', updateLastSeen)
    return () => window.removeEventListener('beforeunload', updateLastSeen)
  }, [loadBriefing])

  // ── External trigger ──
  useEffect(() => {
    const handle = () => {
      const context = gatherContext()
      setCtx(context)
      setVisible(true)
      loadBriefing(context, true)
    }
    window.addEventListener('enginguity_show_briefing', handle)
    return () => window.removeEventListener('enginguity_show_briefing', handle)
  }, [loadBriefing])

  if (!visible) return null

  const urgentChips = []
  if (ctx?.openProblems?.length > 0) urgentChips.push({ label: `${ctx.openProblems.length} open problem${ctx.openProblems.length > 1 ? 's' : ''}`, color: 'rgba(160,100,100,0.18)' })
  if (ctx?.scmAlerts?.length > 0)    urgentChips.push({ label: `${ctx.scmAlerts.length} supply alert${ctx.scmAlerts.length > 1 ? 's' : ''}`, color: 'rgba(160,130,90,0.15)' })

  const suggestedRoute = ctx?.openProblems?.length > 0 ? '/notebook' : ctx?.scmAlerts?.length > 0 ? '/supply-chain' : null
  const suggestedLabel = ctx?.openProblems?.length > 0 ? 'Review Notebook' : ctx?.scmAlerts?.length > 0 ? 'Check Supply Chain' : null

  return (
    <div
      style={{
        position:      'fixed',
        top:           0,
        left:          '50%',
        transform:     'translateX(-50%)',
        zIndex:        10000,
        width:         560,
        maxWidth:      'calc(100vw - 32px)',
        animation:     'briefingSlideDown 0.35s cubic-bezier(0.16,1,0.3,1) both',
        fontFamily:    "'DM Sans', 'Geist', sans-serif",
      }}
    >
      <style>{`
        @keyframes briefingSlideDown {
          from { transform: translateX(-50%) translateY(-110%); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);     opacity: 1; }
        }
      `}</style>

      <div
        style={{
          background:   'var(--surface)',
          border:       '1px solid var(--border-bright)',
          borderTop:    'none',
          borderRadius: '0 0 12px 12px',
          boxShadow:    '0 16px 48px rgba(0,0,0,0.64)',
          overflow:     'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px 0', borderBottom: '1px solid var(--border)' }}>
          {/* Ohma mascot */}
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #4a9eff 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
            <img src={owlMark} alt="Ohma Mascot" style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', letterSpacing: '0.02em' }}>Ohma</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              {ctx?.absenceHours ? `You were away for ${ctx.absenceHours}h` : 'Session briefing'}
            </div>
          </div>

          {/* Chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {urgentChips.map((chip, i) => (
              <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: chip.color + '22', color: chip.color, border: `1px solid ${chip.color}44`, fontWeight: 500 }}>
                {chip.label}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexShrink: 0 }}>
            <button
              onClick={() => { setShowHistory(h => !h) }}
              title="Briefing history"
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4, borderRadius: 4, fontSize: 11 }}
            >
              History
            </button>
            <button
              onClick={() => ctx && loadBriefing(ctx, true)}
              disabled={loading}
              title="Refresh briefing"
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }}
            >
              <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button
              onClick={() => setVisible(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Briefing text */}
        <div style={{ padding: '12px 16px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-dim)', fontSize: 13 }}>
              <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
              Generating briefing…
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{briefing}</p>
          )}
        </div>

        {/* CTA */}
        {!loading && suggestedRoute && (
          <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setVisible(false); window.location.hash = suggestedRoute }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'var(--accent)', border: 'none', borderRadius: 6, fontSize: 12, color: '#000', cursor: 'pointer', fontWeight: 500 }}
            >
              {suggestedLabel} <ChevronRight size={12} />
            </button>
            <button
              onClick={() => setVisible(false)}
              style={{ padding: '6px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--text-dim)', cursor: 'pointer' }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* History panel */}
        {showHistory && (
          <div style={{ borderTop: '1px solid var(--border)', maxHeight: 200, overflowY: 'auto', padding: '8px 0' }}>
            {history.length === 0 ? (
              <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-dim)' }}>No previous briefings.</div>
            ) : history.map(h => (
              <div key={h.id} style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>{relTime(h.ts)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {h.briefing.length > 140 ? h.briefing.slice(0, 140) + '…' : h.briefing}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
