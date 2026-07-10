import { useState, useCallback } from 'react'
import { X, Clock, Trash2, RefreshCw } from 'lucide-react'
import { detectFormat } from '../../config/fileFormats.js'
import { processFile } from '../../engine/fileEngine.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FileHistoryAny = any

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
const HISTORY_KEY = 'enginguity_file_history'
const MAX_ENTRIES = 20

export interface FileHistoryEntry {
  id: string
  name: string
  ext: string
  category: string
  sizeBytes: number
  loadedAt: string // ISO date string
  aiContext: string
  categoryColor?: string
}

// eslint-disable-next-line react-refresh/only-export-components -- shared storage helper, not worth a separate file
export function getFileHistory(): FileHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    return []
  }
}

// eslint-disable-next-line react-refresh/only-export-components -- shared storage helper, not worth a separate file
export function addToFileHistory(entry: Omit<FileHistoryEntry, 'id' | 'loadedAt'>) {
  const history = getFileHistory()
  const newEntry: FileHistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    loadedAt: new Date().toISOString(),
  }
  // Remove duplicates by name
  const deduped = history.filter((e) => e.name !== entry.name)
  const updated = [newEntry, ...deduped].slice(0, MAX_ENTRIES)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  window.dispatchEvent(new Event('enginguity:file-history-updated'))
}

// ---------------------------------------------------------------------------
// Time-ago helper
// ---------------------------------------------------------------------------
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface FileHistoryProps {
  onClose: () => void
  onFileLoaded?: (result: unknown) => void
}

export function FileHistory({ onClose, onFileLoaded }: FileHistoryProps) {
  const [history, setHistory] = useState<FileHistoryEntry[]>(() => getFileHistory())
  const [reloading, setReloading] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setHistory(getFileHistory())
  }, [])

  const handleClear = useCallback(() => {
    localStorage.removeItem(HISTORY_KEY)
    setHistory([])
  }, [])

  const handleRemove = useCallback((id: string) => {
    const updated = history.filter((e) => e.id !== id)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
    setHistory(updated)
  }, [history])

  const handleReload = useCallback((entry: FileHistoryEntry) => {
    // Trigger file input so user can re-upload
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = `.${entry.ext}`
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      setReloading(entry.id)
      try {
        const result = await processFile(file)
        addToFileHistory({
          name: file.name,
          ext: entry.ext,
          category: result.category,
          sizeBytes: file.size,
          aiContext: result.aiContext,
          categoryColor: (detectFormat(file.name) as FileHistoryAny)?.categoryColor,
        })
        onFileLoaded?.(result)
        refresh()
        onClose()
      } catch (err) {
        console.error('Reload failed', err)
      } finally {
        setReloading(null)
      }
    }
    input.click()
  }, [onFileLoaded, refresh, onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(8,8,16,0.88)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border-bright)',
          maxHeight: '80vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2.5">
            <Clock size={14} style={{ color: 'var(--accent)' }} />
            <h2
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text)',
                
                
              }}
            >
              File History
            </h2>
            {history.length > 0 && (
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  background: 'var(--surface-2)',
                  padding: '1px 7px',
                  borderRadius: 8,
                }}
              >
                {history.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {history.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 gap-3"
              style={{ color: 'var(--text-dim)' }}
            >
              <Clock size={28} />
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>No files loaded yet</p>
            </div>
          ) : (
            history.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-4 py-3 border-b transition-all group"
                style={{ borderColor: 'var(--border)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Color dot */}
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: entry.categoryColor ?? 'var(--text-dim)' }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="truncate"
                    style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text)' }}
                    title={entry.name}
                  >
                    {entry.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)' }}>
                      {fmtBytes(entry.sizeBytes)}
                    </span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>·</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)' }}>
                      {timeAgo(entry.loadedAt)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleReload(entry)}
                    className="p-1.5 rounded-md transition-colors"
                    style={{ color: 'var(--text-dim)' }}
                    title="Reload file"
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
                  >
                    {reloading === entry.id ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <RefreshCw size={13} />
                    )}
                  </button>
                  <button
                    onClick={() => handleRemove(entry.id)}
                    className="p-1.5 rounded-md transition-colors"
                    style={{ color: 'var(--text-dim)' }}
                    title="Remove from history"
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#b08080')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div
            className="px-4 py-3 border-t flex items-center justify-between shrink-0"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}
          >
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)' }}>
              Last {MAX_ENTRIES} files stored locally
            </span>
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 text-xs transition-colors"
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#b08080')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
            >
              <Trash2 size={10} />
              Clear history
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
