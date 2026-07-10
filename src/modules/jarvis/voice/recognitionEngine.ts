/**
 * Singleton recognition engine — lives outside React.
 * Never recreated on re-renders.
 *
 * isAwake tracks whether we should process commands (true) or
 * listen for wake words (false). React manages the sleep timer
 * and calls manualSleep() when it fires.
 */

type DiagType = 'info' | 'success' | 'warn' | 'error'

// Web Speech API (SpeechRecognition) isn't in the standard lib.dom types
// and jarvisDiag is a debug bridge attached to window at runtime — one
// localized disable instead of suppressing every callsite individually.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VoiceEngineAny = any

const diag = (msg: string, type: DiagType = 'info') =>
  (window as VoiceEngineAny).jarvisDiag?.(msg, type)

const WAKE_WORDS = [
  'hey jarvis', 'jarvis', 'hey javis',
  'hey travis', 'hey service', 'ok jarvis',
  'yo jarvis', 'hey jarvice',
]

// Module-level singletons — one instance for the page lifetime
let recognition: VoiceEngineAny = null
let _isListening = false
let _isAwake = false

export interface VoiceCallbacks {
  onWake?: () => void
  onSleep?: () => void
  onTranscript?: (text: string, isFinal: boolean) => void
  onCommand?: (cmd: string) => void
  onError?: (msg: string) => void
  onListeningChange?: (listening: boolean) => void
}

let cbs: VoiceCallbacks = {}

export function setVoiceCallbacks(callbacks: VoiceCallbacks): void {
  cbs = { ...cbs, ...callbacks }
}

export function initRecognition(): boolean {
  diag('initRecognition() called', 'info')

  const SR = (window as VoiceEngineAny).SpeechRecognition || (window as VoiceEngineAny).webkitSpeechRecognition
  if (!SR) {
    diag('SpeechRecognition NOT supported', 'error')
    cbs.onError?.('Speech recognition not supported. Use Chrome or Edge.')
    return false
  }

  diag('SpeechRecognition supported ✓', 'success')

  recognition = new SR()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'en-US'
  recognition.maxAlternatives = 3

  recognition.onstart = () => {
    _isListening = true
    diag('recognition.onstart fired', 'success')
    cbs.onListeningChange?.(true)
  }

  recognition.onend = () => {
    _isListening = false
    diag('recognition.onend fired — restarting in 300ms', 'warn')
    cbs.onListeningChange?.(false)

    setTimeout(() => {
      if (!recognition) return
      try {
        recognition.start()
        diag('recognition restarted', 'info')
      } catch (e: VoiceEngineAny) {
        if (!e.message?.includes('already started')) {
          diag(`restart failed: ${e.message}`, 'error')
          // Full reinit after 1s
          recognition = null
          setTimeout(() => {
            if (initRecognition()) startVoice()
          }, 1000)
        }
      }
    }, 300)
  }

  recognition.onerror = (e: VoiceEngineAny) => {
    const err = e.error as string
    diag(`recognition.onerror: ${err}`, 'error')
    switch (err) {
      case 'not-allowed':
        cbs.onError?.(
          'Microphone permission denied. Click the mic icon in your browser address bar and allow access.'
        )
        recognition = null
        break
      case 'no-speech':
        diag('No speech detected (normal)', 'info')
        break
      case 'network':
        diag('Network error — will retry via onend', 'warn')
        break
      case 'aborted':
        diag('Recognition aborted (ok)', 'warn')
        break
      default:
        diag(`Unhandled error: ${err}`, 'error')
    }
  }

  recognition.onresult = (event: VoiceEngineAny) => {
    let interimTranscript = ''
    let finalTranscript = ''

    // KEY FIX: start from event.resultIndex, not 0.
    // Using index 0 caused the wake word in old results to re-trigger
    // on every subsequent event, creating the Woke-up → Went-to-sleep loop.
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      const text = result[0].transcript
      if (result.isFinal) {
        finalTranscript += text
        diag(
          `FINAL: "${text}" (conf: ${result[0].confidence?.toFixed(2) ?? 'n/a'})`,
          'success'
        )
      } else {
        interimTranscript += text
      }
    }

    if (interimTranscript) {
      diag(`interim: "${interimTranscript}"`, 'info')
      cbs.onTranscript?.(interimTranscript, false)
    }

    const toProcess = finalTranscript || interimTranscript
    if (!toProcess.trim()) return

    const lower = toProcess.toLowerCase().trim()
    diag(`processing: "${lower}"`, 'info')

    if (!_isAwake) {
      // Only trigger on final results to avoid false positives from interim
      if (finalTranscript && WAKE_WORDS.some((w) => lower.includes(w))) {
        diag('WAKE WORD DETECTED!', 'success')
        setAwakeInternal(true)
        const cmd = extractAfterWakeWord(lower)
        if (cmd.length > 2) {
          diag(`inline command after wake word: "${cmd}"`, 'success')
          cbs.onCommand?.(cmd)
        }
      }
    } else {
      if (finalTranscript.trim().length > 1) {
        diag(`COMMAND RECEIVED: "${finalTranscript}"`, 'success')
        cbs.onTranscript?.(finalTranscript, true)
        cbs.onCommand?.(finalTranscript.trim())
      }
    }
  }

  return true
}

function setAwakeInternal(awake: boolean): void {
  if (awake === _isAwake) return
  _isAwake = awake
  if (awake) {
    diag('Engine: WAKING UP', 'success')
    cbs.onWake?.()
  } else {
    diag('Engine: SLEEPING', 'warn')
    cbs.onSleep?.()
  }
}

function extractAfterWakeWord(transcript: string): string {
  for (const w of WAKE_WORDS) {
    const idx = transcript.indexOf(w)
    if (idx !== -1) return transcript.slice(idx + w.length).trim()
  }
  return ''
}

export function startVoice(): void {
  diag('startVoice() called', 'info')
  if (!recognition) {
    if (!initRecognition()) return
  }
  try {
    recognition.start()
    diag('recognition.start() called', 'info')
  } catch (e: VoiceEngineAny) {
    if (e.message?.includes('already started')) {
      diag('already running (ok)', 'info')
    } else {
      diag(`start error: ${e.message}`, 'error')
    }
  }
}

export function stopVoice(): void {
  diag('stopVoice() called', 'info')
  if (recognition) {
    recognition.onend = null  // prevent auto-restart on unmount
    recognition.abort()
    recognition = null
  }
  _isListening = false
  _isAwake = false
}

/** Call before TTS starts — prevents Jarvis from hearing itself */
export function pauseVoiceForTTS(): void {
  if (recognition && _isListening) {
    try { recognition.stop() } catch { /* ok */ }
  }
}

/** Call after TTS ends — resumes recognition */
export function resumeVoiceAfterTTS(): void {
  setTimeout(() => {
    if (recognition) {
      try { recognition.start() } catch { /* ok if already running */ }
    }
  }, 200)
}

/** Manually wake (e.g. button press) */
export function manualWake(): void {
  diag('manual wake triggered', 'info')
  setAwakeInternal(true)
}

/** Manually sleep (e.g. sleep timer, button press) */
export function manualSleep(): void {
  diag('manual sleep triggered', 'info')
  setAwakeInternal(false)
}

export function getIsAwake(): boolean { return _isAwake }
export function getIsListening(): boolean { return _isListening }
