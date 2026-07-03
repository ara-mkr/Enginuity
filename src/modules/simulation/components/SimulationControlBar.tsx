// Top control strip: circuit switcher, analysis-mode selector, Run (armed in
// Phase 2 when the MNA solver wires in), undo/redo, and zoom readout.

import { Play, Plus, Redo2, Undo2 } from 'lucide-react'
import type { AnalysisMode, Circuit } from '../types'
import { useSimulationStore } from '../store/circuitStore'

interface Props {
  circuit: Circuit
}

const MODES: Array<{ id: AnalysisMode; label: string }> = [
  { id: 'dc', label: 'DC' },
  { id: 'transient', label: 'Transient' },
  { id: 'ac', label: 'AC' },
]

const uiFont = "var(--font-family-ui, 'Geist', sans-serif)"
const monoFont = "var(--font-family-mono, 'Geist Mono', monospace)"

export function SimulationControlBar({ circuit }: Props) {
  const circuits = useSimulationStore((s) => s.circuits)
  const setActiveCircuit = useSimulationStore((s) => s.setActiveCircuit)
  const createCircuit = useSimulationStore((s) => s.createCircuit)
  const renameCircuit = useSimulationStore((s) => s.renameCircuit)
  const setAnalysisMode = useSimulationStore((s) => s.setAnalysisMode)
  const setViewport = useSimulationStore((s) => s.setViewport)
  const undo = useSimulationStore((s) => s.undo)
  const redo = useSimulationStore((s) => s.redo)
  const history = useSimulationStore((s) => s.history[circuit.id])

  const list = Object.values(circuits).sort((a, b) => a.createdAt - b.createdAt)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        flexShrink: 0,
      }}
    >
      <select
        value={circuit.id}
        onChange={(e) => setActiveCircuit(e.target.value)}
        style={{
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          color: 'var(--color-text-primary)',
          fontFamily: uiFont,
          fontSize: 12,
          padding: '4px 6px',
          maxWidth: 180,
        }}
      >
        {list.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <IconButton title="New circuit" onClick={() => createCircuit()}>
        <Plus size={14} />
      </IconButton>
      <IconButton
        title="Rename circuit"
        onClick={() => {
          const name = prompt('Circuit name', circuit.name)
          if (name?.trim()) renameCircuit(circuit.id, name.trim())
        }}
      >
        <span style={{ fontFamily: uiFont, fontSize: 11 }}>Rename</span>
      </IconButton>

      <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--color-border)' }} />

      {/* Analysis mode segmented control */}
      <div
        style={{
          display: 'flex',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {MODES.map((m) => {
          const active = circuit.simulationSettings.mode === m.id
          return (
            <button
              key={m.id}
              onClick={() => setAnalysisMode(m.id)}
              style={{
                padding: '4px 12px',
                background: active ? 'var(--color-surface-raised)' : 'transparent',
                border: 'none',
                color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                fontFamily: uiFont,
                fontSize: 11.5,
                cursor: 'pointer',
              }}
            >
              {m.label}
            </button>
          )
        })}
      </div>

      <button
        disabled
        title="Solver arrives in Phase 2 — schematic capture only for now"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 14px',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          color: 'var(--color-text-muted)',
          fontFamily: uiFont,
          fontSize: 12,
          cursor: 'not-allowed',
          opacity: 0.55,
        }}
      >
        <Play size={13} />
        Run
      </button>

      <div style={{ flex: 1 }} />

      <IconButton title="Undo (⌘Z)" onClick={undo} disabled={!history || history.past.length === 0}>
        <Undo2 size={14} />
      </IconButton>
      <IconButton title="Redo (⌘⇧Z)" onClick={redo} disabled={!history || history.future.length === 0}>
        <Redo2 size={14} />
      </IconButton>

      <button
        title="Reset view"
        onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
        style={{
          background: 'transparent',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          color: 'var(--color-text-secondary)',
          fontFamily: monoFont,
          fontSize: 11,
          padding: '4px 8px',
          cursor: 'pointer',
          minWidth: 52,
        }}
      >
        {Math.round(circuit.viewport.zoom * 100)}%
      </button>
    </div>
  )
}

function IconButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 7px',
        background: 'transparent',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        color: 'var(--color-text-secondary)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}
