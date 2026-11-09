// 工作台数据操作：op 白名单、校验、视图渲染。所有写路径（agent 工具 / UI / 收集器）都走这里。

export const TASK_STATUSES = ['todo', 'doing', 'blocked', 'done']
export const REVIEW_KINDS = ['subagent', 'workflow', 'job']

const ID_ALPHABET = 36
const MAX_TAGS = 8
const MAX_TAG_LEN = 24
const MAX_TITLE = 120
const MAX_NOTE = 4000
const MAX_TEXT = 2000
const MAX_SUMMARY = 500
const MAX_PROGRESS_NOTE = 200
const MAX_PROGRESS_ENTRIES = 50
const MAX_ACTOR = 40
const DONE_RETENTION_DAYS = 90
const DECIDED_RETENTION_DAYS = 30

export function newId(prefix) {
  return `${prefix}_${Date.now().toString(ID_ALPHABET)}${Math.random().toString(ID_ALPHABET).slice(2, 6)}`
}

function fail(message) {
  throw new Error(message)
}

export function todayString(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** ISO 时间戳的本地日期串（completedAt 是 UTC ISO，直接切片会跨日错判）。 */
export function localDateOf(iso) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : todayString(date)
}

function normalizeTitle(value, what = '标题') {
  if (typeof value !== 'string') fail(`${what}必须是字符串`)
  const title = value.trim()
  if (!title) fail(`${what}不能为空`)
  return title.slice(0, MAX_TITLE)
}

function normalizeNote(value, what = '备注') {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') fail(`${what}必须是字符串`)
  return value.trim().slice(0, MAX_NOTE)
}

function normalizeDue(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') fail('due 必须是 YYYY-MM-DD 字符串')
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim())
  if (!match) fail(`due 格式不对：${JSON.stringify(value)}，应为 YYYY-MM-DD`)
  const [year, month, day] = match[1].split('-').map(Number)
  if (month < 1 || month > 12 || day < 1 || day > 31) fail(`due 不是有效日期：${match[1]}`)
  return match[1]
}

function normalizePriority(value) {
  if (value === undefined || value === null) return 1
  if (!Number.isInteger(value) || value < 0 || value > 2) fail('priority 必须是 0（低）/1（中）/2（高）')
  return value
}

function normalizeTags(value) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) fail('tags 必须是字符串数组')
  const seen = new Set()
  const tags = []
  for (const raw of value) {
    if (typeof raw !== 'string') fail('tags 里的每一项必须是字符串')
    const tag = raw.trim().slice(0, MAX_TAG_LEN)
    if (!tag || seen.has(tag) || tags.length >= MAX_TAGS) continue
    seen.add(tag)
    tags.push(tag)
  }
  return tags
}

function normalizeChecklist(value) {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) fail('checklist 必须是数组')
  return value.map((item) => {
    if (typeof item !== 'object' || item === null) fail('checklist 项必须是对象')
    return { text: normalizeTitle(item.text, 'checklist 文本'), done: item.done === true }
  })
}

function normalizeStatus(value, fallback = 'todo') {
  if (value === undefined || value === null || value === '') return fallback
  if (!TASK_STATUSES.includes(value)) fail(`status 必须是 ${TASK_STATUSES.join(' | ')} 之一`)
  return value
}

function normalizeOrigin(value) {
  if (typeof value !== 'object' || value === null) return { kind: 'ui' }
  const kind = ['chat', 'ui', 'idea', 'review', 'auto', 'zcode'].includes(value.kind) ? value.kind : 'ui'
  const sessionId = typeof value.sessionId === 'string' && value.sessionId ? value.sessionId : undefined
  return { kind, ...(sessionId ? { sessionId } : {}) }
}

/** 环节进展条目：{at, note, sessionId?（DSH 会话）, actor?（外部执行者显示名，如 ZCode）}。 */
function normalizeProgress(value) {
  if (!Array.isArray(value)) return []
  return value.slice(-MAX_PROGRESS_ENTRIES).map((raw) => {
    if (typeof raw !== 'object' || raw === null) return null
    const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, MAX_PROGRESS_NOTE) : ''
    if (!note) return null
    const sessionId = typeof raw.sessionId === 'string' && raw.sessionId ? raw.sessionId : undefined
    const actor = typeof raw.actor === 'string' && raw.actor.trim() ? raw.actor.trim().slice(0, MAX_ACTOR) : undefined
    return {
      at: typeof raw.at === 'string' ? raw.at : new Date().toISOString(),
      note,
      ...(sessionId ? { sessionId } : {}),
      ...(actor ? { actor } : {}),
    }
  }).filter(Boolean)
}

