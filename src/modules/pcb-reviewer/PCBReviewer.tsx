import { useState, useRef, useCallback } from 'react'
import {
  Upload, Loader2, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, Download, RotateCcw
} from 'lucide-react'
import { useAIProvider } from '../../hooks/useAIProvider'
import { useProjectContext } from '../../hooks/useProjectContext'
import { useProbeContext } from '../../hooks/useProbeContext'
import { logEvent } from '../../engine/eventLog'
import { parseFile, buildSchematicContext } from './parser'

// Parsed schematic/board shapes from the untyped parser module, chat
// message payloads, and caught errors are heterogeneous here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PCBAny = any

// ── Types ─────────────────────────────────────────────────────────────────────

interface CriticalIssue {
  title: string
  reference: string
  description: string
  fix: string
  why_it_matters: string
}

interface Warning {
  title: string
  reference: string
  description: string
  fix: string
}

interface Suggestion {
  title: string
  description: string
}

type StatusLevel = 'pass' | 'warn' | 'fail' | 'unknown'

interface CheckCategories {
  decoupling: StatusLevel
  esd_protection: StatusLevel
  power_sequencing: StatusLevel
  signal_integrity: StatusLevel
  thermal: StatusLevel
  manufacturability: StatusLevel
  component_ratings: StatusLevel
  grounding: StatusLevel
}

interface ReviewResult {
  overall_rating: 'pass' | 'pass_with_concerns' | 'needs_work' | 'fail'
  summary: string
  critical_issues: CriticalIssue[]
  warnings: Warning[]
  suggestions: Suggestion[]
  good_practices: string[]
  check_categories: CheckCategories
}

// ── Checklist items ───────────────────────────────────────────────────────────

const CHECKLIST_ITEMS = [
  { id: 'decap_100n', group: 'Power & Decoupling', text: 'Each IC has at least one 100nF decoupling cap' },
  { id: 'decap_placement', group: 'Power & Decoupling', text: 'Decoupling caps placed within 2mm of power pins' },
  { id: 'bulk_cap', group: 'Power & Decoupling', text: 'Bulk capacitance (10µF+) on power rails' },
  { id: 'rail_impedance', group: 'Power & Decoupling', text: 'Power rail impedance appropriate for load current' },
  { id: 'tvs_esd', group: 'Protection', text: 'TVS/ESD protection on all external connectors' },
  { id: 'series_r', group: 'Protection', text: 'Series resistors on high-speed signals at connectors' },
  { id: 'rev_pol', group: 'Protection', text: 'Reverse polarity protection on power input' },
  { id: 'overcurrent', group: 'Protection', text: 'Overcurrent protection (fuse or PTC)' },
  { id: 'impedance_ctrl', group: 'Signal Integrity', text: 'Controlled impedance for >50MHz signals' },
  { id: 'diff_match', group: 'Signal Integrity', text: 'Differential pair length matching' },
  { id: 'no_acute', group: 'Signal Integrity', text: 'No acute angle traces (avoid <45°)' },
  { id: 'gnd_plane', group: 'Signal Integrity', text: 'Ground plane continuity maintained' },
  { id: 'thermal_vias', group: 'Thermal', text: 'Thermal vias under power components' },
  { id: 'thermal_spacing', group: 'Thermal', text: 'Heat-generating components away from temp-sensitive ones' },
  { id: 'copper_pour', group: 'Thermal', text: 'Adequate copper pour for current-carrying traces' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const RATING_LABELS: Record<string, string> = {
  pass: 'Pass',
  pass_with_concerns: 'Pass with concerns',
  needs_work: 'Needs work',
  fail: 'Fail',
}

const RATING_COLORS: Record<string, string> = {
  pass: '#7aaa8a',
  pass_with_concerns: '#b09060',
  needs_work: '#b08460',
  fail: '#b08080',
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  pass: '#7aaa8a',
  warn: '#b09060',
  fail: '#b08080',
  unknown: 'var(--border-bright)',
}

const CATEGORY_LABELS: Record<keyof CheckCategories, string> = {
  decoupling: 'Decoupling',
  esd_protection: 'ESD',
  power_sequencing: 'Power Seq',
  signal_integrity: 'Signal',
  thermal: 'Thermal',
  manufacturability: 'DFM',
  component_ratings: 'Ratings',
  grounding: 'Ground',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DropZone({ onFile, disabled }: { onFile: (f: File) => void; disabled: boolean }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault()
        setDragging(false)
        const f = e.dataTransfer.files?.[0]
        if (f) onFile(f)
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border-bright)'}`,
        borderRadius: 8, padding: '40px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: dragging ? 'var(--accent)/5' : 'var(--surface)',
        transition: 'border-color 0.15s, background 0.15s',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Upload size={32} color="var(--text-muted)" />
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: 'var(--text)', margin: 0, fontFamily: 'Geist, sans-serif' }}>
          Drop your schematic or board file
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '4px 0 0', fontFamily: 'Geist, sans-serif' }}>
          .kicad_sch · .kicad_pcb · .sch · .brd · .json · .svg · .png · .jpg
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".kicad_sch,.kicad_pcb,.sch,.brd,.json,.svg,.png,.jpg,.jpeg"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
    </div>
  )
}

