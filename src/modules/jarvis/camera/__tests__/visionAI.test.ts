import { describe, it, expect, beforeEach, vi } from 'vitest'
import { analyzeFrame, analyzeFrameOllama } from '../visionAI'
import type { CapturedFrame } from '../cameraEngine'

const frame = { base64: 'ZmFrZQ==' } as CapturedFrame

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('visionAI: analyzeFrame (OpenRouter)', () => {
  it('returns the analysis text on a successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'a red gear' } }] }),
    }))

    const result = await analyzeFrame(frame, 'what is this?', 'sk-key', 'openai/gpt-4o')

    expect(result).toEqual({ success: true, analysis: 'a red gear' })
  })

  it('returns noVision:true with a helpful message when the model rejects images (400)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'this model does not support image input' } }),
    }))

    const result = await analyzeFrame(frame, 'what is this?', 'sk-key', 'openai/gpt-3.5-turbo')

    expect(result.success).toBe(false)
    expect(result.noVision).toBe(true)
    expect(result.message).toContain('does not support image analysis')
  })

  it('surfaces a generic API error message for non-vision failures (e.g. 401)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    }))

    const result = await analyzeFrame(frame, 'what is this?', 'bad-key')

    expect(result).toEqual({ success: false, message: 'Invalid API key' })
  })

  it('catches network/thrown errors (e.g. timeout) and returns success:false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('The operation was aborted')))

    const result = await analyzeFrame(frame, 'what is this?', 'sk-key')

    expect(result).toEqual({ success: false, message: 'The operation was aborted' })
  })

  it('falls back to the stored model, then the hardcoded default, when none is passed', async () => {
    localStorage.setItem('enginguity_or_model', 'anthropic/claude-3-haiku')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await analyzeFrame(frame, 'what is this?', 'sk-key')

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.model).toBe('anthropic/claude-3-haiku')
  })
})

describe('visionAI: analyzeFrameOllama', () => {
  it('short-circuits with noVision:true for a non-vision local model, without calling fetch', async () => {
    localStorage.setItem('enginguity_ollama_model', 'llama3')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await analyzeFrameOllama(frame, 'describe this')

    expect(result.success).toBe(false)
    expect(result.noVision).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns the analysis from a vision-capable local model', async () => {
    localStorage.setItem('enginguity_ollama_model', 'llava')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: 'a circuit board' }),
    }))

    const result = await analyzeFrameOllama(frame, 'describe this')

    expect(result).toEqual({ success: true, analysis: 'a circuit board' })
  })
})
