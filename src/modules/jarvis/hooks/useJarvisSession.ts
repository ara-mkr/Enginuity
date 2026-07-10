import { useState, useRef, useCallback, useEffect } from 'react'
import type { JarvisIntent } from '../JarvisModule'

const COST_PER_TOKEN: Record<string, { input: number; output: number }> = {
  'deepseek/deepseek-chat-v3-0324': { input: 0.00000027, output: 0.0000011 },
  'anthropic/claude-sonnet-4-5': { input: 0.000003, output: 0.000015 },
  'openai/gpt-4o': { input: 0.000005, output: 0.000015 },
  'perplexity/llama-3.1-sonar-large-128k-online': { input: 0.000001, output: 0.000001 },
}

const COST_STORAGE_KEY = 'enginguity_jarvis_cost_today'
const DAILY_LIMIT_STORAGE_KEY = 'enginguity_jarvis_daily_limit'

interface UseJarvisSessionParams {
  dailyLimit: number
  speak: (text: string, intent?: JarvisIntent) => void
}

/**
 * Owns session-scoped bookkeeping: elapsed session time, the running
 * transcript of commands issued this session, and the daily $ budget
 * guard (running cost + pause state) backed by localStorage.
 */
export function useJarvisSession({ dailyLimit, speak }: UseJarvisSessionParams) {
  const [sessionStartTime] = useState(() => Date.now())
  const [sessionCommands, setSessionCommands] = useState<string[]>([])

  const [runningCost, setRunningCost] = useState(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    try {
      const saved = localStorage.getItem(COST_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.date === todayStr) {
          return parsed.totalUSD || 0
        }
      }
    } catch { /* corrupted/missing stored value — fall back to default */ }
    return 0
  })

  const [isPaused, setIsPaused] = useState(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    try {
      const saved = localStorage.getItem(COST_STORAGE_KEY)
      const limitStr = localStorage.getItem(DAILY_LIMIT_STORAGE_KEY) || '2.00'
      const limit = parseFloat(limitStr)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.date === todayStr && parsed.totalUSD >= limit) {
          return true
        }
      }
    } catch { /* corrupted/missing stored value — fall back to default */ }
    return false
  })

  const dailyLimitRef = useRef(dailyLimit)
  useEffect(() => {
    dailyLimitRef.current = dailyLimit
  }, [dailyLimit])

  // Sync daily budget limit and unpause logic
  useEffect(() => {
    localStorage.setItem(DAILY_LIMIT_STORAGE_KEY, String(dailyLimit))
    if (runningCost < dailyLimit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- unpausing as a side effect of the limit or running cost changing
      setIsPaused(false)
    } else {
      setIsPaused(true)
    }
  }, [dailyLimit, runningCost])

  const trackUsage = useCallback((modelId: string, promptText: string, responseText: string) => {
    const key = modelId || 'openai/gpt-4o'
    const rates = COST_PER_TOKEN[key] || COST_PER_TOKEN['openai/gpt-4o']

    const inputTokens = Math.ceil(promptText.length / 4)
    const outputTokens = Math.ceil(responseText.length / 4)
    const cost = (inputTokens * rates.input) + (outputTokens * rates.output)

    const todayStr = new Date().toISOString().split('T')[0]
    let costToday = { date: todayStr, totalUSD: 0, calls: 0 }
    try {
      const saved = localStorage.getItem(COST_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.date === todayStr) {
          costToday = parsed
        }
      }
    } catch { /* corrupted/missing stored value — fall back to default */ }

    const oldPct = costToday.totalUSD / dailyLimitRef.current
    costToday.totalUSD += cost
    costToday.calls += 1
    localStorage.setItem(COST_STORAGE_KEY, JSON.stringify(costToday))

    setRunningCost(costToday.totalUSD)

    const newPct = costToday.totalUSD / dailyLimitRef.current
    if (oldPct < 0.8 && newPct >= 0.8 && newPct < 1.0) {
      speak("A note, sir — eighty percent of today's budget has been consumed.")
    }
    if (oldPct < 1.0 && newPct >= 1.0) {
      speak("Daily budget reached, sir. I'm paused until tomorrow or until you increase the limit in settings.")
      setIsPaused(true)
    }
  }, [speak])

  return {
    sessionStartTime,
    sessionCommands,
    setSessionCommands,
    runningCost,
    isPaused,
    trackUsage,
  }
}
