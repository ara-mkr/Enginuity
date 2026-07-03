export interface Provider {
  id: string
  name: string
  label: string
  models: string[]
  docsUrl: string
  placeholder: string
  headerKey: string
  baseURL: string
  testEndpoint: string
  color: string
}

export const PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    label: 'Claude',
    models: ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'],
    docsUrl: 'https://console.anthropic.com/keys',
    placeholder: 'sk-ant-...',
    headerKey: 'x-api-key',
    baseURL: 'https://api.anthropic.com/v1',
    testEndpoint: '/models',
    color: '#c084fc',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    label: 'GPT',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    docsUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...',
    headerKey: 'Authorization',
    baseURL: 'https://api.openai.com/v1',
    testEndpoint: '/models',
    color: '#10b981',
  },
  {
    id: 'gemini',
    name: 'Google',
    label: 'Gemini',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    docsUrl: 'https://aistudio.google.com/apikey',
    placeholder: 'AIza...',
    headerKey: 'x-goog-api-key',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    testEndpoint: '/models',
    color: '#f59e0b',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    label: 'Mistral',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'open-mistral-7b'],
    docsUrl: 'https://console.mistral.ai/api-keys',
    placeholder: '...',
    headerKey: 'Authorization',
    baseURL: 'https://api.mistral.ai/v1',
    testEndpoint: '/models',
    color: '#f97316',
  },
]

export function providerById(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

// localStorage key helpers
export const keyFor = (id: string) => `enginguity_key_${id}`
export const modelFor = (id: string) => `enginguity_model_${id}`
export const ACTIVE_PROVIDER_KEY = 'enginguity_active_provider'
