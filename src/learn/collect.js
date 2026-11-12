// 学习收集（纯代码，零模型成本）：扫描各 harness → heuristic 预筛 → 排除已落库
// → 挂上相关概念历史计数。collect 工具、nightly 触发卡统计、面板预览共用这一份口径。
import { scanRaw } from './scan/index.js'
import { extractCandidates, dedupeKey } from './scan/heuristic.js'
import { learnView } from '../ops.js'

/** state 里已处理过的 key 集合（已记录条目 + 收件箱）。 */
export function processedKeys(state) {
  return new Set([
    ...state.learn.entries.map((row) => row.key).filter(Boolean),
    ...state.learn.inbox.map((row) => dedupeKey(row.question)).filter(Boolean),
  ])
}

/**
 * 收集一轮候选提问。
 * @param {object} state - 工作台 state（取配置与已处理 key）。
 * @param {{hours?: number, limit?: number}} [options] - hours 默认自上次整理以来（无记录则 24h）。
 * @returns {Promise<{candidates: Array<{text: string, source: string, project: string, at: string, key: string, related?: string[]}>,
 *   inbox: object[], concepts: object[], stats: {hours: number, rawCount: number, bySource: object}, errors: Array<{source: string, error: string}>}>}
 */
export async function collectCandidates(state, { hours, limit = 60 } = {}) {
  const windowHours = Number.isFinite(hours) && hours > 0
    ? hours
    : Math.max(1, Math.min(168, Math.round((Date.now() - Date.parse(state.learn.flags?.lastCollectAt ?? '')) / 3_600_000) || 24))
  const sources = Object.entries(state.learn.config.sources).filter(([, on]) => on).map(([name]) => name)
  const { messages, errors } = await scanRaw({ sinceMs: Date.now() - windowHours * 3_600_000, sources })
  const candidates = extractCandidates(messages, { limit, excludeKeys: processedKeys(state) })

  // 相关弱项提示：候选文本撞上已有概念（互相包含）时挂上，帮助 agent 判断「又问了」
  const view = learnView(state)
  const known = view.concepts.filter((row) => row.count >= 1)
  for (const candidate of candidates) {
    const hits = known
      .filter((row) => candidate.text.includes(row.concept) || row.concept.includes(candidate.text.slice(0, 20)))
      .map((row) => `${row.concept}(已问${row.count}次)`)
    if (hits.length) candidate.related = hits.slice(0, 3)
  }

  const bySource = {}
  for (const row of messages) bySource[row.source] = (bySource[row.source] ?? 0) + 1
  return {
    candidates,
    inbox: state.learn.inbox,
    concepts: view.concepts,
    knowledge: state.learn.entries.filter((row) => row.status !== 'ignored').slice(0, 100).map(({id,title,concept,answer,kind,parentIds}) => ({id,title,concept,answer:answer.slice(0, 600),kind,parentIds})),
    contextSignals: collectContextSignals(messages, state),
    stats: { hours: windowHours, rawCount: messages.length, bySource },
    errors,
  }
}

/** 整理一轮后更新「上次收集时间」标记（nightly / 手动整理成功后调用）。 */
export function markCollected(draft) {
  draft.learn.flags.lastCollectAt = new Date().toISOString()
}

/** 补充“没理解/概念混淆/请求举例”等线索及同一会话前后输入；不是知识缺口结论。 */
export function collectContextSignals(messages, state) {
  const hints = /不(?:太)?(?:懂|理解|明白|清楚)|没(?:太)?(?:懂|理解|明白)|混淆|举(?:个|一|些)?.{0,4}例|通俗|再解释|我的理解|我以为|不是.{0,20}吗|再讲|有什么用|是不是可以理解|区别|原理|概念|为什么/u
  const rows = messages.filter((row) => typeof row.text === 'string' && row.text.length <= 12000 && !/^\s*(?:<|# AGENTS|\{|\[|\/)/u.test(row.text)).sort((a,b) => a.at.localeCompare(b.at))
  const selected = [...new Set([...rows.filter((row) => hints.test(row.text)).slice(-24), ...rows.slice(-8)])]
  return selected.map((row) => ({
    signal: hints.test(row.text) ? '存在理解或概念线索，需结合上下文判断' : '近期输入背景，不代表知识短板',
    ...row, text: row.text.slice(0, 1600),
    nearby: rows.filter((other) => other !== row && other.source === row.source && row.sessionId && other.sessionId === row.sessionId && Math.abs(Date.parse(other.at)-Date.parse(row.at)) < 30*60*1000).slice(-3).map((other) => other.text.slice(0, 600)),
    relatedIds: state.learn.entries.filter((entry) => entry.concept && row.text.toLowerCase().includes(entry.concept.toLowerCase())).slice(0, 6).map((entry) => entry.id),
  }))
}