function StatusDot({ status }: { status: StatusLevel }) {
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      background: STATUS_COLORS[status], flexShrink: 0
    }} />
  )
}

function IssueCard({ issue, borderColor }: { issue: CriticalIssue | Warning; borderColor: string }) {
  const [expanded, setExpanded] = useState(false)
  const hasFix = !!(issue as CriticalIssue).why_it_matters || issue.fix

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderLeft: `2px solid ${borderColor}`, borderRadius: 6, padding: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 14, color: 'var(--text)', fontFamily: 'Geist, sans-serif' }}>
          {issue.title}
        </span>
        {issue.reference && (
          <span style={{
            fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Geist Mono, monospace',
            background: 'var(--bg-2)', padding: '2px 6px', borderRadius: 3,
            whiteSpace: 'nowrap', flexShrink: 0
          }}>
            {issue.reference}
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5, fontFamily: 'Geist, sans-serif' }}>
        {issue.description}
      </p>
      {hasFix && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setExpanded(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif'
            }}
          >
            Fix {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {expanded && (
            <div style={{ marginTop: 6 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5, fontFamily: 'Geist, sans-serif' }}>
                {issue.fix}
              </p>
              {(issue as CriticalIssue).why_it_matters && (
                <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '6px 0 0', fontStyle: 'italic', fontFamily: 'Geist, sans-serif', lineHeight: 1.4 }}>
                  {(issue as CriticalIssue).why_it_matters}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '16px 0 8px', fontFamily: 'Geist, sans-serif' }}>
      {label} <span style={{ color: 'var(--text-dim)' }}>({count})</span>
    </p>
  )
}

