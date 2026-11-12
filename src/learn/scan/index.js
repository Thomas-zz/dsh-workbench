// 扫描入口：并行跑各 harness 适配器，统一容错（单源失败记入 errors 不拖垮整轮）。
import { scanZcode } from './zcode.js'
import { scanClaude } from './claude.js'
import { scanCodex } from './codex.js'
import { scanDsh } from './dsh.js'

export const LEARN_SOURCES = ['zcode', 'dsh', 'claude', 'codex']

const SCANNERS = {
  zcode: scanZcode,
  dsh: scanDsh,
  claude: scanClaude,
  codex: scanCodex,
}

/**
 * 扫描各源的用户输入。
 * @param {{sinceMs: number, sources?: string[], homes?: {zcode?: string, dsh?: string, claude?: string, codex?: string}}} options
 * @returns {Promise<{messages: Array<{source: string, project: string, sessionId: string, text: string, at: string}>, errors: Array<{source: string, error: string}>}>}
 */
export async function scanRaw({ sinceMs, sources = LEARN_SOURCES, homes = {} } = {}) {
  const jobs = []
  for (const source of sources) {
    const scanner = SCANNERS[source]
    if (!scanner) continue
    jobs.push(scanner({ sinceMs, home: homes[source] }).then(
      (messages) => ({ source, messages }),
      (error) => ({ source, messages: [], error: error instanceof Error ? error.message : String(error) }),
    ))
  }
  const settled = await Promise.all(jobs)
  const messages = []
  const errors = []
  for (const result of settled) {
    messages.push(...result.messages)
    if (result.error) errors.push({ source: result.source, error: result.error })
  }
  return { messages, errors }
}
