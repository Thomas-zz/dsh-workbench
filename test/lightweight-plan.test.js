import { test } from 'node:test'
import assert from 'node:assert/strict'
import { migrateState, applyOps } from '../src/ops.js'
import { dayTasks, autoSchedule, settlePlan } from '../src/planner.js'
import {
  capturePlacement,
  poolTasks,
  taskSuggestions,
  projectColor,
} from '../src/personal-plan.js'
import { applyOrganization } from '../src/organizer.js'
const state = () =>
  migrateState({
    schemaVersion: 2,
    tasks: [],
    plan: { config: { timezone: 'Asia/Shanghai' } },
  })
const add = (s, p) => {
  const r = applyOps(s, [{ op: 'add_task', title: '事项', ...p }])
  assert.deepEqual(r.errors, [])
  return s.tasks.find((t) => t.id === r.targets[0])
}
test('入口决定默认位置：全局池、周池、日期、时间段', () => {
  assert.deepEqual(capturePlacement(), {
    plannedDate: null,
    plannedWeek: null,
    startMinute: null,
  })
  assert.deepEqual(capturePlacement({ week: '2026-11-18' }), {
    plannedDate: null,
    plannedWeek: '2026-11-16',
    startMinute: null,
  })
  assert.deepEqual(capturePlacement({ date: '2026-11-18', startMinute: 600 }), {
    plannedDate: '2026-11-18',
    plannedWeek: '2026-11-16',
    startMinute: 600,
  })
})
test('周池跨周、到日期、回全局池始终是同一 ID，清除旧时间', () => {
  const s = state(),
    t = add(s, { plannedWeek: '2026-11-16' })
  for (const op of [
    { week: '2026-11-23' },
    { date: '2026-11-24', startMinute: 660 },
    { date: null, week: null },
  ]) {
    assert.deepEqual(
      applyOps(s, [{ op: 'plan_move', id: t.id, ...op }]).errors,
      [],
    )
    assert.equal(s.tasks.length, 1)
    assert.equal(s.tasks[0].id, t.id)
  }
  assert.equal(poolTasks(s).length, 1)
  assert.equal(s.tasks[0].startMinute, null)
  assert.equal(s.tasks[0].plannedWeek, null)
})
test('完成不影响列表顺序或池位置，也不会复制到实际完成日', () => {
  const s = state(),
    a = add(s, { plannedDate: '2026-10-01', order: 1 }),
    b = add(s, { plannedDate: '2026-10-01', order: 2 })
  applyOps(s, [{ op: 'update_task', id: a.id, status: 'done' }])
  settlePlan(s, new Date('2026-12-01T00:00:00Z'))
  assert.deepEqual(
    dayTasks(s, '2026-10-01').map((t) => t.id),
    [a.id, b.id],
  )
  const pool = add(s, { plannedWeek: '2026-11-16', status: 'done' })
  assert.ok(poolTasks(s, '2026-11-16').some((t) => t.id === pool.id))
})
test('联想区分未完成复用和完成历史，颜色稳定，不联想 agent 工作', () => {
  const s = state(),
    done = add(s, { title: '整理材料', project: '评审', status: 'done' }),
    open = add(s, { title: '整理材料', project: '评审' })
  add(s, { title: '整理材料内部步骤', origin: { kind: 'auto' } })
  const rows = taskSuggestions(s.tasks, '整理')
  assert.deepEqual(
    rows.map((t) => t.id),
    [open.id, done.id],
  )
  assert.equal(rows[1].status, 'done')
  assert.equal(projectColor('评审'), projectColor('评审'))
})
test('删除同时清除旧快照，避免历史事项复活', () => {
  const s = state(),
    t = add(s, { plannedDate: '2026-10-01' })
  s.plan.days['2026-10-01'] = { closed: true, items: [structuredClone(t)] }
  applyOps(s, [{ op: 'delete_task', id: t.id }])
  assert.equal(dayTasks(s, '2026-10-01').length, 0)
})
test('助手主动排时间避开飞书和已完成时间块，放不下不重叠', () => {
  const s = state()
  s.plan.config.slots = [[540, 660]]
  add(s, {
    plannedDate: '2026-11-16',
    startMinute: 540,
    estimateMinutes: 30,
    status: 'done',
  })
  const a = add(s, {
      plannedDate: '2026-11-16',
      estimateMinutes: 30,
      order: 1,
    }),
    b = add(s, { plannedDate: '2026-11-16', estimateMinutes: 60, order: 2 })
  autoSchedule(s, '2026-11-16', {
    ids: [a.id, b.id],
    force: true,
    busy: [[570, 600]],
  })
  assert.equal(s.tasks.find((t) => t.id === a.id).startMinute, 600)
  assert.equal(s.tasks.find((t) => t.id === b.id).startMinute, null)
  assert.equal(s.tasks.find((t) => t.id === b.id).plannedDate, '2026-11-16')
})
test('助手收集无日期进入池，过去明确日期保留，未请求不自动排小时', () => {
  const s = state(),
    m = {
      key: 'm',
      role: 'user',
      text: '我来整理笔记；我在 2026-10-01 看材料',
      source: 'dsh',
      at: '2026-10-01T00:00:00Z',
    }
  const changes = [
    { title: '整理笔记' },
    { title: '看材料', plannedDate: '2026-10-01' },
  ].map((patch) => ({
    patch,
    evidenceKeys: ['m'],
    scope: 'standalone',
    ownership: {
      kind: 'user_action',
      evidenceKey: 'm',
      quote:
        patch.title === '整理笔记' ? '我来整理笔记' : '我在 2026-10-01 看材料',
    },
  }))
  applyOrganization(
    s,
    structuredClone(s),
    { messages: [m], cursors: {}, errors: [] },
    { changes },
  )
  assert.equal(s.tasks.length, 2)
  assert.equal(s.tasks.find((t) => t.title === '整理笔记').plannedDate, null)
  assert.equal(s.tasks.find((t) => t.title === '整理笔记').plannedWeek, null)
  assert.equal(
    s.tasks.find((t) => t.title === '看材料').plannedDate,
    '2026-10-01',
  )
  assert.ok(s.tasks.every((t) => t.startMinute === null))
})
