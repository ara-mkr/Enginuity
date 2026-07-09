import { useState, useRef, useCallback, useEffect } from 'react'
import { useAIProvider } from '../../hooks/useAIProvider'
import { useProjectContext } from '../../hooks/useProjectContext'
import { useProbeContext } from '../../hooks/useProbeContext'
import { logEvent } from '../../engine/eventLog'
// @ts-ignore
import { useEnginguityStore } from '../../engine/persistenceEngine'
// @ts-ignore
import ResizablePanel from '../../components/ResizablePanel'
import {
  Play, Download, Copy, ChevronDown, ChevronRight,
  Pencil, Check, X, FileCode, Loader2, AlertCircle
} from 'lucide-react'
import { parseSignature } from './parseSignature'
import { generatePytestFile, generateJestFile } from './codeGenerator'
import type {
  Language, Framework, Priority, TestCase, TestResult,
  RunSummary, ParamType, ParsedSignature
} from './types'

// ── Constants ─────────────────────────────────────────────────────────────────

const FOCUS_AREAS = [
  'Zero values', 'Negative values', 'Maximum values', 'Overflow',
  'Type coercion', 'Null/undefined', 'Float precision', 'Empty inputs',
  'Boundary conditions', 'Performance', 'Error handling',
]

const PARAM_TYPES = ['number', 'string', 'boolean', 'array', 'object', 'any'] as const

const PY_PLACEHOLDER = `# Paste your function here
def calculate_duty_cycle(voltage_in, voltage_out):
    return voltage_out / voltage_in`

const JS_PLACEHOLDER = `// Paste your function here
function calculateDutyCycle(voltageIn, voltageOut) {
  return voltageOut / voltageIn;
}`

// ── Helpers ───────────────────────────────────────────────────────────────────

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < 1e-9
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, (b as unknown[])[i]))
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as object).sort()
    const bk = Object.keys(b as object).sort()
    return JSON.stringify(ak) === JSON.stringify(bk) &&
      ak.every(k => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  }
  return false
}

// Runs generated test code inside a sandboxed iframe. `allow-scripts` WITHOUT
// `allow-same-origin` gives the frame an opaque origin, so it gets its own
// empty storage partition and cannot read this app's sessionStorage/IndexedDB
// (where the API key lives). The user's code and inputs arrive over postMessage
// — never interpolated into this HTML — and only JSON-safe results come back.
const JS_SANDBOX_HTML = `<!doctype html><meta charset="utf-8"><script>
function deepEqual(a,b){
  if(a===b)return true;
  if(typeof a!==typeof b)return false;
  if(typeof a==='number'&&typeof b==='number')return Math.abs(a-b)<1e-9;
  if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every(function(v,i){return deepEqual(v,b[i]);});
  if(a&&b&&typeof a==='object'&&typeof b==='object'){
    var ak=Object.keys(a).sort(),bk=Object.keys(b).sort();
    return JSON.stringify(ak)===JSON.stringify(bk)&&ak.every(function(k){return deepEqual(a[k],b[k]);});
  }
  return false;
}
function safe(v){try{return JSON.parse(JSON.stringify(v));}catch(e){return String(v);}}
addEventListener('message',function(e){
  var d=e.data||{},cases=d.cases||[],out=[];
  for(var i=0;i<cases.length;i++){
    var tc=cases[i],start=performance.now();
    try{
      (0,eval)(d.code);
      var fn=(0,eval)('('+d.funcName+')');
      if(tc.expected_behavior==='throw_error'){
        try{fn.apply(null,tc.args);out.push({id:tc.id,passed:false,actual:'No error thrown',expected:'Should throw',runtime:performance.now()-start});}
        catch(err){out.push({id:tc.id,passed:true,actual:'threw error',runtime:performance.now()-start});}
      }else{
        var actual=fn.apply(null,tc.args);
        out.push({id:tc.id,passed:deepEqual(actual,tc.expected_output),actual:safe(actual),expected:tc.expected_output,runtime:performance.now()-start});
      }
    }catch(err){
      out.push({id:tc.id,passed:false,error:(err&&err.message)||String(err),runtime:performance.now()-start});
    }
  }
  parent.postMessage({__testHarness:true,results:out},'*');
});
<\/script>`

