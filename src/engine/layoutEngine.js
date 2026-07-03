import { logEvent } from './eventLog'

export const PRESET_LAYOUTS = [
  {
    id: 'preset_hardware_bringup',
    name: 'Hardware Bring-Up',
    description: 'Debug console large, serial monitor, notebook',
    preset: true,
    tags: ['hardware', 'debug'],
    windows: [
      { moduleId: 'debug-console', x: 0, y: 0, width: '60%', height: '70%', zIndex: 1, minimized: false, maximized: false },
      { moduleId: 'notebook', x: 0, y: '70%', width: '60%', height: '30%', zIndex: 2, minimized: false, maximized: false },
      { moduleId: 'datasheet', x: '60%', y: 0, width: '40%', height: '100%', zIndex: 3, minimized: false, maximized: false }
    ]
  },
  {
    id: 'preset_design_review',
    name: 'Design Review',
    description: 'CAD viewer large, BOM right, notebook bottom',
    preset: true,
    tags: ['cad', 'hardware'],
    windows: [
      { moduleId: 'cad-viewer', x: 0, y: 0, width: '65%', height: '65%', zIndex: 1, minimized: false, maximized: false },
      { moduleId: 'bom', x: '65%', y: 0, width: '35%', height: '65%', zIndex: 2, minimized: false, maximized: false },
      { moduleId: 'notebook', x: 0, y: '65%', width: '100%', height: '35%', zIndex: 3, minimized: false, maximized: false }
    ]
  },
  {
    id: 'preset_simulation',
    name: 'Simulation Session',
    description: 'Parameters left, circuit sim right, formula bottom',
    preset: true,
    tags: ['simulation', 'analysis'],
    windows: [
      { moduleId: 'parameter-playground', x: 0, y: 0, width: '50%', height: '65%', zIndex: 1, minimized: false, maximized: false },
      { moduleId: 'circuit-sim', x: '50%', y: 0, width: '50%', height: '65%', zIndex: 2, minimized: false, maximized: false },
      { moduleId: 'formula-lab', x: 0, y: '65%', width: '100%', height: '35%', zIndex: 3, minimized: false, maximized: false }
    ]
  },
  {
    id: 'preset_bom_review',
    name: 'BOM Review',
    description: 'BOM full width, supply chain below',
    preset: true,
    tags: ['supply-chain', 'bom'],
    windows: [
      { moduleId: 'bom', x: 0, y: 0, width: '100%', height: '60%', zIndex: 1, minimized: false, maximized: false },
      { moduleId: 'supply-chain', x: 0, y: '60%', width: '100%', height: '40%', zIndex: 2, minimized: false, maximized: false }
    ]
  },
  {
    id: 'preset_jarvis_bench',
    name: 'Jarvis Bench',
    description: 'Jarvis full screen with notebook sidebar',
    preset: true,
    tags: ['jarvis', 'assistant'],
    windows: [
      { moduleId: 'jarvis', x: 0, y: 0, width: '75%', height: '100%', zIndex: 1, minimized: false, maximized: false },
      { moduleId: 'notebook', x: '75%', y: 0, width: '25%', height: '100%', zIndex: 2, minimized: false, maximized: false }
    ]
  },
  {
    id: 'preset_component_research',
    name: 'Component Research',
    description: 'Datasheet large, BOM right, component search',
    preset: true,
    tags: ['hardware', 'research'],
    windows: [
      { moduleId: 'datasheet', x: 0, y: 0, width: '60%', height: '100%', zIndex: 1, minimized: false, maximized: false },
      { moduleId: 'bom', x: '60%', y: 0, width: '40%', height: '50%', zIndex: 2, minimized: false, maximized: false },
      { moduleId: 'supply-chain', x: '60%', y: '50%', width: '40%', height: '50%', zIndex: 3, minimized: false, maximized: false }
    ]
  },
  {
    id: 'preset_firmware_dev',
    name: 'Firmware Development',
    description: 'Editor large, parameters right, notebook below',
    preset: true,
    tags: ['firmware', 'coding'],
    windows: [
      { moduleId: 'debug-console', x: 0, y: 0, width: '60%', height: '70%', zIndex: 1, minimized: false, maximized: false },
      { moduleId: 'notebook', x: 0, y: '70%', width: '60%', height: '30%', zIndex: 2, minimized: false, maximized: false },
      { moduleId: 'parameter-playground', x: '60%', y: 0, width: '40%', height: '100%', zIndex: 3, minimized: false, maximized: false }
    ]
  }
]

// Custom lightweight unique ID generator
const generateId = () => {
  return 'layout_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36)
}

