import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Zap, FileCode2, Upload, Play, Download, ChevronRight,
  ChevronDown, AlertTriangle, Sparkles, X,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useAIProvider } from '../../hooks/useAIProvider'
import { parseCircuitNetlist, parseValue, type ParsedNetlist } from './engine/netlistParser'
import { runNetlistAnalysis } from './engine/runSimulation'
import SchematicView from './SchematicView.jsx'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Component {
  id: string; type: string; value: string; unit?: string
  nodes: string[]; description?: string; dc?: string
}

interface SimResult {
  type: 'transient' | 'ac' | 'operating_point' | 'dc_sweep'
  data: Record<string, unknown>
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EXAMPLE_NETLIST = `* RC Low-Pass Filter
V1 in 0 DC 5 AC 1
R1 in out 1k
C1 out 0 100n
.TRAN 1u 5m
.AC DEC 100 10 100k
.END`

// Chart trace palette. SVG presentation attributes can't resolve CSS var(),
// so these literals mirror the muted Polaris families (steel-blue, danger/
// warning-muted, sage, mauve) defined in index.css.
const COLORS = ['#7ab4c4', '#b08080', '#9485b8', '#7aaa8a', '#b09470', '#b07888']

const AI_PARSE_PROMPT = `You are a SPICE circuit simulator assistant. Given a circuit description, return ONLY a JSON object with this exact structure:
{
  "netlist": "string (valid SPICE netlist)",
  "components": [{"id":"R1","type":"R","value":"1k","unit":"Ω","nodes":["in","out"],"description":"Load resistor"}],
  "analysis": {"type":"transient","params":{"tStop":0.01,"tStep":1e-6}},
  "expectedBehavior": "string",
  "warnings": ["string"]
}
Respond with ONLY the JSON. No explanation.`

function fmt(n: number): string {
  if (!isFinite(n)) return '∞'
  const a = Math.abs(n)
  if (a === 0) return '0'
  if (a >= 1e6) return `${(n / 1e6).toFixed(3)}M`
  if (a >= 1e3) return `${(n / 1e3).toFixed(3)}k`
  if (a >= 1) return n.toFixed(4)
  if (a >= 1e-3) return `${(n * 1e3).toFixed(3)}m`
  if (a >= 1e-6) return `${(n * 1e6).toFixed(3)}µ`
  if (a >= 1e-9) return `${(n * 1e9).toFixed(3)}n`
  return n.toExponential(3)
}

function fmtFreq(f: number): string {
  if (f >= 1e6) return `${(f / 1e6).toFixed(1)}M`
  if (f >= 1e3) return `${(f / 1e3).toFixed(1)}k`
  return `${f.toFixed(1)}`
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 16px', borderRadius: 0, border: 'none',
      borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
      background: 'none', color: active ? 'var(--accent)' : 'var(--text-muted)',
      fontFamily: "'JetBrains Mono', monospace", fontSize: 12, cursor: 'pointer',
    }}>
      {children}
    </button>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CircuitSim() {
  const { makeRequest: aiMakeRequest, isConnected } = useAIProvider()

  const [inputMode, setInputMode] = useState<'nl' | 'netlist' | 'file'>('nl')
  const [nlPrompt, setNlPrompt] = useState('')
  const [netlist, setNetlist] = useState(EXAMPLE_NETLIST)
  const [components, setComponents] = useState<Component[]>([])
  const [analysis, setAnalysis] = useState<{ type: string; params: Record<string, number | string> }>({ type: 'transient', params: {} })
  const [simResult, setSimResult] = useState<SimResult | null>(null)
  const [parsing, setParsing] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [tab, setTab] = useState('waveforms')
  const [selectedComp, setSelectedComp] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [expectedBehavior, setExpectedBehavior] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('enginguity_sim_netlist')
    if (saved) {
      setNetlist(saved)
      setInputMode('netlist')
      localStorage.removeItem('enginguity_sim_netlist')
      try {
        const parsed = parseCircuitNetlist(saved)
        setComponents(parsed.components)
        setAnalysis(parsed.analysis)
      } catch (e) {
        console.error('Failed to pre-parse loaded netlist:', e)
      }
    }
  }, [])

  const makeRequest = useCallback(async (prompt: string, system?: string): Promise<string> => {
    return aiMakeRequest([{ role: 'user', content: prompt }], system)
  }, [aiMakeRequest])

  const parseWithAI = async () => {
    if (!nlPrompt.trim()) return
    setParsing(true)
    setParseError(null)
    try {
      const text = await makeRequest(nlPrompt.trim(), AI_PARSE_PROMPT)
      const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
      const parsed = JSON.parse(cleaned)
      setNetlist(parsed.netlist ?? '')
      setComponents(parsed.components ?? [])
      setAnalysis(parsed.analysis ?? { type: 'transient', params: {} })
      setWarnings(parsed.warnings ?? [])
      setExpectedBehavior(parsed.expectedBehavior ?? null)
    } catch (e) {
      setParseError((e as Error).message)
    } finally {
      setParsing(false)
    }
  }

  const parseAndSim = () => {
    setParseError(null)
    try {
      const parsed = parseCircuitNetlist(netlist)
      setComponents(parsed.components)
      setAnalysis(parsed.analysis)
      runSimulation(parsed)
    } catch (e) {
      setParseError((e as Error).message)
    }
  }

  // Simulation numbers only ever come from the MNA engine. On solver
  // failure we show the error — an LLM must never fabricate waveforms.
  const runSimulation = (parsed: ParsedNetlist) => {
    setSimulating(true)
    setAiAnalysis(null)
    try {
      const result = runNetlistAnalysis(parsed)
      setSimResult({ type: result.type, data: result.data })
      setWarnings([...parsed.warnings, ...result.warnings])
      setTab('waveforms')
    } catch (e) {
      setSimResult(null)
      setWarnings(parsed.warnings)
      setParseError(
        `Solver failed: ${(e as Error).message} Check the netlist for disconnected nodes, a missing ground (node 0), or non-positive component values.`
      )
    } finally {
      setSimulating(false)
    }
  }

  const runAIAnalysis = async () => {
    if (!simResult) return
    setAiLoading(true)
    try {
      const text = await makeRequest(
        `Here are the simulation results for the circuit:\n${JSON.stringify(simResult.data, null, 2).slice(0, 3000)}\n\nProvide:\n1. Does the circuit behave as expected?\n2. Any design issues (thermal, stability, noise)?\n3. Suggested improvements\n4. Component stress analysis\n5. Real-world considerations not captured in simulation`
      )
      setAiAnalysis(text)
    } catch (e) {
      setAiAnalysis(`Error: ${(e as Error).message}`)
    } finally {
      setAiLoading(false)
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setNetlist(text)
      setInputMode('netlist')
    }
    reader.readAsText(file)
  }

  const exportNetlist = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([netlist], { type: 'text/plain' }))
    a.download = 'circuit.cir'
    a.click()
  }

  const exportCSV = () => {
    if (!simResult || simResult.type === 'operating_point') return
    const d = simResult.data as Record<string, number[] | Record<string, number[]>>
    const xKey = simResult.type === 'ac' ? 'frequency' : simResult.type === 'dc_sweep' ? 'sweepVar' : 'time'
    const xData = (d[xKey] as number[]) ?? []
    const yData = simResult.type === 'transient' ? (d.voltages as Record<string, number[]>) ?? {}
      : simResult.type === 'ac' ? { magnitude_db: d.magnitude_db as number[], phase_deg: d.phase_deg as number[] }
      : (d.outputVars as Record<string, number[]>) ?? {}

    const headers = [xKey, ...Object.keys(yData)].join(',')
    const rows = xData.map((x, i) => [x, ...Object.values(yData).map((arr) => arr[i] ?? '')].join(','))
    const csv = [headers, ...rows].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'simulation.csv'
    a.click()
  }

  // ── Chart data builders ───────────────────────────────────────────────────

  const buildTransientData = () => {
    if (!simResult || simResult.type !== 'transient') return []
    const d = simResult.data as { time: number[]; voltages: Record<string, number[]> }
    return (d.time ?? []).map((t, i) => {
      const pt: Record<string, number> = { t: t * 1e3 } // ms
      Object.entries(d.voltages ?? {}).forEach(([k, arr]) => { pt[k] = arr[i] ?? 0 })
      return pt
    })
  }

  const buildACData = () => {
    if (!simResult || simResult.type !== 'ac') return { mag: [], phase: [] }
    const d = simResult.data as { frequency: number[]; magnitude_db: number[]; phase_deg: number[] }
    const mag = (d.frequency ?? []).map((f, i) => ({ f, db: d.magnitude_db[i] ?? 0 }))
    const phase = (d.frequency ?? []).map((f, i) => ({ f, deg: d.phase_deg[i] ?? 0 }))
    return { mag, phase }
  }

  const buildDCSweepData = () => {
    if (!simResult || simResult.type !== 'dc_sweep') return []
    const d = simResult.data as { sweepVar: number[]; outputVars: Record<string, number[]> }
    return (d.sweepVar ?? []).map((v, i) => {
      const pt: Record<string, number> = { v }
      Object.entries(d.outputVars ?? {}).forEach(([k, arr]) => { pt[k] = arr[i] ?? 0 })
      return pt
    })
  }

  const find3dBFreq = () => {
    if (simResult?.type !== 'ac') return null
    const d = simResult.data as { frequency: number[]; magnitude_db: number[] }
    const maxDb = Math.max(...(d.magnitude_db ?? []))
    const target = maxDb - 3
    const idx = (d.magnitude_db ?? []).findIndex((db) => db <= target)
    return idx >= 0 ? d.frequency[idx] : null
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const transientData = buildTransientData()
  const transientKeys = transientData.length > 0 ? Object.keys(transientData[0]).filter((k) => k !== 't') : []

  const acData = buildACData()
  const f3db = find3dBFreq()

  const dcSweepData = buildDCSweepData()
  const dcKeys = dcSweepData.length > 0 ? Object.keys(dcSweepData[0]).filter((k) => k !== 'v') : []

  const opData = simResult?.type === 'operating_point'
    ? (simResult.data as { nodeVoltages: Record<string, number>; branchCurrents: Record<string, number> })
    : null

  const selectedCompObj = components.find((c) => c.id === selectedComp)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Zap size={18} color="var(--accent)" />
          <h1 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Circuit Simulator
          </h1>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          Natural language → SPICE netlist → simulation → AI analysis
        </p>
      </div>

      <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Input mode tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: 0 }}>
          {([['nl', 'Natural Language'], ['netlist', 'Netlist Editor'], ['file', 'File Upload']] as const).map(([mode, label]) => (
            <button key={mode} onClick={() => setInputMode(mode)} style={{
              padding: '8px 18px', border: 'none', background: 'none', cursor: 'pointer',
              borderBottom: inputMode === mode ? '2px solid var(--accent)' : '2px solid transparent',
              color: inputMode === mode ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* NL Input */}
        {inputMode === 'nl' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',   }}>
              Describe Your Circuit
            </label>
            <textarea
              value={nlPrompt}
              onChange={(e) => setNlPrompt(e.target.value)}
              placeholder={`e.g. "A 555 timer in astable mode with R1=10k, R2=47k, C=100nF"\n"Common emitter amplifier with 2N2222, Vcc=12V, RC=4.7k"\n"RC low-pass filter with R=1kΩ and C=100nF"`}
              rows={4}
              style={{
                padding: '12px 14px', borderRadius: 8, background: 'var(--surface)',
                border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13,
                fontFamily: "'DM Sans', system-ui, sans-serif", resize: 'vertical', outline: 'none', lineHeight: 1.6,
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
            <button
              onClick={parseWithAI}
              disabled={parsing || !nlPrompt.trim() || !isConnected}
              style={{
                alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 20px', borderRadius: 7,
                background: nlPrompt.trim() ? 'var(--accent)' : 'var(--surface)',
                border: '1px solid var(--accent)',
                color: nlPrompt.trim() ? '#000' : 'var(--text-muted)',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Sparkles size={14} />
              {parsing ? 'Parsing...' : 'Parse Circuit'}
            </button>
            {!isConnected && (
              <span style={{ fontSize: 11, color: 'var(--danger-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                Connect an AI provider first to use natural language input.
              </span>
            )}
          </div>
        )}

        {/* Netlist editor */}
        {(inputMode === 'netlist' || inputMode === 'nl') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {inputMode === 'netlist' && (
              <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',   }}>
                SPICE Netlist
              </label>
            )}
            {inputMode === 'nl' && components.length > 0 && (
              <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',   }}>
                Generated Netlist
              </label>
            )}
            {(inputMode === 'netlist' || components.length > 0) && (
              <textarea
                value={netlist}
                onChange={(e) => setNetlist(e.target.value)}
                spellCheck={false}
                rows={10}
                style={{
                  padding: '12px 14px', borderRadius: 8,
                  background: 'var(--editor-bg)', border: '1px solid var(--border)',
                  color: 'var(--accent)', fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace", resize: 'vertical', outline: 'none', lineHeight: 1.7,
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={parseAndSim}
                disabled={simulating || !netlist.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', borderRadius: 7,
                  background: netlist.trim() ? 'var(--accent)' : 'var(--surface)',
                  border: '1px solid var(--accent)',
                  color: netlist.trim() ? '#000' : 'var(--text-muted)',
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <Play size={14} />
                {simulating ? 'Simulating...' : 'Parse & Simulate'}
              </button>
              <button onClick={exportNetlist} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 7, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, cursor: 'pointer' }}>
                <Download size={13} /> Export .cir
              </button>
            </div>
          </div>
        )}

        {/* File upload */}
        {inputMode === 'file' && (
          <div
            style={{
              padding: 32, border: '2px dashed var(--border)', borderRadius: 10,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'pointer',
            }}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)' }}
            onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
            onDrop={(e) => {
              e.preventDefault()
              e.currentTarget.style.borderColor = 'var(--border)'
              const file = e.dataTransfer.files[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = (ev) => { setNetlist(ev.target?.result as string); setInputMode('netlist') }
              reader.readAsText(file)
            }}
          >
            <Upload size={28} color="var(--text-muted)" />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-muted)' }}>
              Drop .cir, .sp, .spice, .net, .txt — or click to browse
            </span>
            <input ref={fileRef} type="file" accept=".cir,.sp,.spice,.net,.txt" onChange={handleFile} style={{ display: 'none' }} />
          </div>
        )}

        {/* Errors / warnings */}
        {parseError && (
          <div style={{ padding: '10px 14px', borderRadius: 7, background: 'var(--danger-tint)', border: '1px solid var(--danger-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={14} color="var(--danger-muted)" />
            <span style={{ fontSize: 12, color: 'var(--danger-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{parseError}</span>
          </div>
        )}
        {warnings.length > 0 && (
          <div style={{ padding: '10px 14px', borderRadius: 7, background: 'var(--warning-tint)', border: '1px solid var(--warning-muted)' }}>
            {warnings.map((w, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--warning-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                <AlertTriangle size={12} /> {w}
              </div>
            ))}
          </div>
        )}
        {expectedBehavior && (
          <div style={{ padding: '10px 14px', borderRadius: 7, background: 'var(--accent-glow)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
            <span style={{ color: 'var(--accent)' }}>Expected: </span>{expectedBehavior}
          </div>
        )}

        {/* Schematic view */}
        {components.length > 0 && (
          <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',   }}>
              Schematic — scroll to zoom, drag to pan
            </div>
            <SchematicView
              components={components as any}
              selectedId={selectedComp}
              onSelect={setSelectedComp}
            />
          </div>
        )}

        {/* Selected component panel */}
        {selectedCompObj && (
          <div style={{ padding: '10px 14px', borderRadius: 7, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', gap: 20, alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{selectedCompObj.id}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{selectedCompObj.description}</div>
            </div>
            <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)' }}>Value: <span style={{ color: 'var(--accent)' }}>{selectedCompObj.value} {selectedCompObj.unit}</span></div>
            <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text)' }}>Nodes: <span style={{ color: 'var(--text-muted)' }}>{selectedCompObj.nodes.join(' → ')}</span></div>
            <button onClick={() => setSelectedComp(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Results panel */}
        {simResult && (
          <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <TabBtn active={tab === 'waveforms'} onClick={() => setTab('waveforms')}>Waveforms</TabBtn>
              <TabBtn active={tab === 'op'} onClick={() => setTab('op')}>Operating Point</TabBtn>
              {simResult.type === 'ac' && <TabBtn active={tab === 'bode'} onClick={() => setTab('bode')}>Bode Plot</TabBtn>}
              <TabBtn active={tab === 'components'} onClick={() => setTab('components')}>Components</TabBtn>
              <div style={{ flex: 1 }} />
              <button onClick={exportCSV} style={{ marginRight: 10, display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                <Download size={12} /> CSV
              </button>
            </div>

            <div style={{ padding: '14px 16px' }}>
              {/* Waveforms tab */}
              {tab === 'waveforms' && (
                <>
                  {simResult.type === 'transient' && transientData.length > 0 && (
                    <div>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={transientData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="t" label={{ value: 'Time (ms)', position: 'insideBottomRight', offset: -10, fill: 'var(--text-muted)', fontSize: 11 }} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }} labelStyle={{ color: 'var(--text-muted)', fontSize: 10 }} />
                          {transientKeys.map((k, i) => (
                            <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={1.5} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {simResult.type === 'dc_sweep' && dcSweepData.length > 0 && (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={dcSweepData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="v" label={{ value: 'Sweep (V)', position: 'insideBottomRight', offset: -10, fill: 'var(--text-muted)', fontSize: 11 }} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }} />
                        {dcKeys.map((k, i) => (
                          <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={1.5} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                  {simResult.type === 'ac' && acData.mag.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={acData.mag}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="f" scale="log" type="number" domain={['auto', 'auto']} tickFormatter={fmtFreq} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }} labelFormatter={(v) => `${fmtFreq(v as number)}Hz`} />
                          {f3db && <ReferenceLine x={f3db} stroke="#b09470" strokeDasharray="4 2" label={{ value: '-3dB', fill: '#b09470', fontSize: 10 }} />}
                          <Line type="monotone" dataKey="db" stroke="var(--accent)" dot={false} strokeWidth={1.5} name="Magnitude (dB)" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {simResult.type === 'operating_point' && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                      Operating point solved. Switch to the "Operating Point" tab to view node voltages.
                    </div>
                  )}
                </>
              )}

              {/* Operating point tab */}
              {tab === 'op' && (
                <div>
                  {opData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',   marginBottom: 8 }}>Node Voltages</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                          <thead>
                            <tr>
                              {['Node', 'Voltage'].map((h) => (
                                <th key={h} style={{ textAlign: 'left', padding: '5px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(opData.nodeVoltages).map(([node, v]) => (
                              <tr key={node}>
                                <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>{node}</td>
                                <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', color: v > 0.01 ? 'var(--accent)' : v < -0.01 ? 'var(--danger-muted)' : 'var(--text-muted)' }}>
                                  {fmt(v)} V
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {Object.keys(opData.branchCurrents).length > 0 && (
                        <div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',   marginBottom: 8 }}>Branch Currents</div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                            <thead>
                              <tr>
                                {['Branch', 'Current'].map((h) => (
                                  <th key={h} style={{ textAlign: 'left', padding: '5px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(opData.branchCurrents).map(([branch, i]) => (
                                <tr key={branch}>
                                  <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>{branch}</td>
                                  <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', color: 'var(--accent)' }}>{fmt(i)} A</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                      Run an operating point or parse a netlist with .OP to see DC node voltages.
                    </div>
                  )}
                </div>
              )}

              {/* Bode tab */}
              {tab === 'bode' && simResult.type === 'ac' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {typeof simResult.data.probeNode === 'string' && (
                    <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)' }}>
                      Probing v({simResult.data.probeNode}) relative to the AC stimulus
                    </div>
                  )}
                  {f3db && (
                    <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--warning-muted)' }}>
                      −3dB frequency: {fmtFreq(f3db)}Hz
                    </div>
                  )}
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>MAGNITUDE (dB)</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={acData.mag}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="f" scale="log" type="number" domain={['auto', 'auto']} tickFormatter={fmtFreq} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }} labelFormatter={(v) => `${fmtFreq(v as number)}Hz`} />
                      {f3db && <ReferenceLine x={f3db} stroke="#b09470" strokeDasharray="4 2" />}
                      <Line type="monotone" dataKey="db" stroke="var(--accent)" dot={false} strokeWidth={1.5} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)', marginTop: 8, marginBottom: 4 }}>PHASE (degrees)</div>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={acData.phase}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="f" scale="log" type="number" domain={['auto', 'auto']} tickFormatter={fmtFreq} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }} labelFormatter={(v) => `${fmtFreq(v as number)}Hz`} />
                      <Line type="monotone" dataKey="deg" stroke="#9485b8" dot={false} strokeWidth={1.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Components tab */}
              {tab === 'components' && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                  <thead>
                    <tr>
                      {['ID', 'Type', 'Value', 'Nodes', 'Power (est.)'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '5px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {components.map((c) => {
                      const voltages = opData?.nodeVoltages ?? {}
                      const v1 = voltages[c.nodes[0]] ?? 0
                      const v2 = voltages[c.nodes[1]] ?? 0
                      const vDiff = Math.abs(v1 - v2)
                      const power = c.type === 'R' || c.type === 'RES'
                        ? vDiff * vDiff / Math.max(parseValue(c.value), 1e-9)
                        : null
                      return (
                        <tr key={c.id} onClick={() => setSelectedComp(c.id)} style={{ cursor: 'pointer' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', color: 'var(--accent)' }}>{c.id}</td>
                          <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>{c.type}</td>
                          <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>{c.value} {c.unit}</td>
                          <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>{c.nodes.join(', ')}</td>
                          <td style={{ padding: '5px 10px', borderBottom: '1px solid var(--border)', color: power !== null ? 'var(--text)' : 'var(--text-dim)' }}>
                            {power !== null ? `${fmt(power)} W` : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* AI Analysis button */}
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={runAIAnalysis}
                disabled={aiLoading || !isConnected}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 16px', borderRadius: 6,
                  background: 'var(--accent-glow)', border: '1px solid var(--accent)',
                  color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, cursor: 'pointer',
                }}
              >
                <Sparkles size={13} />
                {aiLoading ? 'Analyzing...' : 'AI Analysis'}
              </button>
              {!isConnected && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                  Connect a provider to use AI analysis.
                </span>
              )}
            </div>
          </div>
        )}

        {/* AI analysis result */}
        {aiAnalysis && (
          <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '16px 18px' }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--accent)',   marginBottom: 10 }}>AI Circuit Analysis</div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{aiAnalysis}</div>
          </div>
        )}
      </div>
    </div>
  )
}
