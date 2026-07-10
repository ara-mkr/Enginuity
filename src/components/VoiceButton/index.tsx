import React, { useState, useEffect, useRef } from 'react'
import { Mic, Volume2, AlertCircle, Loader2, Settings, Play } from 'lucide-react'
import {
  isVoiceSupported,
  createSpeechRecognition,
  speakText,
  parseVoiceIntent
} from '../../engine/voiceEngine'
import { useAIProvider } from '../../hooks/useAIProvider'
import { useLocation, useNavigate } from 'react-router-dom'

// Voice intent params and the Web Speech API recognition object are
// untyped/dynamic here — one localized disable instead of suppressing
// every call site individually.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VoiceAny = any

interface VoiceHistoryItem {
  transcript: string
  intent: string
  params: VoiceAny
  timestamp: string
  succeeded: boolean
}

export function VoiceButton() {
  const { makeRequest } = useAIProvider()
  const navigate = useNavigate()
  const location = useLocation()

  const [supported, setSupported] = useState(false)
  const [active, setActive] = useState(false)
  const [state, setState] = useState<'idle' | 'listening' | 'processing' | 'speaking' | 'error'>('idle')
  const [bubbleText, setBubbleText] = useState('')
  const [, setErrorMsg] = useState('')

  // TTS configurations
  const [showConfig, setShowConfig] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [voiceName, setVoiceName] = useState(localStorage.getItem('enginguity_voice_name') || '')
  const [rate, setRate] = useState(localStorage.getItem('enginguity_voice_rate') || '1.0')
  const [pitch, setPitch] = useState(localStorage.getItem('enginguity_voice_pitch') || '1.0')
  const [volume, setVolume] = useState(localStorage.getItem('enginguity_voice_volume') || '0.8')

  // History configurations
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<VoiceHistoryItem[]>([])

  // Web Speech references
  const recognitionRef = useRef<VoiceAny>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [volumeHeights, setVolumeHeights] = useState<number[]>([10, 10, 10, 10, 10])

  // Long press refs
  const pressTimerRef = useRef<VoiceAny>(null)

  // Initialize
  useEffect(() => {
    const isSupported = isVoiceSupported()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time browser feature detection on mount
    setSupported(isSupported)

    if (isSupported) {
      recognitionRef.current = createSpeechRecognition()
      
      // Load voices list
      const loadVoices = () => {
        const list = window.speechSynthesis.getVoices()
        setVoices(list)
        if (list.length > 0 && !localStorage.getItem('enginguity_voice_name')) {
          const defaultVoice = list.find(v => v.lang.startsWith('en')) || list[0]
          setVoiceName(defaultVoice.name)
          localStorage.setItem('enginguity_voice_name', defaultVoice.name)
        }
      }
      loadVoices()
      window.speechSynthesis.onvoiceschanged = loadVoices

      // Load history
      try {
        const logs = JSON.parse(localStorage.getItem('enginguity_voice_history') || '[]')
        setHistory(logs)
      } catch { /* corrupted/missing stored value — fall back to default */ }
    }
  }, [])

  // Stable refs for toggleListening/stopVoiceMode — declared further below,
  // but the global keydown listener needs to call the latest version without
  // re-registering the listener on every state change.
  const toggleListeningRef = useRef<() => void>(() => {})
  const stopVoiceModeRef = useRef<() => void>(() => {})

  // Global Keyboard listener: V key to toggle and ESC key to cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault()
        toggleListeningRef.current()
      } else if (e.key === 'Escape') {
        stopVoiceModeRef.current()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Clean-up refs on unmount. Uses stopVoiceModeRef (kept in sync further
  // below) rather than calling stopVoiceMode directly, since that function
  // is declared later in this component.
  useEffect(() => {
    return () => {
      stopVoiceModeRef.current()
    }
  }, [])

  // Audio mic volume analyzer
  const startAudioAnalyzer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const AudioContextClass = window.AudioContext || (window as VoiceAny).webkitAudioContext
      const audioCtx = new AudioContextClass()
      audioContextRef.current = audioCtx

      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 32
      analyserRef.current = analyser
      source.connect(analyser)

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const draw = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)
        
        // Take 5 frequency points and scale them to height values (4px to 24px)
        const heights = [
          Math.max(4, (dataArray[2] / 255) * 24),
          Math.max(4, (dataArray[4] / 255) * 24),
          Math.max(4, (dataArray[6] / 255) * 24),
          Math.max(4, (dataArray[8] / 255) * 24),
          Math.max(4, (dataArray[10] / 255) * 24)
        ]
        setVolumeHeights(heights)
        animationFrameRef.current = requestAnimationFrame(draw)
      }
      draw()
    } catch (e) {
      console.warn('Audio visualizer stream blocked:', e)
    }
  }

  const stopAudioAnalyzer = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setVolumeHeights([10, 10, 10, 10, 10])
  }

  // Recognition events
  const startSpeechRecognition = () => {
    const rec = recognitionRef.current
    if (!rec) return

    setState('listening')
    setBubbleText('Listening...')
    setErrorMsg('')
    setActive(true)

    rec.onresult = async (event: VoiceAny) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript
        } else {
          interim += event.results[i][0].transcript
        }
      }

      if (interim) {
        setBubbleText(interim)
      }

      if (final) {
        setBubbleText(final)
        await executeVoiceCommand(final)
      }
    }

    rec.onerror = (e: VoiceAny) => {
      console.error('Speech error:', e)
      if (e.error === 'not-allowed') {
        setState('error')
        setErrorMsg('Microphone access denied.')
        setBubbleText('Microphone access denied.')
      } else {
        setState('error')
        setErrorMsg('Speech recognition failed.')
        setBubbleText('Speech recognition failed.')
      }
      stopAudioAnalyzer()
    }

    rec.onend = () => {
      // Auto restart if active is true (keeps continuous listening alive)
      if (active && state === 'listening') {
        try { rec.start() } catch { /* already started — restart race, harmless */ }
      }
    }

    try {
      rec.start()
      startAudioAnalyzer()
    } catch (err) {
      console.error(err)
    }
  }

  // Main voice commander execution
  const executeVoiceCommand = async (transcript: string) => {
    const lower = transcript.toLowerCase().trim()
    if (lower.includes('command palette') || lower.includes('open commands')) {
      speakConfirmation('Opening command palette.')
      window.dispatchEvent(new CustomEvent('enginguity_open_command_palette'))
      return
    }

    setState('processing')
    setBubbleText('Processing Intent...')

    // Gather context
    const pathParts = location.pathname.split('/')
    const activeModule = pathParts[pathParts.length - 1] || 'dashboard'
    
    let parameters = {}
    try {
      const saved = localStorage.getItem('enginguity_params_prefill')
      if (saved) parameters = JSON.parse(saved)
    } catch { /* corrupted/missing stored value — fall back to default */ }

    const projectDesc = localStorage.getItem('enginguity_project_description') || ''

    // Match intent via AI
    const result = await parseVoiceIntent(makeRequest, transcript, activeModule, parameters, projectDesc)

    if (result && result.intent) {
      await handleIntentRoute(result.intent, result.params, transcript)
    } else {
      speakConfirmation('I did not catch that. Try again.')
      setState('error')
      setBubbleText('No intent matched.')
    }
  }

  // Route matches
  const handleIntentRoute = async (intent: string, params: VoiceAny, transcript: string) => {
    const pathParts = location.pathname.split('/')
    const activeModule = pathParts[pathParts.length - 1] || 'dashboard'
    let speakMessage: string
    let success = true

    try {
      switch (intent) {
        case 'navigate': {
          const modulePath = params.module === 'playground' ? 'parameter-playground' : params.module
          speakMessage = `Opening ${params.module.replace('-', ' ')}`
          navigate(`/${modulePath}`)
          break
        }

        case 'set_parameter': {
          // Prefill values locally and update slider state
          speakMessage = `${params.paramName} set to ${params.value} ${params.unit || ''}`
          const prefill = JSON.parse(localStorage.getItem('enginguity_params_prefill') || '{}')
          prefill[params.paramName] = params.value
          localStorage.setItem('enginguity_params_prefill', JSON.stringify(prefill))
          // Trigger reload if already on page to force rerender
          if (location.pathname.includes('parameter-playground')) {
            window.dispatchEvent(new CustomEvent('param-external-updated', { detail: { name: params.paramName, val: params.value } }))
          }
          break
        }

        case 'read_value': {
          const vals = JSON.parse(localStorage.getItem('enginguity_params_prefill') || '{}')
          const reading = vals[params.paramName]
          speakMessage = reading !== undefined
            ? `${params.paramName} is currently ${reading}`
            : `I could not find parameter value for ${params.paramName}`
          break
        }

        case 'ask_question': {
          setState('processing')
          setBubbleText('Thinking...')
          const aiResponse = await makeRequest([{ role: 'user', content: params.question }], 'Provide a short spoken summary (max 120 words) to this engineering query.')
          speakMessage = aiResponse
          break
        }

        case 'add_notebook_entry': {
          const newEntry = {
            // eslint-disable-next-line react-hooks/purity -- async voice-command handler, not render; timestamp needs to be unique per entry
            id: `nb-voice-${Date.now()}`,
            type: params.type || 'NOTE',
            title: params.title || 'Voice Log note',
            tags: ['VoiceCommand', 'HandsFree'],
            date: new Date().toISOString(),
            linkedModule: activeModule || 'Voice',
            notes: params.content || ''
          }
          const existing = JSON.parse(localStorage.getItem('enginguity_notebook') || '[]')
          localStorage.setItem('enginguity_notebook', JSON.stringify([newEntry, ...existing]))
          // Alert notebook
          window.dispatchEvent(new Event('notebook-updated'))
          speakMessage = `Added ${params.type.toLowerCase()} note titled ${params.title} to notebook.`
          break
        }

        case 'stop_voice':
          speakMessage = 'Stopping voice assistant.'
          stopVoiceMode()
          return

        case 'help':
          speakMessage = 'Try saying open parameter playground, set voltage to 12, or ask a question like what is a buck converter.'
          break

        default:
          speakMessage = 'I am not sure how to do that. Try saying help for available commands.'
          success = false
      }
    } catch {
      speakMessage = 'An error occurred executing this voice command.'
      success = false
    }

    // Save to history log
    saveHistory(transcript, intent, params, success)

    // Speak response
    speakConfirmation(speakMessage)
  }

  // TTS Speak and update button state
  const speakConfirmation = (message: string) => {
    setState('speaking')
    
    // Truncate long AI answers in TTS to maintain brevity
    let ttsText = message
    if (ttsText.split(' ').length > 150) {
      ttsText = ttsText.split(' ').slice(0, 150).join(' ') + '... and more. Check the screen for full details.'
    }

    setBubbleText(ttsText)

    speakText(ttsText, {
      onStart: () => {},
      onEnd: () => {
        // Return to listening mode
        if (active) {
          setState('listening')
          setBubbleText('Listening...')
          try { recognitionRef.current.start() } catch { /* already started — restart race, harmless */ }
        } else {
          setState('idle')
        }
      },
      onError: () => {
        setState('idle')
      }
    })
  }

  // History save helper
  const saveHistory = (transcript: string, intent: string, params: VoiceAny, succeeded: boolean) => {
    const newItem: VoiceHistoryItem = {
      transcript,
      intent,
      params,
      timestamp: new Date().toLocaleTimeString(),
      succeeded
    }
    const updated = [newItem, ...history].slice(0, 50)
    setHistory(updated)
    localStorage.setItem('enginguity_voice_history', JSON.stringify(updated))
  }

  const toggleListening = () => {
    if (state === 'listening' || state === 'processing' || state === 'speaking') {
      stopVoiceMode()
    } else {
      startSpeechRecognition()
    }
  }

  const stopVoiceMode = () => {
    setActive(false)
    setState('idle')
    setBubbleText('')
    stopAudioAnalyzer()

    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* already stopped */ }
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
  }

  useEffect(() => {
    toggleListeningRef.current = toggleListening
    stopVoiceModeRef.current = stopVoiceMode
  }, [toggleListening, stopVoiceMode])

  // Long press UI handlers
  const handleMouseDown = () => {
    pressTimerRef.current = setTimeout(() => {
      setShowConfig(true)
    }, 800) // 800ms long press
  }

  const handleMouseUp = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current)
  }

  // TTS Configurations save handlers
  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setVoiceName(e.target.value)
    localStorage.setItem('enginguity_voice_name', e.target.value)
  }

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRate(e.target.value)
    localStorage.setItem('enginguity_voice_rate', e.target.value)
  }

  const handlePitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPitch(e.target.value)
    localStorage.setItem('enginguity_voice_pitch', e.target.value)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(e.target.value)
    localStorage.setItem('enginguity_voice_volume', e.target.value)
  }

  const handleTestVoice = () => {
    speakText('Testing synthesised voice configurations. Calibration complete.')
  }

  // Right click history context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowHistory(!showHistory)
  }

  if (!supported) {
    return (
      <div style={{ position: 'fixed', bottom: 10, right: 10, fontSize: 9, color: 'var(--text-muted)' }}>
        Firefox does not support Speech API. Use Chrome.
      </div>
    )
  }

  const isListening = state === 'listening'
  const isSpeaking = state === 'speaking'
  const isProcessing = state === 'processing'
  const isError = state === 'error'

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1060, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
      
      {/* Speech Text Bubble */}
      {bubbleText && (
        <div style={{
          background: 'var(--surface)',
          border: `1px solid ${isError ? '#b08080' : 'var(--border-bright)'}`,
          borderRadius: 8,
          padding: '8px 14px',
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          color: isError ? 'var(--text-muted)' : 'var(--text)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          maxWidth: 260,
          animation: 'fade-in 0.2s',
          lineHeight: 1.4,
          wordWrap: 'break-word'
        }}>
          {bubbleText}
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        onContextMenu={handleContextMenu}
        onClick={toggleListening}
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--surface)',
          border: `1px solid ${isListening ? 'var(--accent)' : 'var(--border-bright)'}`,
          boxShadow: 'none',
          color: isListening ? 'var(--accent)' : isSpeaking ? 'var(--accent-2)' : 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.15s',
          outline: 'none'
        }}
        title="Voice Mode [V] (Long-press: Settings | Right-click: History)"
      >
        {isListening ? (
          // Volume dynamic waveform visualizer
          <div style={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
            {volumeHeights.map((h, i) => (
              <div
                key={i}
                style={{
                  width: 3,
                  height: h,
                  background: 'var(--accent)',
                  borderRadius: 1.5,
                  transition: 'height 0.05s ease'
                }}
              />
            ))}
          </div>
        ) : isProcessing ? (
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
        ) : isSpeaking ? (
          <Volume2 size={18} />
        ) : isError ? (
          <AlertCircle size={18} style={{ color: '#b08080' }} />
        ) : (
          <Mic size={18} />
        )}
      </button>

      {/* Settings Configuration Modal */}
      {showConfig && (
        <div style={modalStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", display: 'flex', alignItems: 'center', gap: 4 }}><Settings size={12} /> TTS Voice Config</span>
            <button onClick={() => setShowConfig(false)} style={closeButtonStyle} data-tooltip="Close">✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
            <div style={rowStyle}>
              <span>Voice:</span>
              <select value={voiceName} onChange={handleVoiceChange} style={selectStyle}>
                {voices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
              </select>
            </div>
            <div style={rowStyle}>
              <span>Speed ({rate}x):</span>
              <input type="range" min="0.7" max="1.5" step="0.1" value={rate} onChange={handleRateChange} />
            </div>
            <div style={rowStyle}>
              <span>Pitch ({pitch}):</span>
              <input type="range" min="0.8" max="1.2" step="0.1" value={pitch} onChange={handlePitchChange} />
            </div>
            <div style={rowStyle}>
              <span>Volume ({volume}):</span>
              <input type="range" min="0" max="1" step="0.1" value={volume} onChange={handleVolumeChange} />
            </div>
            <button onClick={handleTestVoice} style={btnStyle}>Test Calibration</button>
          </div>
        </div>
      )}

      {/* History log drawer */}
      {showHistory && (
        <div style={historyStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>Command History</span>
            <button onClick={() => setShowHistory(false)} style={closeButtonStyle} data-tooltip="Close">✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
            {history.length > 0 ? history.map((item, idx) => (
              <div key={idx} style={{
                fontSize: 10,
                padding: 6,
                borderRadius: 4,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
                  <span style={{ fontStyle: 'italic', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 160 }}>"{item.transcript}"</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 8 }}>{item.timestamp} • {item.intent}</span>
                </div>
                <button
                  onClick={() => {
                    executeVoiceCommand(item.transcript)
                    setShowHistory(false)
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}
                >
                  <Play size={10} />
                </button>
              </div>
            )) : (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>No voice logs saved.</div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

const modalStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border-bright)',
  borderRadius: 8,
  padding: 12,
  width: 220,
  boxShadow: '0 8px 20px rgba(0,0,0,0.6)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 1070
}

const historyStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border-bright)',
  borderRadius: 8,
  padding: 12,
  width: 240,
  boxShadow: '0 8px 20px rgba(0,0,0,0.6)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 1070
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
}

const selectStyle: React.CSSProperties = {
  width: 120,
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 4,
  padding: '2px 4px',
  fontSize: 10,
  outline: 'none'
}

const btnStyle: React.CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--bg)',
  border: 'none',
  padding: '4px 8px',
  borderRadius: 4,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'JetBrains Mono', monospace",
  textAlign: 'center',
  marginTop: 6
}

const closeButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: 10,
  marginLeft: 'auto'
}
