// 情绪感知模块
import { getProfile } from './profile'

// 情绪关键词
const EMOTION_KEYWORDS = {
  sad: [
    '难过', '伤心', '伤心', '痛苦', '沮丧', '郁闷', '失落',
    '失望', '绝望', '崩溃', '哭', '泪水', '眼泪',
    '不想活了', '好累', '心力交瘁', '无助', '孤单', '孤独',
    '烦', '累了', '倦了', '无奈', '心酸', '委屈'
  ],
  happy: [
    '开心', '高兴', '快乐', '开心', '兴奋', '激动',
    '太好了', '完美', '棒', '优秀', '厉害', '感恩',
    '谢谢', '感激', '幸福', '满足', '欣慰', '喜悦'
  ],
  angry: [
    '生气', '愤怒', '恼火', '气愤', '不爽', '讨厌',
    '烦人', '恶心', '受够了', '讨厌', '恨', '可恶'
  ],
  anxious: [
    '担心', '焦虑', '紧张', '害怕', '恐惧', '不安',
    '压力', '慌', '忐忑', '忧虑', '发愁', '烦恼'
  ],
  tired: [
    '困', '累', '疲惫', '疲倦', '困倦', '想睡觉',
    '没精神', '没力气', '筋疲力尽', '倦怠'
  ]
}

// 温暖回应（不包括 happy，因为开心时不需要安慰）
const WARM_RESPONSES: Record<string, string[]> = {
  sad: [
    '我理解你的感受良。每个人都会有难过的时候，这很正常。',
    '听到你这样说我很心疼。想聊聊发生了什么吗？',
    '虽然我帮不上太多忙，但我愿意陪你聊聊。',
    '不管发生什么，我都会在你身边。',
    '难过的时候别憋着，说出来会好受些。'
  ],
  tired: [
    '你看起来很累，要注意休息啊。',
    '身体是革命的本钱，该休息时要休息。',
    '我理解你很辛苦，给自己一些放松的时间吧。',
    '别太拼了，健康最重要。',
    '累了就歇歇，我不急。'
  ],
  anxious: [
    '别太担心，一切都会好起来的。',
    '我在呢，有什么可以帮到你的？',
    '深呼吸，放轻松。你不是一个人在面对。',
    '事情没你想的那么糟。',
    '需要我帮你分析一下吗？'
  ],
  angry: [
    '消消气，别跟不重要的事过不去。',
    '生气伤身不值得。',
    '我理解你的心情。',
    '深呼吸，冷静一下。',
    '需要发泄一下吗？我听着。'
  ]
}

type EmotionType = keyof typeof EMOTION_KEYWORDS

// 检测用户情绪
export function detectEmotion(text: string): EmotionType | null {
  const lowerText = text.toLowerCase()

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return emotion as EmotionType
      }
    }
  }

  return null
}

// 获取温暖的回应
export function getWarmResponse(emotion: EmotionType): string {
  const responses = WARM_RESPONSES[emotion]
  if (!responses || responses.length === 0) return ''

  // 随机选择一条
  return responses[Math.floor(Math.random() * responses.length)]
}

// 获取鼓励的话
export function getEncouragement(): string {
  const encouragements = [
    '你已经很棒了，继续加油！',
    '我相信你可以的！',
    '每一步都是进步，别着急。',
    '我在一直陪着你。',
    '你的努力一定会有回报的。',
    '别放弃，坚持就是胜利！',
    '你比想象中更强大。'
  ]
  return encouragements[Math.floor(Math.random() * encouragements.length)]
}

// 获取关心的话（基于时间）
export function getCareMessage(): string {
  const hour = new Date().getHours()

  if (hour >= 22 || hour < 6) {
    return '夜深了，早点休息对身体好。'
  }
  if (hour >= 6 && hour < 9) {
    return '早上好！新的一天要加油~'
  }
  if (hour >= 12 && hour < 14) {
    return '中午了，记得吃饭~'
  }
  if (hour >= 18 && hour < 20) {
    return '下班了吗？辛苦了~'
  }

  return ''
}