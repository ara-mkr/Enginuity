// Unit-aware numeric input with engineering-notation parsing ("4.7k", "100n",
// "2.2meg" — M/meg is always mega, m is always milli; the tooltip spells the
// convention out so it's never ambiguous). Commits on Enter/blur, reverts on
// Esc, and rejects physically invalid values inline.

import { useState } from 'react'
import type { ParamDef } from '../componentDefs'
import { ENG_NOTATION_HINT, formatEngNotation, parseEngNotation } from '../core/engNotation'

interface Props {
  def: ParamDef
  value: number
  onCommit: (value: number) => void
}

export function ParameterField({ def, value, onCommit }: Props) {
  const [text, setText] = useState(() => formatEngNotation(value))
  const [error, setError] = useState<string | null>(null)

  // Re-sync the draft text when the committed value changes (render-time reset).
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setText(formatEngNotation(value))
    setError(null)
  }

  const validate = (v: number): string | null => {
    if (def.min !== undefined && v < def.min) return `${def.label} cannot be negative`
    if (def.zeroInvalid && v === 0) return `${def.label} must be nonzero`
    return null
  }

  const commit = () => {
    const parsed = parseEngNotation(text)
    if (parsed === null) {
      setError('Not a valid value — try 4.7k, 100n, 2.2meg')
      return
    }
    const problem = validate(parsed)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    if (parsed !== value) onCommit(parsed)
    else setText(formatEngNotation(value))
  }

  const revert = () => {
    setText(formatEngNotation(value))
    setError(null)
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <label
        style={{
          display: 'block',
          fontFamily: "var(--font-family-ui, 'Geist', sans-serif)",
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          marginBottom: 4,
        }}
      >
        {def.label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          value={text}
          title={ENG_NOTATION_HINT}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              e.stopPropagation()
              revert()
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            boxSizing: 'border-box',
            background: 'var(--color-bg)',
            border: `1px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
            borderRadius: 6,
            color: 'var(--color-text-primary)',
            fontFamily: "var(--font-family-mono, 'Geist Mono', monospace)",
            fontSize: 12,
            padding: '6px 8px',
            outline: 'none',
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-family-mono, 'Geist Mono', monospace)",
            fontSize: 11,
            color: 'var(--color-text-muted)',
            minWidth: 18,
          }}
        >
          {def.unit}
        </span>
      </div>
      {error && (
        <div
          style={{
            marginTop: 4,
            fontFamily: "var(--font-family-ui, 'Geist', sans-serif)",
            fontSize: 10.5,
            color: 'var(--color-danger)',
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
