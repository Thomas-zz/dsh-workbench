import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Store } from '../src/store.js'
import { applyOps, migrateState } from '../src/ops.js'
import { runOrganizer, collectTaskMessages } from '../src/organizer.js'
import { dispatchLearn } from '../src/learn/nightly.js'
import { installOrganizationSessions } from '../src/organization-session.js'
import { organizationContext } from './helpers/organization-context.js'

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'wb-org-session-'))
  const store = new Store(root)
  t.after(async () => {
    await installOrganizationSessions({ on: () => () => {} }, store).dispose()
    return rm(root, { recursive: true, force: true })
  })
  await store.mutate(
    '隔离来源',
    (s) => {
      for (const conf of [s.plan.config, s.learn.config])
        conf.sources = { dsh: false, codex: false, claude: false, zcode: false }
    },
    { undoable: false },
  )
  return store
}
test('任务整理实际工具回执与保存一致，任务和学习各自复用、重读与改模型不丢绑定', async (t) => {
  const store = await fixture(t)
  const ctx = organizationContext((messages) => ({
    changes: messages.length
      ? [
          {
            evidenceKeys: [messages[0].key],
            scope: 'standalone',
            ownership: {
              kind: 'user_action',
              evidenceKey: messages[0].key,
              quote: messages[0].text,
            },
            patch: { title: '用户验收' },
          },
        ]
      : [],
    summary: '整理完成',
  }))
  await store.mutate('输入', (s) =>
    applyOps(s, [{ op: 'capture_idea', text: '我明天验收发布效果' }]),
  )
  let opened
  const first = await runOrganizer(ctx, store, {
    trigger: 'manual',
    onSessionReady: (id) => (opened = id),
  })
  await ctx.idle()
  assert.equal(first.status, 'completed')
  assert.equal(first.added, 1)
  assert.equal(opened, ctx.created[0])
  assert.equal(ctx.receipts[0].added, 1)
  assert.equal(ctx.receipts[0].ok, true)
  const second = await runOrganizer(ctx, store, { trigger: 'manual' })
  await ctx.idle()
  assert.equal(second.sessionId, first.sessionId)
  assert.equal(ctx.created.length, 1)
  await dispatchLearn(ctx, store, '【学习整理】')
  await ctx.idle()
  const reloaded = new Store(store.root)
  await dispatchLearn(ctx, reloaded, '【学习整理】')
  await ctx.idle()
  assert.equal(ctx.created.length, 2)
  assert.deepEqual(
    new Set(ctx.titles.map((r) => r.title)),
    new Set(['任务整理', '学习整理']),
  )
  const state = await reloaded.read()
  assert.notEqual(
    state.assistant.sessions.tasks.sessionId,
    state.assistant.sessions.learn.sessionId,
  )
  const migrated = migrateState(JSON.parse(JSON.stringify(state)))
  applyOps(migrated, [{ op: 'assistant_config', model: null }])
  assert.deepEqual(migrated.assistant.sessions, state.assistant.sessions)
  await installOrganizationSessions(ctx, reloaded).dispose()
})
test('并发学习触发只发一张卡，忙碌不换模型，不另建会话', async (t) => {
  const store = await fixture(t),
    ctx = organizationContext(() => ({ hold: true }))
  const outputs = await Promise.all([
    dispatchLearn(ctx, store, '整理'),
    dispatchLearn(ctx, new Store(store.root), '整理'),
  ])
  assert.equal(ctx.created.length, 1)
  assert.equal(ctx.cards.length, 1)
  assert.equal(outputs.filter((r) => r.busy).length, 1)
  const agent = ctx.agents.get(ctx.created[0])
  agent.model.select = () => assert.fail('忙碌时不得换模型')
  assert.equal((await dispatchLearn(ctx, store, '整理')).busy, true)
})
test('已删除对话可重建，临时恢复错误保留原绑定且不创建副本', async (t) => {
  const store = await fixture(t),
    ctx = organizationContext()
  const first = await dispatchLearn(ctx, store, '整理')
  await ctx.idle()
  ctx.agents.delete(first.sessionId)
  const second = await dispatchLearn(ctx, store, '整理')
  await ctx.idle()
  assert.notEqual(first.sessionId, second.sessionId)
  ctx.sessionController.resolveAgent = async () => ({
    error: new Error('active write handle is owned'),
  })
  await assert.rejects(dispatchLearn(ctx, store, '整理'), /active write handle/)
  assert.equal(ctx.created.length, 2)
  assert.equal(
    (await store.read()).assistant.sessions.learn.sessionId,
    second.sessionId,
  )
})
test('发送失败后保留同一个会话，重试不丢失模型设置或复制对话', async (t) => {
  const store = await fixture(t),
    ctx = organizationContext()
  const flush = ctx.sessions.flush
  ctx.sessions.flush = async () => {
    throw new Error('flush failure')
  }
  await assert.rejects(dispatchLearn(ctx, store, '整理'), /flush failure/)
  await ctx.idle()
  ctx.sessions.flush = flush
  await dispatchLearn(ctx, store, '整理')
  await ctx.idle()
  assert.equal(ctx.created.length, 1)
})
test('对话中断保留游标与原事项；只承认本轮授权对话提交', async (t) => {
  const store = await fixture(t)
  await store.mutate('输入', (s) =>
    applyOps(s, [{ op: 'capture_idea', text: '我需要验收界面' }]),
  )
  const ctx = organizationContext(async (ms, prompt, current) => {
    const tool = current.registered.get('workbench_organize_submit')
    await assert.rejects(
      tool.execute(
        {
          runId: prompt.match(/本轮编号：([^\n]+)/)[1],
          changes: [],
          summary: '',
        },
        { agent: { session: { id: 'unrelated' } } },
      ),
      /不属于/,
    )
    throw new Error('network interrupted')
  })
  const result = await runOrganizer(ctx, store, { trigger: 'manual' })
  await ctx.idle()
  assert.equal(result.status, 'error')
  assert.match(result.error, /network interrupted/)
  const state = await store.read()
  assert.equal(state.ideas[0].status, 'parked')
  assert.deepEqual(state.plan.organizer.processed, [])
  assert.equal(state.plan.organizer.runs[0].sessionId, ctx.created[0])
  assert.equal(ctx.registered.size, 0)
})
test('宿主取消会解除等待，晚到提交无法写入；整理租约不在旧五分钟边界提前过期', async (t) => {
  const store = await fixture(t),
    ctx = organizationContext(() => ({ hold: true })),
    controller = new AbortController()
  const run = runOrganizer(ctx, store, {
    trigger: 'manual',
    signal: controller.signal,
    onSessionReady: () => controller.abort(),
  })
  const result = await run
  assert.equal(result.status, 'error')
  assert.equal(ctx.registered.size, 0)
  await store.mutate('长整理', (s) => {
    s.plan.organizer.lease = {
      id: 'long',
      at: Date.now() - 6 * 60000,
      ownerPid: process.pid,
    }
    s.plan.organizer.runs = [{ id: 'long', status: 'running' }]
  })
  assert.equal((await store.read()).plan.organizer.lease.id, 'long')
})
test('任务收集排除两类整理对话，避免把整理结果再次作为输入', async (t) => {
  const store = await fixture(t)
  await store.mutate('绑定', (s) => {
    s.assistant.sessions = {
      tasks: { sessionId: 'task-chat' },
      learn: { sessionId: 'learn-chat' },
    }
    s.assistant.retiredSessions = ['session-retired-chat']
    s.plan.config.sources.dsh = true
  })
  const now = new Date('2026-11-23T04:00:00Z')
  const collected = await collectTaskMessages(await store.read(), {
    now,
    scan: {
      dsh: async () =>
        ['task-chat', 'learn-chat', 'retired-chat', 'user-chat'].map(
          (sessionId) => ({
            sessionId,
            source: 'dsh',
            at: now.toISOString(),
            text: '我需要确认方案',
          }),
        ),
    },
  })
  assert.deepEqual(
    collected.messages.map((m) => m.sessionId),
    ['user-chat'],
  )
})

