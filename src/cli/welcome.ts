import chalk from 'chalk'
import { getProfile } from '../evolve/profile'

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

// 根据时间获取问候语
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 9) return '早上好'
  if (hour >= 9 && hour < 12) return '上午好'
  if (hour >= 12 && hour < 14) return '中午好'
  if (hour >= 14 && hour < 18) return '下午好'
  if (hour >= 18 && hour < 22) return '晚上好'
  return '夜深了'
}

export async function welcome() {
  console.clear()
  console.log(chalk.cyan(logo))

  // 获取用户信息
  const profile = await getProfile()
  const greeting = getGreeting()
  const userName = profile.name ? `，${profile.name}` : ''

  console.log(chalk.cyan('┌' + '─'.repeat(48) + '┐'))
  console.log(chalk.cyan('│') + chalk.cyan(`${greeting}${userName}！你的双胞胎伙伴在这~`) + chalk.cyan(' '.repeat(20 - userName.length) + '│'))
  console.log(chalk.cyan('│') + chalk.gray('─'.repeat(48)) + chalk.cyan('│'))
  console.log(chalk.cyan('│') + chalk.bold('我可以陪你：') + ' '.repeat(36) + chalk.cyan('│'))
  console.log(chalk.cyan('│') + '  ' + chalk.green('❤') + ' 倾听你的喜怒哀乐' + ' '.repeat(26) + chalk.cyan('│'))
  console.log(chalk.cyan('│') + '  ' + chalk.green('❤') + ' 记住关于你的一切' + ' '.repeat(26) + chalk.cyan('│'))
  console.log(chalk.cyan('│') + '  ' + chalk.green('❤') + ' 陪你一起成长' + ' '.repeat(29) + chalk.cyan('│'))
  console.log(chalk.cyan('│') + '  ' + chalk.green('❤') + ' 帮你处理工作事务' + ' '.repeat(26) + chalk.cyan('│'))
  if (profile.job) {
    console.log(chalk.cyan('│') + '  ' + chalk.green('❤') + ` 作为${profile.job}与你并肩作战` + ' '.repeat(21) + chalk.cyan('│'))
  }
  console.log(chalk.cyan('│') + chalk.gray('─'.repeat(48)) + chalk.cyan('│'))
  console.log(chalk.cyan('│') + chalk.yellow('输入 :q 退出，我们下次见~') + ' '.repeat(21) + chalk.cyan('│'))
  console.log(chalk.cyan('│') + chalk.yellow('输入 :profile 让我更了解你') + ' '.repeat(22) + chalk.cyan('│'))
  console.log(chalk.cyan('│') + chalk.yellow('输入 :evolve 看我们的成长') + ' '.repeat(23) + chalk.cyan('│'))
  console.log(chalk.cyan('└' + '─'.repeat(48) + '┘'))
}