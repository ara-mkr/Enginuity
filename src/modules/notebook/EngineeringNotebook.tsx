import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Plus, Search, Download, GitBranch, FlaskConical, BarChart2,
  Eye, AlertTriangle, Bookmark, FileText, ChevronDown, ChevronUp,
  Pencil, Trash2, ExternalLink, Maximize2, Minimize2,
} from 'lucide-react'
import JSZip from 'jszip'
import { EntryEditor } from './EntryEditor'
import { AIInsightsPanel } from './AIInsightsPanel'
import type { NotebookEntry, EntryType, ProblemEntry } from './types'
import { ENTRY_META, STORAGE_KEY } from './types'
import { logEvent } from '../../engine/eventLog'
import { useFocusMode } from '../../context/FocusModeContext'
import { useProbeContext } from '../../hooks/useProbeContext'

// ── Persistence ───────────────────────────────────────────────────────────────

function loadEntries(): NotebookEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function saveEntries(entries: NotebookEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<EntryType, React.ReactNode> = {
  DECISION:    <GitBranch size={14} />,
  EXPERIMENT:  <FlaskConical size={14} />,
  TEST_RESULT: <BarChart2 size={14} />,
  OBSERVATION: <Eye size={14} />,
  PROBLEM:     <AlertTriangle size={14} />,
  REFERENCE:   <Bookmark size={14} />,
  NOTE:        <FileText size={14} />,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getEntryPreview(e: NotebookEntry): string {
  if ('description' in e) return (e as { description: string }).description
  if ('content' in e) return (e as { content: string }).content
  if ('hypothesis' in e) return (e as { hypothesis: string }).hypothesis
  if ('summary' in e) return (e as { summary: string }).summary
  if ('context' in e) return (e as { context: string }).context
  return ''
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: 'rgba(0,200,255,0.25)', color: 'var(--text)', borderRadius: 2 }}>{part}</mark>
      : part
  )
}

function matchesSearch(e: NotebookEntry, q: string): boolean {
  if (!q) return true
  const haystack = JSON.stringify(e).toLowerCase()
  return haystack.includes(q.toLowerCase())
}

function dateInRange(date: string, range: string): boolean {
  const d = new Date(date).getTime()
  const now = Date.now()
  if (range === '7d') return d > now - 7 * 86400000
  if (range === '30d') return d > now - 30 * 86400000
  if (range === '3m') return d > now - 90 * 86400000
  return true
}

// ── Export ────────────────────────────────────────────────────────────────────

