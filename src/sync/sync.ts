import { EventEmitter } from 'events'
import { Device, DiscoveryManager, getDiscoveryManager } from './discovery'
import { createSyncServer, pullFromDevice, pushToDevice } from './transfer'

export interface SyncState {
  enabled: boolean
  serverRunning: boolean
  devices: Device[]
}

export interface SyncManagerEvents {
  'state-change': (state: SyncState) => void
  'sync-complete': (result: { success: boolean; message: string }) => void
  'error': (error: Error) => void
}

// 同步管理器
export class SyncManager extends EventEmitter {
  private discovery: DiscoveryManager
  private server: ReturnType<typeof createSyncServer> | null = null
  private state: SyncState = {
    enabled: false,
    serverRunning: false,
    devices: []
  }

  constructor() {
    super()
    this.discovery = getDiscoveryManager()

    // 监听设备发现事件
    this.discovery.on('device-found', (device: Device) => {
      if (!this.state.devices.find(d => d.ip === device.ip)) {
        this.state.devices.push(device)
        this.emitStateChange()
      }
    })

    this.discovery.on('device-lost', (device: Device) => {
      this.state.devices = this.state.devices.filter(d => d.ip !== device.ip)
      this.emitStateChange()
    })
  }

  private emitStateChange(): void {
    this.emit('state-change', { ...this.state })
  }

  // 启动同步服务
  async start(): Promise<void> {
    if (this.state.enabled) return

    // 启动 HTTP 服务器
    this.server = createSyncServer()
    this.state.serverRunning = true

    // 广播本设备
    this.discovery.publish()

    // 开始扫描
    this.discovery.startScan()

    this.state.enabled = true
    this.emitStateChange()
  }

  // 停止同步服务
  stop(): void {
    if (!this.state.enabled) return

    // 停止服务器
    if (this.server) {
      this.server.close()
      this.server = null
      this.state.serverRunning = false
    }

    // 停止发现
    this.discovery.stopScan()
    this.discovery.unpublish()

    this.state.enabled = false
    this.state.devices = []
    this.emitStateChange()
  }

  // 获取当前状态
  getState(): SyncState {
    return { ...this.state }
  }

  // 获取设备列表
  getDevices(): Device[] {
    return [...this.state.devices]
  }

  // 从设备拉取数据
  async pull(device: Device): Promise<{ success: boolean; message: string }> {
    const result = await pullFromDevice(device)
    this.emit('sync-complete', result)
    return result
  }

  // 推送到设备
  async push(device: Device): Promise<{ success: boolean; message: string }> {
    const result = await pushToDevice(device)
    this.emit('sync-complete', result)
    return result
  }
}

// 单例
let syncManager: SyncManager | null = null

export function getSyncManager(): SyncManager {
  if (!syncManager) {
    syncManager = new SyncManager()
  }
  return syncManager
}