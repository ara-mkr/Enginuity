const OPENROUTER_MODELS = [
  // ANTHROPIC
  { id: 'anthropic/claude-opus-4-5', name: 'Claude Opus 4.5', provider: 'Anthropic', providerColor: '#cc785c', tier: 'flagship', contextK: 200, inputPricePer1M: 15, outputPricePer1M: 75, tags: ['reasoning', 'coding', 'analysis'], recommended: true },
  { id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'Anthropic', providerColor: '#cc785c', tier: 'balanced', contextK: 200, inputPricePer1M: 3, outputPricePer1M: 15, tags: ['coding', 'analysis', 'fast'] },
  { id: 'anthropic/claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'Anthropic', providerColor: '#cc785c', tier: 'fast', contextK: 200, inputPricePer1M: 0.8, outputPricePer1M: 4, tags: ['fast', 'cheap'] },

  // OPENAI
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', providerColor: '#10a37f', tier: 'flagship', contextK: 128, inputPricePer1M: 5, outputPricePer1M: 15, tags: ['vision', 'coding', 'reasoning'] },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', providerColor: '#10a37f', tier: 'fast', contextK: 128, inputPricePer1M: 0.15, outputPricePer1M: 0.6, tags: ['fast', 'cheap'] },
  { id: 'openai/o3-mini', name: 'o3 Mini', provider: 'OpenAI', providerColor: '#10a37f', tier: 'reasoning', contextK: 200, inputPricePer1M: 1.1, outputPricePer1M: 4.4, tags: ['reasoning', 'math', 'coding'] },
  { id: 'openai/o1', name: 'o1', provider: 'OpenAI', providerColor: '#10a37f', tier: 'reasoning', contextK: 200, inputPricePer1M: 15, outputPricePer1M: 60, tags: ['reasoning', 'math', 'science'] },
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', providerColor: '#10a37f', tier: 'balanced', contextK: 128, inputPricePer1M: 10, outputPricePer1M: 30, tags: ['coding', 'analysis'] },

  // GOOGLE
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'Google', providerColor: '#7a9ab8', tier: 'fast', contextK: 1000, inputPricePer1M: 0.1, outputPricePer1M: 0.4, tags: ['fast', 'long-context', 'cheap'], recommended: true },
  { id: 'google/gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Flash Thinking', provider: 'Google', providerColor: '#7a9ab8', tier: 'reasoning', contextK: 1000, inputPricePer1M: 0.15, outputPricePer1M: 3.5, tags: ['reasoning', 'long-context'] },
  { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google', providerColor: '#7a9ab8', tier: 'flagship', contextK: 2000, inputPricePer1M: 3.5, outputPricePer1M: 10.5, tags: ['long-context', 'analysis', 'vision'] },
  { id: 'google/gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google', providerColor: '#7a9ab8', tier: 'fast', contextK: 1000, inputPricePer1M: 0.075, outputPricePer1M: 0.3, tags: ['fast', 'cheap', 'long-context'] },

  // XAI
  { id: 'x-ai/grok-3-beta', name: 'Grok 3 Beta', provider: 'xAI', providerColor: '#e5e5e5', tier: 'flagship', contextK: 131, inputPricePer1M: 3, outputPricePer1M: 15, tags: ['reasoning', 'coding', 'realtime'] },
  { id: 'x-ai/grok-3-mini-beta', name: 'Grok 3 Mini', provider: 'xAI', providerColor: '#e5e5e5', tier: 'reasoning', contextK: 131, inputPricePer1M: 0.3, outputPricePer1M: 0.5, tags: ['reasoning', 'fast', 'cheap'] },
  { id: 'x-ai/grok-2-vision-1212', name: 'Grok 2 Vision', provider: 'xAI', providerColor: '#e5e5e5', tier: 'balanced', contextK: 32, inputPricePer1M: 2, outputPricePer1M: 10, tags: ['vision'] },

  // DEEPSEEK
  { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek V3', provider: 'DeepSeek', providerColor: '#7a85b8', tier: 'flagship', contextK: 64, inputPricePer1M: 0.27, outputPricePer1M: 1.1, tags: ['coding', 'analysis', 'cheap'], recommended: true },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', providerColor: '#7a85b8', tier: 'reasoning', contextK: 64, inputPricePer1M: 0.55, outputPricePer1M: 2.19, tags: ['reasoning', 'math', 'cheap'] },
  { id: 'deepseek/deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B', provider: 'DeepSeek', providerColor: '#7a85b8', tier: 'reasoning', contextK: 128, inputPricePer1M: 0.23, outputPricePer1M: 0.69, tags: ['reasoning', 'cheap'] },

  // META LLAMA
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'Meta', providerColor: '#0866ff', tier: 'flagship', contextK: 128, inputPricePer1M: 0.59, outputPricePer1M: 0.79, tags: ['open-source', 'coding', 'fast'] },
  { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', provider: 'Meta', providerColor: '#0866ff', tier: 'flagship', contextK: 128, inputPricePer1M: 2.7, outputPricePer1M: 2.7, tags: ['open-source', 'flagship'] },
  { id: 'meta-llama/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', provider: 'Meta', providerColor: '#0866ff', tier: 'fast', contextK: 128, inputPricePer1M: 0.055, outputPricePer1M: 0.055, tags: ['open-source', 'fast', 'cheap'], free: true },

  // MISTRAL
  { id: 'mistralai/mistral-large-2411', name: 'Mistral Large 2411', provider: 'Mistral', providerColor: '#ff7000', tier: 'flagship', contextK: 128, inputPricePer1M: 2, outputPricePer1M: 6, tags: ['coding', 'multilingual'] },
  { id: 'mistralai/mistral-small-3.1-24b-instruct', name: 'Mistral Small 3.1', provider: 'Mistral', providerColor: '#ff7000', tier: 'fast', contextK: 128, inputPricePer1M: 0.1, outputPricePer1M: 0.3, tags: ['fast', 'cheap', 'vision'] },
  { id: 'mistralai/codestral-2501', name: 'Codestral 2501', provider: 'Mistral', providerColor: '#ff7000', tier: 'code', contextK: 256, inputPricePer1M: 0.3, outputPricePer1M: 0.9, tags: ['coding', 'completion'] },
  { id: 'mistralai/mixtral-8x22b-instruct', name: 'Mixtral 8x22B', provider: 'Mistral', providerColor: '#ff7000', tier: 'balanced', contextK: 64, inputPricePer1M: 0.9, outputPricePer1M: 0.9, tags: ['open-source', 'coding'], free: true },

  // QWEN
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', provider: 'Alibaba', providerColor: '#b07e50', tier: 'flagship', contextK: 128, inputPricePer1M: 0.35, outputPricePer1M: 0.4, tags: ['coding', 'multilingual', 'cheap'] },
  { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', provider: 'Alibaba', providerColor: '#b07e50', tier: 'code', contextK: 128, inputPricePer1M: 0.07, outputPricePer1M: 0.16, tags: ['coding', 'cheap'] },
  { id: 'qwen/qwq-32b', name: 'QwQ 32B', provider: 'Alibaba', providerColor: '#b07e50', tier: 'reasoning', contextK: 32, inputPricePer1M: 0.12, outputPricePer1M: 0.18, tags: ['reasoning', 'math', 'cheap'] },

  // MICROSOFT PHI
  { id: 'microsoft/phi-4', name: 'Phi-4', provider: 'Microsoft', providerColor: '#0078d4', tier: 'fast', contextK: 16, inputPricePer1M: 0.07, outputPricePer1M: 0.14, tags: ['fast', 'cheap', 'coding'], free: true },
  { id: 'microsoft/phi-4-multimodal-instruct', name: 'Phi-4 Multimodal', provider: 'Microsoft', providerColor: '#0078d4', tier: 'fast', contextK: 128, inputPricePer1M: 0.05, outputPricePer1M: 0.1, tags: ['vision', 'fast', 'cheap'] },

  // COHERE
  { id: 'cohere/command-r-plus-08-2024', name: 'Command R+', provider: 'Cohere', providerColor: '#39594d', tier: 'flagship', contextK: 128, inputPricePer1M: 2.5, outputPricePer1M: 10, tags: ['rag', 'analysis'] },
  { id: 'cohere/command-a-03-2025', name: 'Command A', provider: 'Cohere', providerColor: '#39594d', tier: 'flagship', contextK: 256, inputPricePer1M: 2.5, outputPricePer1M: 10, tags: ['agents', 'tools', 'rag'] },

  // NVIDIA
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B', provider: 'NVIDIA', providerColor: '#76b900', tier: 'flagship', contextK: 128, inputPricePer1M: 0.35, outputPricePer1M: 0.4, tags: ['coding', 'reasoning', 'fast'] },

  // PERPLEXITY
  { id: 'perplexity/llama-3.1-sonar-huge-128k-online', name: 'Sonar Huge (Web)', provider: 'Perplexity', providerColor: '#20808d', tier: 'flagship', contextK: 128, inputPricePer1M: 5, outputPricePer1M: 5, tags: ['web-search', 'realtime', 'citations'] },
  { id: 'perplexity/llama-3.1-sonar-large-128k-online', name: 'Sonar Large (Web)', provider: 'Perplexity', providerColor: '#20808d', tier: 'balanced', contextK: 128, inputPricePer1M: 1, outputPricePer1M: 1, tags: ['web-search', 'realtime', 'cheap'] },
]

export default OPENROUTER_MODELS

export const OR_DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5'
export const OR_KEY_STORAGE = 'enginguity_or_key'
export const OR_MODEL_STORAGE = 'enginguity_or_model'
export const OR_USAGE_STORAGE = 'enginguity_or_usage'

// Module-specific recommended models
export const MODULE_RECOMMENDATIONS = {
  'parameter-playground': ['deepseek/deepseek-chat-v3-0324', 'anthropic/claude-sonnet-4-5', 'qwen/qwen-2.5-coder-32b-instruct'],
  'cad-viewer':          ['anthropic/claude-sonnet-4-5', 'openai/gpt-4o', 'google/gemini-1.5-pro'],
  'circuit-sim':         ['deepseek/deepseek-chat-v3-0324', 'anthropic/claude-opus-4-5', 'qwen/qwen-2.5-coder-32b-instruct'],
  'datasheet':           ['anthropic/claude-sonnet-4-5', 'openai/gpt-4o', 'google/gemini-1.5-flash'],
  'formula-lab':         ['deepseek/deepseek-r1', 'openai/o3-mini', 'qwen/qwq-32b'],
  'bom':                 ['anthropic/claude-sonnet-4-5', 'openai/gpt-4o-mini', 'deepseek/deepseek-chat-v3-0324'],
  'asset-generator':     ['anthropic/claude-sonnet-4-5', 'openai/gpt-4o', 'google/gemini-1.5-flash'],
}

export const TIER_COLORS = {
  flagship:  '#00c8ff',
  balanced:  '#78909c',
  fast:      '#00e676',
  reasoning: '#9485b8',
  code:      '#b09470',
}
