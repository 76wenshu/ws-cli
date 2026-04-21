import http from 'http'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { Device } from './discovery'

const HANDSOME_DIR = path.join(os.homedir(), '.handsome-cli')
const SERVER_PORT = 41234

// 获取要同步的数据
async function getSyncData(): Promise<{ memory: any; evolve: any }> {
  const memoryDir = path.join(HANDSOME_DIR, 'memory')
  const evolveDir = path.join(HANDSOME_DIR, 'evolve')

  const data: any = { memory: {}, evolve: {} }

  // 读取 memory 目录
  try {
    const files = await fs.promises.readdir(memoryDir)
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.promises.readFile(path.join(memoryDir, file), 'utf-8')
        data.memory[file] = JSON.parse(content)
      }
    }
  } catch {
    // 目录不存在
  }

  // 读取 evolve 目录
  try {
    const files = await fs.promises.readdir(evolveDir)
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.promises.readFile(path.join(evolveDir, file), 'utf-8')
        data.evolve[file] = JSON.parse(content)
      }
    }
  } catch {
    // 目录不存在
  }

  return data
}

// 接收同步数据
async function receiveSyncData(data: { memory: any; evolve: any }): Promise<void> {
  const memoryDir = path.join(HANDSOME_DIR, 'memory')
  const evolveDir = path.join(HANDSOME_DIR, 'evolve')

  // 写入 memory
  await fs.promises.mkdir(memoryDir, { recursive: true })
  for (const [filename, content] of Object.entries(data.memory)) {
    await fs.promises.writeFile(
      path.join(memoryDir, filename),
      JSON.stringify(content, null, 2),
      'utf-8'
    )
  }

  // 写入 evolve
  await fs.promises.mkdir(evolveDir, { recursive: true })
  for (const [filename, content] of Object.entries(data.evolve)) {
    await fs.promises.writeFile(
      path.join(evolveDir, filename),
      JSON.stringify(content, null, 2),
      'utf-8'
    )
  }
}

// 创建 HTTP 服务器
export function createSyncServer(): http.Server {
  const server = http.createServer(async (req, res) => {
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }

    // 获取设备信息
    if (req.method === 'GET' && req.url === '/info') {
      const data = await getSyncData()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(data))
      return
    }

    // 接收同步数据
    if (req.method === 'POST' && req.url === '/sync') {
      let body = ''
      req.on('data', chunk => body += chunk)
      req.on('end', async () => {
        try {
          const data = JSON.parse(body)
          await receiveSyncData(data)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true }))
        } catch (error: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: error.message }))
        }
      })
      return
    }

    res.writeHead(404)
    res.end('Not Found')
  })

  server.listen(SERVER_PORT, () => {
    console.log(`[Sync] 同步服务器已启动，端口 ${SERVER_PORT}`)
  })

  return server
}

// 从远程设备拉取数据
export async function pullFromDevice(device: Device): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`http://${device.ip}:${device.port}/info`)

    if (!response.ok) {
      return { success: false, message: `请求失败: ${response.status}` }
    }

    const data = await response.json() as { memory: any; evolve: any }
    await receiveSyncData(data)

    return { success: true, message: '数据已同步' }
  } catch (error: any) {
    return { success: false, message: `连接失败: ${error.message}` }
  }
}

// 推送数据到远程设备
export async function pushToDevice(device: Device): Promise<{ success: boolean; message: string }> {
  try {
    const data = await getSyncData()

    const response = await fetch(`http://${device.ip}:${device.port}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      return { success: false, message: `请求失败: ${response.status}` }
    }

    const result = await response.json() as { success: boolean; error?: string }
    if (result.success) {
      return { success: true, message: '数据已推送' }
    } else {
      return { success: false, message: result.error || '推送失败' }
    }
  } catch (error: any) {
    return { success: false, message: `连接失败: ${error.message}` }
  }
}