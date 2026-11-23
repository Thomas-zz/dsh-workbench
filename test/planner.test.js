import { test, beforeEach } from 'node:test'

beforeEach((t) =>
  t.mock.timers.enable({
    apis: ['Date'],
    now: new Date('2026-11-12T04:00:00Z'),
  }),
)
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { Store } from '../src/store.js'
import { migrateState, applyOps, todayView } from '../src/ops.js'
import {
  calendarDate,
  weekOf,
  monthWeeks,
  dayTasks,
  settlePlan,
  autoSchedule,
  timelineTasks,
} from '../src/planner.js'
import {
  applyOrganization,
  runOrganizer,
  collectTaskMessages,
  organizerPrompt,
} from '../src/organizer.js'

const fixture = () =>
  migrateState({
    schemaVersion: 2,
    plan: { lastDate: '2026-11-12', config: { timezone: 'Asia/Shanghai' } },
    tasks: [],
  })
function add(state, patch) {
  const result = applyOps(state, [{ op: 'add_task', title: '待办', ...patch }])
  assert.deepEqual(result.errors, [])
  return state.tasks.find((t) => t.id === result.targets[0])
}

test('日期严格校验、时区与跨年周归属', () => {
  assert.equal(
    calendarDate(new Date('2026-11-11T17:00:00Z'), 'Asia/Shanghai'),
    '2026-11-12',
  )
  assert.equal(weekOf('2027-01-01'), '2026-12-28')
  assert.deepEqual(monthWeeks('2026-11-12'), [
    '2026-10-26',
    '2026-11-02',
    '2026-11-09',
    '2026-11-16',
    '2026-11-23',
    '2026-11-30',
  ])
})
test('旧日期迁移为计划，保留原值且不编硬截止；二次迁移幂等', () => {
  const migrated = migrateState({
    tasks: [{ id: 'a', title: '旧任务', due: '2030-11-13', status: 'todo' }],
  })
  assert.equal(migrated.tasks[0].plannedDate, '2030-11-13')
  assert.equal(migrated.tasks[0].due, null)
  assert.equal(migrated.tasks[0].legacyDue, '2030-11-13')
  assert.deepEqual(migrateState(migrated), migrated)
})
test('跨日不移动任务；之后完成仍在原日期原位置', () => {
  const s = fixture(),
    task = add(s, {
      plannedDate: '2026-11-12',
      startMinute: 600,
      estimateMinutes: 45,
    })
  const before = structuredClone(s.tasks)
  settlePlan(s, new Date('2026-11-13T01:00:00Z'))
  assert.deepEqual(s.tasks, before)
  task.status = 'done'
  task.completedAt = '2026-11-13T04:00:00Z'
  assert.equal(dayTasks(s, '2026-11-12')[0].status, 'done')
  assert.equal(dayTasks(s, '2026-11-12')[0].startMinute, 600)
  assert.equal(dayTasks(s, '2026-11-13').length, 0)
  assert.equal(settlePlan(s, new Date('2026-11-13T05:00:00Z')), false)
})

test('周末或离开多日都不改变过去、未来和暂停事项', () => {
  const s = fixture()
  s.plan.config.weekdaysOnly = true
  add(s, { plannedDate: '2026-11-13' })
  add(s, { plannedDate: '2026-11-20' })
  add(s, { plannedDate: '2026-11-12', status: 'paused' })
  const before = structuredClone(s.tasks)
  settlePlan(s, new Date('2026-11-16T01:00:00Z'))
  assert.deepEqual(s.tasks, before)
  assert.deepEqual(s.plan.days, {})
})

test('跨周不顺延周事项或旧目标，完成子项保持不变', () => {
  const s = fixture(),
    goal = add(s, { kind: 'goal', plannedWeek: '2026-11-09' })
  add(s, { parentId: goal.id, status: 'done', plannedDate: '2026-11-12' })
  add(s, { plannedWeek: '2026-11-09' })
  add(s, { kind: 'goal', plannedWeek: '2026-12-07' })
  const before = structuredClone(s.tasks)
  settlePlan(s, new Date('2026-11-16T01:00:00Z'))
  assert.deepEqual(s.tasks, before)
})

