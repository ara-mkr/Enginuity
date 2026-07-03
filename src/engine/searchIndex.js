import { v4 as uuid } from 'uuid'
import { useEnginguityStore } from './persistenceEngine'

// ─── Module metadata ───────────────────────────────────────────────────────────

const MODULE_META = {
  notebook:              { icon: '≡', label: 'Notebook',       route: '/notebook' },
  bom:                   { icon: '≣', label: 'BOM',            route: '/bom' },
  'file-history':        { icon: '▤', label: 'Files',          route: '/history' },
  'project-ideas':       { icon: '◈', label: 'Ideas',          route: '/ideas' },
  'parameter-playground':{ icon: '⊙', label: 'Parameters',    route: '/parameter-playground' },
  jarvis:                { icon: '◇', label: 'Jarvis Canvas',  route: '/jarvis' },
  'supply-chain':        { icon: '▷', label: 'Supply Chain',   route: '/supply-chain' },
  timeline:              { icon: '▦', label: 'Timeline',       route: '/history' },
  ai:                    { icon: '⊛', label: 'AI',             route: '/' },
}

export function getModuleIcon(module) {
  return MODULE_META[module]?.icon ?? '◆'
}

export function getModuleRoute(module) {
  return MODULE_META[module]?.route ?? '/'
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function safeJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatEventTitle(event) {
  const d = event.data || {}
  switch (event.type) {
    case 'NOTEBOOK_ENTRY_ADDED':   return `Notebook: ${d.title || 'New entry'}`
    case 'FILE_LOADED':            return `Loaded: ${d.name || 'file'}`
    case 'BOM_ALERT':              return `BOM alert: ${d.detail || ''}`
    case 'NOTEBOOK_PROBLEM_SOLVED':return `Solved: ${d.title || ''}`
    default:                       return event.type.replace(/_/g, ' ').toLowerCase()
  }
}

// ─── Index builder ─────────────────────────────────────────────────────────────

export function buildSearchIndex() {
  const index = []

  // NOTEBOOK ENTRIES
  const notebook = safeJson('enginguity_notebook', [])
  notebook.forEach(entry => {
    const preview = stripHtml(entry.content).slice(0, 100)
    index.push({
      id:             `notebook_${entry.id}`,
      type:           'notebook',
      title:          entry.title || 'Untitled',
      content:        `${stripHtml(entry.content)} ${(entry.tags || []).join(' ')}`,
      tags:           entry.tags || [],
      date:           entry.createdAt || null,
      module:         'notebook',
      moduleLabel:    'Notebook',
      route:          '/notebook',
      highlightEvent: { name: 'enginguity_notebook_highlight', detail: { id: entry.id } },
      preview:        preview || entry.title || '',
    })
  })

  // BOM ITEMS
  const bom = safeJson('enginguity_bom_current', [])
  bom.forEach(item => {
    const title = item.partNumber || item.description || 'BOM Item'
    const preview = [
      item.quantity ? `Qty: ${item.quantity}` : '',
      item.value || '',
      item.package || '',
    ].filter(Boolean).join(' · ')
    index.push({
      id:             `bom_${item.id || item.partNumber || uuid()}`,
      type:           'bom_item',
      title,
      content:        [item.description, item.manufacturer, item.value, item.package].filter(Boolean).join(' '),
      tags:           [],
      date:           null,
      module:         'bom',
      moduleLabel:    'BOM',
      route:          '/bom',
      highlightEvent: { name: 'enginguity_bom_highlight', detail: { id: item.id } },
      preview,
    })
  })

  // FILE HISTORY
  const files = safeJson('enginguity_file_history', [])
  files.forEach(file => {
    const ts = file.loadedAt ? new Date(file.loadedAt).getTime() : null
    index.push({
      id:             `file_${file.name}`,
      type:           'file',
      title:          file.name,
      content:        file.aiContext || file.name,
      tags:           [file.category].filter(Boolean),
      date:           ts,
      module:         'file-history',
      moduleLabel:    'Files',
      route:          '/history',
      highlightEvent: null,
      preview:        (file.aiContext || '').slice(0, 100) || file.name,
    })
  })

  // SAVED IDEAS
  const ideas = safeJson('enginguity_saved_ideas', [])
  ideas.forEach(idea => {
    index.push({
      id:             `idea_${idea.id}`,
      type:           'idea',
      title:          idea.title || 'Untitled Idea',
      content:        `${idea.description || ''} ${(idea.tags || []).join(' ')}`,
      tags:           idea.tags || [],
      date:           idea.createdAt || null,
      module:         'project-ideas',
      moduleLabel:    'Ideas',
      route:          '/ideas',
      highlightEvent: { name: 'enginguity_idea_highlight', detail: { id: idea.id } },
      preview:        (idea.description || '').slice(0, 100),
    })
  })

  // PARAMETER HISTORY SNAPSHOTS
  const paramHistory = safeJson('enginguity_param_history', [])
  paramHistory.forEach(snap => {
    index.push({
      id:             `param_${snap.id}`,
      type:           'parameter_snapshot',
      title:          snap.label || 'Parameter Setup',
      content:        snap.paramSummary || '',
      tags:           [],
      date:           snap.timestamp || null,
      module:         'parameter-playground',
      moduleLabel:    'Parameters',
      route:          '/parameter-playground',
      highlightEvent: { name: 'enginguity_param_restore', detail: { id: snap.id } },
      preview:        (snap.paramSummary || '').slice(0, 100),
    })
  })

  // JARVIS CANVAS ITEMS
  const jarvisCanvas = useEnginguityStore.getState().jarvisCanvas?.items ?? []
  jarvisCanvas.forEach(item => {
    if (!item.title && !item.fromCommand) return
    const title = item.title || item.fromCommand || 'Canvas item'
    index.push({
      id:             `jarvis_${item.id}`,
      type:           'canvas_item',
      title,
      content:        `${title} ${item.fromCommand || ''} ${JSON.stringify(item.content || '')}`,
      tags:           [],
      date:           item.createdAt || null,
      module:         'jarvis',
      moduleLabel:    'Jarvis Canvas',
      route:          '/jarvis',
      highlightEvent: null,
      preview:        item.fromCommand || title,
    })
  })

  // SUPPLY CHAIN ALERTS
  const scm = safeJson('enginguity_scm_boms', [])
  scm.forEach(scmBom => {
    ;(scmBom.items || []).forEach(scmItem => {
      ;(scmItem.alerts || []).forEach(alert => {
        const title = `${scmItem.partNumber || 'Part'}: ${alert.type || 'Alert'}`
        index.push({
          id:             `scm_${alert.id || uuid()}`,
          type:           'supply_alert',
          title,
          content:        alert.detail || '',
          tags:           [],
          date:           alert.detectedAt || null,
          module:         'supply-chain',
          moduleLabel:    'Supply Chain',
          route:          '/supply-chain',
          highlightEvent: null,
          preview:        alert.detail || '',
        })
      })
    })
  })

  // SIGNIFICANT EVENTS
  const significantTypes = new Set([
    'NOTEBOOK_ENTRY_ADDED',
    'FILE_LOADED',
    'BOM_ALERT',
    'NOTEBOOK_PROBLEM_SOLVED',
  ])
  const events = safeJson('enginguity_event_log', [])
  events
    .filter(e => significantTypes.has(e.type))
    .slice(-100)
    .forEach(event => {
      const title = formatEventTitle(event)
      index.push({
        id:             `event_${event.id}`,
        type:           'event',
        title,
        content:        `${title} ${JSON.stringify(event.data || '')}`,
        tags:           [],
        date:           event.timestamp || null,
        module:         'timeline',
        moduleLabel:    'Timeline',
        route:          '/history',
        highlightEvent: null,
        preview:        title,
      })
    })

  return index
}

// ─── Search algorithm ──────────────────────────────────────────────────────────

export function searchIndex(query, index) {
  if (!query || !query.trim()) return []

  const lower = query.toLowerCase().trim()
  const words = lower.split(/\s+/).filter(Boolean)

  const scored = index
    .map(item => {
      let score = 0
      const titleL   = (item.title   || '').toLowerCase()
      const contentL = (item.content || '').toLowerCase()
      const tagsL    = (item.tags    || []).map(t => t.toLowerCase())

      if (titleL === lower)                                score += 200
      if (titleL.startsWith(lower))                        score += 100
      if (titleL.includes(lower))                          score += 60
      if (words.every(w => titleL.includes(w)))            score += 40
      words.forEach(w => { if (titleL.includes(w))         score += 20 })
      if (contentL.includes(lower))                        score += 15
      if (tagsL.some(t => t.includes(lower)))              score += 25
      if ((item.moduleLabel || '').toLowerCase().includes(lower)) score += 10

      if (item.date) {
        const daysAgo = (Date.now() - item.date) / 86_400_000
        if (daysAgo < 1) score += 10
        else if (daysAgo < 7) score += 5
      }

      return { item, score }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map(({ item }) => item)

  return scored
}

// Returns most-recent item titles for empty-state suggestions
export function getSuggestions(index, n = 5) {
  return [...index]
    .filter(item => item.date)
    .sort((a, b) => b.date - a.date)
    .slice(0, n)
    .map(item => item.title)
}
