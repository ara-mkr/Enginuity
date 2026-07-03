import type { ParsedSignature, ParamType } from './types'

export function parseSignature(code: string, language: string): ParsedSignature | null {
  try {
    if (language === 'python') {
      const match = code.match(/def\s+(\w+)\s*\(([^)]*)\)/)
      if (!match) return null
      const name = match[1]
      const rawParams = match[2].trim()
      const params: ParamType[] = rawParams
        ? rawParams.split(',').map(p => {
            const cleaned = p.trim().split(':')[0].split('=')[0].trim()
            return { name: cleaned, type: 'any' as const }
          }).filter(p => p.name && p.name !== 'self')
        : []
      return { functionName: name, params, returnType: 'unknown' }
    }

    if (language === 'javascript' || language === 'typescript') {
      const match = code.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*=\s*(?:async\s*)?\()\s*([^)]*)\)/)
      if (!match) return null
      const name = match[1] ?? match[2] ?? match[3]
      const rawParams = (match[4] ?? '').trim()
      const params: ParamType[] = rawParams
        ? rawParams.split(',').map(p => {
            const cleaned = p.trim().split(':')[0].split('=')[0].replace(/[{}[\]]/g, '').trim()
            return { name: cleaned || 'arg', type: 'any' as const }
          }).filter(p => p.name)
        : []
      return { functionName: name, params, returnType: 'unknown' }
    }
  } catch {
    // ignore parse errors
  }
  return null
}
