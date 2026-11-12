// DSH 源：~/.dsh/sessions/<项目编码>/session-*/session.v4.jsonl(.zstd)。
// 取 type=user/message 且 data.source.kind=user 的事件（排除插件推的触发卡）；
// 项目路径取首行 session 记录的 cwd（目录名单横线编码与真实连字符有歧义，只作兜底展示）。
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { decodeZstdFile } from './zstd.js'

/** 目录名 → 大致路径（仅兜底展示用，横线歧义无解；前后 -- 是根路径定界）。 */
export function decodeProjectDir(name) {
  let text = name
  if (text.startsWith('--')) text = text.slice(2)
  if (text.endsWith('--')) text = text.slice(0, -2)
  const path = text.replaceAll('~0020', ' ').replaceAll('-', '/')
  return path.startsWith('/') ? path : `/${path}`
}

/** 解析一个会话文件：首行 session 拿 cwd，之后收集真人用户消息。 */
function parseSession(body, sinceMs, sessionId, fallbackProject) {
  const out = []
  let project = fallbackProject
  for (const line of body.split('\n')) {
    if (!line.trim()) continue
    let event
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    if (event.type === 'session' && typeof event.cwd === 'string' && event.cwd) {
      project = event.cwd
      continue
    }
    if (event.type !== 'user/message' || event.surfaceOp !== 'append') continue
    if (event.data?.source?.kind && event.data.source.kind !== 'user') continue
    const time = Number(event.time)
    if (!Number.isFinite(time) || time < sinceMs) continue
    const text = (Array.isArray(event.data?.content) ? event.data.content : [])
      .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join(' ')
      .trim()
    if (!text) continue
    out.push({ source: 'dsh', project, sessionId, text, at: new Date(time).toISOString() })
  }
  return out
}

/**
 * @param {{sinceMs: number, home?: string}} options - home 默认 ~/.dsh。
 * @returns {Promise<Array<{source: 'dsh', project: string, sessionId: string, text: string, at: string}>>}
 */
export async function scanDsh({ sinceMs, home } = {}) {
  const root = join(home ?? join(homedir(), '.dsh'), 'sessions')
  let projectDirs
  try {
    projectDirs = await readdir(root, { withFileTypes: true })
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }
  const out = []
  for (const projectEntry of projectDirs) {
    if (!projectEntry.isDirectory()) continue
    const fallbackProject = decodeProjectDir(projectEntry.name)
    const sessionDirs = await readdir(join(root, projectEntry.name), { withFileTypes: true }).catch(() => [])
    for (const sessionEntry of sessionDirs) {
      if (!sessionEntry.isDirectory() || !sessionEntry.name.startsWith('session-')) continue
      const sessionId = sessionEntry.name.replace(/^session-/, '')
      const dir = join(root, projectEntry.name, sessionEntry.name)
      for (const name of ['session.v4.jsonl.zstd', 'session.v4.jsonl']) {
        const file = join(dir, name)
        let info
        try {
          info = await stat(file)
        } catch {
          continue
        }
        if (info.mtimeMs < sinceMs) continue
        let body
        try {
          body = name.endsWith('.zstd') ? decodeZstdFile(file) : await readFile(file, 'utf8')
        } catch {
          break // 会话文件损坏（可能正被写入），跳过整个会话
        }
        out.push(...parseSession(body, sinceMs, sessionId, fallbackProject))
        break
      }
    }
  }
  return out
}
