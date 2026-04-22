// 提醒和日程管理模块
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export interface Reminder {
  id: string
  content: string      // 提醒内容
  time: number         // 提醒时间戳
  repeat?: string      // 重复: daily, weekly, monthly
  created: number      // 创建时间
  done: boolean        // 是否完成
}

// 提醒配置
const CONFIG = {
  CHECK_INTERVAL: 60000, // 每分钟检查一次（1分钟）
  MAX_REMINDERS: 50      // 最多保留50条
}

function getEvolveDir() {
  return path.join(os.homedir(), '.handsome-cli', 'evolve')
}

function getRemindersFile() {
  return path.join(getEvolveDir(), 'reminders.json')
}

// 加载提醒
export async function loadReminders(): Promise<Reminder[]> {
  try {
    const data = await fs.readFile(getRemindersFile(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

// 保存提醒
export async function saveReminders(reminders: Reminder[]): Promise<void> {
  await fs.mkdir(getEvolveDir(), { recursive: true })
  // 只保留未完成的和最近完成的
  const active = reminders.filter(r => !r.done).slice(0, CONFIG.MAX_REMINDERS)
  await fs.writeFile(getRemindersFile(), JSON.stringify(active, null, 2), 'utf-8')
}

// 添加提醒
export async function addReminder(content: string, time: number, repeat?: string): Promise<Reminder> {
  const reminders = await loadReminders()

  const reminder: Reminder = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content,
    time,
    repeat,
    created: Date.now(),
    done: false
  }

  reminders.push(reminder)
  // 按时间排序
  reminders.sort((a, b) => a.time - b.time)

  await saveReminders(reminders)
  return reminder
}

// 完成提醒
export async function completeReminder(id: string): Promise<boolean> {
  const reminders = await loadReminders()
  const reminder = reminders.find(r => r.id === id)

  if (!reminder) return false

  reminder.done = true

  // 如果是重复提醒，生成下一次
  if (reminder.repeat) {
    const nextTime = getNextRepeatTime(reminder.time, reminder.repeat)
    reminders.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      content: reminder.content,
      time: nextTime,
      repeat: reminder.repeat,
      created: Date.now(),
      done: false
    })
  }

  await saveReminders(reminders)
  return true
}

// 删除提醒
export async function deleteReminder(id: string): Promise<boolean> {
  const reminders = await loadReminders()
  const index = reminders.findIndex(r => r.id === id)

  if (index === -1) return false

  reminders.splice(index, 1)
  await saveReminders(reminders)
  return true
}

// 获取下一次重复时间
function getNextRepeatTime(currentTime: number, repeat: string): number {
  const date = new Date(currentTime)

  switch (repeat) {
    case 'daily':
      date.setDate(date.getDate() + 1)
      break
    case 'weekly':
      date.setDate(date.getDate() + 7)
      break
    case 'monthly':
      date.setMonth(date.getMonth() + 1)
      break
  }

  return date.getTime()
}

// 获取待处理提醒
export async function getPendingReminders(): Promise<Reminder[]> {
  const reminders = await loadReminders()
  const now = Date.now()

  return reminders
    .filter(r => !r.done && r.time <= now)
    .sort((a, b) => a.time - b.time)
}

// 获取即将到来的提醒
export async function getUpcomingReminders(limit = 5): Promise<Reminder[]> {
  const reminders = await loadReminders()
  const now = Date.now()

  return reminders
    .filter(r => !r.done && r.time > now)
    .sort((a, b) => a.time - b.time)
    .slice(0, limit)
}

// 解析时间字符串
export function parseTimeString(timeStr: string): number | null {
  const now = new Date()

  // 格式: YYYY-MM-DD HH:mm
  const dateMatch = timeStr.match(/(\d{1,2})-(\d{1,2})\s+(\d{1,2}):?(\d{2})?/)
  if (dateMatch) {
    const [, month, day, hour, minute = '0'] = dateMatch
    const date = new Date(now.getFullYear(), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute))
    // 如果日期已过，算明年
    if (date.getTime() <= now.getTime()) {
      date.setFullYear(date.getFullYear() + 1)
    }
    return date.getTime()
  }

  // 格式: HH:mm
  const timeMatch = timeStr.match(/(\d{1,2}):?(\d{2})?/)
  if (timeMatch) {
    const [, hour, minute = '0'] = timeMatch
    const date = new Date()
    date.setHours(parseInt(hour), parseInt(minute), 0, 0)
    // 如果时间已过，算明天
    if (date.getTime() <= now.getTime()) {
      date.setDate(date.getDate() + 1)
    }
    return date.getTime()
  }

  // 格式: 8点17 / 8点 / 下午3点
  const dianMatch = timeStr.match(/([上下午晚早上]?)\s*(\d{1,2})点(\d{1,2})?/)
  if (dianMatch) {
    const [, prefix, hourStr, minuteStr = '0'] = dianMatch
    let hour = parseInt(hourStr)

    // 处理前缀
    if (prefix === '下午' || prefix === '晚') {
      hour += 12
    } else if (prefix === '早上' || prefix === '上午') {
      // 保持不变
    }

    const date = new Date()
    date.setHours(hour, parseInt(minuteStr), 0, 0)
    // 如果时间已过，算明天
    if (date.getTime() <= now.getTime()) {
      date.setDate(date.getDate() + 1)
    }
    return date.getTime()
  }

  // 相对时间: 30分钟后, 2小时后, 1天后
  const relativeMatch = timeStr.match(/(\d+)(分钟|小时|天)后/)
  if (relativeMatch) {
    const [, value, unit] = relativeMatch
    const ms = {
      '分钟': 60 * 1000,
      '小时': 60 * 60 * 1000,
      '天': 24 * 60 * 60 * 1000
    }[unit] || 0

    return now.getTime() + parseInt(value) * ms
  }

  return null
}

// 格式化提醒时间
export function formatReminderTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = date.getTime() - now.getTime()

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`

  if (minutes < 0) return `已过期 ${timeStr}`
  if (minutes < 60) return `${minutes}分钟后 (${timeStr})`
  if (hours < 24) return `${hours}小时后 (${timeStr})`
  if (days < 7) return `${days}天后 (${timeStr})`

  return `${date.getMonth() + 1}/${date.getDate()} ${timeStr}`
}