import React, { useState, useMemo } from 'react'
import { ArrowUpDown, Trash2, Plus, Merge, FileText, Search } from 'lucide-react'
import type { BOMItem } from './types'
import { logEvent } from '../../engine/eventLog'

interface Props {
  items: BOMItem[]
  onUpdateItems: (items: BOMItem[]) => void
  onFindAlternatives: (item: BOMItem) => void
}

type SortField = 'quantity' | 'part_number' | 'description' | 'manufacturer' | 'value' | 'package' | 'unitPrice' | 'extendedPrice' | 'stockStatus'
type GroupField = 'none' | 'manufacturer' | 'package' | 'value'

export function BOMTable({ items, onUpdateItems, onFindAlternatives }: Props) {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [groupBy, setGroupBy] = useState<GroupField>('none')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Editing state
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof BOMItem } | null>(null)
  const [editingValue, setEditingValue] = useState('')

  // Handle cell edit commit
  const commitEdit = (id: string, field: keyof BOMItem) => {
    if (!editingCell) return
    const itemToEdit = items.find((item) => item.id === id)
    if (!itemToEdit) return
    const oldValue = itemToEdit[field]
    if (String(oldValue) === editingValue) {
      setEditingCell(null)
      return
    }

    const updated = items.map((item) => {
      if (item.id === id) {
        let val: any = editingValue
        if (field === 'quantity') {
          val = parseInt(editingValue) || 1
        } else if (field === 'unitPrice') {
          val = parseFloat(editingValue) || null
        }
        
        const newItem = { ...item, [field]: val }
        // Re-calculate extended price
        if (field === 'quantity' || field === 'unitPrice') {
          newItem.extendedPrice = (newItem.quantity || 0) * (newItem.unitPrice ?? 0)
        }
        return newItem
      }
      return item
    })
    onUpdateItems(updated)
    setEditingCell(null)

    logEvent('BOM_UPDATED', {
      action: 'edit',
      partNumber: itemToEdit.part_number,
      field,
      oldValue,
      newValue: editingValue,
      module: 'bom'
    })
  }

  // Handle cell click to start edit
  const startEdit = (item: BOMItem, field: keyof BOMItem) => {
    setEditingCell({ id: item.id, field })
    setEditingValue(String(item[field] ?? ''))
  }

  // Delete row
  const deleteRow = (id: string) => {
    const itemToDelete = items.find((item) => item.id === id)
    const updated = items.filter((item) => item.id !== id)
    onUpdateItems(updated)
    const newSelected = new Set(selectedIds)
    newSelected.delete(id)
    setSelectedIds(newSelected)

    if (itemToDelete) {
      logEvent('BOM_UPDATED', {
        action: 'delete',
        partNumber: itemToDelete.part_number,
        description: itemToDelete.description,
        module: 'bom'
      })
    }
  }

  // Add empty row
  const addRow = () => {
    const newRow: BOMItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      quantity: 1,
      part_number: '',
      description: 'New Component',
      manufacturer: '',
      value: '',
      package: '',
      reference_designators: '',
      unitPrice: null,
      extendedPrice: null,
      stockStatus: 'unknown',
      leadTimeWeeks: null,
      altAvailable: null,
    }
    onUpdateItems([...items, newRow])

    logEvent('BOM_UPDATED', {
      action: 'add',
      module: 'bom'
    })
  }

  // Sort helper
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  // Toggle selection
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const toggleSelectAll = (visibleItems: BOMItem[]) => {
    if (selectedIds.size >= visibleItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visibleItems.map(item => item.id)))
    }
  }

  // Merge selected rows
  const mergeSelected = () => {
    if (selectedIds.size < 2) return

    const selectedItems = items.filter(item => selectedIds.has(item.id))
    const first = selectedItems[0]

    // Validate that they have similar characteristics (matching part number or value)
    const matchVal = first.part_number || first.value || ''
    const isValid = selectedItems.every(item => (item.part_number || item.value || '') === matchVal)

    if (!isValid) {
      alert('Selected components must have the same Part Number or Value to merge.')
      return
    }

    // Merge quantities and references
    const totalQty = selectedItems.reduce((sum, item) => sum + item.quantity, 0)
    const refsList = selectedItems
      .flatMap(item => (item.reference_designators ? item.reference_designators.split(', ') : []))
      .filter((v, i, self) => self.indexOf(v) === i) // Deduplicate
      .join(', ')

    // Replace the first item with merged values and remove the rest
    const updated = items.map((item) => {
      if (item.id === first.id) {
        return {
          ...item,
          quantity: totalQty,
          reference_designators: refsList || null,
          extendedPrice: totalQty * (item.unitPrice ?? 0),
        }
      }
      return item
    }).filter(item => !selectedIds.has(item.id) || item.id === first.id)

    onUpdateItems(updated)
    setSelectedIds(new Set())

    logEvent('BOM_UPDATED', {
      action: 'merge',
      partNumber: first.part_number,
      count: selectedItems.length,
      module: 'bom'
    })
  }

  // Filter and sort items
  const processedItems = useMemo(() => {
    let result = [...items]

    // Search filter
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (item) =>
          (item.part_number || '').toLowerCase().includes(q) ||
          (item.description || '').toLowerCase().includes(q) ||
          (item.manufacturer || '').toLowerCase().includes(q) ||
          (item.value || '').toLowerCase().includes(q) ||
          (item.package || '').toLowerCase().includes(q) ||
          (item.reference_designators || '').toLowerCase().includes(q)
      )
    }

    // Sort
    if (sortField) {
      result.sort((a, b) => {
        let va = a[sortField] ?? ''
        let vb = b[sortField] ?? ''

        if (typeof va === 'string') va = va.toLowerCase()
        if (typeof vb === 'string') vb = vb.toLowerCase()

        if (va < vb) return sortAsc ? -1 : 1
        if (va > vb) return sortAsc ? 1 : -1
        return 0
      })
    }

    return result
  }, [items, search, sortField, sortAsc])

  // Group items
  const groupedItems = useMemo(() => {
    if (groupBy === 'none') return null

    const map: Record<string, BOMItem[]> = {}
    processedItems.forEach((item) => {
      let key = 'Unspecified'
      if (groupBy === 'manufacturer' && item.manufacturer) key = item.manufacturer
      if (groupBy === 'package' && item.package) key = item.package
      if (groupBy === 'value' && item.value) key = item.value

      if (!map[key]) map[key] = []
      map[key].push(item)
    })

    return map
  }, [processedItems, groupBy])

  // Export current table state as CSV
  const exportCSV = () => {
    const headers = ['Quantity', 'Part Number', 'Description', 'Manufacturer', 'Value', 'Package', 'Refs', 'Unit Price', 'Extended Price', 'Stock']
    const rows = processedItems.map((item) => [
      item.quantity,
      item.part_number || '',
      item.description,
      item.manufacturer || '',
      item.value || '',
      item.package || '',
      item.reference_designators || '',
      item.unitPrice ?? '',
      item.extendedPrice ?? '',
      item.stockStatus || 'unknown',
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n')
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', 'enginguity_bom.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Helper for stock dot color
  const getStockDot = (status: BOMItem['stockStatus']) => {
    if (status === 'in_stock') return <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7aaa8a', display: 'inline-block' }} title="In Stock" />
    if (status === 'limited') return <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#b09470', display: 'inline-block' }} title="Limited Stock" />
    if (status === 'out_of_stock') return <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#b08080', display: 'inline-block' }} title="Out of Stock" />
    return <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6b6d85', display: 'inline-block' }} title="Unknown Status" />
  }

  // Render standard table row
  const renderRow = (item: BOMItem, index: number) => {
    const isSelected = selectedIds.has(item.id)
    return (
      <tr
        key={item.id}
        style={{
          borderBottom: '1px solid var(--border)',
          background: isSelected ? 'rgba(0,200,255,0.03)' : 'transparent',
          transition: 'background 0.1s',
        }}
        className="group"
      >
        <td style={{ ...tdStyle, width: 40, textAlign: 'center' }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(item.id)}
            style={{ cursor: 'pointer' }}
          />
        </td>
        <td style={{ ...tdStyle, width: 40, color: 'var(--text-muted)' }}>{index + 1}</td>
        
        {/* Editable fields */}
        {['quantity', 'part_number', 'description', 'manufacturer', 'value', 'package', 'reference_designators'].map((col) => {
          const field = col as keyof BOMItem
          const isEditing = editingCell?.id === item.id && editingCell?.field === field
          const val = item[field] ?? ''
          return (
            <td
              key={col}
              style={{
                ...tdStyle,
                fontFamily: ['quantity', 'part_number', 'value', 'package', 'reference_designators'].includes(col) ? "'JetBrains Mono', monospace" : 'inherit',
                cursor: 'pointer',
                background: isEditing ? 'rgba(0,200,255,0.06)' : 'transparent',
              }}
              onClick={() => startEdit(item, field)}
            >
              {isEditing ? (
                <input
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={() => commitEdit(item.id, field)}
                  onKeyDown={(e) => e.key === 'Enter' && commitEdit(item.id, field)}
                  autoFocus
                  style={{
                    width: '100%',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    border: '1px solid var(--accent)',
                    outline: 'none',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: 'inherit',
                  }}
                />
              ) : (
                <span className="block truncate max-w-[150px]" title={String(val)}>
                  {String(val) || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>—</span>}
                </span>
              )}
            </td>
          )
        })}

        {/* Pricing / Stock fields (updated from API) */}
        <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)' }}>
          {item.unitPrice != null ? `$${item.unitPrice.toFixed(4)}` : '—'}
        </td>
        <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace", color: '#7aaa8a', fontWeight: 600 }}>
          {item.extendedPrice != null ? `$${item.extendedPrice.toFixed(2)}` : '—'}
        </td>
        <td style={{ ...tdStyle, textAlign: 'center', width: 80 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {getStockDot(item.stockStatus)}
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {(item.stockStatus || 'unknown').replace('_', ' ')}
            </span>
          </div>
        </td>
        <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)', width: 80 }}>
          {item.leadTimeWeeks != null ? `${item.leadTimeWeeks} wks` : '—'}
        </td>
        
        {/* Actions */}
        <td style={{ ...tdStyle, width: 120 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => onFindAlternatives(item)}
              className="btn"
              disabled={!item.part_number && !item.value}
              style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4 }}
            >
              Alt
            </button>
            <button
              onClick={() => deleteRow(item.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-red-400"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}
              title="Delete row"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filters Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 260 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search BOM items…"
              style={{ paddingLeft: 32, width: '100%', fontSize: 12 }}
            />
          </div>
          
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupField)}
            className="input"
            style={{ width: 140, fontSize: 12, padding: '6px 10px' }}
          >
            <option value="none">No Grouping</option>
            <option value="manufacturer">Group by Mfr</option>
            <option value="package">Group by Package</option>
            <option value="value">Group by Value</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {selectedIds.size >= 2 && (
            <button
              className="btn"
              onClick={mergeSelected}
              style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, background: 'rgba(0,200,255,0.08)', color: 'var(--accent)', borderColor: 'rgba(0,200,255,0.2)' }}
            >
              <Merge size={13} /> Merge Selected ({selectedIds.size})
            </button>
          )}
          <button
            className="btn"
            onClick={exportCSV}
            style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}
          >
            <FileText size={13} /> Export CSV
          </button>
          <button
            className="btn"
            onClick={addRow}
            style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, background: 'var(--accent)', color: 'var(--bg)', borderColor: 'transparent' }}
          >
            <Plus size={13} /> Add Row
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ ...thStyle, width: 40, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={processedItems.length > 0 && selectedIds.size >= processedItems.length}
                  onChange={() => toggleSelectAll(processedItems)}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ ...thStyle, width: 40 }}>#</th>
              {[
                { field: 'quantity', label: 'Qty' },
                { field: 'part_number', label: 'Part Number' },
                { field: 'description', label: 'Description' },
                { field: 'manufacturer', label: 'Manufacturer' },
                { field: 'value', label: 'Value' },
                { field: 'package', label: 'Package' },
                { field: 'reference_designators', label: 'Refs' },
                { field: 'unitPrice', label: 'Unit Price' },
                { field: 'extendedPrice', label: 'Ext Price' },
                { field: 'stockStatus', label: 'Stock' },
                { field: 'leadTimeWeeks', label: 'Lead Time' },
              ].map((col) => (
                <th
                  key={col.field}
                  onClick={() => handleSort(col.field as SortField)}
                  style={{
                    ...thStyle,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {col.label}
                    <ArrowUpDown size={11} style={{ color: sortField === col.field ? 'var(--accent)' : 'var(--text-dim)' }} />
                  </div>
                </th>
              ))}
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {processedItems.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                  No items in Bill of Materials. Upload a file or copy-paste list above.
                </td>
              </tr>
            ) : groupBy === 'none' ? (
              processedItems.map((item, idx) => renderRow(item, idx))
            ) : (
              // Grouped Render
              Object.entries(groupedItems || {}).map(([groupName, groupList]) => (
                <optgroup key={groupName} label={groupName}>
                  <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
                    <td colSpan={14} style={{ padding: '8px 16px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: 'var(--accent)' }}>
                      <span style={{ color: '#b8d4f0' }}>⊡</span> {groupBy.toUpperCase()}: {groupName} ({groupList.length} items)
                    </td>
                  </tr>
                  {groupList.map((item, idx) => renderRow(item, idx))}
                </optgroup>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 10,
  textAlign: 'left',
  padding: '12px 14px',
  color: 'var(--text-muted)',
  
  
  whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  fontSize: 12,
  padding: '10px 14px',
  color: 'var(--text)',
  verticalAlign: 'middle',
}
