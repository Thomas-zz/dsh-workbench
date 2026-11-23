import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrateState, applyOps, countsOf } from '../src/ops.js'
import {
  settlePlan,
  autoSchedule,
  dayTasks,
  timelineTasks,
} from '../src/planner.js'
import { weekWork } from '../src/projects.js'
import { Store } from '../src/store.js'
import {
  saveMailSettings,
  mailSettings,
  applyMailItems,
  runMail,
  generateMailItems,
} from '../src/mail.js'

beforeEach((t) =>
  t.mock.timers.enable({
    apis: ['Date'],
    now: new Date('2026-11-13T01:00:00Z'),
  }),
)
const fixture = () =>
  migrateState({
    schemaVersion: 2,
    tasks: [],
    plan: { lastDate: '2026-11-13', config: { timezone: 'Asia/Shanghai' } },
  })
function add(state, fields) {
  const r = applyOps(state, [{ op: 'add_task', title: '事项', ...fields }])
  assert.deepEqual(r.errors, [])
  return state.tasks.find((t) => t.id === r.targets[0])
}

test('创建关联项目保留原任务及排期，重复操作不重复创建', () => {
  const s = fixture(),
    t = add(s, {
      title: '整理评审材料',
      plannedDate: '2026-11-13',
      note: '材料链接',
      startMinute: 600,
      estimateMinutes: 45,
      due: '2026-11-20',
    })
  assert.deepEqual(
    applyOps(s, [{ op: 'convert_task', id: t.id, kind: 'project' }]).errors,
    [],
  )
  const linked = s.tasks.find((r) => r.id === t.id)
  const p = s.tasks.find((r) => r.id === linked.parentId)
  for (const key of [
    'id',
    'kind',
    'status',
    'plannedDate',
    'startMinute',
    'estimateMinutes',
    'note',
    'due',
  ])
    assert.deepEqual(linked[key], t[key], key)
  assert.notEqual(p.id, t.id)
  assert.equal(p.kind, 'project')
  applyOps(s, [{ op: 'convert_task', id: t.id, kind: 'project' }])
  assert.equal(s.tasks.filter((t) => t.kind === 'project').length, 1)
  assert.equal(p.plannedDate, null)
  assert.equal(linked.note, '材料链接')
  add(s, { title: '准备案例', parentId: p.id, plannedDate: '2026-11-13' })
  assert.deepEqual(applyOps(s, [{ op: 'deadline_event', id: p.id }]).errors, [])
  assert.deepEqual(applyOps(s, [{ op: 'deadline_event', id: p.id }]).errors, [])
  assert.equal(s.tasks.filter((t) => t.kind === 'event').length, 1)
  assert.equal(s.tasks.find((t) => t.kind === 'event').parentId, p.id)
  assert.equal(countsOf(s).todo, 2)
  settlePlan(s, new Date('2026-11-23T01:00:00Z'))
  assert.equal(s.tasks.find((t) => t.id === p.id).plannedDate, null)
  assert.equal(
    s.tasks.find((t) => t.kind === 'event').plannedDate,
    '2026-11-20',
  )
  assert.ok(dayTasks(s, '2026-11-20').some((t) => t.kind === 'event'))
  assert.ok(
    applyOps(s, [{ op: 'convert_task', id: p.id, kind: 'action' }]).errors
      .length,
  )
  assert.ok(applyOps(s, [{ op: 'delete_task', id: p.id }]).errors.length)
})

test('日程占固定时段，不被自动排期或跨日移动，拒绝无日期日程', () => {
  const s = fixture(),
    event = add(s, {
      kind: 'event',
      title: '面试',
      plannedDate: '2026-11-13',
      startMinute: 540,
      estimateMinutes: 60,
    })
  const action = add(s, {
    title: '写案例',
    plannedDate: '2026-11-13',
    estimateMinutes: 30,
  })
  autoSchedule(s, '2026-11-13', { force: true })
  assert.equal(s.tasks.find((t) => t.id === event.id).startMinute, 540)
  assert.equal(s.tasks.find((t) => t.id === action.id).startMinute, 600)
  assert.ok(
    applyOps(s, [{ op: 'plan_move', id: event.id, date: null }]).errors.length,
  )
  assert.ok(
    applyOps(s, [{ op: 'add_task', title: '无日期事件', kind: 'event' }]).errors
      .length,
  )
  settlePlan(s, new Date('2026-11-14T01:00:00Z'))
  assert.equal(s.tasks.find((t) => t.id === event.id).plannedDate, '2026-11-13')
})

