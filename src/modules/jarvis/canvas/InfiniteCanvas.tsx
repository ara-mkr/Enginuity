import { useRef, useState, useEffect, useCallback } from 'react'
import type { CanvasItem, CanvasTransform, CanvasGroup } from '../types'
import { VideoItem } from './items/VideoItem'
import { CameraItem } from './CameraItem'

interface InfiniteCanvasProps {
  items: CanvasItem[]
  groups: CanvasGroup[]
  transform: CanvasTransform
  onTransformChange: (t: CanvasTransform) => void
  onItemMove: (id: string, x: number, y: number) => void
  onItemResize: (id: string, w: number, h: number) => void
  onItemRemove: (id: string) => void
  onClearAll: () => void
  onUndo: () => void
  onAnalyzePhoto: (itemId: string) => void
  onCameraStart: () => void
  onCameraCapture: () => void
  onCameraStop: () => void
  cameraVideoRef: React.RefObject<HTMLVideoElement>
  showWelcome: boolean
  canvasBg: string
  canvasWorldRef: React.RefObject<HTMLDivElement>
  onExport: () => void
  onLogMeasurement?: (reading: any, itemId: string) => void
  onCenterOnItem?: (itemId: string) => void
  onFindDatasheet?: (partNumber: string) => void
  onAddPartToBOM?: (component: any) => void
  onTimerAction?: (timerId: string, action: 'add_minute' | 'pause_toggle' | 'cancel') => void
  onOrderListAction?: (action: 'export_csv' | 'read_list' | 'clear_purchased' | 'toggle_purchased', itemData?: any) => void
  onGuidedModeAction?: (action: 'prev' | 'next') => void
  onOpenInCircuitSim?: (netlist: string) => void
  onOpenInDatasheet?: (component: any) => void
}

// ─── Photo item with local expand state ───────────────────────────────────────
function PhotoItem({
  item,
  onAnalyze,
}: {
  item: CanvasItem
  onAnalyze: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { dataURL, analysis, analyzing } = item.content as {
    dataURL: string
    analysis: string | null
    analyzing: boolean
  }

  return (
    <div
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        maxWidth: 480,
        position: 'relative',
      }}
    >
      <img
        src={dataURL}
        alt={item.title || 'Photo'}
        style={{ display: 'block', maxWidth: '100%', objectFit: 'contain' }}
      />
      <div
        style={{
          background: 'rgba(17,17,17,0.88)',
          backdropFilter: 'blur(4px)',
          padding: '8px 12px',
        }}
      >
        {analyzing ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Analyzing…</div>
        ) : analysis ? (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {expanded ? analysis : analysis.slice(0, 100) + (analysis.length > 100 ? '…' : '')}
            </div>
            {analysis.length > 100 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                style={{
                  marginTop: 4,
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {expanded ? 'Show less ↑' : 'Read more ↓'}
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => onAnalyze(item.id)}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--accent)',
              fontSize: 12,
              cursor: 'pointer',
              padding: '4px 10px',
            }}
          >
            <span style={{ color: '#b8d4f0' }}>⊕</span> Analyze
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Data doc item ─────────────────────────────────────────────────────────────
function DataDocItem({ item }: { item: CanvasItem }) {
  const { source, generatedAt, sections = [] } = item.content as {
    source: string
    generatedAt: number
    sections: Array<{ heading: string; content: string; items: string[] }>
  }

  const exportMd = () => {
    const lines: string[] = [`# ${item.title}`, `*Source: ${source}*`, '']
    sections.forEach((s) => {
      lines.push(`## ${s.heading}`)
      if (s.content) lines.push(s.content)
      s.items?.forEach((it) => lines.push(`- ${it}`))
      lines.push('')
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(item.title || 'doc').replace(/\s+/g, '-').toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        width: 360,
        maxHeight: 480,
        overflowY: 'auto',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          background: 'var(--bg-2)',
          borderBottom: '1px solid var(--border)',
          borderRadius: '8px 8px 0 0',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>{source}</span>
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', textAlign: 'center' }}>{item.title}</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>
          {new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <button
          title="Export as Markdown"
          onClick={exportMd}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontSize: 13,
            padding: '0 2px',
            flexShrink: 0,
          }}
        >
          ↓
        </button>
      </div>

      {/* Sections */}
      {sections.map((s, i) => (
        <div key={i}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-dim)',
              borderBottom: '1px solid var(--border)',
              padding: '8px 14px 4px',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {s.heading}
          </div>
          {s.content && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-muted)',
                padding: '6px 14px',
                lineHeight: 1.5,
              }}
            >
              {s.content}
            </div>
          )}
          {s.items?.map((it, j) => (
            <div
              key={j}
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                padding: '2px 14px 2px 22px',
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: 'var(--border-bright)' }}>· </span>
              {it}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Generic item content ──────────────────────────────────────────────────────
const quietButtonStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-muted)',
  fontSize: 11,
  cursor: 'pointer',
  padding: '4px 8px',
}

const buttonStyle: React.CSSProperties = {
  display: 'block',
  padding: '6px 12px',
  border: '1px solid var(--border)',
  borderRadius: 5,
  color: 'var(--text)',
  fontSize: 12,
  textDecoration: 'none',
  textAlign: 'center',
}

const COLOR_VALUES = {
  black: 0, brown: 1, red: 2, orange: 3, yellow: 4,
  green: 5, blue: 6, violet: 7, grey: 8, white: 9
}
const MULTIPLIERS = {
  black: 1, brown: 10, red: 100, orange: 1000,
  yellow: 10000, green: 100000, blue: 1000000,
  gold: 0.1, silver: 0.01
}
const TOLERANCES = {
  brown: '1%', red: '2%', gold: '5%', silver: '10%'
}

function decodeResistor(bands: string[]): string | null {
  if (!bands || bands.length < 3) return null
  const b = bands.map(x => x.toLowerCase().trim())
  const val1 = COLOR_VALUES[b[0] as keyof typeof COLOR_VALUES]
  const val2 = COLOR_VALUES[b[1] as keyof typeof COLOR_VALUES]
  if (val1 === undefined || val2 === undefined) return null
  
  let value = 0
  let tolerance = ''
  
  if (b.length === 3) {
    const mult = MULTIPLIERS[b[2] as keyof typeof MULTIPLIERS]
    if (mult === undefined) return null
    value = (val1 * 10 + val2) * mult
  } else if (b.length === 4) {
    const mult = MULTIPLIERS[b[2] as keyof typeof MULTIPLIERS]
    if (mult === undefined) return null
    value = (val1 * 10 + val2) * mult
    tolerance = TOLERANCES[b[3] as keyof typeof TOLERANCES] || ''
  } else if (b.length === 5) {
    const val3 = COLOR_VALUES[b[2] as keyof typeof COLOR_VALUES]
    if (val3 === undefined) return null
    const mult = MULTIPLIERS[b[3] as keyof typeof MULTIPLIERS]
    if (mult === undefined) return null
    value = (val1 * 100 + val2 * 10 + val3) * mult
    tolerance = TOLERANCES[b[4] as keyof typeof TOLERANCES] || ''
  } else {
    return null
  }
  
  let valStr = ''
  if (value >= 1e6) valStr = `${(value / 1e6).toFixed(1).replace(/\.0$/, '')}MΩ`
  else if (value >= 1e3) valStr = `${(value / 1e3).toFixed(1).replace(/\.0$/, '')}kΩ`
  else valStr = `${value.toFixed(1).replace(/\.0$/, '')}Ω`
  
  return valStr + (tolerance ? ` ±${tolerance}` : '')
}

// Normalize a resistance string (e.g. "10kΩ", "10K", "10 kOhm", "10000")
// into a plain ohm number so two representations can be compared.
function cleanResistance(input: string | number | null | undefined): number | null {
  if (input == null) return null
  const s = String(input).toLowerCase().replace(/\s+/g, '').replace(/ω|ohms?/g, '')
  if (!s) return null
  const m = s.match(/^([\d.]+)\s*([kmg])?/i)
  if (!m) return null
  const num = parseFloat(m[1])
  if (!isFinite(num)) return null
  const suffix = (m[2] || '').toLowerCase()
  const mult = suffix === 'k' ? 1e3 : suffix === 'm' ? 1e6 : suffix === 'g' ? 1e9 : 1
  return Math.round(num * mult)
}

function NotebookConfirmItem({ item }: { item: CanvasItem }) {
  const [opacity, setOpacity] = useState(1)
  useEffect(() => {
    const timer = setTimeout(() => {
      setOpacity(0)
    }, 6000)
    return () => clearTimeout(timer)
  }, [])
  
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      padding: '10px 14px',
      width: 240,
      opacity: opacity,
      transition: 'opacity 2s ease',
    }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
        ✓ Added to Notebook
      </div>
      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>
        {item.content?.entry?.title}
      </div>
      <span style={{
        fontSize: 10,
        color: 'var(--text-dim)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '1px 4px',
        textTransform: 'uppercase'
      }}>
        {item.content?.entry?.type}
      </span>
    </div>
  )
}

