#!/usr/bin/env node
import { run } from './cli/loop'
import { welcome } from './cli/welcome'
import { registerBuiltinPlugins, pluginManager } from './plugins'
import chalk from 'chalk'

async function main() {
  // 注册插件
  await registerBuiltinPlugins()

  await welcome()

  // 显示插件状态
  const plugins = pluginManager.list()
  if (plugins.length > 0) {
    console.log(chalk.gray(`  [已加载 ${plugins.length} 个插件]`))
  }

  await run()
}

main()
