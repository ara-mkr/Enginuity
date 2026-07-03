import { useState } from 'react'
import { ExternalLink, ZoomIn } from 'lucide-react'
import { PinoutDiagram } from './PinoutDiagram'
import { QueryInterface } from './QueryInterface'
import type { ComponentData, ChatMessage } from './types'

const TABS = ['Pinout', 'Electrical', 'Circuits', 'Features', 'Raw PDF'] as const
type Tab = typeof TABS[number]

interface Props {
  data: ComponentData
  pdfPages: string[]
  chatMessages: ChatMessage[]
  onChatChange: (msgs: ChatMessage[]) => void
  onLoadInCircuitSim?: (netlist: string) => void
  onLoadInParamPlayground?: (components: Array<{ name: string; value: string }>) => void
}

function Badge({ label, color }: { label: string; color?: string }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4,
      fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 500,
       
      background: `${color ?? 'var(--accent)'}18`,
      border: `1px solid ${color ?? 'var(--accent)'}40`,
      color: color ?? 'var(--accent)',
    }}>
      {label}
    </span>
  )
}

function PinTable({ pins }: { pins: ComponentData['pinout'] }) {
  const [search, setSearch] = useState('')
  const filtered = pins.filter((p) =>
    !search || p.name.toLowerCase().includes(search) || p.description.toLowerCase().includes(search)
  )
  return (
    <div style={{ marginTop: 24 }}>
      <input className="input" value={search} onChange={(e) => setSearch(e.target.value.toLowerCase())}
        placeholder="Search pins…" style={{ marginBottom: 12, width: 240 }} />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Pin', 'Name', 'Type', 'Description'].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                <td style={{ ...tdStyle, color: 'var(--text-muted)', width: 50 }}>{p.pin}</td>
                <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>{p.name}</td>
                <td style={{ ...tdStyle }}><Badge label={p.type || 'N/A'} color="var(--text-muted)" /></td>
                <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ElectricalTab({ data }: { data: ComponentData }) {
  const maxValues = data.absoluteMaximums

  const grouped = data.electricalCharacteristics.reduce<Record<string, typeof data.electricalCharacteristics>>((acc, row) => {
    const group = row.parameter.split(' ')[0] ?? 'General'
    if (!acc[group]) acc[group] = []
    acc[group].push(row)
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Absolute Maximums */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#b08080',   }}>
            ⚠ Do Not Exceed
          </span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,107,107,0.2)' }} />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Parameter', 'Min', 'Max', 'Unit'].map((h) => (
                  <th key={h} style={{ ...thStyle, color: '#b08080' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {maxValues.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,107,107,0.02)' : 'transparent' }}>
                  <td style={tdStyle}>{row.parameter}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{row.min ?? '—'}</td>
                  <td style={{ ...tdStyle, color: '#b08080', fontWeight: 600 }}>{row.max ?? '—'}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{row.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Electrical Characteristics */}
      {Object.entries(grouped).map(([group, rows]) => (
        <div key={group}>
          <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',   marginBottom: 10 }}>
            {group}
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Parameter', 'Symbol', 'Min', 'Typ', 'Max', 'Unit', 'Conditions'].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={tdStyle}>{row.parameter}</td>
                    <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>{row.symbol}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{row.min ?? '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--accent)', fontWeight: 600 }}>{row.typ ?? '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{row.max ?? '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{row.unit}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 11 }}>{row.conditions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

function CircuitsTab({ circuits, onLoadInCircuitSim, onLoadInParamPlayground }: {
  circuits: ComponentData['applicationCircuits']
  onLoadInCircuitSim?: (netlist: string) => void
  onLoadInParamPlayground?: (components: Array<{ name: string; value: string }>) => void
}) {
  if (!circuits.length) return <p style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>No application circuits extracted.</p>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
      {circuits.map((c, i) => (
        <div key={i} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: 'var(--text)', marginBottom: 6, marginTop: 0 }}>{c.title}</h4>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>{c.description}</p>
          {c.components.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)',   marginBottom: 6 }}>Components</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {c.components.map((comp, j) => (
                  <span key={j} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--accent)', background: 'rgba(0,200,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>
                    {comp.name}={comp.value}
                  </span>
                ))}
              </div>
            </div>
          )}
          {c.notes && <p style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 12 }}>{c.notes}</p>}
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn" onClick={() => onLoadInCircuitSim?.(
              `* ${c.title}\n${c.components.map((comp, j) => `${comp.name} ${j} ${j + 1} ${comp.value}`).join('\n')}\n.end`
            )} style={{ flex: 1, fontSize: 10 }}>
              Load in Circuit Sim
            </button>
            <button className="btn" onClick={() => onLoadInParamPlayground?.(c.components)}
              style={{ flex: 1, fontSize: 10 }}>
              Load in Playground
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function RawPDFTab({ pages }: { pages: string[] }) {
  const [zoomed, setZoomed] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  if (!pages.length) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <p style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
        PDF rasterization only available for PDF files.
      </p>
    </div>
  )

  return (
    <div>
      <input className="input" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search pages…" style={{ marginBottom: 16, width: 240 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {pages.map((src, i) => (
          <div key={i} style={{ position: 'relative', cursor: 'pointer' }}
            onClick={() => setZoomed(zoomed === i ? null : i)}>
            <div style={{
              position: 'absolute', top: 8, right: 8, zIndex: 1,
              background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 6px',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <ZoomIn size={12} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: 'var(--text-muted)' }}>Page {i + 1}</span>
            </div>
            <img
              src={src}
              alt={`Page ${i + 1}`}
              style={{
                width: zoomed === i ? '100%' : '100%',
                maxHeight: zoomed === i ? 'none' : 300,
                objectFit: 'contain',
                objectPosition: 'top',
                border: '1px solid var(--border)',
                borderRadius: 8,
                display: 'block',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textAlign: 'left',
  padding: '8px 12px', borderBottom: '1px solid var(--border)',
  color: 'var(--text-muted)',  
}
const tdStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
  padding: '8px 12px', borderBottom: '1px solid var(--border)',
  color: 'var(--text)',
}

export function ComponentCard({ data, pdfPages, chatMessages, onChatChange, onLoadInCircuitSim, onLoadInParamPlayground }: Props) {
  const [tab, setTab] = useState<Tab>('Pinout')
  const { component } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '12px 12px 0 0', padding: '20px 24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700, color: 'var(--accent)', margin: '0 0 4px' }}>
              {component.partNumber}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 10px' }}>
              {component.manufacturer} — {component.description}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {component.category && <Badge label={component.category} />}
              {component.package.map((p) => <Badge key={p} label={p} color="#9485b8" />)}
              {component.rohs === true && <Badge label="RoHS" color="#7aaa8a" />}
              {component.rohs === false && <Badge label="Non-RoHS" color="#b08080" />}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={`https://www.mouser.com/Search/Refine?Keyword=${encodeURIComponent(component.partNumber)}`}
              target="_blank" rel="noopener noreferrer"
              className="btn"
              style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 12 }}
            >
              <ExternalLink size={12} /> Mouser
            </a>
            <a
              href={`https://www.digikey.com/en/products/filter/${encodeURIComponent(component.partNumber)}`}
              target="_blank" rel="noopener noreferrer"
              className="btn"
              style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 12 }}
            >
              <ExternalLink size={12} /> Digikey
            </a>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', padding: '0 24px',
      }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '12px 16px',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
              transition: 'all 0.15s',
              marginBottom: -1,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderTop: 'none', borderRadius: '0 0 12px 12px',
        padding: '24px',
        minHeight: 400,
      }}>
        {tab === 'Pinout' && (
          <div>
            {data.pinout.length <= 32 ? (
              <PinoutDiagram pins={data.pinout} packages={component.package} />
            ) : (
              <p style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, marginBottom: 16 }}>
                Package has {data.pinout.length} pins — diagram omitted for clarity.
              </p>
            )}
            <PinTable pins={data.pinout} />
          </div>
        )}

        {tab === 'Electrical' && <ElectricalTab data={data} />}

        {tab === 'Circuits' && (
          <CircuitsTab
            circuits={data.applicationCircuits}
            onLoadInCircuitSim={onLoadInCircuitSim}
            onLoadInParamPlayground={onLoadInParamPlayground}
          />
        )}

        {tab === 'Features' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            <div>
              <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-muted)',   marginTop: 0, marginBottom: 12 }}>Features</h3>
              <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                {data.features.map((f, i) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>{f}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-muted)',   marginTop: 0, marginBottom: 12 }}>Typical Applications</h3>
              <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
                {data.applications.map((a, i) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>{a}</li>
                ))}
              </ul>
            </div>
            {data.orderingInfo.length > 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-muted)',   marginBottom: 12 }}>Ordering Information</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Part Number', 'Package', 'Notes'].map((h) => <th key={h} style={thStyle}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.orderingInfo.map((o, i) => (
                      <tr key={i}>
                        <td style={{ ...tdStyle, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>{o.partNumber}</td>
                        <td style={tdStyle}>{o.package}</td>
                        <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{o.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'Raw PDF' && <RawPDFTab pages={pdfPages} />}
      </div>

      {/* Query interface */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderTop: '1px solid var(--border-bright)', borderRadius: 12,
        padding: 24, marginTop: 16,
      }}>
        <QueryInterface component={data} messages={chatMessages} onMessagesChange={onChatChange} />
      </div>
    </div>
  )
}
