import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrateState, applyOps } from '../src/ops.js'
import { Store } from '../src/store.js'
import {
  applyOrganization,
  collectTaskMessages,
  organizerPrompt,
  runOrganizer,
} from '../src/organizer.js'
import { ORGANIZATION_POLICY } from '../src/organization-policy.js'
import { reconcilePlan } from '../src/organization-planning.js'
import { planningTaskIds } from '../src/personal-plan.js'
const today = '2026-11-18'
const instant = new Date('2026-11-18T01:07:00Z')
function state() {
  return migrateState({
    plan: {
      config: {
        timezone: 'Asia/Shanghai',
        slots: [
          [540, 720],
          [840, 1080],
        ],
        sources: { dsh: false, codex: false, claude: false, zcode: false },
      },
    },
  })
}
function add(s, patch) {
  const r = applyOps(s, [{ op: 'add_task', title: '待处理', ...patch }])
  assert.deepEqual(r.errors, [])
  return s.tasks.find((t) => t.id === r.targets[0])
}
const saved = (s, task) => s.tasks.find((t) => t.id === task.id)
const plan = (s) => ({
  date: today,
  taskIds: planningTaskIds(s, today, instant),
  requestKey: 'plan',
})
const collect = (messages = [], extra = {}) => ({
  mode: 'collect',
  messages,
  context: [],
  errors: [],
  cursors: {},
  ...extra,
})

test('整理先顺延再排期，保留完成、固定日程、未来安排、事项池和硬截止', () => {
  const s = state()
  const old = add(s, {
    title: '昨日任务',
    plannedDate: '2026-11-17',
    startMinute: 600,
    due: '2026-11-17',
    estimateMinutes: 45,
  })
  const done = add(s, {
    title: '已完成',
    plannedDate: '2026-11-17',
    status: 'done',
  })
  const event = add(s, {
    title: '固定日程',
    kind: 'event',
    plannedDate: '2026-11-17',
    startMinute: 600,
  })
  const future = add(s, { title: '明日事项', plannedDate: '2026-11-19' })
  const pool = add(s, { title: '周事项', plannedWeek: '2026-11-16' })
  const locked = add(s, {
    title: '今日手动时间',
    plannedDate: today,
    startMinute: 555,
    estimateMinutes: 45,
  })
  const base = structuredClone(s)
  const result = reconcilePlan(s, base, plan(s), {
    now: instant,
    busy: [[600, 630]],
  })
  assert.equal(result.carried, 1)
  assert.equal(result.scheduled, 1)
  assert.equal(saved(s, old).plannedDate, today)
  assert.equal(saved(s, old).startMinute, 630)
  assert.equal(saved(s, old).due, '2026-11-17')
  assert.equal(saved(s, old).carriedFrom, '2026-11-17')
  assert.equal(s.plan.days['2026-11-17'].items[0].movedTo, today)
  for (const row of [done, event, future, pool, locked])
    assert.deepEqual(
      saved(s, row),
      base.tasks.find((t) => t.id === row.id),
    )
})
test('整理过程中手动完成或改期优先；完成证据先处理，之后不顺延', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: instant })
  const s = state(),
    a = add(s, { plannedDate: '2026-11-17' }),
    b = add(s, { title: '确认材料', plannedDate: '2026-11-17' })
  const base = structuredClone(s),
    planning = plan(s)
  applyOps(s, [
    {
      op: 'update_task',
      id: a.id,
      plannedDate: '2026-11-20',
      startMinute: 600,
    },
  ])
  const m = {
    key: 'complete',
    role: 'user',
    text: '确认材料已经完成了',
    at: instant.toISOString(),
  }
  applyOrganization(s, base, collect([m], { planning }), {
    changes: [
      { id: b.id, evidenceKeys: ['complete'], patch: { status: 'done' } },
    ],
  })
  assert.equal(saved(s, a).plannedDate, '2026-11-20')
  assert.equal(saved(s, b).plannedDate, '2026-11-17')
  assert.equal(saved(s, b).status, 'done')
})
test('无空档或日历失联仍顺延；不挤进过去时间、不改估时、不伪称已排时间', () => {
  for (const skipTimes of [false, true]) {
    const s = state(),
      a = add(s, { plannedDate: '2026-11-17', estimateMinutes: 60 }),
      base = structuredClone(s)
    const r = reconcilePlan(s, base, plan(s), {
      now: new Date('2026-11-18T10:30:00Z'),
      skipTimes,
    })
    assert.equal(r.carried, 1)
    assert.equal(r.scheduled, 0)
    assert.equal(r.unscheduled, 1)
    assert.equal(saved(s, a).startMinute, null)
    assert.equal(saved(s, a).estimateMinutes, 60)
    assert.equal(saved(s, a).plannedDate, today)
  }
})
test('计划请求可给已有事项排序和估时，不能伪造完成或从系统请求创建事项', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: instant })
  const s = state(),
    a = add(s, { plannedDate: '2026-11-17' }),
    base = structuredClone(s)
  applyOrganization(s, base, collect([], { planning: plan(s) }), {
    changes: [
      {
        id: a.id,
        evidenceKeys: ['plan'],
        patch: { status: 'done', order: 12, estimateMinutes: 45 },
      },
    ],
  })
  assert.equal(saved(s, a).status, 'todo')
  assert.equal(saved(s, a).order, 12)
  assert.equal(saved(s, a).estimateMinutes, 45)
  assert.equal(saved(s, a).plannedDate, today)
})
test('较早请求不再创建已完成同名事项，明确新一轮请求仍可创建；上下文不能创建新事项', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: instant })
  const s = state()
  add(s, { title: '提交材料', status: 'done', project: '个人' })
  const change = (m) => ({
    scope: 'standalone',
    ownership: { kind: 'user_action', evidenceKey: m.key, quote: m.text },
    evidenceKeys: [m.key],
    patch: { title: '提交材料', project: '个人' },
  })
  const old = {
    key: 'old',
    role: 'user',
    text: '我来提交材料',
    at: '2026-11-17T01:00:00Z',
  }
  applyOrganization(s, structuredClone(s), collect([old]), {
    changes: [change(old)],
  })
  assert.equal(s.tasks.length, 1)
  const next = { ...old, key: 'new', at: '2026-11-18T02:00:00Z' }
  applyOrganization(s, structuredClone(s), collect([], { context: [next] }), {
    changes: [change(next)],
  })
  assert.equal(s.tasks.length, 1)
  applyOrganization(s, structuredClone(s), collect([next]), {
    changes: [change(next)],
  })
  assert.equal(s.tasks.length, 2)
  assert.equal(s.tasks[0].origin.kind, 'auto')
})
test('小批扫描同时提供后续完成上下文，游标只推进本批，不漏掉未处理消息', async () => {
  const s = state()
  s.plan.config.sources = { dsh: true }
  const rows = [
    {
      source: 'dsh',
      sessionId: 's',
      role: 'user',
      text: '我来提交材料',
      at: '2026-11-18T01:00:00Z',
    },
    {
      source: 'dsh',
      sessionId: 's',
      role: 'user',
      text: '材料已提交完成',
      at: '2026-11-18T02:00:00Z',
    },
  ]
  const c = await collectTaskMessages(s, {
    scan: { dsh: async () => rows },
    limit: 1,
    now: new Date('2026-11-18T03:00:00Z'),
  })
  assert.equal(c.messages.length, 1)
  assert.equal(c.context.length, 1)
  assert.equal(c.context[0].text, '材料已提交完成')
  assert.equal(c.cursors.dsh, rows[0].at)
  const prompt = organizerPrompt(s, c)
  assert.ok(prompt.includes('材料已提交完成'))
  assert.doesNotMatch(
    ORGANIZATION_POLICY,
    /\/Users\/|\/home\/|部署|代码|提测流程/,
  )
})
test('真实整理入口即使没有新增材料也复核旧任务，并把顺延排期写入回执和记录', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: instant })
  const root = await mkdtemp(join(tmpdir(), 'wb-organize-plan-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const store = new Store(root)
  await store.mutate('准备', (s) => {
    Object.assign(s, state())
    add(s, { plannedDate: '2026-11-17' })
  })
  let called = false
  const result = await runOrganizer({}, store, {
    trigger: 'manual',
    generate: async (_ctx, base, c) => {
      called = true
      assert.equal(c.planning.taskIds.length, 1)
      return { changes: [], summary: '检查完毕' }
    },
  })
  assert.equal(called, true)
  assert.equal(result.carried, 1)
  assert.equal(result.scheduled, 1)
  const saved = await store.read()
  assert.equal(saved.tasks[0].plannedDate, today)
  assert.match(saved.plan.organizer.lastSummary, /顺延 1 项/)
  assert.equal(saved.plan.organizer.runs[0].tasks[0].action, 'carried')
})

