import { useEffect, useState, Component } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ProjectProvider } from './context/ProjectContext'
import { OpenRouterProvider } from './context/OpenRouterContext'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { APIKeyBanner } from './components/APIKeyBanner'
import { Dashboard } from './modules/dashboard/Dashboard'
import { HomeLanding } from './modules/home-landing/HomeLanding'
import { CadViewer } from './modules/cad-viewer/CadViewer'
import { ParameterPlayground } from './modules/parameter-playground/ParameterPlayground'
import { AssetGenerator } from './modules/asset-generator/AssetGenerator'
import { SimulationAssistant } from './modules/simulation-assistant/SimulationAssistant'
import { ProjectIdeas } from './modules/project-ideas/ProjectIdeas'
import { DebugConsole } from './modules/debug-console/DebugConsole'
import CollabLanding from './modules/collaboration/CollabLanding'
import ModelComparison from './modules/model-comparison/ModelComparison'
import CircuitSim from './modules/circuit-sim/CircuitSim'
import { DatasheetIntelligence } from './modules/datasheet/DatasheetIntelligence'
import { EngineeringNotebook } from './modules/notebook/EngineeringNotebook'
import { BOMIntelligence } from './modules/bom/BOMIntelligence'
import { FormulaLab } from './modules/formula-lab/FormulaLab'
import { TemplatesGallery } from './modules/templates/TemplatesGallery'
import { OfflineBanner } from './components/OfflineBanner'
import { VoiceButton } from './components/VoiceButton'
import { PWAInstallPrompt } from './components/PWAInstallPrompt'
import ChallengeMode from './modules/challenges/ChallengeMode'
import { FirmwareDiffViewer } from './modules/firmware-diff/FirmwareDiffViewer'
import { PCBReviewer } from './modules/pcb-reviewer/PCBReviewer'
import { FootprintGen } from './modules/footprint-gen/FootprintGen'
import { TestHarness } from './modules/test-harness/TestHarness'
import { ComplianceChecker } from './modules/compliance/ComplianceChecker'
import { TimelineModule } from './modules/timeline/TimelineModule'
import { DrawingBoard } from './modules/drawing-board/DrawingBoard'
import { logEvent } from './engine/eventLog'
// @ts-ignore
import { useEnginguityStore } from './engine/persistenceEngine'
// @ts-ignore
import { Copilot } from './components/Copilot/index.jsx'
// @ts-ignore
import { CrossSearch } from './components/CrossSearch/index.jsx'
// @ts-ignore
import { SessionBriefing } from './components/SessionBriefing/index.jsx'
// @ts-ignore
import { HistoryPage } from './modules/history/HistoryPage.jsx'
// @ts-ignore
import { SupplyChainMonitor } from './modules/supply-chain/SupplyChainMonitor.jsx'
import { JarvisModule } from './modules/jarvis/JarvisModule'
import { SimulationTab } from './modules/simulation/SimulationTab'
import { LiveDocs } from './modules/live-docs/LiveDocs'
import { ToolMarketplace } from './modules/tool-marketplace/ToolMarketplace'
import { CustomToolFrame } from './modules/tool-marketplace/CustomToolFrame'
// @ts-ignore
import { startWatcher } from './modules/live-docs/docWatcher'
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext'
import { WorkspaceCanvas } from './components/Workspace/WorkspaceCanvas'
import { LayoutManagerModal, TemplateSelectorModal } from './components/LayoutManager'
import { TooltipManager } from './components/TooltipManager'
import { layoutEngine } from './engine/layoutEngine'
// @ts-ignore
import { initSessionDiff } from './engine/sessionDiff'
import { FocusModeProvider, useFocusMode } from './context/FocusModeContext'
import { ProbeChatProvider } from './context/ProbeChatContext'
import { HomeChatProvider } from './context/HomeChatContext'
// @ts-ignore
import CommandPalette from './components/CommandPalette/index.jsx'

initSessionDiff()
try { startWatcher() } catch { /* doc watcher is non-critical */ }

class ModuleErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) return (
      <div style={{ padding: 40, color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 14 }}>
        This module encountered an error. <button onClick={() => this.setState({ hasError: false })} style={{ marginLeft: 8, cursor: 'pointer' }}>Retry</button>
      </div>
    )
    return this.props.children
  }
}

class RootErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error } }
  render() {
    if (this.state.hasError) return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#080808', color: '#e2e2e2', fontFamily: 'monospace', fontSize: 13, gap: 16, padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>⚠ Enginguity failed to load</div>
        <div style={{ color: '#f87171', background: '#1a0a0a', border: '1px solid #3f1a1a', borderRadius: 8, padding: '12px 20px', maxWidth: 600, wordBreak: 'break-all' }}>
          {this.state.error?.message || 'Unknown error'}
        </div>
        <button
          onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
          style={{ marginTop: 8, padding: '8px 20px', background: '#1e1e1e', border: '1px solid #2e2e2e', borderRadius: 8, color: '#e2e2e2', cursor: 'pointer', fontFamily: 'monospace' }}
        >
          Reload
        </button>
      </div>
    )
    return this.props.children
  }
}

