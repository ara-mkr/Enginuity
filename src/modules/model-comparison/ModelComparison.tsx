import React, { useState, useEffect, useRef, useCallback } from 'react'
import ResizablePanel from '../../components/ResizablePanel'
import {
  GitCompare, Play, Square, Copy, Check, ThumbsUp, ThumbsDown,
  ChevronDown, ChevronRight, Clock, Coins, BarChart2, History,
  Download, Keyboard, X, Pin,
} from 'lucide-react'
import { useProjectContext } from '../../hooks/useProjectContext'
import { useProbeContext } from '../../hooks/useProbeContext'
import { logEvent } from '../../engine/eventLog'
import OPENROUTER_MODELS from '../../config/openrouterModels'
import { OR_KEY_STORAGE } from '../../config/openrouterModels'
import { readStoredKey } from '../../utils/keyStorage'

// ── Types ────────────────────────────────────────────────────────────────────

interface ModelSelection { modelId: string }

interface ResultState {
  providerId: string
  modelId: string
  text: string
  status: 'idle' | 'loading' | 'done' | 'error'
  error?: string
  startTime?: number
  endTime?: number
  tokens?: number
}

interface StoredComparison {
  id: string
  prompt: string
  timestamp: number
  results: Array<{ provider: string; model: string; response: string; responseTimeMs: number; tokens: number }>
  votes: Record<string, 'up' | 'down'>
  summary?: object
}

// ── Pricing (per 1M tokens) ──────────────────────────────────────────────────

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-5':       { input: 15, output: 75 },
  'claude-sonnet-4-5':     { input: 3,  output: 15 },
  'claude-haiku-4-5':      { input: 0.8,output: 4  },
  'gpt-4o':                { input: 5,  output: 15 },
  'gpt-4o-mini':           { input: 0.15,output: 0.6},
  'gpt-4-turbo':           { input: 10, output: 30 },
  'gemini-1.5-pro':        { input: 3.5,output: 10.5},
  'gemini-2.0-flash':      { input: 0.1,output: 0.4},
  'deepseek-chat':         { input: 0.27,output: 1.1},
  'grok-3':                { input: 3,  output: 15 },
  'grok-3-fast':           { input: 5,  output: 25 },
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
}

function estimateCost(modelId: string, tokens: number): string {
  const p = PRICING[modelId]
  if (!p || !tokens) return '—'
  // Rough split: 30% input, 70% output
  const cost = (tokens * 0.3 / 1e6) * p.input + (tokens * 0.7 / 1e6) * p.output
  if (cost < 0.0001) return '<$0.0001'
  return `~$${cost.toFixed(4)}`
}

// ── API helpers ──────────────────────────────────────────────────────────────

function buildRequest(modelId: string, userPrompt: string, systemCtx?: string) {
  const apiKey = readStoredKey(OR_KEY_STORAGE) ?? ''
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://enginguity.app',
    'X-Title': 'ENGINGUITY',
  }
  const messages: Array<{ role: string; content: string }> = []
  if (systemCtx) messages.push({ role: 'system', content: systemCtx })
  messages.push({ role: 'user', content: userPrompt })
  const body = { model: modelId, messages, max_tokens: 4096 }
  return { url: 'https://openrouter.ai/api/v1/chat/completions', headers, body }
}

function extractResponse(data: Record<string, unknown>): { text: string; tokens: number } {
  const choices = data.choices as Array<{ message: { content: string } }>
  const text = choices?.[0]?.message?.content ?? ''
  const u = data.usage as Record<string, number> | undefined
  const tokens = u?.total_tokens ?? 0
  return { text, tokens }
}

// ── Diff utilities ────────────────────────────────────────────────────────────

function levenshteinSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const la = a.toLowerCase().slice(0, 120)
  const lb = b.toLowerCase().slice(0, 120)
  const m = la.length; const n = lb.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = la[i - 1] === lb[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])
    }
  }
  return 1 - dp[m][n] / Math.max(m, n, 1)
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 20)
}

type SentenceLabel = 'unique' | 'shared' | 'contradiction'

