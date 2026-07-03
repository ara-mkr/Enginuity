import { useEffect, useMemo, useState } from 'react'
import {
  Cpu, ArrowLeft, X, ExternalLink, Check, AlertTriangle,
  Copy, RefreshCw, Download, MemoryStick, Zap, Monitor,
} from 'lucide-react'
import { useOpenRouter } from '../../context/OpenRouterContext'
import { useOllamaStatus } from '../../hooks/useOllamaStatus'
import { useDeviceSpecs, modelFitsInRAM } from '../../hooks/useDeviceSpecs'
import {
  OLLAMA_RECOMMENDATIONS,
  detectCorsError,
  getOllamaHost,
} from '../../config/ollama'

const PLATFORM_DOWNLOADS = [
  { label: 'Mac',     url: 'https://ollama.com/download/mac' },
  { label: 'Windows', url: 'https://ollama.com/download/windows' },
  { label: 'Linux',   url: 'https://ollama.com/download/linux' },
]

const POPULAR_PULLS = [
  { cmd: 'ollama pull qwen2.5:7b',       label: 'Qwen 2.5 7B',       size: '4.7GB', tag: 'recommended' },
  { cmd: 'ollama pull llama3.2:3b',      label: 'Llama 3.2 3B',      size: '2.0GB', tag: 'fastest' },
  { cmd: 'ollama pull qwen2.5:14b',      label: 'Qwen 2.5 14B',      size: '9.0GB', tag: 'smarter' },
  { cmd: 'ollama pull deepseek-r1:7b',   label: 'DeepSeek R1 7B',    size: '4.7GB', tag: 'reasoning' },
  { cmd: 'ollama pull qwen2.5-coder:7b', label: 'Qwen 2.5 Coder 7B', size: '4.7GB', tag: 'code' },
  { cmd: 'ollama pull mistral:7b',       label: 'Mistral 7B',        size: '4.1GB', tag: 'balanced' },
]

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      title="Copy command"
      style={{
        background: 'transparent', border: '1px solid var(--border)',
        color: 'var(--text-muted)', borderRadius: 6,
        padding: '4px 8px', cursor: 'pointer', display: 'inline-flex',
        alignItems: 'center', gap: 4, fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export function OllamaSetup({ onBack, onClose }) {
  const { setActiveProvider, setOllamaModelId, closeSetup, ollamaModelId } = useOpenRouter()
  const status = useOllamaStatus(5000) // 5s poll while this screen is open
  const specs = useDeviceSpecs()
  const [selected, setSelected] = useState(ollamaModelId || '')
  const [showCorsHint, setShowCorsHint] = useState(false)

  useEffect(() => {
    if (status.error && detectCorsError(status.error)) setShowCorsHint(true)
  }, [status.error])

  // Auto-select recommended model when models arrive
  useEffect(() => {
    if (!selected && status.models.length > 0) {
      const balanced = status.models.find((m) => m.tier === 'balanced')
                    ?? status.models.find((m) => m.tier === 'flagship')
                    ?? status.models[0]
      setSelected(balanced.id)
    }
  }, [status.models, selected])

  const handleClose = () => {
    closeSetup()
    onClose?.()
  }

  const handleConfirm = () => {
    if (!selected) return
    setOllamaModelId(selected)
    setActiveProvider('ollama')
    handleClose()
  }

  const recommendedId = useMemo(() => {
    if (!status.models.length) return null
    const big = [...status.models].sort(
      (a, b) => parseFloat(b.parameterSize ?? '0') - parseFloat(a.parameterSize ?? '0'),
    )
    return big.find((m) => m.tier === 'balanced' || m.tier === 'flagship')?.id ?? big[0].id
  }, [status.models])

  return (
    <Shell onClose={handleClose}>
      {/* Header */}
      <div style={{
        padding: '24px 28px 0',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onBack}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
            }}
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Cpu size={18} color="#8b8df0" />
          </div>
          <div>
            <h2 style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700,
              color: 'var(--text)', margin: 0,
            }}>
              Run Locally with Ollama
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Free forever. Private. Offline. No API key.
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '20px 28px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Status row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 8,
          background: status.running
            ? 'rgba(34,197,94,0.08)'
            : 'var(--bg-2)',
          border: status.running
            ? '1px solid rgba(34,197,94,0.2)'
            : '1px solid var(--border)',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: status.running ? '#4ade80' : '#888',
            boxShadow: status.running ? '0 0 8px #4ade80' : 'none',
          }} />
          <span style={{
            fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
            color: status.running ? '#7aaa8a' : 'var(--text-muted)',
          }}>
            {status.checking && !status.running
              ? 'Checking for Ollama…'
              : status.running
                ? `Ollama detected — ${status.models.length} model${status.models.length === 1 ? '' : 's'} installed${status.version ? ` · v${status.version}` : ''}`
                : 'Ollama not detected'}
          </span>
          <button
            onClick={status.recheck}
            disabled={status.checking}
            style={{
              marginLeft: 'auto',
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-muted)', borderRadius: 6, padding: '4px 8px',
              cursor: status.checking ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <RefreshCw size={11} className={status.checking ? 'animate-spin' : ''} />
            Check
          </button>
        </div>

        {showCorsHint && (
          <CorsHint />
        )}

        {/* CONNECTED + MODELS PRESENT */}
        {status.running && status.models.length > 0 && (
          <>
            {/* Device specs banner */}
            <DeviceSpecsBanner specs={specs} />

            <div>
              <div style={{
                fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
                color: 'var(--text-dim)', marginBottom: 8, letterSpacing: 0.6,
              }}>
                SELECT DEFAULT MODEL
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 6,
                maxHeight: 240, overflowY: 'auto',
                border: '1px solid var(--border)', borderRadius: 10, padding: 6,
              }}>
                {status.models.map((m) => (
                  <ModelRow
                    key={m.id}
                    model={m}
                    selected={selected === m.id}
                    isRecommended={m.id === recommendedId}
                    fit={modelFitsInRAM(parseFloat(m.sizeGB), specs.estimatedRamGB)}
                    onSelect={() => setSelected(m.id)}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleConfirm}
              disabled={!selected}
              style={{
                width: '100%', padding: '13px 0',
                background: '#7a85f0', color: 'var(--bg)',
                border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                cursor: !selected ? 'not-allowed' : 'pointer',
                opacity: !selected ? 0.5 : 1,
              }}
            >
              Start with Ollama →
            </button>
          </>
        )}

        {/* CONNECTED, NO MODELS */}
        {status.running && status.models.length === 0 && (
          <NoModelsInstalled />
        )}

        {/* NOT CONNECTED */}
        {!status.running && !status.checking && <InstallGuide />}
      </div>
    </Shell>
  )
}