function getModuleFromPath(path: string): string {
  if (path === '/') return 'home'
  return path.split('/')[1] || 'global'
}

function AppContent() {
  const { pathname } = useLocation()
  const { isFocusMode, exitFocusMode, toggleFocusMode } = useFocusMode()
  const {
    layoutMode,
    windows,
    activeWindowId,
    layoutsModalOpen,
    setLayoutsModalOpen,
    activeLayoutId,
    applyLayoutState,
  } = useWorkspace()

  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // One-time migration of legacy localStorage keys into the new zustand store.
  useEffect(() => {
    if (localStorage.getItem('enginguity_migrated_v2')) return
    try {
      const store = useEnginguityStore.getState()

      const oldHistory = JSON.parse(localStorage.getItem('enginguity_file_history') || '[]')
      if (Array.isArray(oldHistory)) {
        oldHistory.forEach((item: any) => {
          if (item && item.name) store.addToFileHistory(item)
        })
      }

      const oldBOM = JSON.parse(localStorage.getItem('enginguity_bom_current') || '[]')
      if (Array.isArray(oldBOM) && oldBOM.length) store.setBOMItems(oldBOM)

      localStorage.setItem('enginguity_migrated_v2', 'true')
      console.info('[ENGINGUITY] migrated legacy localStorage → zustand store')
    } catch (err) {
      console.warn('[ENGINGUITY] v2 migration failed:', err)
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false)
      }
    }
    const openHandler = () => setCommandPaletteOpen(true)

    window.addEventListener('keydown', handler)
    window.addEventListener('enginguity_open_command_palette', openHandler)

    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('enginguity_open_command_palette', openHandler)
    }
  }, [])

  // Session tracking on page/route change
  useEffect(() => {
    const sessionStart = Date.now()
    logEvent('SESSION_STARTED', {
      pathname,
      module: getModuleFromPath(pathname)
    })

    return () => {
      const durationMs = Date.now() - sessionStart
      const durationMinutes = parseFloat((durationMs / 60000).toFixed(2))
      logEvent('SESSION_ENDED', {
        pathname,
        durationMinutes,
        module: getModuleFromPath(pathname)
      })
    }
  }, [pathname])

  // Focus Mode shortcut listener (F11 or Cmd+Shift+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey
      const isShift = e.shiftKey
      
      if ((isCmdOrCtrl && isShift && e.key.toLowerCase() === 'f') || e.key === 'F11') {
        e.preventDefault()
        toggleFocusMode()
        logEvent('FOCUS_MODE_TOGGLED', {
          enabled: !isFocusMode,
          module: getModuleFromPath(pathname)
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleFocusMode, isFocusMode, pathname])

  useEffect(() => {
    if (layoutMode === 'workspace') {
      const onboarded = localStorage.getItem('enginguity_workspace_onboarded')
      if (!onboarded) {
        setTemplateSelectorOpen(true)
      }
    }
  }, [layoutMode])

  const activeProjId = layoutMode === 'workspace' && activeWindowId
    ? windows.find(w => w.id === activeWindowId)?.projectId
    : undefined

  // Global layouts keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey
      const isShift = e.shiftKey

      if (isCmdOrCtrl && isShift) {
        if (e.key.toLowerCase() === 'l') {
          e.preventDefault()
          setLayoutsModalOpen(!layoutsModalOpen)
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          const layouts = [...layoutEngine.getPresetLayouts(), ...layoutEngine.getAll()]
          if (layouts.length === 0) return

          const currentIdx = layouts.findIndex(l => l.id === activeLayoutId)
          let nextIdx = 0
          if (e.key === 'ArrowDown') {
            nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % layouts.length
          } else {
            nextIdx = currentIdx === -1 ? layouts.length - 1 : (currentIdx - 1 + layouts.length) % layouts.length
          }
          applyLayoutState(layouts[nextIdx])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [layoutsModalOpen, activeLayoutId, applyLayoutState, setLayoutsModalOpen])

  // Full-screen modules that should not have scrolling on the outer main wrapper
  const isViewportConstrained = [
    '/footprint-gen',
    '/pcb-reviewer',
    '/formula-lab',
    '/challenges',
    '/cad-viewer',
    '/circuit-sim',
    '/simulation',
    '/debug-console',
    '/firmware-diff',
    '/simulation-assistant',
    '/ideas',
    '/project-ideas',
    '/dashboard',
    '/history',
    '/supply-chain',
    '/test-harness',
    '/compliance',
    '/jarvis',
    '/timeline',
    '/live-docs',
    '/drawing-board',
  ].some(route => pathname.startsWith(route))



  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <TopBar />
      <div className="flex flex-1 overflow-hidden min-h-0">
      <Sidebar />

      {layoutMode === 'workspace' ? (
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <APIKeyBanner />
          <OfflineBanner />

          <main
            className="flex-1 overflow-hidden flex flex-col min-h-0"
            style={{ position: 'relative' }}
          >
            <WorkspaceCanvas />
          </main>
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <APIKeyBanner />
          <OfflineBanner />

          <main
            className={`flex-1 ${isViewportConstrained ? 'overflow-hidden flex flex-col min-h-0' : 'overflow-y-auto'}`}
            style={{ position: 'relative' }}
          >
            <Routes>
              <Route path="/" element={<HomeLanding />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/cad-viewer" element={<CadViewer />} />
              <Route path="/parameter-playground" element={<ParameterPlayground />} />
              <Route path="/asset-generator" element={<AssetGenerator />} />
              <Route path="/simulation-assistant" element={<SimulationAssistant />} />
              <Route path="/project-ideas" element={<ProjectIdeas />} />
              <Route path="/ideas" element={<ProjectIdeas />} />
              <Route path="/debug-console" element={<DebugConsole />} />
              <Route path="/collaborate" element={
                <CollabLanding onJoin={(roomId: string, name: string) => {
                  window.location.href = `/?room=${roomId}&collab_name=${encodeURIComponent(name)}`
                }} />
              } />
              <Route path="/model-comparison" element={<ModelComparison />} />
              <Route path="/circuit-sim" element={<CircuitSim />} />
              <Route path="/simulation" element={<SimulationTab />} />
              <Route path="/datasheet" element={<DatasheetIntelligence />} />
              <Route path="/notebook" element={<EngineeringNotebook />} />
              <Route path="/bom" element={<BOMIntelligence />} />
              <Route path="/formula-lab" element={<FormulaLab />} />
              <Route path="/templates" element={<TemplatesGallery />} />
              <Route path="/challenges" element={<ChallengeMode />} />
              <Route path="/firmware-diff" element={<FirmwareDiffViewer />} />
              <Route path="/pcb-reviewer" element={<PCBReviewer />} />
              <Route path="/footprint-gen" element={<FootprintGen />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/supply-chain" element={<SupplyChainMonitor />} />
              <Route path="/test-harness" element={<TestHarness />} />
              <Route path="/compliance" element={<ComplianceChecker />} />
              <Route path="/jarvis" element={<JarvisModule />} />
              <Route path="/timeline" element={<TimelineModule />} />
              <Route path="/live-docs" element={<ModuleErrorBoundary><LiveDocs /></ModuleErrorBoundary>} />
              <Route path="/drawing-board" element={<DrawingBoard />} />
              <Route path="/marketplace" element={<ToolMarketplace />} />
              <Route path="/custom/:id" element={<CustomToolFrame />} />
            </Routes>
          </main>
        </div>
      )}

      <ProjectProvider projectId={activeProjId}>
        <Copilot />
      </ProjectProvider>

      <CrossSearch />
      <SessionBriefing />

      <LayoutManagerModal
        isOpen={layoutsModalOpen}
        onClose={() => setLayoutsModalOpen(false)}
        onNewWorkspace={() => {
          setTemplateSelectorOpen(true)
        }}
      />

      <TemplateSelectorModal
        isOpen={templateSelectorOpen}
        onClose={() => setTemplateSelectorOpen(false)}
      />

      <VoiceButton />
      <PWAInstallPrompt />
      <TooltipManager />

      {isFocusMode && (
        <div
          onClick={exitFocusMode}
          style={{
            position: 'fixed',
            top: 8,
            right: 8,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(17,17,17,0.8)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            padding: '3px 8px',
            opacity: 0.4,
            transition: 'opacity 0.15s ease',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.4')}
        >
          <span style={{ fontFamily: 'Geist, sans-serif', fontSize: 10, fontWeight: 400, color: 'var(--text-dim)', letterSpacing: '0.02em' }}>
            Focus
          </span>
          <span style={{ fontFamily: 'Geist, sans-serif', fontSize: 10, fontWeight: 400, color: 'var(--text-dim)', border: '1px solid var(--text-dim)', borderRadius: 4, padding: '0 3px', transform: 'scale(0.9)', display: 'inline-block' }}>
            esc
          </span>
        </div>
      )}
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <RootErrorBoundary>
      <BrowserRouter>
        <ProjectProvider>
          <OpenRouterProvider>
            <WorkspaceProvider>
              <FocusModeProvider>
                <HomeChatProvider>
                  <ProbeChatProvider>
                    <AppContent />
                  </ProbeChatProvider>
                </HomeChatProvider>
              </FocusModeProvider>
            </WorkspaceProvider>
          </OpenRouterProvider>
        </ProjectProvider>
      </BrowserRouter>
    </RootErrorBoundary>
  )
}

