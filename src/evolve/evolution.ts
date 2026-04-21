// 真正的自进化系统 - 像人一样成长
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export interface Skill {
  id: string           // 技能ID
  name: string         // 技能名称
  level: number        // 等级 1-10
  xp: number           // 经验值
  unlocked: boolean    // 是否解锁
  lastUsed: number     // 上次使用时间
}

export interface EvolutionState {
  age: number               // "年龄"（对话轮数）
  stage: '婴儿' | '儿童' | '少年' | '成人' | '大师'  // 成长阶段
  xp: number                // 总经验值
  skills: Skill[]           // 技能列表
  memoryPatterns: string[]  // 记住的交互模式
  failedPatterns: string[]  // 失败模式（下次避免）
  personality: {
    talkative: number       // -10 到 10
    formal: number          // -10 到 10
    helpful: number         // -10 到 10
  }
}

// 技能定义
const SKILL_DEFS = [
  { id: 'calc', name: '计算', baseXp: 10 },
  { id: 'time', name: '时间', baseXp: 10 },
  { id: 'search', name: '搜索', baseXp: 20 },
  { id: 'code', name: '编程', baseXp: 50 },
  { id: 'write', name: '写作', baseXp: 30 },
  { id: 'translate', name: '翻译', baseXp: 30 },
  { id: 'analysis', name: '分析', baseXp: 40 },
]

function getEvolveDir() {
  return path.join(os.homedir(), '.handsome-cli', 'evolve')
}

function getStateFile() {
  return path.join(getEvolveDir(), 'state.json')
}

// 初始状态 - 像新生儿
export function getInitialState(): EvolutionState {
  return {
    age: 0,
    stage: '婴儿',
    xp: 0,
    skills: SKILL_DEFS.map(s => ({
      ...s,
      level: 1,
      xp: 0,
      unlocked: s.id === 'calc' || s.id === 'time', // 初始解锁基础技能
      lastUsed: 0
    })),
    memoryPatterns: [],
    failedPatterns: [],
    personality: {
      talkative: 0,
      formal: 0,
      helpful: 0
    }
  }
}

// 加载进化状态
export async function loadEvolutionState(): Promise<EvolutionState> {
  try {
    const data = await fs.readFile(getStateFile(), 'utf-8')
    const state = JSON.parse(data)
    // 确保新技能也能加入
    for (const def of SKILL_DEFS) {
      if (!state.skills.find((s: Skill) => s.id === def.id)) {
        state.skills.push({
          ...def,
          level: 1,
          xp: 0,
          unlocked: false,
          lastUsed: 0
        })
      }
    }
    return state
  } catch {
    return getInitialState()
  }
}

// 保存进化状态
export async function saveEvolutionState(state: EvolutionState): Promise<void> {
  await fs.mkdir(getEvolveDir(), { recursive: true })
  await fs.writeFile(getStateFile(), JSON.stringify(state, null, 2), 'utf-8')
}

// 根据 XP 计算等级
function calcLevel(xp: number): number {
  // 等级公式: level = floor(sqrt(xp / 100)) + 1
  return Math.floor(Math.sqrt(xp / 100)) + 1
}

// 计算阶段
function calcStage(age: number, xp: number): EvolutionState['stage'] {
  if (age < 10) return '婴儿'
  if (age < 50) return '儿童'
  if (age < 200) return '少年'
  if (xp < 10000) return '成人'
  return '大师'
}

// 增加经验并升级
export async function addXp(skillId: string, amount: number): Promise<{ leveled: boolean; newLevel: number }> {
  const state = await loadEvolutionState()
  const skill = state.skills.find(s => s.id === skillId)

  if (!skill) return { leveled: false, newLevel: 1 }

  // 解锁技能
  if (!skill.unlocked) {
    skill.unlocked = true
  }

  const oldLevel = skill.level
  skill.xp += amount
  skill.level = calcLevel(skill.xp)
  skill.lastUsed = Date.now()

  // 总 XP 增加
  state.xp += amount

  // 年龄增加
  state.age++

  // 更新阶段
  state.stage = calcStage(state.age, state.xp)

  await saveEvolutionState(state)

  return { leveled: skill.level > oldLevel, newLevel: skill.level }
}

// 记录成功模式
export async function recordPattern(input: string, response: string): Promise<void> {
  const state = await loadEvolutionState()

  // 记住这个交互模式
  const pattern = `${input.slice(0, 20)}→${response.slice(0, 30)}`
  if (!state.memoryPatterns.includes(pattern)) {
    state.memoryPatterns.push(pattern)
    // 只保留最近 100 个
    if (state.memoryPatterns.length > 100) {
      state.memoryPatterns.shift()
    }
  }

  await saveEvolutionState(state)
}

// 记录失败模式（下次避免）
export async function recordFailedPattern(input: string, response: string): Promise<void> {
  const state = await loadEvolutionState()

  const pattern = `${input.slice(0, 20)}→${response.slice(0, 30)}`
  if (!state.failedPatterns.includes(pattern)) {
    state.failedPatterns.push(pattern)
    if (state.failedPatterns.length > 50) {
      state.failedPatterns.shift()
    }
  }

  await saveEvolutionState(state)
}

// 更新人格特质
export async function updatePersonality(trait: keyof EvolutionState['personality'], delta: number): Promise<void> {
  const state = await loadEvolutionState()
  state.personality[trait] = Math.max(-10, Math.min(10, state.personality[trait] + delta))
  await saveEvolutionState(state)
}

// 获取进化提示（用于 LLM prompt）
export async function getEvolutionPrompt(): Promise<string> {
  const state = await loadEvolutionState()

  const lines = [
    `\n【我的成长状态】`,
    `年龄: ${state.age} 轮对话`,
    `阶段: ${state.stage}`,
    `经验值: ${state.xp}`,
  ]

  // 技能状况
  const unlocked = state.skills.filter(s => s.unlocked)
  if (unlocked.length > 0) {
    lines.push(`已解锁技能: ${unlocked.map(s => `${s.name}(${s.level}级)`).join(', ')}`)
  }

  // 人格
  const p = state.personality
  if (Math.abs(p.talkative) > 5 || Math.abs(p.formal) > 5) {
    const traits = []
    if (p.talkative > 5) traits.push('话多')
    if (p.talkative < -5) traits.push('简洁')
    if (p.formal > 5) traits.push('正式')
    if (p.formal < -5) traits.push('随意')
    if (traits.length > 0) {
      lines.push(`性格特点: ${traits.join('，')}`)
    }
  }

  return lines.join('\n')
}

// 获取进化状态摘要
export async function getEvolutionSummary(): Promise<string> {
  const state = await loadEvolutionState()

  const lines = [
    `🧬 进化状态`,
    ``,
    `年龄: ${state.age} 轮对话`,
    `阶段: ${state.stage}`,
    `经验值: ${state.xp}`,
    ``,
    `📚 技能:`,
  ]

  for (const skill of state.skills) {
    if (skill.unlocked) {
      const bar = '█'.repeat(skill.level) + '░'.repeat(10 - skill.level)
      lines.push(`  ${skill.name}: ${bar} Lv.${skill.level}`)
    }
  }

  if (state.failedPatterns.length > 0) {
    lines.push(``, `⚠️ 失败经验: ${state.failedPatterns.length} 条（我会尽量避免）`)
  }

  return lines.join('\n')
}