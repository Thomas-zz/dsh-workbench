import { organizationContext } from './helpers/organization-context.js'
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrateState, applyOps } from '../src/ops.js'
import { autoSchedule } from '../src/planner.js'
import {
  collectTaskMessages,
  organizerPrompt,
  organizerDue,
  runOrganizer,
} from '../src/organizer.js'
import { Store } from '../src/store.js'
beforeEach((t) =>
  t.mock.timers.enable({
    apis: ['Date'],
    now: new Date('2026-11-12T04:00:00Z'),
  }),
)
const model = { provider: 'fixture', model: 'test-model' }
const state = () =>
  migrateState({
    schemaVersion: 2,
    plan: {
      lastDate: '2026-11-12',
      config: {
        sources: { dsh: false, codex: false, claude: false, zcode: false },
      },
    },
  })
function op(s, ...ops) {
  const r = applyOps(s, ops)
  assert.deepEqual(r.errors, [])
  return r.targets[0]
}
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'wb-assistant-'))
  t.after(async () => {
    await new Promise((resolve) => setImmediate(resolve))
    await store.queue.catch(() => {})
    await rm(dir, { recursive: true, force: true })
  })
  const store = new Store(dir)
  await store.mutate('fixture', (s) => Object.assign(s, state()), {
    undoable: false,
  })
  return store
}
const fake = (build) => organizationContext(build, model)

test('旧学习模型迁移到统一配置，任一入口更新、清空及失败都保持一致', () => {
  const s = migrateState({
    learn: { config: { organizeModel: model } },
    plan: { config: { model: { provider: 'old', model: 'old' } } },
  })
  assert.deepEqual(s.assistant.model, model)
  op(s, { op: 'assistant_config', model: { provider: 'next', model: 'next' } })
  assert.deepEqual(s.learn.config.organizeModel, s.plan.config.model)
  op(s, { op: 'learn_config', patch: { organizeModel: model } })
  assert.deepEqual(s.assistant.model, model)
  const invalid = applyOps(s, [
    { op: 'learn_config', patch: { organizeModel: { model: 'invalid' } } },
  ])
  assert.equal(invalid.errors.length, 1)
  assert.deepEqual(s.assistant.model, model)
  op(s, { op: 'plan_config', patch: { model: null } })
  const reloaded = migrateState(JSON.parse(JSON.stringify(s)))
  assert.equal(reloaded.assistant.model, null)
  assert.equal(reloaded.learn.config.organizeModel, null)
  assert.equal(reloaded.plan.config.model, null)
})

test('长随手记完整保存，重试保持原始相对日期且可重新收集', async () => {
  const s = state(),
    text = '明天提醒我整理笔记。' + '内容'.repeat(150)
  op(s, { op: 'capture_idea', text })
  assert.equal(s.ideas[0].text, text)
  s.ideas[0].createdAt = '2026-11-11T02:00:00Z'
  s.ideas[0].updatedAt = '2026-11-11T02:00:00Z'
  let c = await collectTaskMessages(s)
  assert.match(organizerPrompt(s, c), /"atLocalDate":"2026-11-11"/)
  s.plan.organizer.processed = c.messages.map((m) => m.key)
  s.ideas[0].status = 'organized'
  s.ideas[0].updatedAt = '2026-11-11T02:00:00Z'
  op(s, { op: 'retry_note', id: s.ideas[0].id })
  c = await collectTaskMessages(s)
  assert.equal(c.messages.length, 1)
  assert.equal(c.messages[0].at, '2026-11-11T02:00:00Z')
})

