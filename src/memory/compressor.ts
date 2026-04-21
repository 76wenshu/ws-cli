// ============ 记忆压缩与关键词提取算法 ============

export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface MemoryBlock {
  id: string
  type: 'warm' | 'cold'
  content: string        // 摘要内容
  keywords: string[]     // 关键词
  importance: number     // 重要程度 0-10
  timestamp: number
  sourceCount: number    // 由多少条对话压缩而来
}

// ============ 关键词提取器 ============

interface Extractor {
  type: string
  patterns: RegExp[]
  extract: (match: string[]) => string[]
}

// 实体提取规则
const extractors: Extractor[] = [
  {
    type: 'name',
    patterns: [/我叫(.+)/i, /我的名字是(.+)/i, /我是(.+)/i],
    extract: (m) => [m[1].trim(), '名字', '人物']
  },
  {
    type: 'preference',
    patterns: [/喜欢(.+?)(?:\s|$|，|。)/gi, /爱(.+?)(?:\s|$|，|。)/gi, /最喜欢(.+?)(?:\s|$|，|。)/gi],
    extract: (m) => [m[1].trim(), '偏好', '喜欢']
  },
  {
    type: 'dislike',
    patterns: [/不喜欢(.+?)(?:\s|$|，|。)/gi, /讨厌(.+?)(?:\s|$|，|。)/gi, /最讨厌(.+?)(?:\s|$|，|。)/gi],
    extract: (m) => [m[1].trim(), '厌恶', '讨厌']
  },
  {
    type: 'work',
    patterns: [/工作(.+?)(?:\s|$|，|。)/gi, /职业(.+?)(?:\s|$|，|。)/gi, /做(.+?)的/i],
    extract: (m) => [m[1].trim(), '工作', '职业']
  },
  {
    type: 'location',
    patterns: [/在(.+)工作/i, /住在(.+?)(?:\s|$|，|。)/gi, /(.+)人/i],
    extract: (m) => [m[1].trim(), '地点', '城市']
  },
  {
    type: 'fact',
    patterns: [/记住(.+)/i, /告诉你(.+)/i, /其实(.+)/i],
    extract: (m) => [m[1].trim(), '事实']
  },
  {
    type: 'emotion',
    patterns: [/开心(.+?)(?:\s|$|，|。)/gi, /难过(.+?)(?:\s|$|，|。)/gi, /累(.+?)(?:\s|$|，|。)/gi],
    extract: (m) => ['情感', '情绪']
  }
]

// 提取关键词
export function extractKeywords(text: string): string[] {
  const keywords = new Set<string>()

  // 1. 实体提取
  for (const extractor of extractors) {
    for (const pattern of extractor.patterns) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        const extracted = extractor.extract(match)
        extracted.forEach(k => keywords.add(k))
      }
    }
  }

  // 2. 通用关键词提取（过滤停用词）
  const stopWords = new Set(['的', '了', '是', '在', '我', '你', '他', '她', '它', '这', '那', '有', '没', '很', '也', '都', '和', '与', '或', '但', '而', '就', '要', '会', '能', '可以', '一个', '一些', '什么', '怎么', '为什么', '这个', '那个'])

  const words = text.split(/[\s,，.。!！?？、]+/).filter(w => w.length > 1)
  for (const word of words) {
    if (!stopWords.has(word) && !/^\d+$/.test(word)) {
      keywords.add(word)
    }
  }

  return Array.from(keywords).slice(0, 10) // 最多10个关键词
}

// ============ 记忆压缩算法 ============

// 生成唯一ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 10)
}

// 评估重要性
function assessImportance(text: string): number {
  let score = 0

  // 人名相关 - 高优先级
  if (/名|姓|叫我/i.test(text)) score += 5

  // 偏好相关 - 中高优先级
  if (/喜欢|讨厌|爱|想要|需要/i.test(text)) score += 4

  // 工作相关
  if (/工作|职业|公司|职位/i.test(text)) score += 3

  // 情感相关
  if (/开心|难过|累|压力|高兴|伤心/i.test(text)) score += 3

  // 承诺/约定
  if (/答应的|答应的|答应的|答应的|记得|不要忘记/i.test(text)) score += 5

  // 确保最低1分
  return Math.max(1, Math.min(10, score))
}

// 压缩对话为记忆块
export function compressMessages(messages: Message[], threshold: number = 5): MemoryBlock[] {
  if (messages.length < threshold) return []

  const blocks: MemoryBlock[] = []
  const blockSize = 10 // 每10条对话压缩为一个块

  for (let i = 0; i < messages.length; i += blockSize) {
    const chunk = messages.slice(i, i + blockSize)
    const text = chunk.map(m => m.content).join(' | ')
    const keywords = extractKeywords(text)
    const importance = assessImportance(text)

    const timestamps = chunk.map(m => m.timestamp)
    const startTime = Math.min(...timestamps)
    const endTime = Math.max(...timestamps)

    blocks.push({
      id: generateId(),
      type: 'warm',
      content: `【${new Date(startTime).toLocaleDateString()}】 ${text.slice(0, 200)}`,
      keywords,
      importance,
      timestamp: endTime,
      sourceCount: chunk.length
    })
  }

  // 按重要性排序，保留最重要的
  blocks.sort((a, b) => b.importance - a.importance)

  return blocks.slice(0, 50) // 最多保留50个重要块
}

// ============ 检索算法 ============

// 关键词匹配检索
export function searchByKeyword(blocks: MemoryBlock[], query: string): MemoryBlock[] {
  const queryKeywords = extractKeywords(query.toLowerCase())
  if (queryKeywords.length === 0) return blocks.slice(0, 5) // 无关键词则返回最近的

  const scored = blocks.map(block => {
    let score = 0
    for (const qk of queryKeywords) {
      // 精确匹配
      if (block.keywords.some(k => k.toLowerCase() === qk)) {
        score += 10
      }
      // 包含匹配
      else if (block.keywords.some(k => k.toLowerCase().includes(qk))) {
        score += 5
      }
      // 内容匹配
      else if (block.content.toLowerCase().includes(qk)) {
        score += 2
      }
    }
    return { block, score }
  })

  // 过滤得分>0的，按得分和时间排序
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.block.timestamp - a.block.timestamp
  })

  return scored.filter(s => s.score > 0).map(s => s.block).slice(0, 5)
}

// 构建上下文（用于 LLM）
export function buildContext(memory: {
  hot: Message[]
  warm: MemoryBlock[]
  cold: MemoryBlock[]
}): string {
  const parts: string[] = []

  // 1. Hot 记忆（完整对话）
  if (memory.hot.length > 0) {
    parts.push('【最近对话】')
    for (const msg of memory.hot.slice(-10)) {
      const role = msg.role === 'user' ? '用户' : '助手'
      parts.push(`${role}: ${msg.content}`)
    }
  }

  // 2. Warm 记忆（重要摘要）
  if (memory.warm.length > 0) {
    parts.push('\n【重要记忆】')
    for (const block of memory.warm.slice(0, 5)) {
      parts.push(`• ${block.content.slice(0, 100)}`)
    }
  }

  // 3. Cold 记忆（仅相关）
  if (memory.cold.length > 0) {
    parts.push('\n【历史记忆】')
    for (const block of memory.cold.slice(0, 3)) {
      parts.push(`• ${block.content.slice(0, 80)}`)
    }
  }

  return parts.join('\n')
}