test('按工作台自然周/月复用，手动只标记指定对话；旧记录继续排除', async (t) => {
  const store = await fixture(t),
    ctx = organizationContext()
  const send = async () => {
    const r = await dispatchLearn(ctx, store, '整理')
    await ctx.idle()
    return r.sessionId
  }
  t.mock.timers.enable({
    apis: ['Date'],
    now: new Date('2026-11-22T15:59:00Z'),
  }) // 上海周日 23:59
  const first = await send()
  assert.equal(await send(), first)
  t.mock.timers.tick(60_000)
  const nextWeek = await send()
  assert.notEqual(nextWeek, first)
  await store.mutate('改为按月', (s) =>
    applyOps(s, [{ op: 'assistant_config', sessionPeriod: 'monthly' }]),
  )
  t.mock.timers.tick(7 * 86400_000)
  assert.equal(await send(), nextWeek, '同月跨周不换')
  t.mock.timers.tick(86400_000)
  const nextMonth = await send()
  assert.notEqual(nextMonth, nextWeek)
  const count = ctx.cards.length
  await store.mutate('仅学习换新', (s) => {
    s.assistant.sessions.tasks = { sessionId: 'session-kept' }
    s.plan.config.enabled = false
    applyOps(s, [{ op: 'assistant_config', rotateSession: 'learn' }])
  })
  assert.equal(ctx.cards.length, count)
  assert.equal(ctx.created.length, 3)
  const manual = await send()
  assert.notEqual(manual, nextMonth)
  assert.equal(await send(), manual)
  const state = await new Store(store.root).read()
  assert.equal(state.plan.config.enabled, false)
  assert.deepEqual(state.assistant.retiredSessions, [
    first,
    nextWeek,
    nextMonth,
  ])
  assert.deepEqual(state.assistant.sessions.tasks, {
    sessionId: 'session-kept',
  })
  const { organizationSessionIds } = await import(
    '../src/organization-session.js'
  )
  assert.ok(organizationSessionIds(state).has('kept'))
  assert.ok(organizationSessionIds(state).has(first))
})