/** 就地归一化一条任务，容忍历史数据缺字段。 */
function normalizeTask(raw) {
  const now = new Date().toISOString()
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId('t'),
    title: normalizeTitle(raw.title),
    note: normalizeNote(raw.note),
    status: normalizeStatus(raw.status),
    priority: normalizePriority(raw.priority),
    tags: normalizeTags(raw.tags),
    due: normalizeDue(raw.due),
    focus: raw.focus === true,
    checklist: normalizeChecklist(raw.checklist),
    progress: normalizeProgress(raw.progress),
    origin: normalizeOrigin(raw.origin),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : null,
  }
}

function normalizeIdea(raw) {
  const now = new Date().toISOString()
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId('i'),
    text: normalizeTitle(raw.text, '想法内容'),
    note: normalizeNote(raw.note),
    status: ['parked', 'promoted', 'dropped'].includes(raw.status) ? raw.status : 'parked',
    promotedTaskId: typeof raw.promotedTaskId === 'string' ? raw.promotedTaskId : null,
    sessionId: typeof raw.sessionId === 'string' && raw.sessionId ? raw.sessionId : null,
    source: raw.source === 'chat' ? 'chat' : 'ui',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
  }
}

function normalizeReview(raw) {
  const now = new Date().toISOString()
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId('r'),
    kind: REVIEW_KINDS.includes(raw.kind) ? raw.kind : 'job',
    title: normalizeTitle(raw.title, '验收标题'),
    summary: typeof raw.summary === 'string' ? raw.summary.trim().slice(0, MAX_SUMMARY) : '',
    sessionId: typeof raw.sessionId === 'string' && raw.sessionId ? raw.sessionId : null,
    taskId: typeof raw.taskId === 'string' && raw.taskId ? raw.taskId : null,
    dedupeKey: typeof raw.dedupeKey === 'string' && raw.dedupeKey ? raw.dedupeKey : newId('k'),
    status: ['pending', 'accepted', 'dismissed'].includes(raw.status) ? raw.status : 'pending',
    promotedTaskId: typeof raw.promotedTaskId === 'string' ? raw.promotedTaskId : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    decidedAt: typeof raw.decidedAt === 'string' ? raw.decidedAt : null,
  }
}

/** 读盘后的迁移与字段修复；空文件/缺字段都得到完整结构。 */
export function migrateState(raw) {
  const source = typeof raw === 'object' && raw !== null ? raw : {}
  return {
    schemaVersion: 1,
    tasks: Array.isArray(source.tasks) ? source.tasks.map((row) => { try { return normalizeTask(row) } catch { return null } }).filter(Boolean) : [],
    reviews: Array.isArray(source.reviews) ? source.reviews.map((row) => { try { return normalizeReview(row) } catch { return null } }).filter(Boolean) : [],
    ideas: Array.isArray(source.ideas) ? source.ideas.map((row) => { try { return normalizeIdea(row) } catch { return null } }).filter(Boolean) : [],
    flags: {
      lastBriefingDate: typeof source.flags?.lastBriefingDate === 'string' ? source.flags.lastBriefingDate : '',
    },
  }
}

function touch(row) {
  row.updatedAt = new Date().toISOString()
}

function addTaskOp(draft, op) {
  const task = normalizeTask({
    title: op.title,
    note: op.note,
    status: op.status,
    priority: op.priority,
    tags: op.tags,
    due: op.due,
    focus: op.focus,
    checklist: op.checklist,
    origin: op.origin ?? { kind: op.source === 'chat' ? 'chat' : 'ui', ...(op.sessionId ? { sessionId: op.sessionId } : {}) },
  })
  if (task.status === 'done') task.completedAt = task.updatedAt
  draft.tasks.unshift(task)
  return { receipts: [{ text: `已登记任务「${task.title}」`, target: task.id }], target: task.id, task }
}

