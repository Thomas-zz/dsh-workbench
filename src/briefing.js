// 每日晨报：一份汇总文本，两个出口——定时推送到会话（触发卡）+ 面板晨报卡（客户端自算）。
// 推送会唤醒目标会话跑一轮模型，所以文末固定要求 agent 简短回应，控制这轮成本。
import { randomUUID } from 'node:crypto'
import { localDateOf, todayString } from './ops.js'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const TICK_MS = 60_000

const clipTitle = (title, max = 24) => (title.length > max ? `${title.slice(0, max - 1)}…` : title)

/** 一条任务的执行者数（progress 里出现过的会话与外部执行者去重合计）。 */
function executorCount(task) {
  const who = new Set()
  for (const entry of task.progress ?? []) {
    if (entry.sessionId) who.add(`s:${entry.sessionId}`)
    if (entry.actor) who.add(`a:${entry.actor}`)
  }
  return who.size
}

/**
 * 构建晨报（纯函数，面板与推送共用口径）。
 * @param {object} state - 工作台状态。
 * @param {Date} [now]
 * @returns {{date: string, weekday: string, text: string, empty: boolean,
 *   doneYesterday: string[], due: Array<{title: string, overdue: boolean}>,
 *   doing: Array<{title: string, executors: number}>, blocked: string[],
 *   pendingCount: number, oldestPendingHours: number|null, ideas: number}}
 */
export function buildBriefing(state, now = new Date()) {
  const today = todayString(now)
  const yesterday = todayString(new Date(now.getTime() - 86_400_000))
  const open = (row) => row.status !== 'done'
  const doneYesterday = state.tasks
    .filter((row) => row.status === 'done' && row.completedAt && localDateOf(row.completedAt) === yesterday)
    .map((row) => row.title)
  const due = state.tasks
    .filter((row) => open(row) && row.due && row.due <= today)
    .sort((a, b) => (a.due < b.due ? -1 : 1))
    .map((row) => ({ title: row.title, overdue: row.due < today }))
  const doing = state.tasks
    .filter((row) => row.status === 'doing')
    .map((row) => ({ title: row.title, executors: executorCount(row) }))
  const blocked = state.tasks.filter((row) => row.status === 'blocked').map((row) => row.title)
  const pending = state.reviews.filter((row) => row.status === 'pending')
  const oldest = pending.reduce((min, row) => (min === null || row.createdAt < min ? row.createdAt : min), null)
  const oldestPendingHours = oldest ? Math.max(0, Math.round((now.getTime() - Date.parse(oldest)) / 3_600_000)) : null
  const ideas = state.ideas.filter((row) => row.status === 'parked').length

  const head = `【工作台晨报 · ${today.slice(5).replace('-', '月')}日 ${WEEKDAYS[now.getDay()]}】`
  const lines = [head]
  if (doneYesterday.length) lines.push(`昨日完成 ${doneYesterday.length} 件：${doneYesterday.map((t) => clipTitle(t)).join('；')}`)
  if (due.length) lines.push(`今日到期 ${due.length} 件${due.some((row) => row.overdue) ? `（其中逾期 ${due.filter((row) => row.overdue).length}）` : ''}：${due.map((row) => `${clipTitle(row.title)}${row.overdue ? '（逾期）' : ''}`).join('；')}`)
  if (doing.length) lines.push(`进行中 ${doing.length} 件：${doing.map((row) => `${clipTitle(row.title)}${row.executors ? `（${row.executors} 位执行者）` : ''}`).join('；')}`)
  if (blocked.length) lines.push(`受阻 ${blocked.length} 件：${blocked.map((t) => clipTitle(t)).join('；')} —— 建议今天先看`)
  if (pending.length) lines.push(`待验收 ${pending.length} 条${oldestPendingHours !== null ? `（最早已等 ${oldestPendingHours} 小时）` : ''}`)
  if (ideas) lines.push(`灵感池 ${ideas} 条`)
  const empty = lines.length === 1
  if (empty) lines.push(`今天没有到期与进行中事项${ideas ? `，灵感池 ${ideas} 条` : ''}。`)
  lines.push('（简短确认收到即可；仅对受阻与逾期项给出今天建议的处理顺序，不要展开长篇。）')

  return { date: today, weekday: WEEKDAYS[now.getDay()], text: lines.join('\n'), empty, doneYesterday, due, doing, blocked, pendingCount: pending.length, oldestPendingHours, ideas }
}

