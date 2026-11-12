// 学习模块 ops 测试：捕获、整理落库、处置、配置、占标记、视图聚合与保留清理。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { migrateState, applyOps, learnView, cleanup } from '../src/ops.js'

function draft() {
  return migrateState({})
}

function ops(state, list) {
  const result = applyOps(state, list)
  assert.deepEqual(result.errors, [])
  return result
}

test('learn_capture：进收件箱并计数', () => {
  const state = draft()
  const { receipts } = ops(state, [{ op: 'learn_capture', question: '什么是SDK', context: '聊数据库时问的', sessionId: 's1', source: 'chat' }])
  assert.match(receipts[0].text, /已记录学习提问/)
  assert.equal(state.learn.inbox.length, 1)
  assert.equal(state.learn.inbox[0].sessionId, 's1')
})

test('learn_write：按 key 去重，consumeInboxIds 消化收件箱', () => {
  const state = draft()
  ops(state, [{ op: 'learn_capture', question: '什么是SDK', sessionId: 's1' }])
  const inboxId = state.learn.inbox[0].id
  const first = ops(state, [{
    op: 'learn_write',
    items: [{ question: '什么是SDK', title: 'SDK 是什么', category: 'term', concept: 'SDK', note: '一句话答案', key: 'sdk-key', notePath: 'AI/Agent学习/2026-11-10-sdk.md', source: { harness: 'zcode', project: '/x', sessionId: 's1' }, askedAt: '2026-11-10T01:00:00.000Z' }],
    consumeInboxIds: [inboxId],
  }])
  const firstResult = first.results[0]
  assert.equal(firstResult.created.length, 1)
  assert.equal(firstResult.consumed, 1)
  assert.equal(state.learn.inbox.length, 0)
  assert.equal(state.learn.entries[0].category, 'term')
  // 同 key 再写：跳过
  const second = ops(state, [{
    op: 'learn_write',
    items: [{ question: '什么是SDK？', title: 'SDK 是什么', category: 'term', key: 'sdk-key' }],
  }])
  assert.equal(second.results[0].skipped, 1)
  assert.equal(state.learn.entries.length, 1)
})

test('learn_write：非法入参报错', () => {
  const state = draft()
  const result = applyOps(state, [{ op: 'learn_write', items: [] }])
  assert.match(result.errors[0], /items 不能为空/)
})

test('learn_decide：已掌握/忽略/重新打开', () => {
  const state = draft()
  ops(state, [{ op: 'learn_write', items: [{ question: '什么是网关', title: '网关', key: 'gw' }] }])
  const id = state.learn.entries[0].id
  ops(state, [{ op: 'learn_decide', id, action: 'mastered' }])
  assert.equal(state.learn.entries[0].status, 'mastered')
  ops(state, [{ op: 'learn_decide', id, action: 'reopen' }])
  assert.equal(state.learn.entries[0].status, 'recorded')
  ops(state, [{ op: 'learn_decide', id, action: 'reviewed' }])
  assert.equal(state.learn.entries[0].reviewIntervalDays, 2)
  assert.ok(Date.parse(state.learn.entries[0].nextReviewAt) > Date.now())
  assert.equal(learnView(state).counts.dueReview, 0)
  const bad = applyOps(state, [{ op: 'learn_decide', id, action: 'what' }])
  assert.match(bad.errors[0], /action/)
  assert.match(applyOps(state, [{ op: 'learn_decide', id: 'nope', action: 'mastered' }]).errors[0], /不存在/)
})

test('learn_drop_inbox：丢弃待整理条目', () => {
  const state = draft()
  ops(state, [{ op: 'learn_capture', question: '随手记的问题' }])
  const id = state.learn.inbox[0].id
  ops(state, [{ op: 'learn_drop_inbox', id }])
  assert.equal(state.learn.inbox.length, 0)
})

