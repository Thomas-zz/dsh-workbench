// ZCode 源：读 ~/.zcode/cli/db/db.sqlite 的 input_history 表（用户每次输入一行），
// join session 拿项目目录。node:sqlite 只读打开，与正在运行的 ZCode 进程互不干扰。
import { join } from 'node:path'
import { homedir } from 'node:os'

/**
 * @param {{sinceMs: number, home?: string}} options - home 默认 ~/.zcode。
 * @returns {Promise<Array<{source: 'zcode', project: string, sessionId: string, text: string, at: string}>>}
 */
export async function scanZcode({ sinceMs, home } = {}) {
  const root = home ?? join(homedir(), '.zcode')
  const { DatabaseSync } = await import('node:sqlite')
  const db = new DatabaseSync(join(root, 'cli', 'db', 'db.sqlite'), { readOnly: true })
  try {
    const rows = db.prepare(`
      SELECT ih.text AS text, ih.time_created AS time, ih.session_id AS sessionId, s.directory AS directory
      FROM input_history ih
      LEFT JOIN session s ON s.id = ih.session_id
      WHERE ih.time_created >= ? AND ih.kind = 'prompt'
      ORDER BY ih.time_created DESC
    `).all(sinceMs)
    return rows.map((row) => ({
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
