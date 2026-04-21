export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMResponse {
  content: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface LLMProvider {
  name: string
  chat(messages: Message[], options: {
    temperature?: number
    max_tokens?: number
  }): Promise<LLMResponse>
}
