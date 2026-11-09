import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyOps, attachableTask, migrateState, resolveTask, todayView, countsOf, cleanup } from '../src/ops.js'

const base = () => migrateState({})

test('add_task / update_task 全流程', () => {
  const draft = base()
  const first = applyOps(draft, [{ op: 'add_task', title: '  写周报  ', due: '2026-11-06T10:00:00Z', tags: ['工作', '工作', ''], priority: 2 }])
  assert.equal(first.errors.length, 0)
  const task = draft.tasks.find((row) => row.title === '写周报')
  assert.equal(task.title, '写周报')
  assert.equal(task.due, '2026-11-06')
  assert.deepEqual(task.tags, ['工作'])
  assert.equal(task.priority, 2)

  const bad = applyOps(draft, [{ op: 'add_task', title: '' }, { op: 'add_task', title: 'ok', priority: 5 }, { op: 'nope' }])
  assert.equal(bad.errors.length, 3)
  assert.equal(draft.tasks.length, 1) // priority 非法的「ok」也没有入库

  applyOps(draft, [{ op: 'update_task', id: task.id, status: 'doing' }])
  assert.equal(draft.tasks.find((row) => row.id === task.id).status, 'doing')
  applyOps(draft, [{ op: 'update_task', id: task.id, status: 'done' }])
  assert.ok(draft.tasks.find((row) => row.id === task.id).completedAt)
  applyOps(draft, [{ op: 'update_task', id: task.id, status: 'todo' }])
  assert.equal(draft.tasks.find((row) => row.id === task.id).completedAt, null)
})

test('add_review 去重：同 dedupeKey 的 pending 不重复入队', () => {
  const draft = base()
  applyOps(draft, [{ op: 'add_review', kind: 'subagent', title: '子代理A', dedupeKey: 'subagent:s1' }])
  const second = applyOps(draft, [{ op: 'add_review', kind: 'subagent', title: '子代理A', dedupeKey: 'subagent:s1' }])
  assert.equal(draft.reviews.length, 1)
  assert.equal(second.receipts.length, 0)
})

test('decide_review：accept / dismiss / promote', () => {
  const draft = base()
  applyOps(draft, [
    { op: 'add_review', kind: 'workflow', title: '生成周报数据', dedupeKey: 'workflow:w1' },
    { op: 'add_review', kind: 'job', title: '跑批脚本', dedupeKey: 'job:j1' },
    { op: 'add_review', kind: 'job', title: '构建前端', dedupeKey: 'job:j2' },
  ])
  applyOps(draft, [{ op: 'decide_review', id: draft.reviews.find((row) => row.title === '生成周报数据').id, action: 'accept' }])
  applyOps(draft, [{ op: 'decide_review', id: draft.reviews.find((row) => row.title === '跑批脚本').id, action: 'dismiss' }])
  applyOps(draft, [{ op: 'decide_review', id: draft.reviews.find((row) => row.title === '构建前端').id, action: 'promote', taskTitle: '检查周报数据' }])
  assert.equal(draft.reviews.filter((row) => row.status === 'pending').length, 0)
  const promoted = draft.tasks.find((row) => row.title === '检查周报数据')
  assert.ok(promoted)
  assert.equal(draft.reviews.find((row) => row.title === '构建前端').promotedTaskId, promoted.id)
  // 已处置的条目不能再次处置
  const decidedId = draft.reviews.find((row) => row.title === '构建前端').id
  const again = applyOps(draft, [{ op: 'decide_review', id: decidedId, action: 'accept' }])
  assert.equal(again.errors.length, 1)
})

test('灵感：停靠 → 转任务 / 丢弃，且不可重复处理', () => {
  const draft = base()
  applyOps(draft, [{ op: 'capture_idea', text: '给工作台加个日历视图', note: '今天的对话里想到的' }])
  const idea = draft.ideas[0]
  applyOps(draft, [{ op: 'capture_idea', text: '第二个灵感' }])
  applyOps(draft, [{ op: 'promote_idea', id: idea.id, due: '2026-12-01' }])
  const task = draft.tasks[0]
  assert.equal(task.title, '给工作台加个日历视图')
  assert.equal(task.due, '2026-12-01')
  assert.equal(task.origin.kind, 'idea')
  const rePromote = applyOps(draft, [{ op: 'promote_idea', id: idea.id }])
  assert.equal(rePromote.errors.length, 1)
  applyOps(draft, [{ op: 'drop_idea', id: draft.ideas.find((row) => row.status === 'parked').id }])
  assert.equal(draft.ideas.filter((row) => row.status === 'parked').length, 0)
})

