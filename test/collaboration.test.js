import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrateState, applyOps, countsOf, cleanup } from '../src/ops.js'
import { applyOrganization, runOrganizer } from '../src/organizer.js'
import { collectTaskResearch } from '../src/organization-research.js'
import { dayTasks, autoSchedule } from '../src/planner.js'
import { poolTasks } from '../src/personal-plan.js'
import { Store } from '../src/store.js'
import { organizationContext } from './helpers/organization-context.js'
import { installOrganizationSessions } from '../src/organization-session.js'

const message = (
  text = '请你确认本次发布采用的版本',
  key = 'request',
  role = 'assistant',
  at = '2026-11-18T01:00:00Z',
) => ({ key, text, role, at, source: 'codex', sessionId: 'thread' })
const collected = (rows) => ({
  messages: rows,
  context: [],
  errors: [],
  cursors: {},
  mode: 'collect',
})
const proposal = (m, extra = {}) => ({
  title: '确认发布版本',
  project: '工具',
  summary: '发布前需要选定版本',
  evidenceKeys: [m.key],
  ownership: {
    kind: m.role === 'user' ? 'user_action' : 'user_confirmation',
    evidenceKey: m.key,
    quote: m.text,
  },
  ...extra,
})
const apply = (s, ops) => {
  const r = applyOps(s, ops)
  assert.deepEqual(r.errors, [])
  return r.targets[0]
}
const organize = (s, c, result, base = structuredClone(s)) =>
  applyOrganization(s, base, c, { changes: [], ...result })

test('过程动作进入待协作，不占事项池、日历、计数或排期；粒度不明保守归类', () => {
  const s = migrateState({}),
    m = message(),
    c = collected([m])
  const result = organize(s, c, {
    changes: [
      {
        ...proposal(m),
        scope: 'standalone',
        patch: { title: '确认发布版本', plannedDate: '2026-11-19' },
      },
    ],
  })
  assert.equal(result.collaborationAdded, 1)
  assert.equal(result.added, 0)
  assert.equal(s.reviews[0].source, 'codex')
  assert.equal(s.reviews[0].ownership.quote, m.text)
  assert.equal(s.tasks.length, 0)
  assert.equal(countsOf(s).todo, 0)
  assert.equal(countsOf(s).pendingReviews, 0)
  assert.equal(poolTasks(s).length, 0)
  assert.equal(dayTasks(s, '2026-11-19').length, 0)
  autoSchedule(s, '2026-11-19')
  assert.equal(s.tasks.length, 0)
  const u = message('我来补充接口示例', 'user', 'user')
  organize(s, collected([u]), {
    changes: [{ ...proposal(u), patch: { title: '补充接口示例' } }],
  })
  assert.equal(s.reviews.length, 2)
  assert.deepEqual(migrateState(s).reviews, s.reviews)
})

test('独立目标需要用户原文与明确 scope；委托、伪造、上下文不能新增协作', () => {
  const s = migrateState({}),
    m = message('我要完成工具项目开发', 'goal', 'user')
  organize(s, collected([m]), {
    changes: [
      {
        ...proposal(m),
        scope: 'standalone',
        patch: { title: '完成工具项目开发' },
      },
    ],
  })
  assert.equal(s.tasks.length, 1)
  const delegated = message('帮我实现全部代码', 'delegate', 'user')
  const c = collected([delegated])
  organize(s, c, { collaborations: [proposal(delegated)] })
  assert.equal(s.reviews.length, 0)
  const request = message()
  organize(
    s,
    { ...collected([]), context: [request] },
    { collaborations: [proposal(request)] },
  )
  assert.equal(s.reviews.length, 0)
  organize(s, collected([request]), {
    collaborations: [
      proposal(request, {
        ownership: {
          kind: 'user_confirmation',
          evidenceKey: request.key,
          quote: '请你批准不在原文的操作',
        },
      }),
    ],
  })
  assert.equal(s.reviews.length, 0)
})

test('协作去重，已处理/忽略不会被旧请求重建；明确的新请求可再次收集', () => {
  const s = migrateState({}),
    m = message()
  organize(s, collected([m]), { collaborations: [proposal(m), proposal(m)] })
  assert.equal(s.reviews.length, 1)
  const id = s.reviews[0].id
  apply(s, [{ op: 'decide_review', id, action: 'dismiss' }])
  s.reviews[0].decidedAt = '2026-11-18T03:00:00Z'
  organize(s, collected([m]), { collaborations: [proposal(m)] })
  assert.equal(s.reviews.length, 1)
  cleanup(s)
  assert.equal(s.reviews.length, 1)
  const next = message(m.text, 'next', 'assistant', '2026-11-18T04:00:00Z')
  organize(s, collected([next]), { collaborations: [proposal(next)] })
  assert.equal(s.reviews.length, 2)
})

