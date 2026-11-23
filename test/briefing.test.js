import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildBriefing, resolveBriefingTarget } from '../src/briefing.js'
import { applyOps, migrateState } from '../src/ops.js'

const NOW = new Date('2026-11-09T09:00:00+08:00') // 周一；昨天本地 = 2026-11-08

test('buildBriefing：昨日完成/到期逾期/进行中执行者/受阻/待验收/灵感都进入文本', () => {
  const draft = migrateState({})
  applyOps(draft, [
    { op: 'add_task', title: '整理 pitch 分享内容', status: 'doing' },
    { op: 'add_task', title: '交周报', due: '2026-11-08' },
    { op: 'add_task', title: '订会议室', due: '2026-11-09' },
    { op: 'add_task', title: '等外部接口', status: 'blocked' },
    { op: 'add_task', title: '昨天的活', status: 'done' },
    { op: 'add_review', kind: 'subagent', title: '数据抓取完成', dedupeKey: 'subagent:b1' },
    { op: 'capture_idea', text: '给工作台加个统计页' },
  ])
  applyOps(draft, [{ op: 'update_task', id: draft.tasks.find((row) => row.title === '整理 pitch 分享内容').id, progress: '大纲完成', progressSession: 'session-a' }])
  draft.tasks.find((row) => row.title === '昨天的活').completedAt = '2026-11-08T20:00:00+08:00'
  const briefing = buildBriefing(draft, NOW)
  assert.equal(briefing.date, '2026-11-09')
  assert.equal(briefing.weekday, '周一')
  assert.equal(briefing.empty, false)
  assert.ok(briefing.text.includes('【工作台晨报 · 11月09日 周一】'))
  assert.ok(briefing.text.includes('昨日完成 1 件：昨天的活'))
  assert.ok(briefing.text.includes('今日到期 2 件（其中逾期 1）'))
  assert.ok(briefing.text.includes('交周报（逾期）'))
  assert.ok(briefing.text.includes('进行中 1 件：整理 pitch 分享内容（1 位执行者）'))
  assert.ok(briefing.text.includes('受阻 1 件：等外部接口'))
  assert.ok(briefing.text.includes('待验收 1 条'))
  assert.ok(briefing.text.includes('灵感池 1 条'))
  assert.ok(briefing.text.includes('不要展开长篇'))
})

test('buildBriefing：空日子输出一句话', () => {
  const briefing = buildBriefing(migrateState({}), NOW)
  assert.equal(briefing.empty, true)
  assert.ok(briefing.text.includes('今天没有到期与进行中事项'))
})

test('resolveBriefingTarget：显式配置优先，自动取最近活跃会话，没有则 null', () => {
  const draft = migrateState({})
  assert.equal(resolveBriefingTarget({ briefingSessionId: 'session-fixed' }, draft), 'session-fixed')

  applyOps(draft, [
    { op: 'add_task', title: 'A', status: 'doing', origin: { kind: 'chat', sessionId: 'session-old' } },
    { op: 'add_task', title: 'B', status: 'doing' },
  ])
  applyOps(draft, [{ op: 'update_task', id: draft.tasks.find((row) => row.title === 'B').id, progress: '接手', progressSession: 'session-new' }])
  assert.equal(resolveBriefingTarget({}, draft), 'session-new')

  applyOps(draft, [{ op: 'add_review', kind: 'job', title: '刚结束的跑批', sessionId: 'session-job', dedupeKey: 'job:late' }])
  // 把任务侧时间戳统一压到过去，让待验收的 createdAt 成为最近活跃
  const PAST = '2026-11-08T00:00:00.000Z'
  for (const row of draft.tasks) {
    row.updatedAt = PAST
    for (const entry of row.progress ?? []) entry.at = PAST
  }
  draft.reviews.find((row) => row.sessionId === 'session-job').createdAt = new Date(NOW.getTime() + 60_000).toISOString()
  assert.equal(resolveBriefingTarget({}, draft), 'session-job')

  // 完成的任务不参与；清空后应返回 null
  for (const row of draft.tasks) applyOps(draft, [{ op: 'update_task', id: row.id, status: 'done' }])
  draft.reviews.find((row) => row.sessionId === 'session-job').status = 'accepted'
  assert.equal(resolveBriefingTarget({}, draft), null)
})