function labelSentences(
  sentences: string[],
  otherTexts: string[]
): SentenceLabel[] {
  return sentences.map((s) => {
    const matches = otherTexts.map((other) => {
      const otherSents = splitSentences(other)
      return otherSents.some((os) => levenshteinSimilarity(s, os) > 0.7)
    })
    const matchCount = matches.filter(Boolean).length
    if (matchCount === otherTexts.length) return 'shared'

    const negWords = /never|wrong|incorrect|avoid|don't|not recommended|dangerous/i
    const hasNeg = negWords.test(s)
    const othersHaveOpposite = otherTexts.some((o) => {
      const oSents = splitSentences(o)
      return oSents.some((os) => {
        const sim = levenshteinSimilarity(s.replace(negWords, ''), os.replace(negWords, ''))
        return sim > 0.5 && negWords.test(s) !== negWords.test(os)
      })
    })
    if (hasNeg && othersHaveOpposite) return 'contradiction'
    return 'unique'
  })
}

// ── Preset prompts ────────────────────────────────────────────────────────────

const PRESETS = {
  'Code Review': [
    'Review this code for bugs, edge cases, and performance issues: [paste code here]',
    'Suggest comprehensive unit tests for this function: [paste function here]',
  ],
  'Design': [
    'What are the tradeoffs between these two approaches: [describe approaches]',
    'What are the failure modes of this design: [describe design]',
  ],
  'Simulation': [
    'Derive the transfer function for this control system: [describe system]',
    'What happens to system stability if I double the loop gain? [describe current system]',
  ],
  'Hardware': [
    'Spec a motor for this application: [describe load, speed, voltage requirements]',
    'What protection circuits does this power supply design need? [describe supply]',
  ],
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  return (
    <span style={{
      padding: '1px 6px', borderRadius: 4, fontSize: 10,
      fontFamily: "'JetBrains Mono', monospace", fontWeight: 400,
      background: 'var(--surface-2)',
      color: 'var(--text-muted)',
      border: '1px solid var(--border-bright)',
    }}>
      {tier}
    </span>
  )
}

