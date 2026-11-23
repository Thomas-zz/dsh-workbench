#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { Store } from '../src/store.js'
import {
  calendarSettings,
  configureCalendarConnection,
  checkCalendarConnection,
} from '../src/calendar.js'
const help = `工作台飞书接入（不接收密钥，不创建日程）
node scripts/calendar.mjs status [--state-root <工作台数据目录>]
node scripts/calendar.mjs check [--state-root <工作台数据目录>]
node scripts/calendar.mjs configure --profile <profile> --app-id <cli_xxx> --name <应用名称> [--calendar-id primary] [--cli-path <绝对路径>] [--state-root <工作台数据目录>]
configure 核对应用并实际读取用户日历，成功才保存。check 强制重新读取未来七天，不输出日程内容。
默认数据目录为 $DSH_HOME/workbench 或 ~/.dsh/workbench。使用工作台给出的 --state-root 可确保配置的是当前宿主。
`
try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean' },
      'state-root': { type: 'string' },
      profile: { type: 'string' },
      'app-id': { type: 'string' },
      name: { type: 'string' },
      'calendar-id': { type: 'string' },
      'cli-path': { type: 'string' },
    },
  })
  const command = positionals[0]
  if (values.help || !command) console.log(help)
  else {
    const store = new Store(values['state-root'])
    let result
    if (command === 'status')
      result = { config: calendarSettings(await store.read()) }
    else if (command === 'check') result = await checkCalendarConnection(store)
    else if (command === 'configure')
      result = await configureCalendarConnection(store, {
        profile: values.profile,
        appId: values['app-id'],
        appName: values.name,
        calendarId: values['calendar-id'] || 'primary',
        cliPath: values['cli-path'] || '',
      })
    else throw new Error('未知命令，请使用 --help')
    console.log(
      JSON.stringify(
        { ok: command !== 'check' || result.status === 'ready', ...result },
        null,
        2,
      ),
    )
    if (command === 'check' && result.status !== 'ready') process.exitCode = 1
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }))
  process.exitCode = 1
}