function TimerCard({
  item,
  onTimerAction
}: {
  item: CanvasItem
  onTimerAction?: (timerId: string, action: 'add_minute' | 'pause_toggle' | 'cancel') => void
}) {
  const { timerId, durationSeconds, endTime, label, status } = item.content
  const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.round((endTime - Date.now()) / 1000)))
  
  useEffect(() => {
    if (status !== 'running') {
      const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000))
      setTimeLeft(remaining)
      return
    }
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining <= 0) {
        clearInterval(timer)
      }
    }, 500)
    return () => clearInterval(timer)
  }, [endTime, status])
  
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    const pad = (n: number) => String(n).padStart(2, '0')
    if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
    return `${pad(m)}:${pad(s)}`
  }
  
  const progressPercent = durationSeconds > 0 ? (timeLeft / durationSeconds) * 100 : 0
  const isDone = timeLeft <= 0 || status === 'done'
  
  return (
    <div style={{
      background: 'var(--surface)',
      border: isDone ? '1.5px dashed var(--border-bright)' : '1px solid var(--border)',
      borderRadius: 8,
      padding: 14,
      width: 200,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label || 'Timer'}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, color: 'var(--text)', fontWeight: 600, marginBottom: 8 }}>
        {isDone ? '00:00' : formatTime(timeLeft)}
      </div>
      
      {/* Progress Bar */}
      <div style={{ height: 2, background: 'var(--border)', width: '100%', marginBottom: 12, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          background: 'var(--border-bright)',
          width: `${progressPercent}%`,
          transition: 'width 1s linear'
        }} />
      </div>
      
      {isDone && (
        <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, marginBottom: 10 }}>
          Done!
        </div>
      )}
      
      {/* Buttons */}
      <div style={{ display: 'flex', gap: 4 }} onMouseDown={e => e.stopPropagation()}>
        {!isDone && (
          <>
            <button
              onClick={() => onTimerAction?.(timerId, 'add_minute')}
              style={quietButtonStyle}
            >
              +1 min
            </button>
            <button
              onClick={() => onTimerAction?.(timerId, 'pause_toggle')}
              style={quietButtonStyle}
            >
              {status === 'paused' ? 'Resume' : 'Pause'}
            </button>
          </>
        )}
        <button
          onClick={() => onTimerAction?.(timerId, 'cancel')}
          style={quietButtonStyle}
        >
          {isDone ? 'Dismiss' : 'Cancel'}
        </button>
      </div>
    </div>
  )
}

function QuickSpiceChart({ data }: { data: { type: string; xLabel: string; yLabel: string; points: Array<{ x: number; y: number }> } }) {
  const points = data.points || []
  if (points.length === 0) return null
  
  const w = 260
  const h = 120
  const paddingLeft = 35
  const paddingBottom = 20
  const paddingTop = 10
  const paddingRight = 10
  
  const graphW = w - paddingLeft - paddingRight
  const graphH = h - paddingTop - paddingBottom
  
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  
  const svgPoints = points.map(p => {
    const sx = paddingLeft + ((p.x - minX) / rangeX) * graphW
    const sy = paddingTop + graphH - ((p.y - minY) / rangeY) * graphH
    return `${sx},${sy}`
  })
  
  const pathD = `M ${svgPoints.join(' L ')}`
  
  return (
    <div style={{ marginTop: 10, marginBottom: 10 }}>
      <svg width={w} height={h} style={{ overflow: 'visible' }}>
        <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + graphH} stroke="var(--border)" strokeWidth="1" />
        <line x1={paddingLeft} y1={paddingTop + graphH} x2={paddingLeft + graphW} y2={paddingTop + graphH} stroke="var(--border)" strokeWidth="1" />
        
        <path d={pathD} fill="none" stroke="#94a5ba" strokeWidth="1.5" />
        
        <text
          x={5}
          y={h / 2}
          fill="var(--text-dim)"
          fontSize="8"
          textAnchor="start"
          transform={`rotate(-90 5 ${h / 2})`}
        >
          {data.yLabel}
        </text>
        
        <text
          x={paddingLeft + graphW / 2}
          y={h - 2}
          fill="var(--text-dim)"
          fontSize="8"
          textAnchor="middle"
        >
          {data.xLabel}
        </text>
        
        <text x={paddingLeft - 4} y={paddingTop + 8} fill="var(--text-dim)" fontSize="8" textAnchor="end">
          {maxY.toFixed(1)}
        </text>
        <text x={paddingLeft - 4} y={paddingTop + graphH} fill="var(--text-dim)" fontSize="8" textAnchor="end">
          {minY.toFixed(1)}
        </text>
        <text x={paddingLeft} y={paddingTop + graphH + 10} fill="var(--text-dim)" fontSize="8" textAnchor="middle">
          {minX.toFixed(0)}
        </text>
        <text x={paddingLeft + graphW} y={paddingTop + graphH + 10} fill="var(--text-dim)" fontSize="8" textAnchor="middle">
          {maxX.toFixed(0)}
        </text>
      </svg>
    </div>
  )
}

