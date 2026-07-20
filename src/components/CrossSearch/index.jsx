import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import {
  buildSearchIndex,
  searchIndex,
  getModuleIcon,
  getSuggestions,
} from '../../engine/searchIndex'

// ─── Highlighted title ─────────────────────────────────────────────────────────

function HighlightedTitle({ title, query }) {
  if (!query) return <span>{title}</span>
  const lower = title.toLowerCase()
  const qLower = query.toLowerCase()
  const idx = lower.indexOf(qLower)
  if (idx === -1) return <span>{title}</span>
  return (
    <span>
      {title.slice(0, idx)}
      <span
        style={{
          background: 'rgba(148,165,186,0.18)',
          borderRadius: 2,
          padding: '0 1px',
        }}
      >
        {title.slice(idx, idx + query.length)}
      </span>
      {title.slice(idx + query.length)}
    </span>
  )
}

// ─── Relative date ─────────────────────────────────────────────────────────────

function relDate(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  if (diff < 3_600_000)   return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000)  return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return ''
}

// ─── Main component ────────────────────────────────────────────────────────────

export function CrossSearch() {
  const [open, setOpen]           = useState(false)
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [suggestions, setSuggestions] = useState([])

  const indexRef  = useRef([])
  const inputRef  = useRef(null)
  const navigate  = useNavigate()

  // ── Open / close helpers ──

  const openSearch = useCallback((initialQuery = '') => {
    indexRef.current = buildSearchIndex()
    setSuggestions(getSuggestions(indexRef.current))
    const q = initialQuery || ''
    setQuery(q)
    setResults(q ? searchIndex(q, indexRef.current) : [])
    setSelectedIdx(0)
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 40)
  }, [])

  const closeSearch = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults([])
    setSelectedIdx(0)
  }, [])

  // ── Event listener: external trigger ──

  useEffect(() => {
    const handle = (e) => openSearch(e?.detail?.query || '')
    window.addEventListener('enginguity_open_cross_search', handle)
    return () => window.removeEventListener('enginguity_open_cross_search', handle)
  }, [openSearch])

  // ── Cmd/Ctrl+F global shortcut (capture phase to override browser find) ──

  useEffect(() => {
    const handle = (e) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'f' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        e.stopPropagation()
        open ? closeSearch() : openSearch()
      }
      if (e.key === 'Escape' && open) closeSearch()
    }
    window.addEventListener('keydown', handle, true)
    return () => window.removeEventListener('keydown', handle, true)
  }, [open, openSearch, closeSearch])

  // ── Search on query change ──

  useEffect(() => {
    if (!open) return
    const t = query.trim()
    setResults(t ? searchIndex(t, indexRef.current) : [])
    setSelectedIdx(0)
  }, [query, open])

  // ── Arrow-key navigation + Enter ──

  useEffect(() => {
    if (!open || results.length === 0) return
    const handle = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx(i => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (results[selectedIdx]) handleNavigate(results[selectedIdx])
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [open, results, selectedIdx])

  // ── Navigate to result ──

  const handleNavigate = useCallback((item) => {
    closeSearch()
    navigate(item.route)
    if (item.highlightEvent) {
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent(item.highlightEvent.name, { detail: item.highlightEvent.detail })
        )
      }, 320)
    }
  }, [navigate, closeSearch])

  // ── Group results by module ──

  const grouped = {}
  results.forEach(item => {
    if (!grouped[item.moduleLabel]) grouped[item.moduleLabel] = []
    grouped[item.moduleLabel].push(item)
  })

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeSearch}
        style={{
          position:       'fixed',
          inset:          0,
          background:     'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          zIndex:         9998,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position:      'fixed',
          top:           72,
          left:          '50%',
          transform:     'translateX(-50%)',
          width:         680,
          maxWidth:      'calc(100vw - 32px)',
          background:    'var(--surface)',
          border:        '1px solid var(--border-bright)',
          borderRadius:  12,
          boxShadow:     '0 24px 64px rgba(0,0,0,0.72)',
          zIndex:        9999,
          display:       'flex',
          flexDirection: 'column',
          maxHeight:     'calc(100vh - 120px)',
          overflow:      'hidden',
          fontFamily:    "'DM Sans Variable', 'DM Sans', 'Geist', sans-serif",
        }}
      >
        {/* ── Input row ── */}
        <div
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          10,
            padding:      '12px 16px',
            borderBottom: '1px solid var(--border)',
            flexShrink:   0,
          }}
        >
          <Search size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search everything — notebook, BOM, files, ideas, canvas…"
            style={{
              flex:       1,
              background: 'transparent',
              border:     'none',
              outline:    'none',
              fontSize:   15,
              color:      'var(--text)',
              fontFamily: 'inherit',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                background: 'none',
                border:     'none',
                color:      'var(--text-dim)',
                cursor:     'pointer',
                padding:    2,
                flexShrink: 0,
                display:    'flex',
              }}
            >
              <X size={14} />
            </button>
          )}
          <kbd
            style={{
              fontSize:     11,
              color:        'var(--text-dim)',
              flexShrink:   0,
              background:   'var(--bg-2)',
              border:       '1px solid var(--border)',
              borderRadius: 3,
              padding:      '1px 5px',
            }}
          >
            Esc
          </kbd>
        </div>

        {/* ── Results area ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* Empty query → show recent suggestions */}
          {!query.trim() && (
            <div style={{ padding: '16px 20px' }}>
              {suggestions.length > 0 ? (
                <>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    Recent
                  </div>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(s)}
                      style={{
                        display:      'block',
                        width:        '100%',
                        textAlign:    'left',
                        padding:      '8px 10px',
                        background:   'none',
                        border:       'none',
                        borderRadius: 6,
                        fontSize:     13,
                        color:        'var(--text-muted)',
                        cursor:       'pointer',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      {s}
                    </button>
                  ))}
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', padding: '24px 0' }}>
                  Start typing to search across all modules
                </div>
              )}
            </div>
          )}

          {/* Query but no results */}
          {query.trim() && results.length === 0 && (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>
                No results for "{query}"
              </div>
              {suggestions.length > 0 && (
                <>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>Try:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                    {suggestions.slice(0, 4).map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setQuery(s)}
                        style={{
                          padding:      '4px 10px',
                          background:   'var(--bg-2)',
                          border:       '1px solid var(--border)',
                          borderRadius: 4,
                          fontSize:     12,
                          color:        'var(--text-muted)',
                          cursor:       'pointer',
                        }}
                      >
                        {s.length > 32 ? s.slice(0, 32) + '…' : s}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Results grouped by module */}
          {results.length > 0 && Object.entries(grouped).map(([moduleLabel, items]) => (
            <div key={moduleLabel}>
              {/* Group header */}
              <div
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  padding:        '8px 16px 2px',
                }}
              >
                <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {moduleLabel}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{items.length}</span>
              </div>

              {/* Items */}
              {items.map(item => {
                const globalIdx  = results.indexOf(item)
                const isSelected = globalIdx === selectedIdx
                const rel        = relDate(item.date)

                return (
                  <div
                    key={item.id}
                    onClick={() => handleNavigate(item)}
                    onMouseEnter={() => setSelectedIdx(globalIdx)}
                    style={{
                      height:     52,
                      display:    'flex',
                      alignItems: 'center',
                      gap:        12,
                      padding:    '0 16px',
                      cursor:     'pointer',
                      background: isSelected ? 'var(--bg-2)' : 'transparent',
                      transition: 'background 60ms ease',
                    }}
                  >
                    {/* Icon */}
                    <div style={{ width: 28, textAlign: 'center', fontSize: 15, flexShrink: 0 }}>
                      {getModuleIcon(item.module)}
                    </div>

                    {/* Title + preview */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize:     14,
                          color:        'var(--text)',
                          overflow:     'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace:   'nowrap',
                        }}
                      >
                        <HighlightedTitle title={item.title} query={query.trim()} />
                      </div>
                      {item.preview && (
                        <div
                          style={{
                            fontSize:     12,
                            color:        'var(--text-dim)',
                            overflow:     'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace:   'nowrap',
                            marginTop:    1,
                          }}
                        >
                          {item.preview}
                        </div>
                      )}
                    </div>

                    {/* Module label + date */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{item.moduleLabel}</span>
                      {rel && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{rel}</span>}
                    </div>

                    {/* Arrow indicator */}
                    <div style={{ color: isSelected ? 'var(--text-muted)' : 'transparent', fontSize: 12, flexShrink: 0, transition: 'color 60ms' }}>
                      →
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            borderTop:  '1px solid var(--border)',
            padding:    '6px 16px',
            display:    'flex',
            alignItems: 'center',
            gap:        16,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-dim)' }}>
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>⌘F toggle</span>
          </div>
          {results.length > 0 && (
            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)' }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