// Count calls at the stubbed adapter boundary, not prompt promises or attempted hook calls.
function meteredAdapter(ctx) {
  const calls = []
  async function stream(id, size = 10, maxTokens = 4096) {
    const options = {
      sessionId: id,
      provider: 'fixture',
      model: 'test-model',
      maxTokens,
      messages: [{ content: 'a'.repeat(size) }],
    }
    for await (const _ of ctx.waterfall(
      'llm/stream',
      options,
      async function* () {
        calls.push(id)
        yield 'ok'
      },
    )) {
    }
  }
  return { calls, stream }
}

test('只要读到新材料，耗时、请求数、输入体积和工具数都不造成强停，输出设置留给模型', async (t) => {
  const store = await fixture(t),
    ctx = organizationContext(() => ({ hold: true }))
  const { stream, calls } = meteredAdapter(ctx)
  const { sessionId: id } = await dispatchLearn(ctx, store, '整理')
  await ctx.idle()
  const agent = ctx.agents.get(id)
  const config = { model: 'fixture', maxTokens: 9000 }
  assert.deepEqual(
    await ctx.waterfall('agent/request', { agent }, () => config),
    config,
  )
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] })
  await stream(id, 200_000, 9000)
  const exec = { agent, name: 'workbench_learn_read', arguments: {} }
  for (let i = 0; i < 60; i++) {
    t.mock.timers.tick(60_000)
    assert.equal(
      await ctx.waterfall('tools/pre-execute', exec, () => 'allow'),
      'allow',
    )
    ctx.notify('tools/result', exec, {
      isError: false,
      value: { messages: [{ key: 'long-message', offset: i, text: '字' }] },
    })
    await stream(id, 10000)
  }
  assert.equal(calls.length, 61)
  assert.equal(agent.status, 'running')
  await assert.rejects(stream(id), /没有新的整理工具回执/)
  assert.equal(calls.length, 61)
  await stream('ordinary', 200_000, 9000)
  assert.equal(calls.at(-1), 'ordinary')
})

test('事故旧历史按越权记录而非大小隔离，首个请求不到达模型', async (t) => {
  const store = await fixture(t),
    ctx = organizationContext(() => ({ hold: true }))
  const { sessionId } = await dispatchLearn(ctx, store, '整理')
  await ctx.idle()
  let dispatched = false
  const options = {
    sessionId,
    messages: [
      {
        role: 'assistant',
        content: [{ type: 'tool-call', name: 'bash', arguments: '{}' }],
      },
    ],
  }
  const stream = ctx.waterfall('llm/stream', options, async function* () {
    dispatched = true
    yield 'ok'
  })
  await assert.rejects(async () => {
    for await (const chunk of stream) assert.fail(chunk)
  }, /未重发历史/)
  assert.equal(dispatched, false)
  assert.equal((await store.read()).assistant.sessions.learn.usage.requests, 0)
})

