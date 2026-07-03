import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { getCurrentProjectId } from '../utils/projectManager'

export interface WorkspaceWindow {
  id: string
  type: string
  title: string
  x: number
  y: number
  width: number
  height: number
  isMaximized: boolean
  isMinimized: boolean
  zIndex: number
  projectId: string
}

interface WorkspaceContextValue {
  layoutMode: 'single' | 'workspace'
  windows: WorkspaceWindow[]
  activeWindowId: string | null
  restoring: boolean
  activeLayoutId: string | null
  layoutsModalOpen: boolean
  toggleLayoutMode: () => void
  setLayoutMode: (mode: 'single' | 'workspace') => void
  openWindow: (type: string, projectId?: string) => void
  closeWindow: (id: string) => void
  minimizeWindow: (id: string) => void
  maximizeWindow: (id: string) => void
  restoreWindow: (id: string) => void
  updateWindowPosition: (id: string, x: number, y: number) => void
  updateWindowSize: (id: string, w: number, h: number) => void
  setWindowProject: (id: string, projId: string) => void
  bringToFront: (id: string) => void
  tileWindows: (format: 'grid' | 'vertical' | 'horizontal') => void
  applyLayoutState: (layoutState: any) => void
  setActiveLayoutId: (id: string | null) => void
  setLayoutsModalOpen: (open: boolean) => void
}

const STORAGE_KEY_MODE = 'enginguity_workspace_mode'
const STORAGE_KEY_WINDOWS = 'enginguity_workspace_windows'

