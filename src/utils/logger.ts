// 运行日志模块
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

export interface LogEntry {
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  source: string
  message: string
  details?: any
}

const MAX_LOG_SIZE = 100 * 1024 * 1024 // 100MB
const MAX_LOG_ENTRIES = 10000

function getLogDir() {
  return path.join(os.homedir(), '.handsome-cli', 'logs')
}

function getLogFile() {
  return path.join(getLogDir(), 'runtime.log')
}

// 写入日志
export async function log(level: LogEntry['level'], source: string, message: string, details?: any) {
  const entry: LogEntry = {
    timestamp: Date.now(),
    level,
    source,
    message,
    details
  }

  try {
    await fs.mkdir(getLogDir(), { recursive: true })

    const logLine = JSON.stringify(entry) + '\n'
    const logPath = getLogFile()

    // 检查文件大小
    try {
      const stats = await fs.stat(logPath)
      if (stats.size > MAX_LOG_SIZE) {
        // 轮转日志：备份并创建新文件
        const backupPath = logPath + '.old'
        await fs.rename(logPath, backupPath)
      }
    } catch {
      // 文件不存在，忽略
    }

    await fs.appendFile(logPath, logLine, 'utf-8')
  } catch (e) {
    console.error('写入日志失败:', e)
  }
}

// 便捷方法
export function info(source: string, message: string, details?: any) {
  log('info', source, message, details)
}

export function warn(source: string, message: string, details?: any) {
  log('warn', source, message, details)
}

export function error(source: string, message: string, details?: any) {
  log('error', source, message, details)
}

export function debug(source: string, message: string, details?: any) {
  log('debug', source, message, details)
}

// 获取最近N条日志
export async function getRecentLogs(count: number = 50): Promise<LogEntry[]> {
  try {
    const content = await fs.readFile(getLogFile(), 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    return lines.slice(-count).map(line => {
      try {
        return JSON.parse(line)
      } catch {
        return null
      }
    }).filter(Boolean) as LogEntry[]
  } catch {
    return []
  }
}

// 获取错误日志
export async function getErrorLogs(count: number = 20): Promise<LogEntry[]> {
  const logs = await getRecentLogs(500)
  return logs.filter(l => l.level === 'error').slice(-count)
}

// 格式化日志为可读字符串
export function formatLogs(logs: LogEntry[]): string {
  return logs.map(l => {
    const time = new Date(l.timestamp).toLocaleString('zh-CN')
    const level = l.level.toUpperCase().padEnd(5)
    const source = l.source.padEnd(15)
    let msg = `${time} [${level}] ${source} ${l.message}`
    if (l.details) {
      msg += ` | ${JSON.stringify(l.details)}`
    }
    return msg
  }).join('\n')
}

// 清理旧日志
export async function cleanOldLogs() {
  try {
    const logs = await getRecentLogs(MAX_LOG_ENTRIES + 1000)
    if (logs.length > MAX_LOG_ENTRIES) {
      const recentLogs = logs.slice(-MAX_LOG_ENTRIES)
      const content = recentLogs.map(l => JSON.stringify(l)).join('\n') + '\n'
      await fs.writeFile(getLogFile(), content, 'utf-8')
    }
  } catch {
    // 忽略
  }
}