function ChecklistView({ preChecked }: { preChecked: Set<string> }) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(preChecked))
  const groups = [...new Set(CHECKLIST_ITEMS.map(i => i.group))]

  const toggle = (id: string) => setChecked(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const total = CHECKLIST_ITEMS.length
  const done = checked.size

  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden'
        }}>
          <div style={{
            width: `${(done / total) * 100}%`, height: '100%',
            background: 'var(--accent)', transition: 'width 0.2s'
          }} />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif', whiteSpace: 'nowrap' }}>
          {done}/{total}
        </span>
      </div>
      {groups.map(group => (
        <div key={group} style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {group}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CHECKLIST_ITEMS.filter(i => i.group === group).map(item => (
              <label key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={checked.has(item.id)}
                  onChange={() => toggle(item.id)}
                  style={{ marginTop: 2, accentColor: 'var(--accent)', flexShrink: 0 }}
                />
                <span style={{ fontSize: 13, color: checked.has(item.id) ? 'var(--text-dim)' : 'var(--text-muted)', fontFamily: 'Geist, sans-serif', lineHeight: 1.4 }}>
                  {item.text}
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PCBReviewer() {
  const { makeRequest, isConnected, activeModel } = useAIProvider()
  const { description: projectDescription } = useProjectContext()

  const [file, setFile] = useState<File | null>(null)
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checklistMode, setChecklistMode] = useState(false)
  const [preChecked, setPreChecked] = useState<Set<string>>(new Set())

  useProbeContext('pcb-reviewer', {
    fileName: file?.name ?? null,
    reviewing,
    overallRating: result?.overall_rating ?? null,
    criticalIssueCount: result?.critical_issues.length ?? 0,
    warningCount: result?.warnings.length ?? 0,
    lastError: error,
  })

  const handleFile = useCallback(async (f: File) => {
    setFile(f)
    setResult(null)
    setError(null)
    setImageDataUrl(null)

    const ext = f.name.split('.').pop()?.toLowerCase() || ''
    if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      const reader = new FileReader()
      reader.onload = (e) => setImageDataUrl(e.target?.result as string)
      reader.readAsDataURL(f)
    }
  }, [])

  const handleReview = useCallback(async () => {
    if (!file || !isConnected) return
    setReviewing(true)
    setError(null)
    setResult(null)

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(ext)

      let schematicContext = ''

      if (!isImage) {
        const text = await file.text()
        const { parsed, rawText } = parseFile(file, text) as PCBAny
        if (parsed && parsed.components.length > 0) {
          schematicContext = buildSchematicContext(parsed, file.name)
        } else {
          schematicContext = `File: ${file.name}\n\nRaw content (first 6000 chars):\n${(rawText || text).slice(0, 6000)}`
        }
      }

      const systemPrompt = `You are a senior electronics engineer with 15 years of experience in PCB design and hardware bring-up. You review schematics the way you would review a junior engineer's work — thorough, direct, specific, and constructive. You reference specific component reference designators (U1, C3, R7 etc.) in your feedback. Return ONLY valid JSON with no markdown wrapping.`

      const userContent = `Review this schematic/board for design issues.

${schematicContext}
${isImage ? `Schematic image is attached.` : ''}

Project context: ${projectDescription || 'Not specified'}

Return this exact JSON:
{
  "overall_rating": "pass" | "pass_with_concerns" | "needs_work" | "fail",
  "summary": "string (2-3 sentences, honest assessment)",
  "critical_issues": [{"title":"string","reference":"string","description":"string","fix":"string","why_it_matters":"string"}],
  "warnings": [{"title":"string","reference":"string","description":"string","fix":"string"}],
  "suggestions": [{"title":"string","description":"string"}],
  "good_practices": ["string"],
  "check_categories": {
    "decoupling": "pass"|"warn"|"fail"|"unknown",
    "esd_protection": "pass"|"warn"|"fail"|"unknown",
    "power_sequencing": "pass"|"warn"|"fail"|"unknown",
    "signal_integrity": "pass"|"warn"|"fail"|"unknown",
    "thermal": "pass"|"warn"|"fail"|"unknown",
    "manufacturability": "pass"|"warn"|"fail"|"unknown",
    "component_ratings": "pass"|"warn"|"fail"|"unknown",
    "grounding": "pass"|"warn"|"fail"|"unknown"
  }
}`

      const messages: PCBAny[] = isImage && imageDataUrl
        ? [{ role: 'user', content: [
            { type: 'text', text: userContent },
            { type: 'image_url', image_url: { url: imageDataUrl } }
          ]}]
        : [{ role: 'user', content: userContent }]

      const raw = await makeRequest(messages, systemPrompt, { maxTokens: 2000, stream: false })

      // Strip markdown fences if model wrapped the JSON
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
      const parsed = JSON.parse(cleaned) as ReviewResult

      // Pre-check checklist items based on category results
      const autoChecked = new Set<string>()
      if (parsed.check_categories.decoupling === 'pass') {
        autoChecked.add('decap_100n'); autoChecked.add('decap_placement'); autoChecked.add('bulk_cap')
      }
      if (parsed.check_categories.esd_protection === 'pass') {
        autoChecked.add('tvs_esd'); autoChecked.add('series_r')
      }
      if (parsed.check_categories.grounding === 'pass') {
        autoChecked.add('gnd_plane')
      }
      if (parsed.check_categories.thermal === 'pass') {
        autoChecked.add('thermal_vias'); autoChecked.add('thermal_spacing')
      }
      if (parsed.check_categories.signal_integrity === 'pass') {
        autoChecked.add('impedance_ctrl'); autoChecked.add('diff_match'); autoChecked.add('no_acute')
      }

      setPreChecked(autoChecked)
      setResult(parsed)
      logEvent('PCB_REVIEWED', {
        fileName: file.name,
        rating: parsed.overall_rating,
        criticalIssues: parsed.critical_issues.length,
        warnings: parsed.warnings.length,
        module: 'pcb-reviewer',
      })
    } catch (e: PCBAny) {
      setError(e.message || 'Review failed')
    } finally {
      setReviewing(false)
    }
  }, [file, isConnected, imageDataUrl, projectDescription, makeRequest])

  const handleExport = useCallback(() => {
    if (!result || !file) return
    const lines = [
      `# PCB Review — ${file.name}`,
      `Date: ${new Date().toLocaleDateString()}`,
      `Model: ${activeModel}`,
      `Rating: ${RATING_LABELS[result.overall_rating]}`,
      '',
      `## Summary`,
      result.summary,
      '',
    ]
    if (result.critical_issues.length > 0) {
      lines.push('## Critical Issues', '')
      result.critical_issues.forEach(i => {
        lines.push(`### ${i.title} (${i.reference})`, i.description, '', `**Fix:** ${i.fix}`, '')
      })
    }
    if (result.warnings.length > 0) {
      lines.push('## Warnings', '')
      result.warnings.forEach(i => {
        lines.push(`### ${i.title} (${i.reference})`, i.description, '', `**Fix:** ${i.fix}`, '')
      })
    }
    if (result.suggestions.length > 0) {
      lines.push('## Suggestions', '')
      result.suggestions.forEach(i => lines.push(`### ${i.title}`, i.description, ''))
    }
    if (result.good_practices.length > 0) {
      lines.push('## Good Practices', ...result.good_practices.map(g => `✓ ${g}`))
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pcb-review-${file.name.replace(/\.[^.]+$/, '')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [result, file, activeModel])

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col min-h-0" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-base font-bold font-mono tracking-tight" style={{ color: 'var(--text)' }}>
            PCB Reviewer
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            AI schematic and board review from a senior EE perspective.
          </p>
        </div>
        {result && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setChecklistMode(v => !v)}
              className="h-8 px-3 text-xs font-sans rounded border cursor-pointer"
              style={{
                borderColor: checklistMode ? 'var(--accent)' : 'var(--border)',
                color: checklistMode ? 'var(--accent)' : 'var(--text-muted)',
                background: 'transparent'
              }}
            >
              {checklistMode ? 'Review view' : 'Checklist view'}
            </button>
            <button
              onClick={handleExport}
              className="h-8 px-3 text-xs font-sans rounded border cursor-pointer bg-transparent"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              <Download size={12} className="inline mr-1" />
              Export
            </button>
            <button
              onClick={() => { setFile(null); setResult(null); setImageDataUrl(null) }}
              className="h-8 px-3 text-xs font-sans rounded border cursor-pointer bg-transparent"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              <RotateCcw size={12} className="inline mr-1" />
              New review
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto min-h-0" style={{ padding: '24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>

          {/* Drop zone (shown when no file loaded or showing image preview) */}
          {!result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <DropZone onFile={handleFile} disabled={reviewing} />

              {file && (
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, fontFamily: 'Geist, sans-serif' }}>
                      {file.name}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '2px 0 0', fontFamily: 'Geist, sans-serif' }}>
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={handleReview}
                    disabled={reviewing || !isConnected}
                    style={{
                      height: 36, padding: '0 20px',
                      background: isConnected ? 'var(--accent)' : 'var(--border)',
                      border: 'none', borderRadius: 6, cursor: isConnected && !reviewing ? 'pointer' : 'not-allowed',
                      color: 'white', fontSize: 13, fontFamily: 'Geist, sans-serif',
                      display: 'flex', alignItems: 'center', gap: 8
                    }}
                  >
                    {reviewing ? (
                      <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Reviewing…</>
                    ) : !isConnected ? (
                      'Connect a model'
                    ) : (
                      'Start AI Review'
                    )}
                  </button>
                </div>
              )}

              {imageDataUrl && (
                <img
                  src={imageDataUrl}
                  alt="Uploaded schematic"
                  style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border)' }}
                />
              )}

              {error && (
                <div style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderLeft: '2px solid #b08080', borderRadius: 6, padding: 14
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <AlertTriangle size={14} color="#b08080" />
                    <span style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'Geist, sans-serif' }}>Review failed</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, fontFamily: 'Geist, sans-serif' }}>
                    {error}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

              {/* Header card */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, padding: 20, marginBottom: 20
              }}>
                {/* Overall rating */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{
                    fontSize: 18, fontWeight: 500, color: 'var(--text)',
                    fontFamily: 'Geist, sans-serif'
                  }}>
                    {RATING_LABELS[result.overall_rating]}
                  </span>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: RATING_COLORS[result.overall_rating],
                    display: 'inline-block', flexShrink: 0
                  }} />
                </div>

                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.6, fontFamily: 'Geist, sans-serif' }}>
                  {result.summary}
                </p>

                {/* Category strip */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {(Object.keys(result.check_categories) as (keyof CheckCategories)[]).map(cat => (
                    <div key={cat} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 56 }}>
                      <StatusDot status={result.check_categories[cat]} />
                      <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif', textAlign: 'center' }}>
                        {CATEGORY_LABELS[cat]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Toggle between checklist and review */}
              {checklistMode ? (
                <ChecklistView preChecked={preChecked} />
              ) : (
                <>
                  {result.critical_issues.length > 0 && (
                    <div>
                      <SectionHeader label="Critical Issues" count={result.critical_issues.length} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {result.critical_issues.map((issue, i) => (
                          <IssueCard key={i} issue={issue} borderColor="#b08080" />
                        ))}
                      </div>
                    </div>
                  )}

                  {result.warnings.length > 0 && (
                    <div>
                      <SectionHeader label="Warnings" count={result.warnings.length} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {result.warnings.map((w, i) => (
                          <IssueCard key={i} issue={w as PCBAny} borderColor="#b09060" />
                        ))}
                      </div>
                    </div>
                  )}

                  {result.suggestions.length > 0 && (
                    <div>
                      <SectionHeader label="Suggestions" count={result.suggestions.length} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {result.suggestions.map((s, i) => (
                          <div key={i} style={{
                            background: 'var(--surface)', border: '1px solid var(--border)',
                            borderRadius: 6, padding: '10px 14px'
                          }}>
                            <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 4px', fontFamily: 'Geist, sans-serif' }}>
                              {s.title}
                            </p>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5, fontFamily: 'Geist, sans-serif' }}>
                              {s.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.good_practices.length > 0 && (
                    <div>
                      <SectionHeader label="Good practices" count={result.good_practices.length} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {result.good_practices.map((g, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
                            <CheckCircle size={13} color="#7aaa8a" style={{ flexShrink: 0, marginTop: 2 }} />
                            <span style={{ fontSize: 13, color: 'var(--text-dim)', fontFamily: 'Geist, sans-serif', lineHeight: 1.5 }}>
                              {g}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