function SkeletonLoader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16 }}>
      {[1, 0.85, 0.92, 0.7].map((w, i) => (
        <div key={i} style={{
          height: 12, borderRadius: 4, width: `${w * 100}%`,
          background: 'var(--border)',
          animation: 'skeleton-fade 1.6s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  )
}

function ResultCard({
  result, index, diffMode, allResults, votes, onVote, onPin,
}: {
  result: ResultState
  index: number
  diffMode: boolean
  allResults: ResultState[]
  votes: Record<string, 'up' | 'down'>
  onVote: (key: string, v: 'up' | 'down') => void
  onPin: (text: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const orModel = OPENROUTER_MODELS.find((m) => m.id === result.modelId)
  const provider = orModel ? { name: orModel.provider, color: orModel.providerColor } : { name: result.modelId, color: '#888' }
  const model = orModel ? { name: orModel.name, tier: orModel.tier } : null
  const voteKey = result.modelId
  const elapsed = result.startTime && result.endTime ? result.endTime - result.startTime : null
  const cost = result.tokens ? estimateCost(result.modelId, result.tokens) : null

  const copy = () => {
    navigator.clipboard.writeText(result.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const renderContent = () => {
    if (result.status === 'loading') return <SkeletonLoader />
    if (result.status === 'error') return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
        {result.error}
      </div>
    )
    if (!result.text) return null

    if (diffMode && allResults.filter((r) => r.status === 'done').length > 1) {
      const others = allResults
        .filter((r) => r.providerId !== result.providerId || r.modelId !== result.modelId)
        .map((r) => r.text)
      const sentences = splitSentences(result.text)
      const labels = labelSentences(sentences, others)
      const diffColors: Record<SentenceLabel, string | undefined> = {
        shared: 'rgba(255,255,255,0.04)',
        unique: 'rgba(255,255,255,0.07)',
        contradiction: undefined,
      }

      return (
        <div style={{ padding: 14, fontSize: 13, lineHeight: 1.7 }}>
          {sentences.map((s, i) => (
            <span key={i} style={{
              background: diffColors[labels[i]],
              borderRadius: 3, padding: '0 2px',
            }}>
              {s + ' '}
            </span>
          ))}
        </div>
      )
    }

    // Simple markdown-ish render
    const lines = result.text.split('\n')
    return (
      <div style={{ padding: 14, fontSize: 13, lineHeight: 1.7, overflowWrap: 'break-word' }}>
        {lines.map((line, i) => {
          if (line.startsWith('```')) return null
          if (line.startsWith('# ')) return <h3 key={i} style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>{line.slice(2)}</h3>
          if (line.startsWith('## ')) return <h4 key={i} style={{ fontSize: 13, fontWeight: 600, marginBottom: 3, color: 'var(--text)' }}>{line.slice(3)}</h4>
          if (line.startsWith('- ') || line.startsWith('* ')) return (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span>{line.slice(2)}</span>
            </div>
          )
          if (!line.trim()) return <div key={i} style={{ height: 8 }} />
          return <p key={i} style={{ margin: '0 0 6px' }}>{line}</p>
        })}
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
      outline: index <= 8 ? `0` : undefined,
      tabIndex: index,
    } as React.CSSProperties}
      id={`result-${index}`}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '10px 14px', borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap', gap: 8,
      } as React.CSSProperties}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontFamily: "'DM Sans Variable', 'DM Sans', system-ui, sans-serif", fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
          {provider?.name}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
          {model?.name ?? result.modelId}
        </span>
        {model && <TierBadge tier={model.tier} />}
        <div style={{ flex: 1 }} />
        {elapsed && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
            <Clock size={11} /> {elapsed}ms
          </span>
        )}
        {result.tokens && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
            <Coins size={11} /> {result.tokens}tok
          </span>
        )}
        {result.status === 'done' && (
          <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#7aaa8a' : 'var(--text-muted)' }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 380 }}>
        {renderContent()}
      </div>

      {/* Footer */}
      {result.status === 'done' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderTop: '1px solid var(--border)',
        }}>
          <button
            onClick={() => onVote(voteKey, 'up')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: votes[voteKey] === 'up' ? 'var(--text)' : 'var(--text-muted)', padding: 2 }}
          >
            <ThumbsUp size={13} />
          </button>
          <button
            onClick={() => onVote(voteKey, 'down')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: votes[voteKey] === 'down' ? 'var(--text)' : 'var(--text-muted)', padding: 2 }}
          >
            <ThumbsDown size={13} />
          </button>
          <button
            onClick={() => onPin(result.text)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", padding: 2 }}
          >
            <Pin size={11} /> Pin
          </button>
          <div style={{ flex: 1 }} />
          {cost && cost !== '—' && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{cost}</span>
          )}
        </div>
      )}
    </div>
  )
}

interface ModelComparisonLayoutProps {
  isDesktop: boolean
  children: [React.ReactNode, React.ReactNode]
}

