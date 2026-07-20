import { useState, useRef, useEffect } from 'react'
import { Send, Pin, Loader2 } from 'lucide-react'
import { useAIProvider } from '../../hooks/useAIProvider'
import type { ComponentData, ChatMessage } from './types'

const EXAMPLE_QUERIES = [
  "What's the max output current?",
  'How do I use this as a comparator?',
  'What decoupling capacitors does this need?',
  'Show me a 5V to 3.3V regulator circuit',
  "What's the quiescent current at 3.3V?",
]

interface Props {
  component: ComponentData
  messages: ChatMessage[]
  onMessagesChange: (msgs: ChatMessage[]) => void
}

export function QueryInterface({ component, messages, onMessagesChange }: Props) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const { makeRequest } = useAIProvider()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function ask(question: string) {
    if (!question.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: question }
    const updated = [...messages, userMsg]
    onMessagesChange(updated)
    setInput('')
    setLoading(true)

    try {
      const system = `You are answering questions about the ${component.component.partNumber} (${component.component.description}).
Datasheet data: ${JSON.stringify(component)}
Answer concisely with specific values from the datasheet where possible.`

      const response = await makeRequest([{ role: 'user', content: question }], system, { maxTokens: 1024 })
      onMessagesChange([...updated, { role: 'assistant', content: response }])
    } catch (err) {
      onMessagesChange([...updated, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Request failed'}` }])
    } finally {
      setLoading(false)
    }
  }

  function togglePin(idx: number) {
    onMessagesChange(messages.map((m, i) => i === idx ? { ...m, pinned: !m.pinned } : m))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text-muted)',   margin: 0 }}>
        Ask about this component
      </h3>

      {/* Example chips */}
      {messages.length === 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {EXAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                border: '1px solid var(--border-bright)',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Chat thread */}
      {messages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 400, overflowY: 'auto', padding: '0 4px' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', gap: 4,
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '80%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                background: msg.role === 'user' ? 'rgba(0,200,255,0.1)' : 'var(--surface-2)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(0,200,255,0.2)' : 'var(--border)'}`,
                color: 'var(--text)',
                fontFamily: "'DM Sans Variable', 'DM Sans', system-ui, sans-serif",
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                position: 'relative',
              }}>
                {msg.content}
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => togglePin(i)}
                    title={msg.pinned ? 'Unpin' : 'Pin to card'}
                    style={{
                      position: 'absolute', top: 6, right: 6,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: msg.pinned ? 'var(--accent)' : 'var(--text-dim)',
                      padding: 2,
                    }}
                  >
                    <Pin size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={14} className="animate-spin" />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>Thinking…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && ask(input)}
          placeholder="Ask anything about this component..."
          style={{ flex: 1, fontSize: 13 }}
        />
        <button
          className="btn"
          onClick={() => ask(input)}
          disabled={loading || !input.trim()}
          style={{ padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Send size={14} />
        </button>
      </div>

      {/* Pinned notes */}
      {messages.some((m) => m.pinned) && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)',   marginBottom: 8 }}>
            Pinned Notes
          </div>
          {messages.filter((m) => m.pinned).map((m, i) => (
            <div key={i} style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(0,200,255,0.05)',
              border: '1px solid rgba(0,200,255,0.15)',
              fontFamily: "'DM Sans Variable', 'DM Sans', system-ui, sans-serif",
              fontSize: 12,
              color: 'var(--text)',
              marginBottom: 6,
              whiteSpace: 'pre-wrap',
            }}>
              {m.content}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
