import { useState, useCallback } from 'react'
import { useAIProvider } from '../../hooks/useAIProvider'
import { useProbeContext } from '../../hooks/useProbeContext'
import { logEvent } from '../../engine/eventLog'
// @ts-ignore
import ResizablePanel from '../../components/ResizablePanel'
import {
  ChevronDown, ChevronRight, Download, BookOpen, Share2, Loader2, AlertTriangle,
  Tv, Settings, Activity, Car, Wifi, Plug, Lightbulb, Radio, Watch, Navigation, Package, ArrowRight, X
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CertificationResult {
  name: string
  full_name: string
  region: string
  required: boolean
  description: string
  typical_cost_usd: { min: number; max: number }
  typical_timeline_weeks: { min: number; max: number }
  can_self_certify: boolean
  requires_accredited_lab: boolean
  key_tests: string[]
  gotchas: string[]
}

interface ComplianceReport {
  summary: string
  overall_complexity: 'low' | 'medium' | 'high' | 'very_high'
  certifications: CertificationResult[]
  total_cost_estimate: { min: number; max: number }
  total_timeline_estimate: { min: number; max: number }
  immediate_actions: string[]
  design_recommendations: string[]
  avoid: string[]
  needs_lawyer: boolean
  needs_consultant: boolean
  disclaimer: string
}

interface ProductDescriptor {
  productType: string
  customType: string
  regions: string[]
  hasWireless: boolean
  mainsPowered: boolean
  hasBattery: boolean
  medicalDevice: boolean
  safetyCritical: boolean
  processesData: boolean
  forChildren: boolean
  hasCamera: boolean
  inVehicle: boolean
  industrialOnly: boolean
  rfPower: string
  frequency: string
  voltage: string
  stage: 'concept' | 'prototype' | 'pre-production' | 'production'
}

const PRODUCT_TYPES = [
  { id: 'consumer_electronics', label: 'Consumer Electronics', icon: Tv },
  { id: 'industrial_equipment', label: 'Industrial Equipment', icon: Settings },
  { id: 'medical_device', label: 'Medical Device', icon: Activity },
  { id: 'automotive', label: 'Automotive', icon: Car },
  { id: 'iot', label: 'IoT / Connected Device', icon: Wifi },
  { id: 'power_supply', label: 'Power Supply', icon: Plug },
  { id: 'led_lighting', label: 'LED / Lighting', icon: Lightbulb },
  { id: 'rf_transmitter', label: 'RF Transmitter', icon: Radio },
  { id: 'wearable', label: 'Wearable', icon: Watch },
  { id: 'drone', label: 'Drone / UAV', icon: Navigation },
  { id: 'other', label: 'Other', icon: Package },
]

const REGIONS = [
  'United States', 'European Union', 'United Kingdom',
  'Canada', 'Australia', 'Japan', 'South Korea',
  'China', 'Brazil', 'India', 'Global',
]

function formatMoney(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`
  return `$${n}`
}

function weeksToMonths(w: number): string {
  if (w < 4) return `${w}w`
  return `${(w / 4).toFixed(1)}mo`
}

// ── Certification card ────────────────────────────────────────────────────────

function CertCard({ cert }: { cert: CertificationResult }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      padding: '12px 14px',
      marginBottom: 8,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{cert.name}</span>
          {!cert.required && (
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', marginLeft: 8 }}>(optional)</span>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{cert.region}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{cert.description}</div>

      {/* Cost & timeline */}
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>
        {formatMoney(cert.typical_cost_usd.min)} – {formatMoney(cert.typical_cost_usd.max)}
        <span style={{ color: 'var(--text-dim)', margin: '0 8px' }}>·</span>
        <span style={{ color: 'var(--text-muted)' }}>
          {cert.typical_timeline_weeks.min}–{cert.typical_timeline_weeks.max} weeks
        </span>
      </div>

      {/* Lab / self-certify */}
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>
        {cert.can_self_certify && 'Self-certification possible'}
        {cert.can_self_certify && cert.requires_accredited_lab && '  ·  '}
        {cert.requires_accredited_lab && 'Accredited lab required'}
      </div>

      {/* Expand toggle */}
      <button
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 4 }}
        onClick={() => setOpen(o => !o)}
      >
        Details {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
      </button>

      {open && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          {cert.key_tests.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tests required</div>
              {cert.key_tests.map((t, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>• {t}</div>
              ))}
            </div>
          )}
          {cert.gotchas.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Common gotchas</div>
              {cert.gotchas.map((g, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={12} style={{ color: '#a5d8ff', flexShrink: 0 }} />
                  <span>{g}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Report panel ──────────────────────────────────────────────────────────────

function ReportPanel({
  report,
  descriptor,
  onExport,
  onAddToNotebook,
  onShare,
}: {
  report: ComplianceReport
  descriptor: ProductDescriptor
  onExport: () => void
  onAddToNotebook: () => void
  onShare: () => void
}) {
  const complexityColor = {
    low: '#7aaa8a',
    medium: '#b09a60',
    high: '#b08460',
    very_high: '#b08080',
  }[report.overall_complexity]

  const required = report.certifications.filter(c => c.required)
  const optional = report.certifications.filter(c => !c.required)

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 24px' }}>
      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          className="btn"
          style={{ fontSize: 11, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
          onClick={onExport}
        >
          <Download size={12} /> Export Compliance Plan
        </button>
        <button
          className="btn"
          style={{ fontSize: 11, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
          onClick={onAddToNotebook}
        >
          <BookOpen size={12} /> Add to Notebook
        </button>
        <button
          className="btn"
          style={{ fontSize: 11, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
          onClick={onShare}
        >
          <Share2 size={12} /> Share report
        </button>
      </div>

      {/* Header card */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '16px 18px', marginBottom: 20,
      }}>
        {/* Product + region pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 12,
            background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-muted)',
          }}>
            {descriptor.productType === 'other' ? descriptor.customType : PRODUCT_TYPES.find(p => p.id === descriptor.productType)?.label}
          </span>
          {descriptor.regions.map(r => (
            <span key={r} style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 12,
              background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-muted)',
            }}>
              {r}
            </span>
          ))}
        </div>

        {/* Complexity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Complexity</span>
          <span style={{ fontSize: 14, color: complexityColor, textTransform: 'capitalize' }}>
            {report.overall_complexity.replace('_', ' ')}
          </span>
        </div>

        {/* Summary */}
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 12px' }}>
          {report.summary}
        </p>

        {/* Cost + timeline */}
        <div style={{ display: 'flex', gap: 24, marginBottom: report.needs_lawyer || report.needs_consultant ? 12 : 0 }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: 'var(--text)' }}>
            Estimated cost: {formatMoney(report.total_cost_estimate.min)} – {formatMoney(report.total_cost_estimate.max)}
          </span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--text-muted)' }}>
            Timeline: {weeksToMonths(report.total_timeline_estimate.min)} – {weeksToMonths(report.total_timeline_estimate.max)}
          </span>
        </div>

        {/* Consultant notice */}
        {(report.needs_lawyer || report.needs_consultant) && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', margin: '10px 0 0', lineHeight: 1.5 }}>
            This product likely requires a regulatory consultant. Self-certification carries significant legal risk.
          </p>
        )}
      </div>

      {/* Required certifications */}
      {required.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="label" style={{ marginBottom: 10 }}>Required certifications</div>
          {required.map((c, i) => <CertCard key={i} cert={c} />)}
        </div>
      )}

      {/* Optional certifications */}
      {optional.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="label" style={{ marginBottom: 10 }}>Optional / recommended</div>
          {optional.map((c, i) => <CertCard key={i} cert={c} />)}
        </div>
      )}

      {/* Actions section */}
      <div style={{ marginBottom: 20 }}>
        <div className="label" style={{ marginBottom: 10 }}>Immediate actions</div>
        <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {report.immediate_actions.map((a, i) => (
            <li key={i} style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{a}</li>
          ))}
        </ol>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div className="label" style={{ marginBottom: 10 }}>Design recommendations</div>
        {report.design_recommendations.map((r, i) => (
          <div key={i} style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowRight size={12} style={{ color: '#a5d8ff', flexShrink: 0 }} />
            <span>{r}</span>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 24 }}>
        <div className="label" style={{ marginBottom: 10 }}>Avoid</div>
        {report.avoid.map((a, i) => (
          <div key={i} style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, display: 'flex', alignItems: 'center', gap: 6 }}>
            <X size={12} style={{ color: '#a5d8ff', flexShrink: 0 }} />
            <span>{a}</span>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div style={{
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 6, padding: '12px 14px',
        fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.6,
      }}>
        {report.disclaimer || 'This report is for informational purposes only and does not constitute legal or regulatory advice. Certification requirements change frequently. Always consult with an accredited test lab or regulatory consultant before beginning the certification process.'}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ComplianceChecker() {
  const ai = useAIProvider()

  const [descriptor, setDescriptor] = useState<ProductDescriptor>({
    productType: '',
    customType: '',
    regions: [],
    hasWireless: false,
    mainsPowered: false,
    hasBattery: false,
    medicalDevice: false,
    safetyCritical: false,
    processesData: false,
    forChildren: false,
    hasCamera: false,
    inVehicle: false,
    industrialOnly: false,
    rfPower: '',
    frequency: '',
    voltage: '',
    stage: 'prototype',
  })

  const [report, setReport] = useState<ComplianceReport | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useProbeContext('compliance', {
    productType: descriptor.customType || descriptor.productType || null,
    regions: descriptor.regions,
    stage: descriptor.stage,
    generating,
    overallComplexity: report?.overall_complexity ?? null,
    certificationCount: report?.certifications.length ?? 0,
  })

  const set = <K extends keyof ProductDescriptor>(key: K, val: ProductDescriptor[K]) =>
    setDescriptor(prev => ({ ...prev, [key]: val }))

  const toggleRegion = (r: string) => {
    setDescriptor(prev => ({
      ...prev,
      regions: prev.regions.includes(r) ? prev.regions.filter(x => x !== r) : [...prev.regions, r],
    }))
  }

  const generate = async () => {
    if (!descriptor.productType || descriptor.regions.length === 0) {
      alert('Select a product type and at least one region.')
      return
    }
    setGenerating(true)
    setReport(null)

    const productLabel = descriptor.productType === 'other'
      ? descriptor.customType || 'Other'
      : PRODUCT_TYPES.find(p => p.id === descriptor.productType)?.label ?? descriptor.productType

    const system = `You are a regulatory compliance expert for electronic products with expertise in FCC, CE, UL, IC, RCM, TELEC, and other international certifications. You give practical, actionable guidance. You are honest about costs and timelines. You note when products need a lawyer or regulatory consultant. Return ONLY valid JSON.`

    const prompt = `Generate a compliance roadmap for this product:
Type: ${productLabel}
Markets: ${descriptor.regions.join(', ')}
Wireless: ${descriptor.hasWireless}
Mains connected: ${descriptor.mainsPowered}
Battery (lithium): ${descriptor.hasBattery}
Touches human body / medical: ${descriptor.medicalDevice}
Safety critical: ${descriptor.safetyCritical}
Personal data: ${descriptor.processesData}
Children's product: ${descriptor.forChildren}
Camera/microphone: ${descriptor.hasCamera}
Operates in vehicle: ${descriptor.inVehicle}
Industrial only: ${descriptor.industrialOnly}
Stage: ${descriptor.stage}
RF power: ${descriptor.rfPower || 'unknown'}
Frequency: ${descriptor.frequency || 'unknown'}
Voltage: ${descriptor.voltage || 'unknown'}

Return ONLY a JSON object with this exact shape:
{
  "summary": "2-3 sentence honest overview",
  "overall_complexity": "low" | "medium" | "high" | "very_high",
  "certifications": [{
    "name": "short name",
    "full_name": "full official name",
    "region": "region string",
    "required": true,
    "description": "what it covers",
    "typical_cost_usd": { "min": 5000, "max": 15000 },
    "typical_timeline_weeks": { "min": 4, "max": 12 },
    "can_self_certify": false,
    "requires_accredited_lab": true,
    "key_tests": ["test 1", "test 2"],
    "gotchas": ["common mistake 1"]
  }],
  "total_cost_estimate": { "min": 10000, "max": 50000 },
  "total_timeline_estimate": { "min": 8, "max": 24 },
  "immediate_actions": ["action 1", "action 2"],
  "design_recommendations": ["recommendation 1"],
  "avoid": ["mistake 1"],
  "needs_lawyer": false,
  "needs_consultant": true,
  "disclaimer": "standard disclaimer text"
}`

    try {
      const raw = await ai.makeRequest([{ role: 'user', content: prompt }], system, { maxTokens: 6000, temperature: 0.3 })
      const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      const result = JSON.parse(cleaned) as ComplianceReport
      setReport(result)
      logEvent('COMPLIANCE_CHECKED', {
        productType: descriptor.customType || descriptor.productType,
        regions: descriptor.regions,
        complexity: result.overall_complexity,
        certifications: result.certifications.length,
        module: 'compliance',
      })
    } catch (e: unknown) {
      alert('Generation failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setGenerating(false)
    }
  }

  const exportMarkdown = useCallback(() => {
    if (!report) return
    const productLabel = descriptor.productType === 'other'
      ? descriptor.customType
      : PRODUCT_TYPES.find(p => p.id === descriptor.productType)?.label ?? descriptor.productType

    const lines: string[] = [
      `# Compliance Roadmap — ${productLabel}`,
      '',
      `**Markets:** ${descriptor.regions.join(', ')}`,
      `**Stage:** ${descriptor.stage}`,
      `**Complexity:** ${report.overall_complexity.replace('_', ' ')}`,
      '',
      `## Summary`,
      report.summary,
      '',
      `## Cost & Timeline`,
      `- Estimated cost: ${formatMoney(report.total_cost_estimate.min)} – ${formatMoney(report.total_cost_estimate.max)}`,
      `- Estimated timeline: ${weeksToMonths(report.total_timeline_estimate.min)} – ${weeksToMonths(report.total_timeline_estimate.max)}`,
      '',
      `## Certifications`,
      '',
      ...report.certifications.map(c => [
        `### ${c.name}${c.required ? '' : ' *(optional)*'}`,
        `**Region:** ${c.region}  `,
        `**Cost:** ${formatMoney(c.typical_cost_usd.min)} – ${formatMoney(c.typical_cost_usd.max)}  `,
        `**Timeline:** ${c.typical_timeline_weeks.min}–${c.typical_timeline_weeks.max} weeks  `,
        '',
        c.description,
        '',
        c.key_tests.length ? `**Tests:** ${c.key_tests.join(', ')}` : '',
        c.gotchas.length ? `**Gotchas:** ${c.gotchas.join('; ')}` : '',
        '',
      ].filter(Boolean).join('\n')),
      `## Immediate Actions`,
      ...report.immediate_actions.map((a, i) => `${i + 1}. ${a}`),
      '',
      `## Design Recommendations`,
      ...report.design_recommendations.map(r => `- → ${r}`),
      '',
      `## Avoid`,
      ...report.avoid.map(a => `- ✕ ${a}`),
      '',
      `---`,
      `*${report.disclaimer}*`,
    ]

    const md = lines.join('\n')
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `compliance-plan-${productLabel?.toLowerCase().replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [report, descriptor])

  const addToNotebook = useCallback(() => {
    if (!report) return
    const productLabel = descriptor.productType === 'other'
      ? descriptor.customType
      : PRODUCT_TYPES.find(p => p.id === descriptor.productType)?.label ?? descriptor.productType

    const entry = {
      type: 'decision',
      title: `Compliance Roadmap — ${productLabel}`,
      content: `${report.summary}\n\nRequired certifications: ${report.certifications.filter(c => c.required).map(c => c.name).join(', ')}\n\nEstimated cost: ${formatMoney(report.total_cost_estimate.min)} – ${formatMoney(report.total_cost_estimate.max)}\nTimeline: ${weeksToMonths(report.total_timeline_estimate.min)} – ${weeksToMonths(report.total_timeline_estimate.max)}`,
      timestamp: new Date().toISOString(),
    }
    const stored = JSON.parse(localStorage.getItem('enginguity_notebook') ?? '[]')
    stored.unshift(entry)
    localStorage.setItem('enginguity_notebook', JSON.stringify(stored))
    alert('Added to Engineering Notebook')
  }, [report, descriptor])

  const shareReport = useCallback(() => {
    if (!report) return
    try {
      const payload = { descriptor, report }
      const encoded = btoa(encodeURIComponent(JSON.stringify(payload)))
      const url = `${window.location.origin}/compliance?report=${encoded}`
      navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      alert('Could not copy share URL')
    }
  }, [report, descriptor])

  // ── Left panel ────────────────────────────────────────────────────────────

  const leftPanel = (
    <div style={{ height: '100%', overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Product type */}
      <div>
        <div className="label" style={{ marginBottom: 10 }}>What are you building?</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {PRODUCT_TYPES.map(pt => {
            const IconComponent = pt.icon
            return (
              <button
                key={pt.id}
                onClick={() => set('productType', pt.id)}
                style={{
                  background: descriptor.productType === pt.id ? 'var(--surface-2)' : 'var(--surface)',
                  border: `1px solid ${descriptor.productType === pt.id ? 'var(--border-bright)' : 'var(--border)'}`,
                  borderRadius: 6, padding: '10px 8px', cursor: 'pointer',
                  color: descriptor.productType === pt.id ? 'var(--text)' : 'var(--text-muted)',
                  fontSize: 12, textAlign: 'center', transition: 'all 120ms',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                }}
              >
                <IconComponent size={20} style={{ color: '#a5d8ff' }} />
                {pt.label}
              </button>
            )
          })}
        </div>
        {descriptor.productType === 'other' && (
          <input
            className="input"
            placeholder="Describe your product type"
            value={descriptor.customType}
            onChange={e => set('customType', e.target.value)}
            style={{ marginTop: 8, width: '100%', boxSizing: 'border-box', fontSize: 12 }}
          />
        )}
      </div>

      {/* Regions */}
      <div>
        <div className="label" style={{ marginBottom: 10 }}>Where will it be sold?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {REGIONS.map(r => (
            <button
              key={r}
              onClick={() => toggleRegion(r)}
              style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                background: descriptor.regions.includes(r) ? 'var(--surface-2)' : 'var(--surface)',
                border: `1px solid ${descriptor.regions.includes(r) ? 'var(--border-bright)' : 'var(--border)'}`,
                color: descriptor.regions.includes(r) ? 'var(--text)' : 'var(--text-muted)',
                transition: 'all 120ms',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Characteristics */}
      <div>
        <div className="label" style={{ marginBottom: 10 }}>Key characteristics</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { key: 'hasWireless', label: 'Contains a wireless radio (WiFi, Bluetooth, Zigbee, LoRa, cellular, etc.)' },
            { key: 'mainsPowered', label: 'Connects to mains power (120V/240V AC)' },
            { key: 'hasBattery', label: 'Battery powered (lithium chemistry)' },
            { key: 'medicalDevice', label: 'Touches or enters the human body' },
            { key: 'safetyCritical', label: 'Used in safety-critical applications' },
            { key: 'processesData', label: 'Processes personal data' },
            { key: 'forChildren', label: 'Designed for children under 14' },
            { key: 'hasCamera', label: 'Contains a camera or microphone' },
            { key: 'inVehicle', label: 'Operates in a vehicle' },
            { key: 'industrialOnly', label: 'Industrial/commercial use only (not consumer)' },
          ].map(({ key, label }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!descriptor[key as keyof ProductDescriptor]}
                onChange={e => set(key as keyof ProductDescriptor, e.target.checked as never)}
                style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--accent)' }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Technical specs */}
      <div>
        <div className="label" style={{ marginBottom: 10 }}>Technical specs <span style={{ color: 'var(--text-dim)' }}>(optional)</span></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 80 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>RF power (dBm)</div>
            <input
              className="input"
              placeholder="e.g. 20"
              value={descriptor.rfPower}
              onChange={e => set('rfPower', e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 12 }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 80 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Frequency (MHz)</div>
            <input
              className="input"
              placeholder="e.g. 2400"
              value={descriptor.frequency}
              onChange={e => set('frequency', e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 12 }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 80 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Voltage (V)</div>
            <input
              className="input"
              placeholder="e.g. 5"
              value={descriptor.voltage}
              onChange={e => set('voltage', e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', fontSize: 12 }}
            />
          </div>
        </div>
      </div>

      {/* Stage */}
      <div>
        <div className="label" style={{ marginBottom: 8 }}>Current stage</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['concept', 'prototype', 'pre-production', 'production'] as const).map(s => (
            <button
              key={s}
              onClick={() => set('stage', s)}
              style={{
                flex: 1, padding: '5px 0', fontSize: 11,
                background: descriptor.stage === s ? 'var(--surface-2)' : 'var(--surface)',
                border: `1px solid ${descriptor.stage === s ? 'var(--border-bright)' : 'var(--border)'}`,
                color: descriptor.stage === s ? 'var(--text)' : 'var(--text-dim)',
                borderRadius: 5, cursor: 'pointer', transition: 'all 120ms',
                textTransform: 'capitalize',
              }}
            >
              {s.replace('-', '‑')}
            </button>
          ))}
        </div>
      </div>

      <button
        className="btn btn-primary"
        style={{ width: '100%', padding: '10px 0', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        disabled={generating || !descriptor.productType || descriptor.regions.length === 0}
        onClick={generate}
      >
        {generating ? <><Loader2 size={13} className="animate-spin" /> Generating…</> : 'Generate Compliance Report'}
      </button>
    </div>
  )

  const rightPanel = report ? (
    <ReportPanel
      report={report}
      descriptor={descriptor}
      onExport={exportMarkdown}
      onAddToNotebook={addToNotebook}
      onShare={shareReport}
    />
  ) : (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-dim)', fontSize: 13 }}>
      {generating
        ? <><Loader2 size={22} className="animate-spin" style={{ color: 'var(--accent)' }} /> Analyzing requirements…</>
        : <>Select product type and regions, then click Generate.</>
      }
      {copied && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 14px', fontSize: 12, color: 'var(--text)' }}>
          Share URL copied to clipboard
        </div>
      )}
    </div>
  )

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Compliance Checker</span>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Certifications, costs, and timelines for your product</span>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ResizablePanel
          direction="horizontal"
          initialSplit={0.4}
          minFirst={280}
          minSecond={320}
          storageKey="compliance-split"
        >
          {leftPanel}
          <div style={{ height: '100%', borderLeft: '1px solid var(--border)' }}>
            {rightPanel}
          </div>
        </ResizablePanel>
      </div>

      {copied && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 14px', fontSize: 12, color: 'var(--text)', zIndex: 100 }}>
          Share URL copied
        </div>
      )}
    </div>
  )
}