function updateTaskOp(draft, op) {
  const task = draft.tasks.find((row) => row.id === op.id)
  if (!task) fail(`任务不存在：${op.id}`)
  const before = task.status
  if (op.title !== undefined) task.title = normalizeTitle(op.title)
  if (op.note !== undefined) task.note = normalizeNote(op.note)
  if (op.status !== undefined) task.status = normalizeStatus(op.status)
  if (op.priority !== undefined) task.priority = normalizePriority(op.priority)
  if (op.tags !== undefined) task.tags = normalizeTags(op.tags)
  if (op.due !== undefined) task.due = normalizeDue(op.due)
  if (op.focus !== undefined) task.focus = op.focus === true
  if (op.checklist !== undefined) task.checklist = normalizeChecklist(op.checklist)
  if (typeof op.progress === 'string' && op.progress.trim()) {
    const sessionId = typeof op.progressSession === 'string' && op.progressSession ? op.progressSession : undefined
    const actor = typeof op.progressActor === 'string' && op.progressActor.trim() ? op.progressActor.trim() : undefined
    const entry = {
      at: new Date().toISOString(),
      note: op.progress.trim(),
      ...(sessionId ? { sessionId } : {}),
      ...(actor ? { actor } : {}),
    }
    task.progress = normalizeProgress([...(task.progress ?? []), entry])
  }
  if (task.status === 'done' && before !== 'done') task.completedAt = new Date().toISOString()
  if (task.status !== 'done') task.completedAt = null
  touch(task)
  const statusPart = before !== task.status ? `（${before} → ${task.status}）` : ''
  const progressPart = typeof op.progress === 'string' && op.progress.trim() ? '，已记录进展' : ''
  return { receipts: [{ text: `已更新「${task.title}」${statusPart}${progressPart}`, target: task.id }], target: task.id, task }
}

function deleteTaskOp(draft, op) {
  const index = draft.tasks.findIndex((row) => row.id === op.id)
  if (index < 0) fail(`任务不存在：${op.id}`)
  const [removed] = draft.tasks.splice(index, 1)
  return { receipts: [{ text: `已删除「${removed.title}」` }] }
}

function captureIdeaOp(draft, op) {
  const idea = normalizeIdea({
    text: op.text,
    note: op.note,
    sessionId: op.sessionId,
    source: op.source,
  })
  draft.ideas.unshift(idea)
  const parked = draft.ideas.filter((row) => row.status === 'parked').length
  return { receipts: [{ text: `已停靠灵感「${idea.text.slice(0, 24)}${idea.text.length > 24 ? '…' : ''}」（收件箱共 ${parked} 条）`, target: idea.id }], target: idea.id, idea }
}

function promoteIdeaOp(draft, op) {
  const idea = draft.ideas.find((row) => row.id === op.id && row.status === 'parked')
  if (!idea) fail(`灵感不存在或已处理：${op.id}`)
  const task = normalizeTask({
    title: op.title ?? idea.text,
    note: idea.note,
    priority: op.priority,
    due: op.due,
    origin: { kind: 'idea', ...(idea.sessionId ? { sessionId: idea.sessionId } : {}) },
  })
  draft.tasks.unshift(task)
  idea.status = 'promoted'
  idea.promotedTaskId = task.id
  touch(idea)
  return { receipts: [{ text: `灵感已转为任务「${task.title}」`, target: task.id }], target: task.id, task }
}

function dropIdeaOp(draft, op) {
  const idea = draft.ideas.find((row) => row.id === op.id && row.status === 'parked')
  if (!idea) fail(`灵感不存在或已处理：${op.id}`)
  idea.status = 'dropped'
  touch(idea)
  return { receipts: [{ text: `已丢弃灵感「${idea.text.slice(0, 24)}${idea.text.length > 24 ? '…' : ''}」` }] }
}

function addReviewOp(draft, op) {
  if (typeof op.dedupeKey === 'string' && op.dedupeKey) {
    const existing = draft.reviews.find((row) => row.dedupeKey === op.dedupeKey)
    if (existing) return { receipts: [], deduped: true, target: existing.id }
  }
  // 挂靠的任务必须真实存在，否则宁可留空也不挂错
  const taskId = typeof op.taskId === 'string' && op.taskId && draft.tasks.some((row) => row.id === op.taskId) ? op.taskId : null
  const review = normalizeReview({ kind: op.kind, title: op.title, summary: op.summary, sessionId: op.sessionId, taskId, dedupeKey: op.dedupeKey })
  draft.reviews.unshift(review)
  return { receipts: [{ text: `新增待验收：${review.title}`, target: review.id }], target: review.id, review }
}

