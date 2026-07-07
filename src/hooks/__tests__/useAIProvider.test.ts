import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockUseOpenRouter = vi.fn()
const mockCallOllama = vi.fn()
const mockCallCustomProvider = vi.fn()
const mockLogEvent = vi.fn()

vi.mock('../../context/OpenRouterContext', () => ({
  useOpenRouter: () => mockUseOpenRouter(),
}))
vi.mock('../../config/ollama', () => ({
  callOllama: (...args: unknown[]) => mockCallOllama(...args),
  OLLAMA_PROVIDER: { name: 'Ollama', providerColor: '#94a5ba' },
}))
vi.mock('../../config/customProviders', () => ({
  callCustomProvider: (...args: unknown[]) => mockCallCustomProvider(...args),
  CUSTOM_PROVIDER_COLOR: '#b09470',
}))
vi.mock('../../engine/eventLog', () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
  summarizeAIExchange: (promptText: string, responseText: string) => ({
    promptLength: (promptText || '').length,
    responseLength: (responseText || '').length,
    responseHash: 'testhash',
  }),
}))

const { useAIProvider } = await import('../useAIProvider')

const baseCtx = {
  apiKey: null as string | null,
  activeModelId: 'openai/gpt-4o',
  setModelId: vi.fn(),
  logUsage: vi.fn(),
  openSetup: vi.fn(),
  models: [{ id: 'openai/gpt-4o', provider: 'OpenAI', providerColor: '#fff', outputPricePer1M: 10 }],
  activeProvider: 'openrouter',
  ollamaModelId: null as string | null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('useAIProvider: connection state', () => {
  it('reports isConnected:false and no active model when no OpenRouter key is set', () => {
    mockUseOpenRouter.mockReturnValue({ ...baseCtx, apiKey: null })
    const { result } = renderHook(() => useAIProvider())

    expect(result.current.isConnected).toBe(false)
    expect(result.current.apiKey).toBeNull()
  })

  it('reports isConnected:true and routes activeProvider/activeModel through Ollama fields when on the ollama provider', () => {
    mockUseOpenRouter.mockReturnValue({
      ...baseCtx,
      activeProvider: 'ollama',
      ollamaModelId: 'llama3',
    })
    const { result } = renderHook(() => useAIProvider())

    expect(result.current.isConnected).toBe(true)
    expect(result.current.activeModel).toBe('llama3')
    expect(result.current.activeProviderId).toBe('ollama')
  })
})

describe('useAIProvider: makeRequest', () => {
  it('throws and opens setup instead of calling fetch when no OpenRouter key is configured', async () => {
    mockUseOpenRouter.mockReturnValue({ ...baseCtx, apiKey: null })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useAIProvider())

    await expect(result.current.makeRequest([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      /No OpenRouter key configured/
    )
    expect(baseCtx.openSetup).toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws and opens setup instead of calling callOllama when on the ollama provider with no model selected', async () => {
    mockUseOpenRouter.mockReturnValue({ ...baseCtx, activeProvider: 'ollama', ollamaModelId: null })
    const { result } = renderHook(() => useAIProvider())

    await expect(result.current.makeRequest([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      /No Ollama model selected/
    )
    expect(mockCallOllama).not.toHaveBeenCalled()
  })

  it('routes to callOllama (not fetch) and logs a zero-cost usage entry on the ollama provider', async () => {
    mockUseOpenRouter.mockReturnValue({ ...baseCtx, activeProvider: 'ollama', ollamaModelId: 'llama3' })
    mockCallOllama.mockResolvedValue('a local response')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useAIProvider())

    const text = await result.current.makeRequest([{ role: 'user', content: 'hi' }])

    expect(text).toBe('a local response')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(baseCtx.logUsage).toHaveBeenCalledWith('ollama/llama3', 0, 'app')
  })

  it('surfaces the OpenRouter error message when the API responds non-ok', async () => {
    mockUseOpenRouter.mockReturnValue({ ...baseCtx, apiKey: 'sk-key' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    }))
    const { result } = renderHook(() => useAIProvider())

    await expect(result.current.makeRequest([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      'Invalid API key'
    )
  })
})

describe('useAIProvider: custom provider', () => {
  const customConfig = {
    id: 'c1',
    label: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiKey: 'nvapi-test',
    model: 'deepseek-ai/deepseek-r1',
    createdAt: 1,
  }
  const customCtx = {
    ...baseCtx,
    activeProvider: 'custom',
    customProviders: [customConfig],
    activeCustomProviderId: 'c1',
  }

  it('throws a clear no-provider-configured error (not a crash) when custom is active but empty', async () => {
    mockUseOpenRouter.mockReturnValue({
      ...baseCtx,
      activeProvider: 'custom',
      customProviders: [],
      activeCustomProviderId: null,
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useAIProvider())

    expect(result.current.isConnected).toBe(false)
    await expect(result.current.makeRequest([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      /No custom provider configured/
    )
    expect(baseCtx.openSetup).toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockCallCustomProvider).not.toHaveBeenCalled()
  })

  it('asks for the key again when the session-stored key is gone', async () => {
    mockUseOpenRouter.mockReturnValue({
      ...customCtx,
      customProviders: [{ ...customConfig, apiKey: '' }],
    })
    const { result } = renderHook(() => useAIProvider())

    expect(result.current.isConnected).toBe(false)
    await expect(result.current.makeRequest([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      /No API key for "NVIDIA NIM"/
    )
    expect(mockCallCustomProvider).not.toHaveBeenCalled()
  })

  it('routes through callCustomProvider and logs a zero-cost usage entry', async () => {
    mockUseOpenRouter.mockReturnValue(customCtx)
    mockCallCustomProvider.mockResolvedValue('a custom response')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useAIProvider())

    const text = await result.current.makeRequest([{ role: 'user', content: 'hi' }])

    expect(text).toBe('a custom response')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mockCallCustomProvider).toHaveBeenCalledWith(
      customConfig,
      [{ role: 'user', content: 'hi' }],
      undefined,
      expect.objectContaining({ stream: true }),
    )
    expect(baseCtx.logUsage).toHaveBeenCalledWith('custom/deepseek-ai/deepseek-r1', 0, 'app')
  })

  it('exposes the custom label/model as the active provider shape', () => {
    mockUseOpenRouter.mockReturnValue(customCtx)
    const { result } = renderHook(() => useAIProvider())

    expect(result.current.isConnected).toBe(true)
    expect(result.current.activeProviderId).toBe('custom')
    expect(result.current.activeModel).toBe('deepseek-ai/deepseek-r1')
    expect(result.current.activeProvider).toEqual({ name: 'NVIDIA NIM', color: '#b09470' })
  })
})
