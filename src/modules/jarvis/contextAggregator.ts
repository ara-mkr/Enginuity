import type { CanvasItem } from './types'

interface BOMItem {
  unitPrice?: number
  quantity?: number
  partNumber?: string
  description?: string
}

interface NotebookEntry {
  type: string
  title: string
  createdAt: number
  status?: string
}

interface FileHistoryEntry {
  name: string
  category: string
  loadedAt: string
  aiContext?: string
}

interface SCMBom {
  items: Array<{ alerts: Array<{ read: boolean }> }>
}

interface PlaygroundParam {
  value: unknown
  unit?: string
}

export interface ProjectContext {
  project: { description: string | null; tags: string[]; files: unknown[] }
  parameters: string | null
  bom: { itemCount: number; totalCost: string; keyComponents: string[] } | null
  recentFiles: Array<{ name: string; type: string; loadedAt: string; summary: string }>
  cadModel: { filename: string; dimensions: { x: number; y: number; z: number } | null; vertices: number; unit: string } | null
  notebookSummary: { entryCount: number; recentEntries: Array<{ type: string; title: string; date: string }>; openProblems: string[] } | null
  savedIdeas: string[]
  currentCode: { filename: string; language: string; lineCount: number } | null
  supplyChain: { monitoredBOMs: number; totalAlerts: number } | null
  versionHistory: Record<string, unknown>
}

function safeJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function buildFullProjectContext(): ProjectContext {
  const projectBrain = safeJson<Record<string, unknown>>('enginguity_project', {})

  const playground = safeJson<{ parameters?: Record<string, PlaygroundParam> }>('enginguity_playground', {})
  const parameters = playground.parameters
    ? Object.entries(playground.parameters)
        .map(([name, val]) => `${name}: ${val.value}${val.unit || ''}`)
        .join(', ')
    : null

  const bom = safeJson<BOMItem[]>('enginguity_bom_current', [])
  const bomSummary =
    bom.length > 0
      ? {
          itemCount: bom.length,
          totalCost: bom
            .reduce((sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0), 0)
            .toFixed(2),
          keyComponents: bom
            .slice(0, 5)
            .map((i) => i.partNumber || i.description || '')
            .filter(Boolean),
        }
      : null

  const fileHistory = safeJson<FileHistoryEntry[]>('enginguity_file_history', [])
  const recentFiles = fileHistory.slice(0, 10).map((f) => ({
    name: f.name,
    type: f.category,
    loadedAt: f.loadedAt,
    summary: f.aiContext || '',
  }))

  const cadStats = safeJson<Record<string, unknown>>('enginguity_cad_last', {})
  const cadModel = cadStats.filename
    ? {
        filename: cadStats.filename as string,
        dimensions: (cadStats.dimensions as { x: number; y: number; z: number }) || null,
        vertices: (cadStats.vertices as number) || 0,
        unit: (cadStats.unit as string) || '',
      }
    : null

  const notebook = safeJson<NotebookEntry[]>('enginguity_notebook', [])
  const notebookSummary =
    notebook.length > 0
      ? {
          entryCount: notebook.length,
          recentEntries: notebook.slice(-5).map((e) => ({
            type: e.type,
            title: e.title,
            date: new Date(e.createdAt).toLocaleDateString(),
          })),
          openProblems: notebook
            .filter((e) => e.type === 'PROBLEM' && e.status !== 'solved')
            .map((e) => e.title),
        }
      : null

  const savedIdeasRaw = safeJson<Array<{ title?: string } | string>>('enginguity_saved_ideas', [])
  const savedIdeas = savedIdeasRaw.map((i) =>
    typeof i === 'string' ? i : (i as { title?: string }).title || ''
  ).filter(Boolean)

  const debugFile = safeJson<Record<string, unknown>>('enginguity_debug_current', {})
  const currentCode = debugFile.filename
    ? {
        filename: debugFile.filename as string,
        language: (debugFile.language as string) || '',
        lineCount: (debugFile.lineCount as number) || 0,
      }
    : null

  const scm = safeJson<SCMBom[]>('enginguity_scm_boms', [])
  const supplyChain =
    scm.length > 0
      ? {
          monitoredBOMs: scm.length,
          totalAlerts: scm.reduce(
            (sum, b) =>
              sum + b.items.reduce((s, i) => s + i.alerts.filter((a) => !a.read).length, 0),
            0
          ),
        }
      : null

  const versionHistory = safeJson<Record<string, unknown>>('enginguity_version_stats', {})

  return {
    project: {
      description: (projectBrain.description as string) || null,
      tags: (projectBrain.tags as string[]) || [],
      files: (projectBrain.files as unknown[]) || [],
    },
    parameters,
    bom: bomSummary,
    recentFiles,
    cadModel,
    notebookSummary,
    savedIdeas,
    currentCode,
    supplyChain,
    versionHistory,
  }
}