function GuidedStepsCard({
  item,
  onGuidedModeAction
}: {
  item: CanvasItem
  onGuidedModeAction?: (action: 'prev' | 'next') => void
}) {
  const { guide, currentStep } = item.content
  const total = guide.steps.length
  const step = guide.steps[currentStep]
  const pct = total > 1 ? (currentStep / (total - 1)) * 100 : 100
  
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: 16,
      width: 320,
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>
        {guide.title}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
        Step {currentStep + 1} of {total}
      </div>
      
      {/* Progress bar */}
      <div style={{ height: 2, background: 'var(--border)', width: '100%', marginBottom: 12, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          background: 'var(--border-bright)',
          width: `${pct}%`,
          transition: 'width 0.3s ease'
        }} />
      </div>
      
      {/* Steps List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {guide.steps.map((s: any, idx: number) => {
          const isCompleted = idx < currentStep
          const isActive = idx === currentStep
          
          return (
            <div
              key={s.number}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: isActive ? '8px' : '4px 8px',
                borderRadius: 6,
                background: isActive ? 'var(--surface-2)' : 'transparent',
                borderLeft: isActive ? '2px solid #94a5ba' : 'none',
                opacity: idx > currentStep ? 0.6 : 1,
              }}
            >
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: isActive ? '#94a5ba' : 'var(--text-dim)',
                marginTop: 2
              }}>
                {s.number}.
              </span>
              <span style={{
                fontSize: 13,
                color: isCompleted ? 'var(--text-dim)' : 'var(--text)',
                textDecoration: isCompleted ? 'line-through' : 'none',
                flex: 1,
                lineHeight: 1.4
              }}>
                {s.action}
              </span>
              {isCompleted && <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>✓</span>}
            </div>
          )
        })}
      </div>
      
      {/* Current Step Detail */}
      {step && (
        <div style={{
          background: 'var(--bg-2)',
          padding: 10,
          borderRadius: 6,
          marginBottom: 14,
          border: '1px solid var(--border)'
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>✓ Check:</span>
            <span style={{ color: 'var(--text-muted)' }}>{step.verification}</span>
          </div>
          {step.warning && (
            <div style={{ fontSize: 12, color: '#b08080', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <span>! Warning:</span>
              <span>{step.warning}</span>
            </div>
          )}
        </div>
      )}
      
      {/* Footer Controls */}
      <div style={{ display: 'flex', gap: 8 }} onMouseDown={e => e.stopPropagation()}>
        <button
          onClick={() => onGuidedModeAction?.('prev')}
          disabled={currentStep === 0}
          style={{ ...quietButtonStyle, opacity: currentStep === 0 ? 0.5 : 1 }}
        >
          ← Back
        </button>
        <button
          onClick={() => onGuidedModeAction?.('next')}
          disabled={currentStep === total - 1}
          style={{ ...quietButtonStyle, opacity: currentStep === total - 1 ? 0.5 : 1 }}
        >
          Next →
        </button>
      </div>
    </div>
  )
}

function OrderListCard({
  item,
  onOrderListAction
}: {
  item: CanvasItem
  onOrderListAction?: (action: 'export_csv' | 'read_list' | 'clear_purchased' | 'toggle_purchased', itemData?: any) => void
}) {
  const items = item.content.items || []
  
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: 14,
      width: 280,
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }} onMouseDown={e => e.stopPropagation()}>
        <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
          Order List ({items.length} items)
        </span>
        <button
          onClick={() => onOrderListAction?.('export_csv')}
          style={quietButtonStyle}
        >
          Export CSV
        </button>
      </div>
      
      {/* Items list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, maxHeight: 200, overflowY: 'auto' }}>
        {items.map((it: any) => (
          <div
            key={it.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: it.purchased ? 0.6 : 1,
            }}
            onMouseDown={e => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={!!it.purchased}
              onChange={() => onOrderListAction?.('toggle_purchased', { subItemId: it.id })}
              style={{ cursor: 'pointer' }}
            />
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              color: 'var(--text)',
              minWidth: 35
            }}>
              {it.quantity}{it.unit || 'pcs'}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <span style={{
                fontSize: 13,
                color: 'var(--text-muted)',
                textDecoration: it.purchased ? 'line-through' : 'none',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap'
              }}>
                {it.description}
              </span>
              {it.partNumber && (
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  color: 'var(--text-dim)'
                }}>
                  {it.partNumber}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onMouseDown={e => e.stopPropagation()}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          Total: {items.length} items
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => onOrderListAction?.('read_list')} style={quietButtonStyle}>
            Read List
          </button>
          <button onClick={() => onOrderListAction?.('clear_purchased')} style={quietButtonStyle}>
            Clear Purchased
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Image item with loading / error states ───────────────────────────────────
function ImageItem({ item }: { item: CanvasItem }) {
  const [imgState, setImgState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const { src, caption, source, searchURL } = item.content as {
    src: string
    caption?: string
    source?: string
    searchURL?: string
  }

  return (
    <div
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        width: item.width || 320,
      }}
    >
      <div
        style={{
          position: 'relative',
          height: item.height || 200,
          background: '#0e0e1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {imgState === 'loading' && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Geist Mono, monospace' }}>
            Loading…
          </div>
        )}
        {imgState === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Image unavailable</div>
            {searchURL && (
              <a
                href={searchURL}
                target="_blank"
                rel="noopener noreferrer"
                onMouseDown={(e) => e.stopPropagation()}
                style={{ fontSize: 11, color: '#94a5ba' }}
              >
                Search Google Images ↗
              </a>
            )}
          </div>
        )}
        <img
          src={src}
          alt={caption || item.title || ''}
          onLoad={() => setImgState('loaded')}
          onError={() => setImgState('error')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: imgState === 'loaded' ? 'block' : 'none',
          }}
          crossOrigin="anonymous"
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 10px',
          background: 'rgba(13,13,26,0.9)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'Geist Mono, monospace' }}>
          {source || 'Image'}
        </span>
        {searchURL && (
          <a
            href={searchURL}
            target="_blank"
            rel="noopener noreferrer"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ fontSize: 10, color: 'var(--text-dim)', textDecoration: 'none' }}
            title="Search for more images"
          >
            More ↗
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Generic item content ──────────────────────────────────────────────────────
function ItemContent({
  item,
  onAnalyzePhoto,
  onCameraCapture,
  onCameraStop,
  cameraVideoRef,
  onLogMeasurement,
  onCenterOnItem,
  onFindDatasheet,
  onAddPartToBOM,
  onTimerAction,
  onOrderListAction,
  onGuidedModeAction,
  onOpenInCircuitSim,
  onOpenInDatasheet,
}: {
  item: CanvasItem
  onAnalyzePhoto: (id: string) => void
  onCameraCapture: () => void
  onCameraStop: () => void
  cameraVideoRef: React.RefObject<HTMLVideoElement>
  onLogMeasurement?: (reading: any, itemId: string) => void
  onCenterOnItem?: (itemId: string) => void
  onFindDatasheet?: (partNumber: string) => void
  onAddPartToBOM?: (component: any) => void
  onTimerAction?: (timerId: string, action: 'add_minute' | 'pause_toggle' | 'cancel') => void
  onOrderListAction?: (action: 'export_csv' | 'read_list' | 'clear_purchased' | 'toggle_purchased', itemData?: any) => void
  onGuidedModeAction?: (action: 'prev' | 'next') => void
  onOpenInCircuitSim?: (netlist: string) => void
  onOpenInDatasheet?: (component: any) => void
}) {
  const [collapsed, setCollapsed] = useState(true)

  switch (item.type) {
    case 'text':
      return (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 16,
            minWidth: 220,
            maxWidth: 480,
          }}
        >
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: 'var(--text-dim)',
              marginBottom: 10,
              lineHeight: 1.4,
            }}
          >
            {item.content.question || item.title}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
            {item.content.answer}
          </div>
        </div>
      )

    case 'calculation':
      return (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 16,
            minWidth: 220,
          }}
        >
          {item.content.formula ? (
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: 'var(--text-muted)',
                marginBottom: 10,
              }}
            >
              {item.content.formula}
            </div>
          ) : null}
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 22,
              color: 'var(--text)',
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            {item.content.result}
          </div>
          {item.content.steps?.map((s: string, i: number) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {s}
            </div>
          ))}
        </div>
      )

    case 'image':
      return <ImageItem item={item} />

    case 'link':
      return (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 14,
            width: 280,
          }}
        >
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: 'var(--text-dim)',
              marginBottom: 8,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.content.url}
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text)',
              fontWeight: 500,
              marginBottom: 6,
              lineHeight: 1.4,
            }}
          >
            {item.content.title}
          </div>
          {item.content.description && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                marginBottom: 12,
                lineHeight: 1.4,
              }}
            >
              {item.content.description}
            </div>
          )}
          <a
            href={item.content.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '6px 12px',
              border: '1px solid var(--border-bright)',
              borderRadius: 5,
              color: 'var(--text)',
              fontSize: 13,
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--surface-2)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
          >
            Open →
          </a>
        </div>
      )

    case 'code':
      return (
        <div
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 14,
            minWidth: 300,
            maxWidth: 600,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
              }}
            >
              {item.content.language}
            </span>
          </div>
          <pre
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              color: 'var(--text)',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.6,
            }}
          >
            {item.content.code}
          </pre>
        </div>
      )

    case 'note':
      return (
        <div
          contentEditable
          suppressContentEditableWarning
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-bright)',
            borderRadius: 8,
            padding: 14,
            minWidth: 180,
            minHeight: 80,
            fontSize: 14,
            color: 'var(--text)',
            lineHeight: 1.6,
            outline: 'none',
            cursor: 'text',
          }}
          onBlur={(e) => {
            item.content.text = e.currentTarget.textContent || ''
          }}
        >
          {item.content.text}
        </div>
      )

    case 'photo':
      return <PhotoItem item={item} onAnalyze={onAnalyzePhoto} />

    case 'camera':
      return (
        <CameraItem
          item={item}
          onCapture={onCameraCapture}
          onClose={onCameraStop}
        />
      )

    case 'search_suggestion': {
      const { originalQuery, suggestion, youtubeSearchUrl, googleSearchUrl, links, note } =
        item.content as {
          originalQuery: string
          suggestion: string
          youtubeSearchUrl?: string
          googleSearchUrl?: string
          links?: { mouser?: string; digikey?: string; lcsc?: string }
          note?: string
        }
        
      if (links || note) {
        return (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 16,
            width: 300,
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 6 }}>
              Datasheet Not Found
            </div>
            <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, marginBottom: 8 }}>
              {originalQuery}
            </div>
            {note && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{note}</div>}
            {suggestion && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>Try searching: {suggestion}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onMouseDown={e => e.stopPropagation()}>
              {links?.mouser && (
                <a href={links.mouser} target="_blank" rel="noopener noreferrer" style={buttonStyle}>
                  Search Mouser
                </a>
              )}
              {links?.digikey && (
                <a href={links.digikey} target="_blank" rel="noopener noreferrer" style={buttonStyle}>
                  Search DigiKey
                </a>
              )}
              {links?.lcsc && (
                <a href={links.lcsc} target="_blank" rel="noopener noreferrer" style={buttonStyle}>
                  Search LCSC
                </a>
              )}
            </div>
          </div>
        )
      }

      return (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 16,
            width: 300,
          }}
        >
          <div
            style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 6 }}
          >
            Couldn't find exact match
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 14 }}>
            {originalQuery}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <a
              href={youtubeSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: '6px 12px',
                border: '1px solid var(--border)',
                borderRadius: 5,
                color: 'var(--text)',
                fontSize: 12,
                textDecoration: 'none',
                textAlign: 'center',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background = 'var(--surface-2)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = 'transparent')
              }
              onMouseDown={(e) => e.stopPropagation()}
            >
              Search YouTube for "{suggestion}"
            </a>
            <a
              href={googleSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: '6px 12px',
                border: '1px solid var(--border)',
                borderRadius: 5,
                color: 'var(--text)',
                fontSize: 12,
                textDecoration: 'none',
                textAlign: 'center',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background = 'var(--surface-2)')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = 'transparent')
              }
              onMouseDown={(e) => e.stopPropagation()}
            >
              Search Google for tutorials
            </a>
          </div>
          {item.content.refinedQuery && (
            <div
              style={{
                marginTop: 12,
                fontSize: 11,
                color: 'var(--text-dim)',
              }}
            >
              Or try asking: "{item.content.refinedQuery}"
            </div>
          )}
        </div>
      )
    }

    case 'data_doc':
      return <DataDocItem item={item} />

    case 'search_results': {
      const { query: sq, results: sr = [] } = item.content as { query: string; results: Array<{ title: string; moduleLabel: string; route: string; preview: string; module: string }> }
      return (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, width: 340, fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', borderRadius: '8px 8px 0 0', padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Search</span>
            <span style={{ fontSize: 13, color: 'var(--text)' }}>"{sq}"</span>
            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{sr.length} result{sr.length !== 1 ? 's' : ''}</span>
          </div>
          {sr.length === 0 ? (
            <div style={{ padding: '16px 14px', fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>No results found.</div>
          ) : sr.map((r, i) => (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: i < sr.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
              onClick={() => window.dispatchEvent(new CustomEvent('enginguity_open_cross_search', { detail: { query: sq } }))}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <span style={{ fontSize: 13 }}>
                <span style={{ color: '#b8d4f0' }}>{r.module === 'notebook' ? '≡' : r.module === 'bom' ? '≣' : r.module === 'project-ideas' ? '◈' : r.module === 'jarvis' ? '◇' : '▤'}</span>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                {r.preview && <div style={{ fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.preview}</div>}
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>{r.moduleLabel}</span>
            </div>
          ))}
          <div style={{ padding: '8px 14px', borderTop: sr.length > 0 ? '1px solid var(--border)' : 'none' }}>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('enginguity_open_cross_search', { detail: { query: sq } }))}
              onMouseDown={e => e.stopPropagation()}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: 0 }}
            >
              Open full search →
            </button>
          </div>
        </div>
      )
    }

    case 'session_diff': {
      const { summary, changes = [], prevTs, currTs } = item.content as { summary: string; changes: Array<{ type: string; module: string; label: string; detail: string }>; prevTs: number; currTs: number }
      const typeColor = (t: string) => t === 'added' ? '#7aaa8a' : t === 'removed' ? '#b08080' : t === 'warning' ? '#b09a60' : t === 'resolved' ? '#60a5fa' : '#94a3b8'
      return (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, width: 300, fontFamily: "'DM Sans', sans-serif" }}>
          <div style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', borderRadius: '8px 8px 0 0', padding: '8px 14px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Session Diff</div>
            <div style={{ fontSize: 12, color: 'var(--text)' }}>{summary}</div>
            {prevTs && currTs && (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                {new Date(prevTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → {new Date(currTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
          {changes.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-dim)' }}>No changes detected.</div>
          ) : changes.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 14px', borderBottom: i < changes.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: typeColor(c.type), marginTop: 4, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4 }}>{c.label}</div>
                {c.detail && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 1 }}>{c.detail}</div>}
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>{c.module}</span>
            </div>
          ))}
        </div>
      )
    }

    case 'measurement': {
      const { instrumentType, primaryReading, secondaryReadings, displayText, capturedAt, logged, photoId } = item.content
      return (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 14,
          width: 220,
          fontFamily: "'DM Sans', sans-serif"
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 6 }}>
            {instrumentType}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, color: 'var(--text)', fontWeight: 600 }}>
              {primaryReading.value}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, color: 'var(--text-muted)' }}>
              {primaryReading.unit}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 10 }}>
            {primaryReading.mode || 'Measurement'}
          </div>
          
          {secondaryReadings && secondaryReadings.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {secondaryReadings.map((sec: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>{sec.label}:</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{sec.value} {sec.unit}</span>
                </div>
              ))}
            </div>
          )}
          
          {displayText && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 12 }}>
              Display: "{displayText}"
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
              {new Date(capturedAt).toLocaleTimeString()}
            </span>
          </div>
          
          <div style={{ display: 'flex', gap: 4 }} onMouseDown={e => e.stopPropagation()}>
            <button
              onClick={() => onLogMeasurement?.(item.content, item.id)}
              disabled={!!logged}
              style={{
                ...quietButtonStyle,
                color: logged ? '#7aaa8a' : 'var(--text-muted)',
                borderColor: logged ? '#7aaa8a' : 'var(--border)'
              }}
            >
              {logged ? 'Logged ✓' : <><span style={{ color: '#b8d4f0' }}>≡</span> Log to Notebook</>}
            </button>
            {photoId && (
              <button
                onClick={() => onCenterOnItem?.(photoId)}
                style={quietButtonStyle}
              >
                <span style={{ color: '#b8d4f0' }}>◫</span> View Photo
              </button>
            )}
          </div>
        </div>
      )
    }

    case 'component_id': {
      const { componentType, partNumber, value, manufacturer, package: pkg, keySpecs, description, commonUses, inBOM, warning, colorBands, photoId } = item.content
      const localDecode = colorBands ? decodeResistor(colorBands) : null
      const isResistor = componentType?.toLowerCase() === 'resistor'
      
      return (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 14,
          width: 280,
          fontFamily: "'DM Sans', sans-serif"
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              {componentType}
            </span>
            {inBOM && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
                In your BOM ✓
              </span>
            )}
          </div>
          
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>
            {partNumber || value || 'Unknown Part'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.4 }}>
            {description}
          </div>
          
          {manufacturer && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
              Mfr: <span style={{ color: 'var(--text-muted)' }}>{manufacturer}</span> {pkg ? `| Pkg: ${pkg}` : ''}
            </div>
          )}
          
          {isResistor && localDecode && (
            <div style={{
              background: 'var(--bg-2)',
              padding: 8,
              borderRadius: 6,
              border: '1px solid var(--border)',
              marginBottom: 10,
              fontSize: 11
            }}>
              <div style={{ color: 'var(--text-dim)', marginBottom: 2 }}>Local Band Decoder:</div>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                {localDecode}
              </div>
              {value && cleanResistance(value) === cleanResistance(localDecode.split(' ')[0]) && (
                <div style={{ color: '#7aaa8a', fontSize: 10, marginTop: 2 }}>
                  ✓ Verification Matched (High Confidence)
                </div>
              )}
            </div>
          )}
          
          {keySpecs && keySpecs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
              {keySpecs.slice(0, 4).map((spec: string, idx: number) => (
                <div key={idx} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-muted)' }}>
                  • {spec}
                </div>
              ))}
            </div>
          )}
          
          {commonUses && commonUses.length > 0 && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 12 }}>
              Used for: {commonUses.join(', ')}
            </div>
          )}
          
          {warning && (
            <div style={{ fontSize: 11, color: '#b08080', fontStyle: 'italic', marginBottom: 12 }}>
              <span style={{ color: '#b8d4f0' }}>△</span> {warning}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} onMouseDown={e => e.stopPropagation()}>
            {(partNumber || value) && (
              <button
                onClick={() => onFindDatasheet?.(partNumber || value)}
                style={quietButtonStyle}
              >
                Find Datasheet
              </button>
            )}
            <button
              onClick={() => onAddPartToBOM?.(item.content)}
              style={quietButtonStyle}
            >
              Add to BOM
            </button>
            {photoId && (
              <button
                onClick={() => onCenterOnItem?.(photoId)}
                style={quietButtonStyle}
              >
                View Photo
              </button>
            )}
          </div>
        </div>
      )
    }

    case 'scope_analysis': {
      const { waveformType, measurements, scale, signalQuality, issues, assessment, recommendations, photoId } = item.content
      
      return (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 14,
          width: 320,
          fontFamily: "'DM Sans', sans-serif"
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
              {waveformType} Analysis
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {signalQuality === 'good' && 'Good signal'}
              {signalQuality === 'acceptable' && 'Acceptable'}
              {signalQuality === 'poor' && 'Issues detected'}
              {signalQuality === 'unknown' && 'Unknown quality'}
            </span>
          </div>
          
          {measurements && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
              <tbody>
                {Object.entries(measurements).map(([param, val]) => {
                  if (!val) return null
                  return (
                    <tr key={param} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ fontSize: 11, color: 'var(--text-dim)', padding: '4px 0', textTransform: 'capitalize' }}>
                        {param.replace(/([A-Z])/g, ' $1')}
                      </td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text)', padding: '4px 0', textAlign: 'right' }}>
                        {val as string}
                      </td>
                    </tr>
                  )
                })}
                {scale && (
                  <>
                    {scale.timebase && (
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ fontSize: 11, color: 'var(--text-dim)', padding: '4px 0' }}>Timebase</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text)', padding: '4px 0', textAlign: 'right' }}>{scale.timebase}</td>
                      </tr>
                    )}
                    {scale.voltageDiv && (
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ fontSize: 11, color: 'var(--text-dim)', padding: '4px 0' }}>Volts/Div</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text)', padding: '4px 0', textAlign: 'right' }}>{scale.voltageDiv}</td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          )}
          
          {issues && issues.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              {issues.map((issue: string, idx: number) => (
                <div key={idx} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
                  ! {issue}
                </div>
              ))}
            </div>
          )}
          
          <div style={{ marginBottom: 10 }}>
            <button
              onClick={() => setCollapsed(!collapsed)}
              onMouseDown={e => e.stopPropagation()}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent)',
                fontSize: 12,
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span>{collapsed ? 'Details ↓' : 'Hide details ↑'}</span>
            </button>
            {!collapsed && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5, background: 'var(--bg-2)', padding: 8, borderRadius: 4 }}>
                {assessment}
              </div>
            )}
          </div>
          
          {recommendations && recommendations.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {recommendations.map((rec: string, idx: number) => (
                <div key={idx} style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  → {rec}
                </div>
              ))}
            </div>
          )}
          
          {photoId && (
            <div onMouseDown={e => e.stopPropagation()}>
              <button
                onClick={() => onCenterOnItem?.(photoId)}
                style={quietButtonStyle}
              >
                <span style={{ color: '#b8d4f0' }}>◫</span> View Photo
              </button>
            </div>
          )}
        </div>
      )
    }

    case 'datasheet_card': {
      const { partNumber, manufacturer, description, category, keySpecs, datasheetUrl, productPageUrl, distributorUrls } = item.content
      
      return (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 14,
          width: 300,
          fontFamily: "'DM Sans', sans-serif"
        }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, color: 'var(--text)', fontWeight: 600 }}>
              {partNumber}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {manufacturer} | {category}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
              {description}
            </div>
          </div>
          
          {keySpecs && keySpecs.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
              <tbody>
                {keySpecs.slice(0, 5).map((spec: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ fontSize: 11, color: 'var(--text-dim)', padding: '4px 0' }}>{spec.param}</td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text)', padding: '4px 0', textAlign: 'right' }}>{spec.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }} onMouseDown={e => e.stopPropagation()}>
            {datasheetUrl && (
              <a href={datasheetUrl} target="_blank" rel="noopener noreferrer" style={quietButtonStyle}>
                PDF Datasheet ↗
              </a>
            )}
            {distributorUrls?.mouser && (
              <a href={distributorUrls.mouser} target="_blank" rel="noopener noreferrer" style={quietButtonStyle}>
                Mouser
              </a>
            )}
            {distributorUrls?.digikey && (
              <a href={distributorUrls.digikey} target="_blank" rel="noopener noreferrer" style={quietButtonStyle}>
                Digikey
              </a>
            )}
            {distributorUrls?.lcsc && (
              <a href={distributorUrls.lcsc} target="_blank" rel="noopener noreferrer" style={quietButtonStyle}>
                LCSC
              </a>
            )}
          </div>
          
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }} onMouseDown={e => e.stopPropagation()}>
            <button
              onClick={() => onOpenInDatasheet?.(item.content)}
              style={{
                width: '100%',
                padding: '6px 0',
                background: 'var(--bg-2)',
                border: '1px solid var(--border-bright)',
                borderRadius: 5,
                color: 'var(--accent)',
                fontSize: 11,
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              Open in Datasheet Module
            </button>
          </div>
        </div>
      )
    }

    case 'quick_spice': {
      const { circuitType, components, keyResults, chartData, spiceNetlist } = item.content
      
      return (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 14,
          width: 360,
          fontFamily: "'DM Sans', sans-serif"
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>
            {circuitType}
          </div>
          
          {components && components.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Components:</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {components.map((c: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text)', padding: '2px 0' }}>{c.name}</td>
                      <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-muted)', padding: '2px 0', textAlign: 'right' }}>{c.value} {c.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {keyResults && keyResults.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Key Results:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {keyResults.map((kr: any, idx: number) => (
                  <div key={idx} style={{ flex: 1, minWidth: 100, background: 'var(--bg-2)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'capitalize' }}>{kr.parameter}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, color: 'var(--text)', fontWeight: 600 }}>
                      {kr.value} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{kr.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {chartData && <QuickSpiceChart data={chartData} />}
          
          {spiceNetlist && (
            <div style={{ marginBottom: 12 }}>
              <button
                onClick={() => setCollapsed(!collapsed)}
                onMouseDown={e => e.stopPropagation()}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                {collapsed ? 'View SPICE netlist ↓' : 'Hide SPICE netlist ↑'}
              </button>
              {!collapsed && (
                <pre style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  background: 'var(--bg-2)',
                  padding: 8,
                  borderRadius: 4,
                  marginTop: 6,
                  whiteSpace: 'pre-wrap',
                  overflowX: 'auto',
                  border: '1px solid var(--border)'
                }}>
                  {spiceNetlist}
                </pre>
              )}
            </div>
          )}
          
          <div onMouseDown={e => e.stopPropagation()}>
            <button
              onClick={() => onOpenInCircuitSim?.(spiceNetlist)}
              style={{
                width: '100%',
                padding: '6px 0',
                background: 'var(--bg-2)',
                border: '1px solid var(--border-bright)',
                borderRadius: 5,
                color: 'var(--accent)',
                fontSize: 11,
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              Open in Circuit Sim
            </button>
          </div>
        </div>
      )
    }

    case 'timer':
      return <TimerCard item={item} onTimerAction={onTimerAction} />

    case 'notebook_confirm':
      return <NotebookConfirmItem item={item} />

    case 'guided_steps':
      return <GuidedStepsCard item={item} onGuidedModeAction={onGuidedModeAction} />

    case 'order_list':
      return <OrderListCard item={item} onOrderListAction={onOrderListAction} />

    default:
      return null
  }
}

// ─── Canvas item wrapper (generic drag + resize chrome) ───────────────────────
function CanvasItemWrapper({
  item,
  scale,
  onItemMove,
  onItemResize,
  onItemRemove,
  onAnalyzePhoto,
  onCameraCapture,
  onCameraStop,
  cameraVideoRef,
  onLogMeasurement,
  onCenterOnItem,
  onFindDatasheet,
  onAddPartToBOM,
  onTimerAction,
  onOrderListAction,
  onGuidedModeAction,
  onOpenInCircuitSim,
  onOpenInDatasheet,
}: {
  item: CanvasItem
  scale: number
  onItemMove: (id: string, x: number, y: number) => void
  onItemResize: (id: string, w: number, h: number) => void
  onItemRemove: (id: string) => void
  onAnalyzePhoto: (id: string) => void
  onCameraCapture: () => void
  onCameraStop: () => void
  cameraVideoRef: React.RefObject<HTMLVideoElement>
  onLogMeasurement?: (reading: any, itemId: string) => void
  onCenterOnItem?: (itemId: string) => void
  onFindDatasheet?: (partNumber: string) => void
  onAddPartToBOM?: (component: any) => void
  onTimerAction?: (timerId: string, action: 'add_minute' | 'pause_toggle' | 'cancel') => void
  onOrderListAction?: (action: 'export_csv' | 'read_list' | 'clear_purchased' | 'toggle_purchased', itemData?: any) => void
  onGuidedModeAction?: (action: 'prev' | 'next') => void
  onOpenInCircuitSim?: (netlist: string) => void
  onOpenInDatasheet?: (component: any) => void
}) {
  const [hovered, setHovered] = useState(false)
  const dragRef = useRef<{
    startMX: number
    startMY: number
    startX: number
    startY: number
  } | null>(null)
  const resizeDragRef = useRef<{
    startMX: number
    startMY: number
    startW: number
    startH: number
  } | null>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const dx = (e.clientX - dragRef.current.startMX) / scale
        const dy = (e.clientY - dragRef.current.startMY) / scale
        onItemMove(item.id, dragRef.current.startX + dx, dragRef.current.startY + dy)
      }
      if (resizeDragRef.current) {
        const dx = (e.clientX - resizeDragRef.current.startMX) / scale
        const dy = (e.clientY - resizeDragRef.current.startMY) / scale
        onItemResize(
          item.id,
          Math.max(120, resizeDragRef.current.startW + dx),
          Math.max(60, resizeDragRef.current.startH + dy)
        )
      }
    }
    const handleMouseUp = () => {
      dragRef.current = null
      resizeDragRef.current = null
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [item.id, scale, onItemMove, onItemResize])

  const handleTitleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    dragRef.current = { startMX: e.clientX, startMY: e.clientY, startX: item.x, startY: item.y }
  }

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    resizeDragRef.current = {
      startMX: e.clientX,
      startMY: e.clientY,
      startW: item.width || 200,
      startH: item.height || 100,
    }
  }

  return (
    <div
      data-item="true"
      style={{
        position: 'absolute',
        left: item.x,
        top: item.y - 32,
        paddingTop: 32,
        userSelect: 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Chrome bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 32,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          borderRadius: '8px 8px 0 0',
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          cursor: 'grab',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 150ms ease',
          pointerEvents: hovered ? 'auto' : 'none',
          zIndex: 2,
        }}
        onMouseDown={handleTitleMouseDown}
      >
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title || item.type}
        </span>
        <span
          style={{
            cursor: 'pointer',
            color: 'var(--text-dim)',
            fontSize: 18,
            padding: '0 4px',
            lineHeight: 1,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.color = 'var(--text)')}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--text-dim)')}
          onClick={() => onItemRemove(item.id)}
        >
          ×
        </span>
      </div>

      {/* Content */}
      <div
        style={{
          border: `1px solid ${hovered ? 'var(--border-bright)' : 'transparent'}`,
          borderRadius: 8,
          transition: 'border-color 150ms ease',
          position: 'relative',
        }}
      >
        <ItemContent
          item={item}
          onAnalyzePhoto={onAnalyzePhoto}
          onCameraCapture={onCameraCapture}
          onCameraStop={onCameraStop}
          cameraVideoRef={cameraVideoRef}
          onLogMeasurement={onLogMeasurement}
          onCenterOnItem={onCenterOnItem}
          onFindDatasheet={onFindDatasheet}
          onAddPartToBOM={onAddPartToBOM}
          onTimerAction={onTimerAction}
          onOrderListAction={onOrderListAction}
          onGuidedModeAction={onGuidedModeAction}
          onOpenInCircuitSim={onOpenInCircuitSim}
          onOpenInDatasheet={onOpenInDatasheet}
        />

        {/* Resize handle */}
        <div
          style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            width: 10,
            height: 10,
            cursor: 'se-resize',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 150ms ease',
          }}
          onMouseDown={handleResizeMouseDown}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M3 9L9 3M6 9L9 6"
              stroke="var(--border-bright)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}

