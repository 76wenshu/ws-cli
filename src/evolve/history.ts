// 进化历史系统 - 记录成长历程
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export interface EvolutionEvent {
  id: number
  type: 'preference' | 'feedback' | 'skill' | 'memory'
  title: string
  description: string
  timestamp: number
}

function getEvolveDir() {
  return path.join(os.homedir(), '.handsome-cli', 'evolve')
}

function getHistoryFile() {
  return path.join(getEvolveDir(), 'history.json')
}

// 加载历史
export async function loadHistory(): Promise<EvolutionEvent[]> {
  try {
    const data = await fs.readFile(getHistoryFile(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

// 保存历史
export async function saveHistory(history: EvolutionEvent[]): Promise<void> {
  await fs.mkdir(getEvolveDir(), { recursive: true })
  await fs.writeFile(getHistoryFile(), JSON.stringify(history, null, 2), 'utf-8')
}

// 添加进化事件
export async function addEvent(type: EvolutionEvent['type'], title: string, description: string): Promise<void> {
  const history = await loadHistory()

  history.push({
    id: history.length + 1,
    type,
    title,
    description: description.slice(0, 100),
    timestamp: Date.now()
  })

  // 只保留最近 100 条
  if (history.length > 100) {
    history.splice(0, history.length - 100)
  }

  await saveHistory(history)
}

// 获取成长值
export async function getGrowthScore(): Promise<number> {
  const history = await loadHistory()
  // 简单计分：每个事件 10 分
  return history.length * 10
}

// 格式化历史为可读字符串
export async function formatHistory(): Promise<string> {
  const history = await loadHistory()
  const score = await getGrowthScore()

  if (history.length === 0) {
    return `📊 进化历程\n\n成长值: ${score}\n\n暂无记录，开始对话来让我成长吧！`
  }

  let msg = `📊 进化历程\n\n🧬 成长值: ${score}\n\n`

  // 显示最近 5 条
  const recent = history.slice(-5).reverse()

  for (const event of recent) {
    const date = new Date(event.timestamp).toLocaleDateString('zh-CN')
    const icon = event.type === 'preference' ? '🎯' :
                 event.type === 'feedback' ? '💬' :
                 event.type === 'skill' ? '⚡' : '🧠'
    msg += `${icon} [${date}] ${event.title}\n`
  }

  if (history.length > 5) {
    msg += `\n...还有 ${history.length - 5} 条记录`
  }

  return msg
}