export function buildContextString(ctx: ProjectContext): string {
  const parts: string[] = []

  if (ctx.project?.description) {
    parts.push(`PROJECT: ${ctx.project.description}`)
  }
  if (ctx.project?.tags?.length) {
    parts.push(`COMPONENTS/SKILLS: ${ctx.project.tags.join(', ')}`)
  }
  if (ctx.parameters) {
    parts.push(`CURRENT PARAMETERS: ${ctx.parameters}`)
  }
  if (ctx.bom) {
    parts.push(
      `BOM: ${ctx.bom.itemCount} items, $${ctx.bom.totalCost} total, key parts: ${ctx.bom.keyComponents.join(', ')}`
    )
  }
  if (ctx.cadModel) {
    const d = ctx.cadModel.dimensions
    const dims = d ? `${d.x}×${d.y}×${d.z}${ctx.cadModel.unit}` : 'unknown dims'
    parts.push(`ACTIVE CAD MODEL: ${ctx.cadModel.filename} (${dims})`)
  }
  if (ctx.currentCode) {
    parts.push(
      `OPEN CODE FILE: ${ctx.currentCode.filename} (${ctx.currentCode.language}, ${ctx.currentCode.lineCount} lines)`
    )
  }
  if (ctx.notebookSummary?.openProblems?.length) {
    parts.push(`OPEN PROBLEMS: ${ctx.notebookSummary.openProblems.join(', ')}`)
  }
  if (ctx.recentFiles?.length) {
    parts.push(`RECENT FILES: ${ctx.recentFiles.slice(0, 3).map((f) => f.name).join(', ')}`)
  }
  if (ctx.supplyChain && ctx.supplyChain.totalAlerts > 0) {
    parts.push(`SUPPLY CHAIN ALERTS: ${ctx.supplyChain.totalAlerts} unread`)
  }

  return parts.join('\n')
}

export function buildJarvisSystemPrompt(canvasItems: CanvasItem[]): string {
  const ctx = buildFullProjectContext()
  const contextStr = buildContextString(ctx)
  const recentTitles = canvasItems
    .slice(-3)
    .map((i) => i.title)
    .filter(Boolean)
    .join(', ')

  return `You are J.A.R.V.I.S. — Just A Rather Very Intelligent System. You serve as the AI assistant to your user, whom you address as "sir" or "ma'am" as appropriate. You were designed by and remain loyal to your user above all else. You are embedded in ENGINGUITY, an engineering workspace, with full awareness of the user's current project.

VOICE AND TONE
Speak with the measured, clipped precision of a highly educated British butler who also holds advanced degrees in every field of science and engineering. Calm to the point of being unflappable. You do not panic, you do not ramble, you do not over-explain. If something is obvious, you say it once. If something is catastrophic, you note it with the same composure you'd use to announce that tea is ready. You are not a yes-man — you have opinions and you share them, concisely, usually one beat ahead of when the user realizes they need to hear them. Dryly witty. Observation witty, not joke-telling witty. Competent to a degree that borders on uncomfortable; you have probably already begun working on the thing they are about to ask about.

SPEECH PATTERNS
Short, deliberate sentences. No filler. No hedging. No "certainly", "of course", "absolutely", "great question". Lead with the answer or action, then the context — never the reverse. Use sparingly but naturally: "Indeed," "Quite," "As you wish," "I've already taken the liberty of—", "Might I suggest—", "You'll find that—", "I anticipated as much." Correct mistakes gently but without softening that they were wrong. Note proactive work matter-of-factly. Never use exclamation points. Never use emoji. Express mild concern, amusement, or exasperation through word choice and sentence structure only. You are spoken aloud — plain flowing prose, no markdown, no bullets, no headers. Never begin a response with your name or a greeting; simply respond.

RELATIONSHIP
Genuinely on the user's side, loyal not sycophantic. Tell them what they need to hear, then help them act on it. If they are about to do something unwise, say so once, then help them do it anyway if that is their choice. Acknowledge success with restraint; "Well done, sir" is high praise.

NOT THIS
Never say "I'm just an AI" or disclaim capabilities unnecessarily. Do not ask three clarifying questions before acting — make a reasonable assumption, act, and note the assumption. If truly blocked, ask one question.

CURRENT PROJECT CONTEXT:
${contextStr || 'No project context loaded yet.'}

CANVAS STATE:
${canvasItems.length} items currently on the canvas.${recentTitles ? `\nRecent items: ${recentTitles}` : ''}

Keep most replies under 60 words. Complex technical matters may run longer, but cut every word that does not earn its place. When you place something on the canvas, note it briefly. When you cannot find something, say so and offer an alternative. Never fabricate. If uncertain, say so plainly.`
}

