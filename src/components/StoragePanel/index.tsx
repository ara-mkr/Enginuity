import { useEffect, useState } from 'react'
import { FolderOpen, HardDrive, FileJson, RefreshCw, ExternalLink } from 'lucide-react'
import { isElectron, listDataFiles, openDataFolder, getPaths } from '../../utils/electronBridge'

interface DataFile {
  name: string
  filename: string
  size: number
  modified: number
}

interface Paths {
  enginguityDir: string
  dataDir: string
  userData: string
  home: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const FILE_LABELS: Record<string, string> = {
  'enginguity-store': 'App State (chats, canvas, BOM…)',
  'ui-settings': 'UI Preferences',
}

export function StoragePanel() {
  const [files, setFiles] = useState<DataFile[]>([])
  const [paths, setPaths] = useState<Paths | null>(null)
  const [loading, setLoading] = useState(true)
  const [isNative, setIsNative] = useState(false)

  const refresh = async () => {
    setLoading(true)
    const [f, p] = await Promise.all([listDataFiles(), getPaths()])
    setFiles(f)
    setPaths(p)
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount platform detection
    setIsNative(isElectron())
    refresh()
  }, [])

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)

  const row: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '9px 0',
    borderBottom: '1px solid color-mix(in srgb, var(--color-border) 60%, transparent)',
    gap: 12,
  }

  const mono: React.CSSProperties = {
    fontFamily: 'var(--font-family-mono, monospace)',
    fontSize: 11,
    color: 'var(--color-text-muted)',
    wordBreak: 'break-all',
  }

  if (!isNative) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
        <HardDrive size={28} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
        <div style={{ fontWeight: 500, marginBottom: 6, color: 'var(--color-text-secondary)' }}>Running in browser</div>
        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
          Data is stored in IndexedDB / localStorage.<br />
          Download the desktop app to get file-system storage.
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Data folder path */}
      {paths && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: '10px 12px',
          marginBottom: 16,
          cursor: 'pointer',
        }}
          onClick={() => openDataFolder()}
          title="Click to open in Finder / Explorer"
        >
          <FolderOpen size={14} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
          <span style={{ ...mono, flex: 1 }}>{paths.dataDir}</span>
          <ExternalLink size={12} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
        </div>
      )}

      {/* Summary row */}
      <div style={{ ...row }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>Saved files</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>JSON files in your data folder</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            {files.length} files · {formatBytes(totalSize)}
          </span>
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: '3px 6px',
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Refresh"
          >
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* File list */}
      {loading ? (
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
          Loading…
        </div>
      ) : files.length === 0 ? (
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
          No data files yet — they'll appear here after you use the app.
        </div>
      ) : (
        <div style={{ marginTop: 4 }}>
          {files.map(f => (
            <div key={f.filename} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              borderBottom: '1px solid color-mix(in srgb, var(--color-border) 40%, transparent)',
            }}>
              <FileJson size={13} style={{ color: 'var(--color-accent)', flexShrink: 0, opacity: 0.7 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {FILE_LABELS[f.name] ?? f.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
                  {f.filename} · {formatDate(f.modified)}
                </div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>
                {formatBytes(f.size)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Open folder button */}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={() => openDataFolder()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '7px 12px',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            fontSize: 12,
            width: '100%',
            justifyContent: 'center',
            transition: 'border-color 120ms ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
        >
          <FolderOpen size={13} />
          Open in Finder / Explorer
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
