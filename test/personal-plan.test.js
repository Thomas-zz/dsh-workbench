import { test } from 'node:test'
import assert from 'node:assert/strict'
import { migrateState, applyOps, countsOf, allView } from '../src/ops.js'
import { applyOrganization, personalOwnership } from '../src/organizer.js'
import {
  overlapLayout,
  dayTasks,
  personalState,
  planView,
  autoSchedule,
  settlePlan,
} from '../src/planner.js'

const message = (key, role, text) => ({
  key,
  role,
  text,
  source: 'codex',
  at: '2026-11-12T03:00:00Z',
  sessionId: 's',
})
const change = (m, kind, title = m.text) => ({
  evidenceKeys: [m.key],
  scope: 'standalone',
  ownership: { kind, evidenceKey: m.key, quote: m.text },
  patch: { title, plannedDate: '2099-11-12' },
})

test('个人行动、确认与委托执行分开，助手自述、伪造证据不得入库', () => {
  const rows = [
    message('a', 'assistant', '我会启动 demo-frontend 供用户继续联调测试'),
    message('b', 'user', '帮我把导出时的条件摘要修改成易读形式'),
    message('c', 'user', '我明天验收发布效果'),
    message('d', 'assistant', '请你确认采用哪一个方案'),
    message('e', 'assistant', '接下来需要提交并推送 luanji 和 workbench 代码'),
  ]
  const state = migrateState({ tasks: [] })
  const changes = [
    change(rows[0], 'user_action'),
    change(rows[1], 'user_action'),
    change(rows[2], 'user_action'),
    change(rows[3], 'user_confirmation'),
    change(rows[4], 'user_confirmation'),
  ]
  changes.push({
    ...change(rows[2], 'user_action', '伪造事项'),
    scope: 'standalone',
    ownership: {
      kind: 'user_action',
      evidenceKey: 'c',
      quote: '我来修改全部代码',
    },
  })
  applyOrganization(
    state,
    structuredClone(state),
    { messages: rows, cursors: {}, errors: [] },
    { changes },
  )
  assert.deepEqual(state.tasks.map((t) => t.title).sort(), [rows[2].text])
  assert.equal(countsOf(state).todo, 1)
  assert.deepEqual(
    state.reviews.map((r) => r.title),
    [rows[3].text],
  )
  assert.equal(
    personalOwnership(
      { ...change(rows[2], 'user_action'), evidenceKeys: ['a'] },
      new Map(rows.map((m) => [m.key, m])),
    ),
    null,
  )
})

test('旧自动事项退出日历、统计、排期和顺延，保留原文且可恢复和持久化', () => {
  let state = migrateState({
    schemaVersion: 2,
    tasks: [
      {
        id: 'old',
        title: '启动服务供用户测试',
        origin: { kind: 'auto' },
        plannedDate: '2026-11-12',
        estimateMinutes: 20,
        status: 'todo',
      },
    ],
    plan: { lastDate: '2026-11-12' },
  })
  state.plan.days['2026-11-12'] = {
    closed: true,
    items: [{ id: 'old', title: '旧快照', status: 'todo' }],
  }
  assert.equal(state.tasks.length, 1)
  assert.equal(dayTasks(state, '2026-11-12').length, 0)
  assert.equal(dayTasks(personalState(state), '2026-11-12').length, 0)
  assert.equal(countsOf(state).todo, 0)
  assert.equal(allView(state).todo.length, 0)
  assert.equal(planView(state, { date: '2026-11-12' }).days[0].tasks.length, 0)
  autoSchedule(state, '2026-11-12', { force: true })
  assert.equal(state.tasks[0].startMinute, null)
  settlePlan(state, new Date('2026-11-13T04:00:00Z'))
  assert.equal(state.tasks[0].plannedDate, '2026-11-12')
  const restored = applyOps(state, [
    {
      op: 'update_task',
      id: 'old',
      scope: 'standalone',
      ownership: { kind: 'user_action' },
    },
  ])
  assert.deepEqual(restored.errors, [])
  state = migrateState(JSON.parse(JSON.stringify(state)))
  assert.equal(countsOf(state).todo, 1)
  assert.equal(state.tasks[0].ownership.kind, 'user_action')
  assert.equal(state.tasks[0].title, '启动服务供用户测试')
})

test('助手内部计划不能改写用户任务标题和排期，但真实进展可追加', () => {
  const state = migrateState({ tasks: [] })
  const id = applyOps(state, [
    { op: 'add_task', title: '我来验证', plannedDate: '2099-11-12' },
  ]).targets[0]
  const m = message('a', 'assistant', '我会先启动服务')
  applyOrganization(
    state,
    structuredClone(state),
    { messages: [m], cursors: {}, errors: [] },
    {
      changes: [
        {
          id,
          evidenceKeys: ['a'],
          patch: {
            title: '启动服务',
            plannedDate: '2099-11-13',
            progress: '服务已启动',
          },
        },
      ],
    },
  )
  assert.equal(state.tasks[0].title, '我来验证')
  assert.equal(state.tasks[0].plannedDate, '2099-11-12')
  assert.equal(state.tasks[0].progress.at(-1).note, '服务已启动')
})

const block = (id, start, duration) => ({
  id,
  startMinute: start,
  estimateMinutes: duration,
})
function noCollision(rows) {
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i],
        b = rows[j]
      const vertical =
        a.start < b.start + b.height && b.start < a.start + a.height
      const horizontal =
        a.lane / a.count < (b.lane + b.span) / b.count &&
        b.lane / b.count < (a.lane + a.span) / a.count
      assert.ok(!(vertical && horizontal), `${a.task.id} 与 ${b.task.id} 覆盖`)
    }
}
test('短任务按可见高度分列，长任务结束后复用空列，边界相接不冲突', () => {
  const short = overlapLayout([
    block('a', 630, 5),
    block('b', 635, 5),
    block('c', 640, 5),
  ])
  noCollision(short)
  assert.equal(short[0].count, 3)
  const rows = overlapLayout([
    block('a', 540, 135),
    block('b', 555, 75),
    block('c', 560, 10),
    block('d', 660, 45),
  ])
  noCollision(rows)
  assert.equal(rows.find((r) => r.task.id === 'd').span, 2)
  assert.equal(
    overlapLayout([block('a', 540, 30), block('b', 570, 30)])[0].count,
    1,
  )
  const same = overlapLayout(
    Array.from({ length: 8 }, (_, i) => block(String(i), 600, 30)),
  )
  noCollision(same)
  assert.equal(same[0].count, 8)
})