test('todayView：进行中 ∪ 到期 ∪ 焦点，去重且排序', () => {
  const draft = base()
  const now = new Date('2026-11-06T12:00:00+08:00')
  applyOps(draft, [
    { op: 'add_task', title: '在做的事', status: 'doing' },
    { op: 'add_task', title: '昨天到期', due: '2026-11-05' },
    { op: 'add_task', title: '明天到期', due: '2026-11-07' },
    { op: 'add_task', title: '焦点事', focus: true },
    { op: 'add_task', title: '做完了', status: 'done' },
  ])
  draft.tasks.find((row) => row.title === '做完了').completedAt = '2020-01-01T00:00:00.000Z'
  const view = todayView(draft, now)
  const titles = view.sections.flatMap((section) => section.tasks.map((row) => row.title))
  assert.deepEqual(titles, ['在做的事', '昨天到期', '焦点事'])
  assert.equal(view.counts.doneToday, 0) // 完成时间固定在远古，不算今日完成
  assert.ok(view.counts.doing === 1 && view.counts.todo === 3 && view.counts.dueToday === 1)
  // 当天完成的任务计入 doneToday
  draft.tasks.find((row) => row.title === '做完了').completedAt = '2026-11-06T03:00:00.000Z'
  assert.equal(todayView(draft, now).counts.doneToday, 1)
})

test('resolveTask：id → 精确标题 → 模糊匹配 → 候选', () => {
  const draft = base()
  applyOps(draft, [
    { op: 'add_task', title: '修登录页样式' },
    { op: 'add_task', title: '修登录页接口' },
    { op: 'add_task', title: '写文档' },
  ])
  const first = draft.tasks.find((row) => row.title === '修登录页样式')
  assert.equal(resolveTask(draft, first.id).task.id, first.id)
  assert.equal(resolveTask(draft, '写文档').task.title, '写文档')
  assert.equal(resolveTask(draft, '修登录页样式').task.id, first.id)
  const ambiguous = resolveTask(draft, '登录页')
  assert.equal(ambiguous.candidates.length, 2)
  const missing = resolveTask(draft, '不存在的事')
  assert.ok(missing.error)
})

test('cleanup：过期完成任务与已处置验收被清理，未满保留', () => {
  const draft = base()
  applyOps(draft, [
    { op: 'add_task', title: '旧的完成', status: 'done' },
    { op: 'add_task', title: '新的完成', status: 'done' },
    { op: 'add_review', kind: 'job', title: '旧验收', dedupeKey: 'job:old' },
    { op: 'add_review', kind: 'job', title: '新验收', dedupeKey: 'job:new' },
    { op: 'capture_idea', text: '旧灵感' },
  ])
  draft.tasks[0].completedAt = '2025-01-01T00:00:00.000Z'
  draft.tasks[1].completedAt = new Date().toISOString()
  draft.reviews.find((row) => row.dedupeKey === 'job:old').decidedAt = '2025-01-01T00:00:00.000Z'
  draft.reviews.find((row) => row.dedupeKey === 'job:old').status = 'dismissed'
  const idea = draft.ideas[0]
  idea.status = 'dropped'
  idea.updatedAt = '2025-01-01T00:00:00.000Z'
  cleanup(draft)
  assert.equal(draft.tasks.length, 1)
  assert.equal(draft.reviews.length, 1)
  assert.equal(draft.ideas.length, 0)
})

test('countsOf 汇总', () => {
  const draft = base()
  applyOps(draft, [
    { op: 'add_task', title: 'a', status: 'doing' },
    { op: 'add_task', title: 'b', due: '2026-11-06' },
    { op: 'add_review', kind: 'job', title: 'r', dedupeKey: 'job:k' },
    { op: 'capture_idea', text: 'i' },
  ])
  const counts = countsOf(draft, new Date('2026-11-06T09:00:00+08:00'))
  assert.equal(counts.doing, 1)
  assert.equal(counts.dueToday, 1)
  assert.equal(counts.pendingReviews, 1)
  assert.equal(counts.parkedIdeas, 1)
})

