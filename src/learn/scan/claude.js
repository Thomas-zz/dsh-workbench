// Claude Code 源：~/.claude/history.jsonl 是全局输入历史，
// 每行 {display, pastedContents?, timestamp(ms), project, sessionId}，天然就是用户提问清单。
import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

/** display 里的粘贴占位换成实际粘贴内容（拼接前 N 行，超长截断），还原用户真实输入。 */
function expandDisplay(entry) {
  const display = typeof entry.display === 'string' ? entry.display : ''
  const pasted = entry.pastedContents
  if (!pasted || typeof pasted !== 'object') return display
  return display.replace(/\[Pasted text #(\d+)[^\]]*\]/g, (match, id) => {
    const content = pasted[id]?.content
    return typeof content === 'string'
      ? content.split('\n').slice(0, 8).join(' ')
      : match
  })
}

/**
 * @param {{sinceMs: number, home?: string}} options - home 默认 ~/.claude。
 * @returns {Promise<Array<{source: 'claude', project: string, sessionId: string, text: string, at: string}>>}
 */
export async function scanClaude({
  sinceMs = 0,
  home,
  includeAssistant = false,
  strict = false,
  strictRecords = false,
  sessionId,
} = {}) {
  const root = home ?? join(homedir(), '.claude')
  if (includeAssistant)
    return scanTranscripts(root, { sinceMs, strict, strictRecords, sessionId })
  let body
  try {
    body = await readFile(join(root, 'history.jsonl'), 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }
  const out = []
  for (const line of body.split('\n')) {
    if (!line.trim()) continue
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    if (sessionId && entry.sessionId !== sessionId) continue
    const time = Number(entry.timestamp)
    if (!Number.isFinite(time) || time < sinceMs) continue
    const text = expandDisplay(entry)
    if (!text) continue
    out.push({
      source: 'claude',
      project: typeof entry.project === 'string' ? entry.project : '',
      sessionId: typeof entry.sessionId === 'string' ? entry.sessionId : '',
      text,
      at: new Date(time).toISOString(),
    })
  }
  return out
}

// Conversation mode reads responses as well as requests. Input history remains the
// learning scanner's compatibility path; it is never presented as a full transcript.
async function scanTranscripts(root, { sinceMs, strict, strictRecords, sessionId }) {
  const out = []
  let projects
  try {
    projects = await readdir(join(root, 'projects'), { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
  for (const project of projects.filter((p) => p.isDirectory())) {
    const directory = join(root, 'projects', project.name)
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue
      if (sessionId && entry.name !== `${sessionId}.jsonl`) continue
      const file = join(directory, entry.name)
      try {
        if ((await stat(file)).mtimeMs < sinceMs) continue
        for (const line of (await readFile(file, 'utf8')).split('\n')) {
          if (!line.trim()) continue
          let row
          try {
            row = JSON.parse(line)
          } catch {
            if (strictRecords) throw new Error('Claude 会话日志不完整，请稍后重试')
            continue
          }
          if (row.isSidechain || row.isMeta) continue
          const role = row.message?.role
          if (!['user', 'assistant'].includes(role)) continue
          const at = Date.parse(row.timestamp)
          if (!Number.isFinite(at) || at < sinceMs) continue
          const content = row.message.content
          const text =
            typeof content === 'string'
              ? content
              : (Array.isArray(content) ? content : [])
                  .filter(
                    (p) => p.type === 'text' && typeof p.text === 'string',
                  )
                  .map((p) => p.text)
                  .join('\n')
          if (!text.trim()) continue
          out.push({
            source: 'claude',
            project: row.cwd || '',
            sessionId: row.sessionId || entry.name.slice(0, -6),
            role,
            text,
            at: new Date(at).toISOString(),
          })
        }
      } catch (error) {
        if (strict && error.code !== 'ENOENT') throw error
      }
    }
  }
  return out
}
