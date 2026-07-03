declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

interface ElectronAPI {
  isElectron: boolean
  platform: string
  getVersion: () => Promise<string>
  getPaths: () => Promise<{ enginguityDir: string; dataDir: string; userData: string; home: string }>
  saveData: (key: string, data: unknown) => Promise<{ ok: boolean; error?: string }>
  loadData: (key: string) => Promise<unknown>
  deleteData: (key: string) => Promise<{ ok: boolean; error?: string }>
  listDataFiles: () => Promise<Array<{ name: string; filename: string; size: number; modified: number }>>
  openDataFolder: () => void
  openPath: (p: string) => void
  openDialog: (opts: Record<string, unknown>) => Promise<{ canceled: boolean; filePaths: string[] }>
  saveDialog: (opts: Record<string, unknown>) => Promise<{ canceled: boolean; filePath?: string }>
  onMenuOpenSettings: (cb: () => void) => () => void
}

export const isElectron = (): boolean =>
  typeof window !== 'undefined' && window.electronAPI?.isElectron === true

export const eAPI = (): ElectronAPI | null =>
  isElectron() ? (window.electronAPI as ElectronAPI) : null

export async function getPaths() {
  return eAPI()?.getPaths() ?? null
}

export async function saveDataToDisk(key: string, data: unknown): Promise<void> {
  await eAPI()?.saveData(key, data)
}

export async function loadDataFromDisk(key: string): Promise<unknown> {
  return eAPI()?.loadData(key) ?? null
}

export async function listDataFiles() {
  return eAPI()?.listDataFiles() ?? []
}

export function openDataFolder() {
  eAPI()?.openDataFolder()
}

// Zustand-compatible async storage that writes to localStorage AND disk (when in Electron)
export const hybridStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (isElectron()) {
      try {
        const diskData = await loadDataFromDisk(name)
        if (diskData !== null) {
          const str = typeof diskData === 'string' ? diskData : JSON.stringify(diskData)
          try { localStorage.setItem(name, str) } catch { /* storage unavailable (private mode/quota) — safe to skip */ }
          return str
        }
      } catch { /* disk read failed — fall through to localStorage */ }
    }
    return localStorage.getItem(name)
  },
  setItem: async (name: string, value: string): Promise<void> => {
    localStorage.setItem(name, value)
    if (isElectron()) {
      try {
        await saveDataToDisk(name, JSON.parse(value))
      } catch { /* disk mirror is best-effort; localStorage write above succeeded */ }
    }
  },
  removeItem: async (name: string): Promise<void> => {
    localStorage.removeItem(name)
    // The disk copy must go too — getItem prefers disk, so leaving it
    // behind would resurrect cleared state on the next Electron launch.
    if (isElectron()) {
      try {
        await eAPI()?.deleteData(name)
      } catch {
        // Disk delete failed; localStorage is already cleared and getItem
        // will re-mirror the stale disk copy — nothing safe to do here.
      }
    }
  },
}