async function exportMarkdownZip(entries: NotebookEntry[]) {
  const zip = new JSZip()
  for (const e of entries) {
    const folder = zip.folder(e.type) ?? zip
    const lines = [
      `# ${e.title}`,
      `**Type:** ${e.type}  `,
      `**Date:** ${e.date}  `,
      `**Tags:** ${e.tags.join(', ')}  `,
      e.linkedModule ? `**Module:** ${e.linkedModule}  ` : '',
      '',
      ...Object.entries(e)
        .filter(([k]) => !['id', 'type', 'title', 'tags', 'date', 'linkedModule', 'attachedFiles'].includes(k))
        .map(([k, v]) => `### ${k}\n${Array.isArray(v) ? JSON.stringify(v, null, 2) : v}`),
    ]
    folder.file(`${e.id.slice(0, 8)}-${e.title.replace(/[^a-z0-9]/gi, '_').slice(0, 40)}.md`, lines.join('\n'))
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'enginguity_notebook.zip'
  a.click()
}

function exportJSON(entries: NotebookEntry[]) {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'enginguity_notebook.json'
  a.click()
}

async function syncToGist(entries: NotebookEntry[], apiKey: string): Promise<string> {
  const existingId = localStorage.getItem('enginguity_gist_id')
  const body = {
    description: 'ENGINGUITY Engineering Notebook',
    public: false,
    files: { 'notebook.json': { content: JSON.stringify(entries, null, 2) } },
  }
  const url = existingId ? `https://api.github.com/gists/${existingId}` : 'https://api.github.com/gists'
  const method = existingId ? 'PATCH' : 'POST'
  const res = await fetch(url, {
    method, headers: { Authorization: `token ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json() as { id: string; html_url: string }
  localStorage.setItem('enginguity_gist_id', data.id)
  return data.html_url
}

// ── Timeline Entry Card ───────────────────────────────────────────────────────

function TimelineCard({
  entry, search, expanded, onToggle, onEdit, onDelete,
}: {
  entry: NotebookEntry
  search: string
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const meta = ENTRY_META[entry.type]
  const preview = getEntryPreview(entry).slice(0, 160)

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* Left: colored line + icon */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32, flexShrink: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `${meta.color}18`, border: `2px solid ${meta.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: meta.color, flexShrink: 0,
          boxShadow: 'none', textShadow: 'none',
        }}>
          {TYPE_ICONS[entry.type]}
        </div>
        <div style={{ flex: 1, width: 2, background: `${meta.color}30`, marginTop: 4, boxShadow: 'none' }} />
      </div>

      {/* Right: card */}
      <div style={{
        flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, marginBottom: 16, overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}>
        {/* Header */}
        <div
          style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}
          onClick={onToggle}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9,  
                color: meta.color, background: `${meta.color}18`, padding: '2px 6px', borderRadius: 4,
                boxShadow: 'none', textShadow: 'none',
              }}>
                {meta.label}
              </span>
              {'status' in entry && (
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 9,  
                  color: (entry as ProblemEntry).status === 'solved' ? '#7aaa8a' : (entry as ProblemEntry).status === 'investigating' ? '#b09470' : '#b08080',
                  padding: '2px 6px', borderRadius: 4,
                  background: (entry as ProblemEntry).status === 'solved' ? 'rgba(0,230,118,0.1)' : (entry as ProblemEntry).status === 'investigating' ? 'rgba(255,171,64,0.1)' : 'rgba(255,107,107,0.1)',
                }}>
                  {(entry as ProblemEntry).status}
                </span>
              )}
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)' }}>
                {new Date(entry.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>
            <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: 'var(--text)', margin: 0, fontWeight: 600 }}>
              {highlight(entry.title, search)}
            </h3>
          </div>
          {expanded ? <ChevronUp size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 4 }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 4 }} />}
        </div>

        {/* Preview (collapsed) */}
        {!expanded && preview && (
          <div style={{ padding: '0 16px 10px' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5, WebkitLineClamp: 2, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical' }}>
              {highlight(preview, search)}{preview.length >= 160 ? '…' : ''}
            </p>
          </div>
        )}

        {/* Footer (always) */}
        <div style={{ padding: '6px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {entry.tags.map((t) => (
              <span key={t} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)', background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 10, border: '1px solid var(--border)' }}>
                #{t}
              </span>
            ))}
            {entry.linkedModule && (
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--accent)', background: 'rgba(0,200,255,0.08)', padding: '1px 6px', borderRadius: 10 }}>
                {entry.linkedModule}
              </span>
            )}
          </div>
          {!expanded && (
            <button onClick={(e) => { e.stopPropagation(); onToggle() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)' }}>
              Expand
            </button>
          )}
        </div>

        {/* Expanded body */}
        {expanded && (
          <div style={{ borderTop: '1px solid var(--border)', padding: 16 }}>
            <ExpandedEntry entry={entry} search={search} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn" onClick={onEdit} style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11 }}>
                <Pencil size={11} /> Edit
              </button>
              <button className="btn" onClick={onDelete}
                style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, borderColor: 'rgba(255,107,107,0.3)', color: '#b08080' }}>
                <Trash2 size={11} /> Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ExpandedEntry({ entry, search }: { entry: NotebookEntry; search: string }) {
  const skip = new Set(['id', 'type', 'title', 'tags', 'date', 'linkedModule', 'attachedFiles'])

  const fields = Object.entries(entry).filter(([k]) => !skip.has(k))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {fields.map(([key, value]) => {
        if (Array.isArray(value)) {
          if (key === 'measurements') {
            return (
              <div key={key}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)',   marginBottom: 6 }}>Measurements</div>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead><tr>{['Parameter', 'Value', 'Unit'].map((h) => <th key={h} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(value as Array<{ param: string; value: string; unit: string }>).map((m, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '4px 8px', color: 'var(--text)' }}>{m.param}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '4px 8px', color: 'var(--accent)' }}>{m.value}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '4px 8px', color: 'var(--text-muted)' }}>{m.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
          return null
        }
        if (typeof value === 'boolean') {
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: value ? '#7aaa8a' : '#b08080' }}>{value ? '✓ Yes' : '✗ No'}</span>
            </div>
          )
        }
        if (typeof value === 'string' && value) {
          const isUrl = key === 'url' && value.startsWith('http')
          return (
            <div key={key}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize',  marginBottom: 4 }}>
                {key.replace(/([A-Z])/g, ' $1')}
              </div>
              {isUrl ? (
                <a href={value} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontSize: 13 }}>
                  <ExternalLink size={12} /> {value}
                </a>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {highlight(value, search)}
                </p>
              )}
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function EngineeringNotebook() {
  const { isFocusMode, toggleFocusMode } = useFocusMode()
  const [entries, setEntries] = useState<NotebookEntry[]>(loadEntries)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<EntryType[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [dateRange, setDateRange] = useState('all')
  const [moduleFilter, setModuleFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingEntry, setEditingEntry] = useState<NotebookEntry | undefined>(undefined)
  const [showEditor, setShowEditor] = useState(false)
  const [gistKey, setGistKey] = useState('')
  const [gistMsg, setGistMsg] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const entryRefs = useRef<Record<string, HTMLDivElement>>({})

  useProbeContext('notebook', {
    entryCount: entries.length,
    openProblems: entries.filter((e) => e.type === 'PROBLEM' && (e as ProblemEntry).status !== 'solved').length,
    search: search || null,
    expandedEntryTitle: entries.find((e) => e.id === expandedId)?.title ?? null,
    editing: showEditor,
  })

  // Cmd/Ctrl+F focuses search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function persist(updated: NotebookEntry[]) {
    setEntries(updated)
    saveEntries(updated)
  }

  function handleSave(entry: NotebookEntry) {
    const existing = entries.find((e) => e.id === entry.id)
    const updated = existing
      ? entries.map((e) => e.id === entry.id ? entry : e)
      : [entry, ...entries]
    persist(updated)

    // Log events
    if (!existing) {
      logEvent('NOTEBOOK_ENTRY_ADDED', {
        type: entry.type,
        title: entry.title,
        module: 'notebook'
      })
    }

    if (entry.type === 'PROBLEM' && (entry as ProblemEntry).status === 'solved') {
      const wasSolvedBefore = existing && existing.type === 'PROBLEM' && (existing as ProblemEntry).status === 'solved'
      if (!wasSolvedBefore) {
        logEvent('NOTEBOOK_PROBLEM_SOLVED', {
          title: entry.title,
          module: 'notebook'
        })
      }
    }

    setShowEditor(false)
    setEditingEntry(undefined)
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this entry?')) return
    persist(entries.filter((e) => e.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  function jumpToEntry(id: string) {
    setExpandedId(id)
    setTimeout(() => {
      entryRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }

  const allTags = useMemo(() => [...new Set(entries.flatMap((e) => e.tags))], [entries])
  const allModules = useMemo(() => [...new Set(entries.map((e) => e.linkedModule).filter(Boolean))], [entries]) as string[]

  const filtered = useMemo(() => entries.filter((e) => {
    if (typeFilter.length && !typeFilter.includes(e.type)) return false
    if (statusFilter && (!('status' in e) || (e as ProblemEntry).status !== statusFilter)) return false
    if (dateRange !== 'all' && !dateInRange(e.date, dateRange)) return false
    if (moduleFilter && e.linkedModule !== moduleFilter) return false
    if (tagFilter && !e.tags.includes(tagFilter)) return false
    if (!matchesSearch(e, search)) return false
    return true
  }), [entries, typeFilter, statusFilter, dateRange, moduleFilter, tagFilter, search])

  async function handleGistSync() {
    if (!gistKey) { setGistMsg('Enter a GitHub personal access token'); return }
    try {
      const url = await syncToGist(entries, gistKey)
      setGistMsg(`Synced → ${url}`)
    } catch (e) {
      setGistMsg(`Error: ${e instanceof Error ? e.message : 'Sync failed'}`)
    }
  }

  return (
    <div style={{ padding: isFocusMode ? '16px 20px' : '28px 32px', maxWidth: 900, margin: '0 auto', transition: 'padding 200ms ease' }}>
      {/* Header */}
      <div
        className="module-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isFocusMode ? 0 : 24,
          overflow: 'hidden',
        }}
      >
        <div>
          <h1 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            Engineering Notebook
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            {entries.length} entries — structured journal with AI analysis
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn" onClick={() => exportMarkdownZip(entries)} style={{ fontSize: 11, display: 'flex', gap: 4, alignItems: 'center' }}>
              <Download size={11} /> MD
            </button>
            <button className="btn" onClick={() => exportJSON(entries)} style={{ fontSize: 11, display: 'flex', gap: 4, alignItems: 'center' }}>
              <Download size={11} /> JSON
            </button>
          </div>
          <button className="btn" onClick={() => { setEditingEntry(undefined); setShowEditor(true) }}
            style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(0,200,255,0.1)', borderColor: 'rgba(0,200,255,0.3)', color: 'var(--accent)' }}>
            <Plus size={14} /> New Entry
          </button>
          <button
            onClick={toggleFocusMode}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 4,
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
            title={isFocusMode ? "Exit Focus Mode (Esc)" : "Focus Mode (Cmd+Shift+F)"}
          >
            {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* AI Surface panel */}
      {!isFocusMode && (
        <AIInsightsPanel entries={entries} onJumpToEntry={jumpToEntry} />
      )}

      {/* Filter bar */}
      {!isFocusMode && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input ref={searchRef} className="input" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all entries… (⌘F)" style={{ paddingLeft: 30, width: '100%' }} />
          </div>

          {/* Type filter */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(Object.keys(ENTRY_META) as EntryType[]).map((t) => {
              const meta = ENTRY_META[t]
              const active = typeFilter.includes(t)
              return (
                <button key={t} onClick={() => setTypeFilter(active ? typeFilter.filter((x) => x !== t) : [...typeFilter, t])}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
                    borderRadius: 20, border: `1px solid ${active ? meta.color : 'var(--border)'}`,
                    background: active ? `${meta.color}18` : 'transparent',
                    color: active ? meta.color : 'var(--text-muted)',
                    cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, transition: 'all 0.15s',
                    boxShadow: 'none', textShadow: 'none',
                  }}>
                  {TYPE_ICONS[t]} {meta.label}
                </button>
              )
            })}
          </div>

          {/* Row 2: status, date, module, tags */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input" style={{ width: 140 }}>
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="solved">Solved</option>
            </select>
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="input" style={{ width: 130 }}>
              <option value="all">All time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="3m">Last 3 months</option>
            </select>
            <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="input" style={{ width: 150 }}>
              <option value="">All modules</option>
              {allModules.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            {allTags.length > 0 && (
              <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="input" style={{ width: 140 }}>
                <option value="">All tags</option>
                {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
              </select>
            )}
            {(typeFilter.length || statusFilter || dateRange !== 'all' || moduleFilter || tagFilter || search) ? (
              <button className="btn" onClick={() => { setTypeFilter([]); setStatusFilter(''); setDateRange('all'); setModuleFilter(''); setTagFilter(''); setSearch('') }}
                style={{ fontSize: 11 }}>
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Tag cloud */}
      {!isFocusMode && allTags.length > 0 && !tagFilter && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {allTags.slice(0, 20).map((t) => (
            <button key={t} onClick={() => setTagFilter(t)}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)', background: 'var(--surface)', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer' }}>
              #{t}
            </button>
          ))}
        </div>
      )}

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: 14, marginBottom: 16 }}>
            {entries.length === 0 ? 'Your notebook is empty.' : 'No entries match the current filters.'}
          </p>
          {entries.length === 0 && (
            <button className="btn" onClick={() => { setEditingEntry(undefined); setShowEditor(true) }}
              style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <Plus size={13} /> Create your first entry
            </button>
          )}
        </div>
      ) : (
        <div style={{ paddingTop: 8 }}>
          {filtered.map((entry) => (
            <div key={entry.id} ref={(el) => { if (el) entryRefs.current[entry.id] = el }}>
              <TimelineCard
                entry={entry}
                search={search}
                expanded={expandedId === entry.id}
                onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                onEdit={() => { setEditingEntry(entry); setShowEditor(true) }}
                onDelete={() => handleDelete(entry.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Gist sync */}
      <div style={{ marginTop: 32, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',   marginBottom: 10 }}>
          Sync to GitHub Gist
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" value={gistKey} onChange={(e) => setGistKey(e.target.value)}
            placeholder="GitHub personal access token (gist scope)" type="password" style={{ flex: 1 }} />
          <button className="btn" onClick={handleGistSync} style={{ whiteSpace: 'nowrap' }}>Sync</button>
        </div>
        {gistMsg && (
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: gistMsg.startsWith('Error') ? '#b08080' : '#7aaa8a', marginTop: 8 }}>
            {gistMsg.startsWith('Synced') ? (
              <a href={gistMsg.split('→ ')[1]} target="_blank" rel="noopener noreferrer" style={{ color: '#7aaa8a' }}>{gistMsg}</a>
            ) : gistMsg}
          </p>
        )}
      </div>

      {/* Editor modal */}
      {showEditor && (
        <EntryEditor
          entry={editingEntry}
          onSave={handleSave}
          onClose={() => { setShowEditor(false); setEditingEntry(undefined) }}
        />
      )}
    </div>
  )
}

export default EngineeringNotebook