test('learn_config：逐项修改与校验', () => {
  const state = draft()
  assert.equal(state.learn.config.reportHour, 22)
  assert.equal(state.learn.config.notesDir, 'AI/Agent学习')
  ops(state, [{ op: 'learn_config', patch: { reportHour: 23, notesDir: 'AI/学习', sources: { codex: false }, reportSessionId: 'sess_x' } }])
  assert.equal(state.learn.config.reportHour, 23)
  assert.equal(state.learn.config.notesDir, 'AI/学习')
  assert.equal(state.learn.config.sources.codex, false)
  assert.equal(state.learn.config.sources.zcode, true)
  assert.equal(state.learn.config.reportSessionId, 'sess_x')
  ops(state, [{ op: 'learn_config', patch: { vaultPath: '/Users/x/My Vault' } }])
  assert.equal(state.learn.config.vaultPath, '/Users/x/My Vault')
  assert.match(applyOps(state, [{ op: 'learn_config', patch: { vaultPath: 'relative/vault' } }]).errors[0], /vaultPath/)
  assert.match(applyOps(state, [{ op: 'learn_config', patch: { notesDir: '../outside' } }]).errors[0], /notesDir/)
  assert.match(applyOps(state, [{ op: 'learn_config', patch: { reportHour: 24 } }]).errors[0], /reportHour/)
  assert.match(applyOps(state, [{ op: 'learn_config', patch: { notesDir: '' } }]).errors[0], /notesDir/)
})

test('learn_flag_report：占标记只赢一次', () => {
  const state = draft()
  const first = applyOps(state, [{ op: 'learn_flag_report', date: '2026-11-10' }])
  assert.equal(first.results[0].won, true) // 首次占标记成功且不产生回执
  assert.deepEqual(first.receipts, [])
  assert.equal(state.learn.flags.lastLearnReportDate, '2026-11-10')
  const second = applyOps(state, [{ op: 'learn_flag_report', date: '2026-11-10' }])
  assert.equal(second.results[0].won, false) // 同日再占不赢（跨进程防重发）
})

test('learnView：概念聚合与 urgent 标记', () => {
  const state = draft()
  ops(state, [
    { op: 'learn_write', items: [
      { question: 'MCP 是什么', title: 'MCP', category: 'term', concept: 'MCP', key: 'k1' },
      { question: 'MCP 的 Resource 是啥', title: 'MCP Resource', category: 'weak', concept: 'MCP', key: 'k2' },
      { question: '什么是幂等', title: '幂等性', category: 'know', concept: '幂等', key: 'k3' },
    ] },
  ])
  const view = learnView(state)
  assert.equal(view.counts.term, 1)
  assert.equal(view.counts.weak, 1)
  assert.equal(view.concepts[0].concept, 'MCP')
  assert.equal(view.concepts[0].count, 2)
  assert.equal(view.concepts[0].urgent, true)
  assert.equal(view.concepts[1].urgent, false)
})

test('cleanup：知识卡长期保留，过往提问与已掌握内容不丢失', () => {
  const state = draft()
  ops(state, [{ op: 'learn_write', items: [
    // 70 天前记录的 recorded
    { question: '近期问题A', title: 'A', key: 'keep-a', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
    // 320 天前记录的 recorded 也保留
    { question: '远期问题C', title: 'C', key: 'drop-c', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    // 30 天前处置的也保留
    { question: '已掌握问题B', title: 'B', key: 'drop-b', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  ] }])
  const mastered = state.learn.entries.find((row) => row.key === 'drop-b')
  ops(state, [{ op: 'learn_decide', id: mastered.id, action: 'mastered' }])
  mastered.updatedAt = '2026-09-05T00:00:00.000Z'
  cleanup(state)
  const keys = state.learn.entries.map((row) => row.key)
  assert.ok(keys.includes('keep-a'))
  assert.ok(keys.includes('drop-c'))
  assert.ok(keys.includes('drop-b'))
})

test('整理模型设置可持久化、清空，拒绝缺失 provider 的模型', () => {
  const state = draft()
  assert.equal(state.learn.config.organizeModel, null)
  const selection = { provider: 'provider', model: 'glm-5.3' }
  ops(state, [{ op: 'learn_config', patch: { organizeModel: selection } }])
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))).learn.config.organizeModel, selection)
  const invalid = applyOps(state, [{ op: 'learn_config', patch: { organizeModel: { model: 'glm-5.3' } } }])
  assert.equal(invalid.errors.length, 1)
  assert.deepEqual(state.learn.config.organizeModel, selection)
  ops(state, [{ op: 'learn_config', patch: { organizeModel: null } }])
  assert.equal(state.learn.config.organizeModel, null)
})
