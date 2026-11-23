import { organizationContext } from './helpers/organization-context.js'
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

test('buildLearnTrigger：展示覆盖范围，而非规则候选数', () => {
  const review = { scope: {sources:['codex'],since:'2026-11-18T16:00:00Z',until:'2026-11-19T16:00:00Z'}, sessions:[{keys:['a'],index:1},{keys:['b','c'],index:1}], errors:[], questions:1, suggested:0, complete:false }
  const nightly = buildLearnTrigger(review, {inbox:1})
  assert.match(nightly, /【学习整理 · \d{4}-\d{2}-\d{2}】/)
  assert.match(nightly, /已整理 1\/2 个会话，未读完 1 个/)
  assert.match(nightly, /workbench_learn_read/)
  assert.doesNotMatch(nightly, /候选预览/)
  assert.match(buildLearnTrigger(review, {nightly:false}), /^【学习整理】/)
})

test('runLearnNow：创建专用对话并复用，不进入普通对话', async () => {
  const store = new Store(dir)
  await store.mutate('隔离来源', s => { s.learn.config.sources = {dsh:false,codex:false,claude:false,zcode:false} })
  const ctx = organizationContext()
  const result = await runLearnNow(ctx, store)
  await ctx.idle()
  const second = await runLearnNow(ctx, store)
  await ctx.idle()
  assert.equal(result.sessionId, second.sessionId)
  assert.equal(ctx.created.length, 1)
  assert.equal(ctx.cards.length, 2)
  assert.equal(ctx.cards[0].card.source.kind, 'cordis-host-runner')
  assert.equal((await store.read()).assistant.sessions.learn.sessionId, result.sessionId)
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

test('整理模型不可用时明确报错，不创建或偷偷换模型', async () => {
  const { dispatchLearn } = await import('../src/learn/nightly.js')
  const root = await mkdtemp(join(tmpdir(), 'wb-model-'))
  try {
    const store = new Store(root)
    const ctx = organizationContext()
    ctx.sessionController.modelCatalog = async () => ({ groups: [] })
    await assert.rejects(dispatchLearn(ctx, store, '整理'), /整理模型不可用/)
    assert.equal(ctx.created.length, 0)
  } finally { await rm(root, {recursive:true, force:true}) }
})
