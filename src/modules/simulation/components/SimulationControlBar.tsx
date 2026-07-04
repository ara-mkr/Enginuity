// Top control strip: circuit switcher, analysis-mode selector with per-mode
// solver settings, Run (wired to the MNA engine via useSimulationRun),
// undo/redo, and zoom readout.

import { useState } from 'react'
import { Loader2, Play, Plus, Redo2, Undo2 } from 'lucide-react'
import type { AnalysisMode, Circuit } from '../types'
import { useSimulationStore } from '../store/circuitStore'
import { ENG_NOTATION_HINT, formatEngNotation, parseEngNotation } from '../core/engNotation'

interface Props {
  circuit: Circuit
  /** False while netlist issues make the circuit unsolvable. */
  canRun: boolean
  running: boolean
  onRun: () => void
}

const MODES: Array<{ id: AnalysisMode; label: string }> = [
  { id: 'dc', label: 'DC' },
  { id: 'transient', label: 'Transient' },
  { id: 'ac', label: 'AC' },
]

const uiFont = "var(--font-family-ui, 'Geist', sans-serif)"
const monoFont = "var(--font-family-mono, 'Geist Mono', monospace)"

export function SimulationControlBar({ circuit, canRun, running, onRun }: Props) {
  const circuits = useSimulationStore((s) => s.circuits)
  const setActiveCircuit = useSimulationStore((s) => s.setActiveCircuit)
  const createCircuit = useSimulationStore((s) => s.createCircuit)
  const renameCircuit = useSimulationStore((s) => s.renameCircuit)
  const setAnalysisMode = useSimulationStore((s) => s.setAnalysisMode)
  const updateSimulationSettings = useSimulationStore((s) => s.updateSimulationSettings)
  const setViewport = useSimulationStore((s) => s.setViewport)
  const undo = useSimulationStore((s) => s.undo)
  const redo = useSimulationStore((s) => s.redo)
  const history = useSimulationStore((s) => s.history[circuit.id])

  const list = Object.values(circuits).sort((a, b) => a.createdAt - b.createdAt)
  const { mode, transient, ac } = circuit.simulationSettings

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        rowGap: 6,
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
          const active = mode === m.id
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

      {/* Per-mode solver settings */}
      {mode === 'transient' && (
        <>
          <EngField
            label="Stop"
            unit="s"
            value={transient.stopTime}
            validate={(v) => (v > 0 ? null : 'must be positive')}
            onCommit={(stopTime) => updateSimulationSettings({ transient: { ...transient, stopTime } })}
          />
          <EngField
            label="Step"
            unit="s"
            value={transient.timeStep}
            validate={(v) => (v > 0 ? null : 'must be positive')}
            onCommit={(timeStep) => updateSimulationSettings({ transient: { ...transient, timeStep } })}
          />
        </>
      )}
      {mode === 'ac' && (
        <>
          <EngField
            label="From"
            unit="Hz"
            value={ac.startFreq}
            validate={(v) => (v > 0 ? null : 'must be positive')}
            onCommit={(startFreq) => updateSimulationSettings({ ac: { ...ac, startFreq } })}
          />
          <EngField
            label="To"
            unit="Hz"
            value={ac.stopFreq}
            validate={(v) => (v > 0 ? null : 'must be positive')}
            onCommit={(stopFreq) => updateSimulationSettings({ ac: { ...ac, stopFreq } })}
          />
          <EngField
            label="Pts/dec"
            unit=""
            value={ac.pointsPerDecade}
            validate={(v) => (v >= 1 ? null : 'needs ≥ 1')}
            onCommit={(pointsPerDecade) =>
              updateSimulationSettings({ ac: { ...ac, pointsPerDecade: Math.round(pointsPerDecade) } })
            }
          />
        </>
      )}

      <button
        onClick={onRun}
        disabled={!canRun || running}
        title={
          running
            ? 'Solver is running…'
            : canRun
              ? `Run ${mode.toUpperCase()} analysis`
              : 'Fix the netlist issues in the preview panel first'
        }
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 14px',
          background: canRun && !running ? 'var(--color-accent)' : 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          color: canRun && !running ? 'var(--color-bg)' : 'var(--color-text-muted)',
          fontFamily: uiFont,
          fontSize: 12,
          fontWeight: 500,
          cursor: canRun && !running ? 'pointer' : 'not-allowed',
          opacity: canRun || running ? 1 : 0.55,
        }}
      >
        {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
        {running ? 'Solving…' : 'Run'}
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

/** Compact engineering-notation field sized for the control bar (commit on Enter/blur, revert on Esc/invalid). */
function EngField({
  label,
  unit,
  value,
  validate,
  onCommit,
}: {
  label: string
  unit: string
  value: number
  validate: (v: number) => string | null
  onCommit: (v: number) => void
}) {
  const [text, setText] = useState(() => formatEngNotation(value))
  const [invalid, setInvalid] = useState(false)

  // Re-sync when the committed value changes externally (render-time reset).
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setText(formatEngNotation(value))
    setInvalid(false)
  }

  const commit = () => {
    const parsed = parseEngNotation(text)
    if (parsed === null || validate(parsed) !== null) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    if (parsed !== value) onCommit(parsed)
    else setText(formatEngNotation(value))
  }

  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 4 }} title={ENG_NOTATION_HINT}>
      <span style={{ fontFamily: uiFont, fontSize: 10.5, color: 'var(--color-text-muted)' }}>{label}</span>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            e.stopPropagation()
            setText(formatEngNotation(value))
            setInvalid(false)
          }
        }}
        style={{
          width: 58,
          boxSizing: 'border-box',
          background: 'var(--color-bg)',
          border: `1px solid ${invalid ? 'var(--color-danger)' : 'var(--color-border)'}`,
          borderRadius: 6,
          color: 'var(--color-text-primary)',
          fontFamily: monoFont,
          fontSize: 11,
          padding: '3px 6px',
          outline: 'none',
        }}
      />
      {unit && (
        <span style={{ fontFamily: monoFont, fontSize: 10, color: 'var(--color-text-muted)' }}>{unit}</span>
      )}
    </label>
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