function decideReviewOp(draft, op) {
  const review = draft.reviews.find((row) => row.id === op.id && row.status === 'pending')
  if (!review) fail(`待验收条目不存在或已处理：${op.id}`)
  let task = null
  if (op.action === 'accept' || op.action === 'accepted') {
    review.status = 'accepted'
  } else if (op.action === 'dismiss' || op.action === 'dismissed') {
    review.status = 'dismissed'
  } else if (op.action === 'promote') {
    task = normalizeTask({
      title: op.taskTitle ?? review.title,
      origin: { kind: 'review', ...(review.sessionId ? { sessionId: review.sessionId } : {}) },
    })
    draft.tasks.unshift(task)
    review.status = 'accepted'
    review.promotedTaskId = task.id
  } else {
    fail('action 必须是 accept | dismiss | promote')
  }
  review.decidedAt = new Date().toISOString()
  const labels = { accepted: '已验收', dismissed: '已忽略' }
  const receipt = task
    ? { text: `「${review.title}」已验收并转为任务`, target: task.id }
    : { text: `「${review.title}」${labels[review.status]}` }
  return { receipts: [receipt], target: task?.id, task }
}

const OPS = {
  add_task: addTaskOp,
  update_task: updateTaskOp,
  delete_task: deleteTaskOp,
  capture_idea: captureIdeaOp,
  promote_idea: promoteIdeaOp,
  drop_idea: dropIdeaOp,
  add_review: addReviewOp,
  decide_review: decideReviewOp,
}

/**
 * 依序应用一组 op；单条失败记入 errors 并继续，返回回执。
 * @param {object} draft - 就地修改的状态。
 * @param {Array<{op: string}>} ops
 * @returns {{receipts: Array<{text: string, target?: string}>, errors: string[], targets: string[]}}
 */
export function applyOps(draft, ops) {
  const receipts = []
  const errors = []
  const targets = []
  if (!Array.isArray(ops)) {
    errors.push('ops 必须是数组')
    return { receipts, errors, targets }
  }
  for (const op of ops) {
    if (typeof op !== 'object' || op === null || typeof op.op !== 'string') {
      errors.push('每条 op 必须是带 op 字段的对象')
      continue
    }
    const handler = OPS[op.op]
    if (!handler) {
      errors.push(`未知操作：${op.op}`)
      continue
    }
    try {
      const result = handler(draft, op)
      receipts.push(...result.receipts)
      if (result.target) targets.push(result.target)
    } catch (err) {
      errors.push(`${op.op}：${err.message}`)
    }
  }
  return { receipts, errors, targets }
}

/** 按 id 精确、再按标题精确/包含匹配任务；多命中返回候选。 */
export function resolveTask(state, idOrTitle) {
  const key = typeof idOrTitle === 'string' ? idOrTitle.trim() : ''
  if (!key) return { error: 'idOrTitle 不能为空' }
  const byId = state.tasks.find((row) => row.id === key)
  if (byId) return { task: byId }
  const exact = state.tasks.filter((row) => row.title === key)
  if (exact.length === 1) return { task: exact[0] }
  if (exact.length > 1) return { candidates: exact }
  const partial = state.tasks.filter((row) => !row.title.includes(key) ? key.includes(row.title) : true)
  if (partial.length === 1) return { task: partial[0] }
  if (partial.length > 1) return { candidates: partial }
  const open = state.tasks.filter((row) => row.status !== 'done')
  return { error: `没有找到任务「${key.slice(0, 40)}」`, candidates: open.slice(0, 8) }
}

const daysLater = (days) => new Date(Date.now() + days * 86_400_000).getTime()

/**
 * 某会话当前「正在干活」的任务：优先该会话名下最近更新的 doing，
 * 没有则退到最近更新的 open 任务（名下 = origin.sessionId 或 progress 里出现过）。
 * 收集器用它把 subagent/workflow/job 的完成结果挂靠到正被执行的任务上。
 */
export function attachableTask(state, sessionId) {
  if (typeof sessionId !== 'string' || !sessionId) return undefined
  const linked = (row) => row.origin?.sessionId === sessionId || (row.progress ?? []).some((entry) => entry.sessionId === sessionId)
  const open = state.tasks.filter((row) => row.status !== 'done' && linked(row))
  if (!open.length) return undefined
  const doing = open.filter((row) => row.status === 'doing')
  const pool = doing.length ? doing : open
  return pool.reduce((best, row) => (!best || row.updatedAt > best.updatedAt ? row : best), undefined)
}

