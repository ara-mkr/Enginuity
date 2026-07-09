export const DEFAULT_KOKORO_VOICE = 'am_puck'
const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'

export const KOKORO_MALE_VOICES = [
  { id: 'am_puck', label: 'Puck', accent: 'American' },
  { id: 'bm_fable', label: 'Fable', accent: 'British' },
  { id: 'bm_george', label: 'George', accent: 'British' },
  { id: 'bm_daniel', label: 'Daniel', accent: 'British' },
  { id: 'bm_lewis', label: 'Lewis', accent: 'British' },
  { id: 'am_fenrir', label: 'Fenrir', accent: 'American' },
  { id: 'am_michael', label: 'Michael', accent: 'American' },
] as const

export type KokoroVoiceId = typeof KOKORO_MALE_VOICES[number]['id']

type KokoroAudio = {
  toBlob: () => Blob
}

type KokoroTTSInstance = {
  generate: (text: string, options?: { voice?: string; speed?: number }) => Promise<KokoroAudio>
}

let ttsPromise: Promise<KokoroTTSInstance> | null = null
let currentAudio: HTMLAudioElement | null = null
let currentUrl: string | null = null
let playbackGeneration = 0

function canUseKokoro() {
  return (
    typeof window !== 'undefined' &&
    typeof Audio !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof WebAssembly !== 'undefined'
  )
}

function clampSpeed(speed: number | undefined) {
  if (!Number.isFinite(speed)) return 0.95
  return Math.max(0.65, Math.min(1.25, speed ?? 0.95))
}

function cleanupAudio() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio = null
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl)
    currentUrl = null
  }
}

async function loadKokoro(): Promise<KokoroTTSInstance> {
  if (!canUseKokoro()) {
    throw new Error('Kokoro TTS is not available in this browser.')
  }
  if (!ttsPromise) {
    ttsPromise = import('kokoro-js')
      .then(({ KokoroTTS }) =>
        KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
          dtype: 'q8',
          device: 'wasm',
        })
      )
      .catch((error) => {
        ttsPromise = null
        throw error
      })
  }
  return ttsPromise
}

export function cancelKokoroSpeech() {
  playbackGeneration += 1
  cleanupAudio()
}

export async function speakWithKokoro(
  text: string,
  options: {
    voice?: KokoroVoiceId
    speed?: number
    onStart?: () => void
  } = {},
): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return

  const runId = playbackGeneration + 1
  playbackGeneration = runId

  const tts = await loadKokoro()
  if (playbackGeneration !== runId) return

  const audio = await tts.generate(trimmed, {
    voice: options.voice ?? DEFAULT_KOKORO_VOICE,
    speed: clampSpeed(options.speed),
  })
  if (playbackGeneration !== runId) return

  cleanupAudio()
  const url = URL.createObjectURL(audio.toBlob())
  const player = new Audio(url)
  currentUrl = url
  currentAudio = player

  await new Promise<void>((resolve, reject) => {
    player.onplay = () => options.onStart?.()
    player.onended = () => resolve()
    player.onerror = () => {
      if (playbackGeneration !== runId) resolve()
      else reject(new Error('Kokoro audio playback failed.'))
    }
    player.play().catch((error) => {
      if (playbackGeneration !== runId) resolve()
      else reject(error)
    })
  }).finally(() => {
    if (currentAudio === player) cleanupAudio()
  })
}