const FIT_CONFIG = {
  fits:      { label: '✓ fits',   color: '#4ade80' },
  tight:     { label: '⚠ tight',  color: '#fb923c' },
  'too-large': { label: '✗ too big', color: '#f87171' },
}

function ModelRow({ model, selected, isRecommended, fit, onSelect }) {
  const tierColor = {
    flagship: '#00c8ff', balanced: '#78909c', fast: '#00e676',
    reasoning: '#9485b8', code: '#b09470',
  }[model.tier] ?? '#888'

  const fitCfg = FIT_CONFIG[fit] ?? FIT_CONFIG.fits
  const tooLarge = fit === 'too-large'

  return (
    <button
      onClick={onSelect}
      title={tooLarge ? 'This model is likely too large for your RAM and will cause system slowdowns.' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px',
        background: selected ? 'rgba(122,133,240,0.1)' : 'transparent',
        border: '1px solid',
        borderColor: selected ? '#7a85f0' : tooLarge ? 'rgba(248,113,113,0.25)' : 'transparent',
        borderRadius: 8, cursor: 'pointer', textAlign: 'left',
        width: '100%', opacity: tooLarge ? 0.65 : 1,
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = 'var(--surface-2)'
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = 'transparent'
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
      <span style={{
        flex: 1, fontSize: 13, color: 'var(--text)',
        fontFamily: "'DM Sans', system-ui, sans-serif", minWidth: 0,
      }}>
        {model.name}
        {isRecommended && (
          <span style={{
            marginLeft: 8, fontSize: 9, color: 'var(--text-dim)',
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.4,
          }}>
            · RECOMMENDED
          </span>
        )}
      </span>
      <span style={{
        fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
        color: tierColor, textTransform: 'uppercase', letterSpacing: 0.4, flexShrink: 0,
      }}>
        {model.tier}
      </span>
      <span style={{
        fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
        color: 'var(--text-dim)', minWidth: 42, textAlign: 'right', flexShrink: 0,
      }}>
        {model.sizeGB} GB
      </span>
      <span style={{
        fontSize: 9, fontFamily: "'JetBrains Mono', monospace",
        color: fitCfg.color, letterSpacing: 0.4, minWidth: 48, textAlign: 'right', flexShrink: 0,
      }}>
        {fitCfg.label}
      </span>
    </button>
  )
}

function DeviceSpecsBanner({ specs }) {
  const gpuShort = specs.gpu
    ? specs.gpu.replace(/\(.*\)/g, '').trim().slice(0, 40)
    : 'Unknown GPU'

  const ramLabel = specs.estimatedRamGB !== specs.reportedRamGB
    ? `~${specs.estimatedRamGB} GB RAM`
    : `${specs.reportedRamGB} GB RAM`

  const tierLabel = { low: 'Low-end', mid: 'Mid-range', high: 'High-end', unknown: 'Unknown' }[specs.tier]
  const tierColor = { low: '#fb923c', mid: '#94a5ba', high: '#4ade80', unknown: '#666' }[specs.tier]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      padding: '9px 12px', borderRadius: 8,
      background: 'var(--bg-2)', border: '1px solid var(--border)',
    }}>
      <Monitor size={13} color="var(--text-dim)" style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)', flex: 1, minWidth: 0 }}>
        {gpuShort}
      </span>
      <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <MemoryStick size={11} />
        {ramLabel}
      </span>
      <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: tierColor, letterSpacing: 0.4 }}>
        {tierLabel}
      </span>
    </div>
  )
}