test('人工转入事项池保留项目与来源，无日期；不重复提升，不被重新自动移走', () => {
  const s = migrateState({}),
    m = message()
  organize(s, collected([m]), { collaborations: [proposal(m)] })
  const id = s.reviews[0].id
  const taskId = apply(s, [{ op: 'decide_review', id, action: 'promote' }])
  const task = s.tasks[0]
  assert.equal(task.plannedDate, null)
  assert.equal(task.plannedWeek, null)
  assert.equal(task.project, '工具')
  assert.equal(task.origin.source, 'codex')
  assert.ok(task.userFields.ownership)
  assert.equal(poolTasks(s)[0].id, taskId)
  assert.equal(
    applyOps(s, [{ op: 'decide_review', id, action: 'promote' }]).errors.length,
    1,
  )
  organize(s, collected([m]), {
    collaborations: [proposal(m), { taskId, evidenceKeys: [m.key] }],
  })
  assert.equal(s.tasks.length, 1)
  assert.equal(s.reviews.length, 1)
})

test('完成协作需要同一对话的后续证据；保留用户并发操作，支持重新打开', () => {
  const s = migrateState({}),
    m = message()
  organize(s, collected([m]), { collaborations: [proposal(m)] })
  const id = s.reviews[0].id,
    base = structuredClone(s)
  const done = message(
    '已按你选择的版本发布完成',
    'done',
    'assistant',
    '2026-11-18T05:00:00Z',
  )
  const finish = {
    id,
    status: 'accepted',
    evidenceKeys: [done.key],
    resolutionQuote: done.text,
  }
  organize(s, collected([{ ...done, sessionId: 'elsewhere' }]), {
    collaborations: [finish],
  })
  assert.equal(s.reviews[0].status, 'pending')
  organize(s, collected([m]), {
    collaborations: [
      { ...finish, evidenceKeys: [m.key], resolutionQuote: m.text },
    ],
  })
  assert.equal(s.reviews[0].status, 'pending')
  apply(s, [{ op: 'decide_review', id, action: 'dismiss' }])
  organize(s, collected([done]), { collaborations: [finish] }, base)
  assert.equal(s.reviews[0].status, 'dismissed')
  apply(s, [{ op: 'decide_review', id, action: 'reopen' }])
  organize(s, collected([done]), { collaborations: [finish] })
  assert.equal(s.reviews[0].status, 'accepted')
})

test('历史自动池事项按证据重分类，已安排/修改/并发改动的事项保持原样', () => {
  const s = migrateState({}),
    m = message()
  const add = (extra = {}) =>
    apply(s, [
      {
        op: 'add_task',
        actor: 'organizer',
        title: '确认版本',
        origin: { kind: 'auto', source: 'codex', sessionId: 'thread' },
        ownership: { kind: 'user_confirmation' },
        evidence: [m],
        ...extra,
      },
    ])
  const untouched = add(),
    dated = add({ plannedDate: '2026-11-19' }),
    weekly = add({ plannedWeek: '2026-11-16' }),
    edited = add(),
    concurrent = add()
  apply(s, [{ op: 'update_task', id: edited, note: '我改过的' }])
  const base = structuredClone(s)
  apply(s, [{ op: 'update_task', id: concurrent, title: '正在编辑' }])
  const result = organize(
    s,
    collected([m]),
    {
      collaborations: [untouched, dated, weekly, edited, concurrent].map(
        (taskId) => ({ taskId, evidenceKeys: [m.key] }),
      ),
    },
    base,
  )
  assert.equal(result.collaborationMoved, 1)
  assert.deepEqual(
    s.tasks.map((t) => t.id).sort(),
    [dated, weekly, edited, concurrent].sort(),
  )
  assert.equal(s.reviews[0].originalTask.id, untouched)
})

test('手动移入、撤销、重新加载和恢复保持 ID、笔记、历史及来源', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'wb-collaboration-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const store = new Store(root)
  const id = await store.mutate('新增', (s) =>
    apply(s, [
      {
        op: 'add_task',
        title: '关闭旧 MR',
        project: '工具',
        plannedDate: '2026-11-19',
        startMinute: 600,
        note: '完整备注'.repeat(200),
        origin: { kind: 'auto', source: 'codex', sessionId: 'thread' },
        ownership: { kind: 'user_confirmation' },
        progress: '已合并',
      },
    ]),
  )
  const before = structuredClone((await store.read()).tasks[0])
  const move = () =>
    store.mutate('移到待协作', (s) =>
      apply(s, [{ op: 'move_to_collaboration', id }]),
    )
  await move()
  assert.equal((await store.read()).tasks.length, 0)
  await store.undoLast()
  assert.deepEqual((await store.read()).tasks[0], before)
  const reviewId = await move()
  const reload = new Store(root)
  const reloaded = await reload.read()
  assert.deepEqual(reloaded.reviews[0].originalTask, before)
  await reload.mutate('转回', (s) =>
    apply(s, [{ op: 'decide_review', id: reviewId, action: 'promote' }]),
  )
  const restored = (await reload.read()).tasks[0]
  assert.equal(restored.id, id)
  assert.equal(restored.note, before.note)
  assert.deepEqual(restored.origin, before.origin)
  assert.equal(restored.plannedDate, null)
  assert.equal(restored.startMinute, null)
  assert.equal(restored.project, before.project)
  await reload.undoLast()
  assert.equal((await reload.read()).reviews[0].status, 'pending')
  assert.equal((await reload.read()).tasks.length, 0)
})

