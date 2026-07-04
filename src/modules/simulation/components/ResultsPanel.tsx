// Solver results for the right column: DC operating point as node-voltage and
// component-current tables, run status/errors/warnings for every mode, and a
// staleness flag when the schematic was edited after the shown solve.

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import type { NodeDetectionResult } from '../core/nodeDetection'
import type { SimulationRunState } from '../hooks/useSimulationRun'
import { formatEngNotation } from '../core/engNotation'

interface Props {
  runState: SimulationRunState
  isStale: boolean
  detection: NodeDetectionResult
}

const mono: React.CSSProperties = {
  fontFamily: "var(--font-family-mono, 'Geist Mono', monospace)",
  fontSize: 11.5,
}

const uiFont = "var(--font-family-ui, 'Geist', sans-serif)"

const sectionHeader: React.CSSProperties = {
  fontFamily: uiFont,
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--color-text-muted)',
  padding: '8px 0 4px',
}

export function ResultsPanel({ runState, isStale, detection }: Props) {
  const [open, setOpen] = useState(true)
  const { status, result, error } = runState

  // Nothing has ever run: keep the column clean.
  if (status === 'idle') return null

  const modeLabel =
    result?.kind === 'dc' ? 'DC operating point' : result?.kind === 'transient' ? 'Transient' : result?.kind === 'ac' ? 'AC sweep' : null

  return (
    <div
      style={{
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        maxHeight: open ? '45%' : undefined,
        flexShrink: 0,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-secondary)',
          fontFamily: uiFont,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        Results
        {status === 'error' && (
          <span style={{ ...mono, fontSize: 10, color: 'var(--color-danger)', textTransform: 'none' }}>solver error</span>
        )}
        {isStale && status === 'done' && (
          <span style={{ ...mono, fontSize: 10, color: 'var(--color-warning)', textTransform: 'none' }}>stale</span>
        )}
      </button>

      {open && (
        <div style={{ overflowY: 'auto', padding: '0 12px 12px' }}>
          {status === 'running' && (
            <div style={{ ...mono, color: 'var(--color-text-muted)' }}>Solving…</div>
          )}

          {status === 'error' && (
            <div style={{ ...mono, color: 'var(--color-danger)', lineHeight: 1.5 }}>{error}</div>
          )}

          {status === 'done' && result && (
            <>
              {isStale && (
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    alignItems: 'flex-start',
                    fontFamily: uiFont,
                    fontSize: 11,
                    color: 'var(--color-warning)',
                    padding: '6px 0 2px',
                    lineHeight: 1.45,
                  }}
                >
                  <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                  The schematic changed after this solve — run again for fresh numbers.
                </div>
              )}

              <div style={sectionHeader}>{modeLabel}</div>

              {result.kind === 'dc' && (
                <>
                  {Object.entries(result.nodeVoltages)
                    .map(([node, v]) => [Number(node), v] as const)
                    .sort((a, b) => a[0] - b[0])
                    .map(([node, v]) => (
                      <div key={node} style={{ display: 'flex', gap: 10, padding: '2px 0' }}>
                        <span style={{ ...mono, color: 'var(--color-accent)', minWidth: 34 }}>
                          {node === 0 ? 'GND' : `N${node}`}
                        </span>
                        <span style={{ ...mono, color: 'var(--color-text-primary)' }}>
                          {formatEngNotation(v, 'V')}
                        </span>
                        <span style={{ ...mono, color: 'var(--color-text-muted)', fontSize: 10, alignSelf: 'center' }}>
                          {nodePinsSummary(detection, node)}
                        </span>
                      </div>
                    ))}

                  <div style={sectionHeader}>Currents</div>
                  {Object.entries(result.componentCurrents)
                    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
                    .map(([refdes, i]) => (
                      <div key={refdes} style={{ display: 'flex', gap: 10, padding: '2px 0' }}>
                        <span style={{ ...mono, color: 'var(--color-accent)', minWidth: 34 }}>{refdes}</span>
                        <span style={{ ...mono, color: 'var(--color-text-primary)' }}>{formatEngNotation(i, 'A')}</span>
                      </div>
                    ))}
                </>
              )}

              {result.kind === 'transient' && (
                <div style={{ ...mono, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  {result.time.length} points × {Object.keys(result.nodeVoltages).length} nodes — waveforms below.
                </div>
              )}

              {result.kind === 'ac' && (
                <div style={{ ...mono, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  {result.frequency.length} frequency points, stimulus {result.stimulus} — Bode plot below.
                </div>
              )}

              {result.warnings.length > 0 && (
                <>
                  <div style={sectionHeader}>Warnings</div>
                  {result.warnings.map((w, i) => (
                    <div key={i} style={{ ...mono, color: 'var(--color-warning)', padding: '2px 0', lineHeight: 1.45 }}>
                      {w}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** "V1.pos R1.a" context string for a node id, empty for unknown nodes. */
function nodePinsSummary(detection: NodeDetectionResult, nodeId: number): string {
  const node = detection.nodes.find((n) => n.id === nodeId)
  if (!node) return ''
  return node.pins.map((p) => `${p.refdes}.${p.pinName}`).join(' ')
}
