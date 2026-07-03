import { useState, useEffect, useCallback, useRef } from 'react'
import {
  TrendingDown, ArrowUp, Clock, AlertTriangle, ChevronDown, ChevronUp,
  RefreshCw, Plus, X, ExternalLink, Trash2, Check, Upload, PackageSearch,
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { useAIProvider } from '../../hooks/useAIProvider'
import {
  getMonitoredBOMs, saveBOM, deleteBOM, shouldCheck,
  checkBOM, unreadAlertCount, getBOMById,
} from './checkEngine.js'

// ── Disclaimer Banner ─────────────────────────────────────────────────────────

function DisclaimerBanner() {
  return (
    <div style={{
      padding: '8px 14px',
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      borderRadius: 0,
      fontSize: 11,
      color: 'var(--text-dim)',
      fontStyle: 'italic',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
    }}>
      <AlertTriangle size={12} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
      Availability and pricing are AI estimates based on training data. Always verify on{' '}
      <a href="https://www.mouser.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Mouser</a>,{' '}
      <a href="https://www.digikey.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Digikey</a>, or{' '}
      <a href="https://www.lcsc.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>LCSC</a> before ordering.
    </div>
  )
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, width = 60, height = 20 }) {
  if (!data || data.length < 2) return null
  const prices = data.map(d => d.unitPrice).filter(v => v != null)
  if (prices.length < 2) return null
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width
    const y = height - ((p - min) / range) * height
    return `${x},${y}`
  }).join(' ')
  const trend = prices[prices.length - 1] - prices[0]
  const color = trend > 0.01 ? '#b09470' : trend < -0.01 ? '#94a3b8' : '#6b6d85'
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

// ── Status dot ────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  in_stock: '#7aaa8a',
  limited: '#b09470',
  out_of_stock: '#b08080',
  unknown: '#6b6d85',
}

function StatusDot({ status }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: STATUS_COLORS[status] ?? '#6b6d85',
        display: 'inline-block',
        flexShrink: 0,
      }} />
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {status?.replace('_', ' ') ?? 'unknown'}
      </span>
    </span>
  )
}

// ── Alert icon ────────────────────────────────────────────────────────────────

const ALERT_ICONS = {
  stock_change: TrendingDown,
  price_spike: ArrowUp,
  lead_time_increase: Clock,
  eol_warning: AlertTriangle,
}

function AlertIcon({ type }) {
  const Icon = ALERT_ICONS[type] ?? AlertTriangle
  return <Icon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
}

// ── Time ago ──────────────────────────────────────────────────────────────────