// ─── Minimap ──────────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  text: '#94a5ba',
  calculation: '#94a5ba',
  image: '#a5ba94',
  video: '#5a7fa5',
  link: '#8a94a5',
  code: '#4a6a85',
  note: '#a5a594',
  photo: '#a59485',
  camera: '#b08080',
  search_suggestion: '#8a94a5',
  data_doc: '#7a8a9a',
}

function Minimap({
  items,
  groups,
  transform,
  containerW,
  containerH,
  onViewportDrag,
}: {
  items: CanvasItem[]
  groups: CanvasGroup[]
  transform: CanvasTransform
  containerW: number
  containerH: number
  onViewportDrag: (dx: number, dy: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mapW = 160
  const mapH = 100
  const isDraggingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, mapW, mapH)

    // Find world bounding box
    let minX = 0,
      minY = 0,
      maxX = 800,
      maxY = 600
    if (items.length > 0) {
      minX = Math.min(...items.map((i) => i.x)) - 40
      minY = Math.min(...items.map((i) => i.y)) - 40
      maxX = Math.max(...items.map((i) => i.x + (i.width || 200))) + 40
      maxY = Math.max(...items.map((i) => i.y + (i.height || 100))) + 40
    }

    const worldW = maxX - minX
    const worldH = maxY - minY
    const scaleX = mapW / worldW
    const scaleY = mapH / worldH
    const mapScale = Math.min(scaleX, scaleY, 0.3)

    const toMapX = (wx: number) => (wx - minX) * mapScale
    const toMapY = (wy: number) => (wy - minY) * mapScale

    // Draw items
    items.forEach((item) => {
      ctx.fillStyle = TYPE_COLORS[item.type] || '#94a5ba'
      ctx.globalAlpha = 0.7
      const iw = Math.max(4, (item.width || 200) * mapScale)
      const ih = Math.max(3, (item.height || 80) * mapScale)
      ctx.fillRect(toMapX(item.x), toMapY(item.y), iw, ih)
    })

    // Draw viewport indicator
    const vpX = -transform.x / transform.scale
    const vpY = -transform.y / transform.scale
    const vpW = containerW / transform.scale
    const vpH = containerH / transform.scale

    ctx.globalAlpha = 1
    ctx.strokeStyle = '#94a5ba'
    ctx.lineWidth = 1
    ctx.strokeRect(
      toMapX(vpX),
      toMapY(vpY),
      vpW * mapScale,
      vpH * mapScale
    )
  }, [items, transform, containerW, containerH])

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true
    lastPosRef.current = { x: e.clientX, y: e.clientY }
    e.stopPropagation()
  }

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      const dx = e.clientX - lastPosRef.current.x
      const dy = e.clientY - lastPosRef.current.y
      lastPosRef.current = { x: e.clientX, y: e.clientY }
      onViewportDrag(dx, dy)
    },
    [onViewportDrag]
  )

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 8,
        right: 8,
        background: 'rgba(17,17,17,0.92)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        overflow: 'hidden',
        cursor: 'crosshair',
      }}
      title="Minimap — drag to pan"
    >
      <canvas
        ref={canvasRef}
        width={mapW}
        height={mapH}
        style={{ display: 'block' }}
        onMouseDown={handleMouseDown}
      />
    </div>
  )
}

