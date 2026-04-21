import chalk from 'chalk'
import { loadFullMemory, saveFullMemory, loadHotMemory, saveHotMemory, updateIndex, FullMemory } from '../memory'
import { compressMessages, buildContext, MemoryBlock, Message } from '../memory/compressor'
import { createLLMProvider, Message as LLMMessage } from '../llm'
import { loadConfig } from '../config'
import { executePlugin, pluginManager } from '../plugins'
import { learnFromText, addFeedback, getFeedbackStats, formatHistory, addEvent, getPreferencePrompt } from '../evolve'
import { addXp, recordPattern, getEvolutionPrompt, getEvolutionSummary, updatePersonality } from '../evolve'

const CONFIG = {
  HOT_SIZE: 20,
  COMPRESS_THRESHOLD: 1000,
}

let llmProvider: ReturnType<typeof createLLMProvider> | null = null

async function getLLMProvider() {
  if (!llmProvider) {
    const config = await loadConfig()
    llmProvider = createLLMProvider(config)
  }
  return llmProvider
}

// 预设回复规则（仅命令类，快速响应不走LLM）
// 核心原则：只保留命令规则（以:开头），其他交互全部走LLM
// response 返回 null 表示不匹配，继续下一个规则
const rules: Array<{ pattern: RegExp; response: (match: string[], memory: FullMemory) => string | Promise<string> | null }> = [
  {
    pattern: /^:who/i,
    response: (_, memory) => {
      if (memory.user.name) {
        return `你是 ${memory.user.name}，我们已经是朋友了！`
      }
      return '我还不知道你的名字呢，告诉我吧！'
    }
  },
  {
    pattern: /^:forget/i,
    response: async (_, memory) => {
      memory.user.name = undefined
      memory.user.preferences = {}
      memory.hot = []
      memory.warm = []
      memory.cold = []
      memory.stats = { total: 0, compressed: 0 }
      await saveFullMemory(memory)
      return '好的，我已经忘记了所有记忆。我们重新开始吧！'
    }
  },
  {
    pattern: /^:memory|:记忆/i,
    response: async (_, memory) => {
      const lines = [
        `短期记忆: ${memory.hot.length} 条`,
        `中期记忆: ${memory.warm.length} 个摘要`,
        `长期记忆: ${memory.cold.length} 个摘要`,
        `总对话数: ${memory.stats.total}`
      ]
      return lines.join('\n')
    }
  },
  {
    pattern: /^:search (.+)/i,
    response: async (match, memory) => {
      const { searchByKeyword } = await import('../memory/compressor')
      const query = match[1]
      const allBlocks = [...memory.warm, ...memory.cold]
      const results = searchByKeyword(allBlocks, query)

      if (results.length === 0) {
        return `没有找到关于"${query}"的记忆`
      }

      let response = `找到 ${results.length} 条相关记忆：\n`
      for (const block of results.slice(0, 3)) {
        response += `\n• ${block.content.slice(0, 100)}`
      }
      return response
    }
  },
  {
    pattern: /^:plugins$/i,
    response: async () => {
      const plugins = pluginManager.list()
      let msg = '📦 已加载插件:\n\n'
      for (const p of plugins) {
        msg += `• ${p.name} - ${p.description}\n`
        msg += `  触发: ${p.triggers.join(', ')}\n\n`
      }
      return msg
    }
  },
  {
    // 反馈命令
    pattern: /^:good|:好|:棒/i,
    response: async (_, memory) => {
      // 获取最近的用户输入作为上下文
      const lastUserMsg = memory.hot.filter(m => m.role === 'user').pop()
      await addFeedback('good', lastUserMsg?.content || '', '用户手动反馈')
      await addEvent('feedback', '获得表扬', '用户说好/棒')
      return '谢谢你的认可！我会继续努力的 💪'
    }
  },
  {
    pattern: /^:bad|:不好|:差/i,
    response: async (_, memory) => {
      const lastUserMsg = memory.hot.filter(m => m.role === 'user').pop()
      await addFeedback('bad', lastUserMsg?.content || '', '用户手动反馈')
      await addEvent('feedback', '收到改进建议', '用户说不好')
      return '明白了，我会记住这个反馈，下次会改进的 📝'
    }
  },
  {
    // 进化状态
    pattern: /^:evolve|:进化|:成长/i,
    response: async () => {
      const summary = await getEvolutionSummary()
      const history = await formatHistory()
      return summary + '\n\n' + history
    }
  },
  {
    // 退出命令 - 返回特殊标记
    pattern: /^:q$|^:quit$|^quit$|^exit$/i,
    response: () => '__EXIT__'
  }
]

// 构建发送给 LLM 的消息
async function buildLLMMessages(input: string, memory: FullMemory): Promise<LLMMessage[]> {
  const config = await loadConfig()

  // 构建上下文
  const contextInfo = buildContext({
    hot: memory.hot,
    warm: memory.warm,
    cold: memory.cold
  })

  let systemPrompt = config.model.system_prompt
  if (contextInfo) {
    systemPrompt += `\n\n【用户记忆】\n${contextInfo}`
  }

  // 添加用户信息
  if (memory.user.name) {
    systemPrompt += `\n用户名字: ${memory.user.name}`
  }

  // 添加偏好提示
  const prefPrompt = await getPreferencePrompt()
  if (prefPrompt) {
    systemPrompt += prefPrompt
  }

  // 添加进化状态提示
  const evoPrompt = await getEvolutionPrompt()
  if (evoPrompt) {
    systemPrompt += evoPrompt
  }

  // 强制添加进化能力说明（不管有没有状态）
  systemPrompt += `\n\n【自我进化能力】
- 我会随着对话不断学习和成长
- 我会记住你告诉我的重要信息
- 你可以对我说":evolve"查看我的成长状态
- 使用":good"或":bad"给我反馈
- 我会根据反馈调整回复风格`

  // 构建消息
  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
  ]

  // 添加最近的 hot 对话作为上下文
  const recentHot = memory.hot.slice(-10)
  for (const msg of recentHot) {
    messages.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    })
  }

  messages.push({ role: 'user', content: input })

  return messages
}

