// Simulation Tab shell — multi-domain simulation workspace. Circuits is the
// first fully-realized domain: schematic capture + union-find node detection
// (Phase 1) wired into the MNA solver in ../circuit-sim/engine for DC,
// transient, and AC analyses, with results overlaid on the schematic and
// waveforms in the scope panel below it.

import { useEffect, useMemo, useState } from 'react'
import { useProbeContext } from '../../hooks/useProbeContext'
import type { Circuit } from './types'
import { buildNetlist } from './core/netlist'
import { resolveProbes } from './core/probes'
import type { Selection, Tool } from './editorState'
import { SELECT_TOOL } from './editorState'
import { useSimulationStore } from './store/circuitStore'
import { useSimulationRun } from './hooks/useSimulationRun'
import { ComponentPalette } from './components/ComponentPalette'
import { InspectorPanel } from './components/InspectorPanel'
import { NetlistPreview } from './components/NetlistPreview'
import { ResultsPanel } from './components/ResultsPanel'
import { SchematicCanvas } from './components/SchematicCanvas'
import { SimulationControlBar } from './components/SimulationControlBar'
import { SimulationSidebar, type SimulationDomain } from './components/SimulationSidebar'
import { WaveformViewer } from './components/WaveformViewer'

export function SimulationTab() {
  const circuits = useSimulationStore((s) => s.circuits)
  const activeCircuitId = useSimulationStore((s) => s.activeCircuitId)
  const ensureCircuit = useSimulationStore((s) => s.ensureCircuit)

  useEffect(() => {
    ensureCircuit()
  }, [ensureCircuit])

  const circuit = activeCircuitId ? circuits[activeCircuitId] : null

  if (!circuit) {
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

  return <CircuitWorkspace circuit={circuit} />
}

function CircuitWorkspace({ circuit }: { circuit: Circuit }) {
  const [domain, setDomain] = useState<SimulationDomain>('circuits')
  const [tool, setTool] = useState<Tool>(SELECT_TOOL)
  const [selection, setSelection] = useState<Selection | null>(null)

  // Stale selections must not survive a circuit switch (render-time reset).
  const [lastCircuitId, setLastCircuitId] = useState(circuit.id)
  if (circuit.id !== lastCircuitId) {
    setLastCircuitId(circuit.id)
    setSelection(null)
    setTool(SELECT_TOOL)
  }

  const netlistBuild = useMemo(() => buildNetlist(circuit), [circuit])
  const resolvedProbes = useMemo(
    () => resolveProbes(circuit, netlistBuild.detection),
    [circuit, netlistBuild.detection],
  )
  const { runState, isStale, run } = useSimulationRun(circuit, netlistBuild)

  useProbeContext('simulation', {
    domain,
    tool: tool.kind,
    componentCount: Object.keys(circuit.components).length,
    netlistIssues: netlistBuild.issues.map((i) => i.message),
    solvable: !!netlistBuild.engineNetlist,
    lastRun:
      runState.status === 'idle'
        ? null
        : {
            status: runState.status,
            analysisType: runState.result?.kind ?? circuit.simulationSettings.mode,
            warningCount: runState.result?.warnings.length ?? 0,
            stale: isStale,
          },
  })

  const waveformResult =
    runState.status === 'done' && runState.result && runState.result.kind !== 'dc' ? runState.result : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, background: 'var(--color-bg)' }}>
      <SimulationControlBar
        circuit={circuit}
        canRun={!!netlistBuild.engineNetlist}
        running={runState.status === 'running'}
        onRun={run}
      />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SimulationSidebar domain={domain} onDomainChange={setDomain} />
        <ComponentPalette tool={tool} onToolChange={setTool} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 }}>
          <SchematicCanvas
            circuit={circuit}
            detection={netlistBuild.detection}
            resolvedProbes={resolvedProbes}
            tool={tool}
            onToolChange={setTool}
            selection={selection}
            onSelectionChange={setSelection}
            dcVoltages={
              runState.status === 'done' && !isStale && runState.result?.kind === 'dc'
                ? runState.result.nodeVoltages
                : null
            }
            dcCurrents={
              runState.status === 'done' && !isStale && runState.result?.kind === 'dc'
                ? runState.result.componentCurrents
                : null
            }
          />
          {waveformResult && (
            <WaveformViewer
              circuitName={circuit.name}
              result={waveformResult}
              stale={isStale}
              probedNodes={resolvedProbes
                .filter((rp) => rp.probe.kind === 'voltage' && rp.nodeId !== null && rp.nodeId !== 0)
                .map((rp) => ({ label: rp.probe.label, nodeId: rp.nodeId! }))}
            />
          )}
        </div>
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
              resolvedProbes={resolvedProbes}
              selection={selection}
              onSelectionChange={setSelection}
            />
          </div>
          <ResultsPanel runState={runState} isStale={isStale} detection={netlistBuild.detection} />
          <NetlistPreview build={netlistBuild} />
        </div>
      </div>
    </div>
  )
}

export default SimulationTab
