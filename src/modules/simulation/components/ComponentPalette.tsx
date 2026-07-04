// Searchable component library. Clicking an item arms placement mode (EDA
// style: keep placing until Esc/right-click); the Wire tool lives up top.

import { useMemo, useState } from 'react'
import { CircleGauge, Spline, Zap } from 'lucide-react'
import type { SchematicComponentType } from '../types'
import { COMPONENT_DEFS, PALETTE_ORDER } from '../componentDefs'
import type { Tool } from '../editorState'
import { CURRENT_PROBE_TOOL, VOLTAGE_PROBE_TOOL, WIRE_TOOL } from '../editorState'

interface Props {
  tool: Tool
  onToolChange: (t: Tool) => void
}

const CATEGORIES: Array<'Passive' | 'Active' | 'Sources' | 'Reference'> = ['Passive', 'Active', 'Sources', 'Reference']

export function ComponentPalette({ tool, onToolChange }: Props) {
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PALETTE_ORDER.filter((type) => {
      if (!q) return true
      const def = COMPONENT_DEFS[type]
      return def.label.toLowerCase().includes(q) || def.keywords.some((k) => k.includes(q))
    })
  }, [query])

  const armedType = tool.kind === 'place' ? tool.type : null

  return (
    <div
      style={{
        width: 192,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '10px 10px 6px' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search components…"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            color: 'var(--color-text-primary)',
            fontFamily: "var(--font-family-ui, 'Geist', sans-serif)",
            fontSize: 12,
            padding: '6px 8px',
            outline: 'none',
          }}
        />
      </div>

      <ToolButton
        icon={<Spline size={14} />}
        label="Wire"
        hint="W"
        title="Draw wires between pins (W)"
        active={tool.kind === 'wire'}
        onClick={() => onToolChange(WIRE_TOOL)}
      />
      <ToolButton
        icon={<CircleGauge size={14} />}
        label="Voltage Probe"
        hint="P"
        title="Drop a voltage probe on any pin or wire (P)"
        active={tool.kind === 'probe' && tool.probe === 'voltage'}
        onClick={() => onToolChange(VOLTAGE_PROBE_TOOL)}
      />
      <ToolButton
        icon={<Zap size={14} />}
        label="Current Probe"
        title="Drop a current probe on a component body"
        active={tool.kind === 'probe' && tool.probe === 'current'}
        onClick={() => onToolChange(CURRENT_PROBE_TOOL)}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 12px' }}>
        {CATEGORIES.map((cat) => {
          const items = visible.filter((t) => COMPONENT_DEFS[t].category === cat)
          if (items.length === 0) return null
          return (
            <div key={cat} style={{ marginBottom: 10 }}>
              <div
                style={{
                  fontFamily: "var(--font-family-ui, 'Geist', sans-serif)",
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--color-text-muted)',
                  padding: '6px 2px 4px',
                }}
              >
                {cat}
              </div>
              {items.map((type) => (
                <PaletteItem
                  key={type}
                  type={type}
                  armed={armedType === type}
                  onClick={() => onToolChange({ kind: 'place', type })}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ToolButton({
  icon,
  label,
  hint,
  title,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  hint?: string
  title: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '0 10px 8px',
        padding: '6px 8px',
        background: active ? 'var(--color-surface-raised)' : 'transparent',
        border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
        borderRadius: 6,
        color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        fontFamily: "var(--font-family-ui, 'Geist', sans-serif)",
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {icon}
      {label}
      {hint && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-text-muted)' }}>{hint}</span>}
    </button>
  )
}

function PaletteItem({
  type,
  armed,
  onClick,
}: {
  type: SchematicComponentType
  armed: boolean
  onClick: () => void
}) {
  const def = COMPONENT_DEFS[type]
  return (
    <button
      onClick={onClick}
      title={`Place ${def.label}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '4px 6px',
        marginBottom: 2,
        background: armed ? 'var(--color-surface-raised)' : 'transparent',
        border: `1px solid ${armed ? 'var(--color-accent)' : 'transparent'}`,
        borderRadius: 6,
        color: armed ? 'var(--color-accent)' : 'var(--color-text-secondary)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <svg width={44} height={26} viewBox="-36 -18 72 36" style={{ flexShrink: 0, color: 'currentColor' }}>
        <g transform={type.startsWith('vsource') || type === 'isource-dc' ? 'rotate(-90) scale(0.55)' : 'scale(0.55)'}>
          {def.symbol}
        </g>
      </svg>
      <span
        style={{
          fontFamily: "var(--font-family-ui, 'Geist', sans-serif)",
          fontSize: 11.5,
          lineHeight: 1.25,
        }}
      >
        {def.label}
      </span>
    </button>
  )
}