test('随手记保留完整目标，拒绝模型自创阶段，归属与日志落盘且不重复', async (t) => {
  const store = await fixture(t)
  await store.mutate('记下', (s) =>
    op(s, { op: 'capture_idea', text: '我要学习 super-agent 架构' }),
  )
  const ctx = fake((ms) => ({
    summary: '记录完整学习目标',
    changes: [
      {
        clientKey: 'goal',
        evidenceKeys: [ms[0].key],
        scope: 'standalone',
        ownership: {
          kind: 'user_action',
          evidenceKey: ms[0].key,
          quote: ms[0].text,
        },
        patch: {
          title: '学习 super-agent 架构',
          kind: 'goal',
          plannedWeek: '2026-11-09',
        },
      },
      {
        evidenceKeys: [ms[0].key],
        scope: 'standalone',
        ownership: {
          kind: 'user_action',
          evidenceKey: ms[0].key,
          quote: ms[0].text,
        },
        patch: { title: '自创阶段', parentId: 'goal' },
      },
    ],
  }))
  const r = await runOrganizer(ctx, store, { trigger: 'manual' })
  assert.equal(r.added, 1)
  const s = await new Store(store.root).read()
  assert.equal(s.tasks.length, 1)
  assert.equal(s.tasks[0].ownership.kind, 'user_action')
  assert.equal(s.tasks[0].parentId, null)
  assert.equal(s.ideas[0].taskIds.length, 1)
  assert.deepEqual(s.plan.organizer.runs[0].model, model)
  assert.equal(s.plan.organizer.runs[0].tasks.length, 1)
  await runOrganizer(ctx, store, { trigger: 'manual' })
  assert.equal((await store.read()).tasks.length, 1)
})

test('模型失败保留公共随手记和待处理游标，日志记录失败', async (t) => {
  const store = await fixture(t)
  await store.mutate('记下', (s) =>
    op(s, { op: 'capture_idea', text: '明天整理说明' }),
  )
  const result = await runOrganizer({}, store, {
    trigger: 'manual',
    generate: async () => {
      throw Error('测试失败')
    },
  })
  assert.equal(result.status, 'error')
  const s = await store.read()
  assert.equal(s.ideas[0].status, 'parked')
  assert.deepEqual(s.plan.organizer.processed, [])
  assert.match(s.plan.organizer.runs[0].error, /测试失败/)
})

test('超量安排压缩当日分配但保留预估、手动时间块和刷新后的分配', () => {
  const s = state()
  s.plan.config.slots = [
    [540, 600],
    [660, 720],
  ]
  op(s, {
    op: 'add_task',
    title: '手工会议',
    plannedDate: '2026-11-12',
    startMinute: 540,
    estimateMinutes: 30,
  })
  const ids = [1, 2, 3].map((i) =>
    op(s, {
      op: 'add_task',
      title: '行动' + i,
      plannedDate: '2026-11-12',
      estimateMinutes: 120,
    }),
  )
  autoSchedule(s, '2026-11-12', { ids, force: true, fit: true })
  const reloaded = migrateState(JSON.parse(JSON.stringify(s)))
  for (const task of reloaded.tasks.filter((t) => ids.includes(t.id))) {
    assert.equal(task.estimateMinutes, 120)
    assert.equal(task.scheduledMinutes, 30)
    assert.ok(
      task.startMinute >= 570 &&
        task.startMinute + task.scheduledMinutes <= 720,
    )
  }
  assert.equal(
    reloaded.tasks.find((t) => t.title === '手工会议').startMinute,
    540,
  )
})

test('主动排期只安排指定当天，日志包括确定性分配，模型生成多余任务被忽略', async (t) => {
  const store = await fixture(t)
  await store.mutate('输入', (s) => {
    op(s, {
      op: 'add_task',
      title: '排期行动',
      plannedDate: '2026-11-12',
      estimateMinutes: 30,
    })
    op(s, { op: 'add_task', title: '明日行动', plannedDate: '2026-11-13' })
  })
  const result = await runOrganizer(
    fake((ms) => ({
      changes: [{ evidenceKeys: [ms[0].key], patch: { title: '不允许新增' } }],
    })),
    store,
    { trigger: 'manual', mode: 'schedule', date: '2026-11-12' },
  )
  assert.equal(result.updated, 1)
  const s = await store.read()
  assert.equal(s.tasks.length, 2)
  assert.equal(s.tasks.find((t) => t.title === '明日行动').startMinute, null)
  assert.ok(s.plan.organizer.runs[0].tasks[0].scheduledMinutes)
})

