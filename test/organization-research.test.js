import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import { migrateState, applyOps } from '../src/ops.js'
import { collectTaskResearch } from '../src/organization-research.js'
import {
  applyOrganization,
  organizerPrompt,
  runOrganizer,
} from '../src/organizer.js'
import { organizationContext } from './helpers/organization-context.js'
import { organizationModel } from '../src/assistant.js'
import {
  dispatchOrganization,
  installOrganizationSessions,
} from '../src/organization-session.js'
import { Store } from '../src/store.js'
import { scanClaude } from '../src/learn/scan/claude.js'
import { scanZcode } from '../src/learn/scan/zcode.js'
import { scanDsh } from '../src/learn/scan/dsh.js'
import { scanCodex } from '../src/learn/scan/codex.js'

const now = new Date('2026-11-18T08:00:00Z')
const state = () =>
  migrateState({
    plan: {
      config: {
        sources: { codex: true, dsh: false, claude: false, zcode: false },
      },
    },
  })
const row = (
  text,
  time = '2026-11-18T01:00:00Z',
  sessionId = 'thread',
  role = 'user',
) => ({
  source: 'codex',
  sessionId,
  project: '/fixture',
  text,
  at: time,
  role,
})
const scanOf = (rows) => ({
  codex: async ({ sinceMs, sessionId }) =>
    rows.filter(
      (m) =>
        Date.parse(m.at) >= sinceMs &&
        (!sessionId || m.sessionId === sessionId),
    ),
})
const readStore = (s) => ({ read: async () => s })
const collect = (s, rows) => collectTaskResearch(s, { now, scan: scanOf(rows) })
async function temp(t) {
  const root = await mkdtemp(join(tmpdir(), 'wb-research-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

test('先发送范围与目录，原文和证据按需读取；可回查增量窗口外的结论', async () => {
  const s = state(),
    text = '我要验收新版本。' + '长原文内容'.repeat(200)
  const rows = [
    row('我上周确认了旧方案', '2026-11-10T01:00:00Z'),
    row(text),
    row(
      '新版已经实现，等待你验收',
      '2026-11-18T02:00:00Z',
      'thread',
      'assistant',
    ),
  ]
  const c = await collect(s, rows),
    prompt = organizerPrompt(s, c, now)
  assert.equal(c.messages.length, 0)
  assert.ok(!prompt.includes(text))
  assert.match(prompt, /去哪找、怎么找/)
  assert.match(prompt, /workbench_organize_inspect/)
  const result = await c.research.inspect(
    { action: 'read', ref: 'codex:thread' },
    readStore(s),
  )
  assert.equal(result.messages.length, 3)
  assert.equal(c.messages.length, 2)
  assert.equal(c.context.length, 1)
  assert.equal(result.messages[0].atLocalDate, '2026-11-10')
  assert.equal(c.research.finalize(['codex:thread']).pendingMessages, 0)
})

test('只看摘要或搜索不推进；读过但未确认核对的来源保留；同时间戳未读消息下一轮可继续', async () => {
  const s = state(),
    rows = [
      row('我要验收 A', undefined, 'a'),
      row('我要验收 B', undefined, 'b'),
    ]
  const c = await collect(s, rows),
    io = (args) => c.research.inspect(args, readStore(s))
  await io({ action: 'search', query: '验收' })
  await io({ action: 'sessions' })
  assert.equal(c.research.finalize(['codex:a']).pendingMessages, 2)
  await io({ action: 'read', ref: 'codex:a' })
  assert.equal(c.research.finalize([]).pendingMessages, 2)
  assert.equal(c.research.finalize(['codex:a']).pendingMessages, 1)
  applyOrganization(s, structuredClone(s), c, {
    changes: [],
    summary: '检查 A，B 待查',
  })
  assert.equal(s.plan.organizer.processed.length, 1)
  const next = await collect(s, rows)
  assert.deepEqual(
    next.research.initial.map((v) => v.ref),
    ['codex:b'],
  )
  assert.equal(next.messages.length, 0)
})

test('长消息分块读取，不允许用未发送内容作证据，完整读取后才消费；禁止越界读取', async () => {
  const s = state(),
    rows = [row('开头' + '甲'.repeat(6500) + '我明天验收')]
  const c = await collect(s, rows)
  await assert.rejects(
    c.research.inspect({ action: 'read', ref: 'dsh:other' }, readStore(s)),
    /不在/,
  )
  let read = await c.research.inspect(
    { action: 'read', ref: 'codex:thread' },
    readStore(s),
  )
  assert.equal(read.messages[0].nextTextOffset, 6000)
  assert.ok(!c.messages[0].text.includes('我明天验收'))
  assert.equal(c.research.finalize(['codex:thread']).pendingMessages, 1)
  read = await c.research.inspect(
    {
      action: 'read',
      ref: 'codex:thread',
      key: read.messages[0].key,
      textOffset: 6000,
    },
    readStore(s),
  )
  assert.equal(read.messages[0].nextTextOffset, null)
  assert.ok(c.messages[0].text.endsWith('我明天验收'))
  assert.equal(c.research.finalize(['codex:thread']).pendingMessages, 0)
})

test('任务查询读取实时状态含完成项、翻页和来源；整理对话不进入检索范围', async () => {
  const s = state()
  s.assistant.sessions.tasks = { sessionId: 'org' }
  applyOps(s, [
    { op: 'add_task', title: '验收原型' },
    { op: 'add_task', title: '已验收原型', status: 'done' },
  ])
  const c = await collect(s, [row('整理结果', undefined, 'org')])
  assert.equal(c.research.initial.length, 0)
  s.tasks.find((t) => t.title === '验收原型').status = 'done'
  const result = await c.research.inspect(
    { action: 'tasks', status: 'done', limit: 1 },
    readStore(s),
  )
  assert.equal(result.total, 2)
  assert.equal(result.nextOffset, 1)
  assert.equal(result.tasks[0].status, 'done')
})

test('原文读取失败保留来源进度；搜索片段不能绕过实际证据校验', async () => {
  const s = state()
  const c = await collectTaskResearch(s, {
    now,
    scan: {
      codex: async (options) => {
        if (options.sessionId) throw Error('暂时无法读取')
        return [row('我要验收原型')]
      },
    },
  })
  const hits = await c.research.inspect(
    { action: 'search', query: '验收' },
    readStore(s),
  )
  applyOrganization(s, structuredClone(s), c, {
    changes: [
      { evidenceKeys: [hits.hits[0].key], patch: { title: '验收原型' } },
    ],
  })
  assert.equal(s.tasks.length, 0)
  assert.equal(s.reviews.length, 0)
  assert.match(c.collaborationSkipped[0].reason, /来源依据/)
  await assert.rejects(
    c.research.inspect({ action: 'read', ref: 'codex:thread' }, readStore(s)),
    /暂时/,
  )
  assert.equal(c.research.finalize([]).pendingMessages, 1)
  assert.equal(c.errors.length, 1)
})

test('通过真实检索工具提交、保存与回执一致，检索只允许当前轮次会话且结束清理', async (t) => {
  const store = new Store(await temp(t))
  await store.mutate('fixture', (s) => Object.assign(s, state()))
  const ctx = organizationContext(async (messages, prompt, ctx) => {
    const tool = ctx.registered.get('workbench_organize_inspect')
    await assert.rejects(
      tool.execute(
        { action: 'tasks', runId: 'wrong' },
        { agent: { session: { id: 'wrong' } } },
      ),
      /不属于/,
    )
    return {
      changes: [
        {
          evidenceKeys: [messages[0].key],
          scope: 'standalone',
          ownership: {
            kind: 'user_action',
            evidenceKey: messages[0].key,
            quote: '我要验收原型',
          },
          patch: { title: '验收原型' },
        },
        { id: 'unverified-task', patch: { status: 'done' } },
      ],
      summary: '所有任务均已处理',
    }
  })
  t.after(() => installOrganizationSessions(ctx, store).dispose())
  const result = await runOrganizer(ctx, store, {
    trigger: 'manual',
    collect: (s) => collect(s, [row('我要验收原型')]),
  })
  await ctx.idle()
  assert.equal(result.added, 1)
  const saved = await store.read()
  assert.equal(result.status, 'partial')
  assert.equal(saved.plan.organizer.runs[0].status, 'partial')
  assert.equal(ctx.receipts[0].status, 'partial')
  assert.deepEqual(
    ctx.receipts[0].taskSkipped,
    saved.plan.organizer.runs[0].taskSkipped,
  )
  assert.match(ctx.receipts[0].taskSkipped[0].reason, /来源依据/)
  assert.doesNotMatch(ctx.receipts[0].summary, /所有任务均已处理/)
  assert.equal(saved.tasks[0].origin.kind, 'auto')
  assert.equal(saved.tasks[0].origin.source, 'codex')
  assert.equal(saved.plan.organizer.processed.length, 1)
  assert.equal(saved.plan.organizer.runs[0].inspected.length, 3)
  assert.equal(ctx.registered.size, 0)
  assert.equal(ctx.receipts[0].added, 1)
})

test('思考强度落盘、两种整理实际下发，切换模型清除不兼容档位', async (t) => {
  const store = new Store(await temp(t)),
    ctx = organizationContext()
  t.after(() => installOrganizationSessions(ctx, store).dispose())
  await store.mutate('设置', (s) => {
    assert.deepEqual(
      applyOps(s, [{ op: 'assistant_config', reasoningEffort: 'high' }]).errors,
      [],
    )
  })
  // This dispatch-only fixture does not run taskOrganizationExchange, which normally registers both tools.
  for (const name of [
    'workbench_organize_inspect',
    'workbench_organize_submit',
  ])
    t.after(ctx.tools.register({ name }))
  for (const kind of ['tasks', 'learn']) {
    const original = ctx.agents
    const result = await dispatchOrganization(ctx, store, kind, '检查配置')
    await ctx.idle()
    assert.equal(
      original.get(result.sessionId).selection.reasoningEffort,
      'high',
    )
  }
  const s = await new Store(store.root).read()
  assert.equal(s.assistant.reasoningEffort, 'high')
  assert.throws(
    () =>
      organizationModel(s, {
        default: { provider: 'p', model: 'm' },
        groups: [{ id: 'p', models: [{ id: 'm' }] }],
      }),
    /不支持/,
  )
  applyOps(s, [
    { op: 'assistant_config', model: { provider: 'other', model: 'other' } },
  ])
  assert.equal(s.assistant.reasoningEffort, null)
  assert.equal(s.assistant.sessions.tasks.sessionId.length > 0, true)
})

test('四源会话读取用户与助手结果，排除推理、工具内容与合成输入，精确读取指定会话', async (t) => {
  const root = await temp(t),
    time = '2026-11-18T01:00:00Z',
    ms = Date.parse(time)
  await mkdir(join(root, 'claude/projects/project'), { recursive: true })
  const jsonl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n')
  await writeFile(
    join(root, 'claude/projects/project/thread.jsonl'),
    jsonl([
      {
        sessionId: 'thread',
        timestamp: time,
        message: { role: 'user', content: '我来验收' },
      },
      {
        sessionId: 'thread',
        timestamp: time,
        message: {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: 'hidden' },
            { type: 'text', text: '已实现，待验收' },
            { type: 'tool_use', name: 'hidden' },
          ],
        },
      },
    ]),
  )
  let results = await scanClaude({
    home: join(root, 'claude'),
    sinceMs: 0,
    includeAssistant: true,
    sessionId: 'thread',
  })
  assert.deepEqual(
    results.map((r) => r.role),
    ['user', 'assistant'],
  )
  assert.equal(results[1].text, '已实现，待验收')
  await mkdir(join(root, 'zcode/cli/db'), { recursive: true })
  const db = new DatabaseSync(join(root, 'zcode/cli/db/db.sqlite'))
  db.exec(
    'CREATE TABLE session(id TEXT, directory TEXT); CREATE TABLE message(id TEXT, session_id TEXT, time_created INTEGER, data TEXT); CREATE TABLE part(id TEXT, message_id TEXT, time_created INTEGER, data TEXT)',
  )
  db.prepare('INSERT INTO session VALUES (?, ?)').run('thread', '/fixture')
  for (const [id, role, synthetic] of [
    ['u', 'user', false],
    ['a', 'assistant', false],
    ['s', 'user', true],
  ]) {
    db.prepare('INSERT INTO message VALUES (?, ?, ?, ?)').run(
      id,
      'thread',
      ms,
      JSON.stringify({ role, synthetic }),
    )
    db.prepare('INSERT INTO part VALUES (?, ?, ?, ?)').run(
      id,
      id,
      ms,
      JSON.stringify({
        type: 'text',
        text: role === 'user' ? '我来验收' : '已经完成',
      }),
    )
  }
  db.prepare('INSERT INTO part VALUES (?, ?, ?, ?)').run(
    'reasoning',
    'a',
    ms,
    JSON.stringify({ type: 'reasoning', text: 'hidden' }),
  )
  db.close()
  results = await scanZcode({
    home: join(root, 'zcode'),
    sinceMs: 0,
    includeAssistant: true,
    sessionId: 'thread',
  })
  assert.equal(results.length, 2)
  assert.equal(results.find((r) => r.role === 'assistant').text, '已经完成')
  assert.equal(
    (
      await scanZcode({
        home: join(root, 'zcode'),
        sinceMs: 0,
        includeAssistant: true,
        sessionId: 'other',
      })
    ).length,
    0,
  )
  await mkdir(join(root, 'dsh/sessions/project/session-thread'), {
    recursive: true,
  })
  await writeFile(
    join(root, 'dsh/sessions/project/session-thread/session.v4.jsonl'),
    jsonl([
      {
        type: 'user/message',
        time: ms,
        surfaceOp: 'append',
        data: {
          source: { kind: 'user' },
          content: [{ type: 'text', text: '我来验收' }],
        },
      },
      {
        type: 'assistant/message',
        time: ms,
        surfaceOp: 'append',
        data: {
          message: {
            content: [
              { type: 'text', text: '实际宿主回复' },
              { type: 'reasoning', text: 'hidden' },
            ],
          },
        },
      },
    ]),
  )
  results = await scanDsh({
    home: join(root, 'dsh'),
    sinceMs: 0,
    includeAssistant: true,
    sessionId: 'thread',
  })
  assert.deepEqual(
    results.map((r) => r.text),
    ['我来验收', '实际宿主回复'],
  )
  await mkdir(join(root, 'codex/sessions'), { recursive: true })
  await writeFile(
    join(root, 'codex/sessions/rollout-thread.jsonl'),
    jsonl([
      { type: 'session_meta', payload: { id: 'thread', cwd: '/fixture' } },
      ...['user', 'assistant'].map((role) => ({
        type: 'response_item',
        timestamp: time,
        payload: {
          type: 'message',
          role,
          phase: role === 'assistant' ? 'final_answer' : undefined,
          content: [{ type: 'text', text: role }],
        },
      })),
      {
        type: 'response_item',
        timestamp: time,
        payload: {
          type: 'message',
          role: 'assistant',
          channel: 'analysis',
          content: [{ type: 'text', text: 'hidden' }],
        },
      },
    ]),
  )
  results = await scanCodex({
    home: join(root, 'codex'),
    sinceMs: 0,
    includeAssistant: true,
    sessionId: 'thread',
  })
  assert.deepEqual(
    results.map((r) => r.role),
    ['user', 'assistant'],
  )
})

test('大范围检索逐页交付，跨过旧的总量上限仍只确认真正读过的证据', async () => {
  const s = state(),
    rows = Array.from({ length: 60 }, (_, i) =>
      row(`${i}:` + '甲'.repeat(4900)),
    )
  const c = await collect(s, rows)
  await c.research.inspect(
    { action: 'read', ref: 'codex:thread', limit: 30 },
    readStore(s),
  )
  assert.equal(c.messages.length, 30)
  assert.equal(c.research.finalize(['codex:thread']).pendingMessages, 30)
  await c.research.inspect(
    { action: 'read', ref: 'codex:thread', limit: 30, before: 30 },
    readStore(s),
  )
  assert.equal(c.messages.length, 60)
  assert.equal(c.research.finalize(['codex:thread']).pendingMessages, 0)
})
