// Codex 源：~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl（近期明文）与
// ~/.codex/archived_sessions/*.zst（归档压缩）。首行 session_meta 带 cwd；
// 用户输入在 type=response_item、payload.message、role=user 的记录里（content[].text）。
// 只在文件 mtime 落入窗口时才解析，避免全量解压归档。
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { decodeZstdFile } from './zstd.js'

/** 递归收集目录下全部文件路径（sessions 是 年/月/日 三层结构）。 */
async function collectFiles(root) {
  const out = []
  let stack = [root]
  while (stack.length) {
    const dir = stack.pop()
    let names
    try {
      names = await readdir(dir, { withFileTypes: true })
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'EACCES') return out
      throw err
    }
    for (const entry of names) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.name.endsWith('.jsonl') || entry.name.endsWith('.jsonl.zst')) out.push(full)
    }
  }
  return out
}

async function readText(file) {
  if (file.endsWith('.zst')) return decodeZstdFile(file)
  return readFile(file, 'utf8')
}

/** 从一个 rollout 文件里取出用户真实输入（排除 AGENTS.md 等环境注入的首条记录）。 */
function extractUserMessages(body, sinceMs) {
  const out = []
  let cwd = ''
  let sessionId = ''
  for (const line of body.split('\n')) {
    if (!line.trim()) continue
    let record
    try {
      record = JSON.parse(line)
    } catch {
      continue
    }
    if (record.type === 'session_meta') {
      cwd = typeof record.payload?.cwd === 'string' ? record.payload.cwd : ''
      sessionId = typeof record.payload?.session_id === 'string' ? record.payload.session_id : ''
      continue
    }
    if (record.type !== 'response_item') continue
    const payload = record.payload
    if (payload?.type !== 'message' || payload.role !== 'user') continue
    const text = (Array.isArray(payload.content) ? payload.content : [])
      .filter((part) => part && typeof part.text === 'string')
      .map((part) => part.text)
      .join(' ')
      .trim()
    if (!text) continue
    // 环境注入的指令内容没有普通用户输入的对话性，跳过 AGENTS/环境上下文注入
    if (text.startsWith('# AGENTS.md instructions') || text.startsWith('<environment_context>')) continue
    const time = Date.parse(record.timestamp ?? '')
    if (!Number.isFinite(time) || time < sinceMs) continue
    out.push({ source: 'codex', project: cwd, sessionId, text, at: new Date(time).toISOString() })
  }
  return out
}

/**
 * @param {{sinceMs: number, home?: string}} options - home 默认 ~/.codex。
 * @returns {Promise<Array<{source: 'codex', project: string, sessionId: string, text: string, at: string}>>}
 */
export async function scanCodex({ sinceMs, home } = {}) {
  const root = home ?? join(homedir(), '.codex')
  const files = [
    ...(await collectFiles(join(root, 'sessions'))),
    ...(await collectFiles(join(root, 'archived_sessions'))),
  ]
  const out = []
  for (const file of files) {
    let info
    try {
      info = await stat(file)
    } catch {
      continue
    }
    // 窗口开始之后都没动过的文件不用解析；正在写的当天文件 mtime 恒新
    if (info.mtimeMs < sinceMs) continue
    let body
    try {
      body = await readText(file)
    } catch {
      continue // 单个文件损坏不拖垮整轮扫描
    }
    out.push(...extractUserMessages(body, sinceMs))
  }
  return out
}
