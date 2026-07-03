import { useState, useEffect } from 'react'
import { Search, ArrowRight, Loader2, Sparkles, AlertTriangle, BookOpen, Hash } from 'lucide-react'
import { useAIProvider } from '../../hooks/useAIProvider'
// @ts-ignore
import { useEnginguityStore } from '../../engine/persistenceEngine'
// @ts-ignore
import { FORMULA_LIBRARY } from '../../config/formulaLibrary'
import { FormulaCard, Latex } from './FormulaCard'
import { VariablesTable } from './VariablesTable'
import { ConstantsPanel } from './ConstantsPanel'
import { UnitConverter } from './UnitConverter'
import type { FormulaCalculation, Variable, FormulaLibraryItem } from './types'

const PLACEHOLDERS = [
  'torque to lift 5kg at 30cm radius at 60 RPM...',
  'convert 47kΩ ±5% to E24 series value...',
  'RC time constant with R=10k and C=100nF...',
  '3-phase power at 480V, 32A, 0.85 power factor...',
]

export function FormulaLab() {
  // Persisted slice — survives navigation/refresh (src/engine/persistenceEngine.js)
  const setFormulaLabState = useEnginguityStore((s: any) => s.setFormulaLabState)
  const persisted = useEnginguityStore.getState().formulaLab

  const [activeTab, setActiveTab] = useState<'calculator' | 'converter'>(persisted.activeTab)
  const [sidebarTab, setSidebarTab] = useState<'library' | 'constants'>(persisted.sidebarTab)

  // Calculator state
  const [query, setQuery] = useState(persisted.query)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calculation, setCalculation] = useState<FormulaCalculation | null>(persisted.calculation)

  // Rotation placeholder
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [placeholderFade, setPlaceholderFade] = useState(true)

  // Library search
  const [librarySearch, setLibrarySearch] = useState(persisted.librarySearch)

  // Emitter values for unit converter
  const [converterValue, setConverterValue] = useState<number | undefined>(undefined)

  const { makeRequest } = useAIProvider()

  // Write-through: mirror calculator/library state into the global store so it
  // survives navigating away and coming back.
  useEffect(() => {
    setFormulaLabState({ activeTab, sidebarTab, query, calculation, librarySearch })
  }, [activeTab, sidebarTab, query, calculation, librarySearch, setFormulaLabState])

  // Inject KaTeX styles and script at runtime
  useEffect(() => {
    if (!document.getElementById('katex-css')) {
      const link = document.createElement('link')
      link.id = 'katex-css'
      link.rel = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.css'
      document.head.appendChild(link)
    }
    if (!(window as any).katex && !document.getElementById('katex-js')) {
      const script = document.createElement('script')
      script.id = 'katex-js'
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.js'
      document.head.appendChild(script)
    }
  }, [])

  // Rotate placeholders every 4 seconds with fade micro-animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderFade(false)
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length)
        setPlaceholderFade(true)
      }, 300)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // Handle AI Submission
  const handleSubmit = async (inputQuery: string) => {
    const trimmed = inputQuery.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    setCalculation(null)

    try {
      const system = `You are an engineering calculation engine. Given the user's input, perform the engineering calculation, analyze its formulas, define the variables, create step-by-step math cards, and return ONLY this JSON structure. Do NOT wrap inside code fences. Do NOT add notes. Return strictly valid raw JSON matching:
{
  "interpreted_as": "string (what you understood the question to be)",
  "formula": "string (LaTeX formula string)",
  "variables": [{"symbol": "string", "name": "string", "value": number, "unit": "string", "description": "string"}],
  "result": { "value": number, "unit": "string", "formatted": "string" },
  "steps": [{"description": "string", "equation": "string", "result": "string"}],
  "related_formulas": [{"name": "string", "formula_latex": "string", "use_case": "string"}],
  "can_make_interactive": boolean,
  "parameter_playground_config": {
    "parameters": [{"name": "string", "label": "string", "min": number, "max": number, "default": number, "unit": "string"}],
    "equations": [{"outputName": "string", "label": "string", "formula_js": "string", "unit": "string"}]
  }
}

Guidelines:
- Return ONLY valid JSON.
- Make sure variables match the symbols in the formula.
- steps represents textbook calculation steps with intermediate formulas and values.
- parameter_playground_config: If can_make_interactive is true, output a parameter playground schema. parameters must map to the variables. equations must use valid JS mathematical expressions (using Math.* if needed) to compute the outputs.`

      const response = await makeRequest([{ role: 'user', content: trimmed }], system, { maxTokens: 4000 })
      
      // Clean potential JSON markdown wrapper
      const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(cleaned) as FormulaCalculation
      setCalculation(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform calculation. Please check your query.')
    } finally {
      setLoading(false)
    }
  }

  // Handle recalculation when variables edit
  const handleVariablesChange = async (updatedVars: Variable[]) => {
    if (!calculation) return
    setLoading(true)
    setError(null)

    try {
      const system = `You are an engineering calculation engine. Re-evaluate the engineering calculation with the modified variables, update the final result and the step-by-step breakdown, and return ONLY this JSON structure. Do NOT add extra texts. Return strictly valid raw JSON matching:
{
  "interpreted_as": "string",
  "formula": "string",
  "variables": [{"symbol": "string", "name": "string", "value": number, "unit": "string", "description": "string"}],
  "result": { "value": number, "unit": "string", "formatted": "string" },
  "steps": [{"description": "string", "equation": "string", "result": "string"}],
  "related_formulas": [{"name": "string", "formula_latex": "string", "use_case": "string"}],
  "can_make_interactive": boolean,
  "parameter_playground_config": {
    "parameters": [{"name": "string", "label": "string", "min": number, "max": number, "default": number, "unit": "string"}],
    "equations": [{"outputName": "string", "label": "string", "formula_js": "string", "unit": "string"}]
  }
}`

      const prompt = `Here is the original calculation interpretation: "${calculation.interpreted_as}".
Please recalculate using these updated variables:
${JSON.stringify(updatedVars, null, 2)}`

      const response = await makeRequest([{ role: 'user', content: prompt }], system, { maxTokens: 4000 })
      const cleaned = response.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const parsed = JSON.parse(cleaned) as FormulaCalculation
      setCalculation(parsed)
    } catch (err) {
      setError('Recalculation failed: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setLoading(false)
    }
  }

  // Constants click selector
  const handleSelectConstant = (val: number) => {
    if (activeTab === 'converter') {
      setConverterValue(val)
    } else {
      setQuery((q) => (q ? `${q} ${val}` : String(val)))
    }
  }

  // Unit converter "Use in Formula" link
  const handleUseInFormula = (convertedText: string) => {
    setActiveTab('calculator')
    setQuery((q) => (q ? `${q} ${convertedText}` : convertedText))
  }

  // Library listing filtering
  const filteredLibrary = FORMULA_LIBRARY.filter(
    (f: FormulaLibraryItem) =>
      f.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
      f.description.toLowerCase().includes(librarySearch.toLowerCase()) ||
      f.category.toLowerCase().includes(librarySearch.toLowerCase())
  )

  const handleOpenLibraryFormula = (formula: FormulaLibraryItem) => {
    setActiveTab('calculator')
    const queryString = `${formula.name} with ${formula.variables.map((v) => `${v.symbol}=${v.value}${v.unit}`).join(', ')}`
    setQuery(queryString)
    handleSubmit(queryString)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', minHeight: 0 }}>
      {/* LEFT - Main Content Panel */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header and Tabs Selection */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <div>
            <h1 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
              Formula Lab
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Calculations, dynamic unit conversions, and parameter setups.
            </p>
          </div>
          
          {/* Main Navigation tabs */}
          <div style={{ display: 'flex', gap: 6, background: 'var(--surface-2)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
            <button
              onClick={() => setActiveTab('calculator')}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: 'none',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                cursor: 'pointer',
                background: activeTab === 'calculator' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'calculator' ? 'var(--bg)' : 'var(--text-muted)',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              Calculation Solver
            </button>
            <button
              onClick={() => setActiveTab('converter')}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                border: 'none',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                cursor: 'pointer',
                background: activeTab === 'converter' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'converter' ? 'var(--bg)' : 'var(--text-muted)',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
            >
              Unit Converter
            </button>
          </div>
        </div>

        {/* Tab Viewport */}
        {activeTab === 'calculator' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Natural Language Input Bar */}
            <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
              <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                <Search size={18} style={{ position: 'absolute', left: 16, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit(query)
                  }}
                  placeholder={PLACEHOLDERS[placeholderIndex]}
                  style={{
                    width: '100%',
                    padding: '14px 16px 14px 48px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: 15,
                    outline: 'none',
                    fontFamily: 'inherit',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
                    transition: 'all 0.3s ease-in-out',
                    opacity: placeholderFade ? 1 : 0.8,
                  }}
                />
              </div>
              <button
                onClick={() => handleSubmit(query)}
                disabled={loading || !query.trim()}
                style={{
                  padding: '0 24px',
                  borderRadius: 10,
                  background: 'var(--accent)',
                  color: 'var(--bg)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontWeight: 600,
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', monospace",
                  opacity: loading || !query.trim() ? 0.5 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                Solve
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  background: 'rgba(255,80,80,0.1)',
                  color: '#b08080',
                  borderRadius: 8,
                  fontSize: 13,
                  border: '1px solid rgba(255,80,80,0.2)',
                }}
              >
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Loading Spinner */}
            {loading && !calculation && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 16 }}>
                <Loader2 size={36} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                  Solving equations and loading parameters...
                </span>
              </div>
            )}

            {/* Calculation Results Card */}
            {calculation && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <FormulaCard calculation={calculation} />
                <VariablesTable variables={calculation.variables} onChange={handleVariablesChange} />
                
                {/* Related Formulas chips horizontal row */}
                {calculation.related_formulas && calculation.related_formulas.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                    <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)',   }}>
                      Related Formulas
                    </span>
                    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'thin' }}>
                      {calculation.related_formulas.map((rf, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setQuery(rf.name)
                            handleSubmit(rf.name)
                          }}
                          style={{
                            padding: '8px 16px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 20,
                            cursor: 'pointer',
                            fontSize: 12,
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            position: 'relative',
                          }}
                          title={`Click to solve: ${rf.use_case}`}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent)'
                            e.currentTarget.style.background = 'var(--accent-glow)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border)'
                            e.currentTarget.style.background = 'var(--surface)'
                          }}
                        >
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{rf.name}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            <Latex math={rf.formula_latex} />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {!calculation && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 16 }}>
                <div style={{ width: 56, height: 56, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <Sparkles size={24} />
                </div>
                <div style={{ textAlign: 'center', maxWidth: 360 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>
                    Solve Engineering Calculations
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                    Type your physics problem or formula queries in natural language above. The solver parses constraints, loads math details, and shows step-by-step textbook equations.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <UnitConverter onUseInFormula={handleUseInFormula} insertedValue={converterValue} />
        )}
      </div>

      {/* RIGHT - Sidebar Panel (Library & Constants) */}
      <div
        style={{
          width: 320,
          borderLeft: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {/* Sidebar tab selectors */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <button
            onClick={() => setSidebarTab('library')}
            style={{
              flex: 1,
              padding: '12px 0',
              border: 'none',
              background: 'none',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              color: sidebarTab === 'library' ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: `2px solid ${sidebarTab === 'library' ? 'var(--accent)' : 'transparent'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <BookOpen size={12} />
            Library
          </button>
          <button
            onClick={() => setSidebarTab('constants')}
            style={{
              flex: 1,
              padding: '12px 0',
              border: 'none',
              background: 'none',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              color: sidebarTab === 'constants' ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: `2px solid ${sidebarTab === 'constants' ? 'var(--accent)' : 'transparent'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Hash size={12} />
            Constants
          </button>
        </div>

        {/* Sidebar Viewport */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sidebarTab === 'library' ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>
                  Formula Library
                </h2>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                  Pre-built templates. Click to load in solver.
                </p>
              </div>

              {/* Library search */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Search library..."
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 32px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Library listing grouped by category */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(Array.from(new Set(filteredLibrary.map((item: FormulaLibraryItem) => item.category))) as string[]).map((cat) => (
                  <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)',   borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
                      {cat}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {filteredLibrary
                        .filter((item: FormulaLibraryItem) => item.category === cat)
                        .map((formula: FormulaLibraryItem) => (
                          <div
                            key={formula.name}
                            onClick={() => handleOpenLibraryFormula(formula)}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 8,
                              background: 'var(--surface-2)',
                              border: '1px solid var(--border)',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'var(--accent)'
                              e.currentTarget.style.background = 'var(--accent-glow)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border)'
                              e.currentTarget.style.background = 'var(--surface-2)'
                            }}
                          >
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                              {formula.name}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3 }}>
                              {formula.description}
                            </span>
                            <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4, overflowX: 'auto' }}>
                              <Latex math={formula.formula_latex} />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
                {filteredLibrary.length === 0 && (
                  <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', padding: '20px 0' }}>
                    No formulas found.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <ConstantsPanel onSelectConstant={handleSelectConstant} />
          )}
        </div>
      </div>
    </div>
  )
}

export default FormulaLab
