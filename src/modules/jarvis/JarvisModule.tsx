import { useState, useRef, useEffect, useCallback, Component } from 'react'
import type { ReactNode } from 'react'
import {
  setVoiceCallbacks,
  startVoice,
  stopVoice,
  pauseVoiceForTTS,
  resumeVoiceAfterTTS,
  manualWake as engineWake,
  manualSleep as engineSleep,
} from './voice/recognitionEngine'
import {
  stopCamera as engStopCamera,
  isCameraActive as engIsCameraActive,
} from './camera/cameraEngine'
import { buildSearchIndex, searchIndex as runSearchIndex } from '../../engine/searchIndex'
import { loadSnapshot, buildStateSnapshot, diffSnapshots } from '../../engine/sessionDiff'
import { Mic, MicOff, Volume2, VolumeX, Settings, X, Maximize2, Minimize2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAIProvider } from '../../hooks/useAIProvider'
import { useFocusMode } from '../../context/FocusModeContext'
import { InfiniteCanvas } from './canvas/InfiniteCanvas'
import { ImmersiveContainer } from './immersive/ImmersiveContainer'
import { moduleStateStore } from '../../store/moduleState'
import { logEvent } from '../../engine/eventLog'
import {
  classifyIntent,
  fetchAnswer,
  fetchCalculation,
  fetchCode,
  fetchYouTubeVideoPerplexity,
  fetchTutorialResources,
  analyzeImageWithVision,
  extractJson,
  matchProviderCommand,
} from './commandProcessor'
import { useOpenRouter } from '../../context/OpenRouterContext'
import { formatOllamaModelName } from '../../config/ollama'
import {
  buildContextString,
  buildFullProjectContext,
  buildDataDocSections,
} from './contextAggregator'
import { jarvisPhrase, JARVIS_VOICE_SYSTEM_PROMPT, enforceResponseLength, maybeAddInsult } from './voice/jarvisPhrases'
import {
  cancelKokoroSpeech,
  DEFAULT_KOKORO_VOICE,
  KOKORO_MALE_VOICES,
  speakWithKokoro,
} from './voice/kokoroTts'
import type {
  WakeState,
  LogEntry,
  JarvisSettings,
} from './types'
import { DEFAULT_SETTINGS, BG_COLORS } from './types'
import { useJarvisSession } from './hooks/useJarvisSession'
import { useJarvisCanvas } from './hooks/useJarvisCanvas'
import { useJarvisVision } from './hooks/useJarvisVision'
import { v4 as uuid } from 'uuid'

// ────────── Wake word sets ──────────
const SLEEP_COMMANDS = ['go to sleep', 'goodbye', 'stop listening', 'sleep', 'bye jarvis']
const STOP_SPEECH_RE = /^(jarvis[,\s]+)?(stop|stop talking|stop speaking|shut up|shut it|be quiet|quiet|silence|enough|that'?s enough|cancel|nevermind|never mind)\s*[.!?]*\s*$/i

// Jarvis wires together many untyped external/dynamic surfaces — browser
// speech APIs, AI JSON responses parsed at runtime, canvas item payloads,
// and the window.jarvis debug bridge. One localized disable instead of
// suppressing every call site individually across this large module.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JarvisAny = any

function containsSleepCommand(t: string) {
  const lower = t.toLowerCase().trim()
  return SLEEP_COMMANDS.some((w) => lower.includes(w))
}

// ────────── Camera command patterns ──────────
const CAMERA_START = /\b(turn on|open|activate|start)\s+(the\s+)?camera\b/i
const CAMERA_STOP = /\b(turn off|close|stop|deactivate)\s+(the\s+)?camera\b/i
const CAMERA_CAPTURE = /\b(take|snap|capture)\s+(a\s+)?(photo|picture|snapshot)\b/i
const CAMERA_ANALYZE = /\b(analyze|analyse)\s+(this|the\s+photo)\b|\bwhat\s+(is|am|are)\s+(this|i\s+looking\s+at)\b/i
const CAMERA_CAPTURE_ANALYZE = /take\s+(a\s+)?(photo|picture).*(analyze|analyse|what|identify)/i
const CAMERA_COMPONENT = /what\s+component\s+is\s+this/i
const CAMERA_READ_TEXT = /(read|what does)\s+(the\s+)?text\b|what does this say/i
const CAMERA_CHECK_CIRCUIT = /\b(check|review)\s+(my\s+)?(circuit|schematic|board|pcb)\b/i
const CAMERA_MEASURE = /\b(measure|how big)\s+(this|is this)\b/i
// New camera patterns for live vision
const CAMERA_WHAT_DO_YOU_SEE = /\b(what do you see|what can you see|describe (this|what you see)|look at this|see this|can you see (this|me)|look here|what('s| is) (in )?frame)\b/i
const CAMERA_DOES_THIS_LOOK_RIGHT = /\b(does this look right|is this correct|check this|review this|validate this)\b/i
const CAMERA_CONTINUOUS_START = /\b(watch (this|continuously?)|keep watching|continuous (mode|analysis)|start watching)\b/i
const CAMERA_CONTINUOUS_STOP = /\b(stop watching|end (continuous|watching)|stop continuous)\b/i

// ────────── Data-doc command patterns ──────────
const CMD_SUMMARIZE = /\b(summarize|summary of)\s+(my\s+)?project\b/i
const CMD_OPEN_PROBLEMS = /\b(what are|show me|list)\s+(my\s+)?(open\s+)?problems\b/i
const CMD_SUPPLY_CHAIN = /\b(check|show|status)\s+(my\s+)?supply\s+chain\b/i
const CMD_RECENT_FILES = /\b(what files|recent files|files I('ve)? been working on)\b/i
const CMD_PROJECT_STATUS = /\b(project status|status report|give me a\s+.*status)\b/i
const CMD_PARAMETERS = /\b(document|snapshot|show)\s+(my\s+)?(current\s+)?parameters\b/i
const CMD_SEARCH = /\b(search\s+(for|my|across)|find)\s+(.+)\b/i
const CMD_SESSION_DIFF = /\b(what changed|session diff|show changes|what('s| has) changed (since|in)\s*(last|my)?\s*(session|visit)?)\b/i

// ────────── TTS ──────────
let voicesCache: SpeechSynthesisVoice[] = []
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    voicesCache = window.speechSynthesis.getVoices()
  }
  voicesCache = window.speechSynthesis.getVoices()
}

const FEMALE_VOICE_NAMES = [
  'samantha', 'victoria', 'karen', 'moira', 'fiona',
  'veena', 'allison', 'ava', 'susan', 'zoe', 'kate',
  'serena', 'tessa', 'google uk english female',
  'microsoft zira', 'microsoft hazel',
]

function selectJarvisVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const VOICE_PRIORITY: [string, string | null][] = [
    // Best for dry British delivery
    ['Daniel', 'en-GB'],
    ['Arthur', 'en-GB'],
    ['Oliver', 'en-GB'],
    ['Google UK English Male', 'en'],
    ['Microsoft George', 'en'],
    ['Microsoft Ryan', 'en'],
    // American fallbacks
    ['Alex', 'en'],
    ['Fred', 'en'],
    ['Microsoft David', 'en'],
    ['en-GB', 'en-GB'],
    ['Microsoft Mark', 'en'],
    ['Daniel', null],
    ['James', null],
    ['Tom', null],
    ['David', null],
    ['Mark', null],
  ]

  for (const [nameContains, langContains] of VOICE_PRIORITY) {
    const match = voices.find((v) => {
      const nameMatch = v.name.toLowerCase().includes(nameContains.toLowerCase())
      const langMatch = langContains ? v.lang.toLowerCase().includes(langContains.toLowerCase()) : true
      return nameMatch && langMatch
    })
    if (match) return match
  }

  return (
    voices.find(
      (v) =>
        !FEMALE_VOICE_NAMES.some((n) => v.name.toLowerCase().includes(n)) &&
        v.lang.startsWith('en')
    ) || null
  )
}

function preprocessForSpeech(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\bkHz\b/g, 'kilohertz')
    .replace(/\bMHz\b/g, 'megahertz')
    .replace(/\bGHz\b/g, 'gigahertz')
    .replace(/\bkΩ\b/gi, 'kilohms')
    .replace(/\bMΩ\b/gi, 'megohms')
    .replace(/\bμF\b/gi, 'microfarads')
    .replace(/\bnF\b/g, 'nanofarads')
    .replace(/\bpF\b/g, 'picofarads')
    .replace(/\buH\b/gi, 'microhenries')
    .replace(/\bmH\b/g, 'millihenries')
    .replace(/\bVpp\b/g, 'volts peak to peak')
    .replace(/\bVrms\b/g, 'volts RMS')
    .replace(/\bVDC\b/g, 'volts DC')
    .replace(/\bVAC\b/g, 'volts AC')
    .replace(/\bmA\b/g, 'milliamps')
    .replace(/\buA\b/gi, 'microamps')
    .replace(/\bkW\b/g, 'kilowatts')
    .replace(/\bdB\b/g, 'decibels')
    .replace(/\bPCB\b/g, 'P.C.B.')
    .replace(/\bI2C\b/gi, 'I squared C')
    .replace(/\bSPI\b/g, 'S.P.I.')
    .replace(/\bUART\b/g, 'U.A.R.T.')
    .replace(/\bPWM\b/g, 'P.W.M.')
    .replace(/\bADC\b/g, 'A.D.C.')
    .replace(/\bDAC\b/g, 'D.A.C.')
    .replace(/\bGPIO\b/g, 'G.P.I.O.')
    .replace(/\bMCU\b/g, 'M.C.U.')
    .replace(/\bFPGA\b/g, 'F.P.G.A.')
    .replace(/\bESP32\b/g, 'E.S.P. thirty two')
    .replace(/\bSTM32\b/g, 'S.T.M. thirty two')
    .replace(/\bRPi\b/g, 'Raspberry Pi')
    .replace(/(\d+)V\b/g, '$1 volts')
    .replace(/(\d+)A\b/g, '$1 amps')
    .replace(/(\d+)W\b/g, '$1 watts')
    .replace(/(\d+)Ω\b/g, '$1 ohms')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Short, distinct responses get bespoke delivery
const SHORT_RESPONSES: Record<string, { rate: number; pitch: number }> = {
  'Yes.': { rate: 0.80, pitch: 0.80 },
  'No.': { rate: 0.78, pitch: 0.78 },
  'Right.': { rate: 0.82, pitch: 0.82 },
  'Fine.': { rate: 0.80, pitch: 0.80 },
  'Noted.': { rate: 0.82, pitch: 0.82 },
  'I know.': { rate: 0.80, pitch: 0.80 },
  'Go ahead.': { rate: 0.85, pitch: 0.83 },
  'Still here.': { rate: 0.85, pitch: 0.83 },
  'What.': { rate: 0.78, pitch: 0.80 },
  'On it.': { rate: 0.88, pitch: 0.85 },
}

const JOKE_INDICATORS = [
  'unfortunately', 'interesting choice', 'bold', 'admire',
  'certainly an approach', 'probably', 'not often', 'you rang',
  'what have you done', 'we have covered this',
]

export type JarvisIntent =
  | 'general' | 'calculation' | 'greeting' | 'acknowledgement'
  | 'error' | 'research' | 'question' | 'correction'

function getSpeechParameters(
  text: string,
  intent: JarvisIntent,
  settings: JarvisSettings
): { rate: number; pitch: number; volume: number } {
  const style = settings.deliveryStyle || 'measured'
  let rate: number
  let pitch: number
  if (style === 'deadpan') { rate = 0.88; pitch = 0.82 }
  else if (style === 'crisp') { rate = 0.98; pitch = 0.87 }
  else { rate = settings.speechRate || 0.92; pitch = settings.speechPitch ?? 0.85 }

  if (intent === 'calculation') { rate -= 0.07; pitch -= 0.03 }
  else if (intent === 'greeting' || intent === 'acknowledgement') { rate += 0.03; pitch += 0.02 }
  else if (intent === 'error') { rate -= 0.04; pitch -= 0.05 }
  else if (intent === 'research' || intent === 'question') { rate -= 0.02; pitch -= 0.01 }

  const lower = text.toLowerCase()
  const isJoke = JOKE_INDICATORS.some((j) => lower.includes(j))
  if (isJoke) { rate = Math.min(rate, 0.88); pitch = Math.min(pitch, 0.82) }

  const wordCount = text.trim().split(/\s+/).length
  if (wordCount <= 5) { rate = Math.min(rate, 0.88); pitch = Math.min(pitch, 0.83) }

  rate = Math.max(0.5, Math.min(1.5, rate))
  pitch = Math.max(0.5, Math.min(1.5, pitch))
  return { rate, pitch, volume: 0.95 }
}

function addSpeechRhythm(text: string, intensity: 'minimal' | 'natural' | 'dramatic' = 'natural'): string {
  if (intensity === 'minimal') return text
  let out = text
    .replace(/^(Yes|No|Right|Fine|Noted)\. /g, '$1. ... ')
    .replace(/ However,/g, ' ... However,')
    .replace(/ But /g, ' ... But ')
    .replace(/ Although /g, ' ... Although ')
    .replace(/, then /gi, ', ... then ')
    .replace(/; /g, '; ... ')
    .replace(/ comes to /gi, ' ... comes to ')
    .replace(/ is approximately /gi, ' is approximately ... ')
    .replace(/unfortunately/gi, '... unfortunately')
    .replace(/^Actually,? /i, 'Actually. ... ')
  if (intensity === 'dramatic') {
    out = out.replace(/([^.!?]{5,30}[.!?]) ([A-Z])/g, (match, s1: string, s2: string) => {
      const wc = s1.split(/\s+/).length
      return wc <= 6 ? `${s1} ... ${s2}` : match
    })
  }
  return out
}

function chunkForSpeech(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  if (sentences.length <= 2) return [text]
  const chunks: string[] = []
  let current: string[] = []
  let wc = 0
  for (const s of sentences) {
    current.push(s)
    wc += s.split(/\s+/).length
    if (wc >= 15 || current.length >= 2) {
      chunks.push(current.join(' ').trim())
      current = []
      wc = 0
    }
  }
  if (current.length) chunks.push(current.join(' ').trim())
  return chunks
}

function buildUtterance(
  rawSegment: string,
  settings: JarvisSettings,
  intent: JarvisIntent,
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisUtterance {
  const processedBase = preprocessForSpeech(rawSegment)
  const rhythmed = addSpeechRhythm(processedBase, settings.pauseIntensity || 'natural')
  const utt = new SpeechSynthesisUtterance(rhythmed)
  const preferred = settings.selectedVoice
    ? voices.find((v) => v.name === settings.selectedVoice)
    : selectJarvisVoice(voices)
  if (preferred) utt.voice = preferred
  const trimmed = processedBase.trim()
  const short = SHORT_RESPONSES[trimmed]
  if (short) {
    utt.rate = short.rate
    utt.pitch = short.pitch
  } else {
    const params = getSpeechParameters(processedBase, intent, settings)
    utt.rate = params.rate
    utt.pitch = params.pitch
  }
  utt.volume = 0.95
  return utt
}

function speakText(
  text: string,
  settings: JarvisSettings,
  onStart?: () => void,
  onEnd?: () => void,
  intent: JarvisIntent = 'general'
) {
  if (!text || typeof window === 'undefined') return
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  cancelKokoroSpeech()
  const voices = 'speechSynthesis' in window
    ? (voicesCache.length > 0 ? voicesCache : window.speechSynthesis.getVoices())
    : []
  const lower = text.toLowerCase()
  const isJoke = JOKE_INDICATORS.some((j) => lower.includes(j))
  const openingDelay = isJoke ? 400 : intent === 'correction' ? 300 : 0
  const segments = chunkForSpeech(text)

  const speakWithBrowserVoice = () => {
    if (!('speechSynthesis' in window)) {
      onEnd?.()
      return
    }
    let started = false
    let i = 0
    const speakNext = () => {
      if (i >= segments.length) { onEnd?.(); return }
      const utt = buildUtterance(segments[i], settings, intent, voices)
      utt.onstart = () => { if (!started) { started = true; onStart?.() } }
      utt.onend = () => {
        i++
        if (i < segments.length) setTimeout(speakNext, 150)
        else onEnd?.()
      }
      utt.onerror = () => {
        i++
        if (i < segments.length) setTimeout(speakNext, 150)
        else onEnd?.()
      }
      window.speechSynthesis.speak(utt)
    }
    if (openingDelay > 0) setTimeout(speakNext, openingDelay)
    else speakNext()
  }

  if ((settings.ttsEngine ?? 'kokoro') === 'kokoro') {
    void (async () => {
      if (openingDelay > 0) await new Promise((resolve) => setTimeout(resolve, openingDelay))
      let started = false
      try {
        for (let i = 0; i < segments.length; i++) {
          const processedBase = preprocessForSpeech(segments[i])
          const rhythmed = addSpeechRhythm(processedBase, settings.pauseIntensity || 'natural')
          const short = SHORT_RESPONSES[processedBase.trim()]
          const params = short ?? getSpeechParameters(processedBase, intent, settings)
          await speakWithKokoro(rhythmed, {
            voice: settings.kokoroVoice ?? DEFAULT_KOKORO_VOICE,
            speed: params.rate,
            onStart: () => {
              if (!started) {
                started = true
                onStart?.()
              }
            },
          })
          if (i < segments.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 80))
          }
        }
        onEnd?.()
      } catch (error) {
        console.warn('Kokoro TTS failed; falling back to browser speech:', error)
        if (started) onEnd?.()
        else speakWithBrowserVoice()
      }
    })()
    return
  }

  speakWithBrowserVoice()
}

// ────────── Persistence ──────────
const STORAGE_LOG = 'enginguity_jarvis_log'
const STORAGE_SETTINGS = 'enginguity_jarvis_settings'

function loadLog(): LogEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_LOG) || '[]') } catch { return [] }
}
function loadSettings(): JarvisSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_SETTINGS) || '{}')
    const next = { ...DEFAULT_SETTINGS, ...saved }
    if ((saved.kokoroVoice ?? '') === 'bm_george') {
      next.kokoroVoice = DEFAULT_KOKORO_VOICE
    }
    return next
  } catch { return DEFAULT_SETTINGS }
}