test('新增事项同轮排期保留创建来源、随手记关联及完整回执', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: instant })
  const s = state()
  const captured = applyOps(s, [
    { op: 'capture_idea', text: '我今天准备申请资料' },
  ])
  const note = s.ideas.find((n) => n.id === captured.targets[0])
  const m = {
    key: 'note',
    noteId: note.id,
    noteVersion: note.updatedAt,
    at: note.createdAt,
    role: 'user',
    text: note.text,
  }
  const c = collect([m], { planning: plan(s) })
  const result = applyOrganization(s, structuredClone(s), c, {
    changes: [
      {
        scope: 'standalone',
        ownership: { kind: 'user_action', evidenceKey: 'note', quote: m.text },
        evidenceKeys: ['note'],
        patch: { title: '准备申请资料', plannedDate: today },
      },
    ],
  })
  assert.equal(result.added, 1)
  assert.equal(result.scheduled, 1)
  assert.equal(s.ideas[0].taskIds[0], s.tasks[0].id)
  assert.equal(c.affected[0].action, 'created')
  assert.deepEqual(c.affected[0].evidenceKeys, ['note', 'plan'])
  assert.equal(s.tasks[0].origin.kind, 'auto')
})

test('安排未来目标日只带入过期事项，不搬走今天与其他未来日期的计划', () => {
  const s = state()
  const old = add(s, { title: '过期事项', plannedDate: '2026-11-17' })
  const todayTask = add(s, { title: '今天事项', plannedDate: today })
  const future = add(s, { title: '明天事项', plannedDate: '2026-11-19' })
  const target = add(s, { title: '目标日事项', plannedDate: '2026-11-20' })
  const taskIds = planningTaskIds(s, '2026-11-20', instant)
  assert.deepEqual(new Set(taskIds), new Set([old.id, target.id]))
  reconcilePlan(
    s,
    structuredClone(s),
    { date: '2026-11-20', taskIds, requestKey: 'plan' },
    { now: instant },
  )
  assert.equal(saved(s, old).plannedDate, '2026-11-20')
  assert.equal(saved(s, todayTask).plannedDate, today)
  assert.equal(saved(s, future).plannedDate, '2026-11-19')
})
