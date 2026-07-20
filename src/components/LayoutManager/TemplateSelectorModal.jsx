import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { useWorkspace } from '../../context/WorkspaceContext'
import { layoutEngine } from '../../engine/layoutEngine'
import { speakText } from '../../engine/voiceEngine'

const MODULE_SHORT_NAMES = {
  'debug-console': 'Debug',
  'cad-viewer': 'CAD',
  'parameter-playground': 'Params',
  'notebook': 'Notebook',
  'bom': 'BOM',
  'circuit-sim': 'Circuit',
  'formula-lab': 'Formula',
  'datasheet': 'Datasheet',
  'jarvis': 'Jarvis',
  'supply-chain': 'Supply Chain',
  'project-ideas': 'Ideas',
  'templates': 'Templates'
}

function getModuleShortName(moduleId) {
  return MODULE_SHORT_NAMES[moduleId] || moduleId || 'Window'
}

function generateLayoutSVG(windows, width = 340, height = 120) {
  const svgWindows = windows.map(win => {
    const parsePercent = (val, maxVal) => {
      return Math.floor((parseFloat(val) / 100) * maxVal)
    }
    
    const parseDim = (val, maxVal) => {
      if (typeof val === 'string' && val.endsWith('%')) {
        return parsePercent(val, maxVal)
      }
      return parseFloat(val)
    }

    const x = parseDim(win.x, width)
    const y = parseDim(win.y, height)
    const w = parseDim(win.width, width)
    const h = parseDim(win.height, height)
    
    const moduleId = win.moduleId || win.type || ''

    return `
      <rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" 
        fill="#1a1a1a" stroke="#2a2a45" stroke-width="1" rx="2"/>
      <text x="${x + 6}" y="${y + 14}" 
        fill="#4a5568" font-size="8" font-family="Geist, sans-serif">
        ${getModuleShortName(moduleId)}
      </text>
    `
  }).join('')
  
  return `<svg width="${width}" height="${height}" 
    xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#111111"/>
    ${svgWindows}
  </svg>`
}

export const TemplateSelectorModal = ({ isOpen, onClose }) => {
  const { applyLayoutState } = useWorkspace()

  // Escape key to close modal
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const presets = layoutEngine.getPresetLayouts()

  const handleSelectPreset = (preset) => {
    applyLayoutState(preset)
    
    // Check if Jarvis is awake and speak
    const isJarvisAwake = localStorage.getItem('enginguity_jarvis_awake') === 'true'
    if (isJarvisAwake) {
      speakText(`${preset.name} workspace loaded.`)
    }
    
    // Set onboarded state
    localStorage.setItem('enginguity_workspace_onboarded', 'true')
    onClose()
  }

  const handleStartBlank = () => {
    // Clear all windows to start with blank
    applyLayoutState({ id: null, windows: [] })
    
    // Set onboarded state
    localStorage.setItem('enginguity_workspace_onboarded', 'true')
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: 720,
          maxHeight: '90vh',
          background: 'var(--surface)',
          border: '1px solid var(--border-bright)',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 400, color: 'var(--text)', fontFamily: "'Geist', 'DM Sans Variable', 'DM Sans', sans-serif" }}>
              Choose a starting layout
            </span>
            <button
              onClick={handleStartBlank}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--text-dim)',
                fontSize: 13,
                textDecoration: 'underline',
                cursor: 'pointer',
                fontFamily: "'Geist', 'DM Sans Variable', 'DM Sans', sans-serif"
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
            >
              Or start with a blank workspace
            </button>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2 }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Template Grid (2 columns) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            padding: 24,
            overflowY: 'auto',
            maxHeight: 'calc(90vh - 65px)',
          }}
        >
          {presets.map((preset) => (
            <div
              key={preset.id}
              onClick={() => handleSelectPreset(preset)}
              style={{
                height: 200,
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                overflow: 'hidden',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                transition: 'border-color 0.15s ease, transform 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-bright)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {/* Layout Preview SVG */}
              <div
                style={{ height: 120, overflow: 'hidden', display: 'flex', justifyContent: 'center', background: '#111111' }}
                dangerouslySetInnerHTML={{ __html: generateLayoutSVG(preset.windows, 344, 120) }}
              />
              {/* Bottom details */}
              <div
                style={{
                  height: 80,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 400, color: 'var(--text)', fontFamily: "'Geist', 'DM Sans Variable', 'DM Sans', sans-serif", marginBottom: 2 }}>
                    {preset.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      color: 'var(--text-muted)',
                      fontFamily: "'Geist', 'DM Sans Variable', 'DM Sans', sans-serif",
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {preset.description}
                  </div>
                </div>
                {/* Tags */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {preset.tags &&
                    preset.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 9,
                          padding: '1px 6px',
                          borderRadius: 10,
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border-bright)',
                          color: 'var(--text-muted)',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
