import React from 'react'
import { Grid, LayoutGrid, AlignHorizontalJustifyStart, AlignVerticalJustifyStart, Trash2, Home } from 'lucide-react'
import { useWorkspace } from '../../context/WorkspaceContext'
import { WorkspaceWindow } from './WorkspaceWindow'
import { QuickLayoutSwitcher } from '../LayoutManager'

// Import all modules to render inside the windows
import { Dashboard } from '../../modules/dashboard/Dashboard'
import { CadViewer } from '../../modules/cad-viewer/CadViewer'
import { ParameterPlayground } from '../../modules/parameter-playground/ParameterPlayground'
import { AssetGenerator } from '../../modules/asset-generator/AssetGenerator'
import { SimulationAssistant } from '../../modules/simulation-assistant/SimulationAssistant'
import { ProjectIdeas } from '../../modules/project-ideas/ProjectIdeas'
import { DebugConsole } from '../../modules/debug-console/DebugConsole'
import ModelComparison from '../../modules/model-comparison/ModelComparison'
import CircuitSim from '../../modules/circuit-sim/CircuitSim'
import { DatasheetIntelligence } from '../../modules/datasheet/DatasheetIntelligence'
import { EngineeringNotebook } from '../../modules/notebook/EngineeringNotebook'
import { BOMIntelligence } from '../../modules/bom/BOMIntelligence'
import { FormulaLab } from '../../modules/formula-lab/FormulaLab'
import { TemplatesGallery } from '../../modules/templates/TemplatesGallery'
import ChallengeMode from '../../modules/challenges/ChallengeMode'
import { FirmwareDiffViewer } from '../../modules/firmware-diff/FirmwareDiffViewer'
import { PCBReviewer } from '../../modules/pcb-reviewer/PCBReviewer'
import { FootprintGen } from '../../modules/footprint-gen/FootprintGen'
// @ts-ignore
import { HistoryPage } from '../../modules/history/HistoryPage.jsx'
// @ts-ignore
import { SupplyChainMonitor } from '../../modules/supply-chain/SupplyChainMonitor.jsx'
import { TestHarness } from '../../modules/test-harness/TestHarness'
import { ComplianceChecker } from '../../modules/compliance/ComplianceChecker'
import { JarvisModule } from '../../modules/jarvis/JarvisModule'
import CollabLanding from '../../modules/collaboration/CollabLanding'
import { DrawingBoard } from '../../modules/drawing-board/DrawingBoard'

const MODULE_COMPONENTS: Record<string, React.ComponentType<any>> = {
  'drawing-board': DrawingBoard,
  'dashboard': Dashboard,
  'cad-viewer': CadViewer,
  'parameter-playground': ParameterPlayground,
  'asset-generator': AssetGenerator,
  'simulation-assistant': SimulationAssistant,
  'project-ideas': ProjectIdeas,
  'ideas': ProjectIdeas,
  'debug-console': DebugConsole,
  'model-comparison': ModelComparison,
  'circuit-sim': CircuitSim,
  'datasheet': DatasheetIntelligence,
  'notebook': EngineeringNotebook,
  'bom': BOMIntelligence,
  'formula-lab': FormulaLab,
  'templates': TemplatesGallery,
  'challenges': ChallengeMode,
  'firmware-diff': FirmwareDiffViewer,
  'pcb-reviewer': PCBReviewer,
  'footprint-gen': FootprintGen,
  'history': HistoryPage,
  'supply-chain': SupplyChainMonitor,
  'test-harness': TestHarness,
  'compliance': ComplianceChecker,
  'jarvis': JarvisModule,
  'collaborate': CollabLanding,
}

// Quick labels for dock items
const DOCK_LABELS: Record<string, string> = {
  'drawing-board': 'Board',
  'dashboard': 'Brain',
  'cad-viewer': 'CAD',
  'parameter-playground': 'Param',
  'asset-generator': 'Graphic',
  'simulation-assistant': 'Sim',
  'project-ideas': 'Ideas',
  'debug-console': 'Debug',
  'model-comparison': 'Model',
  'circuit-sim': 'Circuit',
  'datasheet': 'Data',
  'notebook': 'Note',
  'bom': 'BOM',
  'formula-lab': 'Form',
  'templates': 'Temp',
  'challenges': 'Chal',
  'firmware-diff': 'Firm',
  'pcb-reviewer': 'PCB',
  'footprint-gen': 'Foot',
  'history': 'Hist',
  'supply-chain': 'Supply',
  'test-harness': 'Test',
  'compliance': 'Comp',
  'jarvis': 'Jarvis',
  'collaborate': 'Collab',
}

