import { useState, useMemo } from 'react'
import { Search, Download, GitCompare, Trash2, X } from 'lucide-react'
import type { SavedComponent, ComponentData } from './types'

const STORAGE_KEY = 'enginguity_components'

// eslint-disable-next-line react-refresh/only-export-components -- shared storage helper, not worth a separate file
export function loadLibrary(): SavedComponent[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

// eslint-disable-next-line react-refresh/only-export-components -- shared storage helper, not worth a separate file
export function saveToLibrary(data: ComponentData, fileName: string): SavedComponent {
  const lib = loadLibrary()
  const entry: SavedComponent = {
    id: crypto.randomUUID(),
    data,
    fileName,
    dateAdded: new Date().toISOString(),
    pinnedNotes: [],
  }
  lib.unshift(entry)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lib))
  return entry
}

// eslint-disable-next-line react-refresh/only-export-components -- shared storage helper, not worth a separate file
export function removeFromLibrary(id: string) {
  const lib = loadLibrary().filter((c) => c.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lib))
}

function exportJSON(lib: SavedComponent[]) {
  const blob = new Blob([JSON.stringify(lib, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'enginguity_components.json'
  a.click()
}

interface CompareModalProps {
  a: SavedComponent
  b: SavedComponent
  onClose: () => void
}

function CompareModal({ a, b, onClose }: CompareModalProps) {
  const fields = [
    ['Category', a.data.component.category, b.data.component.category],
    ['Package', a.data.component.package.join(', '), b.data.component.package.join(', ')],
    ['RoHS', a.data.component.rohs == null ? '?' : a.data.component.rohs ? 'Yes' : 'No', b.data.component.rohs == null ? '?' : b.data.component.rohs ? 'Yes' : 'No'],
    ['Pin Count', String(a.data.pinout.length), String(b.data.pinout.length)],
    ['Features', String(a.data.features.length), String(b.data.features.length)],
    ['App Circuits', String(a.data.applicationCircuits.length), String(b.data.applicationCircuits.length)],
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-bright)', borderRadius: 16, padding: 28, width: 640, maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, color: 'var(--text)', margin: 0 }}>Component Comparison</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} data-tooltip="Close">
            <X size={18} />
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>&nbsp;</th>
              <th style={{ ...thStyle, color: 'var(--accent)' }}>{a.data.component.partNumber}</th>
              <th style={{ ...thStyle, color: '#9485b8' }}>{b.data.component.partNumber}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>Manufacturer</td>
              <td style={tdStyle}>{a.data.component.manufacturer}</td>
              <td style={tdStyle}>{b.data.component.manufacturer}</td>
            </tr>
            <tr>
              <td style={tdStyle}>Description</td>
              <td style={tdStyle}>{a.data.component.description}</td>
              <td style={tdStyle}>{b.data.component.description}</td>
            </tr>
            {fields.map(([label, va, vb]) => (
              <tr key={label}>
                <td style={tdStyle}>{label}</td>
                <td style={{ ...tdStyle, color: va !== vb ? 'var(--accent)' : 'var(--text)' }}>{va}</td>
                <td style={{ ...tdStyle, color: va !== vb ? '#9485b8' : 'var(--text)' }}>{vb}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 11, textAlign: 'left',
  padding: '8px 12px', borderBottom: '1px solid var(--border)',
  color: 'var(--text-muted)',  
}
const tdStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
  padding: '8px 12px', borderBottom: '1px solid var(--border)',
  color: 'var(--text)',
}

interface Props {
  onLoad: (comp: SavedComponent) => void
  onClose: () => void
}

export function ComponentLibrary({ onLoad, onClose }: Props) {
  const [lib, setLib] = useState<SavedComponent[]>(loadLibrary)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [compareA, setCompareA] = useState<SavedComponent | null>(null)
  const [compareB, setCompareB] = useState<SavedComponent | null>(null)
  const [showCompare, setShowCompare] = useState(false)

  const categories = useMemo(() => [...new Set(lib.map((c) => c.data.component.category).filter(Boolean))], [lib])

  const filtered = useMemo(() => lib.filter((c) => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      c.data.component.partNumber.toLowerCase().includes(q) ||
      c.data.component.description.toLowerCase().includes(q) ||
      c.data.component.manufacturer.toLowerCase().includes(q)
    const matchCat = !categoryFilter || c.data.component.category === categoryFilter
    return matchSearch && matchCat
  }), [lib, search, categoryFilter])

  function handleDelete(id: string) {
    removeFromLibrary(id)
    setLib(loadLibrary())
    if (compareA?.id === id) setCompareA(null)
    if (compareB?.id === id) setCompareB(null)
  }

  function toggleCompare(comp: SavedComponent) {
    if (compareA?.id === comp.id) { setCompareA(null); return }
    if (compareB?.id === comp.id) { setCompareB(null); return }
    if (!compareA) { setCompareA(comp); return }
    if (!compareB) { setCompareB(comp); return }
    setCompareA(comp)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border-bright)',
        borderRadius: 16, padding: 28, width: 900, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, color: 'var(--text)', margin: 0 }}>
            Component Library <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>({lib.length})</span>
          </h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {compareA && compareB && (
              <button className="btn" onClick={() => setShowCompare(true)} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <GitCompare size={13} /> Compare
              </button>
            )}
            <button className="btn" onClick={() => exportJSON(lib)} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Download size={13} /> Export JSON
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search part number or description…" style={{ paddingLeft: 30, width: '100%' }} />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input"
            style={{ width: 160 }}
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {compareA && (
          <div style={{ display: 'flex', gap: 8, padding: '8px 12px', background: 'rgba(0,200,255,0.05)', border: '1px solid rgba(0,200,255,0.2)', borderRadius: 8, alignItems: 'center' }}>
            <GitCompare size={13} style={{ color: 'var(--accent)' }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--accent)' }}>
              Comparing: {compareA.data.component.partNumber}{compareB ? ` vs ${compareB.data.component.partNumber}` : ' — select another'}
            </span>
          </div>
        )}

        {/* Grid */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, textAlign: 'center', paddingTop: 40 }}>
              {lib.length === 0 ? 'No components saved yet.' : 'No results.'}
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {filtered.map((comp) => {
                const isSelected = compareA?.id === comp.id || compareB?.id === comp.id
                return (
                  <div
                    key={comp.id}
                    style={{
                      background: 'var(--surface-2)',
                      border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 10,
                      padding: 14,
                      cursor: 'pointer',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-bright)' }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>
                        {comp.data.component.partNumber}
                      </span>
                      <button
                        onClick={() => handleDelete(comp.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2 }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#b08080'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)', margin: '0 0 4px',  }}>
                      {comp.data.component.category}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text)', margin: '0 0 10px', lineHeight: 1.4 }}>
                      {comp.data.component.description.slice(0, 80)}{comp.data.component.description.length > 80 ? '…' : ''}
                    </p>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)', margin: '0 0 10px' }}>
                      {new Date(comp.dateAdded).toLocaleDateString()}
                    </p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn" onClick={() => { onLoad(comp); onClose() }}
                        style={{ flex: 1, fontSize: 11, padding: '4px 0' }}>
                        Load
                      </button>
                      <button
                        onClick={() => toggleCompare(comp)}
                        style={{
                          flex: 1, fontSize: 11, padding: '4px 0',
                          borderRadius: 6, border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                          background: isSelected ? 'rgba(0,200,255,0.1)' : 'transparent',
                          color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                          cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {isSelected ? '✓ Selected' : 'Compare'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showCompare && compareA && compareB && (
        <CompareModal a={compareA} b={compareB} onClose={() => setShowCompare(false)} />
      )}
    </div>
  )
}