test('检索能分页读取协作与已处理，回查增量范围外的来源；工具提交回执包含协作', async (t) => {
  const s = migrateState({}),
    m = message()
  s.plan.config.sources = {
    codex: true,
    dsh: false,
    claude: false,
    zcode: false,
  }
  organize(s, collected([m]), { collaborations: [proposal(m)] })
  s.plan.organizer.cursors.codex = '2026-11-19T03:00:00Z'
  const c = await collectTaskResearch(s, {
    now: new Date('2026-11-19T04:00:00Z'),
    scan: { codex: async () => [] },
  })
  assert.ok(
    c.research.initial.some(
      (r) => r.ref === 'codex:thread' && r.linkedCollaborationIds.length === 1,
    ),
  )
  const page = await c.research.inspect(
    { action: 'collaborations', status: 'pending', query: '发布', limit: 1 },
    { read: async () => s },
  )
  assert.equal(page.total, 1)
  assert.equal(page.collaborations[0].id, s.reviews[0].id)
  const root = await mkdtemp(join(tmpdir(), 'wb-collab-run-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const store = new Store(root)
  const ctx = organizationContext((messages) => ({
    changes: [],
    collaborations: [proposal(messages[0])],
    summary: '发现一个待协作',
  }))
  t.after(() => installOrganizationSessions(ctx, store).dispose())
  const result = await runOrganizer(ctx, store, {
    trigger: 'manual',
    collect: async () => collected([m]),
  })
  await ctx.idle()
  assert.equal(result.collaborationAdded, 1)
  assert.equal(ctx.receipts[0].collaborationAdded, 1)
  assert.equal(
    ctx.receipts[0].collaborations[0].id,
    (await store.read()).reviews[0].id,
  )
  assert.equal((await store.read()).tasks.length, 0)
})

test('新条目已经处理则不收集；已完成事项之后明确的新一轮协作仍可收集', () => {
  const s = migrateState({}),
    m = message()
  organize(s, collected([m]), {
    collaborations: [proposal(m, { status: 'accepted' })],
  })
  assert.equal(s.reviews.length, 0)
  organize(s, collected([m]), { collaborations: [proposal(m)] })
  const id = s.reviews[0].id
  const taskId = apply(s, [{ op: 'decide_review', id, action: 'promote' }])
  apply(s, [{ op: 'update_task', id: taskId, status: 'done' }])
  const later = message(
    m.text,
    'next-round',
    'assistant',
    new Date(Date.now() + 10000).toISOString(),
  )
  organize(s, collected([later]), { collaborations: [proposal(later)] })
  assert.equal(s.reviews.length, 2)
  assert.equal(s.tasks.length, 1)
  assert.equal(s.reviews[0].status, 'pending')
})

test('排期和估时不会创建或重分类协作；固定日程不能移入待协作', () => {
  const s = migrateState({}),
    m = message()
  for (const mode of ['schedule', 'estimate'])
    organize(
      s,
      { ...collected([m]), mode, taskIds: [] },
      { collaborations: [proposal(m)] },
    )
  assert.equal(s.reviews.length, 0)
  const id = apply(s, [
    {
      op: 'add_task',
      kind: 'event',
      title: '固定会议',
      plannedDate: '2026-11-19',
    },
  ])
  const before = structuredClone(s.tasks)
  assert.equal(
    applyOps(s, [{ op: 'move_to_collaboration', id }]).errors.length,
    1,
  )
  assert.deepEqual(s.tasks, before)
})

test('已有待协作不因模型再次提交独立事项而产生第二份记录', () => {
  const s = migrateState({}),
    m = message('我来确认版本', 'u', 'user')
  organize(s, collected([m]), { collaborations: [proposal(m)] })
  organize(s, collected([m]), {
    changes: [
      {
        ...proposal(m),
        scope: 'standalone',
        patch: { title: '确认发布版本', project: '工具' },
      },
    ],
  })
  assert.equal(s.tasks.length, 0)
  assert.equal(s.reviews.length, 1)
})
