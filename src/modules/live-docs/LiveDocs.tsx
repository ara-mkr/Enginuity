// @refresh reset
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  RefreshCw, Download, ChevronDown, Settings, FileText,
  Check, Eye, EyeOff, X, Clock
} from 'lucide-react'
import { useAIProvider } from '../../hooks/useAIProvider'
import {
  getDraft, updateSection, updateDraftTitle, onDraftUpdate,
  setDocumentOpen, getDocSettings, saveDocSettings, clearDraft
} from './docWatcher'
import {
  SECTION_CONFIGS, SECTION_ORDER, generateSection,
  generateAllSections, docToMarkdown
} from './generationEngine'
import { DocSection } from './DocSection'
// @ts-ignore
import { saveToHistory, getHistory, timeAgo } from './docHistory'

export function LiveDocs() {
  const { makeRequest, isConnected } = useAIProvider()
  const [draft, setDraft] = useState(getDraft)
  const [title, setTitle] = useState<string>('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [generatingSection, setGeneratingSection] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<{ done: number, total: number } | null>(null)
  const [activeSection, setActiveSection] = useState<string>('overview')
  const [showEmpty, setShowEmpty] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [settings, setSettings] = useState(getDocSettings)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const displayTitle = title || draft.title || 'Untitled Engineering Document'

  useEffect(() => { setTitle(draft.title || '') }, [])

  useEffect(() => {
    setDocumentOpen(true)
    const unsub = onDraftUpdate((updated: any) => setDraft({ ...updated }))
    return () => { setDocumentOpen(false); unsub() }
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false)
      }
    }
    if (showExportMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showExportMenu])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleTitleSave = () => {
    const t = titleInputRef.current?.value?.trim() || ''
    setTitle(t)
    updateDraftTitle(t || null)
    setEditingTitle(false)
  }

  const handleGenerateAll = useCallback(async () => {
    if (!isConnected) { showToast('Connect OpenRouter or Ollama in AI Settings to generate sections'); return }
    setGeneratingAll(true)
    const total = SECTION_ORDER.length
    let done = 0
    setProgress({ done: 0, total })
    const onProgress = (key: string) => {
      done++
      setProgress({ done, total })
      setGeneratingSection(prev => { const s = new Set(prev); s.delete(key); return s })
    }
    setGeneratingSection(new Set(SECTION_ORDER))
    saveToHistory(draft, displayTitle)
    await generateAllSections(makeRequest, onProgress)
    setDraft({ ...getDraft() })
    setGeneratingAll(false)
    setProgress(null)
    showToast('Document generated successfully')
  }, [makeRequest, isConnected, draft, displayTitle])

  const handleRegenerateSection = useCallback(async (key: string) => {
    if (!isConnected) { showToast('Connect OpenRouter or Ollama in AI Settings to regenerate'); return }
    setGeneratingSection(prev => new Set([...prev, key]))
    await generateSection(key, makeRequest, () => {
      setGeneratingSection(prev => { const s = new Set(prev); s.delete(key); return s })
      setDraft({ ...getDraft() })
    })
  }, [makeRequest, isConnected])

  const handleUpdateSection = (key: string, content: any) => {
    updateSection(key, content)
    setDraft({ ...getDraft() })
  }

  const scrollToSection = (key: string) => {
    setActiveSection(key)
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const hasSectionContent = (key: string) => {
    const s = draft.sections[key]
    if (!s) return false
    if (s.type === 'prose') return !!s.content
    if (s.type === 'parameter_table') return (s.parameters?.length || 0) > 0
    if (s.type === 'bom_table') return (s.items?.length || 0) > 0
    if (s.type === 'decisions_list') return (s.decisions?.length || 0) > 0
    if (s.type === 'issues_table') return (s.problems?.length || 0) > 0
    if (s.type === 'references_list') return (s.references?.length || 0) > 0
    return true
  }

  const visibleSections = SECTION_ORDER.filter(key =>
    showEmpty || hasSectionContent(key) || generatingSection.has(key)
  )

  const exportMarkdown = () => {
    const md = docToMarkdown(draft, displayTitle)
    const blob = new Blob([md], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${displayTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().split('T')[0]}.md`
    a.click()
    URL.revokeObjectURL(a.href)
    setShowExportMenu(false)
    showToast('Exported as Markdown')
  }

  const copyMarkdown = () => {
    navigator.clipboard.writeText(docToMarkdown(draft, displayTitle))
    setShowExportMenu(false)
    showToast('Copied to clipboard as Markdown')
  }

  const saveSettings = (next: any) => { setSettings(next); saveDocSettings(next) }

  const wordCount = SECTION_ORDER
    .map(k => draft.sections[k]?.content?.split(/\s+/).length || 0)
    .reduce((a: number, b: number) => a + b, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', position: 'relative' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes dopulse{0%,100%{opacity:.4}50%{opacity:1}}`}</style>

      {progress && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--surface-2)', zIndex: 20 }}>
          <div style={{ height: '100%', width: `${(progress.done / progress.total) * 100}%`, background: 'var(--accent)', transition: 'width 0.3s ease' }} />
        </div>
      )}

      {/* Toolbar */}
      <div style={{ height: 56, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12, flexShrink: 0, background: 'var(--surface)' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {editingTitle ? (
            <input ref={titleInputRef} defaultValue={displayTitle} onBlur={handleTitleSave}
              onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false) }}
              autoFocus style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent)', color: 'var(--text)', fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 500, outline: 'none', minWidth: 200 }} />
          ) : (
            <span onClick={() => setEditingTitle(true)} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 500, color: 'var(--text)', cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayTitle}</span>
          )}
          {draft.lastUpdated && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>· updated {timeAgo(draft.lastUpdated)}</span>}
          {wordCount > 0 && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>· {wordCount} words</span>}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {progress && <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text-dim)' }}>Generating… {progress.done}/{progress.total}</span>}
          <TBtn onClick={handleGenerateAll} disabled={generatingAll} primary>
            <RefreshCw size={13} style={{ animation: generatingAll ? 'spin 1s linear infinite' : 'none' }} />
            {generatingAll ? 'Generating...' : 'Generate All'}
          </TBtn>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <TBtn onClick={() => setShowHistory(true)}><Clock size={13} /> History</TBtn>
          <div style={{ position: 'relative' }} ref={exportMenuRef}>
            <TBtn onClick={() => setShowExportMenu(v => !v)}><Download size={13} /> Export <ChevronDown size={11} /></TBtn>
            {showExportMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 4, zIndex: 100, minWidth: 200, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                {[{ label: 'Export as Markdown (.md)', action: exportMarkdown }, { label: 'Copy to clipboard (Markdown)', action: copyMarkdown }].map(item => (
                  <button key={item.label} onClick={item.action} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", borderRadius: 5 }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)' }}
                  >{item.label}</button>
                ))}
              </div>
            )}
          </div>
          <TBtn onClick={() => setShowSettings(true)}><Settings size={13} /></TBtn>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Section navigator */}
        <div style={{ width: 200, flexShrink: 0, background: 'var(--bg)', borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '12px 0' }}>
          {SECTION_ORDER.map((key: string) => {
            const config = SECTION_CONFIGS[key]
            const hasContent = hasSectionContent(key)
            const isGenerating = generatingSection.has(key)
            const isActive = activeSection === key
            return (
              <button key={key} onClick={() => scrollToSection(key)} style={{ width: '100%', textAlign: 'left', padding: '0 16px', height: 36, display: 'flex', alignItems: 'center', gap: 8, background: isActive ? 'var(--surface-2)' : 'transparent', border: 'none', cursor: 'pointer', color: isActive ? 'var(--text)' : hasContent ? 'var(--text-muted)' : 'var(--text-dim)', transition: 'all 0.12s' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface-2)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: isGenerating ? 'var(--text-dim)' : hasContent ? 'var(--accent)' : 'var(--border)', animation: isGenerating ? 'dopulse 1.2s ease-in-out infinite' : 'none' }} />
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{config.title}</span>
              </button>
            )
          })}
          <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0', padding: '8px 16px' }}>
            <button onClick={() => setShowEmpty(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontFamily: "'DM Sans',sans-serif", fontSize: 12, padding: 0 }}>
              {showEmpty ? <EyeOff size={11} /> : <Eye size={11} />}
              {showEmpty ? 'Hide empty' : 'Show empty'}
            </button>
          </div>
          <div style={{ padding: '4px 16px' }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: 'var(--text-dim)' }}>{draft.rawObservations?.length || 0} observations</span>
          </div>
        </div>

        {/* Document content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '48px' }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            {!editingTitle && (
              <h1 onClick={() => setEditingTitle(true)} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 28, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px', cursor: 'text', lineHeight: 1.2 }}>{displayTitle}</h1>
            )}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text-dim)' }}>{settings.author || 'Engineer'}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>·</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text-dim)' }}>{new Date().toLocaleDateString()}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>·</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text-dim)' }}>{settings.organization || 'ENGINGUITY'}</span>
            </div>
            <div style={{ height: 1, background: 'var(--border)', marginBottom: 40 }} />

            {visibleSections.length === 0 && !generatingAll && (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <FileText size={40} style={{ color: 'var(--text-dim)', margin: '0 auto 16px', display: 'block' }} />
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, color: 'var(--text-muted)', margin: '0 0 8px' }}>Your document is empty</p>
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'var(--text-dim)', margin: '0 0 20px' }}>
                  Use the app normally — Jarvis watches in the background.<br />
                  When ready, click Generate All to build your technical document.
                </p>
                <button onClick={handleGenerateAll} disabled={!isConnected} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: isConnected ? 'pointer' : 'not-allowed', color: '#000', fontWeight: 600, fontSize: 14, fontFamily: "'DM Sans',sans-serif", opacity: isConnected ? 1 : 0.5 }}>
                  {isConnected ? 'Generate Document' : 'Connect a model first'}
                </button>
              </div>
            )}

            {(showEmpty ? SECTION_ORDER : visibleSections).map((key: string, idx: number) => (
              <div key={key} ref={(el: HTMLDivElement | null) => { sectionRefs.current[key] = el }}>
                <DocSection
                  sectionKey={key}
                  title={SECTION_CONFIGS[key].title}
                  index={idx + 1}
                  content={draft.sections[key] || null}
                  generating={generatingSection.has(key)}
                  onRegenerate={() => handleRegenerateSection(key)}
                  onUpdate={(c: any) => handleUpdateSection(key, c)}
                />
              </div>
            ))}

            <div style={{ borderTop: '1px solid var(--border)', marginTop: 40, paddingTop: 16, textAlign: 'center' }}>
              <a href="https://enginguity.app" target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: 'var(--text-dim)', textDecoration: 'none' }}>
                Generated with ENGINGUITY · enginguity.app
              </a>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', zIndex: 200, fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <Check size={14} style={{ color: 'var(--accent)' }} />{toast}
        </div>
      )}

      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, width: 440, padding: 24, boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 16, color: 'var(--text)' }}>Document Settings</h3>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Setting label="Author name"><input type="text" value={settings.author || ''} placeholder="Engineer" onChange={e => saveSettings({ ...settings, author: e.target.value })} style={inputStyle} /></Setting>
              <Setting label="Organization"><input type="text" value={settings.organization || ''} placeholder="Optional" onChange={e => saveSettings({ ...settings, organization: e.target.value })} style={inputStyle} /></Setting>
              <Setting label="Technical depth">
                <select value={settings.technicalDepth || 'standard'} onChange={e => saveSettings({ ...settings, technicalDepth: e.target.value })} style={inputStyle}>
                  <option value="summary">Summary — 1 paragraph per section</option>
                  <option value="standard">Standard — 2-3 paragraphs (default)</option>
                  <option value="detailed">Detailed — full technical depth</option>
                </select>
              </Setting>
              <Setting label="Document language">
                <select value={settings.language || 'English'} onChange={e => saveSettings({ ...settings, language: e.target.value })} style={inputStyle}>
                  {['English','Spanish','French','German','Portuguese','Chinese','Japanese','Korean','Arabic','Hindi'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </Setting>
              <ToggleSetting label="Auto-watch (passive observation)" hint="Collects observations from all modules silently" checked={settings.autoWatch !== false} onChange={v => saveSettings({ ...settings, autoWatch: v })} />
              <ToggleSetting label="Include raw observations appendix" hint="Adds a full timestamped log at the end" checked={!!settings.includeRawObservations} onChange={v => saveSettings({ ...settings, includeRawObservations: v })} />
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                <button onClick={() => { if (confirm('Clear all observations and generated content?')) { clearDraft(); setDraft(getDraft()); setShowSettings(false) } }} style={{ background: 'none', border: '1px solid #f87171', color: '#f87171', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>
                  Clear all observations
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowHistory(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, width: 480, maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontFamily: "'DM Sans',sans-serif", fontSize: 16, color: 'var(--text)' }}>Document History</h3>
              <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex' }}><X size={16} /></button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
              <HistoryList onRestore={(sections: any) => { Object.entries(sections).forEach(([k, v]) => updateSection(k, v)); setDraft({ ...getDraft() }); setShowHistory(false); showToast('Restored previous version') }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function HistoryList({ onRestore }: { onRestore: (s: any) => void }) {
  const history = getHistory()
  if (history.length === 0) return <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, fontFamily: "'DM Sans',sans-serif", padding: 20 }}>No document history yet.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {history.map((entry: any) => (
        <div key={entry.id} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>{entry.title}</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'var(--text-dim)' }}>{new Date(entry.generatedAt).toLocaleString()} · {entry.wordCount} words · {entry.sectionCount} sections</div>
          </div>
          <button onClick={() => onRestore(entry.content)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>Restore</button>
        </div>
      ))}
    </div>
  )
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

function ToggleSetting({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'var(--text)' }}>{label}</div>
        {hint && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{hint}</div>}
      </div>
      <button onClick={() => onChange(!checked)} style={{ width: 36, height: 20, borderRadius: 10, border: 'none', flexShrink: 0, marginTop: 2, background: checked ? 'var(--accent)' : 'var(--surface-2)', cursor: 'pointer', position: 'relative', transition: 'background 0.15s' }}>
        <span style={{ position: 'absolute', top: 3, width: 14, height: 14, borderRadius: '50%', background: checked ? '#000' : 'var(--text-dim)', left: checked ? 19 : 3, transition: 'left 0.15s' }} />
      </button>
    </div>
  )
}

function TBtn({ children, onClick, disabled, primary }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ display: 'flex', alignItems: 'center', gap: 5, background: primary ? 'var(--accent)' : 'transparent', border: primary ? 'none' : '1px solid var(--border)', borderRadius: 7, padding: '6px 12px', cursor: disabled ? 'not-allowed' : 'pointer', color: primary ? '#000' : 'var(--text-muted)', fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: primary ? 600 : 400, opacity: disabled ? 0.6 : 1, transition: 'all 0.12s', flexShrink: 0 }}
      onMouseEnter={e => { if (!disabled && !primary) { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text)' } }}
      onMouseLeave={e => { if (!primary) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' } }}
    >{children}</button>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '7px 10px', color: 'var(--text)',
  fontFamily: "'DM Sans',sans-serif", fontSize: 13, outline: 'none', boxSizing: 'border-box'
}
