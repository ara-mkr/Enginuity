import { useParams, Link } from 'react-router-dom'
import { Store, AlertTriangle } from 'lucide-react'
import { getCustomToolById } from '../../hooks/useInstalledTools'

/**
 * Renders a user-uploaded community tool. Built-in tools never come through
 * here — they keep their own routes.
 *
 * Sandboxed iframe WITHOUT allow-same-origin: combined with allow-scripts it
 * would void the sandbox for inline (srcDoc) tools, letting untrusted tool
 * code read this app's storage (including API keys). Tools run with an opaque
 * origin instead — scripts work, but no cookies/storage/parent-DOM access.
 */
export function CustomToolFrame() {
  const { id } = useParams<{ id: string }>()
  const tool = id ? getCustomToolById(id) : undefined

  if (!tool) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 14,
        color: 'var(--text-muted)', background: 'var(--bg)', padding: 40,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        <AlertTriangle size={28} style={{ color: 'var(--text-dim)' }} />
        <div style={{ fontSize: 14 }}>Custom tool "{id}" was not found.</div>
        <Link
          to="/marketplace"
          style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: 'var(--accent)', color: 'var(--bg)', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Store size={13} /> Open Tool Marketplace
        </Link>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--surface)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{tool.label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{tool.description}</div>
        <div style={{ flex: 1 }} />
        {tool.author && (
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
            by {tool.author}{tool.version ? ` · v${tool.version}` : ''}
          </div>
        )}
      </div>
      <iframe
        title={tool.label}
        src={tool.url || undefined}
        srcDoc={!tool.url ? tool.html : undefined}
        sandbox="allow-scripts allow-popups allow-downloads"
        style={{
          flex: 1, width: '100%', border: 'none', background: '#fff',
        }}
      />
    </div>
  )
}
