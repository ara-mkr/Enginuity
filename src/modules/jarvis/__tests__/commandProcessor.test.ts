import { describe, expect, it } from 'vitest'
import { matchProviderCommand } from '../commandProcessor'

describe('matchProviderCommand', () => {
  it.each([
    'switch to local',
    'switch to the local model',
    'switch over to ollama',
    'use ollama',
    'use the local model',
    'use offline mode',
    'go local',
    'run locally',
    'local mode please',
    // Speech-to-text manglings of "Ollama"
    'switch to o llama',
    'use oh llama',
  ])('"%s" → ollama', (t) => {
    expect(matchProviderCommand(t)).toBe('ollama')
  })

  it.each([
    'switch to cloud',
    'switch back to the cloud',
    'switch to openrouter',
    'switch to open router',
    'use the cloud',
    'go back to the cloud',
    'cloud mode',
  ])('"%s" → openrouter', (t) => {
    expect(matchProviderCommand(t)).toBe('openrouter')
  })

  it.each(['switch to hybrid', 'hybrid mode', 'use both providers', 'switch to hybrid mode'])(
    '"%s" → both',
    (t) => {
      expect(matchProviderCommand(t)).toBe('both')
    },
  )

  it.each([
    // Engineering phrases that contain the keywords but are NOT provider commands
    'what is a local oscillator',
    'show me a picture of a llama',
    'simulate a cloud chamber sensor',
    'search for local suppliers',
    'what does hybrid vehicle regen braking look like',
    'calculate the offline voltage drop',
  ])('"%s" → null (no false positive)', (t) => {
    expect(matchProviderCommand(t)).toBeNull()
  })
})
