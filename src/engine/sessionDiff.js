// Session Diff Engine — snapshots project state and diffs between sessions

import { useEnginguityStore } from './persistenceEngine'

const SNAPSHOT_KEY = 'enginguity_session_snapshot'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function safeJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

function countByTag(entries, tag) {
  return entries.filter(e => (e.tags || []).includes(tag)).length
}

// ─── Snapshot ──────────────────────────────────────────────────────────────────

export function buildStateSnapshot() {
  const notebook  = safeJson('enginguity_notebook', [])
  const bom       = safeJson('enginguity_bom_current', [])
  const files     = safeJson('enginguity_file_history', [])
  const ideas     = safeJson('enginguity_saved_ideas', [])
  const canvas    = useEnginguityStore.getState().jarvisCanvas?.items ?? []
  const scmBoms   = safeJson('enginguity_scm_boms', [])
  const project   = safeJson('enginguity_project', {})

  // Flatten supply chain alerts
  const scmAlerts = []
  scmBoms.forEach(b => (b.items || []).forEach(i => (i.alerts || []).forEach(a => scmAlerts.push({ part: i.partNumber, type: a.type, id: a.id || `${i.partNumber}_${a.type}` }))))

  return {
    ts:           Date.now(),
    projectName:  project.name || '',
    notebook: {
      count:    notebook.length,
      problems: countByTag(notebook, 'problem'),
      solved:   countByTag(notebook, 'solved'),
      ids:      notebook.map(e => e.id),
      titles:   Object.fromEntries(notebook.map(e => [e.id, e.title])),
    },
    bom: {
      count: bom.length,
      parts: Object.fromEntries(bom.map(i => [i.id || i.partNumber, { qty: i.quantity, desc: i.description }])),
    },
    files: {
      count: files.length,
      names: files.map(f => f.name),
    },
    ideas: {
      count: ideas.length,
      ids:   ideas.map(i => i.id),
    },
    canvas: {
      count:    canvas.length,
      types:    canvas.reduce((acc, i) => { acc[i.type] = (acc[i.type] || 0) + 1; return acc }, {}),
      lastItem: canvas[canvas.length - 1]?.fromCommand || null,
    },
    scm: {
      alertCount: scmAlerts.length,
      alertIds:   scmAlerts.map(a => a.id),
    },
  }
}

export function saveSnapshot() {
  const snap = buildStateSnapshot()
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap))
  return snap
}

export function loadSnapshot() {
  return safeJson(SNAPSHOT_KEY, null)
}

// ─── Diff ──────────────────────────────────────────────────────────────────────

export function diffSnapshots(prev, curr) {
  if (!prev || !curr) return null

  const changes = []

  // Notebook entries
  const newNoteIds = curr.notebook.ids.filter(id => !prev.notebook.ids.includes(id))
  const removedNoteIds = prev.notebook.ids.filter(id => !curr.notebook.ids.includes(id))
  if (newNoteIds.length > 0) {
    changes.push({
      type: 'added',
      module: 'notebook',
      label: `${newNoteIds.length} new notebook entr${newNoteIds.length > 1 ? 'ies' : 'y'}`,
      detail: newNoteIds.map(id => curr.notebook.titles[id] || id).slice(0, 3).join(', '),
    })
  }
  if (removedNoteIds.length > 0) {
    changes.push({
      type: 'removed',
      module: 'notebook',
      label: `${removedNoteIds.length} notebook entr${removedNoteIds.length > 1 ? 'ies' : 'y'} removed`,
      detail: removedNoteIds.map(id => prev.notebook.titles[id] || id).slice(0, 3).join(', '),
    })
  }
  const problemDelta = curr.notebook.problems - prev.notebook.problems
  if (problemDelta !== 0) {
    changes.push({
      type: problemDelta > 0 ? 'warning' : 'resolved',
      module: 'notebook',
      label: problemDelta > 0 ? `${problemDelta} new open problem${problemDelta > 1 ? 's' : ''}` : `${Math.abs(problemDelta)} problem${Math.abs(problemDelta) > 1 ? 's' : ''} resolved`,
      detail: '',
    })
  }

  // BOM
  const bomDelta = curr.bom.count - prev.bom.count
  if (bomDelta !== 0) {
    changes.push({
      type: bomDelta > 0 ? 'added' : 'removed',
      module: 'bom',
      label: `${Math.abs(bomDelta)} BOM part${Math.abs(bomDelta) > 1 ? 's' : ''} ${bomDelta > 0 ? 'added' : 'removed'}`,
      detail: '',
    })
  }

  // Files
  const newFiles = curr.files.names.filter(n => !prev.files.names.includes(n))
  if (newFiles.length > 0) {
    changes.push({
      type: 'added',
      module: 'files',
      label: `${newFiles.length} new file${newFiles.length > 1 ? 's' : ''} loaded`,
      detail: newFiles.slice(0, 3).join(', '),
    })
  }

  // Ideas
  const newIdeas = curr.ideas.ids.filter(id => !prev.ideas.ids.includes(id))
  if (newIdeas.length > 0) {
    changes.push({
      type: 'added',
      module: 'ideas',
      label: `${newIdeas.length} new idea${newIdeas.length > 1 ? 's' : ''} saved`,
      detail: '',
    })
  }

  // Canvas
  const canvasDelta = curr.canvas.count - prev.canvas.count
  if (canvasDelta !== 0) {
    changes.push({
      type: canvasDelta > 0 ? 'added' : 'removed',
      module: 'jarvis',
      label: `${Math.abs(canvasDelta)} canvas item${Math.abs(canvasDelta) > 1 ? 's' : ''} ${canvasDelta > 0 ? 'added' : 'removed'}`,
      detail: curr.canvas.lastItem ? `Last: "${curr.canvas.lastItem}"` : '',
    })
  }

  // SCM alerts
  const newAlerts = curr.scm.alertIds.filter(id => !prev.scm.alertIds.includes(id))
  if (newAlerts.length > 0) {
    changes.push({
      type: 'warning',
      module: 'supply-chain',
      label: `${newAlerts.length} new supply chain alert${newAlerts.length > 1 ? 's' : ''}`,
      detail: '',
    })
  }

  return {
    prevTs:   prev.ts,
    currTs:   curr.ts,
    changes,
    summary:  changes.length === 0 ? 'No changes since last session.' : `${changes.length} change${changes.length > 1 ? 's' : ''} since last session`,
  }
}

// ─── Auto-save on unload ────────────────────────────────────────────────────────

export function initSessionDiff() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeunload', () => {
    try { saveSnapshot() } catch { /* snapshot is best-effort telemetry for session diffing */ }
  })
}
