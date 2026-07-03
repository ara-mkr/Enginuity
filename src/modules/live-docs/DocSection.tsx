import React, { useState } from 'react'
import { RefreshCw, Edit2, MoreHorizontal, Check, X } from 'lucide-react'

interface SectionContent {
  type: 'prose' | 'parameter_table' | 'bom_table' | 'decisions_list' | 'issues_table' | 'references_list'
  content?: string
  error?: string
  empty?: boolean
  parameters?: any[]
  outputs?: any[]
  items?: any[]
  totalCost?: number
  decisions?: any[]
  problems?: any[]
  references?: any[]
}

interface Props {
  sectionKey: string
  title: string
  index: number
  content: SectionContent | null
  generating: boolean
  onRegenerate: () => void
  onUpdate: (content: SectionContent) => void
}

export function DocSection({ sectionKey, title, index, content, generating, onRegenerate, onUpdate }: Props) {
  const [editMode, setEditMode] = useState(false)
  const [editText, setEditText] = useState('')
  const [hovered, setHovered] = useState(false)

  const startEdit = () => {
    setEditText(content?.type === 'prose' ? (content.content || '') : '')
    setEditMode(true)
  }

  const saveEdit = () => {
    onUpdate({ type: 'prose', content: editText, generatedAt: Date.now() } as any)
    setEditMode(false)
  }

  return (
    <div
      style={{ marginBottom: 48 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)', minWidth: 20 }}>
          {String(index).padStart(2, '0')}
        </span>
        <h2 style={{ margin: 0, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 20, fontWeight: 500, color: 'var(--text)', flex: 1 }}>
          {title}
        </h2>
        <div style={{
          display: 'flex', gap: 4, alignItems: 'center',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s',
          pointerEvents: hovered ? 'auto' : 'none'
        }}>
          <ToolBtn onClick={onRegenerate} title="Regenerate"><RefreshCw size={12} /></ToolBtn>
          {content?.type === 'prose' && (
            <ToolBtn onClick={startEdit} title="Edit"><Edit2 size={12} /></ToolBtn>
          )}
        </div>
      </div>
      <div style={{ height: 1, background: 'var(--border)', marginBottom: 18 }} />

      {/* Content */}
      {generating ? (
        <GeneratingSkeleton />
      ) : editMode ? (
        <div>
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            style={{
              width: '100%', minHeight: 200, resize: 'vertical',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 14, color: 'var(--text)',
              fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 15,
              lineHeight: 1.8, outline: 'none', boxSizing: 'border-box'
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn onClick={saveEdit} accent><Check size={12} /> Save</Btn>
            <Btn onClick={() => setEditMode(false)}><X size={12} /> Cancel</Btn>
            <Btn onClick={() => { setEditMode(false); onRegenerate() }}><RefreshCw size={12} /> Regenerate</Btn>
          </div>
        </div>
      ) : content ? (
        <SectionBody content={content} />
      ) : (
        <p style={{ color: 'var(--text-dim)', fontSize: 13, fontStyle: 'italic', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          No content yet — click ↻ to generate.
        </p>
      )}
    </div>
  )
}

function SectionBody({ content }: { content: SectionContent }) {
  if (content.error) {
    return <p style={{ color: '#f87171', fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>Error: {content.error}</p>
  }

  switch (content.type) {
    case 'prose':
      if (!content.content) {
        return <p style={{ color: 'var(--text-dim)', fontSize: 13, fontStyle: 'italic', fontFamily: "'DM Sans', system-ui, sans-serif" }}>No content recorded for this section yet.</p>
      }
      return (
        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.8 }}>
          {content.content.split('\n\n').map((para, i) => (
            <p key={i} style={{ margin: '0 0 16px' }}>{para}</p>
          ))}
        </div>
      )

    case 'parameter_table':
      return (
        <div>
          {content.parameters && content.parameters.length > 0 ? (
            <DataTable
              headers={['Parameter', 'Value', 'Unit', 'Min', 'Max', 'Description']}
              rows={content.parameters.map(p => [p.name, p.value ?? '—', p.unit, p.min, p.max, p.description])}
            />
          ) : (
            <EmptyHint>No parameters found. Use the Parameter Playground module to define design parameters.</EmptyHint>
          )}
          {content.outputs && content.outputs.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <SubHeader>Computed Outputs</SubHeader>
              <DataTable
                headers={['Output', 'Value', 'Unit', 'Formula']}
                rows={content.outputs.map(o => [o.name, o.value ?? '—', o.unit, o.formula])}
              />
            </div>
          )}
        </div>
      )

    case 'bom_table':
      return (
        <div>
          {content.items && content.items.length > 0 ? (
            <>
              <DataTable
                headers={['#', 'Part', 'Description', 'Qty', 'Unit Price', 'Total']}
                rows={content.items.map((item, i) => [
                  i + 1,
                  item.mpn || item.name || '—',
                  item.description || '—',
                  item.quantity || 1,
                  item.unitPrice != null ? `$${Number(item.unitPrice).toFixed(2)}` : '—',
                  item.unitPrice != null ? `$${(Number(item.unitPrice) * (item.quantity || 1)).toFixed(2)}` : '—'
                ])}
              />
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text)', marginTop: 10 }}>
                Total estimated cost: ${content.totalCost?.toFixed(2)}
              </p>
              <p style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 4 }}>
                Prices are estimates. Verify before ordering.
              </p>
            </>
          ) : (
            <EmptyHint>No BOM data yet. Use the BOM Intel module to build your bill of materials.</EmptyHint>
          )}
        </div>
      )

    case 'decisions_list':
      return content.decisions && content.decisions.length > 0 ? (
        <div>
          {content.decisions.map((d: any, i: number) => (
            <div key={i} style={{ paddingBottom: 20, marginBottom: 20, borderBottom: i < content.decisions!.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{d.title || 'Decision'}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-dim)', flexShrink: 0, marginLeft: 12 }}>{d.createdAt ? new Date(d.createdAt).toLocaleDateString() : ''}</span>
              </div>
              <p style={{ margin: 0, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{d.content || d.rationale || ''}</p>
            </div>
          ))}
        </div>
      ) : <EmptyHint>No design decisions recorded. Add DECISION entries in the Engineering Notebook.</EmptyHint>

    case 'issues_table':
      return content.problems && content.problems.length > 0 ? (
        <DataTable
          headers={['Issue', 'Status', 'Resolution']}
          rows={content.problems.map(p => [
            p.title,
            p.status,
            p.solution || '—'
          ])}
          statusCol={1}
        />
      ) : <EmptyHint>No issues recorded.</EmptyHint>

    case 'references_list':
      return content.references && content.references.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {content.references.map((ref: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-dim)', minWidth: 28 }}>[{i + 1}]</span>
              <span style={{ fontSize: 16 }}>{ref.type === 'video' ? '▶' : '📄'}</span>
              <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--text-muted)' }}>
                {ref.name || ref.title || ref.url}
                {ref.format && <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>— {ref.format}</span>}
                <span style={{ color: 'var(--text-dim)', marginLeft: 8 }}>— {new Date(ref.date).toLocaleDateString()}</span>
              </span>
            </div>
          ))}
        </div>
      ) : <EmptyHint>No references recorded.</EmptyHint>

    default:
      return null
  }
}

function GeneratingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[100, 85, 92].map((w, i) => (
        <div key={i} style={{
          height: 14, width: `${w}%`, borderRadius: 4,
          background: 'var(--surface-2)',
          animation: 'pulse 1.5s ease-in-out infinite',
          animationDelay: `${i * 0.15}s`
        }} />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:.8} }`}</style>
      <p style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', margin: 0 }}>Generating...</p>
    </div>
  )
}

function DataTable({ headers, rows, statusCol }: { headers: string[], rows: any[][], statusCol?: number }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <thead>
          <tr style={{ background: 'var(--surface-2)' }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: 'var(--text-dim)', fontWeight: 500, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
              {row.map((cell, ci) => {
                const isStatus = ci === statusCol
                const statusColor = isStatus ? (
                  String(cell).toLowerCase() === 'open' ? 'var(--text-dim)' :
                  String(cell).toLowerCase().includes('resolv') ? 'var(--text-dim)' :
                  'var(--text-muted)'
                ) : undefined
                return (
                  <td key={ci} style={{
                    padding: '7px 12px',
                    fontFamily: ci === 0 ? "'DM Sans', system-ui, sans-serif" : "'JetBrains Mono', monospace",
                    fontSize: ci === 0 ? 13 : 12,
                    color: statusColor || (ci === 0 ? 'var(--text)' : 'var(--text-muted)'),
                    borderBottom: '1px solid var(--border)',
                    textDecoration: isStatus && String(cell).toLowerCase().includes('resolv') ? 'line-through' : 'none'
                  }}>
                    {cell ?? '—'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>{children}</p>
}

function SubHeader({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 10px' }}>{children}</p>
}

function ToolBtn({ children, onClick, title }: { children: React.ReactNode, onClick: () => void, title?: string }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: 'transparent', border: '1px solid var(--border)', borderRadius: 5,
      padding: '4px 6px', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontFamily: "'DM Sans', system-ui, sans-serif"
    }}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--border-bright)' }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.borderColor = 'var(--border)' }}
    >{children}</button>
  )
}

function Btn({ children, onClick, accent }: { children: React.ReactNode, onClick: () => void, accent?: boolean }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: accent ? 'var(--accent)' : 'transparent',
      border: accent ? 'none' : '1px solid var(--border)',
      borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
      color: accent ? '#000' : 'var(--text-muted)',
      fontSize: 12, fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: accent ? 600 : 400
    }}>{children}</button>
  )
}
