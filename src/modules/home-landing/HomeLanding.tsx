import { useState, useRef, useEffect } from 'react'
import owlMark from '../../assets/owl-mark.png'
import { useNavigate } from 'react-router-dom'
import { useAIProvider } from '../../hooks/useAIProvider'
import { useProjectContext } from '../../hooks/useProjectContext'
import { useHomeChat, type HomeMessage as Message } from '../../context/HomeChatContext'
import { ChatHistoryPopover } from '../../components/ChatHistoryPopover'
import {
  Sparkles, Send, Box, Code2, Cpu, HelpCircle,
  FolderPlus, RefreshCw, MessageSquare, AlertTriangle, ArrowRight
} from 'lucide-react'

// ── Interfaces ─────────────────────────────────────────────────────────────

interface ExtractedProject {
  title: string
  description: string
  components: string[]
}

const STARTERS = [
  {
    label: 'Design a Smart Bird Feeder',
    prompt: 'I want to build a smart bird feeder using an ESP32 camera module, motion sensor, and battery. Suggest how to wire it, compile code, and write a design summary.'
  },
  {
    label: 'Build a Robotic Arm Controller',
    prompt: 'Explain how to design a simple 3-axis servo robotic arm controller using an Arduino Nano, rotary encoders, and a custom PCB.'
  },
  {
    label: 'Explain Buck vs Boost Converters',
    prompt: 'Explain the functional differences between buck and boost regulators, how to select inductor values, and draw a block schematic.'
  },
  {
    label: 'Setup ESP8266 WiFi Home Relay',
    prompt: 'How do I wire a 5V relay module to an ESP8266 NodeMCU board to safely switch mains lights over home WiFi?'
  }
]

