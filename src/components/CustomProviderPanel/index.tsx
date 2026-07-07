// "Other Provider" — bring-your-own OpenAI-compatible endpoint (NVIDIA NIM,
// Groq, Together, self-hosted vLLM…). Saved endpoints render as cards; the
// form adds or edits one. Used as the third tab in AISettings and as a
// standalone step in the first-run OpenRouterSetup chooser.

import { useState, type CSSProperties, type ReactNode } from 'react'
import {
  ArrowLeft, Check, ChevronDown, ChevronRight, Eye, EyeOff,
  Loader2, Pencil, Plus, Server, Trash2, X,
} from 'lucide-react'
import { useOpenRouter } from '../../context/OpenRouterContext'
import {
  type CustomProviderConfig,
  type CustomProviderTestResult,
  testCustomProviderConnection,
} from '../../config/customProviders'

const mono = "'JetBrains Mono', monospace"

const STATUS_COLORS = {
  success: '#7aaa8a',
  failure: '#b08080',
  untested: 'var(--border-bright)',
} as const

type HeaderRow = { k: string; v: string }

interface FormDraft {
  label: string
  baseUrl: string
  apiKey: string
  model: string
  headers: HeaderRow[]
}

const EMPTY_DRAFT: FormDraft = { label: '', baseUrl: '', apiKey: '', model: '', headers: [] }

function draftFrom(config: CustomProviderConfig): FormDraft {
  return {
    label: config.label,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    headers: Object.entries(config.extraHeaders ?? {}).map(([k, v]) => ({ k, v })),
  }
}

function validateBaseUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('bad protocol')
    return null
  } catch {
    return 'Enter a full URL, e.g. https://integrate.api.nvidia.com/v1'
  }
}

function fieldStyle(hasError = false): CSSProperties {
  return {
    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
    background: 'var(--bg)', border: `1px solid ${hasError ? '#b08080' : 'var(--border)'}`,
    borderRadius: 8, color: 'var(--text)', fontSize: 12,
    fontFamily: mono, outline: 'none',
  }
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
      {children}
    </div>
  )
}

export function CustomProviderPanel() {
  const {
    customProviders, activeCustomProviderId,
    addCustomProvider, updateCustomProvider, removeCustomProvider,
    setActiveCustomProviderId, setActiveProvider, activeProvider,
  } = useOpenRouter()

  // null = list view; 'new' = add form; otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(customProviders.length === 0 ? 'new' : null)

  const handleSelect = (id: string) => {
    setActiveCustomProviderId(id)
    setActiveProvider('custom')
  }

  const handleDelete = (p: CustomProviderConfig) => {
    if (!confirm(`Remove "${p.label}"? Its API key is deleted from this device.`)) return
    removeCustomProvider(p.id)
  }

  if (editing !== null) {
    const existing = editing === 'new' ? null : customProviders.find((p) => p.id === editing) ?? null
    return (
      <CustomProviderForm
        key={editing}
        initial={existing ? draftFrom(existing) : EMPTY_DRAFT}
        onCancel={customProviders.length > 0 ? () => setEditing(null) : null}
        onSave={(draft, test) => {
          const extraHeaders: Record<string, string> = {}
          for (const { k, v } of draft.headers) {
            if (k.trim()) extraHeaders[k.trim()] = v
          }
          const payload = {
            label: draft.label.trim(),
            baseUrl: draft.baseUrl.trim().replace(/\/+$/, ''),
            apiKey: draft.apiKey.trim(),
            model: draft.model.trim(),
            extraHeaders: Object.keys(extraHeaders).length ? extraHeaders : undefined,
            ...(test
              ? {
                  lastTestedAt: Date.now(),
                  lastTestStatus: test.success ? ('success' as const) : ('failure' as const),
                  lastTestError: test.error,
                }
              : {}),
          }
          if (existing) {
            updateCustomProvider(existing.id, payload)
            handleSelect(existing.id)
          } else {
            const id = addCustomProvider({ ...payload })
            handleSelect(id)
          }
          setEditing(null)
        }}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 24 }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Any OpenAI-compatible endpoint — NVIDIA NIM, Groq, Together, a self-hosted vLLM…
        Requests go straight from this device to the endpoint you configure.
      </div>

      {customProviders.map((p) => {
        const selected = activeProvider === 'custom' && p.id === activeCustomProviderId
        const status: keyof typeof STATUS_COLORS =
          p.lastTestStatus === 'success' ? 'success' : p.lastTestStatus === 'failure' ? 'failure' : 'untested'
        return (
          <div
            key={p.id}
            onClick={() => handleSelect(p.id)}
            style={{
              position: 'relative', borderRadius: 8, padding: '12px 14px', cursor: 'pointer',
              background: selected ? 'var(--surface)' : 'var(--bg-2)',
              border: `1px solid ${selected ? '#94a5ba' : 'var(--border)'}`,
              transition: 'all 0.15s',
            }}
          >
            {selected && (
              <span style={{ position: 'absolute', top: 10, right: 12, fontFamily: mono, fontSize: 14, color: '#94a5ba' }}>
                ✓
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                title={
                  status === 'success'
                    ? `Test passed ${p.lastTestedAt ? new Date(p.lastTestedAt).toLocaleString() : ''}`
                    : status === 'failure'
                      ? p.lastTestError ?? 'Last test failed'
                      : 'Not tested yet'
                }
                style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: STATUS_COLORS[status],
                }}
              />
              <span style={{ fontFamily: mono, fontSize: 13, color: '#e2e4f0', paddingRight: selected ? 20 : 0 }}>
                {p.label}
              </span>
            </div>
            <div style={{
              fontFamily: mono, fontSize: 11, color: 'var(--text-muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {p.model} · {p.baseUrl.replace(/^https?:\/\//, '')}
            </div>
            {!p.apiKey && (
              <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic', marginTop: 4 }}>
                Key needed — keys last one browser session; edit to re-enter it.
              </div>
            )}
            <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', gap: 6 }}>
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(p.id) }}
                title="Edit"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--text-dim)', padding: 2, display: 'flex',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(p) }}
                title="Remove"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--text-dim)', padding: 2, display: 'flex',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        )
      })}

      <button
        onClick={() => setEditing('new')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
          padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
          border: '1px solid var(--border-bright)', color: 'var(--text-muted)',
          background: 'transparent', fontFamily: mono, fontSize: 12,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#e2e4f0')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <Plus size={12} /> Add Provider
      </button>
    </div>
  )
}

