import chalk from 'chalk'

const logo = `
  HHHHH   HANDSOME
  H::::::H H:::::::H
  H:::::::HH:::::::H
  H:::HHHH:::::::HH
  HH::::H H::::::HH
   H::::H   H:::::H
   H::::H   H:::::H
   H::::HHHH::::::H
   H::::::H:::::::H
   H::::::H:::::::H
   H::::::H:::::::H
   HHHHH   HHHHHHH
`

export function welcome() {
  console.clear()
  console.log(chalk.cyan(logo))
  console.log(chalk.cyan('┌' + '─'.repeat(48) + '┐'))
  console.log(chalk.cyan('│') + chalk.cyan('你好！我是 Handsome Super，你的超级终端助手。') + chalk.cyan(' '.repeat(18) + '│'))
  console.log(chalk.cyan('│') + chalk.gray('─'.repeat(48)) + chalk.cyan('│'))
  console.log(chalk.cyan('│') + chalk.bold('我可以帮你：') + ' '.repeat(34) + chalk.cyan('│'))
  console.log(chalk.cyan('│') + '  ' + chalk.green('✓') + ' 记住你告诉我的事情' + ' '.repeat(25) + chalk.cyan('│'))
  console.log(chalk.cyan('│') + '  ' + chalk.green('✓') + ' 回答问题、聊聊天' + ' '.repeat(26) + chalk.cyan('│'))
  console.log(chalk.cyan('│') + '  ' + chalk.green('✓') + ' 执行终端命令' + ' '.repeat(27) + chalk.cyan('│'))
  console.log(chalk.cyan('│') + '  ' + chalk.green('✓') + ' 自我学习不断进化' + ' '.repeat(25) + chalk.cyan('│'))
  console.log(chalk.cyan('│') + chalk.gray('─'.repeat(48)) + chalk.cyan('│'))
  console.log(chalk.cyan('│') + chalk.yellow('输入 :q 或 quit 退出') + ' '.repeat(28) + chalk.cyan('│'))
  console.log(chalk.cyan('│') + chalk.yellow('输入 :help 查看帮助') + ' '.repeat(29) + chalk.cyan('│'))
  console.log(chalk.cyan('│') + chalk.yellow('输入 :evolve 查看我的成长') + ' '.repeat(24) + chalk.cyan('│'))
  console.log(chalk.cyan('└' + '─'.repeat(48) + '┘'))
}