/**
 * 晨报推送的目标会话：显式配置优先；否则取未完结任务与待验收里最近活跃的会话。
 * @param {{briefingSessionId?: string}} config
 * @param {object} state - 工作台状态。
 * @returns {string|null} 会话 id。
 */
export function resolveBriefingTarget(config, state) {
  const configured = typeof config.briefingSessionId === 'string' && config.briefingSessionId.trim() ? config.briefingSessionId.trim() : ''
  if (configured) return configured
  const candidates = new Map() // sessionId -> 最近活跃时间戳
  const touch = (id, at) => {
    if (!id) return
    const prev = candidates.get(id)
    if (prev === undefined || at > prev) candidates.set(id, at)
  }
  for (const row of state.tasks) {
    if (row.status === 'done') continue
    touch(row.origin?.sessionId, row.updatedAt)
    for (const entry of row.progress ?? []) touch(entry.sessionId, entry.at)
  }
  for (const review of state.reviews) {
    if (review.status === 'pending') touch(review.sessionId, review.createdAt)
  }
  let best = null
  for (const [id, at] of candidates) {
    if (best === null || at > best.at) best = { id, at }
  }
  return best === null ? null : best.id
}

/** 把一段文本作为触发卡送进目标会话（照 offpeak-queue runner 的唤醒写法；学习模块复用）。 */
export async function pushSessionCard(ctx, sessionId, text, selection) {
  const resolved = await ctx.sessionController.resolveAgent(sessionId)
  if (resolved === undefined || resolved === null || 'error' in resolved) {
    throw resolved?.error ?? new Error('会话不存在或不可恢复')
  }
  const agent = resolved.agent
  if (agent === undefined || agent === null || typeof agent.followup !== 'function') {
    throw new Error('会话不可用，无法推送')
  }
  if (selection) {
    if (typeof agent.model?.select !== 'function') throw new Error('当前 DSH 不支持会话模型选择，请升级后重试')
    agent.model.select(selection)
  }
  agent.followup({
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    // cordis-host-runner 来源会渲染成触发卡而不是用户气泡
    source: { kind: 'cordis-host-runner' },
  })
  await ctx.sessions.flush(agent.session)
}

/**
 * 定时晨报：过了 briefingHour 且今天还没发过，就先占标记再推送。
 * 桌面端与 Web 端两个进程都会跑这段：标记动作在 store.mutate 里做「已标记就不再动」，
 * 把双发窗口压到毫秒级；先标记后推送，宁可漏发也不重发。
 * @param {object} ctx - 插件上下文。
 * @param {import('./store.js').Store} store
 * @param {{briefingHour?: number, briefingSessionId?: string, briefingPush?: boolean}} config
 * @returns {() => void} 注销函数
 */
export function startBriefing(ctx, store, config = {}) {
  if (config.briefingPush === false) return () => {}
  const hour = Number.isInteger(config.briefingHour) && config.briefingHour >= 0 && config.briefingHour <= 23 ? config.briefingHour : 9

  const tick = async () => {
    try {
      const now = new Date()
      if (now.getHours() < hour) return
      const today = todayString(now)
      const state = await store.read()
      if (state.flags?.lastBriefingDate === today) return
      // 占标记：mutate 内部先 refresh 再判断，跨进程只剩极小的读写竞态
      const won = await store.mutate('标记晨报', (draft) => {
        if (draft.flags?.lastBriefingDate === today) return false
        draft.flags = { ...(draft.flags ?? {}), lastBriefingDate: today }
        return true
      }, { undoable: false })
      if (!won) return
      const target = resolveBriefingTarget(config, state)
      if (!target) {
        console.warn('workbench: 晨报没有可推送的会话（工作台里还没有带会话来源的未完结任务），今天跳过')
        return
      }
      const briefing = buildBriefing(state, now)
      await pushSessionCard(ctx, target, briefing.text)
    } catch (err) {
      console.error('workbench: 晨报推送失败', err)
    }
  }

  const timer = setInterval(tick, TICK_MS)
  timer.unref?.()
  // 启动后尽快补查一次：当天晚于 briefingHour 才启动宿主，也能补发晨报
  const kickoff = setTimeout(tick, 5_000)
  kickoff.unref?.()
  return () => {
    clearInterval(timer)
    clearTimeout(kickoff)
  }
}