function timeAgo(ts) {
  if (!ts) return 'never'
  const diff = Date.now() - ts
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  const days = Math.floor(diff / 86400000)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

function nextCheck(bom) {
  if (!bom.lastChecked) return 'not yet checked'
  const interval = bom.checkFrequency === 'daily' ? 86400000 : 604800000
  const next = bom.lastChecked + interval
  const diff = next - Date.now()
  if (diff < 0) return 'due now'
  if (diff < 3600000) return `in ${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `in ${Math.floor(diff / 3600000)}h`
  const d = new Date(next)
  return `${d.toLocaleDateString([], { weekday: 'long' })}`
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'))
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const row = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    const qty = parseInt(row.qty ?? row.quantity ?? '1') || 1
    return {
      id: uuidv4(),
      quantity: qty,
      partNumber: row.part_number ?? row.part ?? row.mpn ?? row.reference ?? '',
      description: row.description ?? row.desc ?? row.value ?? '',
      manufacturer: row.manufacturer ?? row.mfr ?? '',
      lastStatus: null,
      history: [],
      alerts: [],
    }
  }).filter(r => r.partNumber)
}

// ── BOM Overview Card ─────────────────────────────────────────────────────────

function BOMCard({ bom, selected, onSelect, onCheck, onDelete, checking }) {
  const items = bom.items ?? []
  const alerts = unreadAlertCount(bom)
  const statuses = { in_stock: 0, limited: 0, out_of_stock: 0, unknown: 0 }
  for (const item of items) {
    const s = item.lastStatus?.stockStatus ?? 'unknown'
    statuses[s] = (statuses[s] ?? 0) + 1
  }

  return (
    <div
      onClick={() => onSelect(bom.id)}
      style={{
        padding: '12px 16px',
        borderRadius: 8,
        border: `1px solid ${selected ? 'var(--border-bright)' : 'var(--border)'}`,
        background: selected ? 'var(--surface-2)' : 'var(--surface)',
        cursor: 'pointer',
        transition: 'all 150ms',
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Left */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, marginBottom: 2 }}>
            {bom.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {items.length} items · last checked {timeAgo(bom.lastChecked)}
          </div>
        </div>

        {/* Center: status summary */}
        <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
          {statuses.in_stock > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7aaa8a', display: 'inline-block' }} />
              {statuses.in_stock} in stock
            </span>
          )}
          {statuses.limited > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#b09470', display: 'inline-block' }} />
              {statuses.limited} limited
            </span>
          )}
          {statuses.out_of_stock > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#b08080', display: 'inline-block' }} />
              {statuses.out_of_stock} out of stock
            </span>
          )}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {alerts > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{alerts} alerts</span>
          )}
          <button
            onClick={e => { e.stopPropagation(); onCheck(bom.id) }}
            disabled={checking}
            style={{
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 4,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              cursor: checking ? 'default' : 'pointer',
              opacity: checking ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <RefreshCw size={11} className={checking ? 'animate-spin' : ''} />
            {checking ? 'Checking...' : 'Check now'}
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(bom.id) }}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2 }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
        Next check: {nextCheck(bom)}
      </div>
    </div>
  )
}

// ── Items Table ────────────────────────────────────────────────────────────────

function ItemsTable({ items, onMarkAlertsRead }) {
  const [sortKey, setSortKey] = useState('alerts')
  const [sortDir, setSortDir] = useState(-1)
  const [expandedId, setExpandedId] = useState(null)

  const sorted = [...items].sort((a, b) => {
    let av, bv
    switch (sortKey) {
      case 'alerts': av = (a.alerts ?? []).filter(x => !x.read).length; bv = (b.alerts ?? []).filter(x => !x.read).length; break
      case 'partNumber': av = a.partNumber; bv = b.partNumber; break
      case 'status': av = a.lastStatus?.stockStatus ?? 'z'; bv = b.lastStatus?.stockStatus ?? 'z'; break
      case 'price': av = a.lastStatus?.unitPrice ?? -1; bv = b.lastStatus?.unitPrice ?? -1; break
      default: av = 0; bv = 0
    }
    if (av < bv) return -1 * sortDir
    if (av > bv) return 1 * sortDir
    return 0
  })

  const sortCol = (key) => {
    if (sortKey === key) setSortDir(d => -d)
    else { setSortKey(key); setSortDir(-1) }
  }

  const ColHeader = ({ label, k }) => (
    <th
      onClick={() => sortCol(k)}
      style={{
        padding: '6px 10px',
        fontSize: 11,
        color: sortKey === k ? 'var(--text)' : 'var(--text-dim)',
        fontWeight: 400,
        textAlign: 'left',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}
    >
      {label} {sortKey === k ? (sortDir > 0 ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <ColHeader label="Part #" k="partNumber" />
            <th style={thStyle}>Description</th>
            <th style={thStyle}>Qty</th>
            <ColHeader label="Stock" k="status" />
            <ColHeader label="Unit Price" k="price" />
            <th style={thStyle}>Lead Time</th>
            <th style={thStyle}>Trend</th>
            <ColHeader label="Alerts" k="alerts" />
          </tr>
        </thead>
        <tbody>
          {sorted.map(item => {
            const unread = (item.alerts ?? []).filter(a => !a.read).length
            const expanded = expandedId === item.id
            return (
              <>
                <tr
                  key={item.id}
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                  style={{
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    background: expanded ? 'var(--surface-2)' : 'transparent',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'var(--surface-2)' }}
                  onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent' }}
                >
                  <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace" }}>{item.partNumber}</td>
                  <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.description}
                  </td>
                  <td style={tdStyle}>{item.quantity}</td>
                  <td style={tdStyle}>
                    <StatusDot status={item.lastStatus?.stockStatus ?? 'unknown'} />
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace" }}>
                    {item.lastStatus?.unitPrice != null ? `$${item.lastStatus.unitPrice.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace" }}>
                    {item.lastStatus?.leadTimeWeeks != null ? `${item.lastStatus.leadTimeWeeks}w` : '—'}
                  </td>
                  <td style={tdStyle}>
                    <Sparkline data={item.history} />
                  </td>
                  <td style={tdStyle}>
                    {unread > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{unread}</span>
                    )}
                  </td>
                </tr>
                {expanded && (
                  <tr key={`${item.id}-detail`}>
                    <td colSpan={8} style={{ padding: '10px 14px', background: 'var(--bg-2)' }}>
                      <ItemDetail item={item} onMarkRead={onMarkAlertsRead} />
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const thStyle = {
  padding: '6px 10px',
  fontSize: 11,
  color: 'var(--text-dim)',
  fontWeight: 400,
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  background: 'var(--surface)',
  whiteSpace: 'nowrap',
}

const tdStyle = {
  padding: '8px 10px',
  color: 'var(--text-muted)',
  verticalAlign: 'middle',
}

function ItemDetail({ item, onMarkRead }) {
  const searchUrl = (site) => {
    const q = encodeURIComponent(item.partNumber)
    const urls = {
      mouser: `https://www.mouser.com/Search/Refine?Keyword=${q}`,
      digikey: `https://www.digikey.com/en/products/result?keywords=${q}`,
      lcsc: `https://www.lcsc.com/search?q=${q}`,
    }
    return urls[site]
  }

  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      {/* History */}
      {item.history?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>History</div>
          <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                {['Date', 'Status', 'Price', 'Lead'].map(h => (
                  <th key={h} style={{ padding: '2px 10px 2px 0', color: 'var(--text-dim)', fontWeight: 400, textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...item.history].reverse().map((h, i) => (
                <tr key={i}>
                  <td style={{ padding: '2px 10px 2px 0', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-dim)' }}>
                    {new Date(h.checkedAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '2px 10px 2px 0' }}>
                    <StatusDot status={h.stockStatus} />
                  </td>
                  <td style={{ padding: '2px 10px 2px 0', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                    {h.unitPrice != null ? `$${h.unitPrice.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '2px 10px 2px 0', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                    {h.leadTimeWeeks != null ? `${h.leadTimeWeeks}w` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Alerts */}
      {item.alerts?.length > 0 && (
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Alerts</div>
          {item.alerts.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
              <AlertIcon type={a.type} />
              <span style={{ fontSize: 11, color: a.read ? 'var(--text-dim)' : 'var(--text-muted)', flex: 1 }}>{a.detail}</span>
              {!a.read && (
                <button onClick={() => onMarkRead(item.id, i)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}>
                  <Check size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Links */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Search distributors</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['mouser', 'digikey', 'lcsc'].map(site => (
            <a key={site} href={searchUrl(site)} target="_blank" rel="noopener noreferrer" style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 4,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-muted)', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <ExternalLink size={10} /> {site.charAt(0).toUpperCase() + site.slice(1)}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Alerts Feed ───────────────────────────────────────────────────────────────

function AlertsFeed({ boms, onMarkRead, onMarkAllRead }) {
  const [filter, setFilter] = useState('unread')

  const allAlerts = []
  for (const bom of boms) {
    for (const item of bom.items ?? []) {
      for (let i = 0; i < (item.alerts ?? []).length; i++) {
        const a = item.alerts[i]
        if (filter === 'unread' && a.read) continue
        if (filter !== 'all' && filter !== 'unread' && a.type !== filter) continue
        allAlerts.push({ ...a, bomId: bom.id, bomName: bom.name, itemId: item.id, alertIdx: i, partNumber: item.partNumber })
      }
    }
  }
  allAlerts.sort((a, b) => b.detectedAt - a.detectedAt)

  const filters = ['all', 'unread', 'stock_change', 'price_spike', 'lead_time_increase']

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 20,
                background: filter === f ? 'var(--surface-2)' : 'transparent',
                border: `1px solid ${filter === f ? 'var(--border-bright)' : 'var(--border)'}`,
                color: filter === f ? 'var(--text)' : 'var(--text-dim)',
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
        <button
          onClick={onMarkAllRead}
          style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
        >
          Mark all read
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {allAlerts.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: 'var(--text-dim)' }}>No alerts.</div>
        ) : allAlerts.map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
            <AlertIcon type={a.type} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>
                <span style={{ color: 'var(--text)' }}>{a.bomName}</span>
                {' · '}
                <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{a.partNumber}</span>
              </div>
              <div style={{ fontSize: 12, color: a.read ? 'var(--text-dim)' : 'var(--text-muted)' }}>{a.detail}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                {timeAgo(a.detectedAt)}
              </div>
            </div>
            {!a.read && (
              <button
                onClick={() => onMarkRead(a.bomId, a.itemId, a.alertIdx)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2, flexShrink: 0 }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Import Form ───────────────────────────────────────────────────────────────

function ImportForm({ onImport, onCancel }) {
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState('daily')
  const [email, setEmail] = useState('')
  const [csvText, setCsvText] = useState('')
  const [items, setItems] = useState([])
  const [inputMethod, setInputMethod] = useState('paste')
  const fileRef = useRef(null)

  // Try to load from BOM Intelligence
  const importFromBOM = () => {
    try {
      const raw = localStorage.getItem('enginguity_boms')
      if (!raw) return alert('No BOM Intelligence data found.')
      const boms = JSON.parse(raw)
      if (!boms?.length) return alert('No BOM items in BOM Intelligence.')
      const bomItems = boms.map(item => ({
        id: uuidv4(),
        quantity: item.qty ?? 1,
        partNumber: item.partNumber ?? item.mpn ?? '',
        description: item.description ?? item.value ?? '',
        manufacturer: item.manufacturer ?? '',
        lastStatus: null,
        history: [],
        alerts: [],
      })).filter(i => i.partNumber)
      setItems(bomItems)
      setName('From BOM Intelligence')
    } catch {
      alert('Failed to import from BOM Intelligence.')
    }
  }

  const handleParse = () => {
    setItems(parseCSV(csvText))
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCsvText(ev.target.result)
      setItems(parseCSV(ev.target.result))
    }
    reader.readAsText(file)
  }

  const handleSubmit = () => {
    if (!name.trim()) return alert('Enter a BOM name.')
    if (!items.length) return alert('No valid items found. Paste or upload a CSV.')
    const bom = {
      id: uuidv4(),
      name: name.trim(),
      createdAt: Date.now(),
      lastChecked: null,
      checkFrequency: frequency,
      notifyEmail: email.trim() || null,
      items,
    }
    onImport(bom)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 540, maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--surface)', border: '1px solid var(--border-bright)',
        borderRadius: 12, padding: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 15, color: 'var(--text)', fontWeight: 500 }}>Add monitored BOM</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* BOM name */}
          <div>
            <label style={labelStyle}>BOM name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Motor Controller Rev2"
              style={inputStyle}
            />
          </div>

          {/* Import from BOM Intelligence */}
          <button
            onClick={importFromBOM}
            style={{
              padding: '8px 14px', borderRadius: 6,
              background: 'transparent', border: '1px solid var(--border-bright)',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <PackageSearch size={13} /> Import from BOM Intelligence
          </button>

          {/* Input method */}
          <div>
            <label style={labelStyle}>Or add manually</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {['paste', 'upload'].map(m => (
                <button
                  key={m}
                  onClick={() => setInputMethod(m)}
                  style={{
                    fontSize: 12, padding: '4px 12px', borderRadius: 4,
                    background: inputMethod === m ? 'var(--surface-2)' : 'transparent',
                    border: `1px solid ${inputMethod === m ? 'var(--border-bright)' : 'var(--border)'}`,
                    color: inputMethod === m ? 'var(--text)' : 'var(--text-dim)',
                    cursor: 'pointer', textTransform: 'capitalize',
                  }}
                >
                  {m === 'paste' ? 'Paste CSV' : 'Upload CSV'}
                </button>
              ))}
            </div>

            {inputMethod === 'paste' ? (
              <div>
                <textarea
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder="Paste CSV with headers: part_number, description, manufacturer, quantity"
                  rows={5}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
                />
                <button onClick={handleParse} style={smallBtn}>Parse CSV</button>
              </div>
            ) : (
              <div>
                <input type="file" ref={fileRef} accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
                <button onClick={() => fileRef.current?.click()} style={{ ...smallBtn, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Upload size={11} /> Upload CSV file
                </button>
              </div>
            )}

            {items.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6 }}>
                ✓ {items.length} items loaded
              </div>
            )}
          </div>

          {/* Frequency */}
          <div>
            <label style={labelStyle}>Check frequency</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {['daily', 'weekly'].map(f => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  style={{
                    fontSize: 12, padding: '4px 16px', borderRadius: 4,
                    background: frequency === f ? 'var(--surface-2)' : 'transparent',
                    border: `1px solid ${frequency === f ? 'var(--border-bright)' : 'var(--border)'}`,
                    color: frequency === f ? 'var(--text)' : 'var(--text-dim)',
                    cursor: 'pointer', textTransform: 'capitalize',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Email */}
          <div>
            <label style={labelStyle}>Alert email (optional)</label>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              placeholder="(optional — alerts shown in-app regardless)"
              style={inputStyle}
            />
          </div>

          <button
            onClick={handleSubmit}
            style={{
              padding: '10px', borderRadius: 6,
              background: 'transparent', border: '1px solid var(--accent)',
              color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              marginTop: 4,
            }}
          >
            Start Monitoring
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle = { fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }
const inputStyle = {
  width: '100%', fontSize: 13, padding: '8px 10px',
  background: 'var(--bg-2)', border: '1px solid var(--border)',
  borderRadius: 5, color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
}
const smallBtn = {
  fontSize: 11, padding: '5px 12px', borderRadius: 4,
  background: 'transparent', border: '1px solid var(--border)',
  color: 'var(--text-muted)', cursor: 'pointer',
}

// ── Main Component ────────────────────────────────────────────────────────────

export function SupplyChainMonitor() {
  const [boms, setBOMs] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [checkingId, setCheckingId] = useState(null)
  const [checkProgress, setCheckProgress] = useState('')
  const [showImport, setShowImport] = useState(false)
  const { makeRequest, isConnected } = useAIProvider()

  const load = useCallback(() => {
    setBOMs(getMonitoredBOMs())
  }, [])

  useEffect(() => { load() }, [load])

  // Background check on mount
  useEffect(() => {
    const pending = getMonitoredBOMs().filter(shouldCheck)
    if (!pending.length || !isConnected) return
    let i = 0
    const run = async () => {
      if (i >= pending.length) return
      const bom = pending[i++]
      setCheckingId(bom.id)
      setCheckProgress('Checking supply chain...')
      try {
        const updated = await checkBOM(bom, makeRequest, setCheckProgress)
        saveBOM(updated)
        load()
      } catch (err) {
        console.error('Supply chain check failed:', err)
        setCheckProgress('Check failed — see console for details.')
        await new Promise((r) => setTimeout(r, 2500))
      }
      setCheckingId(null)
      setCheckProgress('')
      setTimeout(run, 2000)
    }
    run()
  }, []) // only on mount

  const handleCheck = async (bomId) => {
    if (!isConnected) return alert('Connect OpenRouter or Ollama in AI Settings to check supply chain.')
    const bom = getBOMById(bomId)
    if (!bom) return
    setCheckingId(bomId)
    setCheckProgress('Starting check...')
    try {
      const updated = await checkBOM(bom, makeRequest, setCheckProgress)
      saveBOM(updated)
      load()
    } catch (e) {
      alert('Check failed: ' + e.message)
    }
    setCheckingId(null)
    setCheckProgress('')
  }

  const handleDelete = (bomId) => {
    if (!confirm('Delete this monitored BOM?')) return
    deleteBOM(bomId)
    if (selectedId === bomId) setSelectedId(null)
    load()
  }

  const handleImport = (bom) => {
    saveBOM(bom)
    setShowImport(false)
    setSelectedId(bom.id)
    load()
  }

  const handleMarkAlertRead = (bomId, itemId, alertIdx) => {
    const bom = getBOMById(bomId)
    if (!bom) return
    const item = bom.items.find(i => i.id === itemId)
    if (!item) return
    item.alerts[alertIdx] = { ...item.alerts[alertIdx], read: true }
    saveBOM(bom)
    load()
  }

  const handleMarkItemAlertRead = (itemId, alertIdx) => {
    if (!selectedId) return
    handleMarkAlertRead(selectedId, itemId, alertIdx)
  }

  const handleMarkAllRead = () => {
    for (const bom of boms) {
      let changed = false
      for (const item of bom.items ?? []) {
        for (const a of item.alerts ?? []) {
          if (!a.read) { a.read = true; changed = true }
        }
      }
      if (changed) saveBOM(bom)
    }
    load()
  }

  const selectedBOM = boms.find(b => b.id === selectedId)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Module header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>Supply Chain Monitor</span>
          {checkProgress && (
            <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 12 }}>{checkProgress}</span>
          )}
        </div>
        <button
          onClick={() => setShowImport(true)}
          style={{
            fontSize: 12, padding: '6px 14px', borderRadius: 5,
            background: 'transparent', border: '1px solid var(--accent)',
            color: 'var(--accent)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <Plus size={13} /> Add BOM
        </button>
      </div>

      <DisclaimerBanner />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {/* BOM cards */}
        <div style={{ padding: '14px 20px 0', flexShrink: 0, maxHeight: '40%', overflowY: 'auto' }}>
          {boms.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-dim)', padding: '20px 0' }}>
              No monitored BOMs yet. Click "Add BOM" to get started.
            </div>
          ) : boms.map(bom => (
            <BOMCard
              key={bom.id}
              bom={bom}
              selected={selectedId === bom.id}
              onSelect={setSelectedId}
              onCheck={handleCheck}
              onDelete={handleDelete}
              checking={checkingId === bom.id}
            />
          ))}
        </div>

        {/* Selected BOM detail */}
        {selectedBOM && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)' }}>
            <div style={{ padding: '10px 20px 8px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{selectedBOM.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 10 }}>
                {selectedBOM.items.length} items
              </span>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <ItemsTable items={selectedBOM.items} onMarkAlertsRead={handleMarkItemAlertRead} />
            </div>
          </div>
        )}

        {/* Alerts feed */}
        {boms.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', height: 240, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '8px 16px 0', flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Alerts</span>
            </div>
            <AlertsFeed
              boms={boms}
              onMarkRead={(bomId, itemId, alertIdx) => handleMarkAlertRead(bomId, itemId, alertIdx)}
              onMarkAllRead={handleMarkAllRead}
            />
          </div>
        )}
      </div>

      {showImport && <ImportForm onImport={handleImport} onCancel={() => setShowImport(false)} />}
    </div>
  )
}