test('重放失败提交后试图写 ignore 和执行 shell：任务停止、零后续请求、零工具副作用，定时不重试', async (t) => {
  const { organizerDue } = await import('../src/organizer.js')
  const store = await fixture(t)
  const ctx = organizationContext()
  const mutate = store.mutate.bind(store)
  t.mock.method(store, 'mutate', (label, ...args) => {
    if (label === '后台整理任务') throw new Error('写盘失败')
    return mutate(label, ...args)
  })
  await store.mutate('准备', (s) => {
    s.plan.config.enabled = true
    applyOps(s, [{ op: 'capture_idea', text: '我需要复核上线结果' }])
  })
  const result = await runOrganizer(ctx, store, { trigger: 'manual' })
  await ctx.idle()
  assert.equal(result.status, 'error')
  assert.match(result.error, /写盘失败/)
  const [id] = ctx.created,
    agent = ctx.agents.get(id)
  assert.equal(agent.status, 'idle')
  assert.ok(agent.cancelReason)
  const { stream, calls } = meteredAdapter(ctx)
  let writes = 0
  for (const name of ['workbench_learn_capture', 'bash']) {
    const gate = await ctx.waterfall(
      'tools/pre-execute',
      { agent, name },
      () => {
        writes++
        return { kind: 'allow' }
      },
    )
    assert.equal(gate.kind, 'deny')
    await assert.rejects(stream(id), /已关闭/)
  }
  assert.deepEqual([writes, calls.length], [0, 0])
  const state = await store.read()
  assert.equal(state.learn.inbox.length, 0)
  assert.deepEqual(state.plan.organizer.processed, [])
  assert.equal(organizerDue(state, new Date(Date.now() + 600000)), false)
  assert.equal(state.assistant.sessions.tasks.status, 'error')
})

test('模型试图调用禁用工具、重复检索或遇到 429 均中止本轮，手动可以重试', async (t) => {
  const store = await fixture(t),
    ctx = organizationContext(() => ({ hold: true }))
  const open = async () => {
    const r = await dispatchLearn(ctx, store, '整理')
    await ctx.idle()
    return ctx.agents.get(r.sessionId)
  }
  const agent = await open(),
    id = agent.session.id
  assert.ok(!agent.allowed.includes('bash'))
  ctx.emit(id, 'assistant/message', {
    turn: agent.turn,
    message: {
      content: [{ type: 'tool-call', name: 'bash', arguments: '{}' }],
    },
  })
  assert.match(agent.cancelReason, /不允许调用 bash/)
  assert.equal(await open(), agent)
  const { stream, calls } = meteredAdapter(ctx)
  await stream(id)
  // Different arguments and random page receipts, identical delivered content.
  for (const token of ['a', 'b', 'c']) {
    const exec = {
      agent,
      name: 'workbench_learn_read',
      arguments: { afterBatchId: token },
    }
    ctx.notify('tools/result', exec, {
      isError: false,
      value: { batchId: token, messages: [{ key: 'same', text: '旧材料' }] },
    })
    if (token === 'c') await assert.rejects(stream(id), /仍没有新材料/)
    else await stream(id)
  }
  assert.equal(calls.length, 3)
  assert.equal(await open(), agent)
  await store.mutate('授权测试模型', (s) =>
    applyOps(s, [{ op: 'assistant_config', automaticModel: agent.selection }]),
  )
  await ctx.waterfall(
    'agent/request-error',
    { agent, failure: { status: 429 } },
    () => assert.fail('不得交给宿主重试'),
  )
  assert.match(agent.cancelReason, /429/)
  await assert.rejects(
    dispatchLearn(ctx, store, '自动', undefined, true),
    /自动整理已暂停/,
  )
  assert.equal(await open(), agent)
})

