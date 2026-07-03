// Engineering-notation parsing and formatting for component values.
//
// Suffix convention (standard EE, case-sensitive where it matters):
//   T=1e12  G=1e9  M/meg/MEG=1e6  k/K=1e3  m=1e-3  u/µ=1e-6  n=1e-9  p=1e-12  f=1e-15
// 'M' always means mega here (never milli); 'm' always means milli. 'meg' in any
// case is accepted for SPICE compatibility. Trailing unit letters (Ω, F, H, V, A, Hz)
// are ignored so "4.7kΩ" and "100nF" both parse.

const SUFFIXES: Array<{ match: RegExp; mult: number }> = [
  { match: /^meg/i, mult: 1e6 },
  { match: /^T/, mult: 1e12 },
  { match: /^G/, mult: 1e9 },
  { match: /^M/, mult: 1e6 },
  { match: /^[kK]/, mult: 1e3 },
  { match: /^m/, mult: 1e-3 },
  { match: /^[uµ]/, mult: 1e-6 },
  { match: /^n/, mult: 1e-9 },
  { match: /^p/, mult: 1e-12 },
  { match: /^f/, mult: 1e-15 },
]

const UNIT_TAIL = /^(ohm[s]?|Ω|F|H|V|A|Hz|s)?$/i

/**
 * Parse a value like "4.7k", "100n", "2.2meg", "1M", "10uF", "3.3", "1e-6".
 * Returns null when the string is not a valid engineering-notation number.
 */
export function parseEngNotation(input: string): number | null {
  const raw = input.trim()
  if (!raw) return null

  const numMatch = raw.match(/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/)
  if (!numMatch) return null

  const base = parseFloat(numMatch[0])
  if (!Number.isFinite(base)) return null

  let rest = raw.slice(numMatch[0].length).trim()
  let mult = 1

  if (rest) {
    for (const { match, mult: m } of SUFFIXES) {
      const hit = rest.match(match)
      if (hit) {
        mult = m
        rest = rest.slice(hit[0].length)
        break
      }
    }
    if (!UNIT_TAIL.test(rest.trim())) return null
  }

  return base * mult
}

const FORMAT_STEPS: Array<{ mult: number; suffix: string }> = [
  { mult: 1e12, suffix: 'T' },
  { mult: 1e9, suffix: 'G' },
  { mult: 1e6, suffix: 'M' },
  { mult: 1e3, suffix: 'k' },
  { mult: 1, suffix: '' },
  { mult: 1e-3, suffix: 'm' },
  { mult: 1e-6, suffix: 'µ' },
  { mult: 1e-9, suffix: 'n' },
  { mult: 1e-12, suffix: 'p' },
  { mult: 1e-15, suffix: 'f' },
]

/** Format 4700 → "4.7k", 1e-7 → "100n". Keeps up to 4 significant digits. */
export function formatEngNotation(value: number, unit = ''): string {
  if (value === 0) return `0${unit ? ' ' + unit : ''}`
  if (!Number.isFinite(value)) return String(value)

  const abs = Math.abs(value)
  const step = FORMAT_STEPS.find((s) => abs >= s.mult) ?? FORMAT_STEPS[FORMAT_STEPS.length - 1]
  const scaled = value / step.mult
  // Up to 4 significant digits, strip trailing zeros
  const digits = Math.max(0, 4 - Math.floor(Math.log10(Math.abs(scaled))) - 1)
  const text = parseFloat(scaled.toFixed(digits)).toString()
  return `${text}${step.suffix}${unit ? ' ' + unit : ''}`
}

/** Tooltip copy explaining the suffix convention, shown on ParameterField. */
export const ENG_NOTATION_HINT =
  'k = kilo (1e3) · M / meg = mega (1e6) · m = milli (1e-3) · u = micro (1e-6) · n = nano (1e-9) · p = pico (1e-12)'
