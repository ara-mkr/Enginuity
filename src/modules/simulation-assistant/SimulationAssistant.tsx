import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, Play, Sliders, Download, Copy, ExternalLink,
  AlertTriangle, FileCode2,
  Activity, CheckCircle, RefreshCw
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend
} from 'recharts'
import { useAIProvider } from '../../hooks/useAIProvider'
import { useChartPalette } from '../../hooks/useChartPalette'
import { useProbeContext } from '../../hooks/useProbeContext'
import { logEvent } from '../../engine/eventLog'
// @ts-expect-error - untyped JS module, no .d.ts yet
import { parseCircuitNetlist } from '../circuit-sim/engine/netlistParser'
import { runNetlistAnalysis } from '../circuit-sim/engine/runSimulation'

// ── Types ─────────────────────────────────────────────────────────────────────

// The KaTeX global (loaded from CDN) and the SPICE simulation result/sweep-param
// shapes are genuinely dynamic/external here — one localized disable instead of
// suppressing every call site individually.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SimAny = any

interface Equation {
  label: string
  latex: string
}

interface ComponentAdvice {
  id: string
  name: string
  value: string
  advice: string
}

interface SuggestedSweep {
  name: string
  type: 'transient' | 'ac' | 'dc_sweep' | 'operating_point'
  params: Record<string, SimAny>
}

interface AIResponse {
  netlist: string
  explanation: string
  equations: Equation[]
  components: ComponentAdvice[]
  suggested_sweeps: SuggestedSweep[]
}

const PRESETS = [
  {
    label: 'RC Low-Pass Filter',
    prompt: 'A simple passive RC low-pass filter. Resistor is 1k ohm, capacitor is 100nF. Let V1 be the input source at node "in" with 5V DC and 1V AC. Let C1 connect from node "out" to "0". Use a transient simulation from 0 to 5ms and an AC sweep from 10Hz to 100kHz.'
  },
  {
    label: 'RLC Bandpass Filter',
    prompt: 'A series RLC bandpass filter. V1 connects to "in" and ground "0" with 1V AC. Inductor L1 (10mH) connects "in" to "mid". Resistor R1 (100 ohms) connects "mid" to "out". Capacitor C1 (10nF) connects "out" to ground "0". Configure for AC sweep to find resonant frequency.'
  },
  {
    label: 'Op-Amp Non-Inverting Amp',
    prompt: 'A non-inverting op-amp configuration (using resistor network equivalent for SPICE). Resistors R1=1k from feedback node "fb" to ground, R2=10k from output node "out" to feedback node "fb". Input V1 is 1V DC at node "in". Output node is "out". Analyze the operating point voltages.'
  },
  {
    label: 'Wheatstone Bridge',
    prompt: 'A classic Wheatstone bridge for sensor measurement. R1 (1k) and R2 (1k) form the left arm from Vcc (10V) to ground. R3 (1k) and R4 (1.2k, unbalanced) form the right arm. Measure differential voltage between nodes "left" and "right" using DC Operating Point.'
  }
]

