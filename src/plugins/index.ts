import { Plugin, PluginContext, PluginResult } from './types'
import { loadConfig, type BuiltinPlugin, type ExternalPlugin } from '../config'
import { createLLMProvider } from '../llm'

// 内置插件实现 - 返回 null 表示不匹配
const BUILTIN_HANDLERS: Record<BuiltinPlugin, (input: string) => string | null> = {
  calc: (input: string) => {
    // 支持: 计算1+1, 1+1, 1+1=, 100*5, 2^10 等
    // 智能识别纯数学表达式
    let expr = input
      .replace(/^(计算|算一下|算|等于)\s*/i, '')
      .replace(/下/, '')  // 处理"计算下"的情况
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/=/g, '')  // 移除末尾的 =
      .replace(/\^/g, '**')  // 支持幂运算
      .trim()
    if (!expr || !/^[\d\s+\-*/().eE]+$/.test(expr)) return null
    try {
      const result = new Function('return ' + expr)()
      if (typeof result === 'number' && !isNaN(result)) {
        return `${expr.replace(/\*\*/g, '^').replace(/e\+?/gi, 'e')} = ${result}`
      }
      return null
    } catch { return null }
  },
  time: (input: string) => {
    const now = new Date()
    // 排除天气相关查询，让 LLM 处理
    if (input.includes('天气')) return null
    if (input.includes('几点') || input === '时间' || input === '时间几点') return now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    if (input.includes('日期') || input === '今天') {
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      return `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${weekdays[now.getDay()]}`
    }
    return null
  },
  todo: (input: string) => {
    // todo 和 notes 需要异步，暂时返回 null 让 LLM 处理
    if (input.includes('任务') || input.includes('待办')) return null
    return null
  },
  notes: (input: string) => {
    if (input.includes('笔记') || input.includes('记录')) return null
    return null
  }
}

// 插件管理器
class PluginManagerImpl {
  private plugins: Map<string, Plugin> = new Map()

  async loadFromConfig(): Promise<void> {
    const config = await loadConfig()

    // 加载内置插件
    const builtin = config.plugins?.builtin || ['calc', 'time', 'todo', 'notes']
    for (const name of builtin) {
      const handler = BUILTIN_HANDLERS[name]
      if (handler) {
        const triggers: Record<string, string[]> = {
          calc: ['计算', '等于', '+', '-', '*', '/'],
          time: ['时间', '几点', '日期', '今天'],
          todo: ['任务', '待办', 'todo', '要做'],
          notes: ['笔记', '记录', '记个', '写下']
        }
        this.plugins.set(name, {
          name,
          version: '1.0.0',
          description: `${name} 插件`,
          triggers: triggers[name] || [name],
          examples: [],
          handle: async (input) => {
            const result = await handler(input)
            if (result === null) return { content: '', type: 'text' }
            return { content: result, type: 'text' }
          }
        })
      }
    }

    // 加载外部插件（LLM 驱动）
    const external = config.plugins?.external || []
    for (const ext of external) {
      if (!ext.enabled || !ext.prompt) continue

      this.plugins.set(ext.name, {
        name: ext.name,
        version: '1.0.0',
        description: `${ext.name} 外部插件`,
        triggers: [ext.trigger],
        examples: [],
        handle: async (input) => {
          const { createLLMProvider } = await import('../llm')
          const cfg = await loadConfig()
          const provider = createLLMProvider(cfg)
          const userInput = input.replace(new RegExp(ext.trigger, 'i'), '').trim()
          const resp = await provider.chat([{ role: 'user', content: `${ext.prompt}\n\n用户: ${userInput}` }], {})
          return { content: resp.content, type: 'text' }
        }
      })
    }

    console.log(`[Plugin] 已加载 ${this.plugins.size} 个插件`)
  }

  register(plugin: Plugin): void { this.plugins.set(plugin.name, plugin) }

  find(input: string): Plugin | null {
    const lower = input.toLowerCase()
    for (const p of this.plugins.values()) {
      for (const t of p.triggers) {
        if (lower.includes(t.toLowerCase())) return p
      }
    }
    return null
  }

  list(): Plugin[] { return Array.from(this.plugins.values()) }
}

export const pluginManager = new PluginManagerImpl()

export async function registerBuiltinPlugins(): Promise<void> {
  await pluginManager.loadFromConfig()
}

export async function executePlugin(input: string, context: PluginContext): Promise<PluginResult | null> {
  const plugin = pluginManager.find(input)
  if (!plugin) return null
  try { return await plugin.handle(input, context) } catch (e: any) { return { content: `错误: ${e.message}`, type: 'error' } }
}