test('跨日移动与排序直接生效，允许时间重叠，不更改硬截止', () => {
  const s = fixture(),
    a = add(s, { title: 'a', plannedDate: '2026-11-12', due: '2026-11-14' }),
    b = add(s, { title: 'b', plannedDate: '2026-11-13', startMinute: 600 })
  applyOps(s, [
    {
      op: 'plan_move',
      id: a.id,
      date: '2026-11-13',
      beforeId: b.id,
      startMinute: 600,
    },
  ])
  const rows = dayTasks(s, '2026-11-13')
  assert.deepEqual(
    rows.map((t) => t.title),
    ['a', 'b'],
  )
  assert.equal(rows[0].due, '2026-11-14')
  assert.equal(rows[0].startMinute, rows[1].startMinute)
  assert.ok(rows[0].userFields.plannedDate)
})
test('自动排程跨午休，保留手动块，超容量留在未排时间', () => {
  const s = fixture()
  s.plan.config.slots = [
    [540, 600],
    [840, 900],
  ]
  const fixed = add(s, {
      title: '固定',
      plannedDate: '2026-11-12',
      startMinute: 540,
      estimateMinutes: 30,
    }),
    a = add(s, {
      title: 'a',
      plannedDate: '2026-11-12',
      estimateMinutes: 45,
      actor: 'organizer',
    }),
    b = add(s, {
      title: 'b',
      plannedDate: '2026-11-12',
      estimateMinutes: 90,
      actor: 'organizer',
    })
  autoSchedule(s, '2026-11-12', { ids: [a.id, b.id] })
  assert.equal(s.tasks.find((t) => t.id === fixed.id).startMinute, 540)
  assert.equal(s.tasks.find((t) => t.id === a.id).startMinute, 840)
  assert.equal(s.tasks.find((t) => t.id === b.id).startMinute, null)
})
test('非法字段回滚整条变更，学习对象不被无关操作替换', () => {
  const s = fixture(),
    task = add(s, { title: '保留' }),
    before = structuredClone(s.tasks)
  const r = applyOps(s, [
    { op: 'update_task', id: task.id, title: '不应该写入', priority: 9 },
  ])
  assert.equal(r.errors.length, 1)
  assert.deepEqual(s.tasks, before)
})
test('过去日期可以补记与直接编辑，不因跨日被冻结', () => {
  const s = fixture(),
    item = add(s, { plannedDate: '2026-11-12' })
  settlePlan(s, new Date('2026-11-13T01:00:00Z'))
  assert.deepEqual(
    applyOps(s, [{ op: 'update_task', id: item.id, title: '更正过去的事项' }])
      .errors,
    [],
  )
  assert.equal(dayTasks(s, '2026-11-12')[0].title, '更正过去的事项')
  add(s, { title: '补记事项', plannedDate: '2026-11-12' })
  assert.equal(dayTasks(s, '2026-11-12').length, 2)
})

