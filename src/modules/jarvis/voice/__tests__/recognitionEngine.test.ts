import { describe, it, expect, beforeEach, vi } from 'vitest'

// The engine keeps its state in module-level variables that aren't exported,
// so each test gets a clean slate via vi.resetModules() + a fresh dynamic import.
async function loadEngine() {
  vi.resetModules()
  return import('../recognitionEngine')
}

class FakeSpeechRecognition {
  continuous = false
  interimResults = false
  lang = ''
  maxAlternatives = 1
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onresult: ((e: unknown) => void) | null = null
  start = vi.fn()
  abort = vi.fn()
}

function installFakeSR() {
  const instances: FakeSpeechRecognition[] = []
  ;(window as any).SpeechRecognition = vi.fn().mockImplementation(function (this: unknown) {
    const inst = new FakeSpeechRecognition()
    instances.push(inst)
    return inst
  })
  return instances
}

function fakeResultEvent(transcripts: Array<{ text: string; isFinal: boolean }>, resultIndex = 0) {
  return {
    resultIndex,
    results: transcripts.map((t) => {
      const arr: any = [{ transcript: t.text, confidence: 0.9 }]
      arr.isFinal = t.isFinal
      return arr
    }),
  }
}

beforeEach(() => {
  delete (window as any).SpeechRecognition
  delete (window as any).webkitSpeechRecognition
  vi.useRealTimers()
})

describe('recognitionEngine: initRecognition', () => {
  it('returns false and reports an error when SpeechRecognition is unsupported', async () => {
    const engine = await loadEngine()
    const onError = vi.fn()
    engine.setVoiceCallbacks({ onError })

    const ok = engine.initRecognition()

    expect(ok).toBe(false)
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('not supported'))
  })

  it('configures the recognition instance when SpeechRecognition is supported', async () => {
    const instances = installFakeSR()
    const engine = await loadEngine()

    const ok = engine.initRecognition()

    expect(ok).toBe(true)
    expect(instances[0].continuous).toBe(true)
    expect(instances[0].interimResults).toBe(true)
  })
})

describe('recognitionEngine: wake word + command flow', () => {
  it('wakes on a wake word in a final transcript and extracts an inline command', async () => {
    const instances = installFakeSR()
    const engine = await loadEngine()
    const onWake = vi.fn()
    const onCommand = vi.fn()
    engine.setVoiceCallbacks({ onWake, onCommand })
    engine.initRecognition()

    instances[0].onresult!(
      fakeResultEvent([{ text: 'hey jarvis open the bom', isFinal: true }])
    )

    expect(onWake).toHaveBeenCalledTimes(1)
    expect(engine.getIsAwake()).toBe(true)
    expect(onCommand).toHaveBeenCalledWith('open the bom')
  })

  it('ignores a wake word that only appears in an interim (non-final) result', async () => {
    const instances = installFakeSR()
    const engine = await loadEngine()
    const onWake = vi.fn()
    engine.setVoiceCallbacks({ onWake })
    engine.initRecognition()

    instances[0].onresult!(
      fakeResultEvent([{ text: 'hey jarvis', isFinal: false }])
    )

    expect(onWake).not.toHaveBeenCalled()
    expect(engine.getIsAwake()).toBe(false)
  })

  it('routes a final transcript to onCommand once already awake', async () => {
    const instances = installFakeSR()
    const engine = await loadEngine()
    const onCommand = vi.fn()
    engine.setVoiceCallbacks({ onCommand })
    engine.initRecognition()
    engine.manualWake()

    instances[0].onresult!(
      fakeResultEvent([{ text: 'set the timer for five minutes', isFinal: true }])
    )

    expect(onCommand).toHaveBeenCalledWith('set the timer for five minutes')
  })

  it('manualSleep suppresses processing until a new wake word arrives', async () => {
    const instances = installFakeSR()
    const engine = await loadEngine()
    const onCommand = vi.fn()
    engine.setVoiceCallbacks({ onCommand })
    engine.initRecognition()
    engine.manualWake()
    engine.manualSleep()

    instances[0].onresult!(
      fakeResultEvent([{ text: 'random background chatter', isFinal: true }])
    )

    expect(onCommand).not.toHaveBeenCalled()
    expect(engine.getIsAwake()).toBe(false)
  })
})

describe('recognitionEngine: error handling', () => {
  it('reports a clear message and tears down the instance on "not-allowed"', async () => {
    const instances = installFakeSR()
    const engine = await loadEngine()
    const onError = vi.fn()
    engine.setVoiceCallbacks({ onError })
    engine.initRecognition()

    instances[0].onerror!({ error: 'not-allowed' })

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Microphone permission denied'))
    // startVoice() must re-init from scratch since `recognition` was nulled out.
    engine.startVoice()
    expect(instances).toHaveLength(2)
  })

  it('stopVoice detaches onend (no auto-restart) and resets awake/listening flags', async () => {
    const instances = installFakeSR()
    const engine = await loadEngine()
    engine.initRecognition()
    engine.manualWake()

    engine.stopVoice()

    expect(instances[0].onend).toBeNull()
    expect(instances[0].abort).toHaveBeenCalled()
    expect(engine.getIsAwake()).toBe(false)
    expect(engine.getIsListening()).toBe(false)
  })
})
