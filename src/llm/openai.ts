import { LLMProvider, LLMResponse, Message } from './types'

interface OpenAIConfig {
  api_key: string
  base_url: string
  model: string
}

export function createOpenAIProvider(config: OpenAIConfig): LLMProvider {
  return {
    name: 'OpenAI',

    async chat(messages: Message[], options = {}) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000) // 30秒超时

      try {
        const response = await fetch(`${config.base_url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.api_key}`
          },
          body: JSON.stringify({
            model: config.model,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens ?? 500
          }),
          signal: controller.signal
        })

        clearTimeout(timeout)

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`API 错误: ${response.status} - ${error}`)
        }

        const data = await response.json() as any
        return {
          content: data.choices[0]?.message?.content || '',
          usage: data.usage
        }
      } catch (error: any) {
        clearTimeout(timeout)
        if (error.name === 'AbortError') {
          throw new Error('请求超时，请稍后重试')
        }
        throw error
      }
    }
  }
}
