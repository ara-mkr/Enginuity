// Parameter editor for the current selection. Component → editable params
// (unit-aware with validation), rotation, delete. Wire → its electrical node
// id and delete. Nothing selected → quiet hint.

import { RotateCw, Trash2 } from 'lucide-react'
import type { Circuit } from '../types'
import { getDef } from '../componentDefs'
import type { NodeDetectionResult } from '../core/nodeDetection'
import type { ResolvedProbe } from '../core/probes'
import { useSimulationStore } from '../store/circuitStore'
import type { Selection } from '../editorState'
import { ParameterField } from './ParameterField'

interface Props {
  circuit: Circuit
  detection: NodeDetectionResult
  resolvedProbes: ResolvedProbe[]
  selection: Selection | null
  onSelectionChange: (s: Selection | null) => void
}

const headerStyle: React.CSSProperties = {
  fontFamily: "var(--font-family-ui, 'Geist', sans-serif)",
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--color-text-muted)',
  padding: '10px 12px 6px',
}

export function InspectorPanel({ circuit, detection, resolvedProbes, selection, onSelectionChange }: Props) {
  const setComponentParam = useSimulationStore((s) => s.setComponentParam)
  const rotateComponent = useSimulationStore((s) => s.rotateComponent)
  const removeComponent = useSimulationStore((s) => s.removeComponent)
  const removeWire = useSimulationStore((s) => s.removeWire)
  const removeProbe = useSimulationStore((s) => s.removeProbe)

  const component = selection?.kind === 'component' ? circuit.components[selection.id] : null
  const wire = selection?.kind === 'wire' ? circuit.wires.find((w) => w.id === selection.id) : null
  const probe = selection?.kind === 'probe' ? resolvedProbes.find((p) => p.probe.id === selection.id) ?? null : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
      <div style={headerStyle}>Inspector</div>

      {!component && !wire && !probe && (
        <div
          style={{
            padding: '4px 12px 12px',
            fontFamily: "var(--font-family-ui, 'Geist', sans-serif)",
            fontSize: 12,
            color: 'var(--color-text-muted)',
            lineHeight: 1.5,
          }}
        >
          Select a component or wire to edit it.
        </div>
      )}

      {component && (
        <div style={{ padding: '0 12px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <span
              style={{
                fontFamily: "var(--font-family-mono, 'Geist Mono', monospace)",
                fontSize: 15,
                color: 'var(--color-text-primary)',
              }}
            >
              {component.refdes}
            </span>
            <span
              style={{
                fontFamily: "var(--font-family-ui, 'Geist', sans-serif)",
                fontSize: 11.5,
                color: 'var(--color-text-secondary)',
              }}
            >
              {getDef(component.type).label}
            </span>
          </div>

          {getDef(component.type).params.map((p) => (
            <ParameterField
              key={p.key}
              def={p}
              value={component.params[p.key] ?? p.defaultValue}
              onCommit={(v) => setComponentParam(component.id, p.key, v)}
            />
          ))}

          {/* Pin → node assignments, straight from union-find detection */}
          <div style={{ ...headerStyle, padding: '8px 0 6px' }}>Pins</div>
          {getDef(component.type).pins.map((pin) => {
            const nodeId = detection.nodeOfPin.get(`${component.id}:${pin.name}`)
            const floating = detection.floatingPins.some(
              (f) => f.componentId === component.id && f.pinName === pin.name,
            )
            return (
              <div
                key={pin.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: "var(--font-family-mono, 'Geist Mono', monospace)",
                  fontSize: 11.5,
                  padding: '3px 0',
                  color: 'var(--color-text-secondary)',
                }}
              >
                <span>{pin.name}</span>
                <span style={{ color: floating ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>
                  {floating ? 'floating' : nodeId === 0 ? 'GND' : `N${nodeId}`}
                </span>
              </div>
            )
          })}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <ActionButton
              label="Rotate"
              hint="R"
              icon={<RotateCw size={13} />}
              onClick={() => rotateComponent(component.id)}
            />
            <ActionButton
              label="Delete"
              hint="Del"
              icon={<Trash2 size={13} />}
              danger
              onClick={() => {
                removeComponent(component.id)
                onSelectionChange(null)
              }}
            />
          </div>
        </div>
      )}

      {probe && (
        <div style={{ padding: '0 12px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
            <span
              style={{
                fontFamily: "var(--font-family-mono, 'Geist Mono', monospace)",
                fontSize: 15,
                color: 'var(--color-text-primary)',
              }}
            >
              {probe.probe.label}
            </span>
            <span
              style={{
                fontFamily: "var(--font-family-ui, 'Geist', sans-serif)",
                fontSize: 11.5,
                color: 'var(--color-text-secondary)',
              }}
            >
              {probe.probe.kind === 'voltage' ? 'Voltage probe' : 'Current probe'}
            </span>
          </div>
          <div
            style={{
              fontFamily: "var(--font-family-ui, 'Geist', sans-serif)",
              fontSize: 11.5,
              color: 'var(--color-text-muted)',
              marginBottom: 12,
              lineHeight: 1.5,
            }}
          >
            {probe.probe.kind === 'voltage'
              ? probe.nodeId !== null
                ? `Measuring node ${probe.nodeId === 0 ? 'GND' : `N${probe.nodeId}`}. Voltage probes drive the waveform trace selection.`
                : 'Not touching any conductor — drop it on a pin or wire.'
              : probe.component
                ? `Measuring current through ${probe.component.refdes} (DC runs).`
                : 'Not over any component body — drop it on a part.'}
          </div>
          <ActionButton
            label="Delete probe"
            hint="Del"
            icon={<Trash2 size={13} />}
            danger
            onClick={() => {
              removeProbe(probe.probe.id)
              onSelectionChange(null)
            }}
          />
        </div>
      )}

      {wire && (
        <div style={{ padding: '0 12px 12px' }}>
          <div
            style={{
              fontFamily: "var(--font-family-mono, 'Geist Mono', monospace)",
              fontSize: 13,
              color: 'var(--color-text-primary)',
              marginBottom: 8,
            }}
          >
            Wire · node{' '}
            {detection.nodeOfWire.get(wire.id) === 0 ? 'GND' : `N${detection.nodeOfWire.get(wire.id) ?? '?'}`}
          </div>
          <div
            style={{
              fontFamily: "var(--font-family-ui, 'Geist', sans-serif)",
              fontSize: 11.5,
              color: 'var(--color-text-muted)',
              marginBottom: 12,
              lineHeight: 1.5,
            }}
          >
            Everything highlighted on the canvas is the same electrical node.
          </div>
          <ActionButton
            label="Delete wire"
            hint="Del"
            icon={<Trash2 size={13} />}
            danger
            onClick={() => {
              removeWire(wire.id)
              onSelectionChange(null)
            }}
          />
        </div>
      )}
    </div>
  )
}

function ActionButton({
  label,
  hint,
  icon,
  danger,
  onClick,
}: {
  label: string
  hint?: string
  icon: React.ReactNode
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        background: 'transparent',
        border: '1px solid var(--color-border)',
        borderRadius: 6,
        color: danger ? 'var(--color-danger)' : 'var(--color-text-secondary)',
        fontFamily: "var(--font-family-ui, 'Geist', sans-serif)",
        fontSize: 11.5,
        cursor: 'pointer',
      }}
    >
      {icon}
      {label}
      {hint && <span style={{ fontSize: 9.5, color: 'var(--color-text-muted)' }}>{hint}</span>}
    </button>
  )
}
