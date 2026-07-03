import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'

export interface ProjectFile {
  name: string
  content: string
  size: number
  addedAt: number
}

export interface ProjectData {
  description: string
  tags: string[]
  files: ProjectFile[]
}

interface ProjectContextValue extends ProjectData {
  setDescription: (desc: string) => void
  setTags: (tags: string[]) => void
  addFile: (file: ProjectFile) => void
  removeFile: (name: string) => void
  clearContext: () => void
}

const STORAGE_KEY = 'enginguity_project'

function loadProjectData(projId?: string): ProjectData {
  try {
    const key = projId ? `${STORAGE_KEY}_${projId}` : STORAGE_KEY
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as ProjectData
  } catch {
    /* ignore */
  }
  return { description: '', tags: [], files: [] }
}

function saveProjectData(projId: string | undefined, data: ProjectData) {
  const key = projId ? `${STORAGE_KEY}_${projId}` : STORAGE_KEY
  localStorage.setItem(key, JSON.stringify(data))
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function ProjectProvider({ children, projectId }: { children: ReactNode; projectId?: string }) {
  const [data, setData] = useState<ProjectData>(() => loadProjectData(projectId))

  useEffect(() => {
    setData(loadProjectData(projectId))
  }, [projectId])

  const update = useCallback((patch: Partial<ProjectData>) => {
    setData((prev) => {
      const next = { ...prev, ...patch }
      saveProjectData(projectId, next)
      return next
    })
  }, [projectId])

  const setDescription = useCallback(
    (description: string) => update({ description }),
    [update]
  )

  const setTags = useCallback(
    (tags: string[]) => update({ tags }),
    [update]
  )

  const addFile = useCallback(
    (file: ProjectFile) =>
      update({
        files: [...data.files.filter((f) => f.name !== file.name), file],
      }),
    [update, data.files]
  )

  const removeFile = useCallback(
    (name: string) =>
      update({ files: data.files.filter((f) => f.name !== name) }),
    [update, data.files]
  )

  const clearContext = useCallback(
    () => update({ description: '', tags: [], files: [] }),
    [update]
  )

  return (
    <ProjectContext.Provider
      value={{
        ...data,
        setDescription,
        setTags,
        addFile,
        removeFile,
        clearContext,
      }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within ProjectProvider')
  return ctx
}
