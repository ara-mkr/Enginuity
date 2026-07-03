import type { ProjectData } from '../context/ProjectContext'

export interface ProjectInfo {
  id: string
  name: string
  createdAt: number
  lastActiveAt: number
}

const LIST_KEY = 'enginguity_projects_list'
const CURRENT_ID_KEY = 'enginguity_current_project_id'

const SYNC_KEYS = [
  'enginguity_project',
  'enginguity_notebook',
  'enginguity_boms',
  'enginguity_comparisons',
  'enginguity_pinned_responses',
  'enginguity_saved_ideas',
  'enginguity_ideas_history',
  'enginguity_sim_netlist',
  'enginguity_starter_code',
  'enginguity_params_prefill',
  'enginguity_circuit_prefill',
]

// Initialize projects list with a default project if empty
export function initProjects() {
  const rawList = localStorage.getItem(LIST_KEY)
  const currentId = localStorage.getItem(CURRENT_ID_KEY)
  
  if (!rawList) {
    const defaultId = 'project_default_' + Date.now()
    const defaultProj: ProjectInfo = {
      id: defaultId,
      name: 'Default Project',
      createdAt: Date.now(),
      lastActiveAt: Date.now()
    }
    localStorage.setItem(LIST_KEY, JSON.stringify([defaultProj]))
    localStorage.setItem(CURRENT_ID_KEY, defaultId)
    
    // Save current active state to the default project storage keys
    saveActiveStateToProject(defaultId)
    return { list: [defaultProj], activeId: defaultId }
  }
  
  return {
    list: JSON.parse(rawList) as ProjectInfo[],
    activeId: currentId || ''
  }
}

export function listProjects(): ProjectInfo[] {
  const { list } = initProjects()
  return list
}

export function getCurrentProjectId(): string {
  const { activeId } = initProjects()
  return activeId
}

export function getCurrentProjectName(): string {
  const list = listProjects()
  const activeId = getCurrentProjectId()
  const activeProj = list.find(p => p.id === activeId)
  return activeProj ? activeProj.name : 'Default Project'
}

// Save standard active keys to prefixed key namespace
export function saveActiveStateToProject(projId: string) {
  SYNC_KEYS.forEach(key => {
    const val = localStorage.getItem(key)
    if (val !== null) {
      localStorage.setItem(`${key}_${projId}`, val)
    } else {
      localStorage.removeItem(`${key}_${projId}`)
    }
  })
}

// Load prefixed namespace keys into standard active keys
export function loadStateFromProject(projId: string) {
  SYNC_KEYS.forEach(key => {
    const val = localStorage.getItem(`${key}_${projId}`)
    if (val !== null) {
      localStorage.setItem(key, val)
    } else {
      localStorage.removeItem(key)
    }
  })
}

export function createProject(name: string): string {
  const list = listProjects()
  const newId = 'project_' + Date.now()
  const newProj: ProjectInfo = {
    id: newId,
    name: name.trim() || 'Untitled Project',
    createdAt: Date.now(),
    lastActiveAt: Date.now()
  }
  
  const newList = [...list, newProj]
  localStorage.setItem(LIST_KEY, JSON.stringify(newList))
  
  // Initialize storage keys for this new project with empty defaults
  SYNC_KEYS.forEach(key => {
    localStorage.removeItem(`${key}_newId`)
  })
  
  return newId
}

export function switchProject(targetId: string) {
  const currentId = getCurrentProjectId()
  if (currentId === targetId) return
  
  // 1. Save current active state to the current project
  saveActiveStateToProject(currentId)
  
  // 2. Load target state
  loadStateFromProject(targetId)
  
  // 3. Update active ID and last active timestamp
  localStorage.setItem(CURRENT_ID_KEY, targetId)
  const list = listProjects()
  const updatedList = list.map(p => {
    if (p.id === targetId) return { ...p, lastActiveAt: Date.now() }
    return p
  })
  localStorage.setItem(LIST_KEY, JSON.stringify(updatedList))
  
  // 4. Force reload page
  window.location.reload()
}

export function renameProject(id: string, newName: string) {
  const list = listProjects()
  const updatedList = list.map(p => {
    if (p.id === id) return { ...p, name: newName.trim() || p.name }
    return p
  })
  localStorage.setItem(LIST_KEY, JSON.stringify(updatedList))
}

export function deleteProject(id: string) {
  const list = listProjects()
  if (list.length <= 1) return // Cannot delete only project
  
  const currentId = getCurrentProjectId()
  const filteredList = list.filter(p => p.id !== id)
  localStorage.setItem(LIST_KEY, JSON.stringify(filteredList))
  
  // Clean up all storage keys associated with the deleted project
  SYNC_KEYS.forEach(key => {
    localStorage.removeItem(`${key}_${id}`)
  })
  
  // If we deleted the active project, switch to the first remaining one
  if (currentId === id) {
    const nextProj = filteredList[0]
    loadStateFromProject(nextProj.id)
    localStorage.setItem(CURRENT_ID_KEY, nextProj.id)
    window.location.reload()
  }
}

export function exportProject(id: string): string {
  // Save current active state first to ensure exported template has latest changes
  const currentId = getCurrentProjectId()
  if (currentId === id) {
    saveActiveStateToProject(id)
  }
  
  const list = listProjects()
  const proj = list.find(p => p.id === id)
  const name = proj ? proj.name : 'Project'
  
  const payload: Record<string, any> = {
    enginguity_project_template_version: '1.0',
    projectName: name,
    states: {}
  }
  
  SYNC_KEYS.forEach(key => {
    const val = localStorage.getItem(`${key}_${id}`)
    if (val !== null) {
      payload.states[key] = val
    }
  })
  
  return JSON.stringify(payload, null, 2)
}

export function importProject(jsonStr: string): string {
  try {
    const payload = JSON.parse(jsonStr)
    if (payload.enginguity_project_template_version !== '1.0' || !payload.projectName || !payload.states) {
      throw new Error('Invalid project template file format.')
    }
    
    // Create new project
    const newId = createProject(payload.projectName + ' (Imported)')
    
    // Write imported states to the new project keys
    Object.keys(payload.states).forEach(key => {
      if (SYNC_KEYS.includes(key)) {
        localStorage.setItem(`${key}_${newId}`, payload.states[key])
      }
    })
    
    return newId
  } catch (err) {
    throw new Error('Failed to parse template: ' + (err as Error).message)
  }
}