export const WorkspaceCanvas: React.FC = () => {
  const {
    windows,
    tileWindows,
    closeWindow,
    minimizeWindow,
    restoreWindow,
    bringToFront,
    setLayoutMode,
    setLayoutsModalOpen,
  } = useWorkspace()

  const renderModuleContent = (type: string) => {
    const Component = MODULE_COMPONENTS[type]
    if (!Component) return <div style={{ padding: 20 }}>Module not found: {type}</div>

    if (type === 'collaborate') {
      return (
        <Component
          onJoin={(roomId: string, name: string) => {
            window.location.href = `/?room=${roomId}&collab_name=${encodeURIComponent(name)}`
          }}
        />
      )
    }

    return <Component />
  }

  const handleDockItemClick = (winId: string) => {
    const target = windows.find((w) => w.id === winId)
    if (!target) return

    // If minimized, restore it and focus
    if (target.isMinimized) {
      restoreWindow(target.id)
      return
    }

    // If it's open but not at the front, bring it to front
    const maxZ = Math.max(...windows.map((w) => w.zIndex), 0)
    if (target.zIndex < maxZ) {
      bringToFront(target.id)
      return
    }

    // If it's already active and at the front, minimize it
    minimizeWindow(target.id)
  }

  const handleCloseAll = () => {
    windows.forEach((w) => closeWindow(w.id))
  }

  return (
    <div
      id="workspace-canvas"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#040408',
        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Workspace Controls Header */}
      <div
        style={{
          height: 40,
          background: 'rgba(12, 12, 20, 0.7)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 1000,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Multi-Window Workspace
          </span>
        </div>

        {/* Workspace Operations */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => tileWindows('grid')}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 4,
              padding: '4px 8px',
              color: 'var(--text-muted)',
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              height: 24,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
              e.currentTarget.style.color = 'var(--text)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
            title="Grid Tiling"
          >
            <LayoutGrid size={11} style={{ color: 'var(--accent)' }} />
            <span>Grid</span>
          </button>
          
          <button
            onClick={() => tileWindows('vertical')}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 4,
              padding: '4px 8px',
              color: 'var(--text-muted)',
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              height: 24,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
              e.currentTarget.style.color = 'var(--text)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
            title="Tile Columns"
          >
            <AlignHorizontalJustifyStart size={11} style={{ color: 'var(--accent)' }} />
            <span>Columns</span>
          </button>

          <button
            onClick={() => tileWindows('horizontal')}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 4,
              padding: '4px 8px',
              color: 'var(--text-muted)',
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              height: 24,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
              e.currentTarget.style.color = 'var(--text)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
            title="Tile Rows"
          >
            <AlignVerticalJustifyStart size={11} style={{ color: 'var(--accent)' }} />
            <span>Rows</span>
          </button>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

          <QuickLayoutSwitcher />

          <button
            onClick={() => setLayoutsModalOpen(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 4,
              padding: '4px 8px',
              color: 'var(--text-muted)',
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              height: 24,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
              e.currentTarget.style.color = 'var(--text)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
            title="Layouts Manager"
          >
            <span>Layouts</span>
          </button>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

          <button
            onClick={handleCloseAll}
            disabled={windows.length === 0}
            style={{
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              borderRadius: 4,
              padding: '4px 8px',
              color: '#b08080',
              fontSize: 11,
              cursor: windows.length === 0 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              opacity: windows.length === 0 ? 0.4 : 1,
              height: 24,
            }}
            onMouseEnter={(e) => {
              if (windows.length > 0) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'
            }}
            onMouseLeave={(e) => {
              if (windows.length > 0) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'
            }}
          >
            <Trash2 size={11} />
            <span>Close All</span>
          </button>
        </div>
      </div>

      {/* Floating Windows Workspace Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {windows.length === 0 ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              color: 'var(--text-dim)',
              userSelect: 'none',
            }}
          >
            <Grid size={40} style={{ opacity: 0.15, strokeWidth: 1.2, color: 'var(--accent)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Empty Workspace</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click modules in the sidebar to open floating windows.</div>
            </div>
            
            <button
              onClick={() => setLayoutMode('single')}
              style={{
                marginTop: 10,
                background: 'rgba(0, 200, 255, 0.08)',
                border: '1px solid rgba(0, 200, 255, 0.2)',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 12,
                color: 'var(--accent)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 200, 255, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 200, 255, 0.08)'}
            >
              <Home size={12} />
              Return to Landing
            </button>
          </div>
        ) : (
          windows.map((win) => (
            <WorkspaceWindow key={win.id} window={win}>
              {renderModuleContent(win.type)}
            </WorkspaceWindow>
          ))
        )}
      </div>

      {/* Floating Desktop Dock */}
      {windows.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 'calc(260px + (100% - 260px) / 2)',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(15, 15, 25, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '6px 10px',
            borderRadius: 12,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            zIndex: 10000,
            maxWidth: 'calc(100% - 300px)',
            overflowX: 'auto',
          }}
        >
          {windows.map((win) => {
            const isFront = win.zIndex === Math.max(...windows.map((w) => w.zIndex), 0)
            const isActive = !win.isMinimized && isFront
            
            return (
              <button
                key={win.id}
                onClick={() => handleDockItemClick(win.id)}
                style={{
                  background: isActive ? 'rgba(0, 200, 255, 0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isActive ? 'rgba(0, 200, 255, 0.3)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 6,
                  padding: '4px 10px',
                  height: 28,
                  fontSize: 11,
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                    e.currentTarget.style.color = 'var(--text)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                    e.currentTarget.style.color = 'var(--text-muted)'
                  }
                }}
              >
                {/* Active/Minimized dot */}
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: win.isMinimized ? '#b09a50' : 'var(--accent)',
                    display: 'block',
                  }}
                />
                <span>{DOCK_LABELS[win.type] || win.title}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
