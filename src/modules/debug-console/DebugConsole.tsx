import { useState, useEffect, useRef, useCallback } from 'react'
// @ts-ignore
import { moduleStateStore } from '../../store/moduleState'
import { FileCode, Code2, Radio, Cpu, Plus, ChevronRight, X, Maximize2, Minimize2 } from 'lucide-react'
import { useAIProvider } from '../../hooks/useAIProvider'
import { useProjectContext } from '../../hooks/useProjectContext'
import { useFocusMode } from '../../context/FocusModeContext'
import ResizablePanel from '../../components/ResizablePanel'
import { logEvent } from '../../engine/eventLog'

// ── Types ────────────────────────────────────────────────────────────────────

type OutputType = 'stdout' | 'stderr' | 'system' | 'success' | 'serial_in' | 'serial_out'
type TerminalTab = 'output' | 'serial' | 'problems'
type SidebarMode = 'editor' | 'serial' | 'analysis'
type AnalysisOverall = 'clean' | 'minor_issues' | 'significant_issues' | 'critical'

interface OutputLine {
  id: number
  text: string
  type: OutputType
  ts?: string
}

interface AnalysisIssue {
  severity: 'critical' | 'warning' | 'info'
  line: number | null
  title: string
  description: string
  fix: string
}

interface AnalysisResult {
  overall: AnalysisOverall
  summary: string
  issues: AnalysisIssue[]
  positives: string[]
}

// ── Language detection ────────────────────────────────────────────────────────

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    py: 'Python', js: 'JavaScript', jsx: 'JavaScript',
    ts: 'JavaScript', tsx: 'JavaScript',
    c: 'C', cpp: 'C++', h: 'C/C++',
    ino: 'Arduino', rs: 'Rust',
    v: 'Verilog', sv: 'SystemVerilog', vhd: 'VHDL',
  }
  return map[ext] ?? (ext.toUpperCase() || 'Text')
}

function isExecutable(lang: string): boolean {
  return lang === 'Python' || lang === 'JavaScript'
}

function defaultCode(lang: string): string {
  if (lang === 'Python') return "# Write Python code here\nprint('Hello, ENGINGUITY')"
  if (lang === 'JavaScript') return "// Write JavaScript here\nconsole.log('Hello, ENGINGUITY')"
  return '// Paste your firmware code here\n// Use Analyze for AI review'
}

// ── Timestamp ─────────────────────────────────────────────────────────────────

