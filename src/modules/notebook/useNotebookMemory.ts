import { useMemo } from 'react'
import { STORAGE_KEY } from './types'
import type { NotebookEntry } from './types'

function loadEntries(): NotebookEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter((t) => t.length > 3)
}

function relevanceScore(entry: NotebookEntry, keywords: string[]): number {
  const haystack = [
    entry.title,
    entry.tags.join(' '),
    ...Object.values(entry).filter((v) => typeof v === 'string'),
  ].join(' ').toLowerCase()

  return keywords.filter((kw) => haystack.includes(kw)).length
}

interface RelevantEntry {
  entry: NotebookEntry
  score: number
}

/**
 * Returns notebook entries relevant to the given keywords (e.g. from module state).
 * Use in any module to surface a "From your notebook" banner.
 */
export function useNotebookMemory(contextKeywords: string[]): RelevantEntry[] {
  return useMemo(() => {
    if (!contextKeywords.length) return []
    const entries = loadEntries()
    const kws = contextKeywords.flatMap(tokenize)
    return entries
      .map((e) => ({ entry: e, score: relevanceScore(e, kws) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
  }, [contextKeywords])
}
