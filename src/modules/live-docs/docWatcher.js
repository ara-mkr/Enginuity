import { moduleStateStore } from '../../store/moduleState'

const uuid = () => crypto.randomUUID()

const STORAGE_KEY = 'enginguity_doc_draft'
const SETTINGS_KEY = 'enginguity_doc_settings'

// ── Default settings ───────────────────────────────────────────────────────
export function getDocSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
  } catch { return {} }
}

export function saveDocSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

// ── Draft persistence ──────────────────────────────────────────────────────
function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  } catch { return null }
}

function saveDraft(draft) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch { /* storage full */ }
}

// ── DocumentDraft singleton ────────────────────────────────────────────────
let draft = loadDraft() || {
  title: null,
  lastUpdated: null,
  sections: {
    overview: null,
    methodology: null,
    parameters: null,
    components: null,
    simulation: null,
    testing: null,
    results: null,
    decisions: null,
    issues: null,
    references: null
  },
  rawObservations: [],
  generatedAt: null
}

let isDocumentOpen = false
let sectionUpdateQueue = new Set()
let updateCallbacks = new Set()
let updateDebounce = null

export function setDocumentOpen(open) {
  isDocumentOpen = open
}

export function onDraftUpdate(fn) {
  updateCallbacks.add(fn)
  return () => updateCallbacks.delete(fn)
}

function notifyUpdate() {
  updateCallbacks.forEach(fn => fn({ ...draft }))
}

function getSectionForObservationType(type) {
  const map = {
    PROJECT_CONTEXT_SET: 'overview',
    SESSION_STARTED: 'overview',
    PARAMETER_SETUP_CREATED: 'methodology',
    PARAMETER_CHANGED: 'parameters',
    FILE_LOADED: 'methodology',
    CAD_ANALYSIS_RUN: 'results',
    BOM_FINALIZED: 'components',
    BOM_UPDATED: 'components',
    SUPPLY_CHAIN_CHECKED: 'components',
    NOTEBOOK_ENTRY_ADDED: 'decisions',
    CODE_EXECUTED: 'testing',
    AI_ANALYSIS_RUN: 'results',
    SIMULATION_RUN: 'simulation',
    JARVIS_MEASUREMENT: 'testing',
    SESSION_ENDED: null,
    TEMPLATE_LOADED: 'methodology',
    SERIAL_CONNECTED: 'testing',
    JARVIS_COMMAND: 'references',
  }
  return map[type] || null
}

function observe(type, data) {
  const settings = getDocSettings()
  if (settings.autoWatch === false) return

  const observation = {
    id: uuid(),
    type,
    timestamp: Date.now(),
    data,
    incorporated: false
  }

  draft.rawObservations.push(observation)
  draft.lastUpdated = Date.now()
  saveDraft(draft)

  if (isDocumentOpen) {
    const section = getSectionForObservationType(type)
    if (section) sectionUpdateQueue.add(section)
  }

  clearTimeout(updateDebounce)
  updateDebounce = setTimeout(() => {
    notifyUpdate()
    sectionUpdateQueue.clear()
  }, 300)

  window.dispatchEvent(new CustomEvent('enginguity:doc_observed', {
    detail: { type, section: getSectionForObservationType(type) }
  }))
}

// ── Public API ─────────────────────────────────────────────────────────────

export function getDraft() {
  return { ...draft }
}

export function updateSection(key, content) {
  draft.sections[key] = content
  draft.lastUpdated = Date.now()
  saveDraft(draft)
  notifyUpdate()
}

export function updateDraftTitle(title) {
  draft.title = title
  draft.lastUpdated = Date.now()
  saveDraft(draft)
  notifyUpdate()
}

export function clearDraft() {
  draft = {
    title: null,
    lastUpdated: null,
    sections: {
      overview: null, methodology: null, parameters: null,
      components: null, simulation: null, testing: null,
      results: null, decisions: null, issues: null, references: null
    },
    rawObservations: [],
    generatedAt: null
  }
  saveDraft(draft)
  notifyUpdate()
}

export function getObservationCount() {
  return draft.rawObservations.length
}

export function getUnincorporatedCount() {
  return draft.rawObservations.filter(o => !o.incorporated).length
}

// ── Event log watcher ──────────────────────────────────────────────────────

const WATCHED_EVENTS = new Set([
  'PROJECT_CONTEXT_SET', 'SESSION_STARTED', 'PARAMETER_SETUP_CREATED',
  'PARAMETER_CHANGED', 'FILE_LOADED', 'CAD_ANALYSIS_RUN', 'BOM_FINALIZED',
  'BOM_UPDATED', 'SUPPLY_CHAIN_CHECKED', 'NOTEBOOK_ENTRY_ADDED',
  'CODE_EXECUTED', 'AI_ANALYSIS_RUN', 'SIMULATION_RUN', 'JARVIS_MEASUREMENT',
  'SESSION_ENDED', 'TEMPLATE_LOADED', 'SERIAL_CONNECTED', 'JARVIS_COMMAND',
])

let watcherStarted = false
let lastEventCount = 0

function handleGlobalEvent(e) {
  const event = e.detail
  if (event && WATCHED_EVENTS.has(event.type)) {
    observe(event.type, event.data || {})
  }
}

// Also watch moduleStateStore for CAD, BOM, etc.
function handleModuleState(state) {
  if (state.activeModule === 'cad' && state.moduleData?.cad) {
    const cad = state.moduleData.cad
    // Dedupe by filename + timestamp bucket (5s)
    const bucket = Math.floor(Date.now() / 5000)
    const key = `cad_${cad.filename}_${bucket}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    observe('FILE_LOADED', {
      filename: cad.filename,
      format: cad.format,
      vertices: cad.stats?.vertices,
      size: null
    })
  }
}

export function startWatcher() {
  if (watcherStarted) return
  watcherStarted = true

  window.addEventListener('enginguity:event_logged', handleGlobalEvent)
  moduleStateStore.subscribe(handleModuleState)

  // Absorb any events already in localStorage that we haven't seen
  try {
    const stored = JSON.parse(localStorage.getItem('enginguity_event_log') || '[]')
    const seenIds = new Set(draft.rawObservations.map(o => o.id))
    stored.forEach(ev => {
      if (!seenIds.has(ev.id) && WATCHED_EVENTS.has(ev.type)) {
        const obs = { ...ev, incorporated: false }
        if (!draft.rawObservations.find(o => o.id === ev.id)) {
          draft.rawObservations.push(obs)
        }
      }
    })
    lastEventCount = stored.length
    saveDraft(draft)
  } catch { /* ignore */ }
}

export function stopWatcher() {
  window.removeEventListener('enginguity:event_logged', handleGlobalEvent)
  watcherStarted = false
}
