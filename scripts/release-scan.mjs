// 发布前的隐私扫描：对将要公开的文本逐行匹配，命中即阻断发布。
// 这里的通用规则随仓库公开；账号、雇主、内部系统名这类本机专属词放 .local/release-deny.txt，不进仓库。
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

const GENERIC_USERS = new Set(['x', 'demo', 'example', 'you', 'user', 'someone', 'test', 'sample', 'username', 'alice', 'bob', '…', '\\u2026', '...', 'your-name'])
const EXAMPLE_DOMAIN = /@(?:[a-z0-9-]+\.)*(?:example\.(?:com|org|net|test|invalid)|localhost|users\.noreply\.github\.com)$/i
const PLACEHOLDER_VALUE = /^(?:never|not|no-|do-not|don-?t|example|your|xxx+|<|\*+|…|\.\.\.|test|fake|dummy|sample|placeholder|redacted|changeme|bad|wrong)|-(?:fixture|sample|example)(?:-|$)/i

/** 每条规则都是带 g 标志的正则；allow 命中的匹配视为样例数据。 */
export const RULES = [
  {
    name: '个人家目录路径',
    regex: /\/(?:Users|home)\/([^/\s"'`]+)\/|C:\\Users\\([^\\\s"'`]+)\\/g,
    allow: (m) => GENERIC_USERS.has((m[1] || m[2]).toLowerCase()),
  },
  { name: '非示例邮箱', regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, allow: (m) => EXAMPLE_DOMAIN.test(m[0]) },
  {
    name: '密钥或平台标识',
    regex: /\b(?:sk|pk|rk)[-_](?:[a-z0-9]{2,10}-){0,3}[A-Za-z0-9]{20,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bAKID[A-Za-z0-9]{13,}|\bLTAI[A-Za-z0-9]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bxox[bpa]-[A-Za-z0-9-]{10,}|\bou_[0-9a-f]{32}\b|\bcli_[0-9a-f]{16}\b|open-apis\/bot\/v2\/hook\/[0-9a-f-]{16,}|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g,
  },
  {
    name: '疑似真实凭据',
    // 值里出现 $ { } \ 多半是代码或模板，不是写死的凭据。
    regex: /(?:password|passwd|secret|token|api[_-]?key)["']?\s*[:=]\s*["'`]([^"'`\s${}\\]{6,})["'`]/gi,
    allow: (m) => PLACEHOLDER_VALUE.test(m[1]),
  },
]

/** 把「一行一个正则」的私有名单文本解析成规则；空行和 # 开头的行忽略。 */
export function parseDeny(text) {
  return text.split('\n').map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((source) => ({ name: `本机私有名单「${source}」`, regex: new RegExp(source, 'gi') }))
}

/** 扫一段文本，返回每处命中的行号、规则和上下文摘录。 */
export function scanText(text, rules = RULES) {
  const found = []
  text.split('\n').forEach((line, index) => {
    for (const rule of rules) {
      for (const match of line.matchAll(rule.regex)) {
        if (!rule.allow?.(match)) found.push({ line: index + 1, rule: rule.name, excerpt: line.slice(Math.max(0, match.index - 30), match.index + match[0].length + 30).trim() })
      }
    }
  })
  return found
}

/** 扫一个目录里的全部文本文件；跳过 node_modules、.git 和二进制文件。 */
export async function scanTree(root, rules = RULES) {
  const found = []
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const path = join(dir, entry.name)
      if (entry.isDirectory()) { await walk(path); continue }
      if (!entry.isFile()) continue
      const buffer = await readFile(path)
      if (buffer.subarray(0, 8000).includes(0)) continue
      for (const hit of scanText(buffer.toString('utf8'), rules)) found.push({ file: relative(root, path), ...hit })
    }
  }
  await walk(root)
  return found
}
