import { useState, useRef, useEffect } from 'react'
import { X, KeyRound, ShieldCheck } from 'lucide-react'
import { useAPIKey } from '../context/APIKeyContext'

interface APIKeyModalProps {
  onClose: () => void
}

export function APIKeyModal({ onClose }: APIKeyModalProps) {
  const { setApiKey, apiKey } = useAPIKey()
  const [value, setValue] = useState(apiKey ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSave() {
    const trimmed = value.trim()
    if (!trimmed) return
    setApiKey(trimmed)
    onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-md rounded-xl p-6 border shadow-2xl"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="p-2 rounded-lg"
            style={{ background: 'rgba(0,200,255,0.1)' }}
          >
            <KeyRound size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h2 className="text-base font-semibold font-mono" style={{ color: 'var(--text)' }}>
              Anthropic API Key
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Required to unlock all AI modules
            </p>
          </div>
        </div>

        {/* Input */}
        <label className="block mb-1 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
          API Key
        </label>
        <input
          ref={inputRef}
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="sk-ant-..."
          className="w-full px-3 py-2 rounded-lg text-sm font-mono mb-4 outline-none border transition-colors"
          style={{
            background: 'var(--bg)',
            color: 'var(--text)',
            borderColor: 'var(--border)',
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = 'var(--accent-2)')
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = 'var(--border)')
          }
        />

        {/* Disclaimer */}
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-lg mb-5 text-xs"
          style={{ background: 'rgba(0,200,255,0.06)', color: 'var(--text-muted)' }}
        >
          <ShieldCheck size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--accent-2)' }} />
          <span>Your key is stored locally and never leaves your browser.</span>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!value.trim()}
            className="px-5 py-2 rounded-lg text-sm font-semibold font-mono transition-all disabled:opacity-40"
            style={{
              background: 'var(--accent)',
              color: 'var(--bg)',
            }}
          >
            Save Key
          </button>
        </div>
      </div>
    </div>
  )
}
