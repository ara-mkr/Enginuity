import React, { useState, useEffect, useMemo } from 'react'
import {
  Share2,
  Lock,
  Unlock,
  Copy,
  Download,
  Check,
  Loader2,
  ExternalLink,
  BookOpen,
  ArrowRight
} from 'lucide-react'
import {
  EXPORT_TARGETS,
  getExporterForModule,
  exportToGist,
  exportToNotion
} from '../../engine/exportEngine'
import { logEvent } from '../../engine/eventLog'

interface ExportMenuProps {
  moduleName: string
  exportData: any // Module-specific raw dataset to feed exporters
  onClose: () => void
}

export function ExportMenu({ moduleName, exportData, onClose }: ExportMenuProps) {
  const exporter = getExporterForModule(moduleName) as any

  // Auth States loaded from local storage
  const [githubToken, setGithubToken] = useState(localStorage.getItem('enginguity_github_token') || '')
  const [notionToken, setNotionToken] = useState(localStorage.getItem('enginguity_notion_token') || '')
  
  // Connect sub-panels state
  const [activeAuthPanel, setActiveAuthPanel] = useState<'gist' | 'notion' | null>(null)
  
  // Notion specific Page URL input
  const [notionPageUrl, setNotionPageUrl] = useState('')

  // Export formats & target configurations
  const [selectedFormat, setSelectedFormat] = useState<'markdown' | 'html' | 'json' | 'pdf' | 'patch' | 'netlist' | 'url'>('markdown')
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null)

  // Gist creation success reference
  const [gistUrl, setGistUrl] = useState<string | null>(null)

  // List of formats available for this module
  const availableFormats = useMemo(() => {
    if (!exporter) return ['json']
    const formats: any[] = ['json']
    if (exporter.toMarkdown) formats.push('markdown')
    if (exporter.toHTML) formats.push('html')
    if (exporter.toNetlist) formats.push('netlist')
    if (exporter.toPatch) formats.push('patch')
    if (exporter.toShareURL) formats.push('url')
    return formats
  }, [exporter])

  // Default selected format setup
  useEffect(() => {
    if (availableFormats.length > 0) {
      // Prefer markdown or first format
      if (availableFormats.includes('markdown')) {
        setSelectedFormat('markdown')
      } else {
        setSelectedFormat(availableFormats[0])
      }
    }
  }, [availableFormats])

  // Get preview content (first 200 chars)
  const previewText = useMemo(() => {
    if (!exporter) return 'No exporter available.'
    try {
      if (selectedFormat === 'markdown' && exporter.toMarkdown) {
        // Feed parameters accordingly based on module type
        if (moduleName.toLowerCase() === 'notebook') {
          return exporter.toMarkdown(exportData).slice(0, 200)
        }
        if (moduleName.toLowerCase() === 'bom') {
          return exporter.toMarkdown(exportData).slice(0, 200)
        }
        if (moduleName.toLowerCase() === 'cad viewer') {
          return exporter.toMarkdown(exportData.filename, exportData.stats, exportData.aiAnalysis).slice(0, 200)
        }
        if (moduleName.toLowerCase() === 'datasheet') {
          return exporter.toMarkdown(exportData).slice(0, 200)
        }
        if (moduleName.toLowerCase() === 'circuit sim') {
          return exporter.toMarkdown(exportData.components, exportData.results).slice(0, 200)
        }
        if (moduleName.toLowerCase() === 'firmware diff') {
          return exporter.toMarkdown(exportData.stats, exportData.analysis).slice(0, 200)
        }
        return exporter.toMarkdown(exportData.schema, exportData.values, exportData.outputs).slice(0, 200)
      }

      if (selectedFormat === 'html' && exporter.toHTML) {
        if (moduleName.toLowerCase() === 'notebook') {
          return exporter.toHTML(exportData).slice(0, 200)
        }
        if (moduleName.toLowerCase() === 'bom') {
          return exporter.toHTML(exportData).slice(0, 200)
        }
        if (moduleName.toLowerCase() === 'datasheet') {
          return exporter.toHTML(exportData).slice(0, 200)
        }
        if (moduleName.toLowerCase() === 'circuit sim') {
          return exporter.toHTML(exportData.components, exportData.results).slice(0, 200)
        }
        if (moduleName.toLowerCase() === 'firmware diff') {
          return exporter.toHTML(exportData.diffLines, exportData.fileA, exportData.fileB).slice(0, 200)
        }
        return exporter.toHTML(exportData.schema, exportData.values).slice(0, 200)
      }

      if (selectedFormat === 'json' && exporter.toJSON) {
        if (moduleName.toLowerCase() === 'notebook') {
          return exporter.toJSON(exportData).slice(0, 200)
        }
        if (moduleName.toLowerCase() === 'bom') {
          return exporter.toJSON(exportData).slice(0, 200)
        }
        if (moduleName.toLowerCase() === 'cad viewer') {
          return exporter.toJSON(exportData.filename, exportData.stats, exportData.aiAnalysis, exportData.metadata).slice(0, 200)
        }
        if (moduleName.toLowerCase() === 'datasheet') {
          return exporter.toJSON(exportData).slice(0, 200)
        }
        if (moduleName.toLowerCase() === 'circuit sim') {
          return exporter.toJSON(exportData.components, exportData.results).slice(0, 200)
        }
        return exporter.toJSON(exportData.schema, exportData.values, exportData.sweep).slice(0, 200)
      }

      if (selectedFormat === 'patch' && exporter.toPatch) {
        return exporter.toPatch(exportData.diffLines, exportData.fileA, exportData.fileB).slice(0, 200)
      }

      if (selectedFormat === 'netlist' && exporter.toNetlist) {
        return exporter.toNetlist(exportData.components).slice(0, 200)
      }

      if (selectedFormat === 'url' && exporter.toShareURL) {
        return exporter.toShareURL(exportData.schema, exportData.values, exportData.sweep)
      }

      return 'Format selected: ' + selectedFormat
    } catch (e: any) {
      return `Failed to compile preview: ${e.message}`
    }
  }, [selectedFormat, exporter, exportData, moduleName])

  // Get raw compiled text content to send to Gist, Clipboard, etc.
  const getCompiledContent = () => {
    if (!exporter) return ''
    if (selectedFormat === 'markdown' && exporter.toMarkdown) {
      if (moduleName.toLowerCase() === 'notebook') return exporter.toMarkdown(exportData)
      if (moduleName.toLowerCase() === 'bom') return exporter.toMarkdown(exportData)
      if (moduleName.toLowerCase() === 'cad viewer') return exporter.toMarkdown(exportData.filename, exportData.stats, exportData.aiAnalysis)
      if (moduleName.toLowerCase() === 'datasheet') return exporter.toMarkdown(exportData)
      if (moduleName.toLowerCase() === 'circuit sim') return exporter.toMarkdown(exportData.components, exportData.results)
      if (moduleName.toLowerCase() === 'firmware diff') return exporter.toMarkdown(exportData.stats, exportData.analysis)
      return exporter.toMarkdown(exportData.schema, exportData.values, exportData.outputs)
    }
    if (selectedFormat === 'html' && exporter.toHTML) {
      if (moduleName.toLowerCase() === 'notebook') return exporter.toHTML(exportData)
      if (moduleName.toLowerCase() === 'bom') return exporter.toHTML(exportData)
      if (moduleName.toLowerCase() === 'datasheet') return exporter.toHTML(exportData)
      if (moduleName.toLowerCase() === 'circuit sim') return exporter.toHTML(exportData.components, exportData.results)
      if (moduleName.toLowerCase() === 'firmware diff') return exporter.toHTML(exportData.diffLines, exportData.fileA, exportData.fileB)
      return exporter.toHTML(exportData.schema, exportData.values)
    }
    if (selectedFormat === 'json' && exporter.toJSON) {
      if (moduleName.toLowerCase() === 'notebook') return exporter.toJSON(exportData)
      if (moduleName.toLowerCase() === 'bom') return exporter.toJSON(exportData)
      if (moduleName.toLowerCase() === 'cad viewer') return exporter.toJSON(exportData.filename, exportData.stats, exportData.aiAnalysis, exportData.metadata)
      if (moduleName.toLowerCase() === 'datasheet') return exporter.toJSON(exportData)
      if (moduleName.toLowerCase() === 'circuit sim') return exporter.toJSON(exportData.components, exportData.results)
      return exporter.toJSON(exportData.schema, exportData.values, exportData.sweep)
    }
    if (selectedFormat === 'patch' && exporter.toPatch) {
      return exporter.toPatch(exportData.diffLines, exportData.fileA, exportData.fileB)
    }
    if (selectedFormat === 'netlist' && exporter.toNetlist) {
      return exporter.toNetlist(exportData.components)
    }
    if (selectedFormat === 'url' && exporter.toShareURL) {
      return exporter.toShareURL(exportData.schema, exportData.values, exportData.sweep)
    }
    return ''
  }

  // Trigger Action Dispatch
  const handleTargetAction = async (targetId: string) => {
    setIsExporting(true)
    setExportError(null)
    setSuccessMessage(null)
    setGistUrl(null)

    const content = getCompiledContent()
    const ext = selectedFormat === 'markdown' ? 'md' : selectedFormat === 'html' ? 'html' : selectedFormat === 'patch' ? 'patch' : 'json'
    const filename = `enginguity-${moduleName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.${ext}`

    try {
      if (targetId === 'clipboard_md' || targetId === 'clipboard_html') {
        await navigator.clipboard.writeText(content)
        setSuccessMessage('Content copied to clipboard.')
        setCopiedTarget(targetId)
        setTimeout(() => setCopiedTarget(null), 2000)
      } else if (targetId === 'download_md' || targetId === 'download_html' || targetId === 'download_json') {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        setSuccessMessage('File downloaded successfully.')
      } else if (targetId === 'download_pdf') {
        // Open printing dialog for the current document
        window.print()
        setSuccessMessage('Print document context opened.')
      } else if (targetId === 'obsidian') {
        let obsidianContent = content
        if (exporter && exporter.toObsidian) {
          obsidianContent = exporter.toObsidian(exportData)
        }
        const blob = new Blob([obsidianContent], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${filename.replace(/\.[a-z]+$/, '')}-obsidian.md`
        link.click()
        setSuccessMessage('Obsidian Vault note generated and downloaded.')
      } else if (targetId === 'share_link') {
        let shareUrl = content
        if (selectedFormat !== 'url' && exporter && exporter.toShareURL) {
          shareUrl = exporter.toShareURL(exportData.schema, exportData.values, exportData.sweep)
        }
        await navigator.clipboard.writeText(shareUrl)
        setSuccessMessage('lz-string compressed share link copied to clipboard.')
        setCopiedTarget(targetId)
        setTimeout(() => setCopiedTarget(null), 2000)
      } else if (targetId === 'github_gist') {
        if (!githubToken) {
          setActiveAuthPanel('gist')
          throw new Error('Please configure a GitHub token first.')
        }
        const gist = await exportToGist(githubToken, moduleName, filename, content)
        setGistUrl(gist.html_url)
        setSuccessMessage('Secret Gist created successfully!')
      } else if (targetId === 'notion') {
        if (!notionToken) {
          setActiveAuthPanel('notion')
          throw new Error('Please configure a Notion integration token first.')
        }
        if (!notionPageUrl) {
          throw new Error('Please enter a Notion page URL to write to.')
        }
        await exportToNotion(notionToken, notionPageUrl, moduleName, content)
        setSuccessMessage('Notion page children blocks populated successfully!')
      }

      logEvent('EXPORT_CREATED', {
        format: selectedFormat,
        target: targetId,
        module: moduleName
      })
    } catch (e: any) {
      setExportError(e.message || 'Action failed.')
    } finally {
      setIsExporting(false)
    }
  }

  // Token saves
  const saveGithubToken = () => {
    localStorage.setItem('enginguity_github_token', githubToken)
    setActiveAuthPanel(null)
    setSuccessMessage('GitHub Token saved locally.')
  }

  const saveNotionToken = () => {
    localStorage.setItem('enginguity_notion_token', notionToken)
    setActiveAuthPanel(null)
    setSuccessMessage('Notion Token saved locally.')
  }

  return (
    <div style={overlayStyle}>
      <div style={drawerStyle}>
        
        {/* Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Share2 size={16} style={{ color: 'var(--accent)' }} /> Export: {moduleName}
          </h2>
          <button onClick={onClose} style={closeButtonStyle} data-tooltip="Close">✕</button>
        </div>

        {/* Status messages */}
        {successMessage && (
          <div style={successBoxStyle}>{successMessage}</div>
        )}
        {exportError && (
          <div style={errorBoxStyle}>{exportError}</div>
        )}

        {/* Content Preview Box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Export Preview (First 200 chars)</span>
          <div style={previewBoxStyle}>
            {previewText}
          </div>
        </div>

        {/* Format Select tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Select Format</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {availableFormats.map(f => (
              <button
                key={f}
                onClick={() => setSelectedFormat(f)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: selectedFormat === f ? 'var(--accent-glow)' : 'transparent',
                  color: selectedFormat === f ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: 'pointer'
                }}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Auth dynamic panels */}
        {activeAuthPanel === 'gist' && (
          <div style={authPanelStyle}>
            <span style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Connect GitHub Gist</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3, display: 'block', marginBottom: 8 }}>
              GitHub → Settings → Developer Settings → Personal Access Tokens → generate token with <strong>gist</strong> scope.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_..."
                style={inputStyle}
              />
              <button onClick={saveGithubToken} style={actionButtonStyle}>Connect</button>
            </div>
          </div>
        )}

        {activeAuthPanel === 'notion' && (
          <div style={authPanelStyle}>
            <span style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Connect Notion API</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3, display: 'block', marginBottom: 8 }}>
              Go to notion.so/my-integrations, create new integration, copy Internal token.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="password"
                value={notionToken}
                onChange={(e) => setNotionToken(e.target.value)}
                placeholder="secret_..."
                style={inputStyle}
              />
              <button onClick={saveNotionToken} style={actionButtonStyle}>Connect</button>
            </div>
          </div>
        )}

        {/* Targets grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflowY: 'auto' }}>
          <span style={labelStyle}>Export Target</span>
          
          {/* Notion specific details if Notion target hovered or selected */}
          {notionToken && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>Notion Page URL (Required for Notion Target):</span>
              <input
                type="text"
                value={notionPageUrl}
                onChange={(e) => setNotionPageUrl(e.target.value)}
                placeholder="https://www.notion.so/workspace/Page-Title-23b49a55cf..."
                style={inputStyle}
              />
            </div>
          )}

          <div style={gridStyle}>
            {EXPORT_TARGETS.filter(t => t.formats.includes(selectedFormat as any) || t.id === 'share_link' || t.id === 'download_json').map(target => {
              const hasToken = target.requiresAuth
                ? (target.authKey === 'enginguity_github_token' ? !!githubToken : !!notionToken)
                : true

              const isCopied = copiedTarget === target.id

              return (
                <div
                  key={target.id}
                  onClick={() => !isExporting && handleTargetAction(target.id)}
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 12,
                    cursor: isExporting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    position: 'relative',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (!isExporting) {
                      e.currentTarget.style.borderColor = 'var(--accent)'
                      e.currentTarget.style.transform = 'translateY(-1px)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.transform = 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{target.name}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                      {target.requiresAuth && (
                        hasToken ? <Unlock size={12} style={{ color: '#7aaa8a' }} /> : <Lock size={12} style={{ color: '#b08080' }} onClick={(e) => {
                          e.stopPropagation()
                          setActiveAuthPanel(target.id === 'github_gist' ? 'gist' : 'notion')
                        }} />
                      )}
                      {isCopied && <Check size={12} style={{ color: '#7aaa8a' }} />}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3 }}>{target.description}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Gist redirect helper link */}
        {gistUrl && (
          <a href={gistUrl} target="_blank" rel="noreferrer" style={gistLinkStyle}>
            View secret Gist on GitHub <ExternalLink size={11} />
          </a>
        )}

      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(4px)',
  zIndex: 1100,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center'
}

const drawerStyle: React.CSSProperties = {
  width: 500,
  maxHeight: '85vh',
  background: 'var(--surface)',
  border: '1px solid var(--border-bright)',
  borderRadius: 12,
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
  boxSizing: 'border-box'
}

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: 14
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: "'JetBrains Mono', monospace",
  color: 'var(--text-muted)',
  
  
}

const previewBoxStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: 12,
  fontSize: 11,
  fontFamily: "'JetBrains Mono', monospace",
  color: 'var(--text-muted)',
  whiteSpace: 'pre-wrap',
  maxHeight: 80,
  overflowY: 'auto'
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12
}

const authPanelStyle: React.CSSProperties = {
  background: 'rgba(148, 163, 184, 0.04)',
  border: '1px solid var(--accent-glow)',
  borderRadius: 8,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 12,
  outline: 'none',
  fontFamily: "'JetBrains Mono', monospace"
}

const actionButtonStyle: React.CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--bg)',
  border: 'none',
  padding: '6px 14px',
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: "'JetBrains Mono', monospace"
}

const successBoxStyle: React.CSSProperties = {
  background: 'rgba(0,230,118,0.1)',
  border: '1px solid rgba(0,230,118,0.2)',
  color: '#7aaa8a',
  borderRadius: 6,
  padding: '8px 12px',
  fontSize: 11,
  fontFamily: "'JetBrains Mono', monospace"
}

const errorBoxStyle: React.CSSProperties = {
  background: 'rgba(255,107,107,0.1)',
  border: '1px solid rgba(255,107,107,0.2)',
  color: '#b08080',
  borderRadius: 6,
  padding: '8px 12px',
  fontSize: 11,
  fontFamily: "'JetBrains Mono', monospace"
}

const gistLinkStyle: React.CSSProperties = {
  alignSelf: 'center',
  color: 'var(--accent)',
  fontSize: 11,
  fontFamily: "'JetBrains Mono', monospace",
  textDecoration: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 4
}
