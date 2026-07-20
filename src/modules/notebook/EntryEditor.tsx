import { useState, useRef } from 'react'
import {
  GitBranch, FlaskConical, BarChart2, Eye, AlertTriangle,
  Bookmark, FileText, Mic, MicOff, Sparkles, Plus, Trash2, X,
} from 'lucide-react'
import { useAIProvider } from '../../hooks/useAIProvider'
import { useProjectContext as useProject } from '../../hooks/useProjectContext'
import type { NotebookEntry, EntryType } from './types'
import { ENTRY_META, MODULE_LINKS } from './types'

// Web Speech API (SpeechRecognition) isn't in standard lib.dom types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechAny = any

const TYPE_ICONS: Record<EntryType, React.ReactNode> = {
  DECISION:    <GitBranch size={16} />,
  EXPERIMENT:  <FlaskConical size={16} />,
  TEST_RESULT: <BarChart2 size={16} />,
  OBSERVATION: <Eye size={16} />,
  PROBLEM:     <AlertTriangle size={16} />,
  REFERENCE:   <Bookmark size={16} />,
  NOTE:        <FileText size={16} />,
}

const TEMPLATES: Record<string, Partial<NotebookEntry>> = {
  'Post-Experiment Review': {
    type: 'EXPERIMENT',
    title: 'Post-Experiment Review',
    hypothesis: 'We expected that...',
    setup: 'Equipment used:\n- \nProcedure:\n1. ',
    results: 'Measured values:\n\nObservations:\n',
    conclusion: 'The hypothesis was [confirmed/rejected] because...',
    succeeded: false,
  } as Partial<NotebookEntry>,
  'Weekly Progress Note': {
    type: 'NOTE',
    title: `Week of ${new Date().toLocaleDateString()}`,
    content: '## Completed\n- \n\n## In Progress\n- \n\n## Blocked\n- \n\n## Next Week\n- ',
  } as Partial<NotebookEntry>,
  'Design Decision Log': {
    type: 'DECISION',
    title: 'Design Decision: ',
    context: 'Background and constraints:\n',
    optionsConsidered: '| Option | Pros | Cons |\n|--------|------|------|\n| A | | |\n| B | | |',
    chosenOption: 'Option A',
    rationale: 'Selected because...',
  } as Partial<NotebookEntry>,
  'Bug Report': {
    type: 'PROBLEM',
    title: 'Bug: ',
    description: 'Steps to reproduce:\n1. \n2. \n\nExpected: \nActual: ',
    impact: 'Severity: \nAffected systems: ',
    status: 'open' as const,
    solution: null,
  } as Partial<NotebookEntry>,
  'Test Protocol': {
    type: 'TEST_RESULT',
    title: 'Test: ',
    testType: 'Functional',
    conditions: 'Temperature: 25°C\nVoltage: \nSetup: ',
    measurements: [{ param: '', value: '', unit: '' }],
    passFail: false,
    notes: 'Additional observations:\n',
  } as Partial<NotebookEntry>,
}

function TextWithAI({ label, value, onChange, multiline = true }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean
}) {
  const { makeRequest } = useAIProvider()
  const { description: projectDescription } = useProject()
  const [loading, setLoading] = useState(false)
  const [dictating, setDictating] = useState(false)
  const recognitionRef = useRef<SpeechAny>(null)

  async function aiAssist() {
    setLoading(true)
    try {
      const ctx = projectDescription ?? ''
      const res = await makeRequest(
        [{ role: 'user', content: `Suggest content for the field "${label}" in an engineering notebook entry. Project context: ${ctx}. Current value: "${value}". Provide a concise, helpful suggestion.` }],
        'You are an engineering assistant. Return only the suggested field content, no explanation.',
        { maxTokens: 512 }
      )
      onChange(value ? `${value}\n\n${res.trim()}` : res.trim())
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }

  function toggleDictation() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser.')
      return
    }
    if (dictating) {
      recognitionRef.current?.stop()
      setDictating(false)
      return
    }
    const SR = (window as SpeechAny).SpeechRecognition || (window as SpeechAny).webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.onresult = (e: SpeechAny) => {
      const transcript = Array.from(e.results).map((r: SpeechAny) => r[0].transcript).join(' ')
      onChange(value ? `${value} ${transcript}` : transcript)
    }
    recognition.onend = () => setDictating(false)
    recognition.start()
    recognitionRef.current = recognition
    setDictating(true)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '8px 10px', color: 'var(--text)',
    fontFamily: "'DM Sans Variable', 'DM Sans', system-ui, sans-serif", fontSize: 13, resize: 'vertical',
    outline: 'none', transition: 'border-color 0.15s',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',   }}>
          {label}
        </label>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={toggleDictation} title="Voice to note"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: dictating ? '#b08080' : 'var(--text-dim)', padding: 4 }}>
            {dictating ? <MicOff size={12} /> : <Mic size={12} />}
          </button>
          <button onClick={aiAssist} disabled={loading} title="AI assist"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: loading ? 'var(--text-dim)' : 'var(--accent)', padding: 4 }}>
            <Sparkles size={12} />
          </button>
        </div>
      </div>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)}
          rows={3} style={inputStyle}
          onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, resize: undefined }}
          onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
      )}
    </div>
  )
}