test('新任务分别安排到不同日期，不被同批最后一天覆盖', () => {
  const s = fixture(),
    messages = [
      {
        key: 'm',
        role: 'user',
        source: 'dsh',
        text: '周五做a，下周一做b',
        at: '2026-11-12T02:00:00Z',
        sessionId: 'session-a',
      },
    ]
  applyOrganization(
    s,
    structuredClone(s),
    { messages, cursors: {}, errors: [] },
    {
      changes: [
        {
          evidenceKeys: ['m'],
          scope: 'standalone',
          ownership: {
            kind: 'user_action',
            evidenceKey: 'm',
            quote: '周五做a，下周一做b',
          },
          patch: { title: 'a', plannedDate: '2026-11-13' },
        },
        {
          evidenceKeys: ['m'],
          scope: 'standalone',
          ownership: {
            kind: 'user_action',
            evidenceKey: 'm',
            quote: '周五做a，下周一做b',
          },
          patch: { title: 'b', plannedDate: '2026-11-16' },
        },
      ],
    },
  )
  assert.equal(s.tasks.find((t) => t.title === 'a').plannedDate, '2026-11-13')
  assert.equal(s.tasks.find((t) => t.title === 'b').plannedDate, '2026-11-16')
})
test('后台整理尊重手动改期且补充进展，不把每轮变成重新洗牌', () => {
  const s = fixture(),
    task = add(s, { title: '实现拖动', plannedDate: '2026-11-13' }),
    base = structuredClone(s)
  applyOps(s, [
    { op: 'plan_move', id: task.id, date: '2026-11-16', startMinute: 600 },
  ])
  applyOrganization(
    s,
    base,
    {
      messages: [
        {
          key: 'm',
          source: 'dsh',
          text: '继续推进',
          at: '2026-11-12T01:00:00Z',
        },
      ],
      cursors: {},
      errors: [],
    },
    {
      changes: [
        {
          id: task.id,
          evidenceKeys: ['m'],
          patch: { plannedDate: '2026-11-12', progress: '开始实现' },
        },
      ],
    },
  )
  assert.equal(s.tasks[0].plannedDate, '2026-11-16')
  assert.equal(s.tasks[0].startMinute, 600)
  assert.equal(s.tasks[0].progress.at(-1).note, '开始实现')
})
test('定时读取增量、失败来源不推进游标、相对日期携带原消息时间', async () => {
  const s = fixture()
  s.plan.config.sources = { dsh: true, codex: true }
  const scan = {
    dsh: async () => [
      {
        source: 'dsh',
        sessionId: 'a',
        at: '2026-11-11T15:00:00Z',
        text: '明天交方案',
      },
    ],
    codex: async () => {
      throw Error('源暂不可用')
    },
  }
  const collected = await collectTaskMessages(s, {
    scan,
    now: new Date('2026-11-12T02:00:00Z'),
  })
  assert.equal(collected.errors.length, 1)
  assert.equal(collected.cursors.codex, undefined)
  assert.match(organizerPrompt(s, collected), /"atLocalDate":"2026-11-11"/)
  s.plan.organizer.processed = collected.messages.map((m) => m.key)
  assert.equal(
    (
      await collectTaskMessages(s, {
        scan,
        now: new Date('2026-11-12T03:00:00Z'),
      })
    ).messages.length,
    0,
  )
})
test('宿主忙碌时整理延期，不访问执行会话；无新内容不调用模型', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'wb-organizer-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const store = new Store(dir)
  let calls = 0
  const deps = {
    collect: async () => ({ messages: [], cursors: {}, errors: [] }),
    generate: async () => {
      calls++
      throw Error('不应调用')
    },
  }
  assert.equal(
    (
      await runOrganizer(
        { get: () => ({ list: () => [{ status: 'running' }] }) },
        store,
        deps,
      )
    ).status,
    'deferred',
  )
  assert.equal(
    (await runOrganizer({ get: () => ({ list: () => [] }) }, store, deps))
      .status,
    'completed',
  )
  assert.equal(calls, 0)
})
test('整理失败保留游标，重试可重新收集；同轮重入不会并发调用', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'wb-organizer-fail-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const store = new Store(dir)
  const result = await runOrganizer({}, store, {
    collect: async () => ({
      messages: [{ key: 'm' }],
      cursors: { dsh: '2026-11-12T02:00:00Z' },
      errors: [],
    }),
    generate: async () => {
      throw Error('模型暂不可用')
    },
  })
  assert.equal(result.status, 'error')
  assert.deepEqual((await store.read()).plan.organizer.cursors, {})
  let release
  const gate = new Promise((r) => {
    release = r
  })
  const running = runOrganizer({}, store, {
    collect: async () => {
      await gate
      return { messages: [], cursors: {}, errors: [] }
    },
  })
  assert.equal((await runOrganizer({}, store)).status, 'running')
  release()
  await running
})
test('迁移前备份、跨进程并发写入无丢失、撤销保留无关后台任务', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'wb-concurrent-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await writeFile(
    join(dir, 'state.json'),
    JSON.stringify({
      schemaVersion: 1,
      tasks: [{ id: 'old', title: '旧任务', status: 'todo' }],
    }),
  )
  const store = new Store(dir)
  await store.read()
  assert.equal(
    JSON.parse(
      await readFile(join(dir, 'state.before-calendar-v2.json'), 'utf8'),
    ).schemaVersion,
    1,
  )
  const source = new URL('../src/store.js', import.meta.url).href
  const jobs = Array.from(
    { length: 6 },
    (_, i) =>
      new Promise((resolve, reject) => {
        const p = spawn(
          process.execPath,
          [
            '--input-type=module',
            '-e',
            `import {Store} from ${JSON.stringify(source)}; const s=new Store(${JSON.stringify(dir)}); await s.mutate('write',d=>{d.tasks.push({id:'c${i}',title:'并发${i}',status:'todo'});});`,
          ],
          { stdio: ['ignore', 'ignore', 'pipe'] },
        )
        let error = ''
        p.stderr.on('data', (d) => (error += d))
        p.on('exit', (code) => (code ? reject(Error(error)) : resolve()))
      }),
  )
  await Promise.all(jobs)
  assert.equal((await store.read()).tasks.length, 7)
  await store.mutate('改标题', (d) => {
    d.tasks.find((t) => t.id === 'old').title = '改名'
  })
  await new Store(dir).mutate(
    '后台记录',
    (d) => {
      d.plan.organizer.lastSummary = '刚整理完成'
    },
    { undoable: false },
  )
  await store.undoLast()
  const result = await store.read()
  assert.equal(result.tasks.find((t) => t.id === 'old').title, '旧任务')
  assert.equal(result.plan.organizer.lastSummary, '刚整理完成')
})