// Helper component to render KaTeX formulas safely
function Latex({ math, block = false }: { math: string; block?: boolean }) {
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    let rendered = false

    const tryRender = () => {
      const container = containerRef.current
      if (!container) return
      if ((window as SimAny).katex) {
        try {
          (window as SimAny).katex.render(math, container, {
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

    if (!rendered && !(window as SimAny).katex) {
      const interval = setInterval(() => {
        if ((window as SimAny).katex) {
          tryRender()
          clearInterval(interval)
        }
      }, 200)
      return () => clearInterval(interval)
    }
  }, [math, block])

  return <span ref={containerRef} className="katex-container" />
}

export function SimulationAssistant() {
  const navigate = useNavigate()
  const { makeRequest, isConnected, activeModel } = useAIProvider()
  const COLORS = useChartPalette()

  // Layout & State
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null)
  const [activeTab, setActiveTab] = useState<'preview' | 'theory'>('preview')

  // Editable SPICE netlist
  const [editedNetlist, setEditedNetlist] = useState('')

  // Simulator configurations
  const [analysisType, setAnalysisType] = useState<'transient' | 'ac' | 'dc_sweep' | 'operating_point'>('transient')
  const [tStop, setTStop] = useState('5m')
  const [tStep, setTStep] = useState('10u')
  const [fStart, setFStart] = useState('10')
  const [fStop, setFStop] = useState('100k')
  const [numPoints, setNumPoints] = useState('100')
  const [dcSource, setDcSource] = useState('V1')
  const [dcStart, setDcStart] = useState('0')
  const [dcStop, setDcStop] = useState('10')
  const [dcStep, setDcStep] = useState('0.1')

  // Simulation execution state
  const [simResult, setSimResult] = useState<SimAny>(null)
  const [simError, setSimError] = useState<string | null>(null)
  const [simulating, setSimulating] = useState(false)

  useProbeContext('simulation-assistant', {
    promptLength: prompt.length,
    hasCircuit: !!aiResponse,
    componentCount: aiResponse?.components.length ?? 0,
    analysisType,
    hasResult: !!simResult,
    simError,
  })

  // Inject KaTeX runtime resources if not present
  useEffect(() => {
    if (!document.getElementById('katex-css')) {
      const link = document.createElement('link')
      link.id = 'katex-css'
      link.rel = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.css'
      document.head.appendChild(link)
    }
    if (!(window as SimAny).katex && !document.getElementById('katex-js')) {
      const script = document.createElement('script')
      script.id = 'katex-js'
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.8/katex.min.js'
      document.head.appendChild(script)
    }
  }, [])

  // Prompt generator using AI provider
  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    setSimResult(null)
    setSimError(null)

    const systemPrompt = `You are an expert SPICE circuit designer and theory adviser.
Given the user's description, draft a high-fidelity circuit, write its SPICE netlist, explain its operating principles in clean Markdown, draft mathematical/physical formulas describing its behaviors using LaTeX notation, and provide component selection details and sweep suggestions.

Return ONLY a valid, raw JSON object matching this schema. Do not enclose it in markdown backticks or fences. Do not output conversational preamble.
{
  "netlist": "* SPICE netlist here...",
  "explanation": "Detailed theoretical and functional explanation of the circuit in markdown format.",
  "equations": [
    { "label": "Cutoff Frequency (or gain, resonance etc.)", "latex": "f_c = \\\\frac{1}{2\\\\pi R C}" }
  ],
  "components": [
    { "id": "R1", "name": "Resistor 1", "value": "1k", "advice": "Determines cutoff frequency. Lower values increase bandwidth but draw more source current." }
  ],
  "suggested_sweeps": [
    {
      "name": "AC Magnitude Sweep",
      "type": "ac",
      "params": { "fStart": "10", "fStop": "100k", "numPoints": "100" }
    }
  ]
}`

    try {
      const response = await makeRequest([{ role: 'user', content: prompt.trim() }], systemPrompt, { maxTokens: 4000 })
      // Strip potential markdown wrappers if returned
      const cleaned = response.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
      const parsed = JSON.parse(cleaned) as AIResponse

      setAiResponse(parsed)
      setEditedNetlist(parsed.netlist)

      // Auto-apply first suggested sweep config if present
      if (parsed.suggested_sweeps && parsed.suggested_sweeps.length > 0) {
        const sweep = parsed.suggested_sweeps[0]
        applySweepPreset(sweep)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred while generating the circuit configuration.')
    } finally {
      setLoading(false)
    }
  }

  // Load preset helper
  const handlePresetSelect = (presetPrompt: string) => {
    setPrompt(presetPrompt)
  }

  // Apply sweep configuration presets
  const applySweepPreset = (sweep: SuggestedSweep) => {
    setAnalysisType(sweep.type)
    const p = sweep.params
    if (sweep.type === 'transient') {
      if (p.tStop) setTStop(p.tStop.toString())
      if (p.tStep) setTStep(p.tStep.toString())
    } else if (sweep.type === 'ac') {
      if (p.fStart) setFStart(p.fStart.toString())
      if (p.fStop) setFStop(p.fStop.toString())
      if (p.numPoints) setNumPoints(p.numPoints.toString())
    } else if (sweep.type === 'dc_sweep') {
      if (p.source) setDcSource(p.source)
      if (p.start) setDcStart(p.start.toString())
      if (p.stop) setDcStop(p.stop.toString())
      if (p.step) setDcStep(p.step.toString())
    }
  }

  // Run MNA simulator locally
  const runLocalSimulation = () => {
    setSimulating(true)
    setSimError(null)
    setSimResult(null)

    try {
      // 1. Build a SPICE netlist string appending the custom configured control sweep line
      const baseNetlistLines = editedNetlist
        .split('\n')
        .filter(line => {
          const l = line.trim().toUpperCase()
          return !l.startsWith('.TRAN') && !l.startsWith('.AC') && !l.startsWith('.DC') && !l.startsWith('.OP') && !l.startsWith('.END')
        })

      let sweepCmd = '.OP'
      if (analysisType === 'transient') {
        sweepCmd = `.TRAN ${tStep} ${tStop}`
      } else if (analysisType === 'ac') {
        sweepCmd = `.AC DEC ${numPoints} ${fStart} ${fStop}`
      } else if (analysisType === 'dc_sweep') {
        sweepCmd = `.DC ${dcSource} ${dcStart} ${dcStop} ${dcStep}`
      }

      const compositeNetlist = [...baseNetlistLines, sweepCmd, '.END'].join('\n')

      // 2. Parse and simulate through the typed MNA engine
      const parsed = parseCircuitNetlist(compositeNetlist)
      if (parsed.components.length === 0) {
        throw new Error('Netlist contains no valid components to simulate. Please review the SPICE syntax.')
      }

      setSimResult(runNetlistAnalysis(parsed))
      logEvent('SIMULATION_RUN', {
        analysisType,
        componentCount: parsed.components.length,
        status: 'success',
        module: 'simulation-assistant',
      })
    } catch (e) {
      setSimError(e instanceof Error ? e.message : 'Error executing local simulation. Check netlist component tags.')
      logEvent('SIMULATION_RUN', {
        analysisType,
        status: 'error',
        error: e instanceof Error ? e.message : 'unknown',
        module: 'simulation-assistant',
      })
    } finally {
      setSimulating(false)
    }
  }

  // Navigation redirect to full circuit simulator
  const handleLoadInCircuitSim = () => {
    if (!editedNetlist) return
    localStorage.setItem('enginguity_sim_netlist', editedNetlist)
    navigate('/circuit-sim')
  }

  // Actions
  const handleCopyNetlist = () => {
    navigator.clipboard.writeText(editedNetlist)
  }

  const handleExportNetlist = () => {
    const blob = new Blob([editedNetlist], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'simulation_assistant.cir'
    a.click()
  }

  // Parse chart data structures
  const getTransientChartData = () => {
    if (!simResult || simResult.type !== 'transient') return []
    const d = simResult.data
    return (d.time ?? []).map((t: number, i: number) => {
      const pt: Record<string, number> = { t: t * 1e3 } // convert to ms for display
      Object.entries(d.voltages ?? {}).forEach(([k, arr]: [string, SimAny]) => {
        pt[k] = arr[i] ?? 0
      })
      return pt
    })
  }

  const getACChartData = () => {
    if (!simResult || simResult.type !== 'ac') return []
    const d = simResult.data
    return (d.frequency ?? []).map((f: number, i: number) => ({
      f,
      db: d.magnitude_db?.[i] ?? 0,
      phase: d.phase_deg?.[i] ?? 0
    }))
  }

  const getDCSweepChartData = () => {
    if (!simResult || simResult.type !== 'dc_sweep') return []
    const d = simResult.data
    return (d.sweepVar ?? []).map((v: number, i: number) => {
      const pt: Record<string, number> = { v }
      Object.entries(d.outputVars ?? {}).forEach(([k, arr]: [string, SimAny]) => {
        pt[k] = arr[i] ?? 0
      })
      return pt
    })
  }

  const transData = getTransientChartData()
  const transKeys = transData.length > 0 ? Object.keys(transData[0]).filter(k => k !== 't') : []

  const acData = getACChartData()

  const dcData = getDCSweepChartData()
  const dcKeys = dcData.length > 0 ? Object.keys(dcData[0]).filter(k => k !== 'v') : []

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#080808]" style={{ color: 'var(--text)' }}>
      {/* Header bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <Activity size={20} color="var(--accent)" />
          <div>
            <h1 className="text-base font-bold font-mono tracking-tight" style={{ color: 'var(--text)' }}>
              Simulation Assistant
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              AI design workspace, mathematical analyzers, and interactive SPICE co-pilot.
            </p>
          </div>
        </div>

        {/* AI Model indicator */}
        {isConnected && activeModel && (
          <div className="flex items-center gap-2 px-3 py-1 rounded bg-[#131313] border border-[#1f1f35] text-xs font-mono text-muted">
            <Sparkles size={12} color="var(--accent)" className="animate-pulse" />
            <span style={{ color: 'var(--text-muted)' }}>Drafting via:</span>
            <span style={{ color: 'var(--accent)' }}>{activeModel}</span>
          </div>
        )}
      </header>

      {/* Main content grid */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        
        {/* LEFT PANEL - Inputs & Presets */}
        <div className="w-[42%] flex flex-col border-r min-h-0 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
          {/* Quick Start Presets */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <span className="text-[10px] font-mono uppercase tracking-wider block mb-2" style={{ color: 'var(--text-dim)' }}>
              Quick Templates
            </span>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePresetSelect(preset.prompt)}
                  className="px-3 py-2 text-left rounded text-xs border bg-[#0e0e0e] hover:bg-[#131313] transition-all font-mono truncate"
                  style={{
                    borderColor: 'var(--border)',
                    color: prompt === preset.prompt ? 'var(--accent)' : 'var(--text-muted)'
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* AI Drafting form */}
          <div className="p-4 border-b flex flex-col gap-3" style={{ borderColor: 'var(--border)' }}>
            <label className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
              Describe Your Circuit Goal
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Design a passive high pass filter with a cutoff of 10kHz using standard E24 components. Add AC sweep parameters."
              rows={4}
              className="w-full p-3 rounded text-sm bg-[#131313] border outline-none font-mono focus:border-[var(--accent)] resize-none transition-all placeholder:text-[#3a3c55]"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text)',
                lineHeight: 1.5
              }}
            />

            {error && (
              <div className="p-3 rounded border border-red-900/40 bg-red-950/20 text-red-400 text-xs flex gap-2 items-start font-mono">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim() || !isConnected}
              className="py-2.5 px-4 rounded text-xs font-mono font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0"
              style={{
                background: prompt.trim() && isConnected ? 'var(--accent)' : 'var(--surface)',
                color: prompt.trim() && isConnected ? '#000' : 'var(--text-dim)',
                boxShadow: prompt.trim() && isConnected ? '0 4px 14px var(--accent-glow)' : 'none'
              }}
            >
              {loading ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  Analyzing & Drafting...
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  Draft Circuit & Netlist
                </>
              )}
            </button>

            {!isConnected && (
              <span className="text-[10px] text-center font-mono text-red-400/80">
                <span style={{ color: '#b8d4f0' }}>△</span> Connect OpenRouter or Ollama in AI Settings to use AI drafting.
              </span>
            )}
          </div>

          {/* Configuration Sweep settings */}
          {aiResponse && (
            <div className="p-4 flex flex-col gap-4">
              <span className="text-[10px] font-mono uppercase tracking-wider block" style={{ color: 'var(--text-dim)' }}>
                Configure Simulator Sweep
              </span>

              {/* suggested sweep list */}
              {aiResponse.suggested_sweeps && aiResponse.suggested_sweeps.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-2">
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>AI Sweeps Recommendations:</span>
                  <div className="flex flex-wrap gap-2">
                    {aiResponse.suggested_sweeps.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => applySweepPreset(s)}
                        className="px-2.5 py-1 text-[10px] rounded bg-[#111111] border border-[#1f1f35] font-mono hover:border-[var(--accent)] transition-all"
                        style={{ color: 'var(--text)' }}
                      >
                        {s.name} ({s.type})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Analysis type picker */}
              <div className="grid grid-cols-4 gap-1 p-0.5 bg-[#0e0e0e] rounded border" style={{ borderColor: 'var(--border)' }}>
                {(['transient', 'ac', 'dc_sweep', 'operating_point'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => { setAnalysisType(type); setSimResult(null); }}
                    className="py-1 px-1.5 text-[9px] font-mono rounded font-bold capitalize transition-all"
                    style={{
                      background: analysisType === type ? 'var(--accent)' : 'transparent',
                      color: analysisType === type ? '#000' : 'var(--text-muted)'
                    }}
                  >
                    {type === 'operating_point' ? 'Op Point' : type === 'dc_sweep' ? 'DC Sweep' : type}
                  </button>
                ))}
              </div>

              {/* Contextual form elements */}
              <div className="grid grid-cols-2 gap-3 bg-[#131313] p-3 rounded border" style={{ borderColor: 'var(--border)' }}>
                {analysisType === 'transient' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-mono text-muted" style={{ color: 'var(--text-muted)' }}>Stop Time (tStop)</label>
                      <input
                        value={tStop}
                        onChange={(e) => setTStop(e.target.value)}
                        className="bg-[#0e0e0e] border border-[#1f1f35] rounded px-2 py-1 text-xs font-mono text-white outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-mono text-muted" style={{ color: 'var(--text-muted)' }}>Step Time (tStep)</label>
                      <input
                        value={tStep}
                        onChange={(e) => setTStep(e.target.value)}
                        className="bg-[#0e0e0e] border border-[#1f1f35] rounded px-2 py-1 text-xs font-mono text-white outline-none"
                      />
                    </div>
                  </>
                )}

                {analysisType === 'ac' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-mono text-muted" style={{ color: 'var(--text-muted)' }}>Start Freq (Hz)</label>
                      <input
                        value={fStart}
                        onChange={(e) => setFStart(e.target.value)}
                        className="bg-[#0e0e0e] border border-[#1f1f35] rounded px-2 py-1 text-xs font-mono text-white outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-mono text-muted" style={{ color: 'var(--text-muted)' }}>Stop Freq (Hz)</label>
                      <input
                        value={fStop}
                        onChange={(e) => setFStop(e.target.value)}
                        className="bg-[#0e0e0e] border border-[#1f1f35] rounded px-2 py-1 text-xs font-mono text-white outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="text-[10px] font-mono text-muted" style={{ color: 'var(--text-muted)' }}>Points per decade</label>
                      <input
                        value={numPoints}
                        onChange={(e) => setNumPoints(e.target.value)}
                        className="bg-[#0e0e0e] border border-[#1f1f35] rounded px-2 py-1 text-xs font-mono text-white outline-none"
                      />
                    </div>
                  </>
                )}

                {analysisType === 'dc_sweep' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-mono text-muted" style={{ color: 'var(--text-muted)' }}>Source Tag</label>
                      <input
                        value={dcSource}
                        onChange={(e) => setDcSource(e.target.value)}
                        placeholder="e.g. V1"
                        className="bg-[#0e0e0e] border border-[#1f1f35] rounded px-2 py-1 text-xs font-mono text-white outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-mono text-muted" style={{ color: 'var(--text-muted)' }}>Step size (V)</label>
                      <input
                        value={dcStep}
                        onChange={(e) => setDcStep(e.target.value)}
                        className="bg-[#0e0e0e] border border-[#1f1f35] rounded px-2 py-1 text-xs font-mono text-white outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-mono text-muted" style={{ color: 'var(--text-muted)' }}>Start Volt (V)</label>
                      <input
                        value={dcStart}
                        onChange={(e) => setDcStart(e.target.value)}
                        className="bg-[#0e0e0e] border border-[#1f1f35] rounded px-2 py-1 text-xs font-mono text-white outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-mono text-muted" style={{ color: 'var(--text-muted)' }}>Stop Volt (V)</label>
                      <input
                        value={dcStop}
                        onChange={(e) => setDcStop(e.target.value)}
                        className="bg-[#0e0e0e] border border-[#1f1f35] rounded px-2 py-1 text-xs font-mono text-white outline-none"
                      />
                    </div>
                  </>
                )}

                {analysisType === 'operating_point' && (
                  <div className="col-span-2 text-center text-xs py-4 text-muted" style={{ color: 'var(--text-muted)' }}>
                    DC Nodal analysis requires no additional frequency or time-domain sweep bounds.
                  </div>
                )}
              </div>

              {/* Run Local Simulation button */}
              <button
                onClick={runLocalSimulation}
                disabled={simulating || !editedNetlist.trim()}
                className="py-2.5 px-4 rounded text-xs font-mono font-bold flex items-center justify-center gap-2 cursor-pointer transition-all bg-[#131313]"
                style={{
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  color: 'var(--accent)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.60)'
                  e.currentTarget.style.backgroundColor = 'rgba(148, 163, 184, 0.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.25)'
                  e.currentTarget.style.backgroundColor = '#131313'
                }}
              >
                {simulating ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    Executing SPICE solver...
                  </>
                ) : (
                  <>
                    <Play size={13} />
                    Simulate Locally
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT PANEL - Output, Visualizations & Theory */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#0c0c16]">
          {/* Tab selectors & top bar actions */}
          <div className="flex items-center justify-between border-b shrink-0 px-4 bg-[#0e0e0e]" style={{ borderColor: 'var(--border)' }}>
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('preview')}
                className="py-3 px-4 text-xs font-mono font-bold transition-all relative"
                style={{
                  color: activeTab === 'preview' ? 'var(--accent)' : 'var(--text-muted)'
                }}
              >
                Netlist & Sim Preview
                {activeTab === 'preview' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: 'var(--accent)' }} />
                )}
              </button>
              <button
                onClick={() => setActiveTab('theory')}
                disabled={!aiResponse}
                className="py-3 px-4 text-xs font-mono font-bold transition-all relative disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  color: activeTab === 'theory' ? 'var(--accent)' : 'var(--text-muted)'
                }}
              >
                AI Circuit Analysis & Equations
                {activeTab === 'theory' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: 'var(--accent)' }} />
                )}
              </button>
            </div>

            {/* Top actions drawer */}
            {aiResponse && (
              <div className="flex gap-2">
                <button
                  onClick={handleCopyNetlist}
                  title="Copy Netlist"
                  className="p-1.5 rounded hover:bg-[#111111] border transition-all text-xs flex items-center gap-1 font-mono text-muted"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  <Copy size={13} />
                  Copy
                </button>
                <button
                  onClick={handleExportNetlist}
                  title="Export .cir File"
                  className="p-1.5 rounded hover:bg-[#111111] border transition-all text-xs flex items-center gap-1 font-mono text-muted"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  <Download size={13} />
                  Export
                </button>
                <button
                  onClick={handleLoadInCircuitSim}
                  className="px-2.5 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1 bg-[var(--accent)] text-black transition-all hover:opacity-90"
                >
                  <ExternalLink size={13} />
                  Open in Circuit Sim
                </button>
              </div>
            )}
          </div>

          {/* TAB CONTENTS CONTAINER */}
          <div className="flex-1 overflow-y-auto p-5 min-h-0">
            {!aiResponse ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
                <FileCode2 size={40} className="mb-4" style={{ color: 'var(--border-bright)' }} />
                <h3 className="font-mono font-bold text-sm mb-1" style={{ color: 'var(--text)' }}>Assistant Idle</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Load one of the quick templates on the left or write a custom circuit request, then click "Draft Circuit & Netlist" to initiate the solver co-pilot.
                </p>
              </div>
            ) : activeTab === 'preview' ? (
              <div className="flex flex-col gap-5">
                
                {/* SPICE Netlist Editor Box */}
                <div className="flex flex-col rounded border bg-[#131313]" style={{ borderColor: 'var(--border)' }}>
                  <div className="px-4 py-2 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-2 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                      <FileCode2 size={13} />
                      SPICE Netlist (Editable)
                    </div>
                  </div>
                  <textarea
                    value={editedNetlist}
                    onChange={(e) => setEditedNetlist(e.target.value)}
                    rows={8}
                    className="w-full p-4 font-mono text-xs bg-[#0e0e0e] outline-none text-[#a78bfa] border-none resize-y leading-relaxed"
                  />
                </div>

                {/* Local Simulation Plot Output */}
                <div className="flex flex-col rounded border bg-[#131313] min-h-[300px]" style={{ borderColor: 'var(--border)' }}>
                  <div className="px-4 py-3 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-xs font-mono text-muted uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Simulation Waves Display
                    </span>
                    {simResult && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle size={10} />
                        MNA SOLVED
                      </span>
                    )}
                  </div>

                  <div className="flex-1 p-4 flex flex-col items-center justify-center min-h-[260px]">
                    {simError && (
                      <div className="p-3 rounded border border-red-950 bg-red-950/20 text-red-400 text-xs font-mono flex gap-2 max-w-md">
                        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                        <span>{simError}</span>
                      </div>
                    )}

                    {!simResult && !simError && (
                      <div className="text-center p-6 text-muted max-w-xs" style={{ color: 'var(--text-muted)' }}>
                        <Sliders size={28} className="mx-auto mb-2 text-[#3a3c55]" />
                        <span className="text-xs font-mono block">No active plot</span>
                        <p className="text-[11px] mt-1">
                          Click "Simulate Locally" on the left panel to execute the local SPICE solver engine and display measurements.
                        </p>
                      </div>
                    )}

                    {simResult && !simError && (
                      <div className="w-full h-full flex flex-col gap-4">
                        
                        {/* TRANSIENT PLOT */}
                        {simResult.type === 'transient' && transData.length > 0 && (
                          <div className="w-full">
                            <span className="text-xs font-mono text-muted block mb-2" style={{ color: 'var(--text-muted)' }}>
                              Transient Waves (Voltage vs. Time)
                            </span>
                            <ResponsiveContainer width="100%" height={230}>
                              <LineChart data={transData} margin={{ left: -20, right: 10, bottom: -10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="t" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }} labelStyle={{ color: 'var(--text-muted)', fontSize: 10 }} />
                                <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)' }} />
                                {transKeys.map((k, i) => (
                                  <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={1.5} name={`v(${k})`} />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}

                        {/* AC BODE PLOT */}
                        {simResult.type === 'ac' && acData.length > 0 && (
                          <div className="w-full flex flex-col gap-5">
                            <div>
                              <span className="text-xs font-mono text-muted block mb-2" style={{ color: 'var(--text-muted)' }}>
                                AC Frequency Response Magnitude (dB)
                              </span>
                              <ResponsiveContainer width="100%" height={150}>
                                <LineChart data={acData} margin={{ left: -20, right: 10, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                  <XAxis dataKey="f" scale="log" type="number" domain={['auto', 'auto']} tickFormatter={(v) => `${v >= 1e3 ? (v/1e3).toFixed(0)+'k' : v}`} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }} labelFormatter={(v) => `${v} Hz`} />
                                  <Line type="monotone" dataKey="db" stroke="var(--accent)" dot={false} strokeWidth={1.5} name="Gain (dB)" />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                            <div>
                              <span className="text-xs font-mono text-muted block mb-2" style={{ color: 'var(--text-muted)' }}>
                                Phase Shift (Degrees)
                              </span>
                              <ResponsiveContainer width="100%" height={120}>
                                <LineChart data={acData} margin={{ left: -20, right: 10, bottom: -10 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                  <XAxis dataKey="f" scale="log" type="number" domain={['auto', 'auto']} tickFormatter={(v) => `${v >= 1e3 ? (v/1e3).toFixed(0)+'k' : v}`} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }} labelFormatter={(v) => `${v} Hz`} />
                                  <Line type="monotone" dataKey="phase" stroke={COLORS[2]} dot={false} strokeWidth={1.5} name="Phase (°)" />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}

                        {/* DC SWEEP PLOT */}
                        {simResult.type === 'dc_sweep' && dcData.length > 0 && (
                          <div className="w-full">
                            <span className="text-xs font-mono text-muted block mb-2" style={{ color: 'var(--text-muted)' }}>
                              DC Sweep Curve (Voltage vs. Input Sweep)
                            </span>
                            <ResponsiveContainer width="100%" height={230}>
                              <LineChart data={dcData} margin={{ left: -20, right: 10, bottom: -10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="v" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }} labelStyle={{ color: 'var(--text-muted)', fontSize: 10 }} />
                                <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)' }} />
                                {dcKeys.map((k, i) => (
                                  <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={1.5} name={k} />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}

                        {/* OPERATING POINT DATA TABLE */}
                        {simResult.type === 'operating_point' && (
                          <div className="w-full">
                            <span className="text-xs font-mono text-muted block mb-3" style={{ color: 'var(--text-muted)' }}>
                              DC Nodal Voltages & Currents
                            </span>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-[#0e0e0e] rounded border p-3" style={{ borderColor: 'var(--border)' }}>
                                <div className="text-[10px] font-mono text-muted mb-2 uppercase" style={{ color: 'var(--text-muted)' }}>Node Voltage</div>
                                <table className="w-full text-xs font-mono">
                                  <thead>
                                    <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                                      <th className="text-left pb-1 text-[#6b6d85] font-normal">Node</th>
                                      <th className="text-right pb-1 text-[#6b6d85] font-normal">Value</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Object.entries(simResult.data?.nodeVoltages ?? {}).map(([node, val]: [string, SimAny]) => (
                                      <tr key={node} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                                        <td className="py-1 text-white">{node}</td>
                                        <td className="py-1 text-right text-[#7ab4c4]">{val.toFixed(5)} V</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              <div className="bg-[#0e0e0e] rounded border p-3" style={{ borderColor: 'var(--border)' }}>
                                <div className="text-[10px] font-mono text-muted mb-2 uppercase" style={{ color: 'var(--text-muted)' }}>Branch Currents</div>
                                <table className="w-full text-xs font-mono">
                                  <thead>
                                    <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                                      <th className="text-left pb-1 text-[#6b6d85] font-normal">Device</th>
                                      <th className="text-right pb-1 text-[#6b6d85] font-normal">Current</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Object.entries(simResult.data?.branchCurrents ?? {}).map(([dev, val]: [string, SimAny]) => (
                                      <tr key={dev} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                                        <td className="py-1 text-white">{dev}</td>
                                        <td className="py-1 text-right text-red-400">{(val * 1e3).toFixed(5)} mA</td>
                                      </tr>
                                    ))}
                                    {Object.keys(simResult.data?.branchCurrents ?? {}).length === 0 && (
                                      <tr>
                                        <td colSpan={2} className="py-4 text-center text-[#6b6d85] text-[11px]">No active voltage source branch currents.</td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex flex-col gap-6 font-sans">
                
                {/* Circuit Explanation text */}
                <div className="bg-[#131313] rounded border p-5 flex flex-col gap-3" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-[10px] font-mono uppercase tracking-wider block" style={{ color: 'var(--text-dim)' }}>
                    Circuit Overview & Principles
                  </span>
                  <div
                    className="text-xs leading-relaxed text-[#e2e4f0] font-sans flex flex-col gap-2 whitespace-pre-line"
                  >
                    {aiResponse.explanation}
                  </div>
                </div>

                {/* Mathematical Math Cards (LaTeX via KaTeX) */}
                {aiResponse.equations && aiResponse.equations.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-mono uppercase tracking-wider block" style={{ color: 'var(--text-dim)' }}>
                      Design & Characteristic Equations
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {aiResponse.equations.map((eq, idx) => (
                        <div
                          key={idx}
                          className="bg-[#131313] border rounded-lg p-5 flex flex-col items-center justify-center min-h-[120px] relative"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <span className="absolute top-3 left-4 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                            {eq.label}
                          </span>
                          <div className="text-xl pt-4 pb-2" style={{ color: 'var(--accent)' }}>
                            <Latex math={eq.latex} block={true} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Component Advice Grid */}
                {aiResponse.components && aiResponse.components.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-mono uppercase tracking-wider block" style={{ color: 'var(--text-dim)' }}>
                      AI Component Parameter Advice
                    </span>
                    <div className="bg-[#131313] border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b font-mono" style={{ borderColor: 'var(--border)', background: '#0e0e0e' }}>
                            <th className="p-3 text-[#6b6d85] font-normal w-[15%]">Tag</th>
                            <th className="p-3 text-[#6b6d85] font-normal w-[20%]">Name</th>
                            <th className="p-3 text-[#6b6d85] font-normal w-[15%]">Value</th>
                            <th className="p-3 text-[#6b6d85] font-normal">Design Advisory</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aiResponse.components.map((comp, idx) => (
                            <tr key={idx} className="border-b last:border-0 hover:bg-[#111111]/40 transition-colors" style={{ borderColor: 'var(--border)' }}>
                              <td className="p-3 font-mono font-bold" style={{ color: 'var(--accent)' }}>{comp.id}</td>
                              <td className="p-3 font-mono text-white">{comp.name}</td>
                              <td className="p-3 font-mono text-white">{comp.value}</td>
                              <td className="p-3 text-muted text-xs leading-normal" style={{ color: 'var(--text-muted)' }}>{comp.advice}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