function priorityOrder(p: Priority): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[p]
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'idle' | 'passed' | 'failed' | 'error' }) {
  const color = status === 'passed' ? '#7aaa8a'
    : status === 'failed' ? '#b08080'
    : status === 'error' ? '#b09a60'
    : 'var(--border-bright)'
  return (
    <div style={{
      width: 8, height: 8, borderRadius: '50%',
      background: color, flexShrink: 0,
      border: status === 'idle' ? '1px solid var(--border-bright)' : 'none',
    }} />
  )
}

interface TestCardProps {
  tc: TestCase
  result: TestResult | undefined
  selected: boolean
  onSelect: (id: string) => void
  onEdit: (tc: TestCase) => void
  aiExplain: string | null
  onAskAI: (tc: TestCase) => void
  loadingExplain: boolean
}

function TestCard({ tc, result, selected, onSelect, onEdit, aiExplain, onAskAI, loadingExplain }: TestCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [explainOpen, setExplainOpen] = useState(false)
  const status = result
    ? result.error ? 'error' : result.passed ? 'passed' : 'failed'
    : 'idle'

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: result && !result.passed ? '2px solid #b08080' : '1px solid var(--border)',
      borderRadius: 6,
      padding: '10px 12px',
      marginBottom: 6,
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(tc.id)}
          style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--accent)' }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-dim)' }}>
              {tc.id}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{tc.description}</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{tc.priority}</span>
            <StatusDot status={status} />
          </div>
          {/* Inputs row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
            {Object.entries(tc.inputs).map(([k, v]) => (
              <span key={k} style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
                color: 'var(--text-muted)', background: 'var(--bg-2)',
                borderRadius: 4, padding: '4px 8px', display: 'inline-block',
              }}>
                {k} = {JSON.stringify(v)}
              </span>
            ))}
          </div>
          {/* Expected row */}
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-dim)' }}>
            {tc.expected_behavior === 'throw_error'
              ? 'Expected: throws error'
              : `Expected: ${JSON.stringify(tc.expected_output)}`}
          </div>
          {/* Diff if failed */}
          {result && !result.passed && !result.error && (
            <div style={{ marginTop: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
              <div style={{ color: 'var(--text-muted)' }}>Expected: {JSON.stringify(result.expected)}</div>
              <div style={{ color: '#b08080' }}>Actual:   {JSON.stringify(result.actual)}</div>
            </div>
          )}
          {result?.error && (
            <div style={{ marginTop: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#b09a60' }}>
              Error: {result.error}
            </div>
          )}
          {/* Ask AI / explain */}
          {result && !result.passed && (
            <div style={{ marginTop: 8 }}>
              <button
                className="btn"
                style={{ fontSize: 11, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={() => { setExplainOpen(true); onAskAI(tc) }}
              >
                {loadingExplain ? <Loader2 size={11} className="animate-spin" /> : null}
                Ask AI why →
              </button>
              {explainOpen && aiExplain && (
                <div style={{
                  marginTop: 8, fontSize: 12, color: 'var(--text-muted)',
                  background: 'var(--bg-2)', borderRadius: 4, padding: '8px 10px',
                  lineHeight: 1.6,
                }}>
                  {aiExplain}
                </div>
              )}
            </div>
          )}
        </div>
        {/* Edit button */}
        <button
          className="btn"
          title="Edit test case"
          style={{ opacity: 0, padding: '3px 6px', flexShrink: 0 }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
          onClick={() => onEdit(tc)}
        >
          <Pencil size={11} />
        </button>
      </div>
      {/* Reasoning toggle */}
      <button
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 0 24px',
          fontSize: 11, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4,
        }}
        onClick={() => setExpanded(e => !e)}
      >
        Why {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
      </button>
      {expanded && (
        <div style={{ padding: '4px 0 0 24px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {tc.reasoning}
        </div>
      )}
    </div>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({ tc, onSave, onClose }: { tc: TestCase; onSave: (updated: TestCase) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<TestCase>({ ...tc })
  const [inputsText, setInputsText] = useState(JSON.stringify(tc.inputs, null, 2))
  const [expectedText, setExpectedText] = useState(JSON.stringify(tc.expected_output, null, 2))
  const [parseError, setParseError] = useState('')

  const save = () => {
    try {
      const inputs = JSON.parse(inputsText)
      const expected_output = JSON.parse(expectedText)
      onSave({ ...draft, inputs, expected_output })
    } catch {
      setParseError('Invalid JSON')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 8, padding: 24, width: 480, maxHeight: '80vh', overflow: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--text)' }}>Edit {tc.id}</span>
          <button className="btn" style={{ padding: '2px 6px' }} onClick={onClose}><X size={13} /></button>
        </div>
        <div className="label" style={{ marginBottom: 4 }}>Description</div>
        <input
          className="input"
          style={{ width: '100%', marginBottom: 12, boxSizing: 'border-box' }}
          value={draft.description}
          onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
        />
        <div className="label" style={{ marginBottom: 4 }}>Inputs (JSON)</div>
        <textarea
          className="input"
          style={{ width: '100%', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, minHeight: 80, marginBottom: 12, boxSizing: 'border-box' }}
          value={inputsText}
          onChange={e => setInputsText(e.target.value)}
        />
        <div className="label" style={{ marginBottom: 4 }}>Expected output (JSON)</div>
        <textarea
          className="input"
          style={{ width: '100%', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, minHeight: 60, marginBottom: 12, boxSizing: 'border-box' }}
          value={expectedText}
          onChange={e => setExpectedText(e.target.value)}
        />
        {parseError && <div style={{ color: '#b08080', fontSize: 12, marginBottom: 8 }}>{parseError}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function TestHarness() {
  const ai = useAIProvider()
  const project = useProjectContext()

  // Persisted slice — survives navigation/refresh (src/engine/persistenceEngine.js)
  const setTestHarnessState = useEnginguityStore((s: any) => s.setTestHarnessState)
  const persisted = useEnginguityStore.getState().testHarness

  // Left panel state
  const [language, setLanguage] = useState<Language>(persisted.language)
  const [code, setCode] = useState(persisted.code)
  const [context, setContext] = useState(persisted.context)
  const [sig, setSig] = useState<ParsedSignature | null>(null)
  const [paramTypes, setParamTypes] = useState<Record<string, ParamType['type']>>(persisted.paramTypes)
  const [focusAreas, setFocusAreas] = useState<string[]>(persisted.focusAreas)
  const [count, setCount] = useState<10 | 20 | 50>(persisted.count)
  const [framework, setFramework] = useState<Framework>(persisted.framework)
  const [generating, setGenerating] = useState(false)

  // Center panel state
  const [testCases, setTestCases] = useState<TestCase[]>(persisted.testCases)
  const [selected, setSelected] = useState<Set<string>>(new Set(persisted.selected))
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>(persisted.filterPriority)
  const [filterCategory, setFilterCategory] = useState(persisted.filterCategory)
  const [search, setSearch] = useState(persisted.search)
  const [editingTc, setEditingTc] = useState<TestCase | null>(null)

  // Right panel state
  const [results, setResults] = useState<Map<string, TestResult>>(new Map(persisted.results))
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState<RunSummary | null>(persisted.summary)
  const [explains, setExplains] = useState<Map<string, string>>(new Map())
  const [loadingExplain, setLoadingExplain] = useState<string | null>(null)

  // Code file output
  const [showCodeOutput, setShowCodeOutput] = useState(false)
  const [generatedCode, setGeneratedCode] = useState('')

  useProbeContext('test-harness', {
    language,
    functionName: sig?.functionName ?? null,
    testCaseCount: testCases.length,
    selectedCount: selected.size,
    running,
    passed: summary?.passed ?? null,
    failed: summary?.failed ?? null,
  })

  // Write-through: mirror function/tests/results into the global store so a
  // navigation away doesn't lose the pasted function or generated test run.
  useEffect(() => {
    setTestHarnessState({
      language, code, context, paramTypes, focusAreas, count, framework,
      testCases, selected: [...selected], filterPriority, filterCategory, search,
      results: [...results.entries()], summary,
    })
  }, [
    language, code, context, paramTypes, focusAreas, count, framework,
    testCases, selected, filterPriority, filterCategory, search, results, summary,
    setTestHarnessState,
  ])

  // Parse signature on code change
  useEffect(() => {
    if (!code.trim()) { setSig(null); return }
    const parsed = parseSignature(code, language)
    if (parsed) {
      setSig(parsed)
      setParamTypes(prev => {
        const next: Record<string, ParamType['type']> = {}
        parsed.params.forEach(p => { next[p.name] = prev[p.name] ?? 'any' })
        return next
      })
    }
  }, [code, language])

  // Switch framework when language changes
  useEffect(() => {
    if (language === 'python') setFramework('pytest')
    else setFramework('jest')
  }, [language])

  const toggleFocus = (area: string) => {
    setFocusAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area])
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === testCases.length) setSelected(new Set())
    else setSelected(new Set(testCases.map(t => t.id)))
  }

  // ── Generate tests ──────────────────────────────────────────────────────────

  const generate = async () => {
    if (!code.trim()) return
    setGenerating(true)
    setTestCases([])
    setResults(new Map())
    setSummary(null)

    const paramTypesStr = sig
      ? sig.params.map(p => `${p.name}: ${paramTypes[p.name] ?? 'any'}`).join(', ')
      : 'unknown'

    const system = `You are a senior software engineer and testing expert. You generate thorough, realistic test cases that find real bugs. You think about: boundary conditions, overflow, underflow, floating point precision, type coercion, null/undefined inputs, empty collections, maximum values, negative values, and any domain-specific edge cases the function description suggests. Return ONLY valid JSON.`

    const prompt = `Generate test cases for this ${language} function:

${code}

Function context: ${context || 'not provided'}
Parameter types: ${paramTypesStr}
Focus areas: ${focusAreas.join(', ')}

Generate exactly ${count} test cases.

Return a JSON array where each item is:
{
  "id": "t001",
  "description": "one sentence what this tests",
  "category": "edge case category",
  "inputs": { "param_name": value },
  "expected_output": "what the function should return",
  "expected_behavior": "return_value" | "throw_error" | "return_null" | "return_empty",
  "reasoning": "why this is an important test case",
  "priority": "critical" | "high" | "medium" | "low"
}`

    try {
      const raw = await ai.makeRequest([{ role: 'user', content: prompt }], system, { maxTokens: 6000, temperature: 0.4 })
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const arr = JSON.parse(cleaned) as TestCase[]
      setTestCases(arr.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority)))
      setSelected(new Set(arr.map(t => t.id)))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      alert('Generation failed: ' + msg)
    } finally {
      setGenerating(false)
    }
  }

  // ── Run tests (JS sandbox) ──────────────────────────────────────────────────

  const runJS = useCallback(async (toRun: TestCase[]): Promise<TestResult[]> => {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe')
      iframe.style.display = 'none'
      // Opaque-origin sandbox: the generated code cannot reach this app's
      // storage or DOM. It talks back only over postMessage (see JS_SANDBOX_HTML).
      iframe.setAttribute('sandbox', 'allow-scripts')
      iframe.srcdoc = JS_SANDBOX_HTML

      const cases = toRun.map((tc) => ({
        id: tc.id,
        args: Object.values(tc.inputs),
        expected_behavior: tc.expected_behavior,
        expected_output: tc.expected_output,
      }))

      let settled = false
      const onMessage = (e: MessageEvent) => {
        if (e.source !== iframe.contentWindow) return
        const d = e.data as { __testHarness?: boolean; results?: TestResult[] }
        if (!d || d.__testHarness !== true) return
        finish(d.results ?? [])
      }
      const finish = (results: TestResult[]) => {
        if (settled) return
        settled = true
        window.removeEventListener('message', onMessage)
        clearTimeout(timer)
        if (iframe.parentNode) document.body.removeChild(iframe)
        resolve(results)
      }

      // Guard against a frame that never replies (e.g. a runaway async case).
      // A synchronous infinite loop still blocks the thread — that limit is
      // inherent to running untrusted code in-page and is unchanged here.
      const timer = setTimeout(() => {
        finish(toRun.map((tc) => ({ id: tc.id, passed: false, error: 'Test run timed out.', runtime: 0 })))
      }, 10000)

      window.addEventListener('message', onMessage)
      iframe.onload = () => {
        iframe.contentWindow?.postMessage({ code, funcName: sig?.functionName ?? '', cases }, '*')
      }
      document.body.appendChild(iframe)
    })
  }, [code, sig])

  const runPython = useCallback(async (toRun: TestCase[]): Promise<TestResult[]> => {
    const pyodide = await (window as Window & { loadPyodide?: () => Promise<unknown> }).loadPyodide?.()
    if (!pyodide) throw new Error('Pyodide not loaded')
    const results: TestResult[] = []

    try {
      await (pyodide as { runPythonAsync: (code: string) => Promise<unknown> }).runPythonAsync(code)
    } catch (e: unknown) {
      throw new Error('Function failed to load: ' + (e instanceof Error ? e.message : String(e)))
    }

    const funcName = sig?.functionName ?? ''
    for (const tc of toRun) {
      const start = performance.now()
      try {
        const args = Object.values(tc.inputs).map(v => JSON.stringify(v)).join(', ')
        const callCode = `${funcName}(${args})`
        if (tc.expected_behavior === 'throw_error') {
          try {
            await (pyodide as { runPythonAsync: (code: string) => Promise<unknown> }).runPythonAsync(callCode)
            results.push({ id: tc.id, passed: false, actual: 'No error thrown', expected: 'Should throw', runtime: performance.now() - start })
          } catch {
            results.push({ id: tc.id, passed: true, actual: 'threw error', runtime: performance.now() - start })
          }
        } else {
          const actual = await (pyodide as { runPythonAsync: (code: string) => Promise<unknown> }).runPythonAsync(callCode)
          const passed = deepEqual(actual, tc.expected_output)
          results.push({ id: tc.id, passed, actual, expected: tc.expected_output, runtime: performance.now() - start })
        }
      } catch (e: unknown) {
        results.push({ id: tc.id, passed: false, error: e instanceof Error ? e.message : String(e), runtime: performance.now() - start })
      }
    }
    return results
  }, [code, sig])

  const run = async (ids?: Set<string>) => {
    const toRun = ids ? testCases.filter(t => ids.has(t.id)) : testCases
    if (!toRun.length) return
    setRunning(true)
    try {
      let res: TestResult[]
      if (language === 'python') {
        res = await runPython(toRun)
      } else {
        res = await runJS(toRun)
      }
      const map = new Map(results)
      res.forEach(r => map.set(r.id, r))
      setResults(map)

      const passed = res.filter(r => r.passed).length
      const errors = res.filter(r => r.error).length
      const failed = res.filter(r => !r.passed && !r.error).length
      const total = res.length
      const totalRuntime = res.reduce((s, r) => s + r.runtime, 0)
      setSummary(prev => prev
        ? { total: prev.total, passed: prev.passed + passed, failed: prev.failed + failed, errors: prev.errors + errors, totalRuntime: prev.totalRuntime + totalRuntime }
        : { total, passed, failed, errors, totalRuntime }
      )
      logEvent('TESTS_RUN', {
        functionName: sig?.functionName ?? 'unknown',
        language,
        total,
        passed,
        failed: failed + errors,
        module: 'test-harness',
      })
    } catch (e: unknown) {
      alert('Run failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setRunning(false)
    }
  }

  const runAll = () => {
    setResults(new Map())
    setSummary(null)
    run()
  }

  const runSelected = () => run(selected)

  // ── Ask AI why ──────────────────────────────────────────────────────────────

  const askAIWhy = async (tc: TestCase) => {
    const result = results.get(tc.id)
    if (!result) return
    setLoadingExplain(tc.id)
    try {
      const prompt = `This test failed.\nFunction:\n${code}\n\nInput: ${JSON.stringify(tc.inputs)}\nExpected: ${JSON.stringify(tc.expected_output)}\nGot: ${JSON.stringify(result.actual)}\n${result.error ? `Error: ${result.error}` : ''}\n\nExplain why this failed and suggest a fix. Be concise (3-5 sentences).`
      const explanation = await ai.makeRequest([{ role: 'user', content: prompt }], undefined, { maxTokens: 300 })
      setExplains(prev => new Map(prev).set(tc.id, explanation))
    } finally {
      setLoadingExplain(null)
    }
  }

  // ── Generate code file ──────────────────────────────────────────────────────

  const buildCodeFile = () => {
    const fn = sig?.functionName ?? 'myFunction'
    const code_ = language === 'python'
      ? generatePytestFile(fn, testCases, framework)
      : generateJestFile(fn, testCases, framework)
    setGeneratedCode(code_)
    setShowCodeOutput(true)
  }

  const downloadCodeFile = () => {
    const fn = sig?.functionName ?? 'myFunction'
    const ext = language === 'python' ? 'py' : 'test.js'
    const blob = new Blob([generatedCode], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `test_${fn}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Filtered test cases ─────────────────────────────────────────────────────

  const categories = [...new Set(testCases.map(t => t.category))]

  const filtered = testCases.filter(tc => {
    if (filterPriority !== 'all' && tc.priority !== filterPriority) return false
    if (filterCategory && tc.category !== filterCategory) return false
    if (search && !tc.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const failedResults = [...results.values()].filter(r => !r.passed)
  const passedResults = [...results.values()].filter(r => r.passed)

  // ── Render ──────────────────────────────────────────────────────────────────

  const leftPanel = (
    <div style={{ height: '100%', overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Language selector */}
      <div>
        <div className="label" style={{ marginBottom: 8 }}>Function to test</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {(['python', 'javascript', 'typescript'] as Language[]).map(lang => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              style={{
                flex: 1, padding: '5px 0', fontSize: 12,
                background: language === lang ? 'var(--surface-2)' : 'var(--surface)',
                border: `1px solid ${language === lang ? 'var(--border-bright)' : 'var(--border)'}`,
                color: language === lang ? 'var(--text)' : 'var(--text-muted)',
                borderRadius: 5, cursor: 'pointer', transition: 'all 120ms',
                textTransform: 'capitalize',
              }}
            >
              {lang === 'typescript' ? 'TypeScript' : lang === 'javascript' ? 'JavaScript' : 'Python'}
            </button>
          ))}
        </div>

        {/* Code editor */}
        <textarea
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder={language === 'python' ? PY_PLACEHOLDER : JS_PLACEHOLDER}
          style={{
            width: '100%', boxSizing: 'border-box',
            minHeight: 200, fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            color: 'var(--text)', borderRadius: 6, padding: '10px 12px',
            resize: 'vertical', outline: 'none', lineHeight: 1.6,
          }}
        />
      </div>

      {/* Parsed signature */}
      {sig && (
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Detected signature</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            {sig.functionName}({sig.params.map(p => p.name).join(', ')})
          </div>
          {sig.params.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sig.params.map(p => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-dim)', minWidth: 100 }}>{p.name}</span>
                  <select
                    value={paramTypes[p.name] ?? 'any'}
                    onChange={e => setParamTypes(prev => ({ ...prev, [p.name]: e.target.value as ParamType['type'] }))}
                    style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      color: 'var(--text-muted)', borderRadius: 4, padding: '2px 6px',
                      fontSize: 11, cursor: 'pointer', outline: 'none',
                    }}
                  >
                    {PARAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Context */}
      <div>
        <div className="label" style={{ marginBottom: 6 }}>What does this function do? <span style={{ color: 'var(--text-dim)' }}>(optional)</span></div>
        <textarea
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder={`Calculates PWM duty cycle for a buck converter.\nvoltage_in is always > voltage_out.\nBoth are in volts (0-48V range).`}
          style={{
            width: '100%', boxSizing: 'border-box',
            height: 72, fontFamily: 'DM Sans, system-ui', fontSize: 12,
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            color: 'var(--text-muted)', borderRadius: 6, padding: '8px 10px',
            resize: 'none', outline: 'none', lineHeight: 1.5,
          }}
        />
      </div>

      {/* Test config */}
      <div>
        <div className="label" style={{ marginBottom: 8 }}>Test configuration</div>

        {/* Count */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Number of test cases</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {([10, 20, 50] as const).map(n => (
              <button
                key={n}
                onClick={() => setCount(n)}
                style={{
                  flex: 1, padding: '5px 0', fontSize: 12,
                  background: count === n ? 'var(--surface-2)' : 'var(--surface)',
                  border: `1px solid ${count === n ? 'var(--border-bright)' : 'var(--border)'}`,
                  color: count === n ? 'var(--text)' : 'var(--text-muted)',
                  borderRadius: 5, cursor: 'pointer', transition: 'all 120ms',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Focus areas */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Focus areas</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {FOCUS_AREAS.map(area => (
              <button
                key={area}
                onClick={() => toggleFocus(area)}
                style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                  background: focusAreas.includes(area) ? 'var(--surface-2)' : 'var(--surface)',
                  border: `1px solid ${focusAreas.includes(area) ? 'var(--border-bright)' : 'var(--border)'}`,
                  color: focusAreas.includes(area) ? 'var(--text)' : 'var(--text-dim)',
                  transition: 'all 120ms',
                }}
              >
                {area}
              </button>
            ))}
          </div>
        </div>

        {/* Framework */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Framework</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(language === 'python'
              ? (['pytest', 'unittest'] as Framework[])
              : (['jest', 'mocha', 'vitest'] as Framework[])
            ).map(fw => (
              <button
                key={fw}
                onClick={() => setFramework(fw)}
                style={{
                  padding: '4px 10px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
                  background: framework === fw ? 'var(--surface-2)' : 'var(--surface)',
                  border: `1px solid ${framework === fw ? 'var(--border-bright)' : 'var(--border)'}`,
                  color: framework === fw ? 'var(--text)' : 'var(--text-dim)',
                  transition: 'all 120ms',
                }}
              >
                {fw}
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '9px 0', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          disabled={!code.trim() || generating}
          onClick={generate}
        >
          {generating ? <><Loader2 size={13} className="animate-spin" /> Generating…</> : 'Generate Tests'}
        </button>
      </div>
    </div>
  )

  const centerPanel = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)' }}>
      {/* Filter row */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'critical', 'high', 'medium', 'low'] as const).map(p => (
          <button
            key={p}
            onClick={() => setFilterPriority(p)}
            style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
              background: filterPriority === p ? 'var(--surface-2)' : 'transparent',
              border: `1px solid ${filterPriority === p ? 'var(--border-bright)' : 'transparent'}`,
              color: filterPriority === p ? 'var(--text)' : 'var(--text-dim)',
              transition: 'all 120ms', textTransform: 'capitalize',
            }}
          >
            {p === 'all' ? 'All' : p}
          </button>
        ))}
        {categories.length > 0 && (
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--text-muted)', borderRadius: 4, padding: '3px 6px', fontSize: 11, outline: 'none',
            }}
          >
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <input
          className="input"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 8px', width: 120 }}
        />
      </div>

      {/* Select all + run buttons */}
      {testCases.length > 0 && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={selected.size === testCases.length}
              onChange={toggleAll}
              style={{ accentColor: 'var(--accent)' }}
            />
            {selected.size === testCases.length ? 'Deselect all' : `Select all (${testCases.length})`}
          </label>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button
              className="btn"
              style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={runSelected}
              disabled={running || selected.size === 0}
            >
              <Play size={10} /> Run selected ({selected.size})
            </button>
            <button
              className="btn btn-primary"
              style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={runAll}
              disabled={running}
            >
              {running ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
              Run all
            </button>
            <button
              className="btn"
              style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={buildCodeFile}
            >
              <FileCode size={10} /> Generate file
            </button>
          </div>
        </div>
      )}

      {/* Test list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {!testCases.length && !generating && (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', marginTop: 60 }}>
            Paste a function and click Generate Tests
          </div>
        )}
        {generating && (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
            Generating {count} test cases…
          </div>
        )}
        {filtered.map(tc => (
          <TestCard
            key={tc.id}
            tc={tc}
            result={results.get(tc.id)}
            selected={selected.has(tc.id)}
            onSelect={toggleSelect}
            onEdit={setEditingTc}
            aiExplain={explains.get(tc.id) ?? null}
            onAskAI={askAIWhy}
            loadingExplain={loadingExplain === tc.id}
          />
        ))}
      </div>
    </div>
  )

  const rightPanel = (
    <div style={{ height: '100%', overflow: 'auto', padding: 16, borderLeft: '1px solid var(--border)' }}>
      {!summary && !running && (
        <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', marginTop: 60 }}>
          Run tests to see results
        </div>
      )}
      {running && (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
          Running tests…
        </div>
      )}

      {/* Summary card */}
      {summary && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 16, marginBottom: 16,
        }}>
          <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>
            {summary.passed} / {summary.total} passed
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            <span>✓ {summary.passed} passed</span>
            <span>✕ {summary.failed} failed</span>
            <span>⚠ {summary.errors} errors</span>
          </div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-dim)' }}>
            Completed in {summary.totalRuntime.toFixed(1)}ms
          </div>
        </div>
      )}

      {/* Failed tests */}
      {failedResults.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Failed ({failedResults.length})</div>
          {failedResults.map(r => {
            const tc = testCases.find(t => t.id === r.id)
            if (!tc) return null
            return (
              <div key={r.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderLeft: '2px solid #b08080', borderRadius: 6, padding: 12, marginBottom: 8,
              }}>
                <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--text-dim)', marginRight: 8 }}>{r.id}</span>
                  {tc.description}
                </div>
                {r.error ? (
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#b09a60' }}>{r.error}</div>
                ) : (
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                    <div style={{ color: 'var(--text-muted)' }}>Expected: {JSON.stringify(r.expected)}</div>
                    <div style={{ color: '#b08080' }}>Actual:   {JSON.stringify(r.actual)}</div>
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
                  {r.runtime.toFixed(1)}ms
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Passed tests (collapsed) */}
      {passedResults.length > 0 && (
        <PassedSection results={passedResults} testCases={testCases} />
      )}
    </div>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Test Harness</span>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>AI-generated edge case tests</span>
      </div>

      {/* Three-column layout */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ResizablePanel
          direction="horizontal"
          initialSplit={0.35}
          minFirst={220}
          minSecond={400}
          storageKey="test-harness-left"
        >
          {leftPanel}
          <ResizablePanel
            direction="horizontal"
            initialSplit={0.54}
            minFirst={220}
            minSecond={200}
            storageKey="test-harness-center"
          >
            {centerPanel}
            {rightPanel}
          </ResizablePanel>
        </ResizablePanel>
      </div>

      {/* Edit modal */}
      {editingTc && (
        <EditModal
          tc={editingTc}
          onSave={updated => {
            setTestCases(prev => prev.map(t => t.id === updated.id ? updated : t))
            setEditingTc(null)
          }}
          onClose={() => setEditingTc(null)}
        />
      )}

      {/* Code output modal */}
      {showCodeOutput && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 24, width: 640, maxHeight: '80vh',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>Generated test file</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn"
                  style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={() => navigator.clipboard.writeText(generatedCode)}
                >
                  <Copy size={11} /> Copy
                </button>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={downloadCodeFile}
                >
                  <Download size={11} /> Download
                </button>
                <button className="btn" style={{ padding: '4px 6px' }} onClick={() => setShowCodeOutput(false)}>
                  <X size={13} />
                </button>
              </div>
            </div>
            <pre style={{
              flex: 1, overflow: 'auto', fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-2)',
              borderRadius: 6, padding: '12px 14px', margin: 0, lineHeight: 1.6,
            }}>
              {generatedCode}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Passed section (collapsible) ──────────────────────────────────────────────

function PassedSection({ results, testCases }: { results: TestResult[]; testCases: TestCase[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Passed ({results.length})
      </button>
      {open && results.map(r => {
        const tc = testCases.find(t => t.id === r.id)
        return (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
            <StatusDot status="passed" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>{tc?.description ?? r.id}</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-dim)' }}>{r.runtime.toFixed(1)}ms</span>
          </div>
        )
      })}
    </div>
  )
}
