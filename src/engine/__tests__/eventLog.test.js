import { beforeEach, describe, expect, it, vi } from 'vitest'
import { logEvent, summarizeAIExchange } from '../eventLog'

const KEY = 'enginguity_event_log'

describe('logEvent', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('appends events with type, timestamp, and module', () => {
    logEvent('TEST_EVENT', { module: 'unit-test', detail: 42 })
    const log = JSON.parse(localStorage.getItem(KEY))
    expect(log).toHaveLength(1)
    expect(log[0].type).toBe('TEST_EVENT')
    expect(log[0].module).toBe('unit-test')
    expect(log[0].data.detail).toBe(42)
  })

  it('never throws when localStorage.setItem hits quota', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(() => logEvent('TEST_EVENT', { module: 'unit-test' })).not.toThrow()
    spy.mockRestore()
  })

  it('recovers from a corrupted stored log', () => {
    localStorage.setItem(KEY, '{not json!!')
    expect(() => logEvent('TEST_EVENT', { module: 'unit-test' })).not.toThrow()
    const log = JSON.parse(localStorage.getItem(KEY))
    expect(log).toHaveLength(1)
  })

  it('drops oldest events to stay under the byte cap', () => {
    const bigPayload = 'x'.repeat(10_000)
    for (let i = 0; i < 150; i++) {
      logEvent('BULK_EVENT', { module: 'unit-test', i, bigPayload })
    }
    const serialized = localStorage.getItem(KEY)
    expect(serialized.length).toBeLessThanOrEqual(1_000_000)
    const log = JSON.parse(serialized)
    // Newest event survived; oldest were shed.
    expect(log[log.length - 1].data.i).toBe(149)
    expect(log[0].data.i).toBeGreaterThan(0)
  })
})

describe('summarizeAIExchange', () => {
  it('reports lengths and a stable short hash, never bodies', () => {
    const s = summarizeAIExchange('what is ohms law', 'V = I × R')
    expect(s.promptLength).toBe(16)
    expect(s.responseLength).toBe(9)
    expect(s.responseHash).toMatch(/^[0-9a-f]{8}$/)
    expect(JSON.stringify(s)).not.toContain('ohms')
    expect(s.responseHash).toBe(summarizeAIExchange('', 'V = I × R').responseHash)
  })
})