function nowTs(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`
}

let _lineId = 0
function mkLine(text: string, type: OutputType): OutputLine {
  return { id: _lineId++, text, type, ts: nowTs() }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DebugConsole() {
  const ai = useAIProvider()
  const project = useProjectContext()
  const { isFocusMode, toggleFocusMode } = useFocusMode()

  // Editor state
  const [filename, setFilename] = useState('main.cpp')
  const [code, setCode] = useState('')
  const [files, setFiles] = useState<string[]>(['main.cpp'])

  // UI mode
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('editor')
  const [termTab, setTermTab] = useState<TerminalTab>('output')

  // Output
  const [output, setOutput] = useState<OutputLine[]>([])
  const [problems, setProblems] = useState<OutputLine[]>([])

  // Pyodide
  const pyodideRef = useRef<any>(null)
  const [pyodideLoading, setPyodideLoading] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

  // Serial
  const portRef = useRef<any>(null)
  const readerRef = useRef<any>(null)
  const [serialConnected, setSerialConnected] = useState(false)
  const [serialConnecting, setSerialConnecting] = useState(false)
  const [baudRate, setBaudRate] = useState(115200)
  const [serialInput, setSerialInput] = useState('')
  const [serialOutput, setSerialOutput] = useState<OutputLine[]>([])

  // AI analysis
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [analysisFollowup, setAnalysisFollowup] = useState('')
  const [analysisChat, setAnalysisChat] = useState<string[]>([])
  const [expandedFix, setExpandedFix] = useState<number | null>(null)

  // Flash guide
  const [flashGuideOpen, setFlashGuideOpen] = useState(false)

  // Editor refs
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const lineNumRef = useRef<HTMLDivElement>(null)
  const termBodyRef = useRef<HTMLDivElement>(null)
  const serialBodyRef = useRef<HTMLDivElement>(null)
  const pauseAutoScroll = useRef(false)
  const pauseSerialScroll = useRef(false)

  const language = detectLanguage(filename)
  const executable = isExecutable(language)

  useEffect(() => {
    moduleStateStore.publish('debug', {
      filename,
      language,
      lineCount: code.split('\n').length,
      code,
    })
  }, [filename, language, code])

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const saved = localStorage.getItem('enginguity_starter_code')
      if (saved) {
        const parsed = JSON.parse(saved)
        const fn = parsed.filename ?? 'main.cpp'
        setFilename(fn)
        setCode(parsed.content ?? '')
        setFiles(f => f.includes(fn) ? f : [fn, ...f])
        const lang = detectLanguage(fn)
        const msg = isExecutable(lang)
          ? `${lang} code — press Run to execute`
          : `${lang} code — use Analyze for AI review or Serial Monitor to read device output`
        appendOutput(`Loaded ${fn}`, 'system')
        appendOutput(msg, 'system')
      } else {
        const lang = detectLanguage('main.cpp')
        setCode(defaultCode(lang))
        appendOutput('No template loaded. Write code or load a template.', 'system')
      }
    } catch (_) {
      const lang = detectLanguage('main.cpp')
      setCode(defaultCode(lang))
    }
  }, [])

  // ── Output helpers ─────────────────────────────────────────────────────────

  const appendOutput = useCallback((text: string, type: OutputType) => {
    setOutput(prev => [...prev, mkLine(text, type)])
  }, [])

  const appendSerial = useCallback((text: string, type: OutputType) => {
    setSerialOutput(prev => [...prev, mkLine(text, type)])
  }, [])

  // ── Auto-scroll ────────────────────────────────────────────────────────────

  useEffect(() => {
    const el = termBodyRef.current
    if (!el || pauseAutoScroll.current) return
    el.scrollTop = el.scrollHeight
  }, [output])

  useEffect(() => {
    const el = serialBodyRef.current
    if (!el || pauseSerialScroll.current) return
    el.scrollTop = el.scrollHeight
  }, [serialOutput])

  // ── Editor scroll sync ─────────────────────────────────────────────────────

  useEffect(() => {
    const ta = editorRef.current
    const ln = lineNumRef.current
    if (!ta || !ln) return
    const sync = () => { ln.scrollTop = ta.scrollTop }
    ta.addEventListener('scroll', sync)
    return () => ta.removeEventListener('scroll', sync)
  }, [])

  // ── Tab key in editor ──────────────────────────────────────────────────────

  function handleTabKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const ta = editorRef.current!
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const next = code.slice(0, start) + '  ' + code.slice(end)
    setCode(next)
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + 2
    })
  }

  // ── File management ────────────────────────────────────────────────────────

  function selectFile(fn: string) {
    setFilename(fn)
    // For demo just switch filename; real impl would track per-file content
  }

  function addNewFile() {
    const ext = language === 'Python' ? 'py' : language === 'JavaScript' ? 'js' : 'cpp'
    const fn = `file_${files.length + 1}.${ext}`
    setFiles(f => [...f, fn])
    setFilename(fn)
    setCode(defaultCode(detectLanguage(fn)))
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  function handleReset() {
    try {
      const saved = localStorage.getItem('enginguity_starter_code')
      if (saved) {
        const parsed = JSON.parse(saved)
        setCode(parsed.content ?? '')
        setFilename(parsed.filename ?? 'main.cpp')
        appendOutput('Reset to template default.', 'system')
      } else {
        setCode(defaultCode(language))
        appendOutput('Reset to default.', 'system')
      }
    } catch (_) {
      setCode(defaultCode(language))
    }
  }

  // ── Pyodide ────────────────────────────────────────────────────────────────

  async function loadPyodide(): Promise<any> {
    if (pyodideRef.current) return pyodideRef.current
    setPyodideLoading(true)
    appendOutput('Loading Python runtime (~8MB, first run only)...', 'system')
    await new Promise<void>((resolve, reject) => {
      if ((window as any).loadPyodide) { resolve(); return }
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.0/full/pyodide.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load Pyodide'))
      document.head.appendChild(script)
    })
    const py = await (window as any).loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.0/full/'
    })
    pyodideRef.current = py
    setPyodideLoading(false)
    return py
  }

  async function runPython(src: string) {
    setIsRunning(true)
    setTermTab('output')
    appendOutput('Running Python...', 'system')
    try {
      const py = await loadPyodide()
      py.globals.set('_eng_print', (text: string) => appendOutput(text, 'stdout'))
      await py.runPythonAsync(`
import sys, js
class _Cap:
    def write(self, t):
        if t.strip(): js._eng_print(t)
    def flush(self): pass
sys.stdout = _Cap()
sys.stderr = _Cap()
`)
      const t0 = performance.now()
      await py.runPythonAsync(src)
      const elapsed = ((performance.now() - t0) / 1000).toFixed(3)
      appendOutput(`Completed in ${elapsed}s`, 'success')
      logEvent('CODE_EXECUTED', {
        language: 'Python',
        code: src,
        status: 'success',
        elapsedSeconds: parseFloat(elapsed),
        module: 'debug'
      })
    } catch (err: any) {
      const lines = String(err.message ?? err).split('\n')
      lines.forEach(l => l && appendOutput(l, 'stderr'))
      logEvent('CODE_EXECUTED', {
        language: 'Python',
        code: src,
        status: 'error',
        error: err.message || String(err),
        module: 'debug'
      })
    } finally {
      setIsRunning(false)
    }
  }

  // ── JavaScript ─────────────────────────────────────────────────────────────

  async function runJavaScript(src: string) {
    setIsRunning(true)
    setTermTab('output')
    appendOutput('Running JavaScript...', 'system')

    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.setAttribute('sandbox', 'allow-scripts')
    document.body.appendChild(iframe)

    let done = false
    let hasError = false
    let errorText = ''
    const onMsg = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return
      if (e.data.type === 'log') appendOutput(e.data.text, 'stdout')
      if (e.data.type === 'error') {
        hasError = true
        errorText = e.data.text
        appendOutput(e.data.text, 'stderr')
      }
      if (e.data.type === 'done') {
        if (!done) {
          done = true
          if (hasError) {
            logEvent('CODE_EXECUTED', {
              language: 'JavaScript',
              code: src,
              status: 'error',
              error: errorText,
              module: 'debug'
            })
          } else {
            appendOutput(`Completed in ${e.data.elapsed}ms`, 'success')
            logEvent('CODE_EXECUTED', {
              language: 'JavaScript',
              code: src,
              status: 'success',
              elapsedMs: e.data.elapsed,
              module: 'debug'
            })
          }
        }
        cleanup()
      }
    }
    const cleanup = () => {
      window.removeEventListener('message', onMsg)
      if (document.body.contains(iframe)) document.body.removeChild(iframe)
      setIsRunning(false)
    }
    window.addEventListener('message', onMsg)
    setTimeout(() => {
      if (!done) {
        appendOutput('Execution timed out (10s limit)', 'stderr')
        logEvent('CODE_EXECUTED', {
          language: 'JavaScript',
          code: src,
          status: 'error',
          error: 'Execution timed out (10s limit)',
          module: 'debug'
        })
        cleanup()
      }
    }, 10000)

    const wrapped = `
const _s = performance.now()
console.log = (...a) => parent.postMessage({type:'log',text:a.join(' ')},'*')
console.error = (...a) => parent.postMessage({type:'error',text:a.join(' ')},'*')
console.warn = (...a) => parent.postMessage({type:'log',text:'warn: '+a.join(' ')},'*')
try {
  ${src}
  parent.postMessage({type:'done',elapsed:Math.round(performance.now()-_s)},'*')
} catch(e) {
  parent.postMessage({type:'error',text:String(e)},'*')
  parent.postMessage({type:'done',elapsed:0},'*')
}`
    iframe.srcdoc = `<script>${wrapped}<\/script>`
  }

  function handleRun() {
    if (isRunning) return
    if (language === 'Python') runPython(code)
    else if (language === 'JavaScript') runJavaScript(code)
  }

  // ── Serial ─────────────────────────────────────────────────────────────────

  async function connectSerial() {
    if (!('serial' in navigator)) return
    setSerialConnecting(true)
    try {
      const port = await (navigator as any).serial.requestPort()
      await port.open({ baudRate })
      portRef.current = port
      setSerialConnected(true)
      setTermTab('serial')
      appendSerial('Connected', 'success')
      appendSerial(`${baudRate} baud · 8N1`, 'system')
      readSerial(port)

      logEvent('SERIAL_CONNECTED', {
        baudRate,
        module: 'debug'
      })
    } catch (err: any) {
      if (err.name !== 'NotFoundError') appendSerial(`${err.message}`, 'stderr')
    } finally {
      setSerialConnecting(false)
    }
  }

  async function readSerial(port: any) {
    const reader = port.readable.getReader()
    readerRef.current = reader
    const decoder = new TextDecoder()
    let buf = ''
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        lines.forEach(l => { if (l.trim()) appendSerial(l, 'serial_in') })
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') appendSerial(`Serial error: ${err.message}`, 'stderr')
    } finally {
      reader.releaseLock()
      setSerialConnected(false)
      appendSerial('Disconnected', 'system')
    }
  }

  async function disconnectSerial() {
    try { await readerRef.current?.cancel() } catch { /* reader already released */ }
    try { await portRef.current?.close() } catch { /* port already closed */ }
    portRef.current = null
    setSerialConnected(false)
  }

  async function sendSerial() {
    const text = serialInput.trim()
    if (!text || !portRef.current?.writable) return
    setSerialInput('')
    try {
      const writer = portRef.current.writable.getWriter()
      await writer.write(new TextEncoder().encode(text + '\n'))
      writer.releaseLock()
      appendSerial(text, 'serial_out')
    } catch (err: any) {
      appendSerial(`Send error: ${err.message}`, 'stderr')
    }
  }

  // ── AI Analysis ────────────────────────────────────────────────────────────

  async function handleAnalyze() {
    if (!ai.isConnected) { ai.openGrid(); return }
    setAnalysisOpen(true)
    setAnalysisLoading(true)
    setAnalysis(null)
    setAnalysisChat([])

    const systemPrompt = `You are a senior engineer doing a code review. Be direct and specific. No filler. Flag real issues only. If the code is clean, say so briefly. Do not explain what the code does unless asked.`
    const userPrompt = `Review this ${language} code for:
1. Bugs and logic errors
2. Memory issues (leaks, buffer overflows, stack issues)
3. Safety problems (for embedded: ISR safety, volatile missing, undefined behavior)
4. Performance issues
5. Missing error handling

Code:
\`\`\`
${code}
\`\`\`

Project context: ${project.description || 'none'}

Return JSON only, no prose around it:
{
  "overall": "clean" | "minor_issues" | "significant_issues" | "critical",
  "summary": "one sentence",
  "issues": [{"severity":"critical"|"warning"|"info","line":number|null,"title":"string","description":"string","fix":"string"}],
  "positives": ["string"]
}`

    try {
      const raw = await ai.makeRequest(
        [{ role: 'user', content: userPrompt }],
        systemPrompt,
        { maxTokens: 2000 }
      )
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON in response')
      const parsed = JSON.parse(jsonMatch[0]) as AnalysisResult
      setAnalysis(parsed)
      const critical = parsed.issues.filter(i => i.severity === 'critical')
      if (critical.length > 0) {
        setProblems(critical.map(i => mkLine(`${i.title}${i.line ? ` (line ${i.line})` : ''}`, 'stderr')))
      }
    } catch (err: any) {
      setAnalysis({
        overall: 'minor_issues',
        summary: 'Analysis failed: ' + String(err.message ?? err),
        issues: [],
        positives: []
      })
    } finally {
      setAnalysisLoading(false)
    }
  }

  async function handleFollowup() {
    if (!analysisFollowup.trim() || !ai.isConnected) return
    const q = analysisFollowup.trim()
    setAnalysisFollowup('')
    setAnalysisChat(c => [...c, `Q: ${q}`])
    try {
      const context = analysis ? JSON.stringify(analysis) : ''
      const res = await ai.makeRequest(
        [{ role: 'user', content: `Code:\n\`\`\`\n${code}\n\`\`\`\n\nAnalysis: ${context}\n\nQuestion: ${q}` }],
        'Answer questions about the code concisely.',
        { maxTokens: 800 }
      )
      setAnalysisChat(c => [...c, `A: ${res}`])
    } catch (err: any) {
      setAnalysisChat(c => [...c, `A: Error — ${err.message}`])
    }
  }

  // ── Flash guide content ────────────────────────────────────────────────────

  function flashGuideContent() {
    if (language === 'Arduino') return `This Arduino sketch runs on hardware and cannot execute in the browser. To flash it:

1. Install Arduino IDE or PlatformIO
2. Connect your board via USB
3. Select your board and port
4. Click Upload (Cmd+U)

After flashing, use the Serial Monitor below to read live output from your board.`
    if (language === 'Rust') return `cargo build --target thumbv7em-none-eabihf
cargo flash --chip STM32F4 (with probe-rs)

For embedded Rust, probe-rs provides flashing and RTT debugging over SWD.`
    if (language === 'Verilog' || language === 'SystemVerilog') return `Synthesize and program with your toolchain:

Open-source: Yosys + nextpnr for iCE40/ECP5 FPGAs
Xilinx: Vivado (xc3sprog or openFPGALoader to flash)
Intel: Quartus Prime

Simulation: iverilog + GTKWave for waveform viewing`
    if (language === 'VHDL') return `VHDL synthesis:

Xilinx: Vivado
Intel: Quartus Prime
Open-source: GHDL for simulation

Use your vendor's programmer tool to flash the bitstream.`
    return `Compile and flash with your toolchain:

STM32: STM32CubeIDE or arm-none-eabi-gcc + OpenOCD
ESP32: idf.py build flash monitor
Generic C: gcc -o output file.c && ./output

Once flashed, connect the Serial Monitor below to read live UART output.`
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const S = {
    root: {
      display: 'flex', flexDirection: 'column' as const,
      height: '100%', minHeight: 0, overflow: 'hidden',
      background: 'var(--bg)', color: 'var(--text)',
    },
    topBar: {
      height: isFocusMode ? 0 : 52, flexShrink: 0,
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 8,
      borderBottom: isFocusMode ? 'none' : '1px solid var(--border)',
      background: 'var(--bg)',
      boxSizing: 'border-box' as const,
      overflow: 'hidden',
      opacity: isFocusMode ? 0 : 1,
      pointerEvents: isFocusMode ? 'none' as const : 'auto' as const,
      transition: 'height 150ms ease, opacity 150ms ease',
    },
    topBarRight: {
      display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto',
    },
    midRow: {
      display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden',
      height: '100%',
    },
    sidebar: {
      width: 180, flexShrink: 0,
      overflowY: 'auto' as const,
      background: 'var(--bg)',
      padding: '8px 0',
    },
    sectionLabel: {
      fontFamily: 'Geist, sans-serif',
      fontSize: 10, color: 'var(--text-dim)',
      padding: '12px 12px 4px 12px', display: 'block',
    },
    fileRow: (active: boolean): React.CSSProperties => ({
      height: 30, padding: '0 12px',
      display: 'flex', alignItems: 'center', gap: 6,
      cursor: 'pointer',
      fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
      fontSize: 12,
      color: active ? 'var(--text)' : 'var(--text-muted)',
      background: active ? 'var(--surface-2, rgba(255,255,255,0.06))' : 'transparent',
      borderRadius: 4, margin: '0 4px',
      overflow: 'hidden', whiteSpace: 'nowrap' as const, textOverflow: 'ellipsis',
      transition: 'background 0.1s',
    }),
    modeRow: (active: boolean): React.CSSProperties => ({
      height: 30, padding: '0 12px',
      display: 'flex', alignItems: 'center', gap: 6,
      cursor: 'pointer',
      fontFamily: 'Geist, sans-serif', fontSize: 12,
      color: active ? 'var(--text)' : 'var(--text-muted)',
      background: active ? 'var(--surface-2, rgba(255,255,255,0.06))' : 'transparent',
      borderRadius: 4, margin: '0 4px',
      transition: 'background 0.1s',
    }),
    editorPane: {
      flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' as const,
      display: 'flex',
    },
    lineNums: {
      position: 'absolute' as const, left: 0, top: 0, bottom: 0,
      width: 48, overflow: 'hidden',
      background: 'var(--bg)',
      borderRight: '1px solid var(--border)',
      padding: '16px 0',
      boxSizing: 'border-box' as const,
      userSelect: 'none' as const,
    },
    lineNum: {
      height: 'calc(13px * 1.6)',
      textAlign: 'right' as const,
      paddingRight: 10,
      fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
      fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6,
    },
    textarea: {
      position: 'absolute' as const, inset: 0,
      width: '100%', height: '100%',
      background: 'var(--bg)', color: 'var(--text)',
      fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
      fontSize: 13, lineHeight: 1.6 as const,
      padding: '16px 16px 16px 56px',
      border: 'none', outline: 'none', resize: 'none' as const,
      boxSizing: 'border-box' as const,
      overflowY: 'auto' as const, tabSize: 2,
      whiteSpace: 'pre' as const,
    },
    terminal: {
      display: 'flex', flexDirection: 'column' as const,
      background: 'var(--bg)',
      position: 'relative' as const, zIndex: 1,
    },
    termHeader: {
      height: 36, flexShrink: 0,
      display: 'flex', alignItems: 'center',
      padding: '0 12px', gap: 0,
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
    },
    termTab: (active: boolean): React.CSSProperties => ({
      fontFamily: 'Geist, sans-serif', fontSize: 12,
      padding: '0 8px', height: 36,
      display: 'flex', alignItems: 'center',
      color: active ? 'var(--text)' : 'var(--text-muted)',
      borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
      cursor: 'pointer', background: 'none', border: 'none',
      borderBottomStyle: 'solid' as const,
      borderBottomWidth: 2,
      borderBottomColor: active ? 'var(--accent)' : 'transparent',
      outline: 'none',
    }),
    termBody: {
      flex: 1, overflowY: 'auto' as const,
      padding: '8px 12px',
      background: 'var(--bg)',
      fontFamily: "'Geist Mono', 'JetBrains Mono', monospace",
      fontSize: 12, lineHeight: 1.6,
    },
    serialSendBar: {
      height: 36, flexShrink: 0,
      display: 'flex', alignItems: 'center',
      padding: '0 8px', gap: 8,
      background: 'var(--bg-2, var(--surface))',
      borderTop: '1px solid var(--border)',
    },
    analysisDrawer: {
      width: 320, flexShrink: 0,
      borderLeft: '1px solid var(--border)',
      background: 'var(--surface, var(--bg-2))',
      display: 'flex', flexDirection: 'column' as const,
      overflow: 'hidden',
    },
    flashDrawer: {
      width: 280, flexShrink: 0,
      borderLeft: '1px solid var(--border)',
      background: 'var(--surface, var(--bg-2))',
      padding: 20, overflowY: 'auto' as const,
    },
  }

  function lineColor(t: OutputType): string {
    if (t === 'stderr') return '#b08080'
    if (t === 'system') return 'var(--text-dim)'
    if (t === 'success') return 'var(--text-muted)'
    if (t === 'serial_in') return 'var(--text)'
    if (t === 'serial_out') return 'var(--accent)'
    return 'var(--text)'
  }

  function linePrefix(t: OutputType): string {
    if (t === 'stderr') return '✕ '
    if (t === 'system') return '› '
    if (t === 'success') return '✓ '
    if (t === 'serial_out') return '→ '
    return ''
  }

  const issueColor = (s: string) => s === 'critical' ? '#b08080' : s === 'warning' ? 'var(--text-muted)' : 'var(--border-bright, var(--border))'
  const overallLabel: Record<AnalysisOverall, string> = {
    clean: 'Clean', minor_issues: 'Minor issues',
    significant_issues: 'Significant issues', critical: 'Critical'
  }

  const hasSerial = 'serial' in navigator
  const activeTermOutput = termTab === 'serial' ? serialOutput : (termTab === 'problems' ? problems : output)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={S.root}>

      {/* TOP BAR */}
      <div style={S.topBar}>
        {/* File tab */}
        <div style={{
          background: 'var(--surface, var(--bg-2))',
          border: '1px solid var(--border)',
          borderRadius: 4, padding: '4px 10px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <FileCode size={12} style={{ color: 'var(--text-dim)' }} />
          <span style={{ fontFamily: "'Geist Mono','JetBrains Mono',monospace", fontSize: 12, color: 'var(--text)' }}>
            {filename}
          </span>
          <span style={{
            border: '1px solid var(--border-bright, var(--border))',
            borderRadius: 3, padding: '1px 6px',
            fontFamily: "'Geist Mono','JetBrains Mono',monospace",
            fontSize: 10, color: 'var(--text-muted)',
          }}>
            {language}
          </span>
        </div>

        <div style={S.topBarRight}>
          <button onClick={handleReset} style={{
            border: '1px solid var(--border-bright, var(--border))',
            color: 'var(--text-muted)', background: 'transparent',
            borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
            fontFamily: 'Geist, sans-serif', fontSize: 12,
          }}>
            Reset
          </button>

          <button onClick={handleAnalyze} style={{
            border: '1px solid var(--border-bright, var(--border))',
            color: 'var(--text-muted)', background: 'transparent',
            borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
            fontFamily: 'Geist, sans-serif', fontSize: 12,
          }}>
            Analyze
          </button>

          {executable ? (
            <button onClick={handleRun} disabled={isRunning || pyodideLoading} style={{
              border: '1px solid var(--accent)',
              color: 'var(--accent)', background: 'transparent',
              borderRadius: 4, padding: '4px 10px', cursor: isRunning || pyodideLoading ? 'not-allowed' : 'pointer',
              fontFamily: 'Geist, sans-serif', fontSize: 12,
              opacity: isRunning || pyodideLoading ? 0.6 : 1,
            }}>
              {isRunning ? 'Running...' : pyodideLoading ? 'Loading runtime...' : '▶ Run'}
            </button>
          ) : (
            <button onClick={() => { setFlashGuideOpen(f => !f); setAnalysisOpen(false) }} style={{
              border: '1px solid var(--border-bright, var(--border))',
              color: 'var(--text-muted)', background: 'transparent',
              borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
              fontFamily: 'Geist, sans-serif', fontSize: 12,
            }}>
              Flash Guide →
            </button>
          )}

          <button
            onClick={toggleFocusMode}
            style={{
              border: '1px solid var(--border-bright, var(--border))',
              color: 'var(--text-muted)', background: 'transparent',
              borderRadius: 4, padding: '4px 10px', cursor: 'pointer',
              fontFamily: 'Geist, sans-serif', fontSize: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
            title={isFocusMode ? "Exit Focus Mode (Esc)" : "Focus Mode (Cmd+Shift+F)"}
          >
            {isFocusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* VERTICAL SPLIT: (middle row) / terminal */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <ResizablePanel
        direction="vertical"
        initialSplit={0.72}
        minFirst={200}
        minSecond={120}
        storageKey="debug-terminal"
      >
        {/* MIDDLE ROW — first child of vertical ResizablePanel */}
        <div style={S.midRow}>
        <ResizablePanel
          direction="horizontal"
          initialSplit={0.18}
          minFirst={140}
          minSecond={300}
          storageKey="debug-sidebar"
        >
        {/* SIDEBAR */}
        <div style={S.sidebar}>
          <span style={S.sectionLabel}>Workspace Files</span>

          {files.map(fn => (
            <div key={fn} style={S.fileRow(fn === filename)} onClick={() => selectFile(fn)}>
              <FileCode size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fn}</span>
            </div>
          ))}

          <div style={{ ...S.fileRow(false), color: 'var(--text-dim)' }} onClick={addNewFile}>
            <Plus size={12} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
            New file
          </div>

          <span style={{ ...S.sectionLabel, marginTop: 8 }}>Mode</span>

          {([
            ['editor', 'Code Editor', Code2],
            ['serial', 'Serial Monitor', Radio],
            ['analysis', 'AI Analysis', Cpu],
          ] as const).map(([mode, label, Icon]) => (
            <div key={mode} style={S.modeRow(sidebarMode === mode)} onClick={() => {
              setSidebarMode(mode)
              if (mode === 'serial') setTermTab('serial')
              if (mode === 'analysis') { handleAnalyze() }
            }}>
              <Icon size={14} style={{ flexShrink: 0, color: sidebarMode === mode ? 'var(--text)' : 'var(--text-dim)' }} />
              {label}
            </div>
          ))}
        </div>

        {/* EDITOR PANE */}
        <div style={S.editorPane}>
          {/* Line numbers */}
          <div ref={lineNumRef} style={S.lineNums}>
            {code.split('\n').map((_, i) => (
              <div key={i} style={S.lineNum}>{i + 1}</div>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            ref={editorRef}
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={handleTabKey}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            style={S.textarea}
          />
        </div>
        </ResizablePanel>

        {/* AI ANALYSIS DRAWER */}
        {analysisOpen && (
          <div style={S.analysisDrawer}>
            {/* Drawer header */}
            <div style={{
              height: 44, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 16px',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontFamily: 'Geist, sans-serif', fontSize: 13, color: 'var(--text)' }}>
                Code Analysis
              </span>
              <button onClick={() => setAnalysisOpen(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-dim)', display: 'flex', alignItems: 'center',
              }}>
                <X size={14} />
              </button>
            </div>

            {analysisLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'Geist, sans-serif', fontSize: 12, color: 'var(--text-dim)' }}>
                  Analyzing...
                </span>
              </div>
            ) : analysis ? (
              <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                {/* Overall */}
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontFamily: 'Geist, sans-serif', fontSize: 13, color: 'var(--text-muted)' }}>
                    {overallLabel[analysis.overall]}
                  </span>
                </div>
                <p style={{ fontFamily: 'Geist, sans-serif', fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', margin: '0 0 16px' }}>
                  {analysis.summary}
                </p>

                {/* Issues */}
                {analysis.issues.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                    {analysis.issues.map((issue, idx) => (
                      <div key={idx} style={{
                        borderLeft: `4px solid ${issueColor(issue.severity)}`,
                        paddingLeft: 10,
                      }}>
                        <div style={{ fontFamily: 'Geist, sans-serif', fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>
                          {issue.title}
                        </div>
                        {issue.line && (
                          <div style={{ fontFamily: "'Geist Mono','JetBrains Mono',monospace", fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
                            Line {issue.line}
                          </div>
                        )}
                        <div style={{ fontFamily: 'Geist, sans-serif', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                          {issue.description}
                        </div>
                        {issue.fix && (
                          <div>
                            <button onClick={() => setExpandedFix(expandedFix === idx ? null : idx)} style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              fontFamily: 'Geist, sans-serif', fontSize: 11,
                              color: 'var(--text-dim)', padding: 0,
                              display: 'flex', alignItems: 'center', gap: 2,
                            }}>
                              <ChevronRight size={10} style={{ transform: expandedFix === idx ? 'rotate(90deg)' : 'none', transition: 'transform 0.1s' }} />
                              Fix
                            </button>
                            {expandedFix === idx && (
                              <pre style={{
                                fontFamily: "'Geist Mono','JetBrains Mono',monospace",
                                fontSize: 12, color: 'var(--text-muted)',
                                background: 'var(--bg)', padding: 8, borderRadius: 4,
                                margin: '4px 0 0', overflowX: 'auto', whiteSpace: 'pre-wrap' as const,
                              }}>
                                {issue.fix}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Positives */}
                {analysis.positives.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    {analysis.positives.map((p, i) => (
                      <div key={i} style={{ fontFamily: 'Geist, sans-serif', fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>
                        {'✓'} {p}
                      </div>
                    ))}
                  </div>
                )}

                {/* Followup chat */}
                {analysisChat.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    {analysisChat.map((msg, i) => (
                      <p key={i} style={{
                        fontFamily: 'Geist, sans-serif', fontSize: 12,
                        color: msg.startsWith('Q:') ? 'var(--text)' : 'var(--text-muted)',
                        margin: '4px 0', whiteSpace: 'pre-wrap' as const,
                      }}>
                        {msg}
                      </p>
                    ))}
                  </div>
                )}

                {/* Followup input */}
                <div style={{
                  display: 'flex', gap: 6, marginTop: 8,
                  borderTop: '1px solid var(--border)', paddingTop: 12,
                }}>
                  <input
                    value={analysisFollowup}
                    onChange={e => setAnalysisFollowup(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleFollowup() }}
                    placeholder="Ask about this code..."
                    style={{
                      flex: 1, background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 4, padding: '4px 8px', outline: 'none',
                      fontFamily: 'Geist, sans-serif', fontSize: 12, color: 'var(--text)',
                    }}
                  />
                  <button onClick={handleFollowup} style={{
                    background: 'transparent', border: '1px solid var(--border)',
                    borderRadius: 4, padding: '4px 8px', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: 12,
                  }}>
                    Ask
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* FLASH GUIDE DRAWER */}
        {flashGuideOpen && (
          <div style={S.flashDrawer}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
            }}>
              <span style={{ fontFamily: 'Geist, sans-serif', fontSize: 14, color: 'var(--text)' }}>
                How to flash this code
              </span>
              <button onClick={() => setFlashGuideOpen(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-dim)', display: 'flex',
              }}>
                <X size={14} />
              </button>
            </div>
            <p style={{
              fontFamily: 'Geist, sans-serif', fontSize: 13,
              color: 'var(--text-muted)', lineHeight: 1.6,
              whiteSpace: 'pre-wrap' as const, margin: '0 0 16px',
            }}>
              {flashGuideContent()}
            </p>
            <button onClick={() => { setTermTab('serial'); setFlashGuideOpen(false); setSidebarMode('serial') }} style={{
              border: '1px solid var(--border-bright, var(--border))',
              color: 'var(--text-muted)', background: 'transparent',
              borderRadius: 4, padding: '6px 12px', cursor: 'pointer',
              fontFamily: 'Geist, sans-serif', fontSize: 12,
            }}>
              Open Serial Monitor
            </button>
          </div>
        )}
        </div>
        {/* TERMINAL — second child of vertical ResizablePanel */}
        <div style={{ ...S.terminal, height: '100%' }}>

        {/* Terminal header */}
        <div style={S.termHeader}>
          {/* Tabs */}
          {(['output', 'serial', 'problems'] as TerminalTab[]).map(tab => (
            <button key={tab} onClick={() => setTermTab(tab)} style={S.termTab(termTab === tab)}>
              {tab === 'serial' && serialConnected && (
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#4caf50', display: 'inline-block', marginRight: 5,
                }} />
              )}
              {tab === 'output' ? 'Output' : tab === 'serial' ? 'Serial' : `Problems${problems.length > 0 ? ` (${problems.length})` : ''}`}
            </button>
          ))}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {termTab === 'serial' && (
              <>
                {serialConnected ? (
                  <>
                    <span style={{ fontFamily: "'Geist Mono','JetBrains Mono',monospace", fontSize: 11, color: 'var(--text-muted)' }}>
                      Connected · {baudRate}
                    </span>
                    <button onClick={disconnectSerial} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: 'Geist, sans-serif', fontSize: 11, color: 'var(--text-dim)',
                    }}>
                      Disconnect
                    </button>
                  </>
                ) : !hasSerial ? null : (
                  <button onClick={connectSerial} disabled={serialConnecting} style={{
                    background: 'transparent',
                    border: '1px solid var(--border-bright, var(--border))',
                    borderRadius: 4, padding: '2px 8px', cursor: serialConnecting ? 'not-allowed' : 'pointer',
                    fontFamily: 'Geist, sans-serif', fontSize: 11, color: 'var(--text-muted)',
                    opacity: serialConnecting ? 0.6 : 1,
                  }}>
                    {serialConnecting ? 'Connecting...' : 'Connect'}
                  </button>
                )}
              </>
            )}
            <button onClick={() => {
              if (termTab === 'serial') setSerialOutput([])
              else if (termTab === 'problems') setProblems([])
              else setOutput([])
            }} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'Geist, sans-serif', fontSize: 11, color: 'var(--text-dim)',
            }}>
              Clear
            </button>
          </div>
        </div>

        {/* Serial tab: connect prompt or output */}
        {termTab === 'serial' && !serialConnected && serialOutput.length === 0 ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16,
          }}>
            {!hasSerial ? (
              <span style={{ fontFamily: 'Geist, sans-serif', fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
                Web Serial requires Chrome or Edge. Firefox and Safari are not supported.
              </span>
            ) : (
              <>
                <span style={{ fontFamily: 'Geist, sans-serif', fontSize: 14, color: 'var(--text)' }}>
                  Connect a device
                </span>
                <span style={{ fontFamily: 'Geist, sans-serif', fontSize: 13, color: 'var(--text-muted)' }}>
                  Reads serial output from any USB microcontroller
                </span>

                {/* Baud rate picker */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, justifyContent: 'center' }}>
                  {[9600, 19200, 38400, 57600, 115200, 230400, 921600].map(b => (
                    <button key={b} onClick={() => setBaudRate(b)} style={{
                      background: b === baudRate ? 'var(--surface-2, rgba(255,255,255,0.08))' : 'transparent',
                      border: `1px solid ${b === baudRate ? 'var(--border-bright, var(--border))' : 'var(--border)'}`,
                      color: b === baudRate ? 'var(--text)' : 'var(--text-muted)',
                      borderRadius: 4, padding: '3px 8px', cursor: 'pointer',
                      fontFamily: "'Geist Mono','JetBrains Mono',monospace", fontSize: 11,
                    }}>
                      {b}
                    </button>
                  ))}
                </div>

                <button onClick={connectSerial} disabled={serialConnecting} style={{
                  border: '1px solid var(--border-bright, var(--border))',
                  color: 'var(--text-muted)', background: 'transparent',
                  borderRadius: 4, padding: '6px 16px', cursor: 'pointer',
                  fontFamily: 'Geist, sans-serif', fontSize: 12,
                }}>
                  {serialConnecting ? 'Connecting...' : 'Connect →'}
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Output body */}
            <div
              ref={termTab === 'serial' ? serialBodyRef : termBodyRef}
              style={S.termBody}
              onScroll={e => {
                const el = e.currentTarget
                const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 50
                if (termTab === 'serial') pauseSerialScroll.current = !atBottom
                else pauseAutoScroll.current = !atBottom
              }}
            >
              {activeTermOutput.map(line => (
                <div key={line.id} style={{ color: lineColor(line.type) }}>
                  {termTab === 'serial' && line.type === 'serial_in' && (
                    <span style={{ color: 'var(--text-dim)', marginRight: 4 }}>{line.ts} │</span>
                  )}
                  {linePrefix(line.type)}{line.text}
                </div>
              ))}
            </div>

            {/* Serial send bar */}
            {termTab === 'serial' && serialConnected && (
              <div style={S.serialSendBar}>
                <span style={{ fontFamily: "'Geist Mono','JetBrains Mono',monospace", fontSize: 12, color: 'var(--text-dim)' }}>
                  →
                </span>
                <input
                  value={serialInput}
                  onChange={e => setSerialInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendSerial() }}
                  placeholder="Send command..."
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontFamily: "'Geist Mono','JetBrains Mono',monospace",
                    fontSize: 12, color: 'var(--text)',
                  }}
                />
                <span style={{ fontFamily: "'Geist Mono','JetBrains Mono',monospace", fontSize: 11, color: 'var(--text-dim)' }}>
                  {baudRate} baud
                </span>
              </div>
            )}
          </>
        )}
        </div>
      </ResizablePanel>
      </div>
    </div>
  )
}
