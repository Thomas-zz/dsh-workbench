// 学习定时整理与 /学习任务 拦截测试：触发卡文案、run-now 推送、pre-step 零成本记录。
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Store } from '../src/store.js'
import { applyOps } from '../src/ops.js'
import { buildLearnTrigger, runLearnNow } from '../src/learn/nightly.js'
import { installLearnPrestep } from '../src/learn/prestep.js'

let dir
before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'wb-nightly-'))
})
after(async () => {
  await rm(dir, { recursive: true, force: true })
})

test('buildLearnTrigger：统计头 + 候选预览 + 指令（定时与手动两种头）', () => {
  const collected = {
    candidates: [
      { source: 'zcode', text: '什么是SDK，数据库的sdk是啥' },
      { source: 'codex', text: '什么叫库存事实源未认证' },
    ],
    inbox: [{ id: 'li_1', question: 'MCP 是什么' }],
    stats: { hours: 24, rawCount: 30, bySource: { zcode: 10, codex: 20 } },
  }
  const nightly = buildLearnTrigger(collected)
  assert.match(nightly, /【学习整理 · \d{4}-\d{2}-\d{2}】/)
  assert.match(nightly, /候选 2 条（原始输入 30 条），学习收件箱 1 条/)
  assert.match(nightly, /workbench_learn_collect/)
  const manual = buildLearnTrigger(collected, { nightly: false })
  assert.match(manual, /^【学习整理】/)
})

test('runLearnNow：向目标会话推触发卡（sessionController mock）', async () => {
  const store = new Store(dir)
  const pushed = []
  const ctx = {
    sessionController: {
      resolveAgent: async (sessionId) => ({ agent: { session: { id: sessionId }, followup: (card) => pushed.push({ sessionId, card }) } }),
    },
    sessions: { flush: async () => {} },
  }
  const result = await runLearnNow(ctx, store, 'sess-target')
  assert.equal(result.sessionId, 'sess-target')
  assert.equal(pushed.length, 1)
  assert.equal(pushed[0].card.source.kind, 'cordis-host-runner') // 触发卡而非用户气泡
  assert.match(pushed[0].card.content[0].text, /学习整理/)
})

test('prestep：armed 会话下一条消息零成本入收件箱并自动解除', async () => {
  const store = new Store(dir)
  let handler = null
  const ctx = { on: (name, fn) => { handler = fn; return () => {} } }
  installLearnPrestep(ctx, store)

  const passthrough = await handler({ agent: { session: { id: 'sess-plain' } }, messages: [{ content: [{ type: 'text', text: '普通消息' }] }] }, () => 'passed')
  assert.equal(passthrough, 'passed') // 未武装：直接放行

  await store.mutate('武装', (draft) => applyOps(draft, [{ op: 'learn_arm', sessionId: 'sess-armed', on: true }]))
  const decision = await handler(
    { agent: { session: { id: 'sess-armed' } }, messages: [{ content: [{ type: 'text', text: '什么是乐观锁，和悲观锁的区别' }, { type: 'image', url: 'x' }] }] },
    () => 'passed',
  )
  assert.deepEqual(decision, { kind: 'reject' }) // 拦截：零模型调用
  const state = await store.read()
  assert.equal(state.learn.inbox.length, 1)
  assert.equal(state.learn.inbox[0].question, '什么是乐观锁，和悲观锁的区别')
  assert.equal(state.learn.inbox[0].source, 'command')
  assert.equal(state.learn.armed['sess-armed'], undefined) // 用完即解除

  // 同一会话下一条不再拦截
  const again = await handler({ agent: { session: { id: 'sess-armed' } }, messages: [{ content: [{ type: 'text', text: '下一条' }] }] }, () => 'passed2')
  assert.equal(again, 'passed2')
})

test('prestep：处理异常时放行原消息，绝不丢输入', async () => {
  const store = new Store(dir)
  let handler = null
  const ctx = { on: (name, fn) => { handler = fn; return () => {} } }
  installLearnPrestep(ctx, store)
  // 把 state 文件换成坏 JSON 触发读取失败 → next()
  const { writeFile } = await import('node:fs/promises')
  await writeFile(join(dir, 'state.json'), '{bad json', 'utf8')
  const decision = await handler({ agent: { session: { id: 'sess-armed' } }, messages: [{ content: [{ type: 'text', text: 'hi' }] }] }, () => 'fallback')
  assert.equal(decision, 'fallback')
})

test('指定整理模型：创建独立 DSH 会话，先选择模型再推送，不改全局默认', async () => {
  const { dispatchLearn } = await import('../src/learn/nightly.js')
  const { inject } = await import('../src/host.js')
  const selection = { provider: 'test-provider', model: 'glm-5.3' }
  const events = []
  const services = {
    sessionController: {
      modelCatalog: async () => ({ groups: [{ id: selection.provider, models: [{ id: selection.model }] }] }),
      create: async () => { events.push('create'); return { sessionId: 'learn-session' } },
      rename: async ({ sessionId, title }) => { assert.equal(sessionId, 'learn-session'); assert.match(title, /^学习整理 · /); events.push('rename') },
      resolveAgent: async (id) => {
        assert.equal(id, 'learn-session')
        return { agent: { session: { id }, model: { select: (model) => { assert.deepEqual(model, selection); events.push('select') } }, followup: () => events.push('followup') } }
      },
      selectModel: () => assert.fail('不得改全局默认模型'),
    },
    sessions: { flush: async () => events.push('flush') },
  }
  // 模拟 Cordis 的严格服务访问：缺少 inject 时重现用户的报错。
  const ctx = new Proxy(services, { get(target, key) {
    if (!inject.includes(key)) throw new Error(`cannot get property "${key}" without inject`)
    return target[key]
  } })
  const sessionId = await dispatchLearn(ctx, { learn: { config: { organizeModel: selection } } }, 'ordinary-chat', '整理')
  assert.equal(sessionId, 'learn-session')
  assert.deepEqual(events, ['create', 'rename', 'select', 'followup', 'flush'])
})

test('整理模型不可用时明确报错，不创建会话或偷偷换模型', async () => {
  const { dispatchLearn } = await import('../src/learn/nightly.js')
  const ctx = { sessionController: { modelCatalog: async () => ({ groups: [] }), create: () => assert.fail('不可创建') } }
  await assert.rejects(dispatchLearn(ctx, { learn: { config: { organizeModel: { provider: 'missing', model: 'glm-5.3' } } } }, null, '整理'), /整理模型不可用/)
})