type FormState = Record<string, unknown>

function buildDefault(type: EntryType): FormState {
  const base: FormState = {
    title: '', tags: '', date: new Date().toISOString().slice(0, 16),
    linkedModule: '', attachedFiles: '',
  }
  switch (type) {
    case 'DECISION': return { ...base, context: '', optionsConsidered: '', chosenOption: '', rationale: '' }
    case 'EXPERIMENT': return { ...base, hypothesis: '', setup: '', results: '', conclusion: '', succeeded: false }
    case 'TEST_RESULT': return { ...base, testType: '', conditions: '', measurements: [{ param: '', value: '', unit: '' }], passFail: false, notes: '' }
    case 'OBSERVATION': return { ...base, description: '', possibleCauses: '', followUpNeeded: false }
    case 'PROBLEM': return { ...base, description: '', impact: '', status: 'open', solution: '' }
    case 'REFERENCE': return { ...base, source: '', summary: '', relevantTo: '', url: '' }
    case 'NOTE': return { ...base, content: '' }
  }
}

interface Props {
  entry?: NotebookEntry
  onSave: (entry: NotebookEntry) => void
  onClose: () => void
}

export function EntryEditor({ entry, onSave, onClose }: Props) {
  const [type, setType] = useState<EntryType>(entry?.type ?? 'NOTE')
  const [form, setForm] = useState<FormState>(() => {
    if (entry) {
      return {
        ...entry,
        tags: entry.tags.join(', '),
        date: entry.date.slice(0, 16),
        attachedFiles: entry.attachedFiles.join(', '),
        linkedModule: entry.linkedModule ?? '',
        measurements: 'measurements' in entry ? entry.measurements : [],
      }
    }
    return buildDefault('NOTE')
  })
  const [showTemplates, setShowTemplates] = useState(false)

  function set(key: string, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function changeType(t: EntryType) {
    setType(t)
    setForm(buildDefault(t))
  }

  function applyTemplate(name: string) {
    const tpl = TEMPLATES[name]
    if (!tpl) return
    setType(tpl.type as EntryType)
    setForm({ ...buildDefault(tpl.type as EntryType), ...tpl, tags: '', date: new Date().toISOString().slice(0, 16), attachedFiles: '', linkedModule: '' })
    setShowTemplates(false)
  }

  function handleSave() {
    const tags = String(form.tags).split(',').map((t) => t.trim()).filter(Boolean)
    const attachedFiles = String(form.attachedFiles).split(',').map((t) => t.trim()).filter(Boolean)
    const base = {
      id: entry?.id ?? crypto.randomUUID(),
      type,
      title: String(form.title),
      tags,
      date: String(form.date),
      linkedModule: String(form.linkedModule) || null,
      attachedFiles,
    }

    let built: NotebookEntry
    switch (type) {
      case 'DECISION':
        built = { ...base, type, context: String(form.context), optionsConsidered: String(form.optionsConsidered), chosenOption: String(form.chosenOption), rationale: String(form.rationale) }; break
      case 'EXPERIMENT':
        built = { ...base, type, hypothesis: String(form.hypothesis), setup: String(form.setup), results: String(form.results), conclusion: String(form.conclusion), succeeded: Boolean(form.succeeded) }; break
      case 'TEST_RESULT':
        built = { ...base, type, testType: String(form.testType), conditions: String(form.conditions), measurements: (form.measurements as Array<{ param: string; value: string; unit: string }>) ?? [], passFail: Boolean(form.passFail), notes: String(form.notes) }; break
      case 'OBSERVATION':
        built = { ...base, type, description: String(form.description), possibleCauses: String(form.possibleCauses), followUpNeeded: Boolean(form.followUpNeeded) }; break
      case 'PROBLEM':
        built = { ...base, type, description: String(form.description), impact: String(form.impact), status: (form.status as 'open' | 'investigating' | 'solved'), solution: String(form.solution) || null }; break
      case 'REFERENCE':
        built = { ...base, type, source: String(form.source), summary: String(form.summary), relevantTo: String(form.relevantTo), url: String(form.url) || null }; break
      default:
        built = { ...base, type: 'NOTE', content: String(form.content) }
    }
    onSave(built)
  }

  const measurements = (form.measurements as Array<{ param: string; value: string; unit: string }>) ?? []

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border-bright)',
        borderRadius: 16, padding: 28, width: 680, maxHeight: '92vh',
        display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden',
      }}>
        {/* Modal header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, color: 'var(--text)', margin: 0 }}>
            {entry ? 'Edit Entry' : 'New Entry'}
          </h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setShowTemplates(!showTemplates)} style={{ fontSize: 11 }}>Templates</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} data-tooltip="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Templates dropdown */}
        {showTemplates && (
          <div style={{ marginBottom: 16, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.keys(TEMPLATES).map((name) => (
              <button key={name} className="btn" onClick={() => applyTemplate(name)} style={{ fontSize: 11 }}>{name}</button>
            ))}
          </div>
        )}

        {/* Type selector */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
          {(Object.keys(ENTRY_META) as EntryType[]).map((t) => {
            const meta = ENTRY_META[t]
            const active = type === t
            return (
              <button key={t} onClick={() => changeType(t)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                borderRadius: 8, border: `1px solid ${active ? meta.color : 'var(--border)'}`,
                background: active ? `${meta.color}18` : 'transparent',
                color: active ? meta.color : 'var(--text-muted)',
                cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                transition: 'all 0.15s',
                boxShadow: 'none', textShadow: 'none',
              }}>
                {TYPE_ICONS[t]} {meta.label}
              </button>
            )
          })}
        </div>

        {/* Form */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 4 }}>
          <TextWithAI label="Title" value={String(form.title)} onChange={(v) => set('title', v)} multiline={false} />

          {type === 'DECISION' && <>
            <TextWithAI label="Context" value={String(form.context)} onChange={(v) => set('context', v)} />
            <TextWithAI label="Options Considered" value={String(form.optionsConsidered)} onChange={(v) => set('optionsConsidered', v)} />
            <TextWithAI label="Chosen Option" value={String(form.chosenOption)} onChange={(v) => set('chosenOption', v)} multiline={false} />
            <TextWithAI label="Rationale" value={String(form.rationale)} onChange={(v) => set('rationale', v)} />
          </>}

          {type === 'EXPERIMENT' && <>
            <TextWithAI label="Hypothesis" value={String(form.hypothesis)} onChange={(v) => set('hypothesis', v)} />
            <TextWithAI label="Setup" value={String(form.setup)} onChange={(v) => set('setup', v)} />
            <TextWithAI label="Results" value={String(form.results)} onChange={(v) => set('results', v)} />
            <TextWithAI label="Conclusion" value={String(form.conclusion)} onChange={(v) => set('conclusion', v)} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={Boolean(form.succeeded)} onChange={(e) => set('succeeded', e.target.checked)} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)' }}>Experiment succeeded</span>
            </label>
          </>}

          {type === 'TEST_RESULT' && <>
            <TextWithAI label="Test Type" value={String(form.testType)} onChange={(v) => set('testType', v)} multiline={false} />
            <TextWithAI label="Conditions" value={String(form.conditions)} onChange={(v) => set('conditions', v)} />
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',   marginBottom: 8 }}>Measurements</div>
              {measurements.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input className="input" value={m.param} placeholder="Parameter" onChange={(e) => {
                    const ms = [...measurements]; ms[i] = { ...ms[i], param: e.target.value }; set('measurements', ms)
                  }} style={{ flex: 2 }} />
                  <input className="input" value={m.value} placeholder="Value" onChange={(e) => {
                    const ms = [...measurements]; ms[i] = { ...ms[i], value: e.target.value }; set('measurements', ms)
                  }} style={{ flex: 1 }} />
                  <input className="input" value={m.unit} placeholder="Unit" onChange={(e) => {
                    const ms = [...measurements]; ms[i] = { ...ms[i], unit: e.target.value }; set('measurements', ms)
                  }} style={{ flex: 1 }} />
                  <button onClick={() => set('measurements', measurements.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button className="btn" onClick={() => set('measurements', [...measurements, { param: '', value: '', unit: '' }])}
                style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, marginTop: 4 }}>
                <Plus size={11} /> Add Row
              </button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={Boolean(form.passFail)} onChange={(e) => set('passFail', e.target.checked)} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)' }}>Test passed</span>
            </label>
            <TextWithAI label="Notes" value={String(form.notes)} onChange={(v) => set('notes', v)} />
          </>}

          {type === 'OBSERVATION' && <>
            <TextWithAI label="Description" value={String(form.description)} onChange={(v) => set('description', v)} />
            <TextWithAI label="Possible Causes" value={String(form.possibleCauses)} onChange={(v) => set('possibleCauses', v)} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={Boolean(form.followUpNeeded)} onChange={(e) => set('followUpNeeded', e.target.checked)} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)' }}>Follow-up needed</span>
            </label>
          </>}

          {type === 'PROBLEM' && <>
            <TextWithAI label="Description" value={String(form.description)} onChange={(v) => set('description', v)} />
            <TextWithAI label="Impact" value={String(form.impact)} onChange={(v) => set('impact', v)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',   }}>Status</label>
              <select value={String(form.status)} onChange={(e) => set('status', e.target.value)} className="input">
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="solved">Solved</option>
              </select>
            </div>
            <TextWithAI label="Solution" value={String(form.solution ?? '')} onChange={(v) => set('solution', v)} />
          </>}

          {type === 'REFERENCE' && <>
            <TextWithAI label="Source" value={String(form.source)} onChange={(v) => set('source', v)} multiline={false} />
            <TextWithAI label="Summary" value={String(form.summary)} onChange={(v) => set('summary', v)} />
            <TextWithAI label="Relevant To" value={String(form.relevantTo)} onChange={(v) => set('relevantTo', v)} multiline={false} />
            <TextWithAI label="URL" value={String(form.url ?? '')} onChange={(v) => set('url', v)} multiline={false} />
          </>}

          {type === 'NOTE' && (
            <TextWithAI label="Content (markdown)" value={String(form.content)} onChange={(v) => set('content', v)} />
          )}

          {/* Common fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',   }}>Tags</label>
              <input className="input" value={String(form.tags)} onChange={(e) => set('tags', e.target.value)} placeholder="comma, separated, tags" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',   }}>Date</label>
              <input type="datetime-local" className="input" value={String(form.date)} onChange={(e) => set('date', e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',   }}>Link to Module</label>
              <select className="input" value={String(form.linkedModule)} onChange={(e) => set('linkedModule', e.target.value)}>
                <option value="">None</option>
                {MODULE_LINKS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)',   }}>Attached Files</label>
              <input className="input" value={String(form.attachedFiles)} onChange={(e) => set('attachedFiles', e.target.value)} placeholder="file names from history" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn"
            onClick={handleSave}
            disabled={!String(form.title).trim()}
            style={{ background: 'rgba(0,200,255,0.1)', borderColor: 'rgba(0,200,255,0.3)', color: 'var(--accent)' }}
          >
            Save Entry
          </button>
        </div>
      </div>
    </div>
  )
}
