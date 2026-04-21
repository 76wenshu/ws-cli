import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import YAML from 'yaml'
import { Config, defaultConfig, BuiltinPlugin, ExternalPlugin } from './schema'

export type { BuiltinPlugin, ExternalPlugin }

// 替换环境变量 ${VAR_NAME}
function replaceEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)\}/g, (_, key) => {
    return process.env[key] || ''
  })
}

function replaceEnvVarsInObject(obj: any): any {
  if (typeof obj === 'string') {
    return replaceEnvVars(obj)
  }
  if (Array.isArray(obj)) {
    return obj.map(replaceEnvVarsInObject)
  }
  if (obj && typeof obj === 'object') {
    const result: any = {}
    for (const [key, val] of Object.entries(obj)) {
      result[key] = replaceEnvVarsInObject(val)
    }
    return result
  }
  return obj
}

export async function loadConfig(): Promise<Config> {
  const homedir = os.homedir()
  const configDir = path.join(homedir, '.handsome-cli')
  const configFile = path.join(configDir, 'config.yaml')

  try {
    const content = await fs.readFile(configFile, 'utf-8')
    const config = YAML.parse(content)
    return replaceEnvVarsInObject(config) as Config
  } catch {
    // 配置文件不存在，创建默认配置
    await fs.mkdir(configDir, { recursive: true })
    await fs.writeFile(configFile, YAML.stringify(defaultConfig), 'utf-8')
    console.log(`已创建默认配置文件: ${configFile}`)
    console.log('请编辑配置文件，填入你的 API Key')
    return defaultConfig
  }
}

export function getConfigPath(): string {
  return path.join(os.homedir(), '.handsome-cli', 'config.yaml')
}
