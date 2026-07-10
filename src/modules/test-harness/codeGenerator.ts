import type { TestCase, Framework } from './types'

function formatPyArgs(inputs: Record<string, unknown>): string {
  return Object.values(inputs).map(v => JSON.stringify(v)).join(', ')
}

function formatJsArgs(inputs: Record<string, unknown>): string {
  return Object.values(inputs).map(v => JSON.stringify(v)).join(', ')
}

function toPascalCase(s: string): string {
  return s.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase())
}

function toSnakeCase(s: string): string {
  return s.replace(/[^a-z0-9]/gi, '_').toLowerCase().replace(/_+/g, '_').slice(0, 40)
}

export function generatePytestFile(funcName: string, testCases: TestCase[], framework: Framework): string {
  const className = toPascalCase(funcName)

  const tests = testCases.map(tc => {
    const args = formatPyArgs(tc.inputs)
    const testName = `test_${tc.id}_${toSnakeCase(tc.description)}`
    if (tc.expected_behavior === 'throw_error') {
      return `    def ${testName}(self):
        """${tc.description}"""
        with pytest.raises(Exception):
            ${funcName}(${args})`
    }
    return `    def ${testName}(self):
        """${tc.description}"""
        result = ${funcName}(${args})
        assert result == ${JSON.stringify(tc.expected_output)}, f"Expected ${JSON.stringify(tc.expected_output)}, got {result}"`
  }).join('\n\n')

  if (framework === 'unittest') {
    return `import unittest
from your_module import ${funcName}


class Test${className}(unittest.TestCase):

${tests}


if __name__ == '__main__':
    unittest.main()
`
  }

  return `import pytest
from your_module import ${funcName}


class Test${className}:

${tests}
`
}

export function generateJestFile(funcName: string, testCases: TestCase[], framework: Framework): string {
  const tests = testCases.map(tc => {
    const args = formatJsArgs(tc.inputs)
    if (tc.expected_behavior === 'throw_error') {
      return `  test('${tc.description}', () => {
    expect(() => ${funcName}(${args})).toThrow()
  })`
    }
    return `  test('${tc.description}', () => {
    expect(${funcName}(${args})).toEqual(${JSON.stringify(tc.expected_output)})
  })`
  }).join('\n\n')

  if (framework === 'vitest') {
    return `import { describe, test, expect } from 'vitest'
import { ${funcName} } from './your_module'

describe('${funcName}', () => {
${tests}
})
`
  }

  if (framework === 'mocha') {
    return `const { expect } = require('chai')
const { ${funcName} } = require('./your_module')

describe('${funcName}', function() {
${tests}
})
`
  }

  return `const { ${funcName} } = require('./your_module')

describe('${funcName}', () => {
${tests}
})
`
}
