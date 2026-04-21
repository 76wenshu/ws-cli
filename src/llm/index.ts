import { createOpenAIProvider } from './openai'
import { LLMProvider } from './types'
import { Config } from '../config/schema'

export function createLLMProvider(config: Config): LLMProvider {
  const { api } = config

  switch (api.provider) {
    case 'openai':
      if (!api.openai) throw new Error('OpenAI 配置缺失')
      return createOpenAIProvider(api.openai)

    case 'siliconflow':
      if (!api.siliconflow) throw new Error('SiliconFlow 配置缺失')
      return createOpenAIProvider(api.siliconflow)

    case 'anthropic':
      if (!api.anthropic) throw new Error('Anthropic 配置缺失')
      return createOpenAIProvider({
        ...api.anthropic,
        base_url: api.anthropic.base_url || 'https://api.anthropic.com'
      })

    case 'custom':
      if (!api.custom) throw new Error('Custom 配置缺失')
      return createOpenAIProvider(api.custom)

    default:
      throw new Error(`未知的提供商: ${api.provider}`)
  }
}

export { LLMProvider, LLMResponse, Message } from './types'