test('旧版历史快照没有创建时间时同序任务仍可排序，更正非法状态原子拒绝', () => {
  const s = fixture()
  s.plan.days['2026-11-10'] = {
    closed: true,
    items: [
      { id: 'b', title: 'B', order: 0, status: 'todo' },
      { id: 'a', title: 'A', order: 0, status: 'todo' },
    ],
  }
  assert.deepEqual(
    dayTasks(s, '2026-11-10').map((t) => t.id),
    ['a', 'b'],
  )
  const r = applyOps(s, [
    {
      op: 'plan_record',
      date: '2026-11-10',
      id: 'a',
      patch: { title: '不写入', status: 'invalid' },
    },
  ])
  assert.equal(r.errors.length, 1)
  assert.equal(dayTasks(s, '2026-11-10')[0].title, 'A')
})
test('新的用户明确改期可覆盖早先手工日期，但并发修改仍优先', () => {
  const s = fixture(),
    task = add(s, { title: '改期测试', plannedDate: '2026-11-13' })
  s.tasks[0].userFields.plannedDate = '2026-11-11T01:00:00Z'
  const base = structuredClone(s),
    collected = {
      messages: [
        {
          key: 'm',
          role: 'user',
          source: 'dsh',
          text: '改期测试移到下周一',
          at: '2026-11-12T01:00:00Z',
        },
      ],
      cursors: {},
      errors: [],
    }
  const result = {
    changes: [
      {
        id: task.id,
        evidenceKeys: ['m'],
        explicitFields: ['plannedDate'],
        patch: { plannedDate: '2026-11-16' },
      },
    ],
  }
  applyOrganization(s, base, collected, result)
  assert.equal(s.tasks[0].plannedDate, '2026-11-16')
  applyOps(s, [{ op: 'plan_move', id: task.id, date: '2026-11-17' }])
  applyOrganization(s, base, collected, result)
  assert.equal(s.tasks[0].plannedDate, '2026-11-17')
})
test('扫描时间回看补齐晚写消息，重复证据不反复消费', async () => {
  const s = fixture()
  s.plan.config.sources = { dsh: true }
  s.plan.organizer.cursors.dsh = '2026-11-12T03:00:00Z'
  const row = {
    source: 'dsh',
    sessionId: 'a',
    at: '2026-11-12T02:59:00Z',
    text: '晚落盘的事项',
  }
  let since
  const scan = {
    dsh: async (options) => {
      since = options.sinceMs
      return [row]
    },
  }
  const first = await collectTaskMessages(s, {
    scan,
    now: new Date('2026-11-12T03:01:00Z'),
  })
  assert.equal(first.messages.length, 1)
  assert.equal(since, Date.parse('2026-11-12T02:55:00Z'))
  s.plan.organizer.processed = first.messages.map((m) => m.key)
  assert.equal((await collectTaskMessages(s, { scan })).messages.length, 0)
})

