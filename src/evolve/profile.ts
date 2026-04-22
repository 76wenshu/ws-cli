// 用户画像模块 - 收集和管理用户基本信息
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

// 用户画像类型（与 memory/index.ts 保持一致）
export interface UserProfile {
  name?: string
  job?: string
  skills?: string[]
  interests?: string[]
  location?: string
  goals?: string[]
  bio?: string
  updated: number
}

function getEvolveDir() {
  return path.join(os.homedir(), '.handsome-cli', 'evolve')
}

function getProfileFile() {
  return path.join(getEvolveDir(), 'profile.json')
}

// 默认画像
const defaultProfile: UserProfile = {
  skills: [],
  interests: [],
  goals: [],
  updated: Date.now()
}

// 加载用户画像
export async function loadProfile(): Promise<UserProfile> {
  try {
    const data = await fs.readFile(getProfileFile(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return { ...defaultProfile }
  }
}

// 保存用户画像
export async function saveProfile(profile: UserProfile): Promise<void> {
  await fs.mkdir(getEvolveDir(), { recursive: true })
  profile.updated = Date.now()
  await fs.writeFile(getProfileFile(), JSON.stringify(profile, null, 2), 'utf-8')
}

// 更新用户画像字段
export async function updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
  const profile = await loadProfile()
  const updated = { ...profile, ...updates, updated: Date.now() }
  await saveProfile(updated)
  return updated
}

// 检查画像是否完整
export async function isProfileComplete(): Promise<boolean> {
  const profile = await loadProfile()
  // 至少有名字和职业就算基本完整
  return !!(profile.name && profile.job)
}

// 获取画像提示词（用于 LLM）
export async function getProfilePrompt(): Promise<string> {
  const profile = await loadProfile()

  if (!profile.name) return ''

  const parts: string[] = []
  parts.push(`用户名字: ${profile.name}`)

  if (profile.job) parts.push(`职业: ${profile.job}`)
  if (profile.skills?.length) parts.push(`技能: ${profile.skills.join(', ')}`)
  if (profile.interests?.length) parts.push(`兴趣: ${profile.interests.join(', ')}`)
  if (profile.location) parts.push(`位置: ${profile.location}`)
  if (profile.goals?.length) parts.push(`目标: ${profile.goals.join(', ')}`)
  if (profile.bio) parts.push(`简介: ${profile.bio}`)

  return '\n【用户画像】\n' + parts.join('\n')
}

// 从对话中自动提取画像信息
export async function learnProfileFromText(text: string): Promise<void> {
  const profile = await loadProfile()

  // 检测职业相关关键词
  const jobKeywords = [
    { pattern: /(?:我是|从事|做)(?:一个?)?(.+?)(?:工程|开发|设计|产品|运营|测试)/i, field: 'job' },
    { pattern: /(?:程序员|工程师|开发者|设计师|产品经理|运营|测试工程师)/i, field: 'job' },
    { pattern: /(?:前端|后端|全栈|移动端|服务端)/i, field: 'job' },
  ]

  // 检测兴趣
  const interestKeywords = [
    { pattern: /(?:喜欢|感兴趣)(?:的|是)?(.+?)(?:\s|，|,|。|$)/gi, field: 'interests' },
    { pattern: /(?:业余|平时).*?(?:玩|做|研究)(.+?)(?:\s|，|,|。|$)/gi, field: 'interests' },
  ]

  // 检测目标
  const goalKeywords = [
    { pattern: /(?:想|想要|目标是)(.+?)(?:\s|，|,|。|$)/gi, field: 'goals' },
    { pattern: /(?:准备|计划).*?(?:学习|掌握|完成)(.+?)(?:\s|，|,|。|$)/gi, field: 'goals' },
  ]

  // 简单处理：如果用户说"我是程序员"，记录职业
  if (!profile.job) {
    if (text.includes('程序员') || text.includes('工程师') || text.includes('开发')) {
      profile.job = '开发者'
    }
  }

  await saveProfile(profile)
}

// 获取完整画像
export async function getProfile(): Promise<UserProfile> {
  return loadProfile()
}