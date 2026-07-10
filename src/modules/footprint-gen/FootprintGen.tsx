import { useState, useMemo, useEffect } from 'react'
import { Download, Copy, ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react'
import { useEnginguityStore } from '../../engine/persistenceEngine'
import { PACKAGES, CATEGORIES } from '../../config/packages'
import { generateKicadMod } from './engine/generateKicad'
import { buildPreviewSVG, LAYER_COLORS } from './engine/previewSVG'
import { useAIProvider } from '../../hooks/useAIProvider'
import { useProbeContext } from '../../hooks/useProbeContext'
import { logEvent } from '../../engine/eventLog'

// ── Types ─────────────────────────────────────────────────────────────────────

// Package configs come from an untyped JS module (src/config/packages.js) and
// are structurally heterogeneous per package type (chip, SOIC, QFN, etc.) — one
// localized disable instead of suppressing every call site individually.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PkgAny = any

interface LayerVis {
  cu: boolean; paste: boolean; mask: boolean;
  silk: boolean; fab: boolean; courtyard: boolean;
}

// ── Custom package defaults ───────────────────────────────────────────────────

const CUSTOM_DEFAULTS = {
  category: 'Custom', type: 'chip',
  body: { l: 2.00, w: 1.00, h: 0.50 },
  land: { l: 0.90, w: 0.80, pitch: 2.00 },
  courtyard: 0.25,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function numInput(
  label: string,
  value: number,
  onChange: (v: number) => void,
  unit = 'mm'
) {
  return (
    <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Geist, sans-serif' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number"
          value={value}
          step="0.01"
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{
            width: 72, padding: '4px 8px', fontSize: 13, fontFamily: 'Geist Mono, monospace',
            color: 'var(--text)', background: 'var(--bg-2, #0e0e0e)',
            border: '1px solid var(--border)', borderRadius: 4, outline: 'none',
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif' }}>{unit}</span>
      </div>
    </label>
  )
}

function DensityPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif', marginBottom: 6 }}>
        IPC-7351 Density
      </p>
      <div style={{ display: 'flex', gap: 4 }}>
        {['least', 'nominal', 'most'].map(d => (
          <button
            key={d}
            onClick={() => onChange(d)}
            style={{
              flex: 1, height: 28, fontSize: 11, cursor: 'pointer',
              fontFamily: 'Geist, sans-serif', textTransform: 'capitalize',
              border: '1px solid',
              borderColor: value === d ? 'var(--accent)' : 'var(--border)',
              color: value === d ? 'var(--accent)' : 'var(--text-dim)',
              background: 'transparent', borderRadius: 4, transition: 'all 0.15s'
            }}
          >
            {d}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif', marginTop: 4 }}>
        {value === 'least' ? 'Miniaturized — smallest pads' :
         value === 'nominal' ? 'Standard production — default' :
         'Hand-soldering / low-volume — largest pads'}
      </p>
    </div>
  )
}

// ── Parameter panel per package type ─────────────────────────────────────────

function ParamPanel({ cfg, onChange }: { cfg: PkgAny; onChange: (key: string, val: PkgAny) => void }) {
  const { type } = cfg

  const set = (path: string[], val: number) => {
    const next = JSON.parse(JSON.stringify(cfg))
    let obj: PkgAny = next
    for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]]
    obj[path[path.length - 1]] = val
    onChange('cfg', next)
  }

  if (type === 'chip') return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {numInput('Pad Length', cfg.land.l, v => set(['land', 'l'], v))}
      {numInput('Pad Width', cfg.land.w, v => set(['land', 'w'], v))}
      {numInput('Pad Pitch', cfg.land.pitch, v => set(['land', 'pitch'], v))}
      {numInput('Body Length', cfg.body.l, v => set(['body', 'l'], v))}
      {numInput('Body Width', cfg.body.w, v => set(['body', 'w'], v))}
    </div>
  )

  if (type === 'soic' || type === 'ssop') return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {numInput('Pad Length', cfg.land.l, v => set(['land', 'l'], v))}
      {numInput('Pad Width', cfg.land.w, v => set(['land', 'w'], v))}
      {numInput('Pitch', cfg.pitch, v => onChange('pitch', v))}
      {numInput('Row Spacing', cfg.rowSpacing, v => onChange('rowSpacing', v))}
      {numInput('Pin Count', cfg.pins, v => onChange('pins', Math.max(4, Math.round(v / 2) * 2)))}
    </div>
  )

  if (type === 'qfp' || type === 'qfn') return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {numInput('Pitch', cfg.pitch, v => onChange('pitch', v))}
      {numInput('Body Size', cfg.body.l, v => { set(['body', 'l'], v); set(['body', 'w'], v) })}
      {numInput('Pad Length', cfg.land.l, v => set(['land', 'l'], v))}
      {numInput('Pad Width', cfg.land.w, v => set(['land', 'w'], v))}
      {numInput('Pin Count', cfg.pins, v => onChange('pins', Math.max(8, Math.round(v / 4) * 4)))}
      {type === 'qfn' && cfg.thermalPad &&
        numInput('Thermal Pad', cfg.thermalPad.l, v => { set(['thermalPad', 'l'], v); set(['thermalPad', 'w'], v) })
      }
    </div>
  )

  if (type === 'dip') return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {numInput('Pitch', cfg.pitch, v => onChange('pitch', v))}
      {numInput('Row Spacing', cfg.rowSpacing, v => onChange('rowSpacing', v))}
      {numInput('Drill Dia', cfg.drillDia, v => onChange('drillDia', v))}
      {numInput('Pad Dia', cfg.padDia, v => onChange('padDia', v))}
      {numInput('Pin Count', cfg.pins, v => onChange('pins', Math.max(4, Math.round(v / 2) * 2)))}
    </div>
  )

  if (type === 'bga') return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {numInput('Pitch', cfg.pitch, v => onChange('pitch', v))}
      {numInput('Rows', cfg.rows, v => onChange('rows', Math.max(2, Math.round(v))))}
      {numInput('Cols', cfg.cols, v => onChange('cols', Math.max(2, Math.round(v))))}
      {numInput('Pad Dia', cfg.padDia, v => onChange('padDia', v))}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {numInput('Pitch', cfg.pitch ?? 1.27, v => onChange('pitch', v))}
      {cfg.body && numInput('Body Length', cfg.body.l, v => set(['body', 'l'], v))}
      {cfg.land && numInput('Pad Length', cfg.land.l, v => set(['land', 'l'], v))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function FootprintGen() {
  const { makeRequest, isConnected } = useAIProvider()

  // Persisted slice — survives navigation/refresh (src/engine/persistenceEngine.js)
  const setFootprintGenState = useEnginguityStore((s: { setFootprintGenState: (state: PkgAny) => void }) => s.setFootprintGenState)
  const persisted = useEnginguityStore.getState().footprintGen

  const [search, setSearch] = useState(persisted.search)
  const [category, setCategory] = useState(persisted.category)
  const [selectedKey, setSelectedKey] = useState<string | null>(persisted.selectedKey)
  const [customCfg, setCustomCfg] = useState<PkgAny>(persisted.customCfg ?? JSON.parse(JSON.stringify(CUSTOM_DEFAULTS)))
  const [customName, setCustomName] = useState(persisted.customName)
  const [customTab, setCustomTab] = useState(persisted.customTab)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const [density, setDensity] = useState(persisted.density)
  const [layers, setLayers] = useState<LayerVis>(persisted.layers)
  const [filename, setFilename] = useState(persisted.filename)
  const [showInstructions, setShowInstructions] = useState(false)
  const [copied, setCopied] = useState(false)

  // Active package config
  const packageName = customTab ? customName : (selectedKey || '')
  const activeCfg: PkgAny = customTab
    ? customCfg
    : selectedKey ? PACKAGES[selectedKey] : null

  const [editedCfg, setEditedCfg] = useState<PkgAny | null>(persisted.editedCfg)
  const effectiveCfg = editedCfg ?? activeCfg

  useProbeContext('footprint-gen', {
    packageName: packageName || null,
    category,
    customMode: !!customTab,
    density,
    packageType: effectiveCfg?.type ?? null,
    edited: !!editedCfg,
  })

  // Write-through: mirror package selection/config into the global store so
  // in-progress custom footprints survive navigating away.
  useEffect(() => {
    setFootprintGenState({
      search, category, selectedKey, customCfg, customName, customTab,
      density, layers, filename, editedCfg,
    })
  }, [search, category, selectedKey, customCfg, customName, customTab, density, layers, filename, editedCfg, setFootprintGenState])

  // Reset edited config when selection changes
  const handleSelect = (key: string) => {
    setSelectedKey(key)
    setCustomTab(false)
    setEditedCfg(null)
    setFilename(`${key}.kicad_mod`)
  }

  // Filtered package list
  const filteredPackages = useMemo(() => {
    return Object.entries(PACKAGES as Record<string, PkgAny>).filter(([name, cfg]) => {
      const matchCat = category === 'All' || cfg.category === category
      const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) ||
        cfg.category.toLowerCase().includes(search.toLowerCase()) ||
        cfg.type.toLowerCase().includes(search.toLowerCase())
      return matchCat && matchSearch
    })
  }, [search, category])

  // Group by category for display
  const grouped = useMemo(() => {
    const map = new Map<string, [string, PkgAny][]>()
    filteredPackages.forEach(([name, cfg]) => {
      if (!map.has(cfg.category)) map.set(cfg.category, [])
      map.get(cfg.category)!.push([name, cfg])
    })
    return map
  }, [filteredPackages])

  // SVG preview
  const svgPreview = useMemo(() => {
    if (!effectiveCfg) return null
    try {
      return buildPreviewSVG(packageName, effectiveCfg, layers, density)
    } catch { return null }
  }, [effectiveCfg, layers, density, packageName])

  // KiCad mod content
  const kicadContent = useMemo(() => {
    if (!effectiveCfg) return ''
    try {
      return generateKicadMod(packageName, effectiveCfg, { density })
    } catch { return '' }
  }, [effectiveCfg, density, packageName])

  const handleCfgChange = (key: string, val: PkgAny) => {
    const base = editedCfg ?? (activeCfg ? JSON.parse(JSON.stringify(activeCfg)) : {})
    if (key === 'cfg') {
      setEditedCfg(val)
    } else {
      setEditedCfg({ ...base, [key]: val })
    }
  }

  const handleDownload = () => {
    if (!kicadContent) return
    const fname = filename || `${packageName}.kicad_mod`
    const blob = new Blob([kicadContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = fname; a.click()
    URL.revokeObjectURL(url)
    logEvent('FOOTPRINT_EXPORTED', { packageName, target: 'download', fileName: fname, module: 'footprint-gen' })
  }

  const handleCopy = async () => {
    if (!kicadContent) return
    await navigator.clipboard.writeText(kicadContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    logEvent('FOOTPRINT_EXPORTED', { packageName, target: 'clipboard', module: 'footprint-gen' })
  }

  const handleAIAssist = async () => {
    if (!aiPrompt.trim() || !isConnected) return
    setAiLoading(true)
    try {
      const raw = await makeRequest(
        [{ role: 'user', content: `Generate KiCad footprint dimensions for: ${aiPrompt}\n\nRespond with ONLY valid JSON matching this structure (no markdown):\n{"type":"chip|soic|ssop|qfp|qfn|dip|sot|bga","category":"IC|Passive|Power|Transistor|Connector","pins":8,"pitch":1.27,"body":{"l":5.0,"w":4.0},"land":{"l":1.5,"w":0.6},"rowSpacing":5.4,"drillDia":0.8,"padDia":1.6,"courtyard":0.25}\n\nOnly include fields relevant to this package type. Use IPC-7351 nominal dimensions.` }],
        'You are a PCB footprint expert. Return only the JSON object, no explanation.',
        { maxTokens: 400, stream: false }
      )
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
      const parsed = JSON.parse(cleaned)
      setCustomCfg({ ...CUSTOM_DEFAULTS, ...parsed })
      setCustomTab(true)
      if (!customName || customName === 'Custom_Package') {
        setCustomName(aiPrompt.split(' ').slice(0, 3).join('-').replace(/[^a-zA-Z0-9-]/g, ''))
      }
      setFilename(`${customName}.kicad_mod`)
      setEditedCfg(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      alert(`AI assist failed: ${message}`)
    } finally {
      setAiLoading(false)
    }
  }

  const toggleLayer = (key: keyof LayerVis) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col min-h-0" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-base font-bold font-mono tracking-tight">Footprint Generator</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            IPC-7351 land patterns · KiCad .kicad_mod output
          </p>
        </div>
      </header>

      {/* Two-column layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* LEFT: Package selector + parameters */}
        <div style={{
          width: 360, minWidth: 360, borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>

          {/* Search + category tabs */}
          <div style={{ padding: '12px 14px 0', flexShrink: 0 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search packages..."
              style={{
                width: '100%', padding: '7px 10px', fontSize: 14,
                fontFamily: 'Geist, sans-serif', color: 'var(--text)',
                background: 'var(--bg-2, #0e0e0e)', border: '1px solid var(--border)',
                borderRadius: 6, outline: 'none', boxSizing: 'border-box', marginBottom: 10
              }}
            />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
              {CATEGORIES.map((cat: string) => (
                <button
                  key={cat}
                  onClick={() => { setCategory(cat); if (cat === 'Custom') setCustomTab(true) }}
                  style={{
                    height: 24, padding: '0 10px', fontSize: 11, cursor: 'pointer',
                    fontFamily: 'Geist, sans-serif',
                    border: '1px solid',
                    borderColor: category === cat ? 'var(--accent)' : 'var(--border)',
                    color: category === cat ? 'var(--accent)' : 'var(--text-dim)',
                    background: 'transparent', borderRadius: 12, transition: 'all 0.15s', whiteSpace: 'nowrap'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Package list (scrollable) */}
          {!customTab && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 12px' }}>
              {[...grouped.entries()].map(([grp, items]) => (
                <div key={grp} style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    {grp}
                  </p>
                  {items.map(([name]) => (
                    <button
                      key={name}
                      onClick={() => handleSelect(name)}
                      style={{
                        width: '100%', textAlign: 'left', padding: '7px 10px',
                        marginBottom: 2, borderRadius: 5, cursor: 'pointer',
                        border: '1px solid',
                        borderColor: selectedKey === name ? 'var(--border-bright)' : 'transparent',
                        background: selectedKey === name ? 'var(--surface-2, #131313)' : 'transparent',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        transition: 'all 0.12s'
                      }}
                      onMouseEnter={e => { if (selectedKey !== name) (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
                      onMouseLeave={e => { if (selectedKey !== name) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <span style={{ fontSize: 13, fontFamily: 'Geist Mono, monospace', color: 'var(--text)' }}>{name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif' }}>{(PACKAGES as Record<string, PkgAny>)[name].type}</span>
                    </button>
                  ))}
                </div>
              ))}
              {filteredPackages.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif', textAlign: 'center', paddingTop: 24 }}>
                  No packages match "{search}"
                </p>
              )}
            </div>
          )}

          {/* Custom package form */}
          {customTab && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Geist, sans-serif', marginBottom: 4 }}>Package name</p>
                <input
                  value={customName}
                  onChange={e => { setCustomName(e.target.value); setFilename(`${e.target.value}.kicad_mod`) }}
                  style={{
                    width: '100%', padding: '6px 10px', fontSize: 13, fontFamily: 'Geist Mono, monospace',
                    color: 'var(--text)', background: 'var(--bg-2, #0e0e0e)',
                    border: '1px solid var(--border)', borderRadius: 4, outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* AI assist */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Geist, sans-serif', marginBottom: 6 }}>
                  Describe your package →
                </p>
                <textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder='"8-pin SOIC with 1.27mm pitch"'
                  rows={2}
                  style={{
                    width: '100%', padding: '6px 10px', fontSize: 12, fontFamily: 'Geist, sans-serif',
                    color: 'var(--text)', background: 'var(--bg-2, #0e0e0e)',
                    border: '1px solid var(--border)', borderRadius: 4, outline: 'none',
                    resize: 'none', boxSizing: 'border-box', marginBottom: 8
                  }}
                />
                <button
                  onClick={handleAIAssist}
                  disabled={!aiPrompt.trim() || !isConnected || aiLoading}
                  style={{
                    height: 28, padding: '0 12px', fontSize: 12,
                    fontFamily: 'Geist, sans-serif', cursor: 'pointer',
                    background: 'transparent', border: '1px solid',
                    borderColor: isConnected ? 'var(--accent)' : 'var(--border)',
                    color: isConnected ? 'var(--accent)' : 'var(--text-dim)',
                    borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  {aiLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={12} />}
                  AI Fill Dimensions
                </button>
              </div>

              {/* Manual params */}
              <ParamPanel cfg={customCfg} onChange={handleCfgChange} />
            </div>
          )}

          {/* Parameters for selected package */}
          {!customTab && effectiveCfg && (
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Parameters
              </p>
              <ParamPanel cfg={effectiveCfg} onChange={handleCfgChange} />
              <div style={{ marginTop: 14 }}>
                <DensityPicker value={density} onChange={setDensity} />
              </div>
            </div>
          )}

          {customTab && effectiveCfg && (
            <div style={{ padding: '0 14px 12px', flexShrink: 0 }}>
              <DensityPicker value={density} onChange={setDensity} />
            </div>
          )}
        </div>

        {/* RIGHT: Preview + download */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {!effectiveCfg ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif' }}>
                Select a package to preview
              </p>
            </div>
          ) : (
            <>
              {/* Layer toggles */}
              <div style={{
                padding: '10px 16px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap'
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif' }}>Layers:</span>
                {(Object.keys(layers) as (keyof LayerVis)[]).map(key => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={layers[key]}
                      onChange={() => toggleLayer(key)}
                      style={{ accentColor: LAYER_COLORS[key] ?? 'var(--accent)', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 11, fontFamily: 'Geist, sans-serif', color: layers[key] ? 'var(--text-muted)' : 'var(--text-dim)', textTransform: 'capitalize' }}>
                      {key}
                    </span>
                  </label>
                ))}
              </div>

              {/* SVG Preview */}
              <div style={{ flex: 1, overflow: 'hidden', background: 'var(--bg-2, #0e0e0e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {svgPreview ? (
                  <div
                    style={{ width: 400, height: 380 }}
                    dangerouslySetInnerHTML={{ __html: svgPreview }}
                  />
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif' }}>
                    Preview unavailable for this package type
                  </p>
                )}
              </div>

              {/* Download panel */}
              <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif', marginBottom: 4 }}>Filename</p>
                    <input
                      value={filename || `${packageName}.kicad_mod`}
                      onChange={e => setFilename(e.target.value)}
                      style={{
                        width: '100%', padding: '6px 10px', fontSize: 12, fontFamily: 'Geist Mono, monospace',
                        color: 'var(--text)', background: 'var(--bg-2, #0e0e0e)',
                        border: '1px solid var(--border)', borderRadius: 4, outline: 'none', boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <button
                    onClick={handleDownload}
                    disabled={!kicadContent}
                    style={{
                      height: 36, padding: '0 16px', marginTop: 16, fontSize: 13, fontFamily: 'Geist, sans-serif',
                      background: kicadContent ? 'var(--accent)' : 'var(--border)',
                      border: 'none', borderRadius: 6, color: 'white', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
                    }}
                  >
                    <Download size={14} /> Download Footprint
                  </button>
                  <button
                    onClick={handleCopy}
                    disabled={!kicadContent}
                    style={{
                      height: 36, padding: '0 12px', marginTop: 16, fontSize: 13, fontFamily: 'Geist, sans-serif',
                      background: 'transparent', border: '1px solid var(--border)',
                      borderRadius: 6, color: copied ? 'var(--accent)' : 'var(--text-muted)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
                    }}
                  >
                    <Copy size={14} /> {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {/* How to add to KiCad */}
                <button
                  onClick={() => setShowInstructions(v => !v)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 12, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif'
                  }}
                >
                  How to add to KiCad
                  {showInstructions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {showInstructions && (
                  <ol style={{
                    margin: '8px 0 0 16px', padding: 0,
                    fontSize: 12, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif', lineHeight: 1.7
                  }}>
                    <li>Download the .kicad_mod file above</li>
                    <li>In KiCad PCB Editor: Place → Add Footprint</li>
                    <li>Or add to your project library folder</li>
                    <li>Footprint Manager: File → Add Library → select the .kicad_mod file</li>
                  </ol>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