// 调用 LLM（带重试机制）
async function callLLM(input: string, memory: FullMemory): Promise<string> {
  const maxRetries = 3
  const baseDelay = 1000 // 1秒初始延迟

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const provider = await getLLMProvider()
      const config = await loadConfig()

      // 显示思考中状态
      if (attempt === 1) {
        console.log(chalk.gray('  [思考中...]'))
      } else {
        console.log(chalk.yellow(`  [重试 ${attempt}/${maxRetries}...]`))
      }

      const messages = await buildLLMMessages(input, memory)
      const response = await provider.chat(messages, {
        temperature: config.model.temperature,
        max_tokens: config.model.max_tokens
      })

      return response.content
    } catch (error: any) {
      const errorMsg = error.message || '未知错误'

      // 最后一次尝试失败，返回错误提示给用户
      if (attempt === maxRetries) {
        console.error(chalk.red(`  [LLM 调用失败] ${errorMsg}`))
        return `抱歉，我遇到了一些问题: ${errorMsg}\n请稍后再试，或者检查网络连接。`
      }

      // 重试前等待（指数退避）
      const delay = baseDelay * attempt
      console.warn(chalk.yellow(`  [调用失败: ${errorMsg}, ${delay/1000}秒后重试...]`))
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  return '抱歉，我暂时无法回答。请稍后再试。'
}

// 自动压缩检查
async function checkCompress(memory: FullMemory): Promise<void> {
  const total = memory.stats.total

  // 达到压缩阈值
  if (total > 0 && total % CONFIG.COMPRESS_THRESHOLD === 0) {
    console.log(chalk.gray('  [整理记忆中...]'))

    // 压缩 hot 到 warm
    const newBlocks = compressMessages(memory.hot, 5)

    for (const block of newBlocks) {
      // 检查是否已存在相似记忆
      const exists = memory.warm.some(w =>
        w.content.slice(0, 50) === block.content.slice(0, 50)
      )
      if (!exists) {
        memory.warm.push(block)
        await updateIndex(block)
      }
    }

    // 保留最重要的
    memory.warm = memory.warm
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 50)

    memory.stats.compressed += newBlocks.length

    console.log(chalk.gray(`  [已压缩 ${newBlocks.length} 条记忆]`))
  }
}

// 处理用户输入
export async function processInput(input: string, memory: FullMemory): Promise<string> {
  try {
    // 0. 尝试执行插件
    const pluginResult = await executePlugin(input, { memory })
    if (pluginResult) {
      // 保存到记忆
      memory.hot.push(
        { role: 'user', content: input, timestamp: Date.now() },
        { role: 'assistant', content: pluginResult.content, timestamp: Date.now() }
      )
      memory.stats.total++
      await saveHotMemory(memory.hot)
      await saveFullMemory(memory)
      return pluginResult.content
    }

    // 1. 尝试匹配规则
    for (const rule of rules) {
      const match = input.match(rule.pattern)
      if (match) {
        const result = await rule.response(match, memory)

        // 如果返回 null，继续下一个规则
        if (result === null) {
          continue
      }

      // 规则匹配后保存到 hot
      memory.hot.push(
        { role: 'user', content: input, timestamp: Date.now() },
        { role: 'assistant', content: result, timestamp: Date.now() }
      )
      memory.stats.total++

      // 自动保存和压缩
      await saveHotMemory(memory.hot)
      await checkCompress(memory)
      await saveFullMemory(memory)

      return result
    }
  }

  // 2. 无规则匹配，调用 LLM
  const response = await callLLM(input, memory)

  // 保存对话
  memory.hot.push(
    { role: 'user', content: input, timestamp: Date.now() },
    { role: 'assistant', content: response, timestamp: Date.now() }
  )
  memory.stats.total++

  // 自动保存和压缩
  await saveHotMemory(memory.hot)
  await checkCompress(memory)
  await saveFullMemory(memory)

  // 学习用户输入中的偏好
  await learnFromText(input)
  await addEvent('memory', '新对话', `用户: ${input.slice(0, 20)}`)

  // 记录交互模式并增加经验（进化）
  await recordPattern(input, response)

  // 简单判断应该给什么技能增加经验
  const inputLower = input.toLowerCase()
  if (input.match(/^[\d\s+\-*/().]+$/) || input.includes('计算')) {
    await addXp('calc', 5)
  } else if (input.includes('时间') || input.includes('日期')) {
    await addXp('time', 5)
  } else if (input.includes('搜索') || input.includes('查一下')) {
    await addXp('search', 10)
  } else if (input.includes('代码') || input.includes('编程')) {
    await addXp('code', 15)
  } else {
    // 默认对话也给经验
    await addXp('analysis', 2)
  }

  return response
  } catch (error: any) {
    console.error(chalk.red(`[处理出错] ${error.message}`))
    return `抱歉，我遇到了问题: ${error.message}`
  }
}

// 重置 LLM 连接
export async function resetLLM() {
  llmProvider = null
}
