import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Store } from '../src/store.js'
import {
  configureMailConnection,
  mailSettings,
  testMailConnection,
} from '../src/mail.js'
import { mailSetupPrompt } from '../src/mail-setup.js'

const exec = promisify(execFile)
test('邮箱配置先验证再写入，失败保留凭证和任务，成功不暴露密码或自动收取', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wb-mail-setup-'))
  try {
    const store = new Store(root)
    await store.mutate('fixture', (s) => {
      s.ideas.push({ id: 'keep', text: '保留事项' })
    })
    const body = {
      host: 'imap.example.test',
      user: 'me@example.test',
      password: 'private-fixture-password',
    }
    let reads = 0
    const mailbox = async (config, signal, action) => {
      reads++
      assert.equal(config.password, body.password)
      return action({ mailbox: { exists: 0 } })
    }
    const result = await configureMailConnection(store, body, { mailbox })
    assert.equal(result.status, 'ready')
    assert.equal(result.messages, 0)
    assert.equal(result.config.automatic, false)
    assert.ok(!JSON.stringify(result).includes(body.password))
    const before = await readFile(join(root, 'mail-account.json'), 'utf8')
    const stateBefore = await readFile(join(root, 'state.json'), 'utf8')
    assert.ok(!stateBefore.includes(body.password))
    assert.equal(
      (await stat(join(root, 'mail-account.json'))).mode & 0o777,
      0o600,
    )
    await assert.rejects(
      configureMailConnection(
        store,
        { ...body, host: 'wrong.example.test', password: 'bad-secret' },
        {
          mailbox: async () => {
            throw new Error('server echoes bad-secret')
          },
        },
      ),
      (error) =>
        !error.message.includes('bad-secret') && /连接失败/.test(error.message),
    )
    assert.equal(
      await readFile(join(root, 'mail-account.json'), 'utf8'),
      before,
    )
    assert.equal(await readFile(join(root, 'state.json'), 'utf8'), stateBefore)
    const checked = await testMailConnection(store, { mailbox })
    assert.equal(checked.status, 'ready')
    assert.equal(reads, 2)
    assert.ok(!JSON.stringify(checked).includes(body.password))
    assert.equal((await mailSettings(store)).hasPassword, true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
test('邮箱 CLI status 不输出凭证，拒绝命令行密码且不回显', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wb-mail-cli-'))
  const script = new URL('../scripts/mail.mjs', import.meta.url).pathname
  try {
    const status = JSON.parse(
      (await exec(process.execPath, [script, 'status', '--state-root', root]))
        .stdout,
    )
    assert.equal(status.ok, true)
    assert.equal(status.config.hasPassword, false)
    await assert.rejects(
      exec(process.execPath, [
        script,
        'configure',
        '--password=never-echo-me',
        '--state-root',
        root,
      ]),
      (e) => {
        assert.ok(!e.stderr.includes('never-echo-me'))
        assert.equal(JSON.parse(e.stderr).ok, false)
        return true
      },
    )
    await assert.rejects(
      exec(process.execPath, [script, 'check', '--state-root', root]),
      (e) => {
        assert.match(JSON.parse(e.stderr).error, /请先保存/)
        return true
      },
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
test('邮箱 Prompt 使用实际工作台目录并明确授权码和正文处理边界', () => {
  const prompt = mailSetupPrompt({
    scriptPath: '/with space/mail.mjs',
    stateRoot: '/real host/data',
    config: { address: 'me@example.test', password: 'never-include' },
  })
  assert.ok(prompt.includes(JSON.stringify('/with space/mail.mjs')))
  assert.ok(prompt.includes(JSON.stringify('/real host/data')))
  assert.match(prompt, /--password-stdin/)
  assert.match(prompt, /不要自动触发邮件整理/)
  assert.ok(!prompt.includes('never-include'))
})
