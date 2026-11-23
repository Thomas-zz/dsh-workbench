import { normalizeMail } from './mail-state.js'
import { initializeAssistant, setAssistantModel, setAssistantConfig } from './assistant.js'
// 工作台数据操作：op 白名单、校验、视图渲染。所有写路径（agent 工具 / UI / 收集器）都走这里。

import { isProject, isAction, planFields, initializePlanner, settlePlan, rememberMove, applyPlanOp, dayTasks, calendarDate, openTask, weekOf, personalState } from './planner.js'

export const TASK_STATUSES = ['todo', 'doing', 'blocked', 'done', 'paused', 'cancelled']
export const REVIEW_KINDS = ['subagent', 'workflow', 'job', 'collaboration']

// 学习模块：提问分类与条目状态。
export const LEARN_CATEGORIES = ['weak', 'know', 'term']
export const LEARN_CATEGORY_LABELS = { weak: '弱项补强', know: '了解即可', term: '名词解释' }
export const LEARN_STATUSES = ['recorded', 'mastered', 'ignored']
export const LEARN_SOURCES = ['zcode', 'dsh', 'claude', 'codex']
export const LEARN_SOURCE_LABELS = { zcode: 'ZCode', dsh: 'DSH', claude: 'Claude Code', codex: 'Codex' }

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
// 学习卡是长期知识资产，不随任务/验收保留期自动删除；收件箱限制尺寸。
const MAX_LEARN_INBOX = 200

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
  const kind = ['chat', 'ui', 'idea', 'review', 'auto', 'zcode', 'mail'].includes(value.kind) ? value.kind : 'ui'
  const sessionId = typeof value.sessionId === 'string' && value.sessionId ? value.sessionId : undefined
  const source = ['codex', 'dsh', 'claude', 'zcode'].includes(value.source) ? value.source : undefined
  return { kind, ...(sessionId ? { sessionId } : {}), ...(source ? { source } : {}) }
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
    ...planFields(raw),
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
    text: normalizeTitle(raw.text, '随手记') && raw.text.trim().slice(0, 5000),
    note: normalizeNote(raw.note),
    status: ['parked', 'promoted', 'organized', 'dropped'].includes(raw.status) ? raw.status : 'parked',
    taskIds: Array.isArray(raw.taskIds) ? raw.taskIds : [],
    organizedAt: raw.organizedAt || null,
    organizationNote: raw.organizationNote || '',
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
    ...(raw.kind === 'collaboration' ? {
      source: LEARN_SOURCES.includes(raw.source) ? raw.source : '',
      project: typeof raw.project === 'string' ? raw.project.trim().slice(0, 120) : '',
      evidence: planFields(raw).evidence,
      ownership: planFields(raw).ownership,
      originalTask: raw.originalTask ? normalizeTask(raw.originalTask) : null,
    } : {}),
  }
}

/** 学习条目：一次被记录的知识提问（agent 整理后写入）。 */
function normalizeLearnEntry(raw) {
  const now = new Date().toISOString()
  const source = (typeof raw.source === 'object' && raw.source !== null) ? raw.source : {}
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId('le'),
    question: normalizeTitle(raw.question, '提问内容') && raw.question.trim().slice(0, 12000),
    title: normalizeTitle(raw.title ?? raw.question, '笔记标题'),
    category: LEARN_CATEGORIES.includes(raw.category) ? raw.category : 'know',
    concept: typeof raw.concept === 'string' ? raw.concept.trim().slice(0, 40) : '',
    kind: raw.kind === 'suggested' ? 'suggested' : raw.kind === 'followup' ? 'followup' : 'question',
    evidence: typeof raw.evidence === 'string' ? raw.evidence.slice(0, 2000) : '',
    parentIds: Array.isArray(raw.parentIds) ? [...new Set(raw.parentIds.filter((id) => typeof id === 'string' && id !== raw.id))].slice(0, 12) : [],
    relatedIds: Array.isArray(raw.relatedIds) ? [...new Set(raw.relatedIds.filter((id) => typeof id === 'string' && id !== raw.id))].slice(0, 12) : [],
    highlights: Array.isArray(raw.highlights) ? raw.highlights.filter((row) => typeof row?.text === 'string').slice(0, 100) : [],
    learningSessionId: typeof raw.learningSessionId === 'string' ? raw.learningSessionId : '',
    lastRunError: typeof raw.lastRunError === 'string' ? raw.lastRunError : '',
    syncError: typeof raw.syncError === 'string' ? raw.syncError : '',
    note: normalizeNote(raw.note),
    answer: typeof (raw.answer ?? raw.note) === 'string' ? (raw.answer ?? raw.note).slice(0, 60000) : '',
    why: normalizeNote(raw.why, '学习价值'),
    notePath: typeof raw.notePath === 'string' ? raw.notePath : '',
    vaultPath: typeof raw.vaultPath === 'string' ? raw.vaultPath : '',
    status: LEARN_STATUSES.includes(raw.status) ? raw.status : 'recorded',
    key: typeof raw.key === 'string' && raw.key ? raw.key : '',
    source: {
      harness: LEARN_SOURCES.includes(source.harness) ? source.harness : '',
      project: typeof source.project === 'string' ? source.project.slice(0, 200) : '',
      sessionId: typeof source.sessionId === 'string' ? source.sessionId : '',
      ...(typeof source.messageKey === 'string' && {messageKey: source.messageKey}),
    },
    askedAt: typeof raw.askedAt === 'string' ? raw.askedAt : now,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
    nextReviewAt: typeof raw.nextReviewAt === 'string' ? raw.nextReviewAt : (typeof raw.createdAt === 'string' ? raw.createdAt : now),
    reviewedAt: typeof raw.reviewedAt === 'string' ? raw.reviewedAt : '',
    reviewIntervalDays: Number.isInteger(raw.reviewIntervalDays) && raw.reviewIntervalDays > 0 ? raw.reviewIntervalDays : 1,
  }
}