test('学习专用对话内的真人指令同样阻止空转；换期时仅转发新要求，旧对话零请求', async (t) => {
  const store = await fixture(t),
    ctx = organizationContext()
  const { sessionId } = await dispatchLearn(ctx, store, '前轮')
  await ctx.idle()
  const agent = ctx.agents.get(sessionId),
    { stream, calls } = meteredAdapter(ctx)
  function direct(turn) {
    agent.status = 'running'
    agent.turn = turn
    return ctx.waterfall(
      'agent/pre-step',
      {
        agent,
        turn,
        step: 1,
        messages: [
          {
            id: `human-${turn}`,
            source: { kind: 'user' },
            content: [{ type: 'text', text: '整理昨天' }],
          },
        ],
      },
      () => 'enter',
    )
  }
  assert.equal(await direct(101), 'enter')
  await stream(sessionId, 200_000)
  await assert.rejects(stream(sessionId), /没有新的整理工具回执/)
  await store.mutate('换新', (s) =>
    applyOps(s, [{ op: 'assistant_config', rotateSession: 'learn' }]),
  )
  assert.deepEqual(await direct(102), { kind: 'reject' })
  await ctx.idle()
  assert.equal(calls.length, 1) // 转发不在旧会话增加请求
  assert.equal(ctx.cards.length, 2)
  assert.notEqual(ctx.cards[1].sessionId, sessionId)
  assert.match(ctx.cards[1].card.content[0].text, /用户原话：\n整理昨天$/)
  assert.doesNotMatch(ctx.cards[1].card.content[0].text, /前轮/)
})

test('同一学习回合不能重新派发或换范围来制造假进度', async (t) => {
  const store = await fixture(t),
    ctx = organizationContext(() => ({ hold: true }))
  const { sessionId } = await dispatchLearn(ctx, store, '整理')
  await ctx.idle()
  const agent = ctx.agents.get(sessionId)
  const collect = (date) =>
    ctx.waterfall(
      'tools/pre-execute',
      {
        agent,
        name: 'workbench_learn_collect',
        arguments: { start: true, date },
      },
      () => ({ kind: 'allow' }),
    )
  assert.equal((await collect('昨天')).kind, 'allow')
  assert.equal((await collect('今天')).kind, 'deny')
  assert.match(agent.cancelReason, /不能在同一回合重新启动/)
})

test('安全暂停跨天和换新保留，仅本类手动成功提交解除；无固定每日轮数，但无人值守不能使用未经授权的模型', async (t) => {
  t.mock.timers.enable({
    apis: ['Date'],
    now: new Date('2026-11-22T15:59:00Z'),
  })
  const store = await fixture(t),
    ctx = organizationContext(() => ({ hold: true }))
  const start = async (automatic) => {
    const r = await dispatchLearn(ctx, store, '整理', undefined, automatic)
    await ctx.idle()
    return ctx.agents.get(r.sessionId)
  }
  const finish = async (agent) => {
    ctx.notify(
      'tools/result',
      { agent, name: 'workbench_learn_write' },
      { isError: false, value: { ok: true, progress: { complete: true } } },
    )
    agent.status = 'idle'
    ctx.emit(agent.session.id, 'turn/end', {
      turn: agent.turn,
      reason: { kind: 'completed' },
    })
    await store.read()
  }
  await assert.rejects(start(true), /没有定时整理授权/)
  assert.equal(ctx.created.length, 0)
  await store.mutate('授权指定模型', (s) =>
    applyOps(s, [
      {
        op: 'assistant_config',
        automaticModel: { provider: 'fixture', model: 'test-model' },
      },
    ]),
  )
  let agent = await start(true)
  await ctx.waterfall(
    'agent/request-error',
    { agent, failure: { status: 429 } },
    () => assert.fail('不能重试'),
  )
  t.mock.timers.tick(3600000)
  await assert.rejects(start(true), /自动整理已暂停/)
  const previous = agent
  agent = await start(false)
  assert.notEqual(agent, previous)
  assert.ok((await store.read()).assistant.sessions.learn.safetyHold)
  await finish(agent)
  assert.ok(!(await store.read()).assistant.sessions.learn.safetyHold)
  for (let i = 0; i < 5; i++) {
    if (i === 1)
      await store.mutate('手动换新', (s) =>
        applyOps(s, [{ op: 'assistant_config', rotateSession: 'learn' }]),
      )
    await finish(await start(true))
  }
  const active = await start(true)
  const { stream, calls } = meteredAdapter(ctx)
  await stream(active.session.id)
  await store.mutate('撤回定时授权', (s) =>
    applyOps(s, [{ op: 'assistant_config', automaticModel: null }]),
  )
  await assert.rejects(stream(active.session.id), /没有定时整理授权/)
  assert.equal(calls.length, 1)
})

