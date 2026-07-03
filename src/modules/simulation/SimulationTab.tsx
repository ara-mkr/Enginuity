// Simulation Tab shell — multi-domain simulation workspace. Circuits is the
// first fully-realized domain (Phase 1: schematic capture + union-find node
// detection + netlist preview; the MNA solver in ../circuit-sim/engine wires
// into this shell in Phase 2).

import { useEffect, useMemo, useState } from 'react'
import { useProbeContext } from '../../hooks/useProbeContext'
import { buildNetlist } from './core/netlist'
import type { Selection, Tool } from './editorState'
import { SELECT_TOOL } from './editorState'
import { useSimulationStore } from './store/circuitStore'
import { ComponentPalette } from './components/ComponentPalette'
import { InspectorPanel } from './components/InspectorPanel'
import { NetlistPreview } from './components/NetlistPreview'
import { SchematicCanvas } from './components/SchematicCanvas'
import { SimulationControlBar } from './components/SimulationControlBar'
import { SimulationSidebar, type SimulationDomain } from './components/SimulationSidebar'

export function SimulationTab() {
  const circuits = useSimulationStore((s) => s.circuits)
  const activeCircuitId = useSimulationStore((s) => s.activeCircuitId)
  const ensureCircuit = useSimulationStore((s) => s.ensureCircuit)

  const [domain, setDomain] = useState<SimulationDomain>('circuits')
  const [tool, setTool] = useState<Tool>(SELECT_TOOL)
  const [selection, setSelection] = useState<Selection | null>(null)

  useEffect(() => {
    ensureCircuit()
  }, [ensureCircuit])

  // Stale selections must not survive a circuit switch (render-time reset).
  const [lastCircuitId, setLastCircuitId] = useState(activeCircuitId)
  if (activeCircuitId !== lastCircuitId) {
    setLastCircuitId(activeCircuitId)
    setSelection(null)
    setTool(SELECT_TOOL)
  }

  const circuit = activeCircuitId ? circuits[activeCircuitId] : null

  const netlistBuild = useMemo(
    () => (circuit ? buildNetlist(circuit) : null),
    [circuit],
  )

  useProbeContext('simulation', {
    domain,
    tool: tool.kind,
    componentCount: circuit ? Object.keys(circuit.components).length : 0,
    netlistIssues: netlistBuild?.issues.map((i) => i.message) ?? [],
    solvable: !!netlistBuild?.engineNetlist,
  })

  if (!circuit || !netlistBuild) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          fontFamily: "var(--font-family-ui, 'Geist', sans-serif)",
          fontSize: 13,
        }}
      >
        Preparing workspace…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--color-bg)' }}>
      <SimulationControlBar circuit={circuit} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SimulationSidebar domain={domain} onDomainChange={setDomain} />
        <ComponentPalette tool={tool} onToolChange={setTool} />
        <SchematicCanvas
          circuit={circuit}
          detection={netlistBuild.detection}
          tool={tool}
          onToolChange={setTool}
          selection={selection}
          onSelectionChange={setSelection}
        />
        <div
          style={{
            width: 288,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            minHeight: 0,
          }}
        >
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <InspectorPanel
              circuit={circuit}
              detection={netlistBuild.detection}
              selection={selection}
              onSelectionChange={setSelection}
            />
          </div>
          <NetlistPreview build={netlistBuild} />
        </div>
      </div>
    </div>
  )
}

export default SimulationTab
