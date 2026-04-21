import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import os from 'os'
import archiver from 'archiver'

const HOME_DIR = os.homedir()
const HANDSOME_DIR = path.join(HOME_DIR, '.handsome-cli')

export interface ExportOptions {
  includeConfig?: boolean
  outputPath?: string
}

export interface ExportResult {
  success: boolean
  filePath: string
  error?: string
}

// 获取数据目录
async function getDataDirs(): Promise<string[]> {
  const dirs = [
    path.join(HANDSOME_DIR, 'memory'),
    path.join(HANDSOME_DIR, 'evolve')
  ]
  const result: string[] = []
  for (const dir of dirs) {
    try {
      await fsPromises.access(dir)
      result.push(dir)
    } catch {
      // 目录不存在，跳过
    }
  }
  return result
}

// 导出数据
export async function exportData(options: ExportOptions = {}): Promise<ExportResult> {
  const { includeConfig = false, outputPath } = options

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const defaultFileName = `handsome-backup-${timestamp}.zip`
    const outputFile = outputPath || path.join(process.cwd(), defaultFileName)

    // 确保输出目录存在
    const outputDir = path.dirname(outputFile)
    await fsPromises.mkdir(outputDir, { recursive: true })

    // 创建压缩流
    const output = fs.createWriteStream(outputFile)
    const archive = archiver('zip', { zlib: { level: 9 } })

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        resolve({
          success: true,
          filePath: outputFile
        })
      })

      archive.on('error', (err) => {
        resolve({
          success: false,
          filePath: outputFile,
          error: err.message
        })
      })

      archive.pipe(output)

      // 添加 memory 目录
      const memoryDir = path.join(HANDSOME_DIR, 'memory')
      archive.directory(memoryDir, 'memory')

      // 添加 evolve 目录
      const evolveDir = path.join(HANDSOME_DIR, 'evolve')
      archive.directory(evolveDir, 'evolve')

      // 可选：添加配置文件
      if (includeConfig) {
        const configFile = path.join(HANDSOME_DIR, 'config.yaml')
        archive.file(configFile, { name: 'config.yaml' })
      }

      archive.finalize()
    })
  } catch (error: any) {
    return {
      success: false,
      filePath: '',
      error: error.message
    }
  }
}