test('update_task progress：追加时间线（会话/外部执行者两种身份），超量裁剪', () => {
  const draft = base()
  applyOps(draft, [{ op: 'add_task', title: '整理 pitch 分享内容', status: 'doing' }])
  const task = draft.tasks[0]
  const result = applyOps(draft, [
    { op: 'update_task', id: task.id, progress: '已开始整理大纲', progressSession: 'session-a' },
    { op: 'update_task', id: task.id, progress: '已派出子代理抓取数据', progressSession: 'session-a' },
    { op: 'update_task', id: task.id, progress: '素材已就绪', progressActor: 'ZCode' },
  ])
  assert.equal(result.errors.length, 0)
  assert.ok(result.receipts[0].text.includes('已记录进展'))
  const progress = draft.tasks.find((row) => row.id === task.id).progress
  assert.equal(progress.length, 3)
  assert.equal(progress[0].note, '已开始整理大纲')
  assert.equal(progress[0].sessionId, 'session-a')
  assert.equal(progress[2].actor, 'ZCode')
  // 保留最近 50 条
  for (let index = 0; index < 55; index += 1) {
    applyOps(draft, [{ op: 'update_task', id: task.id, progress: `推进 ${index}`, progressSession: 'session-a' }])
  }
  const trimmed = draft.tasks.find((row) => row.id === task.id).progress
  assert.equal(trimmed.length, 50)
  assert.equal(trimmed[trimmed.length - 1].note, '推进 54')
  // 空白 progress 不追加
  applyOps(draft, [{ op: 'update_task', id: task.id, progress: '   ' }])
  assert.equal(draft.tasks.find((row) => row.id === task.id).progress.length, 50)
})

test('add_review：summary 与挂靠 taskId（任务不存在时留空）', () => {
  const draft = base()
  applyOps(draft, [{ op: 'add_task', title: '整理 pitch 分享内容', status: 'doing' }])
  const task = draft.tasks[0]
  applyOps(draft, [{ op: 'add_review', kind: 'subagent', title: '大纲完成', summary: '大纲共 5 节，第一节…', sessionId: 'session-a', taskId: task.id, dedupeKey: 'subagent:r1' }])
  applyOps(draft, [{ op: 'add_review', kind: 'job', title: '跑批', summary: '状态：finished', taskId: 't_不存在', dedupeKey: 'job:r2' }])
  const linked = draft.reviews.find((row) => row.dedupeKey === 'subagent:r1')
  assert.equal(linked.summary, '大纲共 5 节，第一节…')
  assert.equal(linked.taskId, task.id)
  assert.equal(draft.reviews.find((row) => row.dedupeKey === 'job:r2').taskId, null)
})

test('migrateState：flags 默认、zcode 来源与 progress 迁移保留', () => {
  const draft = migrateState({})
  assert.deepEqual(draft.flags, { lastBriefingDate: '' })
  applyOps(draft, [{ op: 'add_task', title: 'ZCode 来的任务', origin: { kind: 'zcode' } }])
  applyOps(draft, [{ op: 'update_task', id: draft.tasks[0].id, progress: '开工', progressActor: 'ZCode' }])
  const restored = migrateState(JSON.parse(JSON.stringify(draft)))
  assert.equal(restored.tasks[0].origin.kind, 'zcode')
  assert.equal(restored.tasks[0].progress[0].actor, 'ZCode')
  assert.equal(restored.flags.lastBriefingDate, '')
})

test('attachableTask：优先 doing、其次最近的 open、无关联返回 undefined', () => {
  const draft = base()
  applyOps(draft, [
    { op: 'add_task', title: '待办一', origin: { kind: 'chat', sessionId: 'session-a' } },
    { op: 'add_task', title: '进行中的活', status: 'doing', origin: { kind: 'chat', sessionId: 'session-a' } },
    { op: 'add_task', title: '别的会话的事', status: 'doing', origin: { kind: 'chat', sessionId: 'session-b' } },
    { op: 'add_task', title: '干完的', status: 'done', origin: { kind: 'chat', sessionId: 'session-a' } },
  ])
  // session-a 名下既有 doing 也有 todo：取 doing
  assert.equal(attachableTask(draft, 'session-a').title, '进行中的活')
  // 只干过 progress 的会话也算名下
  applyOps(draft, [{ op: 'update_task', id: draft.tasks.find((row) => row.title === '待办一').id, progress: '接手', progressSession: 'session-c' }])
  assert.equal(attachableTask(draft, 'session-c').title, '待办一')
  // 完成的任务不算；无关联会话返回 undefined
  assert.equal(attachableTask(draft, 'session-b').title, '别的会话的事')
  assert.equal(attachableTask(draft, 'session-none'), undefined)
  assert.equal(attachableTask(draft, ''), undefined)
})

test('todayView sections 带稳定 key', () => {
  const draft = base()
  const now = new Date('2026-11-06T12:00:00+08:00')
  applyOps(draft, [
    { op: 'add_task', title: '在做的事', status: 'doing' },
    { op: 'add_task', title: '到期的事', due: '2026-11-06' },
    { op: 'add_task', title: '焦点事', focus: true },
  ])
  const keys = todayView(draft, now).sections.map((section) => section.key)
  assert.deepEqual(keys, ['doing', 'due', 'focus'])
})