const MODULE_TITLES: Record<string, string> = {
  'dashboard': 'Project Brain',
  'cad-viewer': 'CAD Viewer',
  'parameter-playground': 'Parameter Playground',
  'asset-generator': 'Graphic Generator',
  'simulation-assistant': 'Simulation Assistant',
  'project-ideas': 'Project Ideas',
  'debug-console': 'Debug Console',
  'model-comparison': 'Model Comparison',
  'circuit-sim': 'Circuit Sim',
  'datasheet': 'Datasheet Intel',
  'notebook': 'Engineering Notebook',
  'bom': 'BOM Intelligence',
  'formula-lab': 'Formula Lab',
  'templates': 'Templates Gallery',
  'challenges': 'Challenges',
  'firmware-diff': 'Firmware Diff',
  'pcb-reviewer': 'PCB Reviewer',
  'footprint-gen': 'Footprint Gen',
  'history': 'Version History',
  'supply-chain': 'Supply Chain',
  'test-harness': 'Test Harness',
  'compliance': 'Compliance Checker',
  'jarvis': 'Jarvis Module',
  'drawing-board': 'Drawing Board',
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [layoutMode, setLayoutModeState] = useState<'single' | 'workspace'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MODE)
      if (saved === 'workspace') return 'workspace'
    } catch { /* ignore */ }
    return 'single'
  })

  const [windows, setWindows] = useState<WorkspaceWindow[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_WINDOWS)
      if (saved) return JSON.parse(saved) as WorkspaceWindow[]
    } catch { /* ignore */ }
    return []
  })

  const [activeWindowId, setActiveWindowId] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(null)
  const [layoutsModalOpen, setLayoutsModalOpen] = useState(false)

  // Persist state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MODE, layoutMode)
    } catch { /* ignore */ }
  }, [layoutMode])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WINDOWS, JSON.stringify(windows))
    } catch { /* ignore */ }
  }, [windows])

  const toggleLayoutMode = useCallback(() => {
    setLayoutModeState((prev) => (prev === 'single' ? 'workspace' : 'single'))
  }, [])

  const setLayoutMode = useCallback((mode: 'single' | 'workspace') => {
    setLayoutModeState(mode)
  }, [])

  const bringToFront = useCallback((id: string) => {
    setActiveWindowId(id)
    setWindows((prev) => {
      if (prev.length === 0) return prev
      const maxZ = Math.max(...prev.map((w) => w.zIndex), 0)
      const targetWindow = prev.find((w) => w.id === id)
      if (targetWindow && targetWindow.zIndex === maxZ && maxZ > 0) {
        return prev // Already at the front
      }
      return prev.map((w) => {
        if (w.id === id) {
          return { ...w, zIndex: maxZ + 1 }
        }
        return w
      })
    })
  }, [])

  const openWindow = useCallback((type: string, projectId?: string) => {
    // If layoutMode is not workspace, switch to it first
    setLayoutModeState('workspace')
    setActiveLayoutId(null)

    setWindows((prev) => {
      const activeProjId = projectId || getCurrentProjectId()
      const titleBase = MODULE_TITLES[type] || 'Module Window'
      
      // Count instances of this type to add numbers if multiple are open
      const instancesOfType = prev.filter((w) => w.type === type).length
      const title = instancesOfType > 0 ? `${titleBase} (${instancesOfType + 1})` : titleBase

      const id = `${type}_${Date.now()}`
      const maxZ = Math.max(...prev.map((w) => w.zIndex), 0)
      
      // Default sizing options based on type
      let defaultW = 800
      let defaultH = 550
      if (type === 'debug-console') {
        defaultW = 750
        defaultH = 480
      } else if (type === 'jarvis') {
        defaultW = 900
        defaultH = 650
      } else if (type === 'dashboard') {
        defaultW = 850
        defaultH = 600
      }

      // Cascade coordinates
      const cascadeIndex = prev.length
      const defaultX = 60 + (cascadeIndex * 35) % 350
      const defaultY = 60 + (cascadeIndex * 35) % 250

      const newWin: WorkspaceWindow = {
        id,
        type,
        title,
        x: defaultX,
        y: defaultY,
        width: defaultW,
        height: defaultH,
        isMaximized: false,
        isMinimized: false,
        zIndex: maxZ + 1,
        projectId: activeProjId,
      }

      setActiveWindowId(id)
      return [...prev, newWin]
    })
  }, [])

  const closeWindow = useCallback((id: string) => {
    setActiveLayoutId(null)
    setWindows((prev) => {
      const filtered = prev.filter((w) => w.id !== id)
      if (activeWindowId === id) {
        const remaining = filtered.filter((w) => !w.isMinimized)
        if (remaining.length > 0) {
          const highest = remaining.reduce((p, c) => (p.zIndex > c.zIndex ? p : c))
          setActiveWindowId(highest.id)
        } else {
          setActiveWindowId(null)
        }
      }
      return filtered
    })
  }, [activeWindowId])

  const minimizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMinimized: true } : w))
    )
  }, [])

  const maximizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMaximized: true, isMinimized: false } : w))
    )
    bringToFront(id)
  }, [bringToFront])

  const restoreWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMaximized: false, isMinimized: false } : w))
    )
    bringToFront(id)
  }, [bringToFront])

  const updateWindowPosition = useCallback((id: string, x: number, y: number) => {
    setActiveLayoutId(null)
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, x, y } : w))
    )
  }, [])

  const updateWindowSize = useCallback((id: string, w: number, h: number) => {
    setActiveLayoutId(null)
    setWindows((prev) =>
      prev.map((win) => (win.id === id ? { ...win, width: w, height: h } : win))
    )
  }, [])

  const setWindowProject = useCallback((id: string, projId: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, projectId: projId } : w))
    )
  }, [])

  const tileWindows = useCallback((format: 'grid' | 'vertical' | 'horizontal') => {
    setActiveLayoutId(null)
    setWindows((prev) => {
      const visible = prev.filter((w) => !w.isMinimized)
      if (visible.length === 0) return prev

      const workspaceW = window.innerWidth - 260 // approx workspace area minus sidebar
      const workspaceH = window.innerHeight - 20 // approx workspace area height
      const startX = 260
      const startY = 10

      return prev.map((w) => {
        const visIdx = visible.findIndex((v) => v.id === w.id)
        if (visIdx === -1) return w // Minimized stays as is

        let newX = w.x
        let newY = w.y
        let newWidth = w.width
        let newHeight = w.height

        if (format === 'vertical') {
          const colWidth = Math.floor(workspaceW / visible.length)
          newX = startX + visIdx * colWidth
          newY = startY
          newWidth = colWidth - 10
          newHeight = workspaceH - 40
        } else if (format === 'horizontal') {
          const rowHeight = Math.floor(workspaceH / visible.length)
          newX = startX
          newY = startY + visIdx * rowHeight
          newWidth = workspaceW - 20
          newHeight = rowHeight - 20
        } else if (format === 'grid') {
          const cols = Math.ceil(Math.sqrt(visible.length))
          const rows = Math.ceil(visible.length / cols)
          const colWidth = Math.floor(workspaceW / cols)
          const rowHeight = Math.floor(workspaceH / rows)

          const c = visIdx % cols
          const r = Math.floor(visIdx / cols)

          newX = startX + c * colWidth
          newY = startY + r * rowHeight
          newWidth = colWidth - 10
          newHeight = rowHeight - 20
        }

        return {
          ...w,
          x: Math.max(0, newX),
          y: Math.max(0, newY),
          width: Math.max(300, newWidth),
          height: Math.max(200, newHeight),
          isMaximized: false,
          isMinimized: false,
        }
      })
    })
  }, [])

  const applyLayoutState = useCallback((layoutState: any) => {
    setRestoring(true)
    setLayoutModeState('workspace')

    const workspaceW = window.innerWidth - 260
    const workspaceH = window.innerHeight - 40
    const startX = 260
    const startY = 10

    const parsePercent = (val: string, maxVal: number) => {
      return Math.floor((parseFloat(val) / 100) * maxVal)
    }

    const parseDim = (val: any, maxVal: number, offset = 0) => {
      if (typeof val === 'string' && val.endsWith('%')) {
        return parsePercent(val, maxVal) + offset
      }
      return parseFloat(val) + offset
    }

    const restored = layoutState.windows.map((w: any, index: number) => {
      const type = w.moduleId || w.type
      const titleBase = MODULE_TITLES[type] || 'Window'
      return {
        id: w.id || `${type}_${Date.now()}_${index}`,
        type,
        title: w.title || titleBase,
        x: parseDim(w.x, workspaceW, startX),
        y: parseDim(w.y, workspaceH, startY),
        width: parseDim(w.width, workspaceW),
        height: parseDim(w.height, workspaceH),
        isMaximized: w.maximized || w.isMaximized || false,
        isMinimized: w.minimized || w.isMinimized || false,
        zIndex: w.zIndex || (index + 1),
        projectId: w.projectId || getCurrentProjectId()
      }
    })

    setWindows(restored)
    setActiveLayoutId(layoutState.id || layoutState.layoutId || null)

    // Sync Copilot open state via custom window event
    if (typeof layoutState.copilotOpen === 'boolean') {
      window.dispatchEvent(
        new CustomEvent('enginguity_set_copilot_open', {
          detail: { open: layoutState.copilotOpen },
        })
      )
    }

    // Focus first restored window
    if (restored.length > 0) {
      setActiveWindowId(restored[0].id)
    } else {
      setActiveWindowId(null)
    }

    setTimeout(() => {
      setRestoring(false)
    }, 300)
  }, [])

  return (
    <WorkspaceContext.Provider
      value={{
        layoutMode,
        windows,
        activeWindowId,
        restoring,
        activeLayoutId,
        layoutsModalOpen,
        toggleLayoutMode,
        setLayoutMode,
        openWindow,
        closeWindow,
        minimizeWindow,
        maximizeWindow,
        restoreWindow,
        updateWindowPosition,
        updateWindowSize,
        setWindowProject,
        bringToFront,
        tileWindows,
        applyLayoutState,
        setActiveLayoutId,
        setLayoutsModalOpen,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
