import React, { useState } from 'react'
import { X, Layers, Cpu, Code, BookOpen, ExternalLink, Sliders, Check } from 'lucide-react'
import type { ProjectTemplate } from './types'

interface TemplateDetailModalProps {
  template: ProjectTemplate
  onClose: () => void
  onLoad: () => void
}

export function TemplateDetailModal({ template, onClose, onLoad }: TemplateDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'context' | 'parameters' | 'code' | 'bom' | 'resources'>('context')
  const [isCopied, setIsCopied] = useState(false)

  const handleCopyCode = () => {
    if (template.starterCode?.content) {
      navigator.clipboard.writeText(template.starterCode.content)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  // Basic styling helpers
  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 5, 12, 0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  }

  const modalContainerStyle: React.CSSProperties = {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    width: '100%',
    maxWidth: 800,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  }

  const tabButtonStyle = (tab: typeof activeTab): React.CSSProperties => {
    const active = activeTab === tab
    return {
      padding: '10px 16px',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 11,
      
      
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: active ? 'var(--accent)' : 'var(--text-muted)',
      borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
      transition: 'all 0.15s ease',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }
  }

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContainerStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                fontWeight: 600,
                
                color: 'var(--accent)',
                backgroundColor: 'rgba(148, 163, 184, 0.08)',
                padding: '2px 8px',
                borderRadius: 4,
                border: '1px solid rgba(148, 163, 184, 0.15)'
              }}>
                {template.category}
              </span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                fontWeight: 500,
                color: 'var(--text-muted)',
                backgroundColor: 'var(--surface-2)',
                border: '1px solid var(--border)',
                padding: '2px 8px',
                borderRadius: 4,
                textTransform: 'uppercase',
              }}>
                {template.difficulty}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
                Est. {template.estimatedHours}h
              </span>
            </div>
            <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, fontWeight: 700, margin: '4px 0 2px', color: 'var(--text)' }}>
              {template.name}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              {template.tagline}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }} data-tooltip="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', paddingLeft: 24, paddingRight: 24, overflowX: 'auto' }}>
          <button style={tabButtonStyle('context')} onClick={() => setActiveTab('context')}>
            <Cpu size={12} /> Overview
          </button>
          <button style={tabButtonStyle('parameters')} onClick={() => setActiveTab('parameters')}>
            <Sliders size={12} /> Parameters
          </button>
          <button style={tabButtonStyle('code')} onClick={() => setActiveTab('code')}>
            <Code size={12} /> Starter Code
          </button>
          <button style={tabButtonStyle('bom')} onClick={() => setActiveTab('bom')}>
            <Layers size={12} /> Starter BOM
          </button>
          <button style={tabButtonStyle('resources')} onClick={() => setActiveTab('resources')}>
            <BookOpen size={12} /> Resources
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* TAB: OVERVIEW */}
          {activeTab === 'context' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11,  color: 'var(--text-muted)',  margin: '0 0 6px' }}>Project Description</h4>
                <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>
                  {template.projectContext.description}
                </p>
              </div>

              <div>
                <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11,  color: 'var(--text-muted)',  margin: '0 0 6px' }}>Project Tags</h4>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {template.tags.map(tag => (
                    <span key={tag} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)', background: 'var(--bg-2)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)' }}>
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {template.notebookEntries && template.notebookEntries.length > 0 && (
                <div>
                  <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11,  color: 'var(--text-muted)',  margin: '0 0 8px' }}>Preloaded Notebook Entries</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {template.notebookEntries.map((entry, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{
                            fontFamily: "'JetBrains Mono', monospace", fontSize: 9,  
                            padding: '1px 5px', borderRadius: 3,
                            color: entry.type === 'DECISION' ? 'var(--accent)' : 'var(--text-muted)',
                            backgroundColor: entry.type === 'DECISION' ? 'rgba(148, 163, 184, 0.08)' : 'var(--surface-2)',
                            border: entry.type === 'DECISION' ? '1px solid rgba(148, 163, 184, 0.25)' : '1px solid var(--border)',
                          }}>
                            {entry.type}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', fontFamily: "'JetBrains Mono', monospace" }}>
                            {entry.title}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                          {entry.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: PARAMETERS */}
          {activeTab === 'parameters' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  {template.parameterPlayground.description}
                </p>
              </div>

              <div>
                <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11,  color: 'var(--text-muted)',  margin: '0 0 8px' }}>System Variables</h4>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)' }}>Variable</th>
                        <th style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)' }}>Range</th>
                        <th style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)' }}>Default</th>
                        <th style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)' }}>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {template.parameterPlayground.parameters.map((p) => (
                        <tr key={p.name} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '8px 12px', color: 'var(--text)', fontWeight: 600 }}>{p.label}</td>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: '8px 12px', color: 'var(--text-dim)' }}>{p.min} – {p.max}</td>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '8px 12px', color: 'var(--accent)' }}>{p.default}</td>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: '8px 12px', color: 'var(--text-muted)' }}>{p.unit || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11,  color: 'var(--text-muted)',  margin: '0 0 8px' }}>Solved Output Metrics</h4>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)' }}>Output Metric</th>
                        <th style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)' }}>Analytical Expression</th>
                        <th style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)' }}>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {template.parameterPlayground.equations.map((eq) => (
                        <tr key={eq.outputName} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '8px 12px', color: 'var(--text)' }}>{eq.label}</td>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: '8px 12px', color: 'var(--accent-2)', whiteSpace: 'nowrap' }}><code>{eq.formula_js}</code></td>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: '8px 12px', color: 'var(--text-muted)' }}>{eq.unit || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: STARTER CODE */}
          {activeTab === 'code' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', minHeight: 300 }}>
              {template.starterCode ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)' }}>
                      Filename: <code style={{ color: 'var(--text)' }}>{template.starterCode.filename}</code> ({template.starterCode.language})
                    </span>
                    <button className="btn" onClick={handleCopyCode} style={{ fontSize: 11, padding: '4px 10px', display: 'flex', gap: 6, alignItems: 'center' }}>
                      {isCopied ? <Check size={12} style={{ color: '#7aaa8a' }} /> : null}
                      {isCopied ? 'Copied' : 'Copy Code'}
                    </button>
                  </div>
                  <pre style={{
                    flex: 1,
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 16,
                    overflow: 'auto',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: '#e2e4f0',
                    margin: 0,
                  }}>
                    {template.starterCode.content}
                  </pre>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: 'var(--text-muted)', fontSize: 13 }}>
                  This template does not require physical starter code.
                </div>
              )}
            </div>
          )}

          {/* TAB: BOM */}
          {activeTab === 'bom' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  Below are the components preloaded into your Bill of Materials (BOM) when this template is loaded.
                </p>
              </div>

              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)' }}>Qty</th>
                      <th style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)' }}>Description</th>
                      <th style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)' }}>Value / Part</th>
                      <th style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)' }}>Package</th>
                      <th style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)' }}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {template.bomStarter.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '8px 12px', color: 'var(--accent)', fontWeight: 600 }}>{item.quantity}</td>
                        <td style={{ fontSize: 12, padding: '8px 12px', color: 'var(--text)' }}>{item.description}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '8px 12px', color: 'var(--text-muted)' }}>{item.value}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: '8px 12px', color: 'var(--text-dim)' }}>{item.package}</td>
                        <td style={{ fontSize: 11, padding: '8px 12px', color: 'var(--text-muted)' }}>{item.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: RESOURCES */}
          {activeTab === 'resources' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {template.resources.map((res, idx) => (
                <a
                  key={idx}
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '12px 16px',
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.4)'
                    e.currentTarget.style.backgroundColor = 'rgba(148, 163, 184, 0.02)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.backgroundColor = 'var(--bg-2)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{res.title}</span>
                    <span style={{
                      alignSelf: 'flex-start',
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 8,  
                      color: 'var(--text-dim)'
                    }}>
                      {res.type}
                    </span>
                  </div>
                  <ExternalLink size={14} style={{ color: 'var(--text-muted)' }} />
                </a>
              ))}
            </div>
          )}

        </div>

        {/* Footer actions */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button className="btn" onClick={onClose} style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
            Back to Gallery
          </button>
          <button
            onClick={onLoad}
            style={{
              padding: '8px 18px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              background: 'var(--accent)',
              color: 'var(--bg)',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(148, 163, 184, 0.25)',
              transition: 'transform 0.15s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
          >
            Load into ENGINGUITY
          </button>
        </div>
      </div>
    </div>
  )
}