// ────────── html2canvas loader ──────────
async function loadHtml2Canvas(): Promise<((el: HTMLElement, opts?: object) => Promise<HTMLCanvasElement>) | null> {
  const w = window as JarvisAny
  if (w.html2canvas) return w.html2canvas
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
    script.onload = () => resolve(w.html2canvas || null)
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
}

// ────────── Browser support check ──────────
function checkBrowserSupport(): { supported: boolean; message?: string } {
  const hasSR = !!(
    (window as JarvisAny).SpeechRecognition || (window as JarvisAny).webkitSpeechRecognition
  )
  const hasGUM = !!(navigator.mediaDevices?.getUserMedia)
  const isChromium = /Chrome|Chromium|Edg/.test(navigator.userAgent)
  ;(window as JarvisAny).jarvisDiag?.(
    `Browser: SR=${hasSR} GUM=${hasGUM} Chromium=${isChromium}`,
    hasSR ? 'success' : 'error'
  )
  if (!hasSR) {
    return {
      supported: false,
      message:
        'Jarvis requires Chrome or Edge for voice recognition. Firefox and Safari do not support continuous speech recognition. You can still use typed commands below.',
    }
  }
  return { supported: true }
}

// ────────── Voice diagnostic overlay (collapsible) ──────────
function VoiceDiagnostic() {
  const [expanded, setExpanded] = useState(false)
  const [log, setLog] = useState<
    Array<{ msg: string; type: string; time: string }>
  >([])
  const [unreadCount, setUnreadCount] = useState(0)
  const expandedRef = useRef(expanded)
  useEffect(() => {
    expandedRef.current = expanded
  }, [expanded])

  useEffect(() => {
    ;(window as JarvisAny).jarvisDiag = (msg: string, type = 'info') => {
      setLog((prev) =>
        [
          ...prev,
          {
            msg,
            type,
            time: new Date().toLocaleTimeString('en-US', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          },
        ].slice(-30)
      )
      if (!expandedRef.current) setUnreadCount((n) => n + 1)
    }
    return () => {
      ;(window as JarvisAny).jarvisDiag = undefined
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing unread badge when the panel opens, a direct UI reaction to the expanded toggle
    if (expanded) setUnreadCount(0)
  }, [expanded])

  if (!expanded) {
    const last = log[log.length - 1]
    const dotColor =
      last?.type === 'error'
        ? '#ff6b6b'
        : last?.type === 'success'
        ? '#00e676'
        : last?.type === 'warn'
        ? '#ffab40'
        : '#94a5ba'
    return (
      <div
        onClick={() => setExpanded(true)}
        style={{
          position: 'fixed',
          top: 12,
          left: 12,
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid #333',
          borderRadius: 20,
          padding: '4px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          zIndex: 9999,
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          userSelect: 'none',
        }}
      >
        <div
          style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }}
        />
        <span
          style={{
            fontSize: 10,
            color: '#94a5ba',
            fontFamily: 'monospace',
          }}
        >
          diag
        </span>
        {unreadCount > 0 && (
          <span
            style={{
              fontSize: 9,
              background: '#94a5ba',
              color: '#000',
              borderRadius: 10,
              padding: '0 5px',
              fontFamily: 'monospace',
            }}
          >
            {unreadCount}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        width: 340,
        maxHeight: 380,
        background: 'rgba(8,8,16,0.95)',
        border: '1px solid #2a2a45',
        borderRadius: 10,
        zIndex: 9999,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid #1f1f35',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: '#94a5ba',
            fontFamily: 'monospace',
            flex: 1,
          }}
        >
          JARVIS DIAGNOSTIC
        </span>
        <button
          onClick={() => setLog([])}
          style={{
            background: 'none',
            border: 'none',
            color: '#4a5568',
            fontSize: 10,
            cursor: 'pointer',
            marginRight: 8,
            fontFamily: 'monospace',
          }}
        >
          clear
        </button>
        <button
          onClick={() => setExpanded(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b6d85',
            fontSize: 16,
            cursor: 'pointer',
            lineHeight: 1,
            padding: '0 2px',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ overflowY: 'auto', padding: '8px 12px', flex: 1 }}>
        {log.length === 0 && (
          <div
            style={{
              color: '#3a3c55',
              fontSize: 11,
              fontFamily: 'monospace',
              textAlign: 'center',
              marginTop: 20,
            }}
          >
            no logs yet
          </div>
        )}
        {log.map((entry, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 3,
              fontFamily: 'monospace',
              fontSize: 10,
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: '#3a3c55', flexShrink: 0 }}>{entry.time}</span>
            <span
              style={{
                color:
                  entry.type === 'error'
                    ? '#ff6b6b'
                    : entry.type === 'success'
                    ? '#00e676'
                    : entry.type === 'warn'
                    ? '#ffab40'
                    : '#8896a8',
                wordBreak: 'break-word',
              }}
            >
              {entry.msg}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ────────── Settings popover ──────────
function SettingsPopover({
  settings,
  onChange,
  onClose,
  permissionState,
  voices,
}: {
  settings: JarvisSettings
  onChange: (s: JarvisSettings) => void
  onClose: () => void
  permissionState: string
  voices: SpeechSynthesisVoice[]
}) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 44,
        right: 0,
        width: 280,
        background: 'var(--surface)',
        border: '1px solid var(--border-bright)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        padding: 16,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        fontFamily: "'DM Sans Variable', 'DM Sans', sans-serif",
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Jarvis Settings</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 2 }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Wake sensitivity */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Wake word sensitivity</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['low', 'normal', 'high'] as const).map((s) => (
            <button
              key={s}
              onClick={() => onChange({ ...settings, wakeSensitivity: s })}
              style={{
                flex: 1,
                padding: '4px 0',
                fontSize: 11,
                borderRadius: 4,
                cursor: 'pointer',
                background: settings.wakeSensitivity === s ? 'var(--accent-glow)' : 'transparent',
                border: `1px solid ${settings.wakeSensitivity === s ? 'var(--accent)' : 'var(--border)'}`,
                color: settings.wakeSensitivity === s ? 'var(--accent)' : 'var(--text-muted)',
                textTransform: 'capitalize',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Voice engine */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Voice engine</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { id: 'kokoro', label: 'Kokoro' },
            { id: 'browser', label: 'System' },
          ].map((engine) => (
            <button
              key={engine.id}
              onClick={() => onChange({ ...settings, ttsEngine: engine.id as JarvisSettings['ttsEngine'] })}
              style={{
                flex: 1,
                padding: '4px 0',
                fontSize: 11,
                borderRadius: 4,
                cursor: 'pointer',
                background: (settings.ttsEngine ?? 'kokoro') === engine.id ? 'var(--accent-glow)' : 'transparent',
                border: `1px solid ${(settings.ttsEngine ?? 'kokoro') === engine.id ? 'var(--accent)' : 'var(--border)'}`,
                color: (settings.ttsEngine ?? 'kokoro') === engine.id ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {engine.label}
            </button>
          ))}
        </div>
      </div>

      {/* Voice */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Voice</div>
        {(settings.ttsEngine ?? 'kokoro') === 'kokoro' ? (
          <select
            value={settings.kokoroVoice ?? DEFAULT_KOKORO_VOICE}
            onChange={(e) => onChange({ ...settings, kokoroVoice: e.target.value as JarvisSettings['kokoroVoice'] })}
            style={{
              width: '100%',
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 12,
              color: 'var(--text)',
              outline: 'none',
            }}
          >
            {KOKORO_MALE_VOICES.map((voice) => (
              <option key={voice.id} value={voice.id}>{voice.label} ({voice.accent} male)</option>
            ))}
          </select>
        ) : (
          <>
            <select
              value={settings.selectedVoice}
              onChange={(e) => onChange({ ...settings, selectedVoice: e.target.value })}
              style={{
                width: '100%',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 12,
                color: 'var(--text)',
                outline: 'none',
              }}
            >
              <option value="">Auto (best available)</option>
              {voices
                .filter((v) => !FEMALE_VOICE_NAMES.some((n) => v.name.toLowerCase().includes(n)))
                .map((v) => (
                  <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                ))}
            </select>
            {!voices.some((v) => v.name.includes('Daniel')) && (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.5 }}>
                {'For the best JARVIS voice on Mac: System Settings > Accessibility > Spoken Content > System Voice > Manage Voices > English > Daniel'}
              </div>
            )}
          </>
        )}
      </div>

      {/* Speech rate */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
          <span>Speaking rate</span>
          <span style={{ fontFamily: 'monospace' }}>{settings.speechRate.toFixed(2)}×</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="1.5"
          step="0.05"
          value={settings.speechRate}
          onChange={(e) => onChange({ ...settings, speechRate: parseFloat(e.target.value) })}
          style={{ width: '100%', accentColor: '#94a5ba' }}
        />
      </div>

      {/* Pitch */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
          <span>Pitch</span>
          <span style={{ fontFamily: 'monospace' }}>{(settings.speechPitch ?? 0.85).toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="1.5"
          step="0.05"
          value={settings.speechPitch ?? 0.85}
          onChange={(e) => onChange({ ...settings, speechPitch: parseFloat(e.target.value) })}
          style={{ width: '100%', accentColor: '#94a5ba' }}
        />
      </div>

      {/* Presets */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Presets</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { label: 'JARVIS', rate: 0.92, pitch: 0.85 },
            { label: 'Deeper', rate: 0.88, pitch: 0.70 },
            { label: 'Crisp', rate: 1.00, pitch: 0.90 },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => onChange({ ...settings, speechRate: preset.rate, speechPitch: preset.pitch })}
              style={{
                flex: 1,
                padding: '4px 0',
                fontSize: 10,
                borderRadius: 4,
                cursor: 'pointer',
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                fontFamily: 'monospace',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Delivery style */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Delivery style</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['deadpan', 'measured', 'crisp'] as const).map((s) => (
            <button
              key={s}
              onClick={() => onChange({ ...settings, deliveryStyle: s })}
              style={{
                flex: 1,
                padding: '4px 0',
                fontSize: 11,
                borderRadius: 4,
                cursor: 'pointer',
                background: (settings.deliveryStyle ?? 'measured') === s ? 'var(--accent-glow)' : 'transparent',
                border: `1px solid ${(settings.deliveryStyle ?? 'measured') === s ? 'var(--accent)' : 'var(--border)'}`,
                color: (settings.deliveryStyle ?? 'measured') === s ? 'var(--accent)' : 'var(--text-muted)',
                textTransform: 'capitalize',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Pause intensity */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Pause intensity</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['minimal', 'natural', 'dramatic'] as const).map((s) => (
            <button
              key={s}
              onClick={() => onChange({ ...settings, pauseIntensity: s })}
              style={{
                flex: 1,
                padding: '4px 0',
                fontSize: 11,
                borderRadius: 4,
                cursor: 'pointer',
                background: (settings.pauseIntensity ?? 'natural') === s ? 'var(--accent-glow)' : 'transparent',
                border: `1px solid ${(settings.pauseIntensity ?? 'natural') === s ? 'var(--accent)' : 'var(--border)'}`,
                color: (settings.pauseIntensity ?? 'natural') === s ? 'var(--accent)' : 'var(--text-muted)',
                textTransform: 'capitalize',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Test voice */}
      <button
        onClick={() => {
          window.speechSynthesis.cancel()
          speakText(
            "Online. What did you break? Actually — don't answer that. I can see the open problems from here. Three of them. Interesting.",
            settings
          )
        }}
        style={{
          width: '100%',
          background: 'transparent',
          border: '1px solid #94a5ba',
          color: '#94a5ba',
          borderRadius: 6,
          padding: '7px',
          cursor: 'pointer',
          fontSize: 11,
        }}
      >
        Test Voice
      </button>

      {/* Auto-sleep */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Auto-sleep timeout</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[30, 45, 60, 0].map((t) => (
            <button
              key={t}
              onClick={() => onChange({ ...settings, autoSleepTimeout: t })}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                borderRadius: 4,
                cursor: 'pointer',
                background: settings.autoSleepTimeout === t ? 'var(--accent-glow)' : 'transparent',
                border: `1px solid ${settings.autoSleepTimeout === t ? 'var(--accent)' : 'var(--border)'}`,
                color: settings.autoSleepTimeout === t ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {t === 0 ? 'Never' : `${t}s`}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas bg */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Canvas background</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['dark', 'darker', 'pure'] as const).map((b) => (
            <button
              key={b}
              onClick={() => onChange({ ...settings, canvasBackground: b })}
              style={{
                flex: 1,
                padding: '4px 0',
                fontSize: 11,
                borderRadius: 4,
                cursor: 'pointer',
                background: settings.canvasBackground === b ? 'var(--accent-glow)' : 'transparent',
                border: `1px solid ${settings.canvasBackground === b ? 'var(--accent)' : 'var(--border)'}`,
                color: settings.canvasBackground === b ? 'var(--accent)' : 'var(--text-muted)',
                textTransform: 'capitalize',
              }}
            >
              {b === 'pure' ? 'Black' : b}
            </button>
          ))}
        </div>
      </div>

      {/* Daily Limit */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>Daily budget limit ($)</div>
        <input
          type="number"
          min="0.10"
          step="0.10"
          value={settings.dailyLimit}
          onChange={(e) => {
            const val = parseFloat(e.target.value) || 2.00;
            onChange({ ...settings, dailyLimit: val });
          }}
          style={{
            width: '100%',
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 12,
            color: 'var(--text)',
            outline: 'none',
          }}
        />
      </div>

      {/* Permission */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
          Microphone permission
        </div>
        <div
          style={{
            fontSize: 12,
            color: permissionState === 'granted' ? '#7aaa8a' : '#b08080',
          }}
        >
          {permissionState === 'granted' ? '● Granted' : '● Denied or not requested'}
        </div>
        {permissionState !== 'granted' && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              marginTop: 4,
              lineHeight: 1.5,
            }}
          >
            Click the lock icon in your browser's address bar to grant microphone access.
          </div>
        )}
      </div>

      {/* Camera privacy note */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>Camera & Vision</div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Camera frames are processed by your active AI model via OpenRouter. Photos are converted to base64
          and sent as part of the API request. They are not stored on any ENGINGUITY server. Review your AI
          provider's privacy policy for how they handle image data.
        </div>
      </div>
    </div>
  )
}

// ────────── Main Module ──────────
function JarvisModuleInner() {
  const { makeRequest, isConnected, apiKey, activeModel } = useAIProvider()
  const { activeProvider, setActiveProvider, ollamaModelId } = useOpenRouter()
  const navigate = useNavigate()
  const { isFocusMode, toggleFocusMode } = useFocusMode()

  const [probeBotOpen, setProbeBotOpen] = useState(() => localStorage.getItem('enginguity_copilot_open') === 'true')
  const [wakeState, setWakeState] = useState<WakeState>('sleeping')
  const [log, setLog] = useState<LogEntry[]>(loadLog)
  const [isMuted, setIsMuted] = useState(false)
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [settings, setSettings] = useState<JarvisSettings>(loadSettings)
  const [waveformBars, setWaveformBars] = useState([4, 4, 4, 4, 4])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [showBrowserNotice, setShowBrowserNotice] = useState(false)
  const [browserNoticeText, setBrowserNoticeText] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [hasWoken, setHasWoken] = useState(false)
  const [typedCommand, setTypedCommand] = useState('')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [pendingClear, setPendingClear] = useState(false)
  const [immersiveOpen, setImmersiveOpen] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')

  // New states
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<{ type: string; data: JarvisAny } | null>(null)
  const [guidedMode, setGuidedMode] = useState<{ title: string; estimatedMinutes: number; steps: JarvisAny[]; currentStep: number; topic: string; completionMessage?: string } | null>(null)
  const [showMeasurementPanel, setShowMeasurementPanel] = useState(false)
  const [orderList, setOrderList] = useState<JarvisAny[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('enginguity_jarvis_order_list') || '[]')
    } catch {
      return []
    }
  })

  const audioCtxRef = useRef<AudioContext | null>(null)
  const clapNodeRef = useRef<ScriptProcessorNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const vizFrameRef = useRef<number | null>(null)
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeStateRef = useRef<WakeState>('sleeping')
  const settingsRef = useRef(settings)
  const isMutedRef = useRef(isMuted)
  const logStripRef = useRef<HTMLDivElement>(null)
  const canvasWorldRef = useRef<HTMLDivElement>(null)

  // Timer Ref
  const activeTimers = useRef<Array<{ timerId: string; timeout: ReturnType<typeof setTimeout>; interval: ReturnType<typeof setInterval>; itemId: string }>>([])

  useEffect(() => {
    wakeStateRef.current = wakeState
    settingsRef.current = settings
    isMutedRef.current = isMuted
  }, [wakeState, settings, isMuted])

  // Track probe bot sidebar open state to avoid overlapping Enter Jarvis button
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail && typeof e.detail.open === 'boolean') {
        setProbeBotOpen(e.detail.open)
      }
    }
    window.addEventListener('enginguity_copilot_open_changed', handler as EventListener)
    return () => window.removeEventListener('enginguity_copilot_open_changed', handler as EventListener)
  }, [])

  // Persist
  useEffect(() => { localStorage.setItem(STORAGE_LOG, JSON.stringify(log.slice(-100))) }, [log])
  useEffect(() => { localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings)) }, [settings])
  useEffect(() => {
    localStorage.setItem('enginguity_jarvis_awake', wakeState !== 'sleeping' ? 'true' : 'false')
  }, [wakeState])

  // Clear timers on unmount
  useEffect(() => {
    const timers = activeTimers.current
    return () => {
      timers.forEach((t) => {
        clearTimeout(t.timeout)
        clearInterval(t.interval)
      })
    }
  }, [])

  // Auto-scroll log
  useEffect(() => {
    if (logStripRef.current) {
      logStripRef.current.scrollTop = logStripRef.current.scrollHeight
    }
  }, [log])

  // Load voices
  useEffect(() => {
    const update = () => setVoices(window.speechSynthesis.getVoices())
    update()
    window.speechSynthesis.onvoiceschanged = update
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  // Camera active ref kept in sync
  // (stream + video element managed by cameraEngine singleton)

  // ── Speak ──
  const speak = useCallback((text: string, intent: JarvisIntent = 'general') => {
    if (isMutedRef.current) return
    speakText(
      text,
      settingsRef.current,
      () => { setIsSpeaking(true); pauseVoiceForTTS() },
      () => { setIsSpeaking(false); resumeVoiceAfterTTS() },
      intent
    )
  }, [])

  // Speak AI session briefing when ready.
  // Placed after `speak`'s declaration (used inside) to avoid a
  // temporal-dead-zone access-before-declared reference.
  useEffect(() => {
    const handle = (e: CustomEvent) => {
      if (e.detail?.briefing) speak(e.detail.briefing)
    }
    window.addEventListener('enginguity_session_briefing_ready', handle as EventListener)
    return () => window.removeEventListener('enginguity_session_briefing_ready', handle as EventListener)
  }, [speak])

  const {
    sessionStartTime,
    sessionCommands,
    setSessionCommands,
    runningCost,
    isPaused,
    trackUsage,
  } = useJarvisSession({ dailyLimit: settings.dailyLimit, speak })

  // ── Log ──
  const addLog = useCallback((role: LogEntry['role'], text: string) => {
    setLog((prev) => [...prev, { id: uuid(), role, text, timestamp: Date.now() }])
  }, [])

  const {
    items,
    setItems,
    itemsRef,
    groups,
    setGroups,
    transform,
    setTransform,
    placeItem,
    updateCanvasItem,
    startSession,
    flashCanvasItem,
    centerOnItem,
    handleItemMove,
    handleItemResize,
    handleUndo,
    clearCanvas,
  } = useJarvisCanvas({ speak, addLog })

  // ── Sleep ──
  function stopVisualizer() {
    if (vizFrameRef.current) {
      cancelAnimationFrame(vizFrameRef.current)
      vizFrameRef.current = null
    }
    setWaveformBars([4, 4, 4, 4, 4])
  }

  const goToSleep = useCallback(() => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current)
    setWakeState('sleeping')
    addLog('system', '— Went to sleep')
    stopVisualizer()
    engineSleep()  // sync engine — engine checks _isAwake so no circular fire
  }, [addLog])

  const resetSleepTimer = useCallback(() => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current)
    const timeout = settingsRef.current.autoSleepTimeout
    if (timeout > 0) {
      sleepTimerRef.current = setTimeout(() => {
        speak(jarvisPhrase('sleep'))
        goToSleep()
      }, timeout * 1000)
    }
  }, [goToSleep, speak])

  function startVisualizer() {
    if (!analyserRef.current) return
    const analyser = analyserRef.current
    const data = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      if (wakeStateRef.current !== 'listening') return
      analyser.getByteFrequencyData(data)
      setWaveformBars([0, 1, 2, 3, 4].map((i) => 4 + (data[i] / 255) * 16))
      vizFrameRef.current = requestAnimationFrame(tick)
    }
    vizFrameRef.current = requestAnimationFrame(tick)
  }

  const wakeUp = useCallback(() => {
    setWakeState('listening')
    addLog('system', '— Woke up')
    resetSleepTimer()
    startVisualizer()
    const phrase = !hasWoken ? jarvisPhrase('sessionStart') : jarvisPhrase('wakeUp')
    if (!hasWoken) setHasWoken(true)
    setTimeout(() => speak(phrase), 150)
  }, [addLog, resetSleepTimer, hasWoken, speak])

  useEffect(() => {
    // @ts-expect-error - untyped external API
    window.jarvis = {
      wakeState,
      wakeUp,
    };
    return () => {
      // @ts-expect-error - untyped external API
      delete window.jarvis;
    };
  }, [wakeState, wakeUp]);

  useEffect(() => {
    const handleWake = () => wakeUp();
    window.addEventListener('enginguity_wake_jarvis', handleWake);
    return () => window.removeEventListener('enginguity_wake_jarvis', handleWake);
  }, [wakeUp]);

  const buildJarvisContext = useCallback(() => {
    try {
      const ctx = buildFullProjectContext()
      const notebook = JSON.parse(localStorage.getItem('enginguity_notebook') || '[]')
      const openProblems = notebook
        .filter((e: JarvisAny) => e?.type === 'PROBLEM' && e?.status !== 'solved')
        .map((e: JarvisAny) => e.title)
        .filter(Boolean)
      const sessionDuration = Math.round((Date.now() - sessionStartTime) / 60000)
      return `
ENGINEER CONTEXT (use this to be a symbiote):
Project: ${ctx?.project?.description || 'not specified'}
Components: ${ctx?.project?.tags?.join(', ') || 'unknown'}
Open problems: ${openProblems.join(', ') || 'none currently'}
Active model: ${activeModel || 'unknown'}
Session duration: ${sessionDuration} minutes
Canvas items: ${items.length} items placed today

Use this context to make responses feel personal. Reference the project when relevant. Note if they keep asking about the same thing. Connect current questions to open problems when relevant. Don't announce that you have this context — just use it.
`
    } catch {
      return ''
    }
  }, [sessionStartTime, activeModel, items.length])

  const makeJarvisRequest = useCallback(async (messages: JarvisAny[], systemPrompt?: string, options?: JarvisAny) => {
    if (isPaused) {
      speak("Budget's gone for today. I'm paused.")
      throw new Error("Jarvis budget limit reached.")
    }
    const basePrompt = systemPrompt ?? JARVIS_VOICE_SYSTEM_PROMPT
    const prompt = basePrompt + '\n\n' + buildJarvisContext()
    const response = await makeRequest(messages, prompt, options)
    const promptText = prompt + JSON.stringify(messages)
    trackUsage(activeModel || '', promptText, response)
    return response
  }, [makeRequest, activeModel, isPaused, trackUsage, speak, buildJarvisContext])

  const {
    cameraActive,
    cameraVideoRef,
    startCamera,
    stopCamera,
    capturePhoto,
    analyzePhoto,
    handleAnalyzePhotoById,
    handleWhatDoYouSee,
    handleContinuousMode,
    stopContinuousMode,
  } = useJarvisVision({
    speak,
    addLog,
    placeItem,
    updateCanvasItem,
    setItems,
    itemsRef,
    apiKey,
    activeModel,
    trackUsage,
  })

  // ── Data doc ──
  const createDataDoc = useCallback(
    (
      docType: Parameters<typeof buildDataDocSections>[0],
      title: string,
      spokenText: string
    ) => {
      const sections = buildDataDocSections(docType)
      const ctx = buildFullProjectContext()
      placeItem({
        type: 'data_doc',
        title,
        content: {
          source: 'ENGINGUITY',
          generatedAt: Date.now(),
          sections,
          projectContext: ctx,
        },
      })
      speak(spokenText)
      addLog('jarvis', `⟡ Created ${title}`)
    },
    [placeItem, speak, addLog]
  )

  // ── Export canvas ──
  const exportCanvas = useCallback(async () => {
    speak('Capturing the canvas. One moment, sir.')
    const h2c = await loadHtml2Canvas()
    if (!h2c || !canvasWorldRef.current) {
      speak('Export failed.')
      return
    }
    try {
      const canvas = await h2c(canvasWorldRef.current, {
        backgroundColor: '#111111',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
      })
      const link = document.createElement('a')
      link.download = `jarvis-canvas-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      speak('Canvas exported, sir.')
      addLog('system', '— Canvas exported')
    } catch {
      speak('Export failed.')
    }
  }, [speak, addLog])

  // ── Local helpers for module integrations ──
  const addNotebookEntry = useCallback((entry: JarvisAny) => {
    const existing = JSON.parse(localStorage.getItem('enginguity_notebook') || '[]')
    const newEntry = {
      id: entry.id || `nb-jarvis-${Date.now()}`,
      type: entry.type || 'NOTE',
      title: entry.title || 'Voice Log Entry',
      tags: entry.tags || ['jarvis_voice'],
      date: entry.date || new Date().toISOString(),
      linkedModule: 'Jarvis',
      notes: entry.content || entry.notes || '',
      ...entry
    }
    localStorage.setItem('enginguity_notebook', JSON.stringify([newEntry, ...existing]))
    window.dispatchEvent(new Event('notebook-updated'))
  }, [])

  const addPartToBOM = useCallback((component: JarvisAny) => {
    const bomKey = 'enginguity_boms'
    const bom = JSON.parse(localStorage.getItem(bomKey) || '[]')
    const newItem = {
      id: `bom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      quantity: 1,
      part_number: component.partNumber || null,
      description: component.description || `${component.value || ''} component`,
      manufacturer: component.manufacturer || null,
      value: component.value || null,
      package: component.package || null,
      reference_designators: null,
      unitPrice: null,
      extendedPrice: null,
      stockStatus: 'unknown',
      leadTimeWeeks: null,
      altAvailable: null
    }
    const updated = [...bom, newItem]
    localStorage.setItem(bomKey, JSON.stringify(updated))
    localStorage.setItem('enginguity_bom_current', JSON.stringify(updated))
    moduleStateStore.publish('bom', { totalItems: updated.length })
    speak(`Added ${component.partNumber || component.value || 'component'} to your BOM.`)
  }, [speak])

  const playTimerSound = useCallback(() => {
    const AudioContextClass = window.AudioContext || (window as JarvisAny).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    
    osc.connect(gain)
    gain.connect(ctx.destination)
    
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1108, ctx.currentTime + 0.1)
    osc.frequency.setValueAtTime(1318, ctx.currentTime + 0.2)
    
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.8)
  }, [])

  // ── Feature Functions ──
  
  // Feature 1: Multimeter & Instrument Reading
  // Declared before readInstrument below (used inside) to avoid a
  // temporal-dead-zone access-before-declared reference.
  const logMeasurementToNotebook = useCallback((reading: JarvisAny, itemId?: string) => {
    const entry = {
      type: 'TEST_RESULT',
      title: `${reading.instrumentType} Reading`,
      measurements: [{
        param: reading.primaryReading.mode,
        value: String(reading.primaryReading.value),
        unit: reading.primaryReading.unit
      }],
      conditions: `Captured via Jarvis camera at ${new Date().toLocaleTimeString()}`,
      notes: reading.displayText || ''
    }

    addNotebookEntry(entry)
    speak("Logged to your notebook.")

    if (itemId) {
      setItems(prev => prev.map(it => {
        if (it.id === itemId) {
          return {
            ...it,
            content: { ...it.content, logged: true }
          }
        }
        return it
      }))
    }
  }, [speak, addNotebookEntry, setItems])

  const readInstrument = useCallback(async (additionalContext = '') => {
    const photo = capturePhoto()
    if (!photo) return null
    
    speak("Reading instrument display...")
    addLog('system', '— Reading display…')
    
    const prompt = `
      This is a photo of a measurement instrument display 
      (multimeter, oscilloscope, power supply, scale, 
      caliper, thermometer, or similar).
      
      1. Identify the instrument type
      2. Read the primary displayed value exactly as shown
         including the number, unit, and range/mode
      3. Read any secondary displays if visible
      4. Note the measurement mode (DC/AC/resistance/etc.)
      
      Return JSON:
      {
        "instrumentType": string,
        "primaryReading": { "value": number, "unit": string, "mode": string },
        "secondaryReadings": [{ "value": number, "unit": string, "label": string }],
        "displayText": string (exactly what the display shows),
        "confidence": "high" | "medium" | "low",
        "spoken": string (natural sentence to speak aloud)
      }
      
      ${additionalContext}
    `
    
    try {
      const response = await analyzeImageWithVision(photo.content.dataURL, prompt, apiKey)
      trackUsage('openai/gpt-4o', prompt, response)
      
      const reading = JSON.parse(extractJson(response))
      speak(reading.spoken)
      
      const item = placeItem({
        type: 'measurement',
        title: reading.instrumentType,
        content: {
          ...reading,
          capturedAt: Date.now(),
          photoId: photo.id,
          logged: false
        }
      })
      
      const lastCmd = sessionCommands[sessionCommands.length - 1] || ''
      if (lastCmd.includes('log') || lastCmd.includes('record')) {
        logMeasurementToNotebook(reading, item.id)
      } else {
        setTimeout(() => {
          speak("Want me to log that to your notebook?")
          setAwaitingConfirmation({
            type: 'log_measurement',
            data: { reading, itemId: item.id }
          })
        }, 2000)
      }
      return reading
    } catch (err) {
      speak("I had trouble reading the instrument display.")
      addLog('system', `— Instrument read error: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }, [apiKey, capturePhoto, placeItem, speak, addLog, trackUsage, sessionCommands, logMeasurementToNotebook])

  // Feature 2: Component ID
  const identifyComponent = useCallback(async () => {
    const photo = capturePhoto()
    if (!photo) return null
    
    speak("Identifying component...")
    addLog('system', '— Identifying component…')
    
    const prompt = `
      Identify the electronic component in this image.
      
      Look for:
      - Resistor color bands → decode the resistance value (if resistor, return color bands order as array of lowercase color names in "colorBands" property, e.g. ["brown", "black", "red", "gold"])
      - IC/chip markings → identify the part number
      - Capacitor markings → decode the value and voltage
      - Transistor markings → identify the part
      - Inductor markings → decode the value
      - Connector types → identify the standard
      - Any other component markings
      
      Return JSON:
      {
        "componentType": string,
        "partNumber": string | null,
        "value": string | null,
        "manufacturer": string | null,
        "package": string | null,
        "keySpecs": [string],
        "description": string,
        "commonUses": [string],
        "inBOM": null,
        "confidence": "high" | "medium" | "low",
        "spoken": string,
        "warning": string | null,
        "colorBands": [string] | null
      }
    `
    
    try {
      const response = await analyzeImageWithVision(photo.content.dataURL, prompt, apiKey)
      trackUsage('openai/gpt-4o', prompt, response)
      
      const component = JSON.parse(extractJson(response))
      
      const bom = JSON.parse(
        localStorage.getItem('enginguity_boms') || 
        localStorage.getItem('enginguity_bom_current') || 
        '[]'
      )
      const inBOM = bom.find((item: JarvisAny) => 
        (item.part_number && component.partNumber && item.part_number.toLowerCase() === component.partNumber.toLowerCase()) ||
        (item.description && component.value && item.description.toLowerCase().includes(component.value.toLowerCase()))
      )
      
      component.inBOM = !!inBOM
      component.bomItem = inBOM || null
      
      speak(component.spoken)
      if (component.inBOM) {
        speak("This is already in your BOM.")
      }
      if (component.warning) {
        speak(`Note: ${component.warning}`)
      }
      
      placeItem({
        type: 'component_id',
        title: component.partNumber || component.value || component.componentType,
        content: { ...component, photoId: photo.id }
      })
    } catch (err) {
      speak("I couldn't identify the component.")
      addLog('system', `— Component identification error: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }, [apiKey, capturePhoto, placeItem, speak, addLog, trackUsage])

  // Feature 3: Oscilloscope screenshot analysis
  const analyzeOscilloscope = useCallback(async () => {
    const photo = capturePhoto()
    if (!photo) return null
    
    speak("Analyzing waveform...")
    addLog('system', '— Analyzing scope display…')
    
    const projectCtx = buildFullProjectContext()
    
    const prompt = `
      This is a photo of an oscilloscope or logic analyzer display.
      
      Analyze the waveform(s) shown:
      1. Identify the waveform type (sine, square, PWM, digital, noise, etc.)
      2. Read the measurements from the screen:
         - Frequency / period
         - Amplitude (Vpp, Vmax, Vmin)
         - Duty cycle (if PWM/square)
         - Rise/fall time if visible
         - Any automatic measurements shown
      3. Read the timebase and voltage scale settings
      4. Assess signal quality:
         - Is there noise or ringing?
         - Does the signal look healthy?
         - Any concerning artifacts?
      5. Given project context: ${projectCtx.project?.description || 'No specific project description'}
         Does this waveform look correct for this application?
      
      Return JSON:
      {
        "waveformType": string,
        "measurements": {
          "frequency": string | null,
          "period": string | null,
          "amplitude": string | null,
          "dutyCycle": string | null,
          "riseTime": string | null,
          "dcOffset": string | null
        },
        "scale": {
          "timebase": string,
          "voltageDiv": string
        },
        "signalQuality": "good" | "acceptable" | "poor" | "unknown",
        "issues": [string],
        "assessment": string,
        "recommendations": [string],
        "spoken": string
      }
    `
    
    try {
      const response = await analyzeImageWithVision(photo.content.dataURL, prompt, apiKey)
      trackUsage('openai/gpt-4o', prompt, response)
      
      const analysis = JSON.parse(extractJson(response))
      speak(analysis.spoken)
      
      if (analysis.issues?.length > 0) {
        speak(`I noticed ${analysis.issues.length} potential issue${analysis.issues.length > 1 ? 's' : ''}. Check the canvas for details.`)
      }
      
      placeItem({
        type: 'scope_analysis',
        title: `${analysis.waveformType} Analysis`,
        content: { ...analysis, photoId: photo.id }
      })
    } catch (err) {
      speak("I couldn't analyze the oscilloscope screenshot.")
      addLog('system', `— Scope analysis error: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }, [apiKey, capturePhoto, placeItem, speak, addLog, trackUsage])

  // Feature 4: Datasheet on demand
  const findDatasheet = useCallback(async (partNumber: string) => {
    speak(`Looking up ${partNumber}`)
    addLog('system', `— Searching datasheet for ${partNumber}…`)
    
    const prompt = `Find datasheet and key specifications for the electronic component: ${partNumber}
        
      Return JSON:
      {
        "found": bool,
        "partNumber": string,
        "manufacturer": string,
        "description": string,
        "category": string,
        "keySpecs": [{"param": string, "value": string}],
        "datasheetUrl": string | null,
        "productPageUrl": string | null,
        "distributorUrls": {
          "mouser": string,
          "digikey": string,
          "lcsc": string
        },
        "alternatives": [string],
        "spoken": string,
        "notFoundMessage": string | null
      }`
    
    try {
      const response = await makeJarvisRequest([{ role: 'user', content: prompt }])
      const result = JSON.parse(extractJson(response))
      
      if (!result.found || !result.datasheetUrl) {
        speak(result.notFoundMessage || `I couldn't find a datasheet for ${partNumber}. I've added search links to the canvas. You could also try ${result.alternatives?.join(' or ')}.`);
        
        placeItem({
          type: 'search_suggestion',
          title: `${partNumber} Datasheet`,
          content: {
            originalQuery: partNumber,
            suggestion: result.alternatives?.[0] || partNumber,
            links: result.distributorUrls,
            note: result.notFoundMessage
          }
        })
        return
      }
      
      speak(`Found the ${result.manufacturer} ${result.partNumber}. ${result.spoken}`)
      
      placeItem({
        type: 'datasheet_card',
        title: `${result.partNumber} Datasheet`,
        content: result
      })
      
      setTimeout(() => {
        speak(`Say 'open in datasheet' to do a full analysis.`)
        setAwaitingConfirmation({
          type: 'open_datasheet',
          data: result
        })
      }, 3000)
    } catch (err) {
      speak("I had trouble searching for the datasheet.")
      addLog('system', `— Datasheet error: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }, [placeItem, speak, addLog, makeJarvisRequest])

  // Feature 5: Quick SPICE
  const quickSpice = useCallback(async (command: string) => {
    speak("Calculating...")
    addLog('system', `— Simulating circuit: "${command}"…`)

    try {
      const response = await makeJarvisRequest([{ role: 'user', content: command }], `You are a circuit simulation assistant.`)
      const result = JSON.parse(extractJson(response))
      speak(result.spoken)
      
      placeItem({
        type: 'quick_spice',
        title: result.circuitType,
        content: result
      })
    } catch (err) {
      speak("I couldn't complete the SPICE simulation.")
      addLog('system', `— SPICE error: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }, [placeItem, speak, addLog, makeJarvisRequest])

  const handleItemRemove = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((it) => it.id !== id))
      setGroups((prev) =>
        prev
          .map((g) => ({ ...g, itemIds: g.itemIds.filter((i) => i !== id) }))
          .filter((g) => g.itemIds.length >= 2)
      )
      addLog('system', '— Removed item')
    },
    [addLog, setItems, setGroups]
  )

  // Feature 6: Timer and Reminder system
  const setTimer = useCallback((durationSeconds: number, label = '') => {
    if (durationSeconds <= 0) {
      speak("Please specify a valid duration for the timer.")
      return
    }
    const timerId = uuid()
    const endTime = Date.now() + durationSeconds * 1000
    
    const formatDuration = (secs: number) => {
      const m = Math.floor(secs / 60)
      const s = secs % 60
      if (m > 0) return `${m} minute${m > 1 ? 's' : ''}${s > 0 ? ` and ${s} second${s > 1 ? 's' : ''}` : ''}`
      return `${s} second${s > 1 ? 's' : ''}`
    }
    
    speak(`${jarvisPhrase('timerSet')} ${formatDuration(durationSeconds)}${label ? ' — ' + label : ''}.`)
    
    const item = placeItem({
      type: 'timer',
      title: label || `Timer ${formatDuration(durationSeconds)}`,
      content: {
        timerId,
        durationSeconds,
        endTime,
        label,
        status: 'running'
      }
    })
    
    const timeout = setTimeout(() => {
      speak(`${jarvisPhrase('timerFired')}${label ? ' ' + label + '.' : ''}`)
      playTimerSound()
      
      setItems(prev => prev.map(it => {
        if (it.type === 'timer' && it.content?.timerId === timerId) {
          return { ...it, content: { ...it.content, status: 'done' } }
        }
        return it
      }))
      
      flashCanvasItem(item.id)
    }, durationSeconds * 1000)
    
    const interval = setInterval(() => {}, 1000)
    activeTimers.current.push({ timerId, timeout, interval, itemId: item.id })
  }, [placeItem, speak, playTimerSound, flashCanvasItem, setItems])

  const handleTimerAction = useCallback((timerId: string, action: 'add_minute' | 'pause_toggle' | 'cancel') => {
    const idx = activeTimers.current.findIndex(t => t.timerId === timerId)
    
    if (action === 'cancel') {
      if (idx !== -1) {
        const t = activeTimers.current[idx]
        clearTimeout(t.timeout)
        clearInterval(t.interval)
        activeTimers.current.splice(idx, 1)
        handleItemRemove(t.itemId)
      } else {
        const item = itemsRef.current.find(it => it.type === 'timer' && it.content?.timerId === timerId)
        if (item) handleItemRemove(item.id)
      }
      speak("Timer cancelled.")
      return
    }
    
    if (idx === -1) return
    const t = activeTimers.current[idx]
    
    if (action === 'add_minute') {
      clearTimeout(t.timeout)
      const item = itemsRef.current.find(it => it.id === t.itemId)
      if (!item) return
      
      const newDuration = item.content.durationSeconds + 60
      const newEndTime = item.content.endTime + 60000
      
      setItems(prev => prev.map(it => {
        if (it.id === t.itemId) {
          return {
            ...it,
            content: {
              ...it.content,
              durationSeconds: newDuration,
              endTime: newEndTime
            }
          }
        }
        return it
      }))
      
      const remainingSeconds = Math.max(0, Math.round((newEndTime - Date.now()) / 1000))
      
      t.timeout = setTimeout(() => {
        speak(`${jarvisPhrase('timerFired')}${item.content.label ? ' ' + item.content.label + '.' : ''}`)
        playTimerSound()
        setItems(prev => prev.map(it => {
          if (it.id === t.itemId) {
            return { ...it, content: { ...it.content, status: 'done' } }
          }
          return it
        }))
        flashCanvasItem(t.itemId)
      }, remainingSeconds * 1000)
      
      speak("Added one minute.")
    } else if (action === 'pause_toggle') {
      const item = itemsRef.current.find(it => it.id === t.itemId)
      if (!item) return
      
      if (item.content.status === 'running') {
        clearTimeout(t.timeout)
        const remaining = Math.max(0, Math.round((item.content.endTime - Date.now()) / 1000))
        setItems(prev => prev.map(it => {
          if (it.id === t.itemId) {
            return {
              ...it,
              content: {
                ...it.content,
                status: 'paused',
                remainingSeconds: remaining
              }
            }
          }
          return it
        }))
        speak("Timer paused.")
      } else {
        const remaining = item.content.remainingSeconds || 0
        const newEndTime = Date.now() + remaining * 1000
        setItems(prev => prev.map(it => {
          if (it.id === t.itemId) {
            return {
              ...it,
              content: {
                ...it.content,
                status: 'running',
                endTime: newEndTime
              }
            }
          }
          return it
        }))
        
        t.timeout = setTimeout(() => {
          speak(`Time's up. ${item.content.label || 'Timer done.'}`)
          playTimerSound()
          setItems(prev => prev.map(it => {
            if (it.id === t.itemId) {
              return { ...it, content: { ...it.content, status: 'done' } }
            }
            return it
          }))
          flashCanvasItem(t.itemId)
        }, remaining * 1000)
        
        speak("Timer resumed.")
      }
    }
  }, [handleItemRemove, speak, playTimerSound, flashCanvasItem, itemsRef, setItems])

  // Pattern detection helper
  const checkForPatterns = useCallback(async () => {
    const notebook = JSON.parse(localStorage.getItem('enginguity_notebook') || '[]')
    if (notebook.length < 5) return

    const problems = notebook.filter((e: JarvisAny) =>
      e.type === 'PROBLEM' || e.type === 'OBSERVATION'
    )
    if (problems.length < 2) return

    const wordCounts: Record<string, number> = {}
    problems.forEach((p: JarvisAny) => {
      const words = (p.title + ' ' + (p.notes || p.content || ''))
        .toLowerCase()
        .split(/\W+/)
        .filter((w: string) => w.length > 4)
      words.forEach((w: string) => {
        wordCounts[w] = (wordCounts[w] || 0) + 1
      })
    })

    const recurring = Object.entries(wordCounts)
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    if (recurring.length === 0) return

    const lastAlert = localStorage.getItem('enginguity_last_pattern_alert')
    const hoursSince = lastAlert ? (Date.now() - parseInt(lastAlert)) / 3600000 : 999
    if (hoursSince < 24) return

    const topPattern = recurring[0][0]
    const count = recurring[0][1]

    const message = `I noticed "${topPattern}" appears in ${count} of your notebook entries. This might be a recurring issue worth investigating systematically.`

    speak(message)

    moduleStateStore.publish('jarvis', { patternAlert: message })
    localStorage.setItem('enginguity_last_pattern_alert', Date.now().toString())
  }, [speak])

  // Feature 7: Notebook dictation
  const handleDictatedEntry = useCallback(async (transcript: string) => {
    speak("Classifying note...")
    addLog('system', `— Dictating note: "${transcript}"…`)
    
    const prompt = `Classify this spoken engineering note into a notebook entry type and extract structured data.
      
      Types:
      - TEST_RESULT: measurements, test outcomes
      - OBSERVATION: something noticed
      - PROBLEM: an issue encountered
      - DECISION: a choice made
      - NOTE: general information
      
      Transcript: "${transcript}"
      
      Return JSON:
      {
        "type": string,
        "title": string,
        "content": string,
        "measurements": [{ "param": string, "value": string, "unit": string }] | null,
        "isSolvingProblem": bool,
        "problemTitle": string | null
      }`
    
    try {
      const response = await makeJarvisRequest([{ role: 'user', content: prompt }])
      const entry = JSON.parse(extractJson(response))
      
      if (entry.isSolvingProblem) {
        const notebook = JSON.parse(localStorage.getItem('enginguity_notebook') || '[]')
        const openProblem = notebook.find((e: JarvisAny) => 
          e.type === 'PROBLEM' && e.status !== 'solved' &&
          (entry.problemTitle ? e.title.toLowerCase().includes(entry.problemTitle.toLowerCase()) : true)
        )
        
        if (openProblem) {
          openProblem.status = 'solved'
          openProblem.solution = entry.content
          openProblem.solvedAt = Date.now()
          localStorage.setItem('enginguity_notebook', JSON.stringify(notebook))
          window.dispatchEvent(new Event('notebook-updated'))
          checkForPatterns()
          speak(`Marked "${openProblem.title}" as solved in your notebook.`)
          return
        }
      }
      
      addNotebookEntry({
        type: entry.type,
        title: entry.title,
        content: entry.content,
        measurements: entry.measurements
      })
      
      placeItem({
        type: 'notebook_confirm',
        title: 'Notebook Entry Added',
        content: { entry },
        autoRemoveAfter: 8000
      })
      
      checkForPatterns()
    } catch (err) {
      speak("I couldn't dictate the notebook entry.")
      addLog('system', `— Notebook dictate error: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }, [placeItem, speak, addLog, makeJarvisRequest, addNotebookEntry, checkForPatterns])

  // Feature 8: Step-by-Step Guided mode
  // Declared before startGuidedMode below (used inside) to avoid a
  // temporal-dead-zone access-before-declared reference.
  const speakStep = useCallback((step: JarvisAny) => {
    speak(`Step ${step.number}: ${step.action}`)
    setTimeout(() => {
      speak(`To verify: ${step.verification}`)
    }, 3500)
    if (step.warning) {
      setTimeout(() => {
        speak(`Warning: ${step.warning}`)
      }, 7000)
    }
  }, [speak])

  const startGuidedMode = useCallback(async (topic: string) => {
    speak(`Starting guided walkthrough for ${topic}. I'll go one step at a time. Say 'next' when you're ready to continue, or 'explain' if you need more detail.`)
    addLog('system', `— Loading guide for "${topic}"…`)
    
    const projectCtx = buildFullProjectContext()
    const prompt = `Create a step-by-step guide for an engineer doing this task: "${topic}"
      
      Context: ${buildContextString(projectCtx)}
      
      Rules:
      - 5 to 10 steps maximum
      - Each step is ONE action only
      - Write for speaking aloud, not reading
      - Each step under 30 words
      - Include a verification — how do you know this step worked
      
      Return JSON:
      {
        "title": string,
        "estimatedMinutes": number,
        "steps": [{
          "number": number,
          "action": string,
          "verification": string,
          "warning": string | null,
          "canExpand": bool
        }],
        "completionMessage": string
      }`
      
    try {
      const response = await makeJarvisRequest([{ role: 'user', content: prompt }])
      const guide = JSON.parse(extractJson(response))
      
      const newGuideState = {
        title: guide.title,
        estimatedMinutes: guide.estimatedMinutes,
        steps: guide.steps,
        currentStep: 0,
        topic,
        completionMessage: guide.completionMessage
      }
      setGuidedMode(newGuideState)
      
      setItems(prev => prev.filter(it => it.type !== 'guided_steps'))
      
      placeItem({
        type: 'guided_steps',
        title: guide.title,
        content: { guide: newGuideState, currentStep: 0 }
      })
      
      speakStep(guide.steps[0])
    } catch (err) {
      speak("I couldn't load the guided walkthrough.")
      addLog('system', `— Guided mode error: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }, [placeItem, speak, addLog, makeJarvisRequest, speakStep, setItems])


  const processGuidedCommand = useCallback((transcript: string, modeState: JarvisAny) => {
    const cmd = transcript.toLowerCase().trim()
    const { steps, currentStep, completionMessage } = modeState
    
    if (['next', 'done', 'got it', 'continue', 'skip'].some(w => cmd === w || cmd.startsWith(w))) {
      const nextIdx = currentStep + 1
      if (nextIdx < steps.length) {
        const nextState = { ...modeState, currentStep: nextIdx }
        setGuidedMode(nextState)
        setItems(prev => prev.map(it => {
          if (it.type === 'guided_steps') {
            return { ...it, content: { ...it.content, currentStep: nextIdx } }
          }
          return it
        }))
        speakStep(steps[nextIdx])
      } else {
        speak(completionMessage || "Guided walkthrough complete. Nice job!")
        setGuidedMode(null)
        setItems(prev => prev.filter(it => it.type !== 'guided_steps'))
      }
      return true
    }
    
    if (['previous', 'go back', 'repeat'].some(w => cmd === w || cmd.includes(w))) {
      const prevIdx = cmd.includes('repeat') ? currentStep : Math.max(0, currentStep - 1)
      const nextState = { ...modeState, currentStep: prevIdx }
      setGuidedMode(nextState)
      setItems(prev => prev.map(it => {
        if (it.type === 'guided_steps') {
          return { ...it, content: { ...it.content, currentStep: prevIdx } }
        }
        return it
      }))
      speakStep(steps[prevIdx])
      return true
    }
    
    if (['explain', 'more detail', 'elaborate'].some(w => cmd === w || cmd.includes(w))) {
      const activeStep = steps[currentStep]
      speak("Let me explain that in more detail...")
      makeJarvisRequest(
        [{ role: 'user', content: `Explain this step in detail for an engineer: "${activeStep.action}".` }],
        "Provide a concise detailed explanation (under 100 words). Be specific and technical."
      ).then(res => {
        speak(res)
      })
      return true
    }
    
    if (['stop', 'exit guide', 'cancel walkthrough', 'exit walkthrough'].some(w => cmd === w || cmd.includes(w))) {
      speak(`Exiting guided walkthrough. You were on step ${currentStep + 1} of ${steps.length}.`)
      setGuidedMode(null)
      setItems(prev => prev.filter(it => it.type !== 'guided_steps'))
      return true
    }
    
    if (cmd.includes('where am i') || cmd.includes('current step')) {
      const activeStep = steps[currentStep]
      speak(`You're on step ${currentStep + 1} of ${steps.length}: ${activeStep.action}`)
      return true
    }
    
    return false
  }, [speak, speakStep, makeJarvisRequest, setItems])

  // Feature 9: Parts order shortlist
  const updateOrCreateOrderListItem = useCallback((updated: JarvisAny[]) => {
    const existing = itemsRef.current.find(it => it.type === 'order_list')
    if (existing) {
      setItems(prev => prev.map(it => {
        if (it.type === 'order_list') {
          return {
            ...it,
            content: { ...it.content, items: updated }
          }
        }
        return it
      }))
      flashCanvasItem(existing.id)
    } else {
      placeItem({
        type: 'order_list',
        title: 'Order List',
        content: { items: updated }
      })
    }
  }, [placeItem, flashCanvasItem, itemsRef, setItems])

  const addToOrderList = useCallback(async (item: JarvisAny) => {
    const newItem = {
      id: uuid(),
      description: item.description,
      quantity: item.quantity || 1,
      unit: item.unit || 'pcs',
      partNumber: item.partNumber || null,
      addedAt: Date.now(),
      addedBy: 'jarvis_voice',
      purchased: false
    }
    
    const updated = [...orderList, newItem]
    setOrderList(updated)
    localStorage.setItem('enginguity_jarvis_order_list', JSON.stringify(updated))
    
    speak(`Added ${newItem.quantity} ${newItem.description} to your order list. You have ${updated.length} items.`)
    updateOrCreateOrderListItem(updated)
  }, [orderList, speak, updateOrCreateOrderListItem])

  const handleOrderListAction = useCallback((action: 'export_csv' | 'read_list' | 'clear_purchased' | 'toggle_purchased', itemData?: JarvisAny) => {
    const current = JSON.parse(localStorage.getItem('enginguity_jarvis_order_list') || '[]') as JarvisAny[]
    
    if (action === 'toggle_purchased') {
      const updated = current.map(it => {
        if (it.id === itemData.subItemId) return { ...it, purchased: !it.purchased }
        return it
      })
      setOrderList(updated)
      localStorage.setItem('enginguity_jarvis_order_list', JSON.stringify(updated))
      updateOrCreateOrderListItem(updated)
    } else if (action === 'export_csv') {
      const headers = 'Quantity,Part Number,Customer Reference'
      const rows = current.map(it => `${it.quantity},${it.partNumber || ''},${it.description}`).join('\n')
      const blob = new Blob([[headers, rows].join('\n')], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mouser-order-list-${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
      speak("Exported Mouser CSV.")
    } else if (action === 'read_list') {
      if (current.length === 0) {
        speak("Your order list is empty.")
      } else {
        const text = current.map(it => `${it.quantity} ${it.description}`).join(', ')
        speak(`You have ${current.length} items: ${text}`)
      }
    } else if (action === 'clear_purchased') {
      const updated = current.filter(it => !it.purchased)
      setOrderList(updated)
      localStorage.setItem('enginguity_jarvis_order_list', JSON.stringify(updated))
      updateOrCreateOrderListItem(updated)
      speak("Cleared purchased items.")
    }
  }, [speak, updateOrCreateOrderListItem])

  const parseOrderItem = useCallback(async (transcript: string) => {
    const prompt = `Extract the electronic component order details from this spoken command: "${transcript}"`
    const response = await makeJarvisRequest(
      [{ role: 'user', content: prompt }],
      `You are a parser. Return ONLY valid JSON:
      {
        "description": "component name or description, e.g. 10k 0402 Resistor",
        "quantity": number (default 1),
        "unit": "pcs" or other unit (default "pcs"),
        "partNumber": "part number if mentioned, else null"
      }`
    )
    try {
      return JSON.parse(extractJson(response))
    } catch {
      return { description: transcript, quantity: 1, unit: 'pcs', partNumber: null }
    }
  }, [makeJarvisRequest])

  // Feature 10: Build Session Journal
  const endSession = useCallback(async () => {
    speak("Generating session summary...")
    addLog('system', '— Generating session journal…')
    
    const sessionItems = itemsRef.current.filter(item => 
      item.createdAt >= sessionStartTime
    )
    
    const sessionLog = {
      duration: Date.now() - sessionStartTime,
      commandCount: sessionCommands.length,
      itemsCreated: sessionItems.length,
      measurements: sessionItems
        .filter(i => i.type === 'measurement')
        .map(i => i.content),
      componentsIdentified: sessionItems
        .filter(i => i.type === 'component_id')
        .map(i => i.content.partNumber || i.content.value),
      videosWatched: sessionItems
        .filter(i => i.type === 'video')
        .map(i => i.title),
      questions: sessionItems
        .filter(i => i.type === 'text')
        .map(i => i.content.question),
      timersSet: sessionItems
        .filter(i => i.type === 'timer')
        .map(i => i.content.label),
      notesAdded: sessionItems
        .filter(i => i.type === 'notebook_confirm').length
    }
    
    const projectCtx = buildFullProjectContext()
    
    const prompt = `Generate a build session journal entry.
      Session duration: ${Math.round(sessionLog.duration / 60000)} minutes
      Commands: ${sessionLog.commandCount}
      Project: ${projectCtx.project?.description || 'No specific project'}
      
      Activity:
      Measurements taken: ${JSON.stringify(sessionLog.measurements)}
      Components identified: ${sessionLog.componentsIdentified.join(', ')}
      Videos watched: ${sessionLog.videosWatched.join(', ')}
      Questions asked: ${sessionLog.questions.join(', ')}
      Notes added: ${sessionLog.notesAdded}
      
      Write a natural session summary for an engineering notebook.
      What did the engineer work on? What did they learn?
      What progress was made? Keep it under 150 words.`
      
    try {
      const response = await makeJarvisRequest([{ role: 'user', content: prompt }])
      
      addNotebookEntry({
        type: 'NOTE',
        title: `Build Session — ${new Date().toLocaleDateString()}`,
        content: response,
        tags: ['session-log', 'jarvis'],
        sessionData: sessionLog
      })
      
      speak(`Session logged. ${Math.round(sessionLog.duration / 60000)} minutes, ${sessionLog.commandCount} commands, ${sessionLog.itemsCreated} canvas items. Summary added to your notebook.`)
      
      placeItem({
        type: 'data_doc',
        title: 'Session Summary',
        content: {
          source: 'Jarvis Session Journal',
          generatedAt: Date.now(),
          sections: [
            { heading: 'Summary', content: response, items: [] },
            { heading: 'Stats', content: `${Math.round(sessionLog.duration / 60000)} min session, ${sessionLog.commandCount} commands, ${sessionLog.itemsCreated} canvas items.`, items: [] }
          ]
        }
      })
    } catch (err) {
      speak("I couldn't compile the build session summary.")
      addLog('system', `— Session journal error: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }, [sessionStartTime, sessionCommands, makeJarvisRequest, placeItem, speak, addLog, addNotebookEntry, itemsRef])

  // Unified confirmation handler
  const handleConfirmation = useCallback((pending: { type: string; data: JarvisAny }, confirmed: boolean) => {
    if (!confirmed) return
    
    switch (pending.type) {
      case 'log_measurement':
        logMeasurementToNotebook(pending.data.reading, pending.data.itemId)
        break
      case 'open_datasheet':
        localStorage.setItem('enginguity_datasheet_prefill', JSON.stringify(pending.data))
        navigate('/datasheet')
        break
      case 'clear_canvas':
        clearCanvas()
        speak("Canvas cleared.")
        break
      case 'end_session':
        endSession()
        break
      case 'clear_order_list':
        setOrderList([])
        localStorage.setItem('enginguity_jarvis_order_list', '[]')
        setItems(prev => prev.filter(it => it.type !== 'order_list'))
        speak("Order list cleared.")
        break
    }
  }, [logMeasurementToNotebook, endSession, navigate, speak, clearCanvas, setItems])

  const handleGuidedModeAction = useCallback((action: 'prev' | 'next') => {
    if (!guidedMode) return
    if (action === 'next') {
      processGuidedCommand('next', guidedMode)
    } else if (action === 'prev') {
      processGuidedCommand('previous', guidedMode)
    }
  }, [guidedMode, processGuidedCommand])

  const handleOpenInCircuitSim = useCallback((netlist: string) => {
    localStorage.setItem('enginguity_sim_netlist', netlist)
    navigate('/circuit-sim')
  }, [navigate])

  const handleOpenInDatasheet = useCallback((component: JarvisAny) => {
    localStorage.setItem('enginguity_datasheet_prefill', JSON.stringify(component))
    navigate('/datasheet')
  }, [navigate])

  const parseDatasheetCommand = (transcript: string): string | null => {
    const match = transcript.match(/\b(?:find the datasheet for|get me the|look up|what are the specs for|I need information on)\s+([a-zA-Z0-9_-]+)/i)
    if (match) return match[1]
    if (/\bdatasheet\b/i.test(transcript)) {
      const parts = transcript.split(/\s+/)
      const idx = parts.findIndex(p => p.toLowerCase().includes('datasheet'))
      if (idx > 0) {
        const prev = parts[idx - 1].replace(/[^a-zA-Z0-9_-]/g, '')
        if (prev.length > 2 && !['the', 'for', 'my', 'this', 'a'].includes(prev.toLowerCase())) {
          return prev
        }
      }
    }
    return null
  }

  // Trigger check on mount
  useEffect(() => {
    checkForPatterns()
  }, [checkForPatterns])

  // ── Process command ──
  // Declared before processCommand below (used inside its switch statement)
  // to avoid a temporal-dead-zone access-before-declared reference.
  function handleCanvasControl(action: string) {
    switch (action) {
      case 'zoom_in':
        setTransform((t) => ({ ...t, scale: Math.min(3, t.scale * 1.3) }))
        speak('Zoomed in.')
        break
      case 'zoom_out':
        setTransform((t) => ({ ...t, scale: Math.max(0.1, t.scale / 1.3) }))
        speak('Zoomed out.')
        break
      case 'reset':
        setTransform({ x: 0, y: 0, scale: 1 })
        speak('View reset.')
        break
      case 'clear':
        clearCanvas()
        break
    }
    addLog('system', `— Canvas: ${action}`)
  }

  const processCommand = useCallback(
    async (transcript: string) => {
      if (!transcript.trim() || transcript.trim().length < 2) return

      // Bare "stop" / "shut up" / "quiet" etc. is a barge-in only — TTS was
      // already cancelled in onTranscript. Don't forward to the LLM.
      if (STOP_SPEECH_RE.test(transcript.trim())) {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel()
        addLog('user', transcript)
        setWakeState('listening')
        resetSleepTimer()
        return
      }

      const lowerTranscript = transcript.toLowerCase().trim()

      // ── Greeting fast-path (no AI call) ──
      const greetingMatch = /^(hi|hello|hey|good morning|good afternoon|good evening|yo)\b[\s!.,?]*$/i.test(transcript.trim())
      if (greetingMatch) {
        ;(window as JarvisAny).jarvisDiag?.('greeting fast-path', 'info')
        const reply = jarvisPhrase('greeting')
        addLog('user', transcript)
        speak(reply)
        addLog('jarvis', `⟡ ${reply}`)
        placeItem({
          type: 'note',
          title: 'Greeting',
          content: { text: `"${transcript}"\n→ ${reply}` },
          width: 220,
          height: 100,
          fromCommand: transcript,
          autoRemoveAfter: 30000,
        })
        setWakeState('listening')
        resetSleepTimer()
        return
      }

      if (lowerTranscript.includes('command palette') || lowerTranscript.includes('open commands')) {
        speak('Opening the command palette, sir.')
        window.dispatchEvent(new CustomEvent('enginguity_open_command_palette'))
        setWakeState('listening')
        resetSleepTimer()
        return
      }

      if (containsSleepCommand(transcript)) {
        speak(jarvisPhrase('sleep'))
        goToSleep()
        return
      }

      if (isPaused) {
        speak("I'm afraid I'm paused, sir. The daily budget limit has been reached. Please increase it in settings to resume.")
        addLog('system', '— Paused: daily budget limit reached')
        setWakeState('sleeping')
        return
      }

      // Intercept yes/no confirmations
      if (awaitingConfirmation) {
        const cmd = transcript.toLowerCase().trim()
        if (/^(yes|yeah|sure|confirm|yup)\b/.test(cmd)) {
          handleConfirmation(awaitingConfirmation, true)
          setAwaitingConfirmation(null)
          setWakeState('listening')
          resetSleepTimer()
          return
        }
        if (/^(no|nope|cancel|deny|nah)\b/.test(cmd)) {
          handleConfirmation(awaitingConfirmation, false)
          setAwaitingConfirmation(null)
          setWakeState('listening')
          resetSleepTimer()
          return
        }
      }

      // Intercept guided mode steps
      if (guidedMode) {
        const handled = processGuidedCommand(transcript, guidedMode)
        if (handled) {
          setWakeState('listening')
          resetSleepTimer()
          return
        }
      }

      // Track session command. Only a short prefix goes to the persistent
      // event log — full voice transcripts stay out of localStorage.
      setSessionCommands(prev => [...prev, transcript])
      logEvent('JARVIS_COMMAND', {
        transcriptPreview: transcript.slice(0, 80),
        module: 'jarvis',
      })

      const lower = transcript.toLowerCase()

      // ── Quick canvas controls ──
      if (/\bgo back\b|\bundo\b/.test(lower)) {
        setItems((prev) => prev.slice(0, -1))
        speak('Last item removed, sir.')
        addLog('system', '— Removed last item')
        setWakeState('listening')
        return
      }
      if (/\bread.*back\b/.test(lower)) {
        const last = [...itemsRef.current].reverse().find((i) => i.type === 'text' || i.type === 'calculation')
        if (last) speak(last.type === 'calculation' ? last.content.spoken : last.content.answer)
        setWakeState('listening')
        return
      }

      // ── Camera commands ──
      if (CAMERA_START.test(transcript)) {
        await startCamera()
        setWakeState('listening')
        resetSleepTimer()
        return
      }
      if (CAMERA_STOP.test(transcript)) {
        stopCamera()
        setWakeState('listening')
        resetSleepTimer()
        return
      }
      if (CAMERA_CAPTURE_ANALYZE.test(transcript)) {
        const photo = capturePhoto()
        if (photo) {
          const prompt = CAMERA_COMPONENT.test(transcript)
            ? 'Identify this electronic component. Give the part type, likely manufacturer, key specifications, and what it is commonly used for.'
            : CAMERA_READ_TEXT.test(transcript)
            ? 'Read and transcribe all visible text in this image. Include part numbers, labels, values, warnings.'
            : CAMERA_CHECK_CIRCUIT.test(transcript)
            ? 'This is a circuit or schematic. Review it as a senior electronics engineer would. Identify components, describe the topology, and flag any potential issues you can see.'
            : CAMERA_MEASURE.test(transcript)
            ? 'Estimate the dimensions and scale of objects in this image if possible. Identify any reference objects that could help establish scale.'
            : ''
          await analyzePhoto(photo, prompt)
        }
        setWakeState('listening')
        resetSleepTimer()
        return
      }
      if (CAMERA_CAPTURE.test(transcript)) {
        capturePhoto()
        setWakeState('listening')
        resetSleepTimer()
        return
      }
      if (CAMERA_ANALYZE.test(transcript) || CAMERA_COMPONENT.test(transcript) || CAMERA_READ_TEXT.test(transcript) || CAMERA_CHECK_CIRCUIT.test(transcript) || CAMERA_MEASURE.test(transcript)) {
        const photo = capturePhoto()
        if (photo) {
          const prompt = CAMERA_COMPONENT.test(transcript)
            ? 'Identify this electronic component. Give the part type, likely manufacturer, key specifications, and what it is commonly used for.'
            : CAMERA_READ_TEXT.test(transcript)
            ? 'Read and transcribe all visible text in this image. Include part numbers, labels, values, warnings.'
            : CAMERA_CHECK_CIRCUIT.test(transcript)
            ? 'This is a circuit or schematic. Review it as a senior electronics engineer. Identify components, describe the topology, and flag any potential issues.'
            : CAMERA_MEASURE.test(transcript)
            ? 'Estimate the dimensions and scale of objects in this image if possible. Identify any reference objects that could help establish scale.'
            : ''
          await analyzePhoto(photo, prompt)
        }
        setWakeState('listening')
        resetSleepTimer()
        return
      }
      // Live camera vision: "what do you see", "describe this", "look at this", etc.
      if (CAMERA_WHAT_DO_YOU_SEE.test(transcript)) {
        await handleWhatDoYouSee()
        setWakeState('listening')
        resetSleepTimer()
        return
      }
      if (CAMERA_DOES_THIS_LOOK_RIGHT.test(transcript)) {
        await handleWhatDoYouSee('Does this look correct? Flag any issues or concerns you notice.')
        setWakeState('listening')
        resetSleepTimer()
        return
      }
      if (CAMERA_CONTINUOUS_START.test(transcript)) {
        await handleContinuousMode()
        setWakeState('listening')
        resetSleepTimer()
        return
      }
      if (CAMERA_CONTINUOUS_STOP.test(transcript)) {
        stopContinuousMode()
        setWakeState('listening')
        resetSleepTimer()
        return
      }

      // ── Multimeter & Instrument Reading (Feature 1) ──
      const isMultimeterTrigger = [
        "what does this read",
        "read this display",
        "log this measurement",
        "what's the reading",
        "record this value"
      ].some(t => lower.includes(t))
      
      if (isMultimeterTrigger) {
        await readInstrument()
        setWakeState('listening')
        resetSleepTimer()
        return
      }

      // ── Component ID (Feature 2) ──
      const isComponentTrigger = [
        "identify this component",
        "what component is this",
        "decode this resistor",
        "what resistor is this"
      ].some(t => lower.includes(t))
      
      if (isComponentTrigger) {
        await identifyComponent()
        setWakeState('listening')
        resetSleepTimer()
        return
      }

      // ── Oscilloscope screenshot analysis (Feature 3) ──
      const isScopeTrigger = [
        "analyze this waveform",
        "what's this signal",
        "analyze this scope",
        "read this waveform",
        "analyze this signal"
      ].some(t => lower.includes(t))
      
      if (isScopeTrigger) {
        await analyzeOscilloscope()
        setWakeState('listening')
        resetSleepTimer()
        return
      }

      // ── Datasheet on demand (Feature 4) ──
      const datasheetPart = parseDatasheetCommand(transcript)
      if (datasheetPart) {
        await findDatasheet(datasheetPart)
        setWakeState('listening')
        resetSleepTimer()
        return
      }

      // ── Quick SPICE (Feature 5) ──
      if (lower.startsWith('simulate ') || lower.startsWith('run spice on ') || lower.startsWith('spice simulate ')) {
        const circuitDesc = transcript.replace(/^(simulate|run spice on|spice simulate)\s+/i, '')
        await quickSpice(circuitDesc)
        setWakeState('listening')
        resetSleepTimer()
        return
      }

      // ── Timer and Reminders (Feature 6) ──
      const numberMap: Record<string, number> = {
        one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10, fifteen: 15, thirty: 30
      }
      let timerAmount: number | null = null
      let timerLabel = ''
      
      const timerRegex = /\b(?:set|start)\s+(?:a\s+)?timer\s+(?:for\s+)?(\d+|one|two|three|four|five|ten|fifteen|thirty)\s*(minute|second|min|sec|hour|hr)s?(?:\s+(?:labeled|called|for)\s+(.+))?/i
      const tMatch = transcript.match(timerRegex)
      if (tMatch) {
        const valStr = tMatch[1].toLowerCase()
        const amount = /^\d+$/.test(valStr) ? parseInt(valStr) : (numberMap[valStr] || 1)
        const unit = tMatch[2].toLowerCase()
        timerLabel = tMatch[3]?.trim() || ''
        
        timerAmount = amount
        if (unit.startsWith('min')) timerAmount = amount * 60
        else if (unit.startsWith('hour') || unit.startsWith('hr')) timerAmount = amount * 3600
      }
      
      if (timerAmount !== null) {
        setTimer(timerAmount, timerLabel)
        setWakeState('listening')
        resetSleepTimer()
        return
      }

      // ── Notebook Dictation (Feature 7) ──
      const notebookTriggers = [
        "take a note",
        "log this observation",
        "add a notebook entry",
        "record this problem",
        "log this decision"
      ]
      const matchingNotebookTrigger = notebookTriggers.find(t => lower.includes(t))
      if (matchingNotebookTrigger) {
        const content = transcript.replace(new RegExp(`.*${matchingNotebookTrigger}\\s*`, 'i'), '').trim()
        await handleDictatedEntry(content || transcript)
        setWakeState('listening')
        resetSleepTimer()
        return
      }

      // ── Guided mode (Feature 8) ──
      if (/^(start guide for|walk me through|guide me on|start guide on|how do i do)\s+/i.test(transcript)) {
        const topic = transcript.replace(/^(start guide for|walk me through|guide me on|start guide on|how do i do)\s+/i, '')
        await startGuidedMode(topic)
        setWakeState('listening')
        resetSleepTimer()
        return
      }

      // ── Parts Order Shortlist (Feature 9) ──
      if (/\b(?:add|put)\s+(.+)\s+(?:to|on)\s+(?:my\s+)?order\s*list\b/i.test(transcript)) {
        const match = transcript.match(/\b(?:add|put)\s+(.+)\s+(?:to|on)\s+(?:my\s+)?order\s*list\b/i)
        if (match) {
          const itemText = match[1].trim()
          const parsed = await parseOrderItem(itemText)
          await addToOrderList(parsed)
        }
        setWakeState('listening')
        resetSleepTimer()
        return
      }
      if (/\b(?:clear|empty)\s+(?:the\s+)?order\s*list\b/i.test(lower)) {
        speak("Are you sure you want to clear your order list?")
        setAwaitingConfirmation({
          type: 'clear_order_list',
          data: null
        })
        setWakeState('listening')
        resetSleepTimer()
        return
      }
      if (/\b(?:export|save)\s+(?:the\s+)?order\s*list\b/i.test(lower)) {
        handleOrderListAction('export_csv')
        setWakeState('listening')
        resetSleepTimer()
        return
      }
      if (/\b(?:read|show|what is on)\s+(?:the\s+)?order\s*list\b/i.test(lower)) {
        handleOrderListAction('read_list')
        setWakeState('listening')
        resetSleepTimer()
        return
      }

      // ── Build Session Journal (Feature 10) ──
      if (/\b(?:end|wrap\s*up|finish|close)\s+(?:my\s+)?session\b/i.test(lower)) {
        speak("Are you sure you want to end the build session and compile the journal?")
        setAwaitingConfirmation({
          type: 'end_session',
          data: null
        })
        setWakeState('listening')
        resetSleepTimer()
        return
      }

      // ── Data doc commands ──
      if (CMD_PROJECT_STATUS.test(transcript)) {
        createDataDoc('project_status', 'Project Status', "Here's your project status. I've added a summary to the canvas.")
        setWakeState('listening')
        resetSleepTimer()
        return
      }
      if (CMD_SUMMARIZE.test(transcript)) {
        createDataDoc('project_summary', 'Project Summary', "Here's a summary of your project.")
        setWakeState('listening')
        resetSleepTimer()
        return
      }
      if (CMD_OPEN_PROBLEMS.test(transcript)) {
        createDataDoc('open_problems', 'Open Problems', "Here are your open problems from the notebook.")
        setWakeState('listening')
        resetSleepTimer()
        return
      }
      if (CMD_SUPPLY_CHAIN.test(transcript)) {
        createDataDoc('supply_chain', 'Supply Chain Status', "Here's your supply chain status.")
        setWakeState('listening')
        resetSleepTimer()
        return
      }
      if (CMD_RECENT_FILES.test(transcript)) {
        createDataDoc('recent_files', 'Recent Files', "Here are the files you've been working on.")
        setWakeState('listening')
        resetSleepTimer()
        return
      }
      if (CMD_PARAMETERS.test(transcript)) {
        createDataDoc('parameters', 'Parameter Snapshot', "Here's a snapshot of your current parameters.")
        setWakeState('listening')
        resetSleepTimer()
        return
      }

      // ── Session diff ──
      if (CMD_SESSION_DIFF.test(transcript)) {
        const prev = loadSnapshot()
        const curr = buildStateSnapshot()
        const diff = diffSnapshots(prev, curr)
        placeItem({
          type: 'session_diff',
          title: 'Session Changes',
          content: diff ?? { summary: 'No previous session snapshot found.', changes: [], prevTs: null, currTs: Date.now() },
          fromCommand: transcript,
        })
        speak(diff ? diff.summary : 'No previous snapshot to compare against.')
        setWakeState('listening')
        resetSleepTimer()
        return
      }

      // ── Cross-module search ──
      const searchMatch = CMD_SEARCH.exec(transcript)
      if (searchMatch) {
        const query = searchMatch[3]?.trim()
        if (query) {
          const idx = buildSearchIndex()
          const results = runSearchIndex(query, idx).slice(0, 8)
          placeItem({
            type: 'search_results',
            title: `Search: ${query}`,
            content: { query, results: results.map(r => ({ title: r.title, moduleLabel: r.moduleLabel, route: r.route, preview: r.preview || '', module: r.module })) },
            fromCommand: transcript,
          })
          speak(results.length > 0 ? `Found ${results.length} results for "${query}".` : `No results found for "${query}".`)
          setWakeState('listening')
          resetSleepTimer()
          return
        }
      }

      // ── Export canvas ──
      if (/\bexport\s+(the\s+)?canvas\b|\bsave\s+(the\s+)?canvas\b/.test(lower)) {
        await exportCanvas()
        setWakeState('listening')
        resetSleepTimer()
        return
      }

      // ── Provider switching — deterministic, no LLM round-trip, and placed
      // BEFORE the isConnected gate: "switch to local" has to work exactly
      // when the current provider is down or unconfigured.
      const providerCmd = matchProviderCommand(transcript)
      if (providerCmd) {
        addLog('user', transcript)
        if (providerCmd === activeProvider) {
          speak(
            providerCmd === 'ollama'
              ? 'Already running locally, sir.'
              : providerCmd === 'both'
                ? 'Hybrid mode is already engaged.'
                : 'Already on the cloud, sir.',
          )
        } else if ((providerCmd === 'ollama' || providerCmd === 'both') && !ollamaModelId) {
          speak('No local model is selected, sir. Pull one in AI Settings and I shall switch over.')
        } else if (providerCmd === 'openrouter' && !apiKey) {
          speak('No OpenRouter key is configured, sir. Connect one in AI Settings first.')
        } else {
          setActiveProvider(providerCmd)
          speak(
            providerCmd === 'ollama'
              ? `As you wish. ${formatOllamaModelName(ollamaModelId ?? '')} is handling requests locally now — free of charge.`
              : providerCmd === 'both'
                ? 'Hybrid mode engaged — local first, cloud as backup.'
                : 'Back on the cloud, sir.',
          )
          // setActiveProvider logs the typed PROVIDER_SWITCHED event itself.
          addLog('system', `— Provider switched to ${providerCmd}`)
        }
        setWakeState('listening')
        resetSleepTimer()
        return
      }

      if (!isConnected) {
        speak('No AI provider connected. Please connect OpenRouter first.')
        addLog('system', '— No AI provider connected')
        setWakeState('listening')
        return
      }

      setWakeState('processing')
      addLog('user', transcript)

      // Start session for auto-grouping
      startSession(transcript)

      // Build context for AI calls
      const ctx = buildFullProjectContext()
      const contextStr = buildContextString(ctx)

      try {
        const intent = await classifyIntent(transcript, makeRequest)

        switch (intent.type) {
          case 'question': {
            const raw = await fetchAnswer(transcript, makeRequest, contextStr)
            const answer = (enforceResponseLength(raw, 'question') + maybeAddInsult(transcript)).trim()
            speak(answer)
            placeItem({
              type: 'text',
              title: intent.query || transcript.slice(0, 50),
              content: { question: transcript, answer },
              fromCommand: transcript,
            })
            addLog('jarvis', `⟡ ${answer.slice(0, 80)}${answer.length > 80 ? '…' : ''}`)
            break
          }

          case 'image_search': {
            speak(`Pulling up an image of ${intent.query}, sir.`)
            const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(intent.query)}`
            let imgSrc = `https://source.unsplash.com/800x500/?${encodeURIComponent(intent.query)}`
            let imgSource = 'Unsplash'
            try {
              const res = await fetch(wikiUrl, { signal: AbortSignal.timeout(4000) })
              const data = await res.json()
              if (data.thumbnail?.source) {
                imgSrc = data.thumbnail.source.replace(/\/\d+px-/, '/800px-')
                imgSource = 'Wikipedia'
              }
            } catch { /* use Unsplash fallback */ }
            const googleImagesURL = `https://www.google.com/search?q=${encodeURIComponent(intent.query)}&tbm=isch`
            placeItem({
              type: 'image',
              title: intent.query,
              content: { src: imgSrc, caption: intent.query, source: imgSource, searchURL: googleImagesURL },
              width: 320,
              height: 200,
              fromCommand: transcript,
            })
            placeItem({
              type: 'link',
              title: `More images: ${intent.query}`,
              content: {
                url: googleImagesURL,
                title: 'Browse Google Images',
                description: `More images of ${intent.query}`,
              },
              fromCommand: transcript,
            })
            addLog('jarvis', `⟡ Placed image of ${intent.query} (${imgSource})`)
            setTimeout(() => speak('There you are, sir.'), 1500)
            break
          }

          case 'youtube_search': {
            speak(`Looking up a video about ${intent.query}`)
            if (apiKey) {
              const result = await fetchYouTubeVideoPerplexity(intent.query, apiKey)
              if (result.found && result.videoId) {
                placeItem({
                  type: 'video',
                  title: result.title || intent.query,
                  content: result,
                  width: 480,
                  height: 300,
                  fromCommand: transcript,
                })
                speak(`Playing ${result.title} by ${result.channel}`)
                addLog('jarvis', `⟡ Video: ${result.title}`)
              } else {
                // Fallback: search suggestion card
                const encoded = encodeURIComponent(result.alternativeQuery || intent.query)
                placeItem({
                  type: 'search_suggestion',
                  title: `Search: ${intent.query}`,
                  content: {
                    originalQuery: intent.query,
                    suggestion: result.alternativeQuery || intent.query,
                    youtubeSearchUrl: `https://www.youtube.com/results?search_query=${encoded}`,
                    googleSearchUrl: `https://www.google.com/search?q=${encoded}+tutorial+site:youtube.com`,
                  },
                  fromCommand: transcript,
                })
                speak(
                  `I couldn't find a specific video on ${intent.query}. I've added some search links to the canvas instead. You could also try searching for ${result.alternativeQuery || intent.query}.`
                )
                addLog('jarvis', `⟡ Search suggestion for ${intent.query}`)
              }
            } else {
              // No API key: place YouTube search URL card directly
              const encoded = encodeURIComponent(intent.query)
              placeItem({
                type: 'search_suggestion',
                title: `Search: ${intent.query}`,
                content: {
                  originalQuery: intent.query,
                  suggestion: intent.query,
                  youtubeSearchUrl: `https://www.youtube.com/results?search_query=${encoded}`,
                  googleSearchUrl: `https://www.google.com/search?q=${encoded}+tutorial+site:youtube.com`,
                },
                fromCommand: transcript,
              })
              speak(`I found a search for ${intent.query} — opening YouTube results on the canvas.`)
            }
            break
          }

          case 'calculation': {
            const calc = await fetchCalculation(transcript, makeRequest)
            speak(calc.spoken)
            placeItem({
              type: 'calculation',
              title: intent.query || transcript.slice(0, 50),
              content: calc,
              fromCommand: transcript,
            })
            addLog('jarvis', `⟡ ${calc.spoken}`)
            break
          }

          case 'tutorial': {
            speak(`Finding resources for ${intent.query}`)
            const result = await fetchTutorialResources(intent.query, makeRequest)
            speak(result.spoken)
            result.resources.forEach((r) => {
              placeItem({ type: 'link', title: r.title, content: r, fromCommand: transcript })
            })
            addLog('jarvis', `⟡ Placed ${result.resources.length} resource${result.resources.length !== 1 ? 's' : ''} for ${intent.query}`)
            break
          }

          case 'code': {
            speak(`Writing code for ${intent.query}`)
            const { code, language } = await fetchCode(transcript, makeRequest)
            placeItem({
              type: 'code',
              title: intent.query || 'Code',
              content: { code, language },
              fromCommand: transcript,
            })
            speak(`Here's the code for ${intent.query}`)
            addLog('jarvis', `⟡ Placed code: ${intent.query}`)
            break
          }

          case 'note': {
            const text = intent.content || transcript
            placeItem({ type: 'note', title: 'Note', content: { text }, fromCommand: transcript })
            speak('Note added.')
            addLog('jarvis', `⟡ Note: ${text.slice(0, 40)}`)
            break
          }

          case 'canvas_control':
            handleCanvasControl(intent.action)
            break

          case 'clear':
            if (pendingClear) {
              clearCanvas()
            } else {
              setPendingClear(true)
              speak('Are you sure? Say yes to clear.')
              addLog('system', '— Confirm: say "yes" to clear')
              setTimeout(() => setPendingClear(false), 10_000)
            }
            break

          default: {
            const raw = await fetchAnswer(transcript, makeRequest, contextStr)
            const answer = (enforceResponseLength(raw) + maybeAddInsult(transcript)).trim()
            speak(answer)
            placeItem({
              type: 'text',
              title: transcript.slice(0, 50),
              content: { question: transcript, answer },
              fromCommand: transcript,
            })
            addLog('jarvis', `⟡ ${answer.slice(0, 80)}`)
          }
        }

        if (pendingClear && /^yes\b/.test(lower)) {
          clearCanvas()
          setPendingClear(false)
        }
      } catch (err) {
        const msg = 'Sorry, I had trouble with that. Please try again.'
        speak(msg)
        addLog('system', `— Error: ${err instanceof Error ? err.message : 'unknown'}`)
      }

      setWakeState('listening')
      resetSleepTimer()
    },
    // The omitted deps (addToOrderList, clearCanvas, handleConfirmation,
    // setItems, itemsRef, etc.) are intentionally left out: this callback's
    // identity is never consumed directly — it's immediately captured into
    // processCommandRef below (the established stable-ref-forwarding
    // pattern used throughout this file) specifically so downstream
    // engine callbacks always see the latest closure without needing this
    // dependency list to be exhaustive. Adding all ~20 would just make an
    // already-recreated-every-render callback churn identity for no
    // behavioral change, while risking a "used before declaration" error
    // since several of them (processGuidedCommand, startGuidedMode, etc.)
    // are declared further down in this file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      makeRequest,
      isConnected,
      apiKey,
      activeProvider,
      setActiveProvider,
      ollamaModelId,
      speak,
      placeItem,
      addLog,
      goToSleep,
      resetSleepTimer,
      pendingClear,
      startCamera,
      stopCamera,
      capturePhoto,
      analyzePhoto,
      handleWhatDoYouSee,
      handleContinuousMode,
      stopContinuousMode,
      createDataDoc,
      exportCanvas,
      startSession,
    ]
  )

  // Stable refs for engine callbacks — updated every render so closures see fresh values
  const wakeUpRef = useRef(wakeUp)
  const goToSleepRef = useRef(goToSleep)
  const processCommandRef = useRef(processCommand)

  // ── Speech recognition via singleton engine ──
  useEffect(() => {
    ;(window as JarvisAny).jarvisDiag?.('Jarvis component mounted', 'info')

    // Browser support check
    const support = checkBrowserSupport()
    if (!support.supported) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount check surfacing an unsupported-browser notice
      setBrowserNoticeText(support.message!)
      setShowBrowserNotice(true)
      return
    }

    // Wire engine callbacks — use refs so closures always call the latest version
    setVoiceCallbacks({
      onWake: () => {
        ;(window as JarvisAny).jarvisDiag?.('onWake callback fired', 'success')
        // Guard: only run if React state is still sleeping to prevent double-calls
        if (wakeStateRef.current === 'sleeping') {
          wakeUpRef.current()
        }
      },
      onSleep: () => {
        ;(window as JarvisAny).jarvisDiag?.('onSleep callback fired', 'warn')
        if (wakeStateRef.current !== 'sleeping') {
          goToSleepRef.current()
        }
      },
      onCommand: (cmd: string) => {
        ;(window as JarvisAny).jarvisDiag?.(`onCommand: "${cmd}"`, 'success')
        processCommandRef.current(cmd)
      },
      onError: (msg: string) => {
        ;(window as JarvisAny).jarvisDiag?.(`engine error: ${msg}`, 'error')
        setPermissionState('denied')
        setBrowserNoticeText(msg)
        setShowBrowserNotice(true)
      },
      onListeningChange: () => {},
      onTranscript: (text: string, isFinal: boolean) => {
        // Barge-in: if JARVIS is mid-utterance and the user says "stop" (or similar),
        // cut TTS immediately — don't wait for the final transcript.
        if (
          text &&
          'speechSynthesis' in window &&
          window.speechSynthesis.speaking &&
          STOP_SPEECH_RE.test(text.trim())
        ) {
          window.speechSynthesis.cancel()
          ;(window as JarvisAny).jarvisDiag?.('barge-in: speech cancelled', 'warn')
        }
        if (isFinal) {
          setInterimTranscript('')
        } else {
          setInterimTranscript(text)
        }
      },
    })

    // Explicit mic permission — lets us show a clear error rather than silent fail
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((stream) => {
        setPermissionState('granted')
        ;(window as JarvisAny).jarvisDiag?.('mic permission GRANTED ✓', 'success')

        // Audio analyser for the waveform visualizer (keep existing)
        const audioCtx = new AudioContext()
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 32
        source.connect(analyser)
        audioCtxRef.current = audioCtx
        analyserRef.current = analyser

        // ScriptProcessorNode for background double-clap wake detection
        const scriptNode = audioCtx.createScriptProcessor(2048, 1, 1)
        let lastClapTime = 0
        const THRESHOLD = 0.35 // Default loud clap threshold
        const COOLDOWN = 150  // ms (ignore peaks within same clap)
        const MIN_WINDOW = 200 // ms (min interval between claps)
        const MAX_WINDOW = 800 // ms (max interval between claps)

        scriptNode.onaudioprocess = (event) => {
          if (wakeStateRef.current !== 'sleeping') return
          
          const inputBuffer = event.inputBuffer.getChannelData(0)
          let peak = 0
          for (let i = 0; i < inputBuffer.length; i++) {
            const val = Math.abs(inputBuffer[i])
            if (val > peak) peak = val
          }

          if (peak > THRESHOLD) {
            const now = Date.now()
            if (now - lastClapTime < COOLDOWN) return
            
            if (now - lastClapTime >= MIN_WINDOW && now - lastClapTime <= MAX_WINDOW) {
              ;(window as JarvisAny).jarvisDiag?.('Double-clap detected! Waking up...', 'success')
              engineWake()
              lastClapTime = 0
            } else {
              lastClapTime = now
            }
          }
        }

        source.connect(scriptNode)
        scriptNode.connect(audioCtx.destination)
        clapNodeRef.current = scriptNode

        // Start the singleton recognition engine
        startVoice()
        ;(window as JarvisAny).jarvisDiag?.('Voice engine started', 'success')
      })
      .catch((err: Error) => {
        ;(window as JarvisAny).jarvisDiag?.(`mic DENIED: ${err.name}`, 'error')
        setPermissionState('denied')
      })

    return () => {
      ;(window as JarvisAny).jarvisDiag?.('Jarvis unmounting — stopping voice + camera', 'warn')
      stopVoice()
      if (clapNodeRef.current) {
        clapNodeRef.current.disconnect()
        clapNodeRef.current = null
      }
      if (audioCtxRef.current) audioCtxRef.current.close()
      if (vizFrameRef.current) cancelAnimationFrame(vizFrameRef.current)
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current)
      window.speechSynthesis.cancel()
      // Stop camera engine if it's running
      if (engIsCameraActive()) engStopCamera()
    }
  }, [])

  useEffect(() => {
    wakeUpRef.current = wakeUp
    goToSleepRef.current = goToSleep
    processCommandRef.current = processCommand
  }, [wakeUp, goToSleep, processCommand])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') goToSleep()
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        setItems((prev) => prev.slice(0, -1))
        addLog('system', '— Undo')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goToSleep, addLog, setItems])

  const handleTypedSubmit = () => {
    const cmd = typedCommand.trim()
    if (!cmd) return
    setTypedCommand('')
    if (wakeStateRef.current === 'sleeping') wakeUp()
    processCommand(cmd)
  }

  const handleClearAll = useCallback(() => {
    if (items.length === 0) return
    if (pendingClear) {
      clearCanvas()
      setPendingClear(false)
    } else {
      setPendingClear(true)
      speak('Are you sure? Click again to clear.')
      setTimeout(() => setPendingClear(false), 3_000)
    }
  }, [items.length, pendingClear, speak, clearCanvas])

  // ── Render ──
  const canvasBg = BG_COLORS[settings.canvasBackground]
  const showWelcome = items.length === 0 && wakeState === 'sleeping'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        fontFamily: "'DM Sans Variable', 'DM Sans', sans-serif",
      }}
    >
      {/* Voice diagnostic overlay — always visible during development */}
      <VoiceDiagnostic />

      {/* Browser compat notice */}
      {showBrowserNotice && (
        <div
          style={{
            background: 'var(--bg-2)',
            borderBottom: '1px solid var(--border)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--text-dim)', flex: 1 }}>{browserNoticeText}</span>
          <button
            onClick={() => setShowBrowserNotice(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Mic permission overlay */}
      {permissionState === 'denied' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              border: '2px solid var(--border-bright)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MicOff size={28} style={{ color: 'var(--text-dim)' }} />
          </div>
          <div style={{ fontSize: 16, color: 'var(--text)', fontWeight: 500 }}>
            Microphone access required for Jarvis
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              textAlign: 'center',
              maxWidth: 380,
              lineHeight: 1.6,
            }}
          >
            Click the lock icon (⊕) in your browser's address bar and allow microphone access.
            <br />
            Then reload the page to activate voice control.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 20px',
              border: '1px solid var(--accent)',
              borderRadius: 6,
              background: 'transparent',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* Infinite canvas */}
      {!immersiveOpen && (
        <InfiniteCanvas
          items={items}
          groups={groups}
          transform={transform}
          onTransformChange={setTransform}
          onItemMove={handleItemMove}
          onItemResize={handleItemResize}
          onItemRemove={handleItemRemove}
          onClearAll={handleClearAll}
          onUndo={handleUndo}
          onAnalyzePhoto={handleAnalyzePhotoById}
          onCameraStart={startCamera}
          onCameraCapture={capturePhoto as () => void}
          onCameraStop={stopCamera}
          cameraVideoRef={cameraVideoRef}
          showWelcome={showWelcome}
          canvasBg={canvasBg}
          canvasWorldRef={canvasWorldRef}
          onExport={exportCanvas}
          onLogMeasurement={logMeasurementToNotebook}
          onCenterOnItem={centerOnItem}
          onFindDatasheet={findDatasheet}
          onAddPartToBOM={addPartToBOM}
          onTimerAction={handleTimerAction}
          onOrderListAction={handleOrderListAction}
          onGuidedModeAction={handleGuidedModeAction}
          onOpenInCircuitSim={handleOpenInCircuitSim}
          onOpenInDatasheet={handleOpenInDatasheet}
        />
      )}

      {/* Slide-in measurements panel */}
      {showMeasurementPanel && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 172,
            width: 450,
            background: 'var(--surface)',
            borderLeft: '1px solid var(--border-bright)',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
            zIndex: 40,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "'DM Sans Variable', 'DM Sans', sans-serif",
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Session Measurements</span>
            <button
              onClick={() => setShowMeasurementPanel(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <X size={14} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {items.filter(it => it.type === 'measurement').length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', textAlign: 'center', marginTop: 32 }}>
                No measurements recorded in this session.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 4px' }}>Instrument</th>
                    <th style={{ textAlign: 'left', padding: '6px 4px' }}>Reading</th>
                    <th style={{ textAlign: 'left', padding: '6px 4px' }}>Mode</th>
                    <th style={{ textAlign: 'left', padding: '6px 4px' }}>Time</th>
                    <th style={{ textAlign: 'left', padding: '6px 4px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .filter(it => it.type === 'measurement')
                    .map((it) => {
                      const m = it.content
                      return (
                        <tr key={it.id} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                          <td style={{ padding: '8px 4px', color: 'var(--text)' }}>{it.title || m.instrumentType}</td>
                          <td style={{ padding: '8px 4px', fontFamily: 'monospace', color: 'var(--accent)' }}>
                            {m.primaryReading?.value} {m.primaryReading?.unit}
                          </td>
                          <td style={{ padding: '8px 4px', color: 'var(--text-muted)' }}>{m.primaryReading?.mode}</td>
                          <td style={{ padding: '8px 4px', color: 'var(--text-dim)' }}>
                            {new Date(m.capturedAt || it.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '8px 4px' }}>
                            {m.logged ? (
                              <span style={{ color: '#7aaa8a', fontSize: 11 }}>Logged</span>
                            ) : (
                              <button
                                onClick={() => logMeasurementToNotebook(m, it.id)}
                                style={{
                                  background: 'transparent',
                                  border: '1px solid var(--accent)',
                                  borderRadius: 4,
                                  color: 'var(--accent)',
                                  padding: '2px 6px',
                                  fontSize: 10,
                                  cursor: 'pointer',
                                }}
                              >
                                Log
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Voice status bar */}
      <div
        style={{
          height: isFocusMode ? 24 : 32,
          background: 'var(--bg-2)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 12,
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          transition: 'height 150ms ease',
        }}
      >
        {wakeState === 'processing' && (
          <div
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'var(--bg-2)' }}
          >
            <div
              style={{
                height: 1,
                background: '#94a5ba',
                animation: 'jarvis-loading 1.4s ease-in-out infinite',
              }}
            />
          </div>
        )}

        {awaitingConfirmation ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent)' }}>
              Confirm: {awaitingConfirmation.type === 'log_measurement' ? 'Log measurement to notebook?' :
                       awaitingConfirmation.type === 'open_datasheet' ? 'Open datasheet module?' :
                       awaitingConfirmation.type === 'clear_canvas' ? 'Clear the canvas?' :
                       awaitingConfirmation.type === 'end_session' ? 'End the build session?' :
                       awaitingConfirmation.type === 'clear_order_list' ? 'Clear the order list?' : 'Proceed?'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  handleConfirmation(awaitingConfirmation, true)
                  setAwaitingConfirmation(null)
                }}
                style={{
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 4,
                  color: 'white',
                  padding: '2px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Yes
              </button>
              <button
                onClick={() => {
                  handleConfirmation(awaitingConfirmation, false)
                  setAwaitingConfirmation(null)
                }}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                  color: 'var(--text-muted)',
                  padding: '2px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                No
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Left: waveform */}
            <div style={{ width: 40, display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              {wakeState === 'sleeping' ? (
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#5a6a7a' }} />
              ) : wakeState === 'listening' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 20 }}>
                  {waveformBars.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        width: 3,
                        height: `${h}px`,
                        background: '#94a5ba',
                        borderRadius: 2,
                        transition: 'height 60ms ease',
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 3,
                        height: 8,
                        background: '#94a5ba',
                        borderRadius: 2,
                        opacity: 0.5,
                        animation: `jarvis-pulse 1.2s ease-in-out ${i * 0.15}s infinite`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Center: status */}
            <div
              style={{
                flex: 1,
                fontSize: 12,
                color: wakeState === 'sleeping' ? '#6b7a8d' : '#94a5ba',
                fontStyle: wakeState === 'processing' ? 'italic' : 'normal',
                transition: 'color 200ms ease',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {guidedMode && (
                <span style={{ color: 'var(--accent)', fontWeight: 600, marginRight: 8 }}>
                  [Guide Step {guidedMode.currentStep + 1}/{guidedMode.steps.length}]
                </span>
              )}
              {wakeState === 'sleeping' && 'Say Hey Jarvis to begin'}
              {wakeState === 'listening' && (isSpeaking ? 'Speaking…' : 'Listening…')}
              {wakeState === 'processing' && 'Thinking…'}
            </div>

            {/* Camera toggle button */}
            <button
              title={cameraActive ? 'Turn off camera' : 'Turn on camera'}
              onClick={() => (cameraActive ? stopCamera() : startCamera())}
              style={{
                background: cameraActive ? 'rgba(176,128,128,0.15)' : 'transparent',
                border: `1px solid ${cameraActive ? '#b08080' : 'transparent'}`,
                borderRadius: 5,
                color: cameraActive ? '#b08080' : '#5a6a7a',
                cursor: 'pointer',
                padding: '2px 6px',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                flexShrink: 0,
                transition: 'all 150ms ease',
              }}
            >
              {cameraActive && (
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#ff4444', animation: 'jarvis-pulse 1.5s ease infinite' }} />
              )}
              ▶ {cameraActive ? 'Cam' : 'Camera'}
            </button>

            {/* Running cost status */}
            {!isFocusMode && (
              <span style={{ fontSize: 11, color: isPaused ? '#b08080' : 'var(--text-muted)', flexShrink: 0 }}>
                {isPaused ? 'PAUSED (Limit Reached) ' : ''}${runningCost.toFixed(3)} today
              </span>
            )}

            {/* Right controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexShrink: 0,
                position: 'relative',
              }}
            >
              {!isFocusMode && (
                <button
                  title="Session measurements"
                  onClick={() => setShowMeasurementPanel((p) => !p)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: showMeasurementPanel ? '#94a5ba' : '#5a6a7a',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 2,
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.color = showMeasurementPanel ? '#94a5ba' : '#5a6a7a')
                  }
                >
                  Measurements Table
                </button>
              )}

              <button
                title={wakeState === 'sleeping' ? 'Wake Jarvis' : 'Sleep'}
                onClick={() => {
                  if (wakeState === 'sleeping') {
                    // Route through engine so _isAwake is synced; engine fires onWake → wakeUpRef
                    engineWake()
                  } else {
                    goToSleep()  // goToSleep already calls engineSleep() to sync engine state
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: wakeState === 'sleeping' ? '#5a6a7a' : '#94a5ba',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 2,
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color =
                    wakeState === 'sleeping' ? '#5a6a7a' : '#94a5ba')
                }
              >
                <Mic size={16} />
              </button>

              <button
                title={isMuted ? 'Unmute responses' : 'Mute responses'}
                onClick={() => setIsMuted((m) => !m)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: isMuted ? '#5a6a7a' : '#94a5ba',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 2,
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = isMuted ? '#5a6a7a' : '#94a5ba')
                }
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>

              {!isFocusMode && (
                <button
                  title="Jarvis settings"
                  onClick={() => setShowSettings((s) => !s)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: showSettings ? '#94a5ba' : '#5a6a7a',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 2,
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.color = showSettings ? '#94a5ba' : '#5a6a7a')
                  }
                >
                  <Settings size={16} />
                </button>
              )}

              {/* Focus mode toggle button */}
              <button
                title={isFocusMode ? "Exit Focus Mode (Esc)" : "Focus Mode (Cmd+Shift+F)"}
                onClick={toggleFocusMode}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#5a6a7a',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 2,
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = '#5a6a7a')
                }
              >
                {isFocusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>

              {showSettings && (
                <SettingsPopover
                  settings={settings}
                  onChange={(s) => setSettings(s)}
                  onClose={() => setShowSettings(false)}
                  permissionState={permissionState}
                  voices={voices}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Conversation strip */}
      <div
        ref={logStripRef}
        style={{
          height: 140,
          background: 'var(--bg)',
          borderTop: '1px solid var(--border)',
          overflowY: 'auto',
          padding: '8px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          flexShrink: 0,
        }}
      >
        {log.length === 0 && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-dim)',
              fontStyle: 'italic',
              marginTop: 4,
            }}
          >
            — Conversation will appear here
          </div>
        )}
        {log.map((entry) => (
          <div
            key={entry.id}
            style={{
              fontSize: entry.role === 'system' ? 11 : 13,
              color:
                entry.role === 'system'
                  ? 'var(--text-dim)'
                  : 'var(--text)',
              fontStyle: entry.role === 'system' ? 'italic' : 'normal',
              lineHeight: 1.5,
              flexShrink: 0,
            }}
          >
            {entry.role === 'user' && <span style={{ color: '#94a5ba' }}>› </span>}
            {entry.role === 'jarvis' && <span style={{ color: '#94a5ba' }}>⟡ </span>}
            <span
              style={{
                color:
                  entry.role === 'jarvis'
                    ? 'var(--text-muted)'
                    : entry.role === 'system'
                    ? 'var(--text-dim)'
                    : 'var(--text)',
              }}
            >
              {entry.text}
            </span>
          </div>
        ))}
      </div>

      {/* Typed command input */}
      <div
        style={{
          height: 32,
          background: 'var(--bg-2)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <input
          value={typedCommand}
          onChange={(e) => setTypedCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleTypedSubmit()
          }}
          placeholder="Type a command…"
          style={{
            flex: 1,
            height: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: '0 12px',
            fontSize: 13,
            color: 'var(--text)',
            fontFamily: "'DM Sans Variable', 'DM Sans', sans-serif",
          }}
        />
        {wakeState === 'processing' && (
          <div style={{ paddingRight: 12, fontSize: 11, color: 'var(--text-dim)' }}>
            processing…
          </div>
        )}
      </div>

      {/* ENTER JARVIS — immersive entry button */}
      {!immersiveOpen && (
        <button
          onClick={() => setImmersiveOpen(true)}
          style={{
            position: 'fixed',
            bottom: 72,
            right: probeBotOpen ? 280 + 24 : 24,
            zIndex: 200,
            background: 'transparent',
            border: '1px solid rgba(0,180,255,0.7)',
            borderRadius: 8,
            padding: '10px 18px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow:
              '0 0 16px rgba(0,180,255,0.3), 0 0 32px rgba(0,140,255,0.12), inset 0 0 12px rgba(0,160,255,0.05)',
            transition: 'all 200ms ease',
            fontFamily: '"Geist Mono", monospace',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'rgba(0,160,255,0.06)'
            el.style.borderColor = 'rgba(0,200,255,0.8)'
            el.style.boxShadow = '0 0 20px rgba(0,160,255,0.3), 0 0 40px rgba(0,160,255,0.1)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.background = 'transparent'
            el.style.borderColor = 'rgba(0,160,255,0.6)'
            el.style.boxShadow =
              '0 0 12px rgba(0,160,255,0.2), 0 0 24px rgba(0,160,255,0.08), inset 0 0 12px rgba(0,160,255,0.05)'
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#00a0ff',
              animation: 'jarvis-enter-pulse 2s ease infinite',
            }}
          />
          <span
            style={{
              fontFamily: '"Geist Mono", monospace',
              fontWeight: 400,
              fontSize: 11,
              color: 'rgba(0,220,255,0.98)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              textShadow: '0 0 8px rgba(0,200,255,0.5)',
            }}
          >
            Enter Jarvis
          </span>
        </button>
      )}

      <ImmersiveContainer
        visible={immersiveOpen}
        state={wakeState === 'sleeping' ? 'sleeping' : isSpeaking ? 'speaking' : wakeState}
        log={log}
        interimTranscript={interimTranscript}
        isConnected={isConnected}
        activeModel={activeModel || ''}
        provider={(localStorage.getItem('enginguity_active_provider') as string) || 'openrouter'}
        canvasItems={items}
        cameraActive={cameraActive}
        cameraVideoRef={cameraVideoRef}
        waveformBars={waveformBars}
        onExit={() => setImmersiveOpen(false)}
        onToggleMic={() => {
          if (wakeState === 'sleeping') engineWake()
          else goToSleep()
        }}
        onToggleCamera={() => (cameraActive ? stopCamera() : startCamera())}
        onToggleMute={() => setIsMuted((m) => !m)}
        renderCanvas={() => (
          <InfiniteCanvas
            items={items}
            groups={groups}
            transform={transform}
            onTransformChange={setTransform}
            onItemMove={handleItemMove}
            onItemResize={handleItemResize}
            onItemRemove={handleItemRemove}
            onClearAll={handleClearAll}
            onUndo={handleUndo}
            onAnalyzePhoto={handleAnalyzePhotoById}
            onCameraStart={startCamera}
            onCameraCapture={capturePhoto as () => void}
            onCameraStop={stopCamera}
            cameraVideoRef={cameraVideoRef}
            showWelcome={showWelcome}
            canvasBg={canvasBg}
            canvasWorldRef={canvasWorldRef}
            onExport={exportCanvas}
            onLogMeasurement={logMeasurementToNotebook}
            onCenterOnItem={centerOnItem}
            onFindDatasheet={findDatasheet}
            onAddPartToBOM={addPartToBOM}
            onTimerAction={handleTimerAction}
            onOrderListAction={handleOrderListAction}
            onGuidedModeAction={handleGuidedModeAction}
            onOpenInCircuitSim={handleOpenInCircuitSim}
            onOpenInDatasheet={handleOpenInDatasheet}
          />
        )}
      />

      <style>{`
        @keyframes jarvis-loading {
          0% { width: 0%; margin-left: 0% }
          50% { width: 40%; margin-left: 30% }
          100% { width: 0%; margin-left: 100% }
        }
        @keyframes jarvis-pulse {
          0%, 100% { transform: scaleY(0.4); opacity: 0.3 }
          50% { transform: scaleY(1.6); opacity: 0.8 }
        }
        @keyframes slideIn {
          from { transform: translateX(100%) }
          to { transform: translateX(0) }
        }
        @keyframes jarvis-enter-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 4px #00a0ff }
          50% { opacity: 0.4; box-shadow: 0 0 8px #00a0ff }
        }
      `}</style>
    </div>
  )
}

// ────────── Module-level error boundary ──────────
class JarvisErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    ;(window as JarvisAny).jarvisDiag?.(`REACT ERROR: ${error.message}`, 'error')
    console.error('Jarvis crashed:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            background: '#080810',
            gap: 16,
            padding: 40,
            textAlign: 'center',
          }}
        >
          <VoiceDiagnostic />
          <div style={{ fontSize: 14, color: '#6b6d85', fontFamily: 'sans-serif' }}>
            Jarvis encountered an error
          </div>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 12,
              color: '#ff6b6b',
              background: '#1a0a0a',
              border: '1px solid #ff6b6b33',
              borderRadius: 6,
              padding: '8px 14px',
              maxWidth: 400,
              wordBreak: 'break-word',
            }}
          >
            {this.state.error?.message}
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
            }}
            style={{
              background: 'transparent',
              border: '1px solid #2a2a45',
              color: '#94a5ba',
              borderRadius: 6,
              padding: '8px 20px',
              cursor: 'pointer',
              fontFamily: 'sans-serif',
              fontSize: 13,
            }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function JarvisModule() {
  return (
    <JarvisErrorBoundary>
      <JarvisModuleInner />
    </JarvisErrorBoundary>
  )
}
