// 自动收集：subagent / workflow 完成事件 + 后台 job settled 事件 → 待验收条目。
import { applyOps, attachableTask, cleanup } from './ops.js'

/** 从未知形状的事件负载里取第一个非空字符串。 */
function firstString(source, keys) {
  for (const key of keys) {
    const value = key.split('.').reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), source)
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function clip(text, max = 90) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** 子代理结束负载：{runId, provider, id(子会话), stopReason, lastAssistantMessage[]}。 */
function subagentTitle(info) {
  const text = subagentText(info)
  const prefix = info?.stopReason && info.stopReason !== 'completed' ? `（${info.stopReason}）` : ''
  if (text) return clip(`${prefix}${text}`)
  return `${prefix}子代理任务完成（${firstString(info, ['provider']) ?? 'spawn'}）`
}

/** 子代理最后一条 assistant 消息的全部文本（压平空白），既当标题来源也当验收摘要。 */
function subagentText(info) {
  const blocks = Array.isArray(info?.lastAssistantMessage) ? info.lastAssistantMessage : []
  return blocks
    .filter((block) => block?.type === 'text' && typeof block.text === 'string' && block.text.trim())
    .map((block) => block.text.trim())
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 工作流结束负载：{id, meta: {name, description}}。 */
function workflowTitle(info) {
  const description = firstString(info, ['meta.description'])
  if (description) return clip(description)
  const name = firstString(info, ['meta.name', 'name'])
  return name ? clip(`工作流 ${name}`) : '工作流运行完成'
}

/**
 * 安装收集器与启动清理。
 * @param {object} ctx - 插件上下文。
 * @param {import('./store.js').Store} store
 * @param {{watchJobs?: boolean}} config
 * @returns {() => void} 注销函数
 */
export function installCollectors(ctx, store, config = {}) {
  const disposers = []

  // 启动：加载状态 + 过期数据清理（完成 90 天 / 处理过 30 天）。
  store.read()
    .then(() => store.mutate('清理过期数据', (draft) => { cleanup(draft); return undefined }, { undoable: false }))
    .catch((err) => console.error('workbench: 启动清理失败', err))

  disposers.push(ctx.on('subagent/end', (info) => {
    addReview(store, {
      kind: 'subagent',
      title: subagentTitle(info),
      summary: clip(subagentText(info), 500),
      sessionId: firstString(info, ['parentSessionId', 'sessionId', 'id']),
      dedupeKey: `subagent:${firstString(info, ['runId', 'id']) ?? ''}`,
    })
  }))

  disposers.push(ctx.on('workflow/end', (info) => {
    const description = firstString(info, ['meta.description'])
    addReview(store, {
      kind: 'workflow',
      title: workflowTitle(info),
      summary: clip(description ?? '', 500),
      sessionId: firstString(info, ['sessionId', 'parentSessionId']),
      dedupeKey: `workflow:${firstString(info, ['runId', 'id']) ?? ''}`,
    })
  }))

  if (config.watchJobs !== false) {
    const jobs = ctx.get('jobs')
    if (jobs?.events && typeof jobs.events.subscribe === 'function') {
      // 推送式：job settled 事件带完整视图（id/label/owner/status），短任务也不会漏。
      // 注意：仅覆盖走 ctx.jobs 注册表的后台任务（如启用了 dsh-tool-bash / dsh-tool-jobs 的部署）。
      const stop = jobs.events.subscribe(ctx, { owners: 'all' }, (event) => {
        if (event?.type !== 'settled') return
        const job = event.job ?? {}
        const id = typeof job.id === 'string' ? job.id : ''
        if (!id) return
        const status = String(job.status ?? '')
        const label = typeof job.label === 'string' && job.label ? job.label : `后台任务 ${id.slice(0, 8)}`
        addReview(store, {
          kind: 'job',
          title: clip(status && status !== 'finished' ? `（${status}）${label}` : label),
          summary: clip(`后台任务 ${label} 结束，状态：${status || 'finished'}`, 500),
          sessionId: typeof job.owner === 'string' ? job.owner : undefined,
          dedupeKey: `job:${id}`,
        })
      })
      disposers.push(stop)
    }
  }

  return () => disposers.forEach((dispose) => dispose())
}

function addReview(store, { kind, title, summary, sessionId, dedupeKey }) {
  if (!dedupeKey || dedupeKey.endsWith(':')) return // 没有稳定标识时不收集，避免重复
  store.mutate('收集待验收', (draft) => {
    // 自动挂靠：这个会话正在执行的工作台任务，就是这次子代理/工作流干活的对象
    const taskId = attachableTask(draft, sessionId)?.id
    return applyOps(draft, [{ op: 'add_review', kind, title, summary, sessionId, taskId, dedupeKey }])
  }, { undoable: false })
    .catch((err) => console.error('workbench: 收集待验收失败', err))
}
