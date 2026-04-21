// 插件类型定义
export interface PluginContext {
  userId?: string
  sessionId?: string
  memory?: any
}

export interface PluginResult {
  content: string
  type: 'text' | 'image' | 'error' | 'success'
  data?: any
}

export interface Plugin {
  name: string
  version: string
  description: string
  triggers: string[]
  examples: string[]
  handle(input: string, context: PluginContext): Promise<PluginResult>
}