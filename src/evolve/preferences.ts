// 偏好学习系统 - 从对话中自动学习用户偏好
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export interface Preference {
  key: string      // 偏好键 (如 "喜欢简洁")
  value: number    // 1=喜欢, -1=厌恶, 0=中立
  source: string   // 来源句子
  count: number    // 出现次数
  updated: number  // 更新时间
}

// 偏好提取规则
const PREFERENCE_PATTERNS = [
  // 喜欢
  { pattern: /我喜欢(.+?)(?:\s|，|,|。|$)/gi, value: 1, type: 'like' },
  { pattern: /爱(.+?)(?:\s|，|,|。|$)/gi, value: 1, type: 'like' },
  { pattern: /喜欢(.+?)(?:\s|，|,|。|$)/gi, value: 1, type: 'like' },
  { pattern: /想要(.+?)(?:\s|，|,|。|$)/gi, value: 1, type: 'like' },
  // 厌恶
  { pattern: /我不喜欢(.+?)(?:\s|，|,|。|$)/gi, value: -1, type: 'dislike' },
  { pattern: /讨厌(.+?)(?:\s|，|,|。|$)/gi, value: -1, type: 'dislike' },
  { pattern: /不喜欢(.+?)(?:\s|，|,|。|$)/gi, value: -1, type: 'dislike' },
  { pattern: /不要(.+?)(?:\s|，|,|。|$)/gi, value: -1, type: 'avoid' },
  // 风格偏好
  { pattern: /(?:回答|回复|说话)要?(.+?)(?:\s|，|,|。|$)/gi, value: 1, type: 'style' },
  { pattern: /(?:太|很)_(.+?)(?:了|的)/gi, value: -1, type: 'style' },
]

function getEvolveDir() {
  return path.join(os.homedir(), '.handsome-cli', 'evolve')
}

function getPreferencesFile() {
  return path.join(getEvolveDir(), 'preferences.json')
}

// 加载偏好
export async function loadPreferences(): Promise<Preference[]> {
  try {
    const data = await fs.readFile(getPreferencesFile(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

// 保存偏好
export async function savePreferences(prefs: Preference[]): Promise<void> {
  await fs.mkdir(getEvolveDir(), { recursive: true })
  await fs.writeFile(getPreferencesFile(), JSON.stringify(prefs, null, 2), 'utf-8')
}

// 从文本中提取偏好
export async function learnFromText(text: string): Promise<Preference[]> {
  try {
    const prefs = await loadPreferences()

    for (const rule of PREFERENCE_PATTERNS) {
      // 重置 regex 状态
      rule.pattern.lastIndex = 0
      const matches = text.matchAll(rule.pattern)
      for (const match of matches) {
        const key = match[1].trim().toLowerCase()
        if (key.length < 2 || key.length > 50) continue

        // 检查是否已存在
        const existing = prefs.find(p => p.key === key)
        if (existing) {
          existing.count++
          existing.updated = Date.now()
        } else {
          prefs.push({
            key,
            value: rule.value,
            source: text.slice(0, 100),
            count: 1,
            updated: Date.now()
          })
        }
      }
    }

    // 保存并返回
    await savePreferences(prefs)
    return prefs
  } catch (error) {
    console.error('[偏好学习出错]', error)
    return []
  }
}

// 获取偏好提示词（异步）
export async function getPreferencePrompt(): Promise<string> {
  const prefs = await loadPreferences()

  if (!prefs || prefs.length === 0) return ''

  let prompt = '\n【用户偏好】\n'
  const likes = prefs.filter(p => p.value > 0).slice(0, 5)
  const dislikes = prefs.filter(p => p.value < 0).slice(0, 5)

  if (likes.length > 0) {
    prompt += `用户喜欢: ${likes.map(p => p.key).join(', ')}\n`
  }
  if (dislikes.length > 0) {
    prompt += `用户厌恶: ${dislikes.map(p => p.key).join(', ')}\n`
  }
  return prompt
}