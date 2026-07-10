import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, Sliders } from 'lucide-react'
import type { FormulaCalculation } from './types'

// KaTeX (CDN-loaded global) and un-normalized parameter_playground_config
// equation/parameter shapes are untyped here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormulaAny = any

// Helper component to render KaTeX formula safely
export function Latex({ math, block = false }: { math: string; block?: boolean }) {
  const containerRef = useRef<HTMLSpanElement>(null)
  
  // Re-run render when math changes or when window.katex becomes available
  useEffect(() => {
    if (!containerRef.current) return
    
    let rendered = false
    const tryRender = () => {
      const container = containerRef.current
      if (!container) return
      if ((window as FormulaAny).katex) {
        try {
          (window as FormulaAny).katex.render(math, container, {
            throwOnError: false,
            displayMode: block,
          })
          rendered = true
        } catch {
          container.textContent = math
        }
      } else {
        container.textContent = math
      }
    }

    tryRender()

    // If not rendered yet because katex is loading, poll briefly
    if (!rendered && !(window as FormulaAny).katex) {
      const interval = setInterval(() => {
        if ((window as FormulaAny).katex) {
          tryRender()
          clearInterval(interval)
        }
      }, 200)
      return () => clearInterval(interval)
    }
  }, [math, block])

  return <span ref={containerRef} className="katex-container" />
}

const CHART_COLORS = [
  '#7ab4c4', '#60a5fa', '#b09060', '#b07888', '#a78bfa', '#7aaa8a',
]

interface FormulaCardProps {
  calculation: FormulaCalculation
}

export function FormulaCard({ calculation }: FormulaCardProps) {
  const navigate = useNavigate()
  const [stepsOpen, setStepsOpen] = useState(true)

  const handleOpenPlayground = () => {
    const config = calculation.parameter_playground_config
    if (!config) return

    // Map formula_js to formula for PlaygroundSchema
    const schema = {
      parameters: config.parameters,
      equations: config.equations.map((eq: FormulaAny, idx: number) => ({
        outputName: eq.outputName,
        label: eq.label,
        formula: eq.formula_js,
        unit: eq.unit,
        color: eq.color || CHART_COLORS[idx % CHART_COLORS.length],
      })),
    }

    const defaultValues: Record<string, number> = {}
    config.parameters.forEach((p: FormulaAny) => {
      defaultValues[p.name] = p.default
    })

    const sweep = config.parameters[0]?.name || ''
    const payload = JSON.stringify({ schema, values: defaultValues, sweep })
    const encoded = btoa(encodeURIComponent(payload))
    navigate(`/parameter-playground?playground=${encoded}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* LaTeX formula display card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '24px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          position: 'relative',
          minHeight: 180,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 14,
            left: 20,
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--text-muted)',
            
            
          }}
        >
          Formula
        </span>

        {/* KaTeX Centered Formula */}
        <div
          style={{
            fontSize: 24,
            color: 'var(--accent)',
            padding: '20px 0 10px',
            textAlign: 'center',
            width: '100%',
            overflowX: 'auto',
          }}
        >
          <Latex math={calculation.formula} block={true} />
        </div>

        {/* Interpreted As */}
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', maxWidth: '80%' }}>
          Interpreted as: <strong style={{ color: 'var(--text)' }}>{calculation.interpreted_as}</strong>
        </div>
      </div>

      {/* Answer and Playground Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '24px 32px',
          flexWrap: 'wrap',
          gap: 20,
        }}
      >
        <div>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)',   }}>
            Calculated Result
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 4 }}>
            <span style={{ fontSize: 44, fontWeight: 400, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)', lineHeight: 1 }}>
              {calculation.result.value.toLocaleString(undefined, { maximumFractionDigits: 6 })}
            </span>
            <span style={{ fontSize: 18, color: 'var(--text-muted)', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
              {calculation.result.unit}
            </span>
          </div>
          {calculation.result.formatted && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>
              Formatted: <span style={{ color: 'var(--text)', fontWeight: 500 }}>{calculation.result.formatted}</span>
            </div>
          )}
        </div>

        {/* Playground Integration */}
        {calculation.can_make_interactive && calculation.parameter_playground_config && (
          <button
            onClick={handleOpenPlayground}
            style={{
              padding: '12px 24px',
              borderRadius: 8,
              background: 'var(--accent)',
              color: 'var(--bg)',
              border: 'none',
              fontWeight: 700,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(148, 163, 184, 0.3)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(148, 163, 184, 0.45)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(148, 163, 184, 0.3)'
            }}
          >
            <Sliders size={15} />
            Open in Playground
          </button>
        )}
      </div>

      {/* Step by Step Breakdown */}
      {calculation.steps && calculation.steps.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <button
            onClick={() => setStepsOpen((o) => !o)}
            style={{
              width: '100%',
              padding: '16px 24px',
              background: 'var(--surface)',
              border: 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              color: 'var(--text)',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",   }}>
              Step-by-step calculation
            </span>
            {stepsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {stepsOpen && (
            <div style={{ padding: '8px 24px 24px 24px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 16, borderTop: '1px solid var(--border)' }}>
              {calculation.steps.map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    paddingBottom: idx === calculation.steps.length - 1 ? 0 : 16,
                    borderBottom: idx === calculation.steps.length - 1 ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)', fontWeight: 600 }}>
                      Step {idx + 1}:
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>
                      {step.description}
                    </span>
                  </div>

                  <div
                    style={{
                      padding: '10px 16px',
                      background: 'var(--surface-2)',
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    <span style={{ fontSize: 14, color: 'var(--text)' }}>
                      <Latex math={step.equation} />
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                      = {step.result}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
