// 主动关心机制模块
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export interface InteractionRecord {
  lastTime: number        // 上次交互时间
  lastTopic?: string      // 上次话题
  lastMood?: string       // 上次情绪
  consecutiveDays: number // 连续对话天数
  streakStart: number     // 连续对话开始时间
}

export interface PromiseRecord {
  id: string
  content: string
  created: number
  reminded: boolean
}

// 关心配置
const CONFIG = {
  INACTIVE_HOURS: 8,      // 超过8小时没对话发送关心
  STRETCH_WARNING: 2,     // 连续工作2小时提醒休息
  TOPIC_RECALL_CHANCE: 0.3, // 30%概率主动提起上次话题
}

function getEvolveDir() {
  return path.join(os.homedir(), '.handsome-cli', 'evolve')
}

function getInteractionFile() {
  return path.join(getEvolveDir(), 'interaction.json')
}

function getPromisesFile() {
  return path.join(getEvolveDir(), 'promises.json')
}

// 加载交互记录
export async function loadInteraction(): Promise<InteractionRecord> {
  try {
    const data = await fs.readFile(getInteractionFile(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return {
      lastTime: Date.now(),
      consecutiveDays: 0,
      streakStart: Date.now()
    }
  }
}

// 保存交互记录
export async function saveInteraction(record: InteractionRecord): Promise<void> {
  await fs.mkdir(getEvolveDir(), { recursive: true })
  await fs.writeFile(getInteractionFile(), JSON.stringify(record, null, 2), 'utf-8')
}

// 更新交互记录
export async function updateInteraction(topic?: string, mood?: string): Promise<void> {
  const record = await loadInteraction()
  const now = Date.now()
  const lastTime = record.lastTime

  // 检查是否是同一天
  const lastDate = new Date(lastTime)
  const nowDate = new Date(now)
  const isSameDay = lastDate.toDateString() === nowDate.toDateString()

  // 检查是否是连续日期
  const daysDiff = Math.floor((now - lastTime) / (24 * 60 * 60 * 1000))

  if (isSameDay) {
    // 同一天，更新话题和情绪
  } else if (daysDiff === 1) {
    // 连续第二天，增加连续天数
    record.consecutiveDays++
  } else {
    // 中断了，重置连续天数
    record.consecutiveDays = 1
    record.streakStart = now
  }

  record.lastTime = now
  if (topic) record.lastTopic = topic
  if (mood) record.lastMood = mood

  await saveInteraction(record)
}

// 检查是否需要主动关心
export async function checkNeedCare(): Promise<string | null> {
  const record = await loadInteraction()
  const now = Date.now()
  const hoursSinceLast = (now - record.lastTime) / (36e5) // 转换为小时

  // 超过设置时间未对话
  if (hoursSinceLast > CONFIG.INACTIVE_HOURS) {
    const greetings = [
      '好久没聊了，最近怎么样？',
      '我一直在等你，有啥想聊的吗？',
      '今天过得怎么样？',
      '在忙什么呢？记得照顾好自己~'
    ]
    return greetings[Math.floor(Math.random() * greetings.length)]
  }

  return null
}

// 检查是否应该提起上次话题
export async function checkTopicRecall(): Promise<string | null> {
  const record = await loadInteraction()

  // 如果有上次话题，且超过24小时
  if (record.lastTopic) {
    const hoursSinceLast = (Date.now() - record.lastTime) / 36e5
    if (hoursSinceLast > 24 && Math.random() < CONFIG.TOPIC_RECALL_CHANCE) {
      return `对了，还记得你上次说的"${record.lastTopic.slice(0, 20)}"吗？后来怎么样了？`
    }
  }

  return null
}

// 获取连续对话天数
export async function getConsecutiveDays(): Promise<number> {
  const record = await loadInteraction()
  return record.consecutiveDays
}

// ============ 约定/承诺记录 ============

// 检测用户是否做出承诺
export function detectPromise(text: string): string | null {
  const promisePatterns = [
    /(?:下次|回头|改天|以后).+?(?:请|帮你|给你)/i,
    /(?:答应|承诺|保证).+?/i,
    /(?:等我有空|有时间).+?(?:就|再)/i,
    /(?:计划|准备).+?(?:去|做)/i,
  ]

  for (const pattern of promisePatterns) {
    const match = text.match(pattern)
    if (match) {
      return match[0]
    }
  }

  return null
}

// 加载承诺列表
export async function loadPromises(): Promise<PromiseRecord[]> {
  try {
    const data = await fs.readFile(getPromisesFile(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

// 保存承诺
export async function addPromise(content: string): Promise<void> {
  const promises = await loadPromises()

  promises.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content,
    created: Date.now(),
    reminded: false
  })

  await fs.mkdir(getEvolveDir(), { recursive: true })
  await fs.writeFile(getPromisesFile(), JSON.stringify(promises, null, 2), 'utf-8')
}

// 获取未提醒的承诺
export async function getUnfulfilledPromises(): Promise<PromiseRecord[]> {
  const promises = await loadPromises()
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)

  return promises.filter(p => !p.reminded && (Date.now() - p.created) > oneDayAgo)
}

// 标记承诺已提醒
export async function markPromiseReminded(id: string): Promise<void> {
  const promises = await loadPromises()
  const promise = promises.find(p => p.id === id)

  if (promise) {
    promise.reminded = true
    await fs.writeFile(getPromisesFile(), JSON.stringify(promises, null, 2), 'utf-8')
  }
}

// ============ 个性表达 ============

// 获取鼓励语
export function getEncouragement(): string {
  const encouragements = [
    '你可以的！加油~',
    '我相信你一定能行！',
    '别急，慢慢来，你很棒！',
    '我一直陪着你呢~',
    '你比自己想象的更强！',
    '没问题，你能搞定的！',
    '我相信你的能力！'
  ]
  return encouragements[Math.floor(Math.random() * encouragements.length)]
}

// 获取关心语
export function getCareMessage(): string {
  const hour = new Date().getHours()

  if (hour >= 22 || hour < 6) {
    return '夜深了，早点休息~'
  }
  if (hour >= 6 && hour < 9) {
    return '新的一天加油！'
  }
  if (hour >= 12 && hour < 14) {
    return '记得吃饭~'
  }
  if (hour >= 18 && hour < 20) {
    return '下班了吗？辛苦了~'
  }

  return '注意身体，别太累~'
}

// 随机伙伴式回复（偶尔出现，增加亲密感）
export function getCasualReply(): string | null {
  const chance = 0.1 // 10%概率

  if (Math.random() > chance) return null

  const replies = [
    '对了跟你说件事~',
    '突然想到...',
    '有个小事想跟你分享~',
    '我刚才在想...',
    '对了，你上次说的那个...',
    '哎，我突然想起...'
  ]

  return replies[Math.floor(Math.random() * replies.length)]
}