/** 学习收件箱：手动捕获 / 学习任务拦截的待整理提问。 */
function normalizeLearnInbox(raw) {
  const now = new Date().toISOString()
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId('li'),
    question: normalizeTitle(raw.question, '提问内容'),
    context: normalizeNote(raw.context),
    sessionId: typeof raw.sessionId === 'string' && raw.sessionId ? raw.sessionId : '',
    source: typeof raw.source === 'string' ? raw.source : 'chat',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
  }
}

/** 学习配置：面板可改（存 state），vault 根路径走插件行配置不在这里。 */
function normalizeLearnConfig(raw) {
  const source = (typeof raw === 'object' && raw !== null) ? raw : {}
  const sourcesRaw = (typeof source.sources === 'object' && source.sources !== null) ? source.sources : {}
  const sources = {}
  for (const name of LEARN_SOURCES) sources[name] = sourcesRaw[name] !== false
  const hour = Number.isInteger(source.reportHour) && source.reportHour >= 0 && source.reportHour <= 23 ? source.reportHour : 22
  return {
    reportHour: hour,
    organizeModel: source.organizeModel?.provider && source.organizeModel?.model
      ? { provider: String(source.organizeModel.provider), model: String(source.organizeModel.model) } : null,
    vaultPath: typeof source.vaultPath === 'string' ? source.vaultPath.trim().slice(0, 500) : '',
    notesDir: typeof source.notesDir === 'string' && source.notesDir.trim() ? source.notesDir.trim().slice(0, 120) : 'AI/Agent学习',
    sources,
    reportSessionId: typeof source.reportSessionId === 'string' ? source.reportSessionId : '',
    reportPush: source.reportPush !== false,
  }
}

/** 学习段整体归一化；缺省时给空结构与默认配置。 */
function normalizeLearn(raw) {
  const source = (typeof raw === 'object' && raw !== null) ? raw : {}
  const armed = {}
  if (typeof source.armed === 'object' && source.armed !== null) {
    const dayAgo = Date.now() - 86_400_000
    for (const [sessionId, at] of Object.entries(source.armed)) {
      const time = Date.parse(at)
      if (typeof sessionId === 'string' && sessionId && Number.isFinite(time) && time >= dayAgo) armed[sessionId] = new Date(time).toISOString()
    }
  }
  return {
    entries: Array.isArray(source.entries) ? source.entries.map((row) => { try { return normalizeLearnEntry(row) } catch { return null } }).filter(Boolean) : [],
    inbox: Array.isArray(source.inbox) ? source.inbox.slice(0, MAX_LEARN_INBOX).map((row) => { try { return normalizeLearnInbox(row) } catch { return null } }).filter(Boolean) : [],
    sessions: Object.fromEntries(Object.entries(source.sessions || {}).filter(([id, row]) => id && typeof row?.rootId === 'string').map(([id, row]) => [id, { ...row }])),
    reports: Array.isArray(source.reports) ? source.reports.filter((row) => typeof row?.date === 'string' && typeof row?.path === 'string' && typeof row?.vaultPath === 'string') : [],
    review: source.review?.id && Array.isArray(source.review.sessions) ? source.review : null,
    deferredReviews: (Array.isArray(source.deferredReviews) ? source.deferredReviews : []).filter((r) => r?.id && !r.complete && Array.isArray(r.sessions)),
    config: normalizeLearnConfig(source.config),
    armed,
    flags: {
      lastLearnReportDate: typeof source.flags?.lastLearnReportDate === 'string' ? source.flags.lastLearnReportDate : '',
      lastLearnAttemptDate: typeof source.flags?.lastLearnAttemptDate === 'string' ? source.flags.lastLearnAttemptDate : '',
      lastLearnAttemptAt: typeof source.flags?.lastLearnAttemptAt === 'string' ? source.flags.lastLearnAttemptAt : '',
      lastCollectAt: typeof source.flags?.lastCollectAt === 'string' ? source.flags.lastCollectAt : '',
    },
  }
}

