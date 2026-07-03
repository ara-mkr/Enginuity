import { useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Store, Search, Check, Plus, Trash2, Upload, Download, ExternalLink,
  Package, AlertTriangle, Sparkles,
} from 'lucide-react'
import { BUILTIN_TOOLS, iconForCustomTool, type Tool, type ToolCategory } from '../../config/toolRegistry'
import { useInstalledTools } from '../../hooks/useInstalledTools'
import { useProbeContext } from '../../hooks/useProbeContext'

const ALL_CATEGORIES: (ToolCategory | 'All')[] = [
  'All', 'Core', 'AI', 'Mechanical', 'Electrical', 'Firmware',
  'Documentation', 'Supply Chain', 'Quality', 'Collaboration', 'Custom',
]

const SAMPLE_MANIFEST = {
  id: 'my-tool',
  label: 'My Tool',
  description: 'What this tool does in one sentence.',
  category: 'Custom',
  icon: 'Wrench',
  url: 'https://example.com/embed',
  author: 'Your Name',
  version: '1.0.0',
}

export function ToolMarketplace() {
  const navigate = useNavigate()
  const { installedIds, customTools, isInstalled, install, uninstall, addCustomTool, resetToDefaults } = useInstalledTools()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(ToolCategory | 'All')>('All')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const allTools: Tool[] = useMemo(() => {
    return [...BUILTIN_TOOLS, ...customTools]
  }, [customTools])

  useProbeContext('marketplace', {
    query: query || null,
    category,
    installedCount: installedIds.size,
    customToolCount: customTools.length,
    totalTools: allTools.length,
  })

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    return allTools.filter((t) => {
      if (category !== 'All' && (t as any).category !== category) return false
      if (!q) return true
      return (
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      )
    })
  }, [allTools, category, query])

  const handleFile = useCallback((file: File) => {
    setUploadError(null)
    setUploadSuccess(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const parsed = JSON.parse(text)
        const result = addCustomTool(parsed)
        // 'in' narrowing: truthiness narrowing on the ok discriminant doesn't
        // apply under this project's non-strict tsconfig
        if ('error' in result) {
          setUploadError(result.error)
        } else {
          setUploadSuccess(`Installed "${parsed.label}". Available in the sidebar.`)
        }
      } catch (err) {
        setUploadError('Could not parse file. Expected a valid .tool.json manifest.')
      }
    }
    reader.readAsText(file)
  }, [addCustomTool])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const downloadSample = () => {
    const blob = new Blob([JSON.stringify(SAMPLE_MANIFEST, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'example.tool.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const installedCount = installedIds.size + customTools.length
  const totalCount = BUILTIN_TOOLS.length + customTools.length

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', color: 'var(--text)',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 32px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Store size={24} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Tool Marketplace</h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {installedCount} of {totalCount} tools installed · ENGINGUITY is open source, so anyone can add a tool.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8,
            padding: '8px 12px',
          }}>
            <Search size={14} style={{ color: 'var(--text-dim)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools..."
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
              }}
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".tool.json,application/json,.json"
            onChange={onFileChange}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={btnPrimary}
            title="Upload a .tool.json manifest"
          >
            <Upload size={13} /> Upload Tool
          </button>
          <button onClick={downloadSample} style={btnSecondary} title="Download example manifest">
            <Download size={13} /> Sample
          </button>
          <button onClick={resetToDefaults} style={btnSecondary} title="Reset sidebar to default installed tools">
            Reset
          </button>
        </div>

        {/* Category chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ALL_CATEGORIES.map((c) => {
            const active = category === c
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                style={{
                  padding: '4px 12px', borderRadius: 999, fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  background: active ? 'var(--accent)' : 'var(--surface-2)',
                  color: active ? 'var(--bg)' : 'var(--text-muted)',
                  border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
                  cursor: 'pointer',
                }}
              >
                {c}
              </button>
            )
          })}
        </div>

        {(uploadError || uploadSuccess) && (
          <div style={{
            padding: '8px 12px', borderRadius: 6, fontSize: 12,
            background: uploadError ? 'rgba(180, 80, 80, 0.1)' : 'rgba(80, 160, 100, 0.1)',
            border: '1px solid ' + (uploadError ? 'rgba(180, 80, 80, 0.4)' : 'rgba(80, 160, 100, 0.4)'),
            color: uploadError ? '#e08080' : '#85c098',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {uploadError ? <AlertTriangle size={13} /> : <Check size={13} />}
            {uploadError || uploadSuccess}
          </div>
        )}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{
          display: 'grid', gap: 14,
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        }}>
          {filtered.map((tool) => {
            const installed = isInstalled(tool.id)
            const isPinned = tool.kind === 'builtin' && tool.pinned
            const isCustom = tool.kind === 'custom'
            const Icon = tool.kind === 'builtin' ? tool.icon : iconForCustomTool(tool.icon)
            return (
              <div
                key={tool.id}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
                  transition: 'border-color 120ms ease, transform 120ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-bright)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={18} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{tool.label}</h3>
                      {isCustom && (
                        <span style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 999,
                          background: 'var(--accent-glow, rgba(180,150,100,0.15))',
                          color: 'var(--accent)', fontFamily: 'monospace',
                        }}>
                          CUSTOM
                        </span>
                      )}
                      {isPinned && (
                        <span style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 999,
                          background: 'var(--surface-2)', color: 'var(--text-dim)',
                          fontFamily: 'monospace',
                        }}>
                          PINNED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                      {(tool as any).category}
                      {isCustom && (tool as any).author ? ` · by ${(tool as any).author}` : ''}
                    </div>
                  </div>
                </div>

                <p style={{
                  fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.45, flex: 1,
                }}>
                  {tool.description}
                </p>

                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  {installed ? (
                    <>
                      <button
                        onClick={() => navigate(tool.to)}
                        style={{
                          flex: 1, padding: '7px 10px', borderRadius: 6, fontSize: 12,
                          background: 'var(--surface-2)', border: '1px solid var(--border)',
                          color: 'var(--text)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          fontFamily: 'inherit',
                        }}
                      >
                        <ExternalLink size={11} /> Open
                      </button>
                      {!isPinned && (
                        <button
                          onClick={() => uninstall(tool.id)}
                          title={isCustom ? 'Delete custom tool' : 'Remove from sidebar'}
                          style={{
                            padding: '7px 10px', borderRadius: 6, fontSize: 12,
                            background: 'transparent', border: '1px solid var(--border)',
                            color: 'var(--text-dim)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 5,
                            fontFamily: 'inherit',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#e08080'
                            e.currentTarget.style.borderColor = 'rgba(180,80,80,0.4)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-dim)'
                            e.currentTarget.style.borderColor = 'var(--border)'
                          }}
                        >
                          {isCustom ? <Trash2 size={11} /> : <Check size={11} />}
                          {isCustom ? 'Delete' : 'Installed'}
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => install(tool.id)}
                      style={{
                        flex: 1, padding: '7px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: 'var(--accent)', border: '1px solid var(--accent)',
                        color: 'var(--bg)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        fontFamily: 'inherit',
                      }}
                    >
                      <Plus size={12} /> Install
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div style={{
            textAlign: 'center', padding: 40, color: 'var(--text-dim)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}>
            <Package size={32} style={{ opacity: 0.4 }} />
            <div style={{ fontSize: 13 }}>No tools match that search.</div>
          </div>
        )}

        {/* Authoring footer */}
        <div style={{
          marginTop: 32, padding: 20, borderRadius: 10,
          background: 'var(--surface)', border: '1px dashed var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Sparkles size={14} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Add your own tool</h3>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.5 }}>
            ENGINGUITY is open source. To publish a tool, write a JSON manifest
            (<code style={codeStyle}>id</code>, <code style={codeStyle}>label</code>, <code style={codeStyle}>description</code>,
            and either <code style={codeStyle}>url</code> for an embeddable web tool
            or <code style={codeStyle}>html</code> for an inline widget) and upload it above.
            Built-in tools live in <code style={codeStyle}>src/config/toolRegistry.ts</code> if you'd
            rather contribute one upstream.
          </p>
          <button onClick={downloadSample} style={{ ...btnSecondary, fontSize: 11 }}>
            <Download size={11} /> Download example.tool.json
          </button>
        </div>
      </div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
  background: 'var(--accent)', border: '1px solid var(--accent)',
  color: 'var(--bg)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 6,
  fontFamily: "'DM Sans', system-ui, sans-serif",
}

const btnSecondary: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 8, fontSize: 12,
  background: 'var(--surface-2)', border: '1px solid var(--border)',
  color: 'var(--text-muted)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 6,
  fontFamily: "'DM Sans', system-ui, sans-serif",
}

const codeStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
  background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 3,
  color: 'var(--accent)',
}
