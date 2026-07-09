import { useCallback } from 'react'
import { useOpenRouter } from '../context/OpenRouterContext'
import { logEvent, summarizeAIExchange } from '../engine/eventLog'
import { callOllama, OLLAMA_PROVIDER, type OllamaMetrics } from '../config/ollama'

import { type ORModel } from '../context/OpenRouterContext'

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface RequestOptions {
  maxTokens?: number
  temperature?: number
  stream?: boolean
  onToken?: (token: string, full: string) => void
  module?: string
}

export interface AIProviderHandle {
  activeProvider: { name: string; color: string } | null
  activeProviderId: string | null
  activeModel: string | null
  apiKey: string | null
  isConnected: boolean
  makeRequest: (messages: Message[], systemPrompt?: string, options?: RequestOptions) => Promise<string>
  openGrid: () => void
  setModel: (modelId: string) => void
  models: ORModel[]
}

const OR_BASE = 'https://openrouter.ai/api/v1'

export function useAIProvider(): AIProviderHandle {
  const {
    apiKey,
    activeModelId,
    setModelId,
    logUsage,
    openSetup,
    models,
    activeProvider,
    ollamaModelId,
  } = useOpenRouter()

  const activeModelDef = models.find((m) => m.id === activeModelId) ?? null
  const isOllama = activeProvider === 'ollama'
  const isBoth = activeProvider === 'both'

  const makeRequest = useCallback(
    async (messages: Message[], systemPrompt?: string, options: RequestOptions = {}): Promise<string> => {
      // Local Ollama path — no key required, no cost logged.
      const runOllama = async (): Promise<string> => {
        if (!ollamaModelId) {
          openSetup()
          throw new Error('No Ollama model selected. Pull a model and pick it in setup.')
        }
        const promptText = messages.map((m) => m.content).join('\n')
        const captured: { metrics: OllamaMetrics | null } = { metrics: null }
        const text = await callOllama(ollamaModelId, messages, systemPrompt, {
          stream: options.stream !== false,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
          onToken: options.onToken,
          onMetrics: (m) => { captured.metrics = m },
        })
        // Native metrics give REAL token counts; fall back to the chars/4
        // estimate only when the final chunk didn't carry them.
        const metrics = captured.metrics
        const totalTokens = metrics
          ? (metrics.promptEvalCount ?? 0) + metrics.evalCount
          : Math.ceil((promptText.length + text.length) / 4)
        logEvent('AI_ANALYSIS_RUN', {
          ...summarizeAIExchange(promptText, text),
          tokens: totalTokens,
          ...(metrics ? { tokensPerSecond: Math.round(metrics.tokensPerSecond * 10) / 10 } : {}),
          model: `ollama/${ollamaModelId}`,
          module: options.module || 'global',
        })
        // Log a zero-cost usage entry so the dashboard reflects local activity.
        logUsage(`ollama/${ollamaModelId}`, 0, options.module || 'app')
        return text
      }

      const runOpenRouter = async (): Promise<string> => {
        if (!apiKey) {
          openSetup()
          throw new Error('No OpenRouter key configured. Please connect your key.')
        }

        const modelId = activeModelId
        const allMessages = [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          ...messages,
        ]
        const promptText = allMessages.map((m) => m.content).join('\n')

        // Estimated at ~4 chars/token; both directions are billed, so both
        // sides of the price sheet apply.
        const logExchange = (responseText: string) => {
          const modelDef = models.find((m) => m.id === modelId)
          if (modelDef) {
            const inTokens = Math.ceil(promptText.length / 4)
            const outTokens = Math.ceil(responseText.length / 4)
            const estCost =
              (inTokens / 1e6) * modelDef.inputPricePer1M +
              (outTokens / 1e6) * modelDef.outputPricePer1M
            logUsage(modelId, estCost, options.module || 'app')
          }
          logEvent('AI_ANALYSIS_RUN', {
            ...summarizeAIExchange(promptText, responseText),
            tokens: Math.ceil((promptText.length + responseText.length) / 4),
            model: modelId || 'unknown',
            module: options.module || 'global',
          })
        }

        const response = await fetch(`${OR_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://enginguity.app',
            'X-Title': 'ENGINGUITY',
          },
          body: JSON.stringify({
            model: modelId,
            messages: allMessages,
            max_tokens: options.maxTokens ?? 4000,
            temperature: options.temperature ?? 0.7,
            stream: options.stream !== false,
          }),
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({})) as Record<string, unknown>
          const errMsg = (err?.error as Record<string, unknown> | undefined)?.message as string
          throw new Error(errMsg ?? `OpenRouter error ${response.status}`)
        }

        // Streaming path (default)
        if (options.stream !== false) {
          const reader = response.body!.getReader()
          const decoder = new TextDecoder()
          let fullText = ''
          let streamDone = false

          while (!streamDone) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))

            for (const line of lines) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') { streamDone = true; break }
              try {
                const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }
                const token = parsed.choices?.[0]?.delta?.content ?? ''
                if (token) {
                  fullText += token
                  options.onToken?.(token, fullText)
                }
              } catch {
                // ignore partial JSON
              }
            }
          }

          logExchange(fullText)
          return fullText
        }

        // Non-streaming fallback
        const data = await response.json() as { choices: Array<{ message: { content: string } }> }
        const text = data.choices[0].message.content ?? ''
        logExchange(text)
        return text
      }

      if (isOllama) return runOllama()

      // 'both' prefers local Ollama and falls back to OpenRouter on any
      // Ollama failure (server down, model missing, generation error).
      // Note: if Ollama fails mid-stream, onToken restarts from the cloud
      // response — callers render `full`, so the text stays consistent.
      if (isBoth && ollamaModelId) {
        try {
          return await runOllama()
        } catch (e) {
          console.warn('Ollama request failed; falling back to OpenRouter:', e)
        }
      }
      return runOpenRouter()
    },
    [apiKey, activeModelId, models, logUsage, openSetup, isOllama, isBoth, ollamaModelId]
  )

  const cloudProvider = activeModelDef
    ? { name: activeModelDef.provider, color: activeModelDef.providerColor }
    : null
  const ollamaProviderShape = { name: OLLAMA_PROVIDER.name, color: OLLAMA_PROVIDER.providerColor }
  const preferOllama = isOllama || (isBoth && !!ollamaModelId)

  return {
    activeProvider: preferOllama ? ollamaProviderShape : cloudProvider,
    activeProviderId: preferOllama
      ? 'ollama'
      : activeModelDef?.provider.toLowerCase().replace(/[^a-z0-9]/g, '') ?? null,
    activeModel: preferOllama ? ollamaModelId : activeModelId,
    apiKey,
    isConnected: isOllama ? !!ollamaModelId : isBoth ? (!!ollamaModelId || !!apiKey) : !!apiKey,
    makeRequest,
    openGrid: openSetup,
    setModel: setModelId,
    models,
  }
}