/** 清理过期数据：完成 90 天的任务、处理过 30 天的验收/灵感。 */
export function cleanup(state) {
  const cutoffDone = daysLater(-DONE_RETENTION_DAYS)
  const cutoffDecided = daysLater(-DECIDED_RETENTION_DAYS)
  const time = (value) => (value ? Date.parse(value) : 0)
  state.tasks = state.tasks.filter((row) => row.status !== 'done' || !row.completedAt || time(row.completedAt) >= cutoffDone)
  state.reviews = state.reviews.filter((row) => row.status === 'pending' || !row.decidedAt || time(row.decidedAt) >= cutoffDecided)
  state.ideas = state.ideas.filter((row) => row.status === 'parked' || time(row.updatedAt) >= cutoffDecided)
}

const active = (row) => row.status !== 'done'

function publicTask(row) {
  return {
    id: row.id, title: row.title, note: row.note, status: row.status, priority: row.priority,
    tags: row.tags, due: row.due, focus: row.focus, checklist: row.checklist, progress: row.progress ?? [],
    origin: row.origin, createdAt: row.createdAt, updatedAt: row.updatedAt, completedAt: row.completedAt,
  }
}

/** 「今天」视图：进行中 ∪ 今天及以前到期 ∪ 焦点；附今日完成与各计数。 */
export function todayView(state, now = new Date()) {
  const today = todayString(now)
  const sections = []
  const seen = new Set()
  const push = (key, title, rows) => {
    const fresh = rows.filter((row) => { if (seen.has(row.id)) return false; seen.add(row.id); return true })
    if (fresh.length) sections.push({ key, title, tasks: fresh.map(publicTask) })
  }
  push('doing', '进行中', state.tasks.filter((row) => active(row) && row.status === 'doing'))
  push('due', '今天到期', state.tasks.filter((row) => active(row) && row.due && row.due <= today).sort((a, b) => (a.due < b.due ? -1 : 1)))
  push('focus', '焦点', state.tasks.filter((row) => active(row) && row.focus && row.status !== 'doing' && !(row.due && row.due <= today)))
  const doneToday = state.tasks.filter((row) => row.status === 'done' && row.completedAt && localDateOf(row.completedAt) === today)
  return {
    date: today,
    sections,
    doneToday: doneToday.map(publicTask),
    counts: countsOf(state, now),
  }
}

export function countsOf(state, now = new Date()) {
  const today = todayString(now)
  const pendingReviews = state.reviews.filter((row) => row.status === 'pending')
  const oldestReview = pendingReviews.reduce((min, row) => (min === null || row.createdAt < min ? row.createdAt : min), null)
  return {
    todo: state.tasks.filter((row) => row.status === 'todo').length,
    doing: state.tasks.filter((row) => row.status === 'doing').length,
    blocked: state.tasks.filter((row) => row.status === 'blocked').length,
    doneTotal: state.tasks.filter((row) => row.status === 'done').length,
    dueToday: state.tasks.filter((row) => active(row) && row.due && row.due <= today).length,
    focus: state.tasks.filter((row) => active(row) && row.focus).length,
    doneToday: state.tasks.filter((row) => row.status === 'done' && row.completedAt && localDateOf(row.completedAt) === today).length,
    pendingReviews: pendingReviews.length,
    parkedIdeas: state.ideas.filter((row) => row.status === 'parked').length,
    oldestReviewAgeMin: oldestReview ? Math.max(0, Math.round((now.getTime() - Date.parse(oldestReview)) / 60_000)) : null,
  }
}

export function allView(state) {
  const group = (status) => state.tasks.filter((row) => row.status === status).map(publicTask)
  return {
    counts: countsOf(state),
    todo: group('todo'),
    doing: group('doing'),
    blocked: group('blocked'),
    done: group('done').slice(0, 50),
  }
}

export function reviewsView(state) {
  const pending = state.reviews.filter((row) => row.status === 'pending').sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  const decided = state.reviews.filter((row) => row.status !== 'pending').sort((a, b) => (a.decidedAt < b.decidedAt ? 1 : -1)).slice(0, 20)
  return { pending, decided }
}

export function ideasView(state) {
  return { parked: state.ideas.filter((row) => row.status === 'parked'), recent: state.ideas.filter((row) => row.status !== 'parked').slice(0, 20) }
}
