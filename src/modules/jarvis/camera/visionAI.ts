/**
 * Vision AI helper — sends captured frames to OpenRouter or Ollama for analysis.
 */

import type { CapturedFrame } from './cameraEngine'

type DiagType = 'info' | 'success' | 'warn' | 'error'
const diag = (msg: string, type: DiagType = 'info') =>
  (window as any).jarvisDiag?.(msg, type)

export interface VisionResult {
  success: boolean
  analysis?: string
  noVision?: boolean
  message?: string
}

const VISION_CAPABLE_MODELS = [
  'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4-vision',
  'claude-3', 'claude-sonnet', 'claude-opus', 'claude-haiku',
  'gemini', 'grok-2-vision',
  'llava', 'bakllava', 'moondream', 'llava-phi3',
  'minicpm-v', 'qwen-vl', 'internvl', 'qwen2-vl',
]

function modelSupportsVision(model: string): boolean {
  return VISION_CAPABLE_MODELS.some((m) =>
    model.toLowerCase().includes(m.toLowerCase())
  )
}

export async function analyzeFrame(
  frame: CapturedFrame,
  prompt: string,
  apiKey: string,
  model?: string
): Promise<VisionResult> {
  const activeModel = model ||
    localStorage.getItem('enginguity_or_model') ||
    'openai/gpt-4o'

  diag(`visionAI: model=${activeModel}`, 'info')

  if (!modelSupportsVision(activeModel)) {
    diag(`${activeModel} may not support vision`, 'warn')
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://enginguity.app',
        'X-Title': 'ENGINGUITY Jarvis Vision',
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${frame.base64}`,
                  detail: 'auto',
                },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
        max_tokens: 350,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as {
        error?: { message?: string }
      }
      const errMsg = err.error?.message?.toLowerCase() || ''

      if (response.status === 400 || errMsg.includes('vision') || errMsg.includes('image')) {
        return {
          success: false,
          noVision: true,
          message:
            `${activeModel} does not support image analysis. ` +
            `Switch to GPT-4o, Claude, or Gemini for vision, sir. ` +
            `Or install a vision model in Ollama: ollama pull llava`,
        }
      }

      throw new Error(err.error?.message || `API error ${response.status}`)
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
    }
    const analysis = data.choices[0]?.message?.content || ''

    diag('Vision response received', 'success')
    return { success: true, analysis }
  } catch (err) {
    const e = err as Error
    diag(`Vision API error: ${e.message}`, 'error')
    return { success: false, message: e.message }
  }
}

export async function analyzeFrameOllama(
  frame: CapturedFrame,
  prompt: string
): Promise<VisionResult> {
  const model = localStorage.getItem('enginguity_ollama_model') || 'llava'

  const ollamaVisionModels = ['llava', 'bakllava', 'moondream', 'llava-phi3', 'minicpm-v', 'qwen2-vl']
  const isVisionModel = ollamaVisionModels.some((m) => model.toLowerCase().includes(m))

  if (!isVisionModel) {
    return {
      success: false,
      noVision: true,
      message: `${model} doesn't support vision. Install one: ollama pull llava`,
    }
  }

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        images: [frame.base64],
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    })

    const data = (await response.json()) as { response: string }
    return { success: true, analysis: data.response }
  } catch (err) {
    const e = err as Error
    return { success: false, message: e.message }
  }
}
