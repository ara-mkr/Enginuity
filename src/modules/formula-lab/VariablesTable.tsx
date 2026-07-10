import { useState, useEffect, useRef } from 'react'
import type { Variable } from './types'

interface VariablesTableProps {
  variables: Variable[]
  onChange: (updated: Variable[]) => void
}

export function VariablesTable({ variables, onChange }: VariablesTableProps) {
  // Maintain local state of variables so inputting is lag-free
  const [localVars, setLocalVars] = useState<Variable[]>([])
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  // Sync with incoming props when they change externally
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local editable copy from the controlled variables prop
    setLocalVars(variables)
  }, [variables])

  const handleValueChange = (index: number, rawVal: string) => {
    const updated = [...localVars]
    const parsed = parseFloat(rawVal)
    
    // Update local state immediately so user sees what they type
    updated[index] = {
      ...updated[index],
      value: isNaN(parsed) ? 0 : parsed,
    }
    setLocalVars(updated)

    // Clear existing timer and set new one for 500ms
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      onChange(updated)
    }, 500)
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', margin: 0,   }}>
        Variables & Parameters
      </h3>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, width: '10%' }}>Symbol</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, width: '25%' }}>Name</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, width: '20%' }}>Value</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, width: '15%' }}>Unit</th>
              <th style={{ padding: '10px 16px', fontWeight: 600, width: '30%' }}>Description</th>
            </tr>
          </thead>
          <tbody>
            {localVars.map((v, i) => (
              <tr
                key={v.symbol}
                style={{
                  borderBottom: i === localVars.length - 1 ? 'none' : '1px solid var(--border)',
                  background: 'var(--surface)',
                }}
              >
                {/* Symbol */}
                <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)', fontWeight: 600 }}>
                  {v.symbol}
                </td>
                {/* Name */}
                <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--text)' }}>
                  {v.name}
                </td>
                {/* Value Input */}
                <td style={{ padding: '8px 16px' }}>
                  <input
                    type="number"
                    value={v.value}
                    onChange={(e) => handleValueChange(i, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </td>
                {/* Unit */}
                <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                  {v.unit || '—'}
                </td>
                {/* Description */}
                <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.4 }}>
                  {v.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