// ─── Canvas toolbar ────────────────────────────────────────────────────────────
function CanvasToolbar({
  onUndo,
  onClear,
  onExport,
  onToggleMinimap,
  onToggleCamera,
  showMinimap,
  cameraActive,
  itemCount,
}: {
  onUndo: () => void
  onClear: () => void
  onExport: () => void
  onToggleMinimap: () => void
  onToggleCamera: () => void
  showMinimap: boolean
  cameraActive: boolean
  itemCount: number
}) {
  const btn = (
    label: string,
    title: string,
    onClick: () => void,
    active = false
  ) => (
    <button
      title={title}
      data-tooltip={title}

      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        background: active ? 'var(--accent-glow)' : 'transparent',
        border: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
        borderRadius: 5,
        color: active ? 'var(--accent)' : 'var(--text-dim)',
        cursor: 'pointer',
        fontSize: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'color 100ms ease, background 100ms ease',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.color = 'var(--text)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.color = active ? 'var(--accent)' : 'var(--text-dim)'
      }}
    >
      {label}
    </button>
  )

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 5,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        zIndex: 10,
      }}
    >
      {btn('▶', cameraActive ? 'Stop camera' : 'Start camera', onToggleCamera, cameraActive)}
      {btn('▣', 'Toggle minimap (V)', onToggleMinimap, showMinimap)}
      {btn('↩', 'Undo last item (⌘Z)', onUndo)}
      {btn('⊟', 'Clear canvas', onClear, false)}
      {btn('↑', 'Export canvas as PNG', onExport)}
    </div>
  )
}

