import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { moduleStateStore } from '../../store/moduleState'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Sliders,
  Sparkles,
  Loader2,
  AlertTriangle,
  Share2,
  FileCode2,
  ChevronDown,
  Check,
  RefreshCw,
  Info,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { useAIProvider } from '../../hooks/useAIProvider'
import { useProjectContext } from '../../hooks/useProjectContext'
import { useFocusMode } from '../../context/FocusModeContext'
import { logEvent } from '../../engine/eventLog'
import type { PlaygroundSchema, ParamValues } from './types'
import { evalAll, sweepParameter, exportPython } from './evaluator'

// ─── Constants ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a physics and engineering simulation assistant.
The user will describe a system. You must respond with ONLY a valid JSON object (no markdown, no explanation) matching this exact schema:

{
  "parameters": [
    { "name": "voltage", "label": "Supply Voltage", "min": 0, "max": 24, "default": 12, "unit": "V" }
  ],
  "equations": [
    { "outputName": "current", "label": "Motor Current", "formula": "(voltage - back_emf) / resistance", "unit": "A", "color": "#7ab4c4" }
  ]
}

Rules:
- "name" and "outputName" must be valid JS identifiers (no spaces, no hyphens)
- "formula" must be a valid JS expression using parameter names or previously defined outputNames; you may use Math.sqrt, Math.abs, Math.pow, Math.sin, Math.cos, Math.log, Math.exp
- Include 3-6 parameters and 2-5 equations
- Choose varied, distinct colors for each equation (use hex codes)
- Make ranges realistic and defaults meaningful
- Equations may reference other outputNames (dependency order is resolved automatically)
- Respond with ONLY the JSON object, nothing else`

const CHART_COLORS = [
  '#7ab4c4', '#60a5fa', '#b09060', '#b07888', '#a78bfa', '#7aaa8a',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null): string {
  if (n === null) return '—'
  if (!isFinite(n)) return '∞'
  const abs = Math.abs(n)
  if (abs === 0) return '0'
  if (abs >= 1e6) return `${(n / 1e6).toFixed(3)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(3)}k`
  if (abs >= 100) return n.toFixed(2)
  if (abs >= 10) return n.toFixed(3)
  if (abs >= 1) return n.toFixed(4)
  if (abs >= 0.001) return n.toFixed(5)
  return n.toExponential(3)
}

function encodeState(schema: PlaygroundSchema, values: ParamValues, sweep: string): string {
  const payload = JSON.stringify({ schema, values, sweep })
  return btoa(encodeURIComponent(payload))
}

function decodeState(b64: string): { schema: PlaygroundSchema; values: ParamValues; sweep: string } | null {
  try {
    return JSON.parse(decodeURIComponent(atob(b64)))
  } catch {
    return null
  }
}

function parseSchema(raw: string): PlaygroundSchema | null {
  try {
    // Strip markdown code fences if Claude added them
    const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed.parameters) || !Array.isArray(parsed.equations)) return null
    parsed.equations = parsed.equations.map((eq: PlaygroundSchema['equations'][0], i: number) => ({
      ...eq,
      color: eq.color || CHART_COLORS[i % CHART_COLORS.length],
    }))
    return parsed as PlaygroundSchema
  } catch {
    return null
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SliderRow({
  param,
  value,
  onChange,
  isSweep,
  onSetSweep,
}: {
  param: PlaygroundSchema['parameters'][0]
  value: number
  onChange: (v: number) => void
  isSweep: boolean
  onSetSweep: () => void
}) {
  const pct = ((value - param.min) / (param.max - param.min)) * 100

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono" style={{ color: 'var(--text)' }}>
            {param.label}
          </span>
          <button
            onClick={onSetSweep}
            className="text-xs px-1.5 py-0.5 rounded font-mono border transition-colors"
            style={
              isSweep
                ? { background: 'rgba(0,200,255,0.12)', borderColor: 'var(--accent)', color: 'var(--accent)' }
                : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-muted)' }
            }
            title="Sweep this parameter on the chart X axis"
          >
            {isSweep ? '⟷ sweeping' : '⟷'}
          </button>
        </div>
        <span className="font-mono text-sm tabular-nums" style={{ color: 'var(--accent)' }}>
          {fmt(value)}{' '}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {param.unit}
          </span>
        </span>
      </div>

      <div className="relative flex items-center">
        <input
          type="range"
          className="param-slider"
          min={param.min}
          max={param.max}
          step={(param.max - param.min) / 500}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            background: `linear-gradient(to right, var(--accent) ${pct}%, var(--border) ${pct}%)`,
          }}
        />
      </div>

      <div className="flex justify-between text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
        <span>{param.min} {param.unit}</span>
        <span>{param.max} {param.unit}</span>
      </div>
    </div>
  )
}

function ReadoutCard({ label, value, unit, color }: {
  label: string
  value: number | null
  unit: string
  color: string
}) {
  return (
    <div
      className="flex flex-col gap-1 rounded-xl border p-4"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <span className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span
        className="text-2xl font-bold font-mono tabular-nums leading-none"
        style={{ color: value === null ? 'var(--text-muted)' : color }}
      >
        {fmt(value)}
      </span>
      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
        {unit}
      </span>
    </div>
  )
}

function CustomTooltip({ active, payload, label, sweepUnit }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: number
  sweepUnit?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs font-mono"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <p className="mb-1" style={{ color: 'var(--text-muted)' }}>
        x = {typeof label === 'number' ? fmt(label) : label} {sweepUnit}
      </p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ParameterPlayground() {
  const { makeRequest, isConnected } = useAIProvider()
  const { description: projectDesc } = useProjectContext()
  const { isFocusMode, toggleFocusMode } = useFocusMode()

  const [prompt, setPrompt] = useState('')
  const [schema, setSchema] = useState<PlaygroundSchema | null>(null)
  const [values, setValues] = useState<ParamValues>({})
  const [sweepParam, setSweepParam] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [exported, setExported] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const promptPrefilled = useRef(false)
  const debounceTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const lastParamValuesRef = useRef<Record<string, number>>({})

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimerRef.current).forEach(clearTimeout)
    }
  }, [])

  // Load from URL param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get('playground')
    if (encoded) {
      const decoded = decodeState(encoded)
      if (decoded) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount restore from a shared URL param
        setSchema(decoded.schema)
        setValues(decoded.values)
        setSweepParam(decoded.sweep)
      }
    }
  }, [])

  // Pre-fill from project context (once)
  useEffect(() => {
    if (projectDesc && !promptPrefilled.current) {
      promptPrefilled.current = true
      setPrompt(
        `Based on my project: ${projectDesc.slice(0, 200).trim()}, describe a system to analyze with parameters and equations.`
      )
    }
  }, [projectDesc])

  const outputs = useMemo(
    () => (schema ? evalAll(schema, values) : {}),
    [schema, values]
  )

  useEffect(() => {
    if (!schema) return
    moduleStateStore.publish('playground', { parameters: values, outputs, equations: schema.equations })
  }, [outputs, values, schema])

  const chartData = useMemo(
    () =>
      schema && sweepParam
        ? sweepParameter(schema, values, sweepParam, 120)
        : [],
    [schema, values, sweepParam]
  )

  const sweepDef = schema?.parameters.find((p) => p.name === sweepParam)

  const generate = useCallback(async () => {
    if (!isConnected) { setGenError('No AI provider connected — click "Connect Key" in the banner.'); return }
    if (!prompt.trim()) { setGenError('Describe a system first.'); return }

    setGenerating(true)
    setGenError(null)

    try {
      const raw = await makeRequest(
        [{ role: 'user', content: prompt.trim() }],
        SYSTEM_PROMPT,
        { maxTokens: 2048, stream: false, module: 'parameter-playground' }
      )
      const parsed = parseSchema(raw)

      if (!parsed) throw new Error("Claude returned invalid JSON. Try rephrasing your description.")

      setSchema(parsed)
      const defaultValues: ParamValues = {}
      for (const p of parsed.parameters) defaultValues[p.name] = p.default
      setValues(defaultValues)
      setSweepParam(parsed.parameters[0]?.name ?? '')
      setPromptOpen(false)
      // makeRequest logs the AI_ANALYSIS_RUN event itself
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }, [makeRequest, isConnected, prompt])

  const handleSlider = useCallback((name: string, value: number) => {
    setValues((prev) => {
      const prevVal = prev[name] ?? schema?.parameters.find((p) => p.name === name)?.default ?? 0

      if (lastParamValuesRef.current[name] === undefined) {
        lastParamValuesRef.current[name] = prevVal
      }

      if (debounceTimerRef.current[name]) {
        clearTimeout(debounceTimerRef.current[name])
      }

      debounceTimerRef.current[name] = setTimeout(() => {
        const oldValue = lastParamValuesRef.current[name]
        const unit = schema?.parameters.find((p) => p.name === name)?.unit ?? ''
        logEvent('PARAMETER_CHANGED', {
          paramName: name,
          oldValue,
          newValue: value,
          unit,
          module: 'parameter-playground'
        })
        delete lastParamValuesRef.current[name]
      }, 500)

      return { ...prev, [name]: value }
    })
  }, [schema])

  const share = useCallback(async () => {
    if (!schema) return
    const encoded = encodeState(schema, values, sweepParam)
    const url = `${window.location.origin}${window.location.pathname}?playground=${encoded}`
    try { await navigator.clipboard.writeText(url) } catch { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [schema, values, sweepParam])

  const exportPy = useCallback(() => {
    if (!schema) return
    const code = exportPython(schema, values, sweepParam)
    const blob = new Blob([code], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'parameter_playground.py'
    a.click()
    URL.revokeObjectURL(a.href)
    setExported(true)
    setTimeout(() => setExported(false), 2000)
  }, [schema, values, sweepParam])

  const reset = useCallback(() => {
    setSchema(null)
    setValues({})
    setSweepParam('')
    setGenError(null)
    setPromptOpen(false)
    const url = new URL(window.location.href)
    url.searchParams.delete('playground')
    window.history.replaceState({}, '', url)
  }, [])

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div
        className={`shrink-0 flex items-center justify-between px-6 border-b transition-all duration-200 ${isFocusMode ? 'py-1.5' : 'py-4'}`}
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="module-header">
          <h1 className="text-lg font-bold font-mono tracking-wide" style={{ color: 'var(--text)' }}>
            Parameter Playground
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Describe any system → live sliders + equations + chart
          </p>
        </div>

        <div className="flex items-center gap-2">
          {schema && (
            <>
              <button
                onClick={share}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-mono transition-all"
                style={{
                  borderColor: copied ? 'var(--accent)' : 'var(--border)',
                  color: copied ? 'var(--accent)' : 'var(--text-muted)',
                  background: copied ? 'rgba(0,200,255,0.08)' : 'transparent',
                }}
              >
                {copied ? <Check size={12} /> : <Share2 size={12} />}
                {copied ? 'URL Copied!' : 'Share Setup'}
              </button>
              <button
                onClick={exportPy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-mono transition-all"
                style={{
                  borderColor: exported ? 'var(--accent)' : 'var(--border)',
                  color: exported ? 'var(--accent)' : 'var(--text-muted)',
                  background: exported ? 'rgba(0,200,255,0.08)' : 'transparent',
                }}
              >
                {exported ? <Check size={12} /> : <FileCode2 size={12} />}
                {exported ? 'Downloaded!' : 'Export as Python'}
              </button>
              <button
                onClick={reset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border font-mono transition-colors hover:border-red-500/40 hover:text-red-400"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                <RefreshCw size={12} />
                Reset
              </button>
            </>
          )}

          <button
            onClick={toggleFocusMode}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 4,
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
            title={isFocusMode ? "Exit Focus Mode (Esc)" : "Focus Mode (Cmd+Shift+F)"}
          >
            {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Prompt input (shown when no schema, or collapsed in sidebar) */}
      {!schema && (
        <div
          className="shrink-0 px-6 py-5 border-b flex flex-col gap-3"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <label className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            System Description
          </label>
          <textarea
            ref={textareaRef}
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder='"RC car motor with variable voltage and load torque — show current, power, and efficiency"'
            className="w-full resize-none rounded-lg px-3 py-2.5 text-sm font-sans leading-relaxed outline-none border transition-colors"
            style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-2)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate() }}
          />

          {genError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(255,80,80,0.1)', color: '#b08080' }}>
              <AlertTriangle size={13} />
              {genError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={generate}
              disabled={generating || !prompt.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold font-mono transition-all disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              {generating
                ? <><Loader2 size={15} className="animate-spin" /> Generating schema…</>
                : <><Sparkles size={15} /> Generate Parameters</>
              }
            </button>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <kbd className="font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--border)', fontSize: 10 }}>⌘↵</kbd> to submit
            </span>
          </div>
        </div>
      )}

      {/* Main workspace */}
      {schema ? (
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* LEFT — sliders panel */}
          <div
            className="shrink-0 lg:w-72 xl:w-80 flex flex-col border-r overflow-y-auto"
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Collapsed prompt editor */}
            <div
              className="px-4 pt-3 pb-2 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <button
                onClick={() => setPromptOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-mono w-full"
                style={{ color: 'var(--text-muted)' }}
              >
                <Info size={11} className="shrink-0" />
                <span className="flex-1 text-left truncate" style={{ color: 'var(--text)' }}>
                  {prompt.slice(0, 55)}{prompt.length > 55 ? '…' : ''}
                </span>
                <ChevronDown
                  size={12}
                  className="shrink-0 transition-transform"
                  style={{ transform: promptOpen ? 'rotate(180deg)' : 'none' }}
                />
              </button>
              {promptOpen && (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea
                    rows={3}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full resize-none rounded-lg px-2 py-1.5 text-xs font-sans outline-none border transition-colors"
                    style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-2)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                  />
                  {genError && (
                    <div className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg" style={{ background: 'rgba(255,80,80,0.1)', color: '#b08080' }}>
                      <AlertTriangle size={11} />
                      {genError}
                    </div>
                  )}
                  <button
                    onClick={generate}
                    disabled={generating}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all disabled:opacity-40"
                    style={{ background: 'var(--accent)', color: 'var(--bg)' }}
                  >
                    {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {generating ? 'Regenerating…' : 'Regenerate'}
                  </button>
                </div>
              )}
            </div>

            {/* Parameter sliders */}
            <div className="flex-1 flex flex-col gap-5 px-4 py-5">
              <p className="text-xs font-mono uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <Sliders size={11} />
                Parameters
              </p>
              {schema.parameters.map((p) => (
                <SliderRow
                  key={p.name}
                  param={p}
                  value={values[p.name] ?? p.default}
                  onChange={(v) => handleSlider(p.name, v)}
                  isSweep={sweepParam === p.name}
                  onSetSweep={() => setSweepParam(p.name)}
                />
              ))}
            </div>
          </div>

          {/* RIGHT — readouts + chart */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Readout cards */}
            <div
              className="shrink-0 grid gap-3 p-4 border-b"
              style={{
                borderColor: 'var(--border)',
                gridTemplateColumns: `repeat(${Math.min(schema.equations.length, 4)}, minmax(0, 1fr))`,
              }}
            >
              {schema.equations.map((eq) => (
                <ReadoutCard
                  key={eq.outputName}
                  label={eq.label}
                  value={outputs[eq.outputName] ?? null}
                  unit={eq.unit}
                  color={eq.color}
                />
              ))}
            </div>

            {/* Chart */}
            <div className="flex-1 p-5 min-h-0 flex flex-col gap-2">
              {sweepDef && (
                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    X-axis sweep:{' '}
                    <span style={{ color: 'var(--text)' }}>{sweepDef.label}</span>
                    {' '}({sweepDef.unit}){' '}
                    <span className="font-mono" style={{ color: 'var(--text-muted)' }}>
                      [{sweepDef.min} → {sweepDef.max}]
                    </span>
                    {' '}— click <span style={{ color: 'var(--accent)' }}>⟷</span> on any slider to change
                  </p>
                </div>
              )}

              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey={sweepParam}
                      tickFormatter={(v: unknown) => fmt(v as number)}
                      tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={false}
                      label={{
                        value: sweepDef ? `${sweepDef.label} (${sweepDef.unit})` : '',
                        position: 'insideBottom',
                        offset: -2,
                        fill: 'var(--text-muted)',
                        fontSize: 10,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    />
                    <YAxis
                      tickFormatter={(v: unknown) => fmt(v as number)}
                      tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
                      axisLine={{ stroke: 'var(--border)' }}
                      tickLine={false}
                      width={68}
                    />
                    <Tooltip content={<CustomTooltip sweepUnit={sweepDef?.unit} />} />
                    <Legend
                      wrapperStyle={{
                        fontSize: 11,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: 'var(--text-muted)',
                        paddingTop: 8,
                      }}
                    />
                    {schema.equations.map((eq) => (
                      <Line
                        key={eq.outputName}
                        type="monotone"
                        dataKey={eq.outputName}
                        name={eq.label}
                        stroke={eq.color}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty state */
        !generating && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.15)' }}
            >
              <Sliders size={28} style={{ color: 'var(--accent)' }} />
            </div>
            <div className="text-center max-w-sm">
              <p className="text-base font-semibold mb-1" style={{ color: 'var(--text)' }}>
                No system loaded
              </p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Describe any physical, electrical, or mechanical system above and Claude will generate
                live sliders and equations automatically.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-2xl w-full">
              {[
                'RC car motor with variable voltage and load torque',
                'Rocket nozzle with chamber pressure and throat area ratio',
                'RC low-pass filter — cutoff frequency and phase shift',
              ].map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setPrompt(ex); textareaRef.current?.focus() }}
                  className="px-3 py-2.5 rounded-lg border text-left text-xs font-mono leading-relaxed transition-all hover:border-[rgba(0,200,255,0.4)] hover:bg-[rgba(0,200,255,0.04)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  "{ex}"
                </button>
              ))}
            </div>
          </div>
        )
      )}

      {/* Full-page loading overlay */}
      {generating && !schema && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <p className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
            Claude is generating your parameter schema…
          </p>
        </div>
      )}
    </div>
  )
}
