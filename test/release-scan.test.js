// 发布前隐私扫描：个人路径、非示例邮箱、密钥样式、私有名单，以及样例数据和二进制文件的放行。
// 样例里的敏感样式一律用 s() 拼接，否则这个测试文件自己会被扫描拦下。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RULES, parseDeny, scanText, scanTree } from '../scripts/release-scan.mjs'

const s = (...parts) => parts.join('')
const rules = (text) => scanText(text).map((hit) => hit.rule)

test('个人家目录路径被拦，样例用户名放行', () => {
  assert.deepEqual(rules(s("vault: '/", 'Users/somebody/Documents/Notes\'')), ['个人家目录路径'])
  assert.deepEqual(rules(s('cwd = "C:', '\\Users\\somebody\\code"')), ['个人家目录路径'])
  for (const text of [s("'/", 'Users/x/My Vault\''), s('"/', 'Users/demo/Documents/sample/code dsh"'), s('"/', 'Users/…/My Vault"'), "'~/Documents/Notes'"]) {
    assert.deepEqual(scanText(text), [], text)
  }
})

test('真实邮箱被拦，示例域名和 noreply 放行', () => {
  assert.deepEqual(rules(s('联系 somebody', '@mail.example.org.cn')), ['非示例邮箱'])
  for (const text of ['me@example.com', 'hr@example.test', '59272886+Thomas-zz@users.noreply.github.com']) {
    assert.deepEqual(scanText(text), [], text)
  }
})

test('密钥与平台标识被拦', () => {
  for (const text of [
    s('key = "sk-', 'abcdefghijklmnopqrstuvwxyz0123"'),
    s('token=ghp_', 'abcdefghijklmnopqrstuvwxyz0123456789'),
    s('AKID', 'abcdefghijklmnopqrstuvwxyz1234'),
    s('-----BEGIN RSA PRIVATE ', 'KEY-----'),
    s('hook https://open.feishu.cn/open-apis/bot/v2/hook/', '0123456789abcdef0123456789abcdef'),
    s('appId: cli_', '0123456789abcdef'),
  ]) {
    assert.equal(scanText(text).length, 1, text)
  }
  assert.deepEqual(scanText("appId: 'cli_test', appSecret: 'not-for-state'"), [])
})

test('疑似真实凭据被拦，占位值和代码放行', () => {
  assert.deepEqual(rules(s('pass', "word: 'hunter2-hunter2'")), ['疑似真实凭据'])
  assert.deepEqual(rules(s('MAIL_TO', 'KEN="abcdef1234567890"')), ['疑似真实凭据'])
  for (const text of [
    "password: 'never-include'",
    "secret: '<在此填写>'",
    "token: 'your-token'",
    "appSecret: 'do-not-expose'",
    "password: 'private-fixture-password'",
    'const token = `${process.pid}:${randomUUID()}`',
  ]) {
    assert.deepEqual(scanText(text), [], text)
  }
})

test('私有名单按行解析，空行与注释忽略，大小写不敏感', () => {
  const deny = parseDeny('# 雇主内部系统\ninternal-foo\n\n内部系统名\n')
  assert.equal(deny.length, 2)
  assert.deepEqual(scanText('启动 Internal-FOO 联调', deny).map((hit) => hit.rule), ['本机私有名单「internal-foo」'])
  assert.equal(scanText('提到内部系统名的提交', deny).length, 1)
  assert.deepEqual(scanText('没有命中的文本', deny), [])
})

test('scanText 报告行号和摘录；scanTree 跳过 node_modules 与二进制', async () => {
  const root = mkdtempSync(join(tmpdir(), 'wb-scan-'))
  try {
    mkdirSync(join(root, 'node_modules', 'dep'), { recursive: true })
    writeFileSync(join(root, 'node_modules', 'dep', 'index.js'), s("const p = '/", "Users/somebody/'\n"))
    writeFileSync(join(root, 'a.md'), s('第一行\n路径 /', 'Users/somebody/vault 在这里\n'))
    writeFileSync(join(root, 'icon.bin'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x2f, 0x55]))
    writeFileSync(join(root, 'ok.txt'), '干净\n')
    const hits = await scanTree(root)
    assert.equal(hits.length, 1)
    assert.equal(hits[0].file, 'a.md')
    assert.equal(hits[0].line, 2)
    assert.match(hits[0].excerpt, /Users\/somebody\/vault/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
  assert.deepEqual(RULES.map((rule) => rule.name), ['个人家目录路径', '非示例邮箱', '密钥或平台标识', '疑似真实凭据'])
})
