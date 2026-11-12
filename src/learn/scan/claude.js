// Claude Code 源：~/.claude/history.jsonl 是全局输入历史，
// 每行 {display, pastedContents?, timestamp(ms), project, sessionId}，天然就是用户提问清单。
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

/** display 里的粘贴占位换成实际粘贴内容（拼接前 N 行，超长截断），还原用户真实输入。 */
function expandDisplay(entry) {
  const display = typeof entry.display === 'string' ? entry.display : ''
  const pasted = entry.pastedContents
  if (!pasted || typeof pasted !== 'object') return display
  return display.replace(/\[Pasted text #(\d+)[^\]]*\]/g, (match, id) => {
    const content = pasted[id]?.content
    return typeof content === 'string' ? content.split('\n').slice(0, 8).join(' ') : match
  })
}

/**
 * @param {{sinceMs: number, home?: string}} options - home 默认 ~/.claude。
 * @returns {Promise<Array<{source: 'claude', project: string, sessionId: string, text: string, at: string}>>}
 */
export async function scanClaude({ sinceMs, home } = {}) {
  const root = home ?? join(homedir(), '.claude')
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