/** 读盘后的迁移与字段修复；空文件/缺字段都得到完整结构。 */
export function migrateState(raw) {
  const source = typeof raw === 'object' && raw !== null ? raw : {}
  return initializeAssistant(initializePlanner({
    schemaVersion: 2,
    revision: Number.isInteger(source.revision) ? source.revision : 0,
    plan: source.plan,
    mail: normalizeMail(source.mail),
    tasks: Array.isArray(source.tasks) ? source.tasks.map((row) => { try { return normalizeTask(row) } catch { return null } }).filter(Boolean) : [],
    reviews: Array.isArray(source.reviews) ? source.reviews.map((row) => { try { return normalizeReview(row) } catch { return null } }).filter(Boolean) : [],
    ideas: Array.isArray(source.ideas) ? source.ideas.map((row) => { try { return normalizeIdea(row) } catch { return null } }).filter(Boolean) : [],
    learn: normalizeLearn(source.learn),
    flags: {
      lastBriefingDate: typeof source.flags?.lastBriefingDate === 'string' ? source.flags.lastBriefingDate : '',
    },
  }, source.schemaVersion || 0), source)
}

function touch(row) {
  row.updatedAt = new Date().toISOString()
}

function validateRelationship(draft, task) {
  if (isProject(task)) {
    task.parentId = null
    task.plannedDate = null
    task.startMinute = null
    task.scheduledMinutes = null
    if (task.kind === 'project') task.plannedWeek = null
  }
  if (task.parentId) {
    const parent = draft.tasks.find((t) => t.id === task.parentId)
    if (!parent || !isProject(parent) || parent.id === task.id) fail('请选择一个有效项目')
    task.project = parent.title
  }
  if (task.kind === 'event' && !task.plannedDate) fail('日程必须选择日期')
}

