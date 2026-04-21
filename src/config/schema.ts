export interface ApiConfig {
  provider: 'openai' | 'siliconflow' | 'anthropic' | 'custom'
  openai?: { api_key: string; base_url: string; model: string }
  siliconflow?: { api_key: string; base_url: string; model: string }
  anthropic?: { api_key: string; base_url: string; model: string }
  custom?: { api_key: string; base_url: string; model: string }
}

export interface ModelConfig {
  temperature: number
  max_tokens: number
  system_prompt: string
}

// ============ 插件配置 ============

// 内置基础插件（无需外部 API）
export type BuiltinPlugin = 'calc' | 'time' | 'todo' | 'notes'

// 外部插件（需要配置 LLM prompt）
export interface ExternalPlugin {
  name: string
  trigger: string
  enabled: boolean
  prompt?: string
}

export interface Config {
  name: string
  api: ApiConfig
  model: ModelConfig
  plugins: {
    builtin: BuiltinPlugin[]
    external: ExternalPlugin[]
  }
}

export const defaultConfig: Config = {
  name: 'HandSome',
  api: {
    provider: 'custom',
    custom: { api_key: '', base_url: '', model: '' },
    siliconflow: { api_key: '', base_url: '', model: '' },
    openai: { api_key: '', base_url: '', model: '' }
  },
  model: { temperature: 0.7, max_tokens: 500, system_prompt: '你是 HandSome，简洁友好。' },
  plugins: { builtin: ['calc', 'time', 'todo', 'notes'], external: [] }
}