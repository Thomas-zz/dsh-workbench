// ZCode 源：读 ~/.zcode/cli/db/db.sqlite 的 input_history 表（用户每次输入一行），
// join session 拿项目目录。node:sqlite 只读打开，与正在运行的 ZCode 进程互不干扰。
import { join } from 'node:path'
import { homedir } from 'node:os'

/**
 * @param {{sinceMs: number, home?: string}} options - home 默认 ~/.zcode。
 * @returns {Promise<Array<{source: 'zcode', project: string, sessionId: string, text: string, at: string}>>}
 */
export async function scanZcode({
  sinceMs = 0,
  untilMs = Number.MAX_SAFE_INTEGER,
  home,
  includeAssistant = false,
  sessionId,
} = {}) {
  const root = home ?? join(homedir(), '.zcode')
  const { DatabaseSync } = await import('node:sqlite')
  const db = new DatabaseSync(join(root, 'cli', 'db', 'db.sqlite'), {
    readOnly: true,
  })
  try {
    if (includeAssistant) {
      const rows = db
        .prepare(
          `
        SELECT m.id, m.session_id AS sessionId, m.time_created AS time, m.data,
          p.data AS part, s.directory AS directory
        FROM message m JOIN session s ON s.id = m.session_id
        JOIN part p ON p.message_id = m.id
        WHERE m.time_created >= ? AND m.time_created < ? AND (? IS NULL OR m.session_id = ?)
          AND json_extract(m.data, '$.role') IN ('user', 'assistant')
          AND json_extract(p.data, '$.type') = 'text'
        ORDER BY m.time_created, m.id, p.time_created, p.id
      `,
        )
        .all(sinceMs, untilMs, sessionId || null, sessionId || null)
      const messages = new Map()
      for (const row of rows) {
        const meta = JSON.parse(row.data),
          part = JSON.parse(row.part)
        if (
          !['user', 'assistant'].includes(meta.role) ||
          meta.synthetic ||
          meta.summary
        )
          continue
        if (
          part.type !== 'text' ||
          part.synthetic ||
          part.ignored ||
          typeof part.text !== 'string'
        )
          continue
        if (!messages.has(row.id))
          messages.set(row.id, {
            source: 'zcode',
            project: row.directory || '',
            sessionId: row.sessionId,
            role: meta.role,
            text: '',
            at: new Date(Number(row.time)).toISOString(),
          })
        const message = messages.get(row.id)
        message.text += (message.text ? '\n' : '') + part.text
      }
      return [...messages.values()].filter((m) => m.text.trim())
    }
    const rows = db
      .prepare(
        `
      SELECT ih.text AS text, ih.time_created AS time, ih.session_id AS sessionId, s.directory AS directory
      FROM input_history ih
      LEFT JOIN session s ON s.id = ih.session_id
      WHERE ih.time_created >= ? AND ih.kind = 'prompt'
      ORDER BY ih.time_created DESC
    `,
      )
      .all(sinceMs)
    return rows
      .filter((row) => !sessionId || row.sessionId === sessionId)
      .map((row) => ({
        source: 'zcode',
        project: typeof row.directory === 'string' ? row.directory : '',
        sessionId: typeof row.sessionId === 'string' ? row.sessionId : '',
        text: typeof row.text === 'string' ? row.text : '',
        at: new Date(Number(row.time)).toISOString(),
      }))
  } finally {
    db.close()
  }
}
