// Debug panel proving node detection is right before any solver math exists:
// detected electrical nodes with their pin membership, the SPICE-style
// netlist, and topology issues. Phase 1's acceptance gate lives here.

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { NetlistBuild } from '../core/netlist'

interface Props {
  build: NetlistBuild
}

const mono: React.CSSProperties = {
  fontFamily: "var(--font-family-mono, 'Geist Mono', monospace)",
  fontSize: 11.5,
}

const sectionHeader: React.CSSProperties = {
  fontFamily: "var(--font-family-ui, 'Geist', sans-serif)",
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--color-text-muted)',
  padding: '8px 0 4px',
}

export function NetlistPreview({ build }: Props) {
  const [open, setOpen] = useState(true)
  const { detection, lines, issues } = build
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')

  return (
    <div
      style={{
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        maxHeight: open ? '45%' : undefined,
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
          fontFamily: "var(--font-family-ui, 'Geist', sans-serif)",
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        Netlist Preview
        {errors.length > 0 && (
          <span style={{ ...mono, fontSize: 10, color: 'var(--color-danger)', textTransform: 'none' }}>
            {errors.length} {errors.length === 1 ? 'issue' : 'issues'}
          </span>
        )}
      </button>

      {open && (
        <div style={{ overflowY: 'auto', padding: '0 12px 12px' }}>
          {(errors.length > 0 || warnings.length > 0) && (
            <div>
              <div style={sectionHeader}>Issues</div>
              {errors.map((issue, i) => (
                <div key={`e${i}`} style={{ ...mono, color: 'var(--color-danger)', padding: '2px 0', lineHeight: 1.45 }}>
                  {issue.message}
                </div>
              ))}
              {warnings.map((issue, i) => (
                <div key={`w${i}`} style={{ ...mono, color: 'var(--color-warning)', padding: '2px 0', lineHeight: 1.45 }}>
                  {issue.message}
                </div>
              ))}
            </div>
          )}

          <div style={sectionHeader}>Electrical Nodes</div>
          {detection.nodes.length === 0 && (
            <div style={{ ...mono, color: 'var(--color-text-muted)' }}>— none detected —</div>
          )}
          {detection.nodes.map((node) => (
            <div key={node.id} style={{ display: 'flex', gap: 10, padding: '2px 0' }}>
              <span style={{ ...mono, color: 'var(--color-accent)', minWidth: 34 }}>
                {node.id === 0 ? 'GND' : `N${node.id}`}
              </span>
              <span style={{ ...mono, color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
                {node.pins.length > 0
                  ? node.pins.map((p) => `${p.refdes}.${p.pinName}`).join('  ')
                  : '(wire only)'}
                {node.wireIds.length > 0 && (
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {'  '}· {node.wireIds.length} wire{node.wireIds.length > 1 ? 's' : ''}
                  </span>
                )}
              </span>
            </div>
          ))}

          <div style={sectionHeader}>Netlist</div>
          {lines.length === 0 && <div style={{ ...mono, color: 'var(--color-text-muted)' }}>— empty —</div>}
          {lines.map((line, i) => (
            <div key={i} style={{ ...mono, color: 'var(--color-text-primary)', padding: '1.5px 0' }}>
              {line}
            </div>
          ))}

          {build.engineNetlist && (
            <div style={{ ...mono, fontSize: 10.5, color: 'var(--color-success, #4caf7d)', paddingTop: 8 }}>
              ✓ netlist is solver-ready
            </div>
          )}
        </div>
      )}
    </div>
  )
}
