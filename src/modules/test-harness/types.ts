export type Language = 'python' | 'javascript' | 'typescript'
export type Framework = 'pytest' | 'unittest' | 'jest' | 'mocha' | 'vitest'
export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type ExpectedBehavior = 'return_value' | 'throw_error' | 'return_null' | 'return_empty'
export type TestStatus = 'idle' | 'passed' | 'failed' | 'error'

export interface ParamType {
  name: string
  type: 'number' | 'string' | 'boolean' | 'array' | 'object' | 'any'
}

export interface ParsedSignature {
  functionName: string
  params: ParamType[]
  returnType: string
}

export interface TestCase {
  id: string
  description: string
  category: string
  inputs: Record<string, unknown>
  expected_output: unknown
  expected_behavior: ExpectedBehavior
  reasoning: string
  priority: Priority
}

export interface TestResult {
  id: string
  passed: boolean
  actual?: unknown
  expected?: unknown
  error?: string
  runtime: number
}

export interface RunSummary {
  total: number
  passed: number
  failed: number
  errors: number
  totalRuntime: number
}
