import chalk from 'chalk'
import inquirer from 'inquirer'
import { processInput } from '../core/engine'
import { loadFullMemory, FullMemory } from '../memory'
import { getErrorLogs, formatLogs, getRecentLogs } from '../utils/logger'

const PROMPT = chalk.cyan('HandSome') + chalk.gray(' > ')

export async function run() {
  // 加载完整记忆
  const memory: FullMemory = await loadFullMemory()

  while (true) {
    const { input } = await inquirer.prompt([
      {
        type: 'input',
        name: 'input',
        message: PROMPT,
        prefix: ''
      }
    ])

    const trimmed = input.trim()

    // 退出命令
    if (trimmed === ':q' || trimmed === ':quit' || trimmed === 'quit' || trimmed === 'exit') {
      console.log(chalk.gray('\n再见！下次见~ 👋\n'))
      break
    }

    // 帮助命令
    if (trimmed === ':help' || trimmed === 'help') {
      printHelp()
      continue
    }

    // 空输入跳过
    if (!trimmed) {
      continue
    }

    // 处理输入并获取响应
    try {
      const response = await processInput(trimmed, memory)

      // 检查是否是退出命令
      if (response === '__EXIT__') {
        console.log(chalk.gray('\n再见！下次见~ 👋\n'))
        break
      }

      console.log(chalk.white(response) + '\n')
    } catch (error: any) {
      console.log(chalk.red(`\n出了问题: ${error.message}\n`))
    }

    // 查看日志命令
    if (trimmed === ':logs' || trimmed === ':日志') {
      const logs = await getErrorLogs(10)
      if (logs.length === 0) {
        console.log(chalk.gray('  没有错误日志~\n'))
      } else {
        console.log(chalk.yellow('=== 最近错误日志 ===\n'))
        console.log(formatLogs(logs))
        console.log(chalk.yellow('=====================\n'))
      }
      continue
    }
  }
}

function printHelp() {
  console.log(chalk.gray(`
  常用命令:
    :q, quit, exit      退出
    :profile            查看/设置用户画像
    :memory, :记忆      查看记忆状态
    :search <关键词>    搜索记忆
    :forget             清除所有记忆
    :sync on            开启局域网同步
    :export             导出数据
    :evolve             查看成长状态
    :logs, :日志        查看错误日志
  `))
}