function captureLayoutThumbnail(windowsList) {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 180
    const ctx = canvas.getContext('2d')
    
    // Draw dark background
    ctx.fillStyle = '#0f0f18'
    ctx.fillRect(0, 0, 320, 180)
    
    // Get workspace rect from DOM if available
    const workspaceEl = document.getElementById('workspace-canvas')
    const workspaceRect = workspaceEl 
      ? workspaceEl.getBoundingClientRect() 
      : { width: window.innerWidth - 260, height: window.innerHeight - 40 }
    
    const scaleX = 320 / workspaceRect.width
    const scaleY = 180 / workspaceRect.height
    
    windowsList.forEach(win => {
      const type = win.moduleId || win.type
      
      const parsePercent = (val, maxVal) => {
        return Math.floor((parseFloat(val) / 100) * maxVal)
      }
      
      const parseDim = (val, maxVal) => {
        if (typeof val === 'string' && val.endsWith('%')) {
          return parsePercent(val, maxVal)
        }
        return parseFloat(val)
      }

      let x = parseDim(win.x, workspaceRect.width)
      let y = parseDim(win.y, workspaceRect.height)
      const w = parseDim(win.width, workspaceRect.width)
      const h = parseDim(win.height, workspaceRect.height)
      
      // Adjust x position if it includes sidebar offset
      if (x >= 260 && !win.preset) {
        x -= 260
      }
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)'
      ctx.lineWidth = 1
      
      ctx.beginPath()
      if (ctx.roundRect) {
        ctx.roundRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY, 3)
      } else {
        ctx.rect(x * scaleX, y * scaleY, w * scaleX, h * scaleY)
      }
      ctx.fill()
      ctx.stroke()
      
      // Module name label
      ctx.fillStyle = 'rgba(148, 163, 184, 0.75)'
      ctx.font = '8px Geist, sans-serif'
      ctx.fillText(
        type.length > 10 ? type.substring(0, 8) + '..' : type,
        x * scaleX + 4,
        y * scaleY + 12
      )
    })
    
    return canvas.toDataURL('image/png')
  } catch(e) {
    return null
  }
}

export const layoutEngine = {
  save: (name, description, currentWindowState) => {
    const layouts = layoutEngine.getAll()
    if (layouts.length >= 20) {
      throw new Error('limit_reached')
    }

    const layout = {
      id: generateId(),
      name,
      description: description || null,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      thumbnail: captureLayoutThumbnail(currentWindowState.windows),
      windows: currentWindowState.windows.map(w => ({
        moduleId: w.type || w.moduleId,
        x: w.x,
        y: w.y,
        width: w.width,
        height: w.height,
        zIndex: w.zIndex,
        minimized: w.isMinimized || w.minimized || false,
        maximized: w.isMaximized || w.maximized || false,
        projectId: w.projectId
      })),
      sidebarCollapsed: currentWindowState.sidebarCollapsed || false,
      copilotOpen: currentWindowState.copilotOpen || false,
      activeModule: currentWindowState.activeModule || ''
    }
    
    layouts.push(layout)
    localStorage.setItem('enginguity_saved_layouts', JSON.stringify(layouts))

    logEvent('LAYOUT_SAVED', {
      name,
      description,
      windowsCount: layout.windows.length,
      module: 'workspace'
    })
    
    return layout
  },

  restore: (layoutId, setWindowState) => {
    // Check saved layouts first, then presets
    let layout = layoutEngine.getAll().find(l => l.id === layoutId)
    if (!layout) {
      const preset = PRESET_LAYOUTS.find(p => p.id === layoutId)
      if (preset) {
        // Generate a temporary thumbnail if needed or just use the preset structure
        layout = {
          ...preset,
          copilotOpen: true,
          sidebarCollapsed: false,
          activeModule: 'workspace'
        }
      }
    }

    if (!layout) return
    
    // Animate windows into position
    setWindowState({
      windows: layout.windows,
      sidebarCollapsed: layout.sidebarCollapsed,
      copilotOpen: layout.copilotOpen,
      activeModule: layout.activeModule,
      restoring: true  // triggers animation
    })

    logEvent('LAYOUT_RESTORED', {
      layoutId,
      name: layout.name,
      windowsCount: layout.windows.length,
      module: 'workspace'
    })
    
    // Update last used
    layoutEngine.updateLastUsed(layoutId)
  },

  delete: (layoutId) => {
    const layouts = layoutEngine.getAll().filter(l => l.id !== layoutId)
    localStorage.setItem('enginguity_saved_layouts', JSON.stringify(layouts))
  },

  getAll: () => {
    try {
      return JSON.parse(localStorage.getItem('enginguity_saved_layouts') || '[]')
    } catch (e) {
      return []
    }
  },

  updateLastUsed: (layoutId) => {
    const layouts = layoutEngine.getAll()
    const layout = layouts.find(l => l.id === layoutId)
    if (layout) {
      layout.lastUsed = Date.now()
      localStorage.setItem('enginguity_saved_layouts', JSON.stringify(layouts))
    }
  },

  getPresetLayouts: () => {
    // Generate mock thumbnails for presets on the fly so they display visual previews!
    return PRESET_LAYOUTS.map(p => ({
      ...p,
      thumbnail: captureLayoutThumbnail(p.windows.map(w => ({ ...w, preset: true })))
    }))
  }
}
