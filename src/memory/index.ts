import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { extractKeywords, MemoryBlock, Message } from './compressor'

// 存储目录
const getMemoryDir = () => path.join(os.homedir(), '.handsome-cli', 'memory')

// 记忆配置
const CONFIG = {
  HOT_SIZE: 20,           // 短期记忆条数
  COMPRESS_THRESHOLD: 1000, // 压缩阈值
}

// ============ 基础类型 ============

// 用户画像
export interface UserProfile {
  name?: string
  job?: string        // 职业
  skills?: string[]   // 技能
  interests?: string[] // 兴趣
  location?: string   // 位置
  goals?: string[]    // 目标
  bio?: string        // 个人简介
  updated: number     // 更新时间
}

export interface Memory {
  user: {
    name?: string
    preferences: Record<string, any>
    profile?: UserProfile  // 用户画像
  }
  // 统计信息
  stats: {
    total: number        // 总对话数
    compressed: number   // 已压缩数
  }
}

// ============ 存储操作 ============

// 加载用户信息
export async function loadUserMemory(): Promise<Memory> {
  const memDir = await getMemoryDir()
  const userFile = path.join(memDir, 'user.json')

  try {
    const data = await fs.readFile(userFile, 'utf-8')
    return JSON.parse(data)
  } catch {
    return {
      user: { preferences: {} },
      stats: { total: 0, compressed: 0 }
    }
  }
}

// 保存用户信息
export async function saveUserMemory(memory: Memory): Promise<void> {
  const memDir = await getMemoryDir()
  await fs.mkdir(memDir, { recursive: true })
  const userFile = path.join(memDir, 'user.json')
  await fs.writeFile(userFile, JSON.stringify(memory, null, 2), 'utf-8')
}

// ============ 短期记忆 (Hot) ============

export async function loadHotMemory(): Promise<Message[]> {
  const memDir = await getMemoryDir()
  const hotFile = path.join(memDir, 'hot.json')

  try {
    const data = await fs.readFile(hotFile, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

export async function saveHotMemory(messages: Message[]): Promise<void> {
  const memDir = await getMemoryDir()
  await fs.mkdir(memDir, { recursive: true })
  const hotFile = path.join(memDir, 'hot.json')
  // 只保留最近 HOT_SIZE 条
  const trimmed = messages.slice(-CONFIG.HOT_SIZE)
  await fs.writeFile(hotFile, JSON.stringify(trimmed, null, 2), 'utf-8')
}

// ============ 中期记忆 (Warm) ============

export async function loadWarmMemory(): Promise<MemoryBlock[]> {
  const memDir = await getMemoryDir()
  const warmFile = path.join(memDir, 'warm.json')

  try {
    const data = await fs.readFile(warmFile, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

export async function saveWarmMemory(blocks: MemoryBlock[]): Promise<void> {
  const memDir = await getMemoryDir()
  await fs.mkdir(memDir, { recursive: true })
  const warmFile = path.join(memDir, 'warm.json')
  await fs.writeFile(warmFile, JSON.stringify(blocks, null, 2), 'utf-8')
}

// ============ 长期记忆 (Cold) - 按月份分片 ============

function getMonthKey(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export async function loadColdMemory(month?: string): Promise<MemoryBlock[]> {
  const memDir = await getMemoryDir()
  const targetMonth = month || getMonthKey(Date.now())
  const coldFile = path.join(memDir, `${targetMonth}.json`)

  try {
    const data = await fs.readFile(coldFile, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

export async function saveColdMemory(month: string, blocks: MemoryBlock[]): Promise<void> {
  const memDir = await getMemoryDir()
  await fs.mkdir(memDir, { recursive: true })
  const coldFile = path.join(memDir, `${month}.json`)
  await fs.writeFile(coldFile, JSON.stringify(blocks, null, 2), 'utf-8')
}

// 加载所有月份的 cold 记忆
export async function loadAllColdMemory(): Promise<MemoryBlock[]> {
  const memDir = await getMemoryDir()
  const files = await fs.readdir(memDir)
  const coldFiles = files.filter(f => /^\d{4}-\d{2}\.json$/.test(f))

  let allBlocks: MemoryBlock[] = []
  for (const file of coldFiles) {
    const data = await fs.readFile(path.join(memDir, file), 'utf-8')
    allBlocks = allBlocks.concat(JSON.parse(data))
  }
  return allBlocks
}

// ============ 索引操作 ============

interface MemoryIndex {
  keywords: Record<string, string[]>  // keyword -> memory block ids
  months: string[]                    // 有记忆的月份
}

export async function loadIndex(): Promise<MemoryIndex> {
  const memDir = await getMemoryDir()
  const indexFile = path.join(memDir, 'index.json')

  try {
    const data = await fs.readFile(indexFile, 'utf-8')
    return JSON.parse(data)
  } catch {
    return { keywords: {}, months: [] }
  }
}

export async function saveIndex(index: MemoryIndex): Promise<void> {
  const memDir = await getMemoryDir()
  await fs.mkdir(memDir, { recursive: true })
  const indexFile = path.join(memDir, 'index.json')
  await fs.writeFile(indexFile, JSON.stringify(index, null, 2), 'utf-8')
}

// 更新索引
export async function updateIndex(block: MemoryBlock): Promise<void> {
  const index = await loadIndex()

  // 添加月份
  const month = getMonthKey(block.timestamp)
  if (!index.months.includes(month)) {
    index.months.push(month)
  }

  // 添加关键词索引
  for (const kw of block.keywords) {
    const lowerKw = kw.toLowerCase()
    if (!index.keywords[lowerKw]) {
      index.keywords[lowerKw] = []
    }
    if (!index.keywords[lowerKw].includes(block.id)) {
      index.keywords[lowerKw].push(block.id)
    }
  }

  await saveIndex(index)
}

// ============ 统一加载/保存接口 ============

export interface FullMemory {
  user: Memory['user']
  hot: Message[]
  warm: MemoryBlock[]
  cold: MemoryBlock[]
  stats: Memory['stats']
}

export async function loadFullMemory(): Promise<FullMemory> {
  const [user, hot, warm, cold] = await Promise.all([
    loadUserMemory(),
    loadHotMemory(),
    loadWarmMemory(),
    loadAllColdMemory()
  ])

  return {
    user: user.user,
    hot,
    warm,
    cold,
    stats: user.stats
  }
}

export async function saveFullMemory(memory: FullMemory): Promise<void> {
  await Promise.all([
    saveUserMemory({ user: memory.user, stats: memory.stats }),
    saveHotMemory(memory.hot),
    saveWarmMemory(memory.warm)
  ])
}