test('模型思考时用户已挪动行动，回来后不能覆盖用户安排', async (t) => {
  const store = await fixture(t)
  const id = await store.mutate('输入', (s) =>
    op(s, { op: 'add_task', title: '行动', plannedDate: '2026-11-12' }),
  )
  await runOrganizer({}, store, {
    trigger: 'manual',
    mode: 'schedule',
    date: '2026-11-12',
    generate: async () => {
      await store.mutate('移动', (s) =>
        op(s, {
          op: 'update_task',
          id,
          plannedDate: '2026-11-13',
          startMinute: 900,
        }),
      )
      return { changes: [] }
    },
  })
  const task = (await store.read()).tasks[0]
  assert.equal(task.plannedDate, '2026-11-13')
  assert.equal(task.startMinute, 900)
})

test('关闭拆分：不调用模型，不变更原任务', async (t) => {
  const store = await fixture(t)
  const id = await store.mutate('输入', (s) =>
    op(s, { op: 'add_task', title: '学习主题' }),
  )
  const before = structuredClone(await store.read())
  await assert.rejects(
    runOrganizer({}, store, {
      mode: 'decompose',
      goalId: id,
      trigger: 'manual',
      generate: () => assert.fail('不能调用模型'),
    }),
    /自动拆分已关闭/,
  )
  assert.deepEqual(await store.read(), before)
})

test('晚间整理按配置时区每天一次，失败退避，主动执行不占用其他 Agent', async (t) => {
  const s = state()
  assert.equal(organizerDue(s, new Date('2026-11-12T13:59:00Z')), false)
  assert.equal(organizerDue(s, new Date('2026-11-12T14:00:00Z')), true)
  s.plan.organizer.lastNightlyDate = '2026-11-12'
  assert.equal(organizerDue(s, new Date('2026-11-12T15:00:00Z')), false)
  s.plan.organizer.lastNightlyDate = ''
  s.plan.organizer.lastAttemptAt = '2026-11-12T14:00:00Z'
  assert.equal(organizerDue(s, new Date('2026-11-12T14:01:00Z')), false)
  const store = await fixture(t),
    ctx = { get: () => ({ list: () => [{ status: 'running' }] }) }
  assert.equal((await runOrganizer(ctx, store)).status, 'deferred')
  assert.equal(
    (
      await runOrganizer(ctx, store, {
        trigger: 'manual',
        generate: async () => ({ changes: [] }),
      })
    ).status,
    'completed',
  )
})

test('进程中断后的过期整理可恢复，读取状态时解除旧租约并标记记录', async (t) => {
  const store = await fixture(t)
  await store.mutate('旧运行', (s) => {
    s.plan.organizer.lease = { id: 'stale', at: Date.now() - 6 * 60000 }
    s.plan.organizer.runs = [{ id: 'stale', status: 'running' }]
  })
  const s = await store.read()
  assert.equal(s.plan.organizer.lease, undefined)
  assert.equal(s.plan.organizer.runs[0].status, 'error')
  assert.equal(
    (
      await runOrganizer(
        fake(() => ({ changes: [] })),
        store,
        { trigger: 'manual' },
      )
    ).status,
    'completed',
  )
})