function NoModelsInstalled() {
  return (
    <div style={{
      padding: 16, borderRadius: 10,
      background: 'var(--bg-2)', border: '1px solid var(--border)',
    }}>
      <div style={{
        fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
        color: 'var(--text)', marginBottom: 8,
      }}>
        Ollama is running but no models are installed.
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
        Open a terminal and pull a model. We recommend starting with:
      </p>
      <CodeBlock command="ollama pull qwen2.5:7b" />
      <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '10px 0 0' }}>
        After it downloads, this screen will detect it automatically.
      </p>
    </div>
  )
}

function InstallGuide() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Step 1 */}
      <Step n={1} title="Download Ollama">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PLATFORM_DOWNLOADS.map((p) => (
            <a
              key={p.label}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8,
                background: 'var(--bg-2)', border: '1px solid var(--border)',
                color: 'var(--text)', textDecoration: 'none',
                fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <Download size={12} />
              {p.label}
              <ExternalLink size={10} style={{ opacity: 0.6 }} />
            </a>
          ))}
        </div>
      </Step>

      {/* Step 2 */}
      <Step n={2} title="Pull a model">
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.5 }}>
          Open Terminal and run:
        </p>
        <CodeBlock command="ollama pull qwen2.5:7b" />
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '8px 0 0' }}>
          Downloads Qwen 2.5 7B (4.7&nbsp;GB). Good for most engineering tasks.
        </p>

        <div style={{ marginTop: 12 }}>
          <div style={{
            fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
            color: 'var(--text-dim)', letterSpacing: 0.5, marginBottom: 6,
          }}>
            OR PICK ANOTHER
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {POPULAR_PULLS.map((p) => (
              <PullChip key={p.cmd} {...p} />
            ))}
          </div>
        </div>
      </Step>

      {/* Step 3 */}
      <Step n={3} title="Verify">
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
          This screen auto-detects Ollama every few seconds. Start it and a green status will appear above.
        </p>
      </Step>
    </div>
  )
}

function Step({ n, title, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          width: 20, height: 20, borderRadius: '50%',
          background: 'rgba(99,102,241,0.15)', color: '#8b8df0',
          fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {n}
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700, color: 'var(--text)',
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}>
          {title}
        </span>
      </div>
      <div>{children}</div>
    </div>
  )
}

function CodeBlock({ command }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 12px', borderRadius: 8,
      background: '#0e0e16', border: '1px solid var(--border)',
    }}>
      <code style={{
        flex: 1, fontSize: 12, color: 'var(--text)',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {command}
      </code>
      <CopyButton text={command} />
    </div>
  )
}

function PullChip({ cmd, label, size }) {
  return (
    <button
      onClick={() => navigator.clipboard?.writeText(cmd)}
      title={`Copy: ${cmd}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 10px', borderRadius: 16,
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        color: 'var(--text-muted)', cursor: 'pointer',
        fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#7a85f0')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      {label}
      <span style={{ color: 'var(--text-dim)' }}>{size}</span>
      <Copy size={10} style={{ opacity: 0.6 }} />
    </button>
  )
}

function CorsHint() {
  const macCmd = 'OLLAMA_ORIGINS="*" ollama serve'
  const winCmd = 'set OLLAMA_ORIGINS=* && ollama serve'
  return (
    <div style={{
      padding: 12, borderRadius: 8,
      background: 'rgba(255,176,80,0.08)', border: '1px solid rgba(255,176,80,0.25)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'flex-start',
        color: '#c7a070', fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
      }}>
        <AlertTriangle size={13} style={{ marginTop: 2, flexShrink: 0 }} />
        <span>
          ENGINGUITY can't reach Ollama due to CORS. Restart Ollama with origins allowed:
        </span>
      </div>
      <CodeBlock command={macCmd} />
      <CodeBlock command={winCmd} />
    </div>
  )
}

function Shell({ children, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(8,8,16,0.92)', backdropFilter: 'blur(8px)', padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div style={{
        width: '100%', maxWidth: 560,
        background: 'var(--surface)', border: '1px solid var(--border-bright)',
        borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// Silence unused-import in some toolchains
void getOllamaHost
void OLLAMA_RECOMMENDATIONS

export default OllamaSetup