test('本周按安排日期汇总，显式重新打开生效，不混入下周或待安排', () => {
  const s = fixture(),
    p = add(s, { title: '长期项目', kind: 'project' })
  add(s, { title: '本周节点', parentId: p.id, plannedDate: '2026-11-14' })
  add(s, { title: '下周节点', parentId: p.id, plannedDate: '2026-11-18' })
  add(s, { title: '待安排节点', parentId: p.id, plannedDate: null })
  add(s, { title: '独立行动', plannedDate: '2026-11-13' })
  const done = add(s, {
    title: '已完成节点',
    parentId: p.id,
    plannedDate: '2026-11-13',
    status: 'done',
  })
  settlePlan(s, new Date('2026-11-14T01:00:00Z'))
  s.tasks.find((t) => t.id === done.id).status = 'todo'
  const work = weekWork(s, '2026-11-13')
  assert.equal(work.groups.length, 1)
  assert.deepEqual(
    work.groups[0].tasks.map((t) => t.title).sort(),
    ['已完成节点', '本周节点'].sort(),
  )
  assert.equal(
    work.groups[0].tasks.find((t) => t.id === done.id).status,
    'todo',
  )
  assert.equal(work.independent.length, 1)
})

const batch = {
  key: 'account-validity',
  cursor: 5,
  skipped: [],
  messages: [
    {
      key: 'm5',
      subject: '评审材料提交',
      from: 'hr@example.com',
      messageId: '<m5>',
      at: '2026-11-13T00:00:00Z',
      text: '请你在11月20日前提交评审材料，并确认个人案例。',
    },
  ],
}
const items = [
  {
    messageKey: 'm5',
    responsibility: 'me',
    kind: 'action',
    title: '确认个人案例',
    quote: '并确认个人案例',
    reason: 'HR 要求本人确认案例',
    estimateMinutes: 45,
  },
  {
    messageKey: 'm5',
    responsibility: 'me',
    kind: 'event',
    title: '评审材料提交截止',
    quote: '请你在11月20日前提交评审材料',
    reason: '个人材料提交截止',
    plannedDate: '2026-11-20',
  },
]

test('邮件只收本人有原文证据的事项，日程独立、去重、失败证据不入待办', () => {
  const s = fixture()
  const result = applyMailItems(s, batch, {
    items: [
      ...items,
      { ...items[0], title: '代理自己测试', responsibility: 'other' },
      { ...items[0], title: '捏造', quote: '不存在的原文' },
    ],
  })
  assert.equal(result.created, 2)
  assert.equal(result.rejected, 2)
  assert.equal(s.tasks.find((t) => t.kind === 'action').plannedDate, null)
  assert.equal(
    s.tasks.find((t) => t.kind === 'event').plannedDate,
    '2026-11-20',
  )
  assert.equal(s.tasks[0].origin.kind, 'mail')
  assert.equal(countsOf(s).todo, 1)
  assert.equal(applyMailItems(s, batch, { items }).created, 0)
  assert.equal(s.mail.cursors[batch.key], 5)
})

