// 反馈学习系统 - 用户手动反馈来学习
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export interface Feedback {
  id: number
  type: 'good' | 'bad'
  message?: string  // 可选的反馈说明
  context: string   // 触发反馈的对话
  timestamp: number
}

function getEvolveDir() {
  return path.join(os.homedir(), '.handsome-cli', 'evolve')
}

function getFeedbackFile() {
  return path.join(getEvolveDir(), 'feedback.json')
}

// 加载反馈
export async function loadFeedback(): Promise<Feedback[]> {
  try {
    const data = await fs.readFile(getFeedbackFile(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

// 保存反馈
export async function saveFeedback(feedback: Feedback[]): Promise<void> {
  await fs.mkdir(getEvolveDir(), { recursive: true })
  await fs.writeFile(getFeedbackFile(), JSON.stringify(feedback, null, 2), 'utf-8')
}

// 添加反馈
export async function addFeedback(type: 'good' | 'bad', context: string, message?: string): Promise<Feedback> {
  const feedback = await loadFeedback()

  const newFeedback: Feedback = {
    id: feedback.length + 1,
    type,
    message,
    context: context.slice(0, 200),
    timestamp: Date.now()
  }

  feedback.push(newFeedback)
  await saveFeedback(feedback)

  return newFeedback
}

// 获取反馈统计
export async function getFeedbackStats(): Promise<{ good: number; bad: number }> {
  const feedback = await loadFeedback()
  return {
    good: feedback.filter(f => f.type === 'good').length,
    bad: feedback.filter(f => f.type === 'bad').length
  }
}