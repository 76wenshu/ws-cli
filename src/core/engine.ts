import chalk from 'chalk'
import { loadFullMemory, saveFullMemory, loadHotMemory, saveHotMemory, updateIndex, FullMemory } from '../memory'
import { compressMessages, buildContext, MemoryBlock, Message } from '../memory/compressor'
import { createLLMProvider, Message as LLMMessage } from '../llm'
import { loadConfig } from '../config'
import { executePlugin, pluginManager } from '../plugins'
import { learnFromText, addFeedback, getFeedbackStats, formatHistory, addEvent, getPreferencePrompt, getProfilePrompt, learnProfileFromText, addReminder, loadReminders, completeReminder, deleteReminder, getUpcomingReminders, parseTimeString, formatReminderTime, detectEmotion, getWarmResponse, updateInteraction, checkNeedCare, checkTopicRecall, getConsecutiveDays, detectPromise, addPromise, getUnfulfilledPromises, markPromiseReminded, getEncouragement, getCareMessage, getCasualReply } from '../evolve'
import { addXp, recordPattern, getEvolutionPrompt, getEvolutionSummary, updatePersonality } from '../evolve'
import { exportData, importData, getSyncManager } from '../sync'
import { error as logError, info, warn, debug } from '../utils/logger'

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
    // 用户画像命令
    pattern: /^:profile|:画像/i,
    response: async (match, memory) => {
      const { getProfile, updateProfile, loadProfile } = await import('../evolve/profile')
      const args = match[1]?.trim().split(/\s+/) || []
      const subCmd = args[0]?.toLowerCase()

      // :profile - 查看画像
      if (!subCmd || subCmd === 'view' || subCmd === '查看') {
        const profile = await loadProfile()
        if (!profile.name) {
          return '我还不了解你，告诉我更多吧！\n用法：:profile set job 程序员'
        }
        let info = `【用户画像】\n名字: ${profile.name}`
        if (profile.job) info += `\n职业: ${profile.job}`
        if (profile.skills?.length) info += `\n技能: ${profile.skills.join(', ')}`
        if (profile.interests?.length) info += `\n兴趣: ${profile.interests.join(', ')}`
        if (profile.location) info += `\n位置: ${profile.location}`
        if (profile.goals?.length) info += `\n目标: ${profile.goals.join(', ')}`
        if (profile.bio) info += `\n简介: ${profile.bio}`
        return info
      }

      // :profile set <字段> <值>
      if (subCmd === 'set' || subCmd === '设置') {
        const field = args[1]
        const value = args.slice(2).join(' ')
        if (!field || !value) {
          return '用法：:profile set <字段> <值>\n示例：:profile set job 程序员'
        }

        const validFields = ['job', 'skills', 'interests', 'location', 'goals', 'bio']
        if (!validFields.includes(field)) {
          return `可用字段: ${validFields.join(', ')}`
        }

        let updateValue: any = value
        if (field === 'skills' || field === 'interests' || field === 'goals') {
          updateValue = value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
        }

        await updateProfile({ [field]: updateValue })
        return `✅ 已更新 ${field}: ${value}`
      }

      return `用户画像命令：
• :profile - 查看画像
• :profile set job 程序员 - 设置职业
• :profile set skills 编程,设计 - 设置技能
• :profile set interests 音乐,阅读 - 设置兴趣
• :profile set goals 学习AI - 设置目标`
    }
  },
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
    // 提醒命令
    pattern: /^:remind|:提醒/i,
    response: async (match) => {
      const args = (match[1] || '').trim().split(/\s+/)
      const subCmd = args[0]?.toLowerCase()

      // :remind - 查看提醒
      if (!subCmd) {
        const reminders = await getUpcomingReminders(5)
        if (reminders.length === 0) {
          return '📝 当前没有提醒'
        }
        let msg = '📝 即将到来的提醒：\n'
        for (const r of reminders) {
          msg += `\n• ${r.content}\n  ${formatReminderTime(r.time)}`
        }
        return msg
      }

      // :remind add <内容> <时间>
      if (subCmd === 'add' || subCmd === '添加') {
        // 查找时间参数
        let content = ''
        let time: number | null = null

        // 尝试解析时间
        for (let i = 1; i < args.length; i++) {
          const parsed = parseTimeString(args[i])
          if (parsed) {
            time = parsed
            content = args.slice(1, i).join(' ')
            break
          }
        }

        // 如果没找到时间参数，整条作为内容，设置为1小时后
        if (!time && args.length > 1) {
          content = args.slice(1).join(' ')
          time = Date.now() + 60 * 60 * 1000 // 默认1小时后
        }

        if (!time || !content) {
          return `用法：
:remind add <内容> <时间>
时间格式：HH:mm、MM-DD HH:mm、30分钟后、2小时后、1天后`
        }

        const reminder = await addReminder(content, time)
        return `✅ 已设置提醒：${content}\n${formatReminderTime(reminder.time)}`
      }

      // :remind list - 列表
      if (subCmd === 'list' || subCmd === '列表') {
        const reminders = await loadReminders()
        const pending = reminders.filter(r => !r.done)
        if (pending.length === 0) {
          return '📝 没有待处理提醒'
        }
        let msg = '📝 待处理提醒：\n'
        for (const r of pending) {
          msg += `\n• ${r.content}\n  ${formatReminderTime(r.time)}\n  ID: ${r.id.slice(0, 8)}`
        }
        return msg
      }

      // :remind done <ID> - 完成
      if (subCmd === 'done' || subCmd === '完成') {
        const id = args[1]
        if (!id) {
          return '用法：:remind done <ID>'
        }
        const success = await completeReminder(id)
        return success ? '✅ 提醒已完成' : '❌ 找不到该提醒'
      }

      // :remind del <ID> - 删除
      if (subCmd === 'del' || subCmd === 'delete' || subCmd === '删除') {
        const id = args[1]
        if (!id) {
          return '用法：:remind del <ID>'
        }
        const success = await deleteReminder(id)
        return success ? '✅ 提醒已删除' : '❌ 找不到该提醒'
      }

      return `提醒命令：
:remind - 查看即将到来的提醒
:remind add <内容> <时间> - 添加提醒
:remind list - 查看所有提醒
:remind done <ID> - 标记完成
:remind del <ID> - 删除提醒

时间格式示例：
  14:30      今天14:30
  05-22 09:00 5月22日早上9点
  30分钟后    30分钟后
  2小时后    2小时后
  1天后      明天此时`
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
    // 导出数据
    pattern: /^:export(?:\s+(.+))?$/i,
    response: async (match) => {
      const outputPath = match[1]?.trim()
      const result = await exportData({ outputPath: outputPath || undefined })
      if (result.success) {
        return `✅ 数据已导出到：${result.filePath}\n请将此文件复制到其他设备后使用 :import 导入`
      }
      return `❌ 导出失败：${result.error}`
    }
  },
  {
    // 导入数据
    pattern: /^:import(?:\s+(.+))?$/i,
    response: async (match) => {
      const zipPath = match[1]?.trim()
      if (!zipPath) {
        return '用法：:import <备份文件路径>\n示例：:import ./handsome-backup.zip'
      }
      const result = await importData(zipPath)
      if (result.success) {
        return `✅ ${result.message}\n请重新启动 HandSome 使数据生效`
      }
      return `❌ 导入失败：${result.error}`
    }
  },
  {
    // 同步命令
    pattern: /^:sync(?:\s+(.*))?$/i,
    response: async (match) => {
      const syncManager = getSyncManager()
      const args = match[1]?.trim().split(/\s+/) || []
      const subCmd = args[0]?.toLowerCase()

      // :sync - 启动/查看同步状态
      if (!subCmd) {
        const state = syncManager.getState()
        if (state.enabled) {
          const deviceList = state.devices.map(d => `• ${d.name} (${d.ip})`).join('\n')
          return `📡 同步已开启\n服务器: ${state.serverRunning ? '✅ 运行中' : '❌ 停止'}\n设备: ${state.devices.length} 个\n${deviceList || '未发现设备'}`
        } else {
          return `📡 同步未开启\n使用 :sync on 开启局域网同步`
        }
      }

      // :sync on - 开启同步
      if (subCmd === 'on') {
        await syncManager.start()
        return '📡 同步已开启，正在扫描设备...'
      }

      // :sync off - 关闭同步
      if (subCmd === 'off') {
        syncManager.stop()
        return '📡 同步已关闭'
      }

      // :sync list - 查看设备列表
      if (subCmd === 'list') {
        const devices = syncManager.getDevices()
        if (devices.length === 0) {
          return '未发现附近设备，请确保对方已开启同步'
        }
        const list = devices.map((d, i) => `${i + 1}. ${d.name} (${d.ip})`).join('\n')
        return `发现 ${devices.length} 个设备：\n${list}`
      }

      // :sync push <序号> - 推送到设备
      if (subCmd === 'push') {
        const idx = parseInt(args[1]) - 1
        const devices = syncManager.getDevices()
        if (isNaN(idx) || idx < 0 || idx >= devices.length) {
          return '用法：:sync push <设备序号>\n使用 :sync list 查看设备列表'
        }
        const result = await syncManager.push(devices[idx])
        return result.success ? `✅ ${result.message}` : `❌ ${result.message}`
      }

      // :sync pull <序号> - 从设备拉取
      if (subCmd === 'pull') {
        const idx = parseInt(args[1]) - 1
        const devices = syncManager.getDevices()
        if (isNaN(idx) || idx < 0 || idx >= devices.length) {
          return '用法：:sync pull <设备序号>\n使用 :sync list 查看设备列表'
        }
        const result = await syncManager.pull(devices[idx])
        return result.success ? `✅ ${result.message}\n请重启使数据生效` : `❌ ${result.message}`
      }

      return `同步命令：
• :sync - 查看状态
• :sync on - 开启同步
• :sync off - 关闭同步
• :sync list - 查看设备
• :sync push <序号> - 推送数据到设备
• :sync pull <序号> - 从设备拉取数据`
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

  // 添加用户画像
  const profilePrompt = await getProfilePrompt()
  if (profilePrompt) {
    systemPrompt += profilePrompt
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
    const pluginResult = await executePlugin(input, { memory })
    if (pluginResult) {
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
        if (result === null) continue

        memory.hot.push(
          { role: 'user', content: input, timestamp: Date.now() },
          { role: 'assistant', content: result, timestamp: Date.now() }
        )
        memory.stats.total++
        await saveHotMemory(memory.hot)
        await checkCompress(memory)
        await saveFullMemory(memory)
        return result
      }
    }
  } catch (error: any) {
    const errMsg = error.message || String(error)
    console.error(chalk.red(`[处理出错] ${errMsg}`))
    await logError('processInput', `插件/规则执行出错: ${errMsg}`, { input: input.slice(0, 50), stack: error.stack })
    return `抱歉，我遇到了点问题: ${errMsg}`
  }

  // 2. 无规则匹配，调用 LLM
  try {
    // 伙伴功能：检测用户是否做出承诺
    const promiseText = detectPromise(input)
    if (promiseText) {
      await addPromise(promiseText)
    }

    // 检查是否需要主动关心
    const careMessage = await checkNeedCare()

    // 检查是否应该提起上次话题
    const recallMessage = await checkTopicRecall()

    // 检测用户情绪
    const emotion = detectEmotion(input)

    const response = await callLLM(input, memory)

    // 在响应前添加主动关心或回忆
    let finalResponse = response
    if (careMessage) {
      finalResponse = careMessage + '\n\n' + response
    } else if (recallMessage) {
      finalResponse = recallMessage + '\n\n' + response
    }

    // 偶尔添加伙伴式的随意回复
    const casualReply = getCasualReply()
    if (casualReply && !finalResponse.includes(casualReply)) {
      finalResponse = finalResponse + '\n\n' + casualReply
    }

    // 如果检测到负面情绪，添加温暖回应
    if (emotion && emotion !== 'happy') {
      const warmResponse = getWarmResponse(emotion)
      finalResponse = finalResponse + '\n\n' + warmResponse
    }

    // 保存对话
    memory.hot.push(
      { role: 'user', content: input, timestamp: Date.now() },
      { role: 'assistant', content: finalResponse, timestamp: Date.now() }
    )
    memory.stats.total++

    await saveHotMemory(memory.hot)
    await checkCompress(memory)
    await saveFullMemory(memory)

    // 学习用户输入中的偏好
    await learnFromText(input)
    await learnProfileFromText(input)
    await addEvent('memory', '新对话', `用户: ${input.slice(0, 20)}`)

    // 更新交互记录（伙伴功能）
    await updateInteraction(input.slice(0, 30), emotion || undefined)

    // 记录交互模式并增加经验
    await recordPattern(input, finalResponse)

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
      await addXp('analysis', 2)
    }

    return finalResponse
  } catch (error: any) {
    const errMsg = error.message || String(error)
    console.error(chalk.red(`[处理出错] ${errMsg}`))
    await logError('processInput', `LLM处理出错: ${errMsg}`, { input: input.slice(0, 100), stack: error.stack })
    return `抱歉，我遇到了点问题: ${errMsg}`
  }
}
export async function resetLLM() {
  llmProvider = null
}