const account = {
  host: 'imap.example.com',
  port: 993,
  user: 'me@example.com',
  address: 'me@example.com',
  password: 'test-only-secret',
  folder: 'INBOX',
}
async function withStore(fn) {
  const root = await mkdtemp(join(tmpdir(), 'wb-mail-test-'))
  try {
    await fn(new Store(root), root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('邮箱授权码不进 state/接口响应，凭据权限600，换账号要求重新授权', async () =>
  withStore(async (store, root) => {
    const r = await saveMailSettings(store, account)
    assert.equal(r.hasPassword, true)
    assert.ok(!JSON.stringify(r).includes(account.password))
    assert.ok(!JSON.stringify(await store.read()).includes(account.password))
    assert.equal(
      (await stat(join(root, 'mail-account.json'))).mode & 0o777,
      0o600,
    )
    await saveMailSettings(store, { ...account, password: '' })
    assert.equal((await mailSettings(store)).hasPassword, true)
    await assert.rejects(
      () =>
        saveMailSettings(store, {
          ...account,
          user: 'another@example.com',
          password: '',
        }),
      /授权码/,
    )
    assert.ok(
      !(await readFile(join(root, 'state.json'), 'utf8')).includes(
        account.password,
      ),
    )
  }))

test('邮件整理失败不推进游标，重试成功后持久化，重复收取不再入账', async () =>
  withStore(async (store) => {
    await saveMailSettings(store, account)
    const scan = async () => structuredClone(batch)
    await assert.rejects(() =>
      runMail({}, store, {
        scan,
        generate: async () => {
          throw new Error('model failed')
        },
      }),
    )
    assert.deepEqual((await store.read()).mail.cursors, {})
    assert.equal((await store.read()).mail.lease, null)
    const r = await runMail({}, store, {
      scan,
      generate: async () => ({ items, summary: '两项' }),
    })
    assert.equal(r.created, 2)
    const r2 = await runMail({}, store, {
      scan,
      generate: async (_ctx, _state, messages) => {
        assert.equal(messages.length, 0)
        return { items: [] }
      },
    })
    assert.equal(r2.created, 0)
    assert.equal((await store.read()).tasks.length, 2)
  }))

test('邮件模型请求明确区分不可信邮件；空材料零模型调用，中断响应拒绝入库', async () => {
  const s = fixture()
  s.mail.config.address = 'me@example.com'
  let calls = 0
  const ctx = {
    sessionController: {
      modelCatalog: async () => ({
        default: { provider: 'test', model: 'test' },
      }),
    },
    llm: {
      stream: async function* (request) {
        calls++
        assert.match(request.messages[0].content[0].text, /外部不可信/)
        assert.match(
          request.messages[0].content[0].text,
          /收件人包含用户不等于/,
        )
        yield { type: 'text-delta', text: JSON.stringify({ items }) }
      },
    },
  }
  assert.deepEqual((await generateMailItems(ctx, s, [])).items, [])
  assert.equal(calls, 0)
  await assert.rejects(() => generateMailItems(ctx, s, batch.messages), /中断/)
})

test('IMAP 连接强制加密、只读打开文件夹并关闭连接', async () => {
  const { withMailbox } = await import('../src/mail.js')
  let options,
    opened,
    closed = false
  class FakeClient {
    constructor(value) {
      options = value
      this.mailbox = { exists: 3 }
    }
    on() {}
    async connect() {}
    async getMailboxLock(folder, flags) {
      opened = { folder, ...flags }
      return { release() {} }
    }
    close() {
      closed = true
    }
  }
  await withMailbox(
    { ...account, tlsMode: 'starttls' },
    undefined,
    async () => {},
    FakeClient,
  )
  assert.equal(options.secure, false)
  assert.equal(options.doSTARTTLS, true)
  assert.equal(opened.readOnly, true)
  assert.equal(opened.folder, 'INBOX')
  assert.equal(closed, true)
})

test('IMAP 增量正文读取跳过附件，不改已读状态，UIDVALIDITY 纳入游标', async () => {
  const { scanMail } = await import('../src/mail.js'),
    { Readable } = await import('node:stream')
  let query,
    downloaded = []
  const client = {
    mailbox: { uidValidity: 42n },
    search: async (q) => {
      query = q
      return [4, 5]
    },
    fetchAll: async () => [
      {
        uid: 4,
        envelope: {
          to: [{ address: account.address }],
          subject: '评审材料',
          date: new Date('2026-11-12T02:00:00Z'),
        },
        bodyStructure: {
          type: 'multipart/mixed',
          childNodes: [
            { type: 'text/plain', part: '1' },
            { type: 'application/pdf', part: '2', disposition: 'attachment' },
          ],
        },
      },
      { uid: 5, envelope: { to: [{ address: 'other@example.com' }] } },
    ],
    download: async (uid, part, options) => {
      downloaded.push({ uid, part, options })
      return { content: Readable.from([Buffer.from('请你确认评审材料')]) }
    },
  }
  const mailbox = async (_config, _signal, action) => action(client)
  const result = await scanMail(
    { ...account, lookbackDays: 7 },
    { cursors: {} },
    undefined,
    mailbox,
  )
  assert.equal(result.messages.length, 1)
  assert.equal(result.messages[0].text, '请你确认评审材料')
  assert.equal(result.skipped.length, 1)
  assert.equal(downloaded[0].part, '1')
  assert.equal(downloaded[0].options.maxBytes, 200000)
  assert.equal(result.cursor, 5)
  assert.ok(query.since)
  await scanMail(
    { ...account, lookbackDays: 7 },
    { cursors: { [result.key]: 5 } },
    undefined,
    mailbox,
  )
  assert.equal(query.uid, '6:*')
  assert.equal(downloaded.length, 1)
})

test('邮件里的旧行动进入待安排，已完成同名事项不吞掉新请求', () => {
  const s = fixture()
  add(s, { title: items[0].title, status: 'done' })
  const result = applyMailItems(s, batch, {
    items: [{ ...items[0], plannedDate: '2026-11-12' }],
  })
  assert.equal(result.created, 1)
  assert.equal(s.tasks.find((t) => t.status === 'todo').plannedDate, null)
})

test('全天截止日程不占工作容量，旧项目标签可以直接成为项目关联', () => {
  const s = fixture()
  add(s, {
    title: '旧标签任务',
    project: '评审材料',
    plannedDate: '2026-11-13',
  })
  const p = add(s, { title: '评审材料', kind: 'project' })
  assert.equal(s.tasks.find((t) => t.title === '旧标签任务').parentId, p.id)
  s.plan.config.dailyCapacityMinutes = 60
  s.plan.config.slots = [[540, 600]]
  add(s, { title: '截止日', kind: 'event', plannedDate: '2026-11-14' })
  settlePlan(s, new Date('2026-11-14T01:00:00Z'))
  assert.equal(s.tasks.find((t) => t.title === '旧标签任务').startMinute, null)
  assert.equal(
    s.tasks.find((t) => t.title === '旧标签任务').plannedDate,
    '2026-11-13',
  )
})

test('已完成任务创建关联项目保留完成和历史，不生成移动标记', () => {
  const s = fixture(),
    task = add(s, {
      title: '完成的材料',
      plannedDate: '2026-11-12',
      startMinute: 600,
      estimateMinutes: 60,
      status: 'done',
      note: '保留材料',
    })
  const before = structuredClone(s.tasks.find((t) => t.id === task.id))
  const history = structuredClone(s.plan.days)
  assert.deepEqual(
    applyOps(s, [{ op: 'convert_task', id: task.id, kind: 'project' }]).errors,
    [],
  )
  const after = s.tasks.find((t) => t.id === task.id)
  for (const key of [
    'status',
    'completedAt',
    'firstCompletedAt',
    'startMinute',
    'plannedDate',
    'scheduledMinutes',
    'estimateMinutes',
    'note',
    'progress',
    'evidence',
  ])
    assert.deepEqual(after[key], before[key], key)
  assert.deepEqual(s.plan.days, history)
})
test('全天日程在时间轴投影，真实日程不写入假时间', () => {
  const source = {
    id: 'all-day',
    kind: 'event',
    status: 'todo',
    plannedDate: '2026-11-13',
    startMinute: null,
    estimateMinutes: null,
  }
  const rows = timelineTasks([source], '2026-11-13', 'Asia/Shanghai')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].untimedEvent, true)
  assert.ok(Number.isFinite(rows[0].startMinute))
  assert.equal(source.startMinute, null)
  assert.equal(source.estimateMinutes, null)
})

test('直接改类型不能绕过创建关联项目而清空任务排期', () => {
  const s = fixture(),
    task = add(s, {
      title: '保留排期',
      plannedDate: '2026-11-13',
      startMinute: 600,
      estimateMinutes: 30,
    })
  const before = structuredClone(s.tasks)
  assert.ok(
    applyOps(s, [{ op: 'update_task', id: task.id, kind: 'project' }]).errors
      .length,
  )
  assert.deepEqual(s.tasks, before)
})
