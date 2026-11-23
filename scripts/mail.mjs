#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { Store } from '../src/store.js'
import {
  mailSettings,
  configureMailConnection,
  testMailConnection,
} from '../src/mail.js'

const help = `工作台邮箱接入（只读连接；不收取正文或触发整理）
node scripts/mail.mjs status [--state-root <工作台数据目录>]
node scripts/mail.mjs check [--state-root <工作台数据目录>]
node scripts/mail.mjs configure --host <IMAP主机> --user <登录账号> [--address <收件地址>] [--port 993] [--tls-mode tls|starttls] [--folder INBOX] [--password-stdin] [--state-root <工作台数据目录>]
configure 在真实连接成功后才保存。已有同一账号的密码可复用；新密码仅通过 --password-stdin 读取标准输入，不接受命令行密码参数。
默认不开启自动收取，已有自动收取偏好保持。默认数据目录为 $DSH_HOME/workbench 或 ~/.dsh/workbench。请优先使用界面 Prompt 给出的 --state-root。
`
try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: 'boolean' },
      'state-root': { type: 'string' },
      host: { type: 'string' },
      user: { type: 'string' },
      address: { type: 'string' },
      port: { type: 'string' },
      'tls-mode': { type: 'string' },
      folder: { type: 'string' },
      'password-stdin': { type: 'boolean' },
    },
  })
  const command = positionals[0]
  if (values.help || !command) console.log(help)
  else {
    const store = new Store(values['state-root'])
    let result
    if (command === 'status') result = { config: await mailSettings(store) }
    else if (command === 'check') result = await testMailConnection(store)
    else if (command === 'configure') {
      if (!values.host?.trim() || !values.user?.trim())
        throw new Error('请指定 IMAP 主机和登录账号')
      if (
        values['tls-mode'] &&
        !['tls', 'starttls'].includes(values['tls-mode'])
      )
        throw new Error('连接方式必须为 tls 或 starttls')
      if (
        values.port &&
        (!/^\d+$/.test(values.port) || +values.port < 1 || +values.port > 65535)
      )
        throw new Error('端口无效')
      const body = {
        host: values.host,
        user: values.user,
        address: values.address || values.user,
        port: values.port
          ? +values.port
          : values['tls-mode'] === 'starttls'
            ? 143
            : 993,
        tlsMode: values['tls-mode'] || 'tls',
        folder: values.folder || 'INBOX',
      }
      if (values['password-stdin']) {
        if (process.stdin.isTTY)
          throw new Error(
            '请通过安全凭证来源传入标准输入，或在工作台密码框输入；不要在会回显的终端输入授权码',
          )
        let password = ''
        for await (const chunk of process.stdin) {
          password += chunk.toString()
          if (Buffer.byteLength(password) > 16384)
            throw new Error('授权码输入过长')
        }
        body.password = password.replace(/\r?\n$/, '')
        if (!body.password) throw new Error('标准输入未提供授权码')
      }
      result = await configureMailConnection(store, body)
    } else throw new Error('未知命令，请使用 --help')
    console.log(JSON.stringify({ ok: true, ...result }, null, 2))
  }
} catch (error) {
  // Argument parsing errors may echo user-provided secrets; never print them.
  console.error(
    JSON.stringify({
      ok: false,
      error: error.code?.startsWith('ERR_PARSE_ARGS')
        ? '命令参数无效，请查看 --help；不要把授权码放进命令参数'
        : error.message,
    }),
  )
  process.exitCode = 1
}
