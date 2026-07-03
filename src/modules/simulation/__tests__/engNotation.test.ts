import { describe, expect, it } from 'vitest'
import { formatEngNotation, parseEngNotation } from '../core/engNotation'

describe('parseEngNotation', () => {
  // Acceptance criterion #14 — the canonical suffix set, incl. the M/meg gotcha.
  it('parses 4.7k as 4700', () => expect(parseEngNotation('4.7k')).toBe(4700))
  it('parses 100n as 1e-7', () => expect(parseEngNotation('100n')).toBeCloseTo(1e-7, 12))
  it('parses 2.2meg as 2.2e6', () => expect(parseEngNotation('2.2meg')).toBeCloseTo(2.2e6))
  it('parses 10u as 1e-5', () => expect(parseEngNotation('10u')).toBeCloseTo(1e-5, 10))
  it('parses 1M as mega, never milli', () => expect(parseEngNotation('1M')).toBe(1e6))
  it('parses 1m as milli', () => expect(parseEngNotation('1m')).toBe(1e-3))
  it('parses MEG case-insensitively', () => expect(parseEngNotation('1MEG')).toBe(1e6))

  it('parses plain and scientific numbers', () => {
    expect(parseEngNotation('330')).toBe(330)
    expect(parseEngNotation('3.3')).toBe(3.3)
    expect(parseEngNotation('1e-6')).toBe(1e-6)
    expect(parseEngNotation('-5')).toBe(-5)
    expect(parseEngNotation('.5')).toBe(0.5)
  })

  it('parses remaining suffixes', () => {
    expect(parseEngNotation('1T')).toBe(1e12)
    expect(parseEngNotation('1G')).toBe(1e9)
    expect(parseEngNotation('1K')).toBe(1e3)
    expect(parseEngNotation('1p')).toBe(1e-12)
    expect(parseEngNotation('1f')).toBe(1e-15)
    expect(parseEngNotation('1µ')).toBe(1e-6)
  })

  it('tolerates unit tails', () => {
    expect(parseEngNotation('4.7kΩ')).toBe(4700)
    expect(parseEngNotation('100nF')).toBeCloseTo(1e-7, 12)
    expect(parseEngNotation('10 uH')).toBeCloseTo(1e-5, 10)
    expect(parseEngNotation('5V')).toBe(5)
    expect(parseEngNotation('2A')).toBe(2)
  })

  it('rejects garbage', () => {
    expect(parseEngNotation('')).toBeNull()
    expect(parseEngNotation('abc')).toBeNull()
    expect(parseEngNotation('4.7x')).toBeNull()
    expect(parseEngNotation('k47')).toBeNull()
  })
})

describe('formatEngNotation', () => {
  it('round-trips common values', () => {
    expect(formatEngNotation(4700)).toBe('4.7k')
    expect(formatEngNotation(1e-7)).toBe('100n')
    expect(formatEngNotation(2.2e6)).toBe('2.2M')
    expect(formatEngNotation(0.001)).toBe('1m')
    expect(formatEngNotation(5)).toBe('5')
    expect(formatEngNotation(0)).toBe('0')
  })

  it('appends units when given', () => {
    expect(formatEngNotation(4700, 'Ω')).toBe('4.7k Ω')
    expect(formatEngNotation(1e-6, 'F')).toBe('1µ F')
  })
})
