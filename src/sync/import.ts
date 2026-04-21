import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import extract from 'extract-zip'

const HOME_DIR = os.homedir()
const HANDSOME_DIR = path.join(HOME_DIR, '.handsome-cli')

export interface ImportOptions {
  overwrite?: boolean  // 是否覆盖已有数据
}

export interface ImportResult {
  success: boolean
  message: string
  error?: string
}

// 导入数据
export async function importData(zipPath: string, options: ImportOptions = {}): Promise<ImportResult> {
  const { overwrite = false } = options

  try {
    // 检查 zip 文件是否存在
    await fs.access(zipPath)

    // 创建临时解压目录
    const tempDir = path.join(os.tmpdir(), `handsome-import-${Date.now()}`)
    await fs.mkdir(tempDir, { recursive: true })

    // 解压文件
    await extract(zipPath, { dir: tempDir })

    // 检查解压后的目录结构
    const entries = await fs.readdir(tempDir)

    // 验证是否为有效的备份文件
    const hasMemory = entries.includes('memory')
    const hasEvolve = entries.includes('evolve')
    const hasConfig = entries.includes('config.yaml')

    if (!hasMemory && !hasEvolve) {
      await fs.rm(tempDir, { recursive: true, force: true })
      return {
        success: false,
        message: '无效的备份文件',
        error: '备份文件中不包含 memory 或 evolve 目录'
      }
    }

    // 如果不覆盖，检查是否已有数据
    if (!overwrite) {
      const existingMemory = path.join(HANDSOME_DIR, 'memory')
      const existingEvolve = path.join(HANDSOME_DIR, 'evolve')

      try {
        await fs.access(existingMemory)
        await fs.rm(tempDir, { recursive: true, force: true })
        return {
          success: false,
          message: '已存在数据',
          error: '请先使用 :forget 清除数据，或使用 --overwrite 参数覆盖'
        }
      } catch {
        // 不存在，可以继续
      }
    }

    // 确保目标目录存在
    await fs.mkdir(HANDSOME_DIR, { recursive: true })

    // 复制 memory 目录
    if (hasMemory) {
      const srcMemory = path.join(tempDir, 'memory')
      const destMemory = path.join(HANDSOME_DIR, 'memory')
      await copyDirectory(srcMemory, destMemory)
    }

    // 复制 evolve 目录
    if (hasEvolve) {
      const srcEvolve = path.join(tempDir, 'evolve')
      const destEvolve = path.join(HANDSOME_DIR, 'evolve')
      await copyDirectory(srcEvolve, destEvolve)
    }

    // 复制配置文件（可选）
    if (hasConfig) {
      const srcConfig = path.join(tempDir, 'config.yaml')
      const destConfig = path.join(HANDSOME_DIR, 'config.yaml')
      await fs.copyFile(srcConfig, destConfig)
    }

    // 清理临时目录
    await fs.rm(tempDir, { recursive: true, force: true })

    const imported: string[] = []
    if (hasMemory) imported.push('记忆')
    if (hasEvolve) imported.push('进化数据')
    if (hasConfig) imported.push('配置')

    return {
      success: true,
      message: `已成功导入：${imported.join('、')}`
    }
  } catch (error: any) {
    return {
      success: false,
      message: '导入失败',
      error: error.message
    }
  }
}

// 复制目录
async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}