test('跨周不生成新的冻结记录，旧存档原样保留', () => {
  const s = fixture(),
    goal = add(s, { kind: 'goal', plannedWeek: '2026-11-09' })
  const child = add(s, { parentId: goal.id, plannedDate: '2026-11-15' })
  s.plan.weeks['2026-11-02'] = {
    closed: true,
    items: [],
    children: [{ id: 'old', status: 'done' }],
  }
  const old = structuredClone(s.plan.weeks)
  settlePlan(s, new Date('2026-11-16T01:00:00Z'))
  assert.deepEqual(s.plan.weeks, old)
  assert.equal(child.plannedDate, '2026-11-15')
})

test('跨日后用户操作失败不会顺延，结算日期仍持久化', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wb-rollover-fail-'))
  try {
    const s = fixture()
    const task = add(s, { plannedDate: '2026-11-11' })
    s.plan.lastDate = '2026-11-11'
    s.plan.days = {}
    await writeFile(join(root, 'state.json'), JSON.stringify(s))
    const store = new Store(root)
    await assert.rejects(
      store.mutate('失败的用户操作', () => {
        throw new Error('拒绝样例')
      }),
      /拒绝样例/,
    )
    const persisted = JSON.parse(
      await readFile(join(root, 'state.json'), 'utf8'),
    )
    assert.equal(persisted.plan.lastDate, calendarDate())
    assert.equal(persisted.plan.days['2026-11-11'], undefined)
    assert.equal(
      persisted.tasks.find((t) => t.id === task.id).plannedDate,
      '2026-11-11',
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('跨日不因容量、优先级或截止日给任务另找日期', () => {
  const s = fixture()
  s.plan.config.slots = [[540, 780]]
  s.plan.config.dailyCapacityMinutes = 180
  add(s, { plannedDate: '2026-11-13', startMinute: 540, estimateMinutes: 60 })
  add(s, { plannedDate: '2026-11-12', estimateMinutes: 120 })
  add(s, { plannedDate: '2026-11-12', due: '2026-11-13', estimateMinutes: 60 })
  const before = structuredClone(s.tasks)
  settlePlan(s, new Date('2026-11-13T01:00:00Z'))
  assert.deepEqual(s.tasks, before)
})

test('过期日程与行动保留原定日期、时间和时长', () => {
  const s = fixture()
  for (const kind of ['event', 'action'])
    add(s, {
      kind,
      plannedDate: '2026-11-12',
      startMinute: 540,
      due: '2026-11-13',
      estimateMinutes: 120,
    })
  const before = structuredClone(s.tasks)
  settlePlan(s, new Date('2026-11-13T03:00:00Z'))
  assert.deepEqual(s.tasks, before)
})

test('超大任务不无限搜索、不自动拆分，等待事项不占时间', () => {
  const s = fixture()
  const large = add(s, { plannedDate: '2026-11-12', estimateMinutes: 600 })
  const blocked = add(s, { plannedDate: '2026-11-12', status: 'blocked' })
  settlePlan(s, new Date('2026-11-13T01:00:00Z'))
  assert.equal(s.tasks.length, 2)
  assert.equal(s.tasks.find((t) => t.id === large.id).startMinute, null)
  assert.equal(s.tasks.find((t) => t.id === large.id).plannedDate, '2026-11-12')
  assert.equal(s.tasks.find((t) => t.id === blocked.id).startMinute, null)
})

test('跨多日不伪造中间日工作，周末设置不触发顺延', () => {
  const s = fixture()
  s.plan.config.weekdaysOnly = true
  add(s, { plannedDate: '2026-11-12', estimateMinutes: 60 })
  settlePlan(s, new Date('2026-11-15T01:00:00Z'))
  assert.equal(s.tasks[0].plannedDate, '2026-11-12')
  assert.equal(dayTasks(s, '2026-11-13').length, 0)
  assert.equal(dayTasks(s, '2026-11-14').length, 0)
})

test('历史已完成保留原时间，无排期的完成事项使用本地完成时刻标记', () => {
  const tasks = [
    {
      id: 'a',
      title: '已安排',
      status: 'done',
      startMinute: 600,
      completedAt: '2026-11-12T03:00:00Z',
    },
    {
      id: 'b',
      title: '直接完成',
      status: 'done',
      startMinute: null,
      completedAt: '2026-11-11T17:20:00Z',
    },
    { id: 'c', title: '无时间', status: 'done' },
    {
      id: 'd',
      title: '顺延',
      status: 'todo',
      startMinute: 700,
      movedTo: '2026-11-13',
    },
  ]
  const before = structuredClone(tasks)
  const rows = timelineTasks(tasks, '2026-11-12', 'Asia/Shanghai')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].startMinute, 600)
  assert.equal(rows[1].startMinute, 80)
  assert.equal(rows[1].completionMarker, true)
  assert.deepEqual(tasks, before)
  assert.equal(
    timelineTasks([tasks[1]], '2026-11-11', 'Asia/Shanghai').length,
    0,
  )
})

test('完成后仍可在原日时间轴展示，显式重新打开原位生效', () => {
  const s = fixture()
  const t = add(s, {
    plannedDate: '2026-11-12',
    startMinute: 600,
    status: 'done',
  })
  settlePlan(s, new Date('2026-11-13T01:00:00Z'))
  s.tasks.find((r) => r.id === t.id).status = 'todo'
  const rows = timelineTasks(
    dayTasks(s, '2026-11-12'),
    '2026-11-12',
    'Asia/Shanghai',
  )
  assert.equal(rows[0].status, 'todo')
  assert.equal(rows[0].startMinute, 600)
})

test('旧版本的顺延记录保留，升级不补排也不猜测还原日期', () => {
  const s = fixture()
  s.plan.lastDate = '2026-11-13'
  const legacy = add(s, {
    plannedDate: '2026-11-13',
    estimateMinutes: 60,
    carriedFrom: '2026-11-12',
  })
  const manual = add(s, {
    plannedDate: '2026-11-13',
    estimateMinutes: 30,
    carriedFrom: '2026-11-12',
  })
  s.tasks.find((t) => t.id === manual.id).userFields.plannedDate =
    '2026-11-13T00:00:00Z'
  s.plan.days['2026-11-12'] = {
    closed: true,
    items: [{ id: legacy.id, status: 'todo', movedTo: '2026-11-13' }],
  }
  delete s.plan.rolloverVersion // Simulate persisted data from the previous version.
  assert.equal(settlePlan(s, new Date('2026-11-13T01:00:00Z')), true)
  assert.equal(s.tasks.find((t) => t.id === legacy.id).startMinute, null)
  assert.equal(s.tasks.find((t) => t.id === manual.id).startMinute, null)
  assert.equal(settlePlan(s, new Date('2026-11-13T02:00:00Z')), false)
})