test('任务整理回执后可在原对话连续追问、查询；不复用提交权限或改写原回执', async (t) => {
  const store = await fixture(t),
    ctx = organizationContext()
  const { sessionId } = await runOrganizer(ctx, store, { trigger: 'manual' })
  await ctx.idle()
  const agent = ctx.agents.get(sessionId)
  const { stream } = meteredAdapter(ctx)
  const binding = structuredClone((await store.read()).assistant.sessions.tasks)
  const message = (id) => ({
    id,
    source: { kind: 'user' },
    content: [{ type: 'text', text: '为什么这样排？' }],
  })
  const step = (turn, step, messages) =>
    ctx.waterfall('agent/pre-step', { agent, turn, step, messages }, () => ({
      kind: 'enter',
      messages,
    }))
  for (const turn of [51, 52]) {
    assert.equal((await step(turn, 1, [message(`user-${turn}`)])).kind, 'enter')
    assert.deepEqual(agent.allowed, ['workbench_query'])
    await stream(sessionId)
    const exec = { agent, name: 'workbench_query', arguments: { view: 'all' } }
    assert.equal(
      await ctx.waterfall('tools/pre-execute', exec, () => 'allowed'),
      'allowed',
    )
    ctx.notify('tools/result', exec, { value: { data: {} } })
    await stream(sessionId)
    ctx.emit(sessionId, 'turn/end', { turn, reason: { kind: 'completed' } })
    assert.equal(agent.allowed, undefined)
  }
  assert.deepEqual((await store.read()).assistant.sessions.tasks, binding)
  assert.deepEqual(await step(53, 2, [message('orphan')]), { kind: 'reject' })
  assert.equal((await step(54, 1, [message('user-54')])).kind, 'enter')
  const queued = []
  agent.followup = (m) => queued.push(m)
  const extra = message('extra')
  assert.deepEqual(await step(54, 2, [extra]), { kind: 'enter', messages: [] })
  assert.deepEqual(queued, [extra])
  const denied = await ctx.waterfall(
    'tools/pre-execute',
    { agent, name: 'workbench_organize_submit' },
    () => assert.fail(),
  )
  assert.equal(denied.kind, 'deny')
})

test('事项池整理只排序和补估时，提交时重新检查项目、池和手动修改；空池不调用模型', async (t) => {
  const store = await fixture(t)
  const ids = await store.mutate(
    '池内外样例',
    (s) =>
      applyOps(
        s,
        [
          { title: '待排序' },
          { title: '已有估时', estimateMinutes: 45 },
          { title: '稍后移入周池' },
          { title: '另一项目', project: '乙' },
          { title: '已完成', status: 'done' },
        ].map((row) => ({ op: 'add_task', project: '甲', ...row })),
      ).targets,
  )
  const ctx = organizationContext(async (_, prompt) => {
    assert.match(prompt, /待排序/)
    assert.doesNotMatch(prompt, /另一项目|已完成/)
    await store.mutate('用户移入周池', (s) =>
      applyOps(s, [
        { op: 'update_task', id: ids[2], plannedWeek: '2030-01-07' },
      ]),
    )
    return {
      changes: ids.map((id) => ({
        id,
        patch: { order: 8, estimateMinutes: 20 },
      })),
      collaborations: [{ title: '不应新增' }],
    }
  })
  const result = await runOrganizer(ctx, store, {
    trigger: 'manual',
    mode: 'pool',
    project: '甲',
    collect: () => assert.fail(),
  })
  await ctx.idle()
  assert.equal(result.status, 'completed')
  assert.equal(result.updated, 2)
  const s = await store.read()
  assert.equal(s.reviews.length, 0)
  assert.equal(s.tasks.length, ids.length)
  const rows = ids.map((id) => s.tasks.find((t) => t.id === id))
  assert.equal(rows[0].estimateMinutes, 20)
  assert.equal(rows[0].plannedDate, null)
  assert.equal(rows[1].estimateMinutes, 45)
  assert.deepEqual(
    rows.map((t) => t.order),
    [8, 8, 0, 0, 0],
  )
  const empty = await runOrganizer(ctx, store, {
    trigger: 'manual',
    mode: 'pool',
    project: '空项目',
  })
  assert.equal(empty.updated, 0)
  assert.equal(ctx.cards.length, 1)
})
