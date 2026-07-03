import { useState, useRef, useCallback } from 'react'
import { Upload, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import FILE_FORMATS, { EXT_MAP, ACCEPT_STRING, detectFormat } from '../../config/fileFormats.js'
import { processFile } from '../../engine/fileEngine.js'

// ── Category filter pill ──────────────────────────────────────────────────────

function CategoryPill({ cat, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-full text-xs border transition-all whitespace-nowrap"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        
        background: active ? `${cat.color}18` : 'transparent',
        borderColor: active ? cat.color : 'var(--border)',
        color: active ? cat.color : 'var(--text-muted)',
      }}
    >
      {cat.label}
    </button>
  )
}

// ── Format ext pill ───────────────────────────────────────────────────────────

function ExtPill({ fmt, catColor }) {
  return (
    <span
      className="px-2 py-0.5 rounded border"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        background: `${catColor}10`,
        borderColor: `${catColor}30`,
        color: catColor,
        whiteSpace: 'nowrap',
      }}
      title={`${fmt.name} — ${fmt.desc}`}
    >
      .{fmt.ext}
    </span>
  )
}

// ── Loading card ─────────────────────────────────────────────────────────────

function LoadingCard({ file, progress, error, done, fmt }) {
  return (
    <div
      className="w-full max-w-md mx-auto rounded-xl border p-4 flex flex-col gap-3"
      style={{
        background: 'var(--surface-2)',
        borderColor: error ? 'rgba(255,80,80,0.3)' : done ? 'rgba(34,197,94,0.3)' : 'var(--border-bright)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          {fmt && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: fmt.categoryColor }}
            />
          )}
          <span
            className="truncate"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text)' }}
          >
            {file.name}
          </span>
        </div>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          {fmt && (
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                color: fmt.categoryColor,
                background: `${fmt.categoryColor}18`,
                padding: '1px 6px',
                borderRadius: 4,
              }}
            >
              {fmt.name}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
            {(file.size / 1024 / 1024).toFixed(1)} MB
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            background: error ? '#b08080' : done ? '#7aaa8a' : fmt?.categoryColor ?? 'var(--accent)',
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        {!done && !error && <Loader2 size={11} className="animate-spin" style={{ color: 'var(--accent)' }} />}
        {done && !error && <CheckCircle size={11} style={{ color: '#7aaa8a' }} />}
        {error && <AlertTriangle size={11} style={{ color: '#b08080' }} />}
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: error ? '#b08080' : done ? '#7aaa8a' : 'var(--text-muted)',
          }}
        >
          {error ?? (done ? 'Parsed — ready for analysis' : 'Processing…')}
        </span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * @param {{ onFileLoaded: (result: FileResult) => void, acceptedCategories?: string[], maxSizeMB?: number }} props
 */
export function UniversalDropZone({ onFileLoaded, acceptedCategories = ['all'], maxSizeMB = 500 }) {
  const [dragging, setDragging] = useState(false)
  const [dragFilename, setDragFilename] = useState(null)
  const [activeCat, setActiveCat] = useState(null)
  const [loadState, setLoadState] = useState(null) // { file, progress, error, done, fmt }
  const inputRef = useRef(null)

  const accept = acceptedCategories.includes('all')
    ? ACCEPT_STRING
    : acceptedCategories
        .flatMap((c) => (FILE_FORMATS[c]?.formats ?? []).map((f) => `.${f.ext}`))
        .join(',')

  const handleFile = useCallback(async (file) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      setLoadState({ file, progress: 0, error: `File exceeds ${maxSizeMB} MB limit`, done: false, fmt: null })
      return
    }

    const fmt = detectFormat(file.name)
    setLoadState({ file, progress: 20, error: null, done: false, fmt })

    try {
      setLoadState((s) => ({ ...s, progress: 60 }))
      const result = await processFile(file)
      setLoadState((s) => ({ ...s, progress: 100, done: true }))
      onFileLoaded?.({ ...result, file })
    } catch (err) {
      setLoadState((s) => ({ ...s, progress: 100, error: err.message, done: false }))
    }
  }, [maxSizeMB, onFileLoaded])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    setDragFilename(null)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragging(true)
    const items = e.dataTransfer.items
    if (items.length > 0) setDragFilename(items[0]?.getAsFile?.()?.name ?? null)
  }, [])

  const handleDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragging(false)
      setDragFilename(null)
    }
  }, [])

  const handleInput = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }, [handleFile])

  // Build visible formats filtered by selected category
  const visibleCategories = Object.entries(FILE_FORMATS).filter(([id]) =>
    acceptedCategories.includes('all') || acceptedCategories.includes(id)
  )

  const activeCatData = activeCat ? FILE_FORMATS[activeCat] : null

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !loadState?.done && inputRef.current?.click()}
        className="w-full rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-4 py-14 px-8 relative"
        style={{
          borderColor: dragging ? 'var(--accent)' : 'var(--border-bright)',
          background: dragging ? 'rgba(0,200,255,0.04)' : 'var(--surface)',
          minHeight: 200,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleInput}
        />

        {!dragging && !loadState && (
          <>
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.15)' }}
            >
              <Upload size={26} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div className="text-center">
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Drop any engineering file
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                or click to browse
              </p>
            </div>
          </>
        )}

        {dragging && (
          <div className="text-center pointer-events-none">
            <Upload size={32} style={{ color: 'var(--accent)', margin: '0 auto 12px' }} />
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: 'var(--accent)', fontWeight: 600 }}>
              {dragFilename ? `Release to load "${dragFilename}"` : 'Release to load'}
            </p>
          </div>
        )}

        {loadState && (
          <LoadingCard
            file={loadState.file}
            progress={loadState.progress}
            error={loadState.error}
            done={loadState.done}
            fmt={loadState.fmt}
          />
        )}
      </div>

      {/* Format browser */}
      <div className="flex flex-col gap-2">
        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <button
            onClick={() => setActiveCat(null)}
            className="px-2.5 py-1 rounded-full text-xs border transition-all"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              background: !activeCat ? 'rgba(0,200,255,0.12)' : 'transparent',
              borderColor: !activeCat ? 'var(--accent)' : 'var(--border)',
              color: !activeCat ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            All formats
          </button>
          {visibleCategories.map(([id, cat]) => (
            <CategoryPill
              key={id}
              cat={cat}
              active={activeCat === id}
              onClick={() => setActiveCat(activeCat === id ? null : id)}
            />
          ))}
        </div>

        {/* Ext pills */}
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
          {(activeCatData ? [[activeCat, activeCatData]] : visibleCategories).map(([id, cat]) =>
            cat.formats.map((fmt) => (
              <ExtPill key={`${id}-${fmt.ext}`} fmt={fmt} catColor="#6B7FD4" />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default UniversalDropZone
