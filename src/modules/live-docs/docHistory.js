const HISTORY_KEY = 'enginguity_doc_history'

export function saveToHistory(draft, title) {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    const entry = {
      id: crypto.randomUUID(),
      generatedAt: Date.now(),
      title,
      sectionCount: Object.values(draft.sections).filter(Boolean).length,
      wordCount: Object.values(draft.sections)
        .map(s => s?.content?.split(/\s+/).length || 0)
        .reduce((a, b) => a + b, 0),
      format: 'draft',
      content: { ...draft.sections }
    }
    history.unshift(entry)
    if (history.length > 20) history.splice(20)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch { /* ignore */ }
}

export function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}

export function timeAgo(ts) {
  if (!ts) return 'never'
  const diff = Date.now() - ts
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}