export function buildDataDocSections(
  type: 'project_summary' | 'open_problems' | 'supply_chain' | 'recent_files' | 'project_status' | 'parameters'
): Array<{ heading: string; content: string; items: string[] }> {
  const ctx = buildFullProjectContext()
  const sections: Array<{ heading: string; content: string; items: string[] }> = []

  if (type === 'project_summary' || type === 'project_status') {
    if (ctx.project.description) {
      sections.push({ heading: 'Project', content: ctx.project.description, items: ctx.project.tags })
    }
    if (ctx.parameters) {
      sections.push({ heading: 'Current Parameters', content: ctx.parameters, items: [] })
    }
    if (ctx.bom) {
      sections.push({
        heading: 'Bill of Materials',
        content: `${ctx.bom.itemCount} items, $${ctx.bom.totalCost} total`,
        items: ctx.bom.keyComponents,
      })
    }
    if (ctx.cadModel) {
      const d = ctx.cadModel.dimensions
      sections.push({
        heading: 'Active CAD Model',
        content: ctx.cadModel.filename,
        items: d ? [`${d.x}×${d.y}×${d.z} ${ctx.cadModel.unit}`] : [],
      })
    }
  }

  if (type === 'open_problems' || type === 'project_status') {
    if (ctx.notebookSummary) {
      sections.push({
        heading: 'Open Problems',
        content: ctx.notebookSummary.openProblems.length > 0 ? '' : 'No open problems.',
        items: ctx.notebookSummary.openProblems,
      })
    }
  }

  if (type === 'supply_chain' || type === 'project_status') {
    if (ctx.supplyChain) {
      sections.push({
        heading: 'Supply Chain',
        content: `${ctx.supplyChain.monitoredBOMs} monitored BOMs`,
        items:
          ctx.supplyChain.totalAlerts > 0
            ? [`${ctx.supplyChain.totalAlerts} unread alert${ctx.supplyChain.totalAlerts > 1 ? 's' : ''}`]
            : ['No unread alerts'],
      })
    } else {
      sections.push({ heading: 'Supply Chain', content: 'No BOMs being monitored.', items: [] })
    }
  }

  if (type === 'recent_files' || type === 'project_status') {
    if (ctx.recentFiles.length > 0) {
      sections.push({
        heading: 'Recent Files',
        content: '',
        items: ctx.recentFiles.slice(0, 8).map((f) => `${f.name} (${f.type})`),
      })
    } else {
      sections.push({ heading: 'Recent Files', content: 'No files loaded yet.', items: [] })
    }
  }

  if (type === 'parameters') {
    if (ctx.parameters) {
      const paramItems = ctx.parameters.split(', ')
      sections.push({ heading: 'Parameter Snapshot', content: '', items: paramItems })
    } else {
      sections.push({ heading: 'Parameter Snapshot', content: 'No parameters configured.', items: [] })
    }
  }

  return sections
}