function ModelComparisonLayout({ isDesktop, children }: ModelComparisonLayoutProps) {
  if (isDesktop) {
    return (
      <ResizablePanel
        direction="horizontal"
        initialSplit={0.35}
        minFirst={320}
        minSecond={400}
        storageKey="model-comparison-split"
      >
        {children}
      </ResizablePanel>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      {children[0]}
      {children[1]}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ModelComparison() {
  const { description: projectDesc } = useProjectContext()
  const [prompt, setPrompt] = useState('')
  const [systemCtxOpen, setSystemCtxOpen] = useState(false)
  const [systemCtx, setSystemCtx] = useState('')
  const [selected, setSelected] = useState<ModelSelection[]>([])
  const [results, setResults] = useState<ResultState[]>([])
  const [running, setRunning] = useState(false)
  const [diffMode, setDiffMode] = useState(false)
  const [votes, setVotes] = useState<Record<string, 'up' | 'down'>>({})
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<StoredComparison[]>([])
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [summary, setSummary] = useState<Record<string, string> | null>(null)
  const abortRefs = useRef<AbortController[]>([])
  const [isDesktop, setIsDesktop] = useState(false)

  useProbeContext('model-comparison', {
    promptLength: prompt.length,
    selectedModels: selected.map((s) => s.modelId),
    running,
    completedResults: results.filter((r) => r.status === 'done').length,
    erroredResults: results.filter((r) => r.status === 'error').length,
    hasSummary: !!summary,
  })

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount read of matchMedia state
    setIsDesktop(media.matches)
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  // Load history
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount restore from localStorage
      setHistory(JSON.parse(localStorage.getItem('enginguity_comparisons') || '[]'))
    } catch { /* corrupted/missing stored value — fall back to default */ }
  }, [])

  // Pre-fill system context from project
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time prefill sync from external project context
    if (projectDesc && !systemCtx) setSystemCtx(projectDesc.slice(0, 600))
    // 'systemCtx' is intentionally excluded — it's the guard that stops
    // this from overwriting user edits, not something that should
    // re-trigger the prefill when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDesc])

  // Select defaults: one flagship model per provider
  useEffect(() => {
    const key = readStoredKey(OR_KEY_STORAGE)
    if (!key) return
    const defaults: ModelSelection[] = OPENROUTER_MODELS
      .filter((m) => m.recommended)
      .slice(0, 3)
      .map((m) => ({ modelId: m.id }))
    if (!defaults.length) {
      defaults.push(
        { modelId: 'anthropic/claude-sonnet-4-5' },
        { modelId: 'openai/gpt-4o' },
        { modelId: 'deepseek/deepseek-chat-v3-0324' },
      )
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount default-model selection when an API key is present
    setSelected(defaults)
  }, [])

  const isSelected = (mid: string) =>
    selected.some((s) => s.modelId === mid)

  const toggleModel = (mid: string) => {
    setSelected((prev) =>
      isSelected(mid)
        ? prev.filter((s) => s.modelId !== mid)
        : [...prev, { modelId: mid }]
    )
  }

  const cancelAll = () => {
    abortRefs.current.forEach((ac) => ac.abort())
    abortRefs.current = []
    setRunning(false)
    setResults((prev) => prev.map((r) => r.status === 'loading' ? { ...r, status: 'error', error: 'Cancelled' } : r))
  }

  // handleRun is declared later (it depends on generateSummary); keep a
  // stable ref so this mount-order-independent keydown listener can call
  // the latest version without a "used before declared" violation.
  const handleRunRef = useRef<() => void>(() => {})

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'Enter') { e.preventDefault(); handleRunRef.current() }
      if (mod && e.key === 'd') { e.preventDefault(); setDiffMode((d) => !d) }
      if (e.key === 'Escape') { cancelAll(); setShortcutsOpen(false) }
      if (e.key === '?') setShortcutsOpen((o) => !o)
      if (!mod && /^[1-9]$/.test(e.key)) {
        const el = document.getElementById(`result-${parseInt(e.key) - 1}`)
        el?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [prompt, selected])

  const generateSummary = async (doneResults: ResultState[]) => {
    if (!readStoredKey(OR_KEY_STORAGE)) return
    const summaryModelId = 'anthropic/claude-haiku-4-5'
    const responsesText = doneResults
      .map((r) => {
        const def = OPENROUTER_MODELS.find((m) => m.id === r.modelId)
        return `[${def?.name ?? r.modelId}]:\n${r.text}`
      })
      .join('\n\n---\n\n')

    const summaryPrompt = `You are analyzing responses from multiple AI models to the same engineering question. Here are the responses:\n\n${responsesText}\n\nProvide a structured comparison. Return ONLY valid JSON with keys: {"consensus": "string", "differences": "string", "recommended": "string", "warnings": "string"}`

    try {
      const { url, headers, body } = buildRequest(summaryModelId, summaryPrompt)
      const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
      if (!resp.ok) return
      const data = await resp.json()
      const { text } = extractResponse(data as Record<string, unknown>)
      const parsed = JSON.parse(text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim())
      setSummary(parsed)
    } catch { /* summary is a best-effort extra — comparison results stand on their own */ }
  }
  const handleRun = useCallback(async () => {
    if (!prompt.trim() || selected.length === 0 || running) return
    setRunning(true)
    setSummary(null)
    abortRefs.current = []

    const initialResults: ResultState[] = selected.map((s) => {
      const def = OPENROUTER_MODELS.find((m) => m.id === s.modelId)
      return {
        providerId: def?.provider ?? s.modelId,
        modelId: s.modelId,
        text: '',
        status: 'loading',
        startTime: Date.now(),
      }
    })
    setResults(initialResults)

    const finalResults: ResultState[] = [...initialResults]

    const orKey = readStoredKey(OR_KEY_STORAGE)
    if (!orKey) {
      setResults(initialResults.map((r) => ({ ...r, status: 'error', error: 'No OpenRouter key configured.' })))
      setRunning(false)
      return
    }

    await Promise.all(
      selected.map(async (sel, i) => {
        const ac = new AbortController()
        abortRefs.current.push(ac)

        try {
          const { url, headers, body } = buildRequest(
            sel.modelId, prompt.trim(),
            systemCtxOpen ? systemCtx : undefined
          )
          const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ac.signal })
          if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}))
            throw new Error((errData as Record<string, Record<string, string>>)?.error?.message || `HTTP ${resp.status}`)
          }
          const data = await resp.json()
          const { text, tokens } = extractResponse(data as Record<string, unknown>)
          const endTime = Date.now()
          finalResults[i] = { ...finalResults[i], status: 'done', text, tokens, endTime }
        } catch (err: unknown) {
          if ((err as Error).name === 'AbortError') return
          finalResults[i] = { ...finalResults[i], status: 'error', error: (err as Error).message, endTime: Date.now() }
        }
        setResults([...finalResults])
      })
    )

    setRunning(false)

    logEvent('MODELS_COMPARED', {
      models: finalResults.map((r) => r.modelId),
      succeeded: finalResults.filter((r) => r.status === 'done').length,
      failed: finalResults.filter((r) => r.status === 'error').length,
      promptLength: prompt.trim().length,
      module: 'model-comparison',
    })

    // Save to history
    const comparison: StoredComparison = {
      id: Date.now().toString(),
      prompt: prompt.trim(),
      timestamp: Date.now(),
      results: finalResults
        .filter((r) => r.status === 'done')
        .map((r) => ({
          provider: r.providerId,
          model: r.modelId,
          response: r.text,
          responseTimeMs: r.startTime && r.endTime ? r.endTime - r.startTime : 0,
          tokens: r.tokens ?? 0,
        })),
      votes: {},
      summary: {},
    }
    const newHistory = [comparison, ...history].slice(0, 20)
    setHistory(newHistory)
    localStorage.setItem('enginguity_comparisons', JSON.stringify(newHistory))

    // Auto-summary if multiple done
    const done = finalResults.filter((r) => r.status === 'done')
    if (done.length > 1) generateSummary(done)
  }, [prompt, selected, running, systemCtx, systemCtxOpen, history])

  useEffect(() => {
    handleRunRef.current = handleRun
  }, [handleRun])



  const exportMarkdown = () => {
    const md = [
      `# Model Comparison Report`,
      `**Prompt:** ${prompt}`,
      `**Date:** ${new Date().toISOString()}`,
      '',
      ...results.filter((r) => r.status === 'done').map((r) => [
        `## ${OPENROUTER_MODELS.find((m) => m.id === r.modelId)?.name ?? r.modelId}`,
        `**Response time:** ${r.endTime && r.startTime ? r.endTime - r.startTime : '?'}ms | **Tokens:** ${r.tokens ?? '?'}`,
        '',
        r.text,
        '',
      ].join('\n')),
    ].join('\n')

    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }))
    a.download = `comparison-${Date.now()}.md`
    a.click()
  }

  const cols = selected.length === 1 ? 1 : selected.length === 2 ? 2 : selected.length === 3 ? 3 : 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GitCompare size={18} color="var(--text-muted)" />
            <h1 style={{ fontFamily: "'DM Sans Variable', 'DM Sans', system-ui, sans-serif", fontSize: 16, fontWeight: 500, color: 'var(--text)', margin: 0 }}>
              Model Comparison
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShortcutsOpen(true)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-muted)', padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
              <Keyboard size={13} />
            </button>
            <button onClick={() => setHistoryOpen(!historyOpen)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-muted)', padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
              <History size={13} /> History
            </button>
            {results.some((r) => r.status === 'done') && (
              <button onClick={exportMarkdown} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-muted)', padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                <Download size={13} /> Export
              </button>
            )}
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          Run any prompt across multiple models simultaneously
        </p>
      </div>

      <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <ModelComparisonLayout isDesktop={isDesktop}>
          {/* Left Panel: Prompt + Model selector + Run button */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            height: isDesktop ? '100%' : 'auto',
            overflowY: isDesktop ? 'auto' : 'visible',
            paddingRight: isDesktop ? 12 : 0,
            boxSizing: 'border-box'
          }}>
            {/* Prompt area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)', letterSpacing: 0 }}>
            Engineering Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe a circuit, ask a simulation question, paste code to review, ask for design feedback..."
            style={{
              minHeight: 120, padding: '12px 14px', borderRadius: 8,
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 13, fontFamily: "'DM Sans Variable', 'DM Sans', system-ui, sans-serif",
              resize: 'vertical', outline: 'none', lineHeight: 1.6,
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
          />

          {/* System context toggle */}
          <button
            onClick={() => setSystemCtxOpen((o) => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", alignSelf: 'flex-start', padding: 0 }}
          >
            {systemCtxOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            System Context
          </button>
          {systemCtxOpen && (
            <textarea
              value={systemCtx}
              onChange={(e) => setSystemCtx(e.target.value)}
              placeholder="Project context, constraints, domain knowledge..."
              rows={3}
              style={{
                padding: '10px 12px', borderRadius: 6,
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 12, fontFamily: "'DM Sans Variable', 'DM Sans', system-ui, sans-serif", resize: 'vertical', outline: 'none',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
          )}

          {/* Preset prompts */}
          <button
            onClick={() => setPresetsOpen((o) => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", alignSelf: 'flex-start', padding: 0 }}
          >
            {presetsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            Preset Prompts
          </button>
          {presetsOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(PRESETS).map(([cat, prompts]) => (
                <div key={cat}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0, marginBottom: 5 }}>{cat}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {prompts.map((p, i) => (
                      <button key={i} onClick={() => { setPrompt(p); setPresetsOpen(false); }}
                        style={{ textAlign: 'left', padding: '6px 10px', borderRadius: 5, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Model selector */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)', letterSpacing: 0 }}>
              Models ({selected.length} selected)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setSelected(OPENROUTER_MODELS.map((m) => ({ modelId: m.id })))
                }}
                style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0 }}
              >
                Select All
              </button>
              <button onClick={() => setSelected([])} style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                Clear
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Object.entries(
              OPENROUTER_MODELS.reduce((acc, m) => {
                acc[m.provider] = acc[m.provider] || []
                acc[m.provider].push(m)
                return acc;
              }, {} as Record<string, typeof OPENROUTER_MODELS>)
            ).map(([providerName, providerModels]) => (
              <div key={providerName} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {providerName}
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {providerModels.map((model) => {
                    const sel = isSelected(model.id)
                    return (
                      <button
                        key={model.id}
                        onClick={() => toggleModel(model.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          background: sel ? 'var(--accent-glow)' : 'var(--surface)',
                          border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                          color: sel ? 'var(--text)' : 'var(--text-muted)',
                          fontSize: 11,
                          fontFamily: "'JetBrains Mono', monospace",
                          transition: 'all 120ms ease',
                        }}
                      >
                        {model.name}
                        <TierBadge tier={model.tier} />
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Run button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={running ? cancelAll : handleRun}
            disabled={!running && (!prompt.trim() || selected.length === 0)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 20px', borderRadius: 6,
              background: 'transparent',
              border: `1px solid ${running ? 'var(--border-bright)' : 'var(--accent)'}`,
              color: running ? 'var(--text-muted)' : 'var(--accent)',
              fontFamily: "'DM Sans Variable', 'DM Sans', system-ui, sans-serif", fontSize: 13, fontWeight: 400, cursor: 'pointer',
              transition: 'background 120ms ease',
              opacity: !running && (!prompt.trim() || selected.length === 0) ? 0.4 : 1,
            }}
          >
            {running ? <><Square size={14} /> Cancel</> : <><Play size={14} /> Run Comparison</>}
          </button>
          {running && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
              Running across {selected.length} models...
            </span>
          )}
          {results.some((r) => r.status === 'done') && (
            <button
              onClick={() => setDiffMode((d) => !d)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 6,
                background: diffMode ? 'var(--surface-2)' : 'transparent',
                border: `1px solid ${diffMode ? 'var(--border-bright)' : 'var(--border)'}`,
                color: diffMode ? 'var(--text)' : 'var(--text-muted)',
                fontFamily: "'DM Sans Variable', 'DM Sans', system-ui, sans-serif", fontSize: 13, cursor: 'pointer',
                transition: 'background 120ms ease, border-color 120ms ease',
              }}
            >
              <BarChart2 size={13} /> Show Differences
            </button>
          )}
          </div>
        </div>

          {/* Right Panel: Results + Summary */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            height: isDesktop ? '100%' : 'auto',
            overflowY: isDesktop ? 'auto' : 'visible',
            paddingLeft: isDesktop ? 12 : 0,
            boxSizing: 'border-box'
          }}>
            {results.length === 0 ? (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontFamily: "'DM Sans Variable', 'DM Sans', system-ui, sans-serif",
                fontSize: 13,
                textAlign: 'center',
                padding: 40,
                border: '1px dashed var(--border)',
                borderRadius: 10,
                background: 'rgba(0,0,0,0.05)',
                margin: '20px 0'
              }}>
                <GitCompare size={32} style={{ color: 'var(--accent)', opacity: 0.6, marginBottom: 12 }} />
                <span>Run a comparison to view results side-by-side.</span>
              </div>
            ) : (
              <>
                {/* Diff legend */}
                {diffMode && (
                  <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: "'DM Sans Variable', 'DM Sans', system-ui, sans-serif", padding: '6px 12px', background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)', alignSelf: 'flex-start', color: 'var(--text-muted)' }}>
                    <span style={{ background: 'rgba(255,255,255,0.04)', padding: '1px 6px', borderRadius: 3 }}>Shared</span>
                    <span style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 6px', borderRadius: 3 }}>Unique</span>
                    <span>Contradiction</span>
                  </div>
                )}

                {/* Results grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gap: 14,
                  overflowX: cols > 2 ? 'auto' : undefined,
                }}>
                  {results.map((r, i) => (
                    <ResultCard
                      key={`${r.providerId}-${r.modelId}`}
                      result={r}
                      index={i}
                      diffMode={diffMode}
                      allResults={results}
                      votes={votes}
                      onVote={(key, v) => setVotes((prev) => ({ ...prev, [key]: v }))}
                      onPin={(text) => {
                        const existing = localStorage.getItem('enginguity_pinned_responses') || ''
                        localStorage.setItem('enginguity_pinned_responses', existing + '\n\n---\n\n' + text)
                        alert('Pinned to project context.')
                      }}
                    />
                  ))}
                </div>
              </>
            )}

        {/* Summary panel */}
        {summary && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontFamily: "'DM Sans Variable', 'DM Sans', system-ui, sans-serif", fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
              Analysis
            </div>
            {[
              { key: 'consensus', label: 'Consensus' },
              { key: 'differences', label: 'Differences' },
              { key: 'recommended', label: 'Most accurate' },
              { key: 'warnings', label: 'Warnings' },
            ].map(({ key, label }) => (
              summary[key] ? (
                <div key={key}>
                  <div style={{ fontFamily: "'DM Sans Variable', 'DM Sans', system-ui, sans-serif", fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{label}</div>
                  <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>{summary[key]}</p>
                </div>
              ) : null
            ))}
          </div>
        )}
          </div>
        </ModelComparisonLayout>
      </div>

      {/* History panel */}
      {historyOpen && (
        <div style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, width: 360,
          background: 'var(--surface)', borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', zIndex: 8000,
          boxShadow: '-4px 0 24px rgba(0,0,0,.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600 }}>Comparison History</span>
            <button onClick={() => setHistoryOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {history.map((h) => (
              <div key={h.id} onClick={() => {
                setPrompt(h.prompt)
                setHistoryOpen(false)
              }} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <p style={{ fontSize: 12, color: 'var(--text)', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.prompt}</p>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                  {new Date(h.timestamp).toLocaleString()} · {h.results.length} models
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shortcuts overlay */}
      {shortcutsOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setShortcutsOpen(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 28, minWidth: 320 }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>Keyboard Shortcuts</div>
            {[
              ['⌘ + Enter', 'Run comparison'],
              ['⌘ + D', 'Toggle diff view'],
              ['Escape', 'Cancel / close'],
              ['1 – 9', 'Focus result card N'],
              ['?', 'Show shortcuts'],
            ].map(([key, desc]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <kbd style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border-bright)' }}>{key}</kbd>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