// ─── Main canvas ──────────────────────────────────────────────────────────────
export function InfiniteCanvas({
  items,
  groups,
  transform,
  onTransformChange,
  onItemMove,
  onItemResize,
  onItemRemove,
  onClearAll,
  onUndo,
  onAnalyzePhoto,
  onCameraStart,
  onCameraCapture,
  onCameraStop,
  cameraVideoRef,
  showWelcome,
  canvasBg,
  canvasWorldRef,
  onExport,
  onLogMeasurement,
  onCenterOnItem,
  onFindDatasheet,
  onAddPartToBOM,
  onTimerAction,
  onOrderListAction,
  onGuidedModeAction,
  onOpenInCircuitSim,
  onOpenInDatasheet,
}: InfiniteCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const transformRef = useRef(transform)
  const onTransformChangeRef = useRef(onTransformChange)
  const panRef = useRef<{
    startMX: number
    startMY: number
    startTX: number
    startTY: number
  } | null>(null)
  const spaceHeldRef = useRef(false)
  const [showClear, setShowClear] = useState(false)
  const [showMinimap, setShowMinimap] = useState(false)
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 })
  // Camera toggle fires the start/stop in the parent; we just call onCameraCapture/onCameraStop
  const cameraActiveItem = items.some((i) => i.type === 'camera')

  transformRef.current = transform
  onTransformChangeRef.current = onTransformChange

  // Track container size for minimap
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setContainerSize({ w: el.offsetWidth, h: el.offsetHeight })
    })
    ro.observe(el)
    setContainerSize({ w: el.offsetWidth, h: el.offsetHeight })
    return () => ro.disconnect()
  }, [])

  // Non-passive wheel
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const t = transformRef.current
      const factor = e.deltaY < 0 ? 1.1 : 0.909
      const newScale = Math.min(3, Math.max(0.1, t.scale * factor))
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      onTransformChangeRef.current({
        x: mx - (mx - t.x) * (newScale / t.scale),
        y: my - (my - t.y) * (newScale / t.scale),
        scale: newScale,
      })
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  // Global mouse for panning
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!panRef.current) return
      onTransformChangeRef.current({
        ...transformRef.current,
        x: panRef.current.startTX + (e.clientX - panRef.current.startMX),
        y: panRef.current.startTY + (e.clientY - panRef.current.startMY),
      })
    }
    const handleMouseUp = () => {
      panRef.current = null
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Space key + V key
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        spaceHeldRef.current = true
        if (containerRef.current) containerRef.current.style.cursor = 'grab'
      }
      if (e.key === 'v' || e.key === 'V') {
        // Only toggle minimap if not in an input
        const tag = (document.activeElement as HTMLElement)?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          setShowMinimap((v) => !v)
        }
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false
        if (containerRef.current) containerRef.current.style.cursor = 'default'
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (!spaceHeldRef.current && target.closest('[data-item="true"]')) return
    e.preventDefault()
    panRef.current = {
      startMX: e.clientX,
      startMY: e.clientY,
      startTX: transformRef.current.x,
      startTY: transformRef.current.y,
    }
  }, [])

  const handleMinimapViewportDrag = useCallback(
    (dx: number, dy: number) => {
      onTransformChangeRef.current({
        ...transformRef.current,
        x: transformRef.current.x - dx * 4,
        y: transformRef.current.y - dy * 4,
      })
    },
    []
  )

  const showDotGrid = transform.scale < 0.8
  const dotSpacing = 32 * transform.scale
  const dotOffX = transform.x % dotSpacing
  const dotOffY = transform.y % dotSpacing

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        flex: 1,
        overflow: 'hidden',
        background: canvasBg,
        cursor: 'default',
        backgroundImage: showDotGrid
          ? 'radial-gradient(circle, #1e1e1e 1px, transparent 1px)'
          : 'none',
        backgroundSize: showDotGrid ? `${dotSpacing}px ${dotSpacing}px` : undefined,
        backgroundPosition: showDotGrid ? `${dotOffX}px ${dotOffY}px` : undefined,
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setShowClear(true)}
      onMouseLeave={() => setShowClear(false)}
    >
      {/* Canvas world */}
      <div
        ref={canvasWorldRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transformOrigin: '0 0',
          transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`,
        }}
      >
        {/* Groups (render first, behind items) */}
        {groups.map((group) => {
          const members = items.filter((i) => group.itemIds.includes(i.id))
          if (members.length < 2) return null
          const xs = members.map((i) => i.x)
          const ys = members.map((i) => i.y)
          const x2s = members.map((i) => i.x + (i.width || 200))
          const y2s = members.map((i) => i.y + (i.height || 100))
          const pad = 20
          const gx = Math.min(...xs) - pad
          const gy = Math.min(...ys) - pad
          const gw = Math.max(...x2s) - gx + pad
          const gh = Math.max(...y2s) - gy + pad
          return (
            <div
              key={group.id}
              style={{
                position: 'absolute',
                left: gx,
                top: gy,
                width: gw,
                height: gh,
                border: '1px dashed var(--border-bright)',
                borderRadius: 12,
                background: 'rgba(148,165,186,0.02)',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: -12,
                  left: 10,
                  background: 'var(--bg)',
                  padding: '1px 6px',
                  fontSize: 10,
                  color: 'var(--text-dim)',
                  borderRadius: 3,
                  fontFamily: "'DM Sans', sans-serif",
                  whiteSpace: 'nowrap',
                }}
              >
                {group.title}
              </div>
            </div>
          )
        })}

        {/* Items */}
        {items.map((item) => {
          if (item.type === 'video') {
            return (
              <VideoItem
                key={item.id}
                item={item}
                scale={transform.scale}
                onMove={onItemMove}
                onResize={onItemResize}
                onRemove={onItemRemove}
              />
            )
          }
          return (
            <CanvasItemWrapper
              key={item.id}
              item={item}
              scale={transform.scale}
              onItemMove={onItemMove}
              onItemResize={onItemResize}
              onItemRemove={onItemRemove}
              onAnalyzePhoto={onAnalyzePhoto}
              onCameraCapture={onCameraCapture}
              onCameraStop={onCameraStop}
              cameraVideoRef={cameraVideoRef}
              onLogMeasurement={onLogMeasurement}
              onCenterOnItem={onCenterOnItem}
              onFindDatasheet={onFindDatasheet}
              onAddPartToBOM={onAddPartToBOM}
              onTimerAction={onTimerAction}
              onOrderListAction={onOrderListAction}
              onGuidedModeAction={onGuidedModeAction}
              onOpenInCircuitSim={onOpenInCircuitSim}
              onOpenInDatasheet={onOpenInDatasheet}
            />
          )
        })}
      </div>

      {/* Welcome state */}
      {showWelcome && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            pointerEvents: 'none',
          }}
        >
          {/* Radar target SVG */}
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" opacity={0.7} style={{ marginBottom: 16 }}>
            <circle cx="40" cy="40" r="36" stroke="#4a5568" strokeWidth="1.5" />
            <circle cx="40" cy="40" r="24" stroke="#4a5568" strokeWidth="1.5" />
            <circle cx="40" cy="40" r="12" stroke="#94a5ba" strokeWidth="1.5" />
            <circle cx="40" cy="40" r="3" fill="#94a5ba" />
            <line x1="40" y1="4" x2="40" y2="16" stroke="#4a5568" strokeWidth="1.5" />
            <line x1="40" y1="64" x2="40" y2="76" stroke="#4a5568" strokeWidth="1.5" />
            <line x1="4" y1="40" x2="16" y2="40" stroke="#4a5568" strokeWidth="1.5" />
            <line x1="64" y1="40" x2="76" y2="40" stroke="#4a5568" strokeWidth="1.5" />
          </svg>
          <div
            style={{
              fontSize: 14,
              color: '#94a5ba',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
            }}
          >
            Say Hey Jarvis to begin
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#4a5568',
              fontFamily: "'DM Sans', sans-serif",
              textAlign: 'center',
              lineHeight: 1.8,
              marginTop: 4,
            }}
          >
            Ask questions · Search images · Play videos<br />
            Do calculations · Write code · Use camera
          </div>
        </div>
      )}

      {/* Toolbar */}
      <CanvasToolbar
        onUndo={onUndo}
        onClear={onClearAll}
        onExport={onExport}
        onToggleMinimap={() => setShowMinimap((v) => !v)}
        onToggleCamera={cameraActiveItem ? onCameraStop : onCameraStart}
        showMinimap={showMinimap}
        cameraActive={cameraActiveItem}
        itemCount={items.length}
      />

      {/* Minimap */}
      {showMinimap && (
        <Minimap
          items={items}
          groups={groups}
          transform={transform}
          containerW={containerSize.w}
          containerH={containerSize.h}
          onViewportDrag={handleMinimapViewportDrag}
        />
      )}
    </div>
  )
}
