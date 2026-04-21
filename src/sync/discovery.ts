import bonjour, { Browser, RemoteService } from 'bonjour'
import os from 'os'
import { EventEmitter } from 'events'

const SERVICE_TYPE = 'handsome'
const SERVICE_PORT = 41234

export interface Device {
  name: string
  host: string
  port: number
  ip: string
}

export interface SyncEvents {
  'device-found': (device: Device) => void
  'device-lost': (device: Device) => void
}

// 局域网发现管理器
export class DiscoveryManager extends EventEmitter {
  private browser: Browser | null = null
  private published: boolean = false
  private serviceName: string

  constructor() {
    super()
    // 使用设备名作为服务名
    this.serviceName = os.hostname()
  }

  // 广播本设备（让其他设备发现）
  publish(): void {
    if (this.published) return

    const bonjourInstance = bonjour()

    // 发布服务
    bonjourInstance.publish({
      name: this.serviceName,
      type: SERVICE_TYPE,
      port: SERVICE_PORT,
      txt: {
        version: '1.0.0',
        device: os.platform()
      }
    })

    this.published = true
    console.log(`[Sync] 已广播服务: ${this.serviceName}`)
  }

  // 停止广播
  unpublish(): void {
    if (!this.published) return

    const bonjourInstance = bonjour()
    bonjourInstance.destroy()
    this.published = false
  }

  // 开始扫描设备
  startScan(): void {
    if (this.browser) return

    const bonjourInstance = bonjour()
    this.browser = bonjourInstance.find({ type: SERVICE_TYPE })

    this.browser.on('up', (service: RemoteService) => {
      // 过滤掉自己的服务
      if (service.name === this.serviceName) return

      // 获取 IP 地址
      const address = service.addresses?.[0] || service.host
      const port = service.port || SERVICE_PORT

      const device: Device = {
        name: service.name,
        host: service.host || address,
        port: port,
        ip: address
      }

      console.log(`[Sync] 发现设备: ${device.name} (${device.ip})`)
      this.emit('device-found', device)
    })

    this.browser.on('down', (service: RemoteService) => {
      const address = service.addresses?.[0] || service.host

      const device: Device = {
        name: service.name,
        host: service.host || address,
        port: service.port || SERVICE_PORT,
        ip: address
      }

      console.log(`[Sync] 设备离线: ${device.name}`)
      this.emit('device-lost', device)
    })

    console.log(`[Sync] 开始扫描局域网中的 HandSome 设备...`)
  }

  // 停止扫描
  stopScan(): void {
    if (this.browser) {
      this.browser.stop()
      this.browser = null
    }
  }

  // 销毁
  destroy(): void {
    this.stopScan()
    this.unpublish()
    this.removeAllListeners()
  }
}

// 单例
let instance: DiscoveryManager | null = null

export function getDiscoveryManager(): DiscoveryManager {
  if (!instance) {
    instance = new DiscoveryManager()
  }
  return instance
}