function addTaskOp(draft, op) {
  const task = normalizeTask({
    ...planFields(op),
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
  if (task.status === 'done') task.firstCompletedAt = task.completedAt = task.updatedAt
  if (op.actor !== 'organizer') for (const key of Object.keys(planFields(op))) {
    if (op[key] !== undefined) task.userFields[key] = task.updatedAt
  }
  validateRelationship(draft, task)
  draft.tasks.unshift(task)
  if (task.kind === 'project') for (const child of draft.tasks) { if (!isProject(child) && !child.parentId && child.project === task.title) child.parentId = task.id }
  const historical = task.kind === 'goal' ? draft.plan?.weeks?.[task.plannedWeek] : draft.plan?.days?.[task.plannedDate]
  if (historical?.closed) {
    historical.items.push(structuredClone(task))
    ;(historical.corrections ||= []).push({ at: task.createdAt, id: task.id, action: 'added' })
  }
  return { receipts: [{ text: `已登记任务「${task.title}」`, target: task.id }], target: task.id, task }
}

function updateTaskOp(draft, op) {
  const task = draft.tasks.find((row) => row.id === op.id)
  if (!task) fail(`任务不存在：${op.id}`)
  if (op.kind === 'project' && !isProject(task)) fail('请使用创建关联项目，保留原任务和排期')
  const before = task.status
  const previous = { ...task }
  if (op.kind && isProject(task) && !['project','goal'].includes(op.kind) && draft.tasks.some((t)=>t.parentId===task.id)) fail('项目仍有关联事项，不能直接转为任务或日程')
  const normalizedPlan = planFields({ ...task, ...op })
  for (const key of Object.keys(normalizedPlan)) {
    if (op[key] !== undefined && !['userFields', 'firstCompletedAt'].includes(key)) task[key] = normalizedPlan[key]
  }
  if (op.plannedDate !== undefined && op.plannedWeek === undefined) task.plannedWeek = normalizedPlan.plannedDate ? weekOf(normalizedPlan.plannedDate) : task.plannedWeek
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
  if (task.status === 'done' && before !== 'done') {
    task.completedAt = new Date().toISOString()
    task.firstCompletedAt ||= task.completedAt
  }
  if (task.status !== 'done') task.completedAt = null
  touch(task)
  if (op.actor !== 'organizer') for (const key of Object.keys(op)) if (!['op', 'id', 'progress', 'progressSession', 'progressActor'].includes(key)) task.userFields[key] = task.updatedAt
  validateRelationship(draft, task)
  rememberMove(draft, previous, task)
  const statusPart = before !== task.status ? `（${before} → ${task.status}）` : ''
  const progressPart = typeof op.progress === 'string' && op.progress.trim() ? '，已记录进展' : ''
  return { receipts: [{ text: `已更新「${task.title}」${statusPart}${progressPart}`, target: task.id }], target: task.id, task }
}

function deadlineEventOp(draft, op) {
  const task = draft.tasks.find((t) => t.id === op.id)
  if (!task?.due) fail('请先填写截止日期')
  const existing = draft.tasks.find((t) => t.kind === 'event' && t.sourceTaskId === task.id)
  const fields = {title: `${task.title} · 截止`, plannedDate: task.due, parentId: isProject(task) ? task.id : task.parentId, project:isProject(task) ? task.title : task.project}
  if (existing) return updateTaskOp(draft,{id:existing.id,...fields})
  return addTaskOp(draft,{...fields,kind:'event',sourceTaskId:task.id,note:'提交截止日期，全天日程。'})
}

function convertTaskOp(draft, op) {
  const task = draft.tasks.find((t) => t.id === op.id)
  if (!task) fail('事项不存在')
  if (!['project', 'event', 'action'].includes(op.kind)) fail('转换类型无效')
  if (isProject(task) && op.kind !== 'project' && draft.tasks.some((t) => t.parentId === task.id)) fail('项目仍有关联事项，不能直接转为任务或日程')
  if (op.kind === 'project') {
    if (isProject(task) || task.parentId) return { receipts: [], target: task.id, task }
    const existing = task.project && draft.tasks.find((p) => isProject(p) && p.title === task.project)
    const project = existing || addTaskOp(draft, {
      kind: 'project', title: task.project || task.title, due: task.due,
      plannedDate: null, order: task.order,
    }).task
    const result = updateTaskOp(draft, { id: task.id, parentId: project.id, project: project.title })
    return { ...result, receipts: [{ text: `已关联项目「${project.title}」，原任务和排期保留`, target: task.id }] }
  }
  const result = updateTaskOp(draft, { op: 'update_task', id: task.id, kind: op.kind,
    ...(op.kind === 'event' ? { plannedDate: op.date || task.due || task.plannedDate || calendarDate(new Date(), draft.plan.config.timezone), rolloverWarning: null } : {}),
  })
  return result
}

function deleteTaskOp(draft, op) {
  const index = draft.tasks.findIndex((row) => row.id === op.id)
  if (index < 0) fail(`任务不存在：${op.id}`)
  if (isProject(draft.tasks[index]) && draft.tasks.some((t)=>t.parentId===op.id)) fail('项目仍有关联事项，请先移出节点或将项目标为完成')
  const [removed] = draft.tasks.splice(index, 1)
  for (const record of [...Object.values(draft.plan.days), ...Object.values(draft.plan.weeks)]) {
    record.items = (record.items || []).filter(t=>t.id!==op.id)
    if(record.children) record.children=record.children.filter(t=>t.id!==op.id)
  }
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
  return { receipts: [{ text: `已停靠随手记「${idea.text.slice(0, 24)}${idea.text.length > 24 ? '…' : ''}」（收件箱共 ${parked} 条）`, target: idea.id }], target: idea.id, idea }
}

function promoteIdeaOp(draft, op) {
  const idea = draft.ideas.find((row) => row.id === op.id && row.status === 'parked')
  if (!idea) fail(`随手记不存在或已处理：${op.id}`)
  const task = normalizeTask({
    title: op.title ?? idea.text,
    plannedDate: calendarDate(new Date(), draft.plan.config.timezone),
    note: idea.note,
    priority: op.priority,
    due: op.due,
    origin: { kind: 'idea', ...(idea.sessionId ? { sessionId: idea.sessionId } : {}) },
  })
  draft.tasks.unshift(task)
  idea.status = 'promoted'
  idea.promotedTaskId = task.id
  touch(idea)
  return { receipts: [{ text: `随手记已转为任务「${task.title}」`, target: task.id }], target: task.id, task }
}

function dropIdeaOp(draft, op) {
  const idea = draft.ideas.find((row) => row.id === op.id && row.status === 'parked')
  if (!idea) fail(`随手记不存在或已处理：${op.id}`)
  idea.status = 'dropped'
  touch(idea)
  return { receipts: [{ text: `已丢弃随手记「${idea.text.slice(0, 24)}${idea.text.length > 24 ? '…' : ''}」` }] }
}

function addReviewOp(draft, op) {
  if (typeof op.dedupeKey === 'string' && op.dedupeKey) {
    const existing = draft.reviews.find((row) => row.dedupeKey === op.dedupeKey)
    if (existing) return { receipts: [], deduped: true, target: existing.id }
  }
  // 挂靠的任务必须真实存在，否则宁可留空也不挂错
  const taskId = typeof op.taskId === 'string' && op.taskId && draft.tasks.some((row) => row.id === op.taskId) ? op.taskId : null
  const review = normalizeReview({ kind: op.kind, title: op.title, summary: op.summary, sessionId: op.sessionId, taskId, dedupeKey: op.dedupeKey, source: op.source, project: op.project, evidence: op.evidence, ownership: op.ownership })
  draft.reviews.unshift(review)
  return { receipts: [{ text: `新增${review.kind === 'collaboration' ? '待协作' : '待验收'}：${review.title}`, target: review.id }], target: review.id, review }
}

function moveToCollaborationOp(draft, op) {
  const task = draft.tasks.find((row) => row.id === op.id)
  if (!task || !isAction(task) || ['done', 'cancelled'].includes(task.status)) fail('只能将未完成的普通事项移到待协作')
  if (draft.tasks.some((row) => row.parentId === task.id)) fail('含子项的事项不能移到待协作')
  const result = addReviewOp(draft, {
    kind: 'collaboration', title: task.title, summary: task.note,
    project: task.project, source: task.origin?.source || (task.origin?.kind === 'chat' ? 'dsh' : task.origin?.kind === 'zcode' ? 'zcode' : task.evidence?.at(-1)?.source),
    sessionId: task.origin?.sessionId || task.evidence?.at(-1)?.sessionId, evidence: task.evidence,
    ownership: task.ownership, dedupeKey: `task-collaboration:${task.id}`,
  })
  const review = draft.reviews.find((row) => row.id === result.target)
  review.title = task.title
  review.summary = task.note.slice(0, MAX_SUMMARY)
  review.project = task.project
  review.evidence = structuredClone(task.evidence || [])
  review.ownership = task.ownership
  review.originalTask = structuredClone(task)
  review.status = 'pending'
  review.decidedAt = null
  review.promotedTaskId = null
  draft.tasks = draft.tasks.filter((row) => row.id !== task.id)
  return { receipts: [{ text: `「${task.title}」已移到待协作`, target: review.id }], target: review.id }
}

function decideReviewOp(draft, op) {
  if (op.action === 'reopen') {
    const review = draft.reviews.find((row) => row.id === op.id && row.kind === 'collaboration')
    if (!review || review.promotedTaskId) fail('该条目不能重新打开')
    review.status = 'pending'
    review.decidedAt = null
    return { receipts: [{ text: '已恢复待协作', target: review.id }], target: review.id }
  }
  const review = draft.reviews.find((row) => row.id === op.id && row.status === 'pending')
  if (!review) fail(`待验收条目不存在或已处理：${op.id}`)
  let task = null
  if (op.action === 'accept' || op.action === 'accepted') {
    review.status = 'accepted'
  } else if (op.action === 'dismiss' || op.action === 'dismissed') {
    review.status = 'dismissed'
  } else if (op.action === 'promote') {
    task = normalizeTask({
      ...(review.kind === 'collaboration' ? review.originalTask || {} : {}),
      title: op.taskTitle ?? review.title,
      ...(review.kind === 'collaboration' ? {
        project: review.project, note: review.originalTask?.note || review.summary,
        evidence: review.evidence, plannedWeek: null, startMinute: null, scheduledMinutes: null,
        status: 'todo', completedAt: null, ownership: { kind: 'user_action' },
        carriedFrom: null, rolloverWarning: null,
        parentId: draft.tasks.some((t) => t.id === review.originalTask?.parentId && isProject(t)) ? review.originalTask.parentId : null,
        userFields: { ...review.originalTask?.userFields, ownership: new Date().toISOString() },
      } : {}),
      plannedDate: review.kind === 'collaboration' ? null : calendarDate(new Date(), draft.plan.config.timezone),
      origin: review.originalTask?.origin || { kind: 'review', source: review.source, ...(review.sessionId ? { sessionId: review.sessionId } : {}) },
    })
    if (draft.tasks.some((row) => row.id === task.id)) fail('对应事项已存在')
    draft.tasks.unshift(task)
    review.status = 'accepted'
    review.promotedTaskId = task.id
  } else {
    fail('action 必须是 accept | dismiss | promote')
  }
  review.decidedAt = new Date().toISOString()
  const labels = { accepted: review.kind === 'collaboration' ? '已处理' : '已验收', dismissed: '已忽略' }
  const receipt = task
    ? { text: `「${review.title}」${review.kind === 'collaboration' ? '已转入事项池' : '已验收并转为任务'}`, target: task.id }
    : { text: `「${review.title}」${labels[review.status]}` }
  return { receipts: [receipt], target: task?.id, task }
}

// ---------- 学习模块操作 ----------

/** 手动捕获一条提问进学习收件箱（对话内 capture / /学习任务拦截 / CLI add 共用）。 */
function learnCaptureOp(draft, op) {
  const item = normalizeLearnInbox({
    question: op.question,
    context: op.context,
    sessionId: op.sessionId,
    source: op.source,
  })
  draft.learn.inbox.unshift(item)
  if (draft.learn.inbox.length > MAX_LEARN_INBOX) draft.learn.inbox.length = MAX_LEARN_INBOX
  const pending = draft.learn.inbox.length
  return { receipts: [{ text: `已记录学习提问「${item.question.slice(0, 24)}${item.question.length > 24 ? '…' : ''}」（待整理 ${pending} 条）`, target: item.id }], target: item.id, item }
}

/**
 * 批量落库整理好的学习条目（agent 判断分类后调用；Obsidian 笔记由调用方先写好再传路径进来）。
 * 按 key/question 去重；consumeInboxIds 顺带消化对应收件箱条目。
 */
function learnWriteOp(draft, op) {
  const items = Array.isArray(op.items) ? op.items : []
  if (!items.length) fail('items 不能为空')
  const existing = new Set(draft.learn.entries.map((row) => row.key).filter(Boolean))
  const consumeIds = new Set(Array.isArray(op.consumeInboxIds) ? op.consumeInboxIds : [])
  const created = []
  const skipped = []
  for (const item of items) {
    const key = typeof item.key === 'string' && item.key ? item.key : ''
    if (key && existing.has(key)) {
      skipped.push(item.question ?? '')
      continue
    }
    const entry = normalizeLearnEntry(item)
    if (key) existing.add(key)
    draft.learn.entries.unshift(entry)
    created.push(entry)
  }
  const consumed = []
  if (consumeIds.size) {
    draft.learn.inbox = draft.learn.inbox.filter((row) => {
      if (consumeIds.has(row.id)) {
        consumed.push(row.id)
        return false
      }
      return true
    })
  }
  const parts = [`学习整理：新增 ${created.length} 条笔记`]
  if (skipped.length) parts.push(`跳过重复 ${skipped.length} 条`)
  if (consumed.length) parts.push(`消化收件箱 ${consumed.length} 条`)
  return { receipts: [{ text: parts.join('，') }], created, skipped: skipped.length, consumed: consumed.length }
}

/** 处置一条学习条目：已掌握 / 忽略 / 重新待复习。 */
function learnDecideOp(draft, op) {
  const entry = draft.learn.entries.find((row) => row.id === op.id)
  if (!entry) fail(`学习条目不存在：${op.id}`)
  if (op.action === 'mastered') entry.status = 'mastered'
  else if (op.action === 'ignored') entry.status = 'ignored'
  else if (op.action === 'reopen') {
    entry.status = 'recorded'
    entry.nextReviewAt = new Date().toISOString()
  }
  else if (op.action === 'reviewed') {
    entry.status = 'recorded'
    entry.reviewedAt = new Date().toISOString()
    entry.reviewIntervalDays = Math.min(30, Math.max(1, entry.reviewIntervalDays || 1) * 2)
    entry.nextReviewAt = new Date(Date.now() + entry.reviewIntervalDays * 86_400_000).toISOString()
  } else fail('action 必须是 mastered | ignored | reopen | reviewed')
  entry.updatedAt = new Date().toISOString()
  const labels = { mastered: '已掌握', ignored: '已忽略', recorded: op.action === 'reviewed' ? `已复习，${entry.reviewIntervalDays} 天后再看` : '重新待复习' }
  return { receipts: [{ text: `「${entry.title.slice(0, 24)}」${labels[entry.status]}`, target: entry.id }], target: entry.id, entry }
}

/** 丢弃收件箱里的一条待整理提问。 */
function learnDropInboxOp(draft, op) {
  const index = draft.learn.inbox.findIndex((row) => row.id === op.id)
  if (index < 0) fail(`收件箱条目不存在：${op.id}`)
  const [removed] = draft.learn.inbox.splice(index, 1)
  return { receipts: [{ text: `已丢弃提问「${removed.question.slice(0, 24)}」` }] }
}

/** 面板设置：修改学习配置（目录 / 整理时间 / 启用源 / 推送开关 / 目标会话）。 */
function learnConfigOp(draft, op) {
  const patch = (typeof op.patch === 'object' && op.patch !== null) ? op.patch : {}
  const config = draft.learn.config
  if (patch.vaultPath !== undefined) {
    const value = typeof patch.vaultPath === 'string' ? patch.vaultPath.trim() : ''
    if (value && !value.startsWith('/')) fail('vaultPath 必须是绝对路径')
    config.vaultPath = value.slice(0, 500)
  }
  if (patch.notesDir !== undefined) {
    const value = typeof patch.notesDir === 'string' ? patch.notesDir.trim() : ''
    if (!value || value.startsWith('/') || value.split(/[\\/]+/).includes('..')) fail('notesDir 必须是 vault 内的相对目录')
    config.notesDir = value.slice(0, 120)
  }
  if (patch.reportHour !== undefined) {
    if (!Number.isInteger(patch.reportHour) || patch.reportHour < 0 || patch.reportHour > 23) fail('reportHour 必须是 0-23 的整数')
    config.reportHour = patch.reportHour
  }
  if (patch.sources !== undefined) {
    if (typeof patch.sources !== 'object') fail('sources 必须是对象')
    for (const name of LEARN_SOURCES) {
      if (patch.sources[name] !== undefined) config.sources[name] = patch.sources[name] !== false
    }
  }
  if (patch.organizeModel !== undefined) {
    const value = patch.organizeModel
    if (value !== null && (typeof value?.provider !== 'string' || !value.provider.trim() || typeof value?.model !== 'string' || !value.model.trim())) fail('请选择有效的整理模型')
    setAssistantModel(draft, value === null ? null : { ...value, provider: value.provider.trim(), model: value.model.trim() })
  }
  if (patch.reportSessionId !== undefined) config.reportSessionId = typeof patch.reportSessionId === 'string' ? patch.reportSessionId.trim() : ''
  if (patch.reportPush !== undefined) config.reportPush = patch.reportPush !== false
  return { receipts: [{ text: '学习设置已更新' }] }
}

/** 占当日整理标记（nightly 调度防重发用，跨进程宁漏勿重）。 */
function learnFlagReportOp(draft, op) {
  const date = typeof op.date === 'string' ? op.date : ''
  if (!date) fail('date 不能为空')
  if (draft.learn.flags.lastLearnReportDate === date) return { receipts: [], won: false }
  draft.learn.flags.lastLearnReportDate = date
  return { receipts: [], won: true }
}

/** /学习任务 武装/解除一个会话：armed 后下一条消息被 pre-step 拦截为零成本记录。 */
function learnArmOp(draft, op) {
  const sessionId = typeof op.sessionId === 'string' ? op.sessionId : ''
  if (!sessionId) fail('sessionId 不能为空')
  if (op.on === false) {
    delete draft.learn.armed[sessionId]
    return { receipts: [{ text: '已关闭学习记录' }], armed: false }
  }
  draft.learn.armed[sessionId] = new Date().toISOString()
  return { receipts: [{ text: '已开启学习记录：本会话下一条消息将被记录为学习提问（不触发模型回复）' }], armed: true }
}

const OPS = {
  plan_move: applyPlanOp,
  plan_note: applyPlanOp,
  plan_config: (state, op) => { const result = applyPlanOp(state, op); if (op.patch?.model !== undefined) setAssistantModel(state, op.patch.model); return result },
  assistant_config: setAssistantConfig,
  retry_note: (state, op) => { const note = state.ideas.find(n => n.id === op.id); if (!note) fail('随手记不存在'); note.status = 'parked'; note.organizedAt = null; note.updatedAt = new Date().toISOString(); return { receipts: [] } },
  plan_schedule: applyPlanOp,
  deadline_event: deadlineEventOp,
  convert_task: convertTaskOp,
  plan_record: applyPlanOp,
  add_task: addTaskOp,
  update_task: updateTaskOp,
  delete_task: deleteTaskOp,
  capture_idea: captureIdeaOp,
  promote_idea: promoteIdeaOp,
  drop_idea: dropIdeaOp,
  add_review: addReviewOp,
  decide_review: decideReviewOp,
  move_to_collaboration: moveToCollaborationOp,
  learn_capture: learnCaptureOp,
  learn_write: learnWriteOp,
  learn_decide: learnDecideOp,
  learn_drop_inbox: learnDropInboxOp,
  learn_config: learnConfigOp,
  learn_flag_report: learnFlagReportOp,
  learn_arm: learnArmOp,
}

/**
 * 依序应用一组 op；单条失败记入 errors 并继续，返回回执。
 * @param {object} draft - 就地修改的状态。
 * @param {Array<{op: string}>} ops
 * @returns {{receipts: Array<{text: string, target?: string}>, errors: string[], targets: string[], results: object[]}}
 */
export function applyOps(draft, ops) {
  settlePlan(draft)
  const receipts = []
  const errors = []
  const targets = []
  const results = []
  if (!Array.isArray(ops)) {
    errors.push('ops 必须是数组')
    return { receipts, errors, targets, results }
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
      // Each operation is atomic: an invalid later field cannot partly mutate a task.
      const transactional = ['move_to_collaboration', 'decide_review', 'deadline_event', 'convert_task', 'add_task', 'update_task', 'plan_move', 'plan_note', 'plan_record', 'plan_config', 'plan_schedule', 'assistant_config', 'retry_note', 'learn_config'].includes(op.op)
      const candidate = transactional ? structuredClone(draft) : draft
      const result = handler(candidate, op)
      Object.assign(draft, candidate)
      receipts.push(...result.receipts)
      if (result.target) targets.push(result.target)
      results.push(result)
    } catch (err) {
      errors.push(`${op.op}：${err.message}`)
    }
  }
  return { receipts, errors, targets, results }
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

/** 清理过期任务、验收与随手记；学习卡长期保留。 */
export function cleanup(state) {
  const cutoffDone = daysLater(-DONE_RETENTION_DAYS)
  const cutoffDecided = daysLater(-DECIDED_RETENTION_DAYS)
  const time = (value) => (value ? Date.parse(value) : 0)
  // Calendar/project history refers to stable task IDs. Keep completed tasks for now;
  // pruning without an archive would silently erase historical progress.
  state.reviews = state.reviews.filter((row) => row.kind === 'collaboration' || row.status === 'pending' || !row.decidedAt || time(row.decidedAt) >= cutoffDecided)
  state.ideas = state.ideas.filter((row) => row.status === 'parked' || time(row.updatedAt) >= cutoffDecided)
}

const active = openTask

function publicTask(row) {
  return {
    ...planFields(row),
    id: row.id, title: row.title, note: row.note, status: row.status, priority: row.priority,
    tags: row.tags, due: row.due, focus: row.focus, checklist: row.checklist, progress: row.progress ?? [],
    origin: row.origin, createdAt: row.createdAt, updatedAt: row.updatedAt, completedAt: row.completedAt,
  }
}

/** 「今天」视图：进行中 ∪ 今天及以前到期 ∪ 焦点；附今日完成与各计数。 */
export function todayView(state, now = new Date()) {
  state = personalState(state)
  if (state.plan) {
    const today = calendarDate(now, state.plan.config.timezone)
    const rows = dayTasks(state, today).filter((t) => !t.movedTo)
    const tasks = rows.filter(openTask).map(publicTask)
    return { date: today, sections: tasks.length ? [{ key: 'planned', title: '今天安排', tasks }] : [], doneToday: state.tasks.filter(t=>t.status==='done' && t.completedAt && calendarDate(new Date(t.completedAt), state.plan.config.timezone)===today).map(publicTask), counts: countsOf(state, now) }
  }
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
  state = personalState(state)
  state = {...state, tasks: state.tasks.filter(isAction)}
  const zone = state.plan?.config?.timezone
  const today = zone ? calendarDate(now, zone) : todayString(now)
  const pendingReviews = state.reviews.filter((row) => row.status === 'pending' && row.kind !== 'collaboration')
  const oldestReview = pendingReviews.reduce((min, row) => (min === null || row.createdAt < min ? row.createdAt : min), null)
  return {
    todo: state.tasks.filter((row) => row.status === 'todo').length,
    doing: state.tasks.filter((row) => row.status === 'doing').length,
    blocked: state.tasks.filter((row) => row.status === 'blocked').length,
    doneTotal: state.tasks.filter((row) => row.status === 'done').length,
    dueToday: state.tasks.filter((row) => active(row) && row.due && row.due <= today).length,
    focus: state.tasks.filter((row) => active(row) && row.focus).length,
    doneToday: state.tasks.filter((row) => row.status === 'done' && row.completedAt && (zone ? calendarDate(new Date(row.completedAt), zone) : localDateOf(row.completedAt)) === today).length,
    pendingReviews: pendingReviews.length,
    parkedIdeas: state.ideas.filter((row) => row.status === 'parked').length,
    oldestReviewAgeMin: oldestReview ? Math.max(0, Math.round((now.getTime() - Date.parse(oldestReview)) / 60_000)) : null,
  }
}

export function allView(state) {
  state = personalState(state)
  const group = (status) => state.tasks.filter((row) => isAction(row) && row.status === status).map(publicTask)
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

/**
 * 学习视图：面板与日报共用的口径。
 * - counts：今日新增、待整理（收件箱）、各分类数、已掌握/已忽略
 * - concepts：按概念聚合的弱项清单（只统计未掌握条目，按出现次数排序，≥2 次的标 urgent）
 * - recent：最近 50 条已记录条目
 */
export function learnView(state, now = new Date()) {
  const today = todayString(now)
  const learn = state.learn
  const recorded = learn.entries.filter((row) => row.status === 'recorded' && row.kind !== 'suggested')
  const counts = {
    addedToday: learn.entries.filter((row) => localDateOf(row.createdAt) === today).length,
    pendingInbox: learn.inbox.length,
    recorded: recorded.length,
    dueReview: recorded.filter((row) => row.answer && (!row.nextReviewAt || Date.parse(row.nextReviewAt) <= now.getTime())).length,
    weak: recorded.filter((row) => row.category === 'weak').length,
    know: recorded.filter((row) => row.category === 'know').length,
    term: recorded.filter((row) => row.category === 'term').length,
    mastered: learn.entries.filter((row) => row.status === 'mastered').length,
    ignored: learn.entries.filter((row) => row.status === 'ignored').length,
  }
  // 概念聚合：同一概念问得越多越靠前；最后一次提问时间用于「很久没复习」提示
  const byConcept = new Map()
  for (const row of recorded) {
    const concept = row.concept || row.title
    let bucket = byConcept.get(concept)
    if (!bucket) {
      bucket = { concept, count: 0, lastAskedAt: '', categories: new Set(), entries: [] }
      byConcept.set(concept, bucket)
    }
    bucket.count += 1
    if (!bucket.lastAskedAt || row.askedAt > bucket.lastAskedAt) bucket.lastAskedAt = row.askedAt
    bucket.categories.add(row.category)
    bucket.entries.push(row.id)
  }
  const concepts = [...byConcept.values()]
    .map((bucket) => ({ ...bucket, categories: [...bucket.categories] }))
    .sort((a, b) => (a.count !== b.count ? b.count - a.count : (a.lastAskedAt < b.lastAskedAt ? 1 : -1)))
    .map((bucket) => ({ ...bucket, urgent: bucket.count >= 2 }))
  return {
    counts,
    inbox: learn.inbox,
    concepts,
    recent: learn.entries.slice(0, 50),
    config: learn.config,
  }
}