export function HomeLanding() {
  const navigate = useNavigate()
  const { makeRequest, isConnected, activeModel, openGrid } = useAIProvider()
  const { tags: brainTags, setDescription: setBrainDescription, setTags: setBrainTags } = useProjectContext()

  const {
    messages, setMessages,
    sessions, activeSessionId,
    startNewSession, switchToSession, deleteSession, renameSession,
  } = useHomeChat()

  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If we unmounted mid-stream (user switched tabs), the persisted message
  // still has isStreaming: true — clear it on mount so the blinking cursor
  // doesn't get stuck forever. The partial reply stays as-is.
  useEffect(() => {
    setMessages((prev) => {
      if (!prev.some((m) => m.isStreaming)) return prev
      return prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Extracted blueprint state
  const [activeBlueprint, setActiveBlueprint] = useState<ExtractedProject | null>(null)

  const feedEndRef = useRef<HTMLDivElement>(null)

  // Resizable sidebar states
  const [sidebarWidth, setSidebarWidth] = useState(340)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    
    // Set global cursor style and prevent text selection during drag
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Calculate sidebar width based on absolute distance to the right edge of the screen
      const calculatedWidth = window.innerWidth - moveEvent.clientX
      const maxAllowed = window.innerWidth - 350
      if (calculatedWidth >= 200 && calculatedWidth <= Math.min(800, maxAllowed)) {
        setSidebarWidth(calculatedWidth)
      }
    }

    const handleMouseUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Auto scroll to bottom of chat
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Process message and make request
  const handleSendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    // Clear previous error
    setError(null)

    // 1. Add user message
    const userMessage: Message = { role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setLoading(true)

    // 2. Add empty assistant placeholder for streaming
    const assistantPlaceholder: Message = { role: 'assistant', content: '', isStreaming: true }
    setMessages(prev => [...prev, assistantPlaceholder])

    const systemPrompt = `You are an expert engineering design assistant. You help engineers brainstorm projects, answer design questions, and outline schematics or components. Speak plainly, avoid filler words, and keep recommendations concise and practical.

If the user describes a project they want to build (or asks for a project plan), explain your recommendations in your message. At the very end of your response, output a structured JSON block containing project properties. Enclose it strictly in [PROJECT_DATA]...[/PROJECT_DATA] tags. Do not mention this tag or JSON structure in your speech, just append it silently.
Example format to append at the end:
[PROJECT_DATA]
{
  "title": "Smart Greenhouse Controller",
  "description": "An ESP32-based automated greenhouse monitoring and watering system using soil and DHT22 sensors.",
  "components": ["ESP32", "Soil Moisture Sensor", "DHT22 Sensor", "5V Relay", "Water Pump"]
}
[/PROJECT_DATA]`

    try {
      // Create message list for API call
      const apiMessages = [
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: trimmed }
      ]

      let fullResponse = ''
      
      await makeRequest(apiMessages, systemPrompt, {
        maxTokens: 4000,
        stream: true,
        onToken: (token, full) => {
          fullResponse = full
          // Update placeholder in real time
          setMessages(prev => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              // Hide JSON block from streaming content
              const display = full.replace(/\[PROJECT_DATA\][\s\S]*$/, '').trim()
              last.content = display || '...'
            }
            return next
          })
        }
      })

      // Final replacement and metadata extraction
      setMessages(prev => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last && last.role === 'assistant') {
          const display = fullResponse.replace(/\[PROJECT_DATA\][\s\S]*$/, '').trim()
          last.content = display
          last.isStreaming = false
        }
        return next
      })

      // Extract Project Data JSON
      const projectMatch = fullResponse.match(/\[PROJECT_DATA\]([\s\S]+?)\[\/PROJECT_DATA\]/)
      if (projectMatch) {
        try {
          const parsed = JSON.parse(projectMatch[1].trim()) as ExtractedProject
          if (parsed && parsed.title && parsed.description) {
            setActiveBlueprint(parsed)
          }
        } catch (e) {
          console.error('Failed to parse project JSON:', e)
        }
      }

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to communicate with the model.')
      // Remove placeholder
      setMessages(prev => prev.filter(m => m.content !== ''))
    } finally {
      setLoading(false)
    }
  }

  // Handle load to workspace
  const handleLoadBlueprint = () => {
    if (!activeBlueprint) return

    // 1. Set Description
    const desc = `Title: ${activeBlueprint.title}\nDescription: ${activeBlueprint.description}\nInitial components list: ${activeBlueprint.components.join(', ')}`
    setBrainDescription(desc)

    // 2. Set tags
    const combined = Array.from(new Set([...brainTags, ...activeBlueprint.components]))
    setBrainTags(combined)

    // 3. Redirect to dashboard
    navigate('/dashboard')
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-[#080808]" style={{ color: 'var(--text)' }}>
      
      {/* Landing Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-[#080808]" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <MessageSquare size={20} color="var(--accent)" />
          <div>
            <h1 className="text-base font-bold font-mono tracking-tight" style={{ color: 'var(--text)' }}>
              Engineering Home Assistant
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Brainstorm project ideas, ask calculations, or load blueprint designs into your workspace.
            </p>
          </div>
        </div>

        {/* Model status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ChatHistoryPopover
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSwitch={switchToSession}
            onNew={startNewSession}
            onDelete={deleteSession}
            onRename={renameSession}
            label="Chats"
            align="right"
          />
          {isConnected && activeModel && (
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-[#131313] border border-[#1f1f35] text-xs font-mono">
              <Sparkles size={12} color="var(--accent)" className="animate-pulse" />
              <span style={{ color: 'var(--text-muted)' }}>AI Model:</span>
              <span style={{ color: 'var(--accent)' }}>{activeModel}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main split viewport */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        
        {/* CHAT SECTION */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#080808] relative">

          {/* Owl watermark */}
          <img
            src={owlMark}
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '42%',
              pointerEvents: 'none',
              opacity: 0.18,
              filter: 'blur(0.6px)',
              mixBlendMode: 'screen',
              userSelect: 'none',
              zIndex: 0,
            }}
          />

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4" style={{ position: 'relative', zIndex: 1 }}>
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col max-w-[80%] ${
                  msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                }`}
              >
                <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1">
                  {msg.role === 'user' ? 'You' : 'Assistant'}
                </span>
                <div
                  className={`p-4 rounded-lg text-xs leading-relaxed font-sans whitespace-pre-line border ${
                    msg.role === 'user'
                      ? 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border-bright)]'
                      : 'bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]'
                  }`}
                >
                  {msg.content}
                  {msg.isStreaming && (
                    <span className="inline-block w-1.5 h-3 bg-[var(--accent)] ml-1 animate-pulse" />
                  )}
                </div>
              </div>
            ))}
            <div ref={feedEndRef} />
          </div>

          {/* Quick Prompts row (only shown before loading anything custom) */}
          {messages.length === 1 && (
            <div className="px-6 py-2 flex flex-col gap-2 bg-[#0e0e0e] border-t" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Suggested Starters</span>
              <div className="grid grid-cols-2 gap-2">
                {STARTERS.map((st, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(st.prompt)}
                    className="p-2.5 rounded bg-[var(--surface)] border border-[var(--border)] text-left hover:border-[var(--border-bright)] hover:bg-[var(--surface-2)] text-[11px] font-sans text-[var(--text-muted)] hover:text-white transition-all truncate"
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input bar */}
          <div className="p-4 bg-[#0e0e0e] border-t flex flex-col gap-2 shrink-0" style={{ borderColor: 'var(--border)' }}>
            
            {error && (
              <div className="p-2.5 rounded border border-red-950/40 bg-red-950/20 text-red-400 text-[11px] font-mono flex gap-2 items-center">
                <AlertTriangle size={12} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage(inputValue)
                }}
                disabled={loading || !isConnected}
                placeholder={
                  isConnected
                    ? "Ask a design question or describe a project..."
                    : "△ Connect an OpenRouter key in the sidebar to chat."
                }
                className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded px-4 py-2.5 text-xs text-white outline-none focus:border-[var(--accent)] transition-colors placeholder-[var(--text-dim)]"
              />
              <button
                onClick={() => handleSendMessage(inputValue)}
                disabled={loading || !inputValue.trim() || !isConnected}
                className="px-4 rounded bg-[var(--accent)] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-black flex items-center justify-center cursor-pointer shrink-0"
              >
                {loading ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
              </button>
            </div>
          </div>

        </div>

        {/* RESIZER BAR */}
        <div
          onMouseDown={handleMouseDown}
          className="w-[8px] cursor-ew-resize select-none shrink-0 transition-colors duration-150 bg-[#1f1f35] hover:bg-[var(--accent)] border-l border-r border-[#080808]"
        />

        {/* BLUEPRINT BLUE SIDEBAR */}
        <div
          style={{ width: `${sidebarWidth}px` }}
          className="shrink-0 bg-[#080808] flex flex-col p-5 overflow-y-auto"
        >
          {activeBlueprint ? (
            <div className="flex flex-col gap-5">
              <div className="border border-[var(--accent)] rounded-lg p-5 bg-[var(--surface)] flex flex-col gap-4">
                
                <div className="flex items-center gap-1.5 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                  <Sparkles size={14} color="var(--accent)" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">Project Blueprint</span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Project Title</span>
                  <div className="text-sm font-sans font-medium text-white">{activeBlueprint.title}</div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Description</span>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed font-sans">{activeBlueprint.description}</p>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">Extracted Components</span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeBlueprint.components.map(part => (
                      <span
                        key={part}
                        className="bg-[var(--surface-2)] border border-[var(--border-bright)] rounded px-2 py-0.5 text-[10px] font-sans font-normal text-white"
                      >
                        {part}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleLoadBlueprint}
                  className="w-full py-2.5 rounded text-xs font-mono font-bold bg-[var(--accent)] text-[#000] hover:opacity-90 flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md mt-2"
                >
                  <FolderPlus size={13} />
                  Load into Project Workspace
                </button>

              </div>
              
              <button
                onClick={() => setActiveBlueprint(null)}
                className="w-full py-2 border rounded border-[var(--border)] hover:bg-[#111111] hover:border-[var(--border-bright)] text-xs font-sans text-[var(--text-muted)] hover:text-white transition-all cursor-pointer text-center"
              >
                Clear blueprint
              </button>
            </div>
          ) : (
            <div className="h-full flex flex-col justify-center items-center text-center p-4">
              <Cpu size={36} className="text-[#1f1f35] mb-3" />
              <span className="text-xs font-mono font-bold text-[var(--text-dim)] block mb-1">
                No active blueprint
              </span>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                Describe a hardware design in the chat feed (e.g. "I want to build a WiFi-connected temperature station"). The assistant will extract a structural outline card here.
              </p>
            </div>
          )}
        </div>

      </div>

    </div>
  )
}