test('默认估时只补个人行动空值，不修改日期、归属、手动估时或创建任务', async (t) => {
  const store = await fixture(t)
  let a, b, c
  await store.mutate('准备', (s) => {
    a = op(s, { op: 'add_task', title: '待安排验证', estimateMinutes: null })
    b = op(s, { op: 'add_task', title: '手动预估', estimateMinutes: 90 })
    c = op(s, {
      op: 'add_task',
      title: '旧 agent 项',
      origin: { kind: 'auto' },
    })
  })
  const ctx = fake((ms, prompt) => {
    assert.match(prompt, /本轮方式：estimate/)
    const tasks = JSON.parse(
      prompt.split('\n已有事项：')[1].split('\n材料：')[0],
    )
    assert.deepEqual(
      tasks.map((t) => t.id),
      [a],
    )
    return {
      changes: [
        {
          id: a,
          evidenceKeys: [ms[0].key],
          scope: 'standalone',
          ownership: {
            kind: 'user_confirmation',
            evidenceKey: ms[0].key,
            quote: ms[0].text,
          },
          patch: {
            estimateMinutes: 45,
            title: '模型改名',
            plannedDate: '2026-11-13',
            status: 'done',
            parentId: b,
          },
        },
        { id: b, evidenceKeys: [ms[0].key], patch: { estimateMinutes: 10 } },
        { id: c, evidenceKeys: [ms[0].key], patch: { estimateMinutes: 10 } },
        {
          evidenceKeys: [ms[0].key],
          patch: { title: '不能新增', estimateMinutes: 10 },
        },
      ],
    }
  })
  const result = await runOrganizer(ctx, store, {
    mode: 'estimate',
    trigger: 'manual',
  })
  assert.equal(result.status, 'completed')
  const state = await new Store(store.root).read()
  const task = state.tasks.find((t) => t.id === a)
  assert.equal(state.tasks.length, 3)
  assert.equal(task.title, '待安排验证')
  assert.equal(task.estimateMinutes, 45)
  assert.equal(task.plannedDate, null)
  assert.equal(task.startMinute, null)
  assert.equal(task.status, 'todo')
  assert.equal(task.parentId, null)
  assert.equal(task.ownership, null)
  assert.equal(state.tasks.find((t) => t.id === b).estimateMinutes, 90)
  assert.equal(state.tasks.find((t) => t.id === c).estimateMinutes, null)
})

test('估时期间拖到另一日仍可补估时，期间手动改估时以用户为准', async (t) => {
  const store = await fixture(t)
  let a, b
  await store.mutate('准备', (s) => {
    a = op(s, { op: 'add_task', title: '拖动事项' })
    b = op(s, { op: 'add_task', title: '手动事项' })
  })
  await runOrganizer({}, store, {
    mode: 'estimate',
    trigger: 'manual',
    generate: async (ctx, base, collected) => {
      await store.mutate('同时调整', (s) => {
        op(s, { op: 'plan_move', id: a, date: '2026-11-14', startMinute: 600 })
        op(s, { op: 'update_task', id: b, estimateMinutes: 75 })
      })
      return {
        changes: [a, b].map((id) => ({
          id,
          evidenceKeys: [collected.messages[0].key],
          patch: { estimateMinutes: 45 },
        })),
      }
    },
  })
  const state = await store.read(),
    task = state.tasks.find((t) => t.id === a)
  assert.equal(task.estimateMinutes, 45)
  assert.equal(task.plannedDate, '2026-11-14')
  assert.equal(task.startMinute, 600)
  assert.equal(state.tasks.find((t) => t.id === b).estimateMinutes, 75)
})

test('无缺失估时时不调用模型，失败保留原值与排期', async (t) => {
  const store = await fixture(t)
  let calls = 0
  await runOrganizer({}, store, {
    mode: 'estimate',
    trigger: 'manual',
    generate: () => {
      calls++
      throw Error('不应调用')
    },
  })
  assert.equal(calls, 0)
  const id = await store.mutate('准备', (s) =>
    op(s, { op: 'add_task', title: '验证模型失败' }),
  )
  const result = await runOrganizer({}, store, {
    mode: 'estimate',
    trigger: 'manual',
    generate: () => {
      throw Error('模型不可用')
    },
  })
  assert.equal(result.status, 'error')
  const state = await store.read()
  assert.equal(state.tasks.find((t) => t.id === id).estimateMinutes, null)
  assert.equal(state.tasks.find((t) => t.id === id).plannedDate, null)
})