// ─── FORM ───────────────────────────────────────────────────────

function CustomProviderForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: FormDraft
  onSave: (draft: FormDraft, test: CustomProviderTestResult | null) => void
  onCancel: (() => void) | null
}) {
  const [draft, setDraft] = useState<FormDraft>(initial)
  const [showKey, setShowKey] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(initial.headers.length > 0)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  // Result of testing THIS draft; any field change invalidates it.
  const [testResult, setTestResult] = useState<CustomProviderTestResult | null>(null)

  const patch = (p: Partial<FormDraft>) => {
    setDraft((d) => ({ ...d, ...p }))
    setTestResult(null)
  }

  const canSubmit =
    !!draft.label.trim() && !!draft.baseUrl.trim() && !!draft.apiKey.trim() && !!draft.model.trim()

  const runTest = async () => {
    const err = validateBaseUrl(draft.baseUrl)
    setUrlError(err)
    if (err || !canSubmit || testing) return
    setTesting(true)
    const extraHeaders: Record<string, string> = {}
    for (const { k, v } of draft.headers) {
      if (k.trim()) extraHeaders[k.trim()] = v
    }
    const result = await testCustomProviderConnection({
      id: 'test', createdAt: 0,
      label: draft.label.trim(),
      baseUrl: draft.baseUrl.trim().replace(/\/+$/, ''),
      apiKey: draft.apiKey.trim(),
      model: draft.model.trim(),
      extraHeaders: Object.keys(extraHeaders).length ? extraHeaders : undefined,
    })
    setTesting(false)
    setTestResult(result)
  }

  const handleSave = () => {
    const err = validateBaseUrl(draft.baseUrl)
    setUrlError(err)
    if (err || !canSubmit) return
    onSave(draft, testResult)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>
      {onCancel && (
        <button
          onClick={onCancel}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
            color: 'var(--text-dim)', fontFamily: mono, fontSize: 11,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
        >
          <ArrowLeft size={11} /> Saved providers
        </button>
      )}

      <div>
        <FieldLabel>Label</FieldLabel>
        <input
          value={draft.label}
          onChange={(e) => patch({ label: e.target.value })}
          placeholder="NVIDIA — DeepSeek R1"
          spellCheck={false}
          style={fieldStyle()}
        />
      </div>

      <div>
        <FieldLabel>Base URL</FieldLabel>
        <input
          value={draft.baseUrl}
          onChange={(e) => { patch({ baseUrl: e.target.value }); setUrlError(null) }}
          onBlur={() => draft.baseUrl.trim() && setUrlError(validateBaseUrl(draft.baseUrl))}
          placeholder="https://integrate.api.nvidia.com/v1"
          spellCheck={false}
          style={fieldStyle(!!urlError)}
        />
        <div style={{ fontFamily: mono, fontSize: 10, color: urlError ? '#b08080' : 'var(--text-dim)', marginTop: 4 }}>
          {urlError ?? 'API root without /chat/completions — that part is added automatically.'}
        </div>
      </div>

      <div>
        <FieldLabel>API Key</FieldLabel>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={draft.apiKey}
            onChange={(e) => patch({ apiKey: e.target.value })}
            placeholder="nvapi-…"
            autoComplete="off"
            spellCheck={false}
            style={{ ...fieldStyle(), paddingRight: 38 }}
          />
          <button
            onClick={() => setShowKey((v) => !v)}
            title={showKey ? 'Hide key' : 'Show key'}
            style={{
              position: 'absolute', right: 10, color: 'var(--text-muted)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex',
            }}
          >
            {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
        <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.5 }}>
          Stored on this device only and sent directly to the base URL above — never proxied
          through or stored on any ENGINGUITY server.
        </div>
      </div>

      <div>
        <FieldLabel>Model ID</FieldLabel>
        <input
          value={draft.model}
          onChange={(e) => patch({ model: e.target.value })}
          placeholder="org/model-name"
          spellCheck={false}
          style={fieldStyle()}
        />
        <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
          Exact model ID from your provider's catalog, e.g. deepseek-ai/deepseek-r1
        </div>
      </div>

      {/* Advanced — extra headers, collapsed by default */}
      <div>
        <button
          onClick={() => setAdvancedOpen((v) => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
            color: 'var(--text-dim)', fontFamily: mono, fontSize: 11,
          }}
        >
          {advancedOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          Advanced · extra headers
        </button>
        {advancedOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {draft.headers.map((row, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  value={row.k}
                  onChange={(e) =>
                    patch({ headers: draft.headers.map((r, j) => (j === i ? { ...r, k: e.target.value } : r)) })
                  }
                  placeholder="Header-Name"
                  spellCheck={false}
                  style={{ ...fieldStyle(), flex: 1, fontSize: 11, padding: '7px 10px' }}
                />
                <input
                  value={row.v}
                  onChange={(e) =>
                    patch({ headers: draft.headers.map((r, j) => (j === i ? { ...r, v: e.target.value } : r)) })
                  }
                  placeholder="value"
                  spellCheck={false}
                  style={{ ...fieldStyle(), flex: 1.4, fontSize: 11, padding: '7px 10px' }}
                />
                <button
                  onClick={() => patch({ headers: draft.headers.filter((_, j) => j !== i) })}
                  title="Remove header"
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text-dim)', padding: 2, display: 'flex', flexShrink: 0,
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={() => patch({ headers: [...draft.headers, { k: '', v: '' }] })}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
                background: 'transparent', border: '1px solid var(--border)', borderRadius: 5,
                cursor: 'pointer', padding: '3px 8px',
                color: 'var(--text-dim)', fontFamily: mono, fontSize: 10,
              }}
            >
              <Plus size={10} /> header
            </button>
          </div>
        )}
      </div>

      {/* Test result — inline, quiet */}
      {testResult && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-start',
          padding: '9px 12px', borderRadius: 8,
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          fontFamily: mono, fontSize: 11, lineHeight: 1.5,
          color: testResult.success ? '#7aaa8a' : '#b08080',
        }}>
          {testResult.success ? (
            <><Check size={12} style={{ flexShrink: 0, marginTop: 1 }} />Connected — responded in {testResult.latencyMs} ms</>
          ) : (
            <><X size={12} style={{ flexShrink: 0, marginTop: 1 }} />{testResult.error}</>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={runTest}
          disabled={!canSubmit || testing}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 6,
            cursor: !canSubmit || testing ? 'not-allowed' : 'pointer',
            border: '1px solid var(--border-bright)', background: 'transparent',
            color: 'var(--text-muted)', fontFamily: mono, fontSize: 12,
            opacity: !canSubmit ? 0.5 : 1,
          }}
        >
          {testing ? (
            <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Testing…</>
          ) : (
            <><Server size={12} /> Test Connection</>
          )}
        </button>
        <button
          onClick={handleSave}
          disabled={!canSubmit}
          style={{
            flex: 1, padding: '9px 16px', borderRadius: 6,
            cursor: !canSubmit ? 'not-allowed' : 'pointer',
            border: '1px solid var(--border-bright)',
            background: canSubmit ? 'var(--surface-2)' : 'transparent',
            color: canSubmit ? '#e2e4f0' : 'var(--text-dim)',
            fontFamily: mono, fontSize: 12,
          }}
        >
          Save
        </button>
      </div>
      {!testResult && canSubmit && (
        <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--text-dim)', marginTop: -8 }}>
          Testing first is recommended — saving works either way.
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ─── STANDALONE MODAL (first-run chooser flow) ──────────────────

export function CustomProviderSetup({ onBack, onClose }: { onBack: () => void; onClose?: () => void }) {
  const { closeSetup } = useOpenRouter()

  const handleClose = () => {
    closeSetup()
    onClose?.()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(8,8,16,0.92)', backdropFilter: 'blur(8px)', padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 480, maxHeight: '88vh',
        background: 'var(--surface)', border: '1px solid var(--border-bright)',
        borderRadius: 20, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          padding: '24px 28px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <button
                onClick={onBack}
                title="Back to provider choice"
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
                }}
              >
                <ArrowLeft size={16} />
              </button>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'var(--surface-2)', border: '1px solid var(--border-bright)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Server size={18} color="var(--text-muted)" />
              </div>
              <h2 style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                Other Provider
              </h2>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
              Connect any OpenAI-compatible endpoint with a base URL, API key, and model ID.
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '20px 28px 0', overflowY: 'auto', flex: 1 }}>
          <CustomProviderPanel />
        </div>
      </div>
    </div>
  )
}

export default CustomProviderPanel
