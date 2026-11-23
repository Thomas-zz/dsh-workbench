import { test } from 'node:test'
import assert from 'node:assert/strict'
import { migrateState } from '../src/ops.js'
import {
  prepareReview,
  readReviewPage,
  acknowledgeReview,
  deliveredMessage,
  learningScope,
} from '../src/learn/review.js'

const since = '2026-11-18T14:00:00.000Z',
  until = '2026-11-19T14:00:00.000Z'
const row = (text, overrides = {}) => ({
  source: 'codex',
  project: '/demo',
  sessionId: 'one',
  at: since,
  role: 'user',
  text,
  ...overrides,
})

test('学习阅读边界、跨页引用、重启续读及失败来源补读；读取或重复提交不能越过检查点', async () => {
  let state = migrateState(null)
  state.assistant.sessions.learn = { sessionId: 'session-self' }
  const questions = [
    row('为什么查总数这么慢，你怎么优化的'),
    row('A'.repeat(16000), { role: 'assistant' }),
    row('是你误解了我的问题'),
  ]
  let broken = true
  const scan = async (opts) => {
    assert.equal(opts.includeAssistant, true)
    assert.equal(opts.strict, true)
    return {
      messages: [
        ...questions,
        questions[0],
        row('范围外', { at: until }),
        row('另一项目', { project: '/other' }),
        row('思考', { role: 'reasoning' }),
        row('整理会话', { source: 'dsh', sessionId: 'self' }),
        ...(!broken ? [row('另一个来源', { source: 'zcode', sessionId: 'two' })] : []),
      ],
      errors: broken ? [{ source: 'zcode', error: '暂时不可读' }] : [],
    }
  }
  let run = await prepareReview(state, { since, until, project: '/demo' }, scan)
  state.learn.review = run.review
  let page = readReviewPage(state.learn.review, run)
  assert.equal(run.rows.size, 3)
  assert.deepEqual(
    page.messages.map((m) => m.text),
    [questions[0].text],
  )
  assert.equal(readReviewPage(state.learn.review, run).batchId, page.batchId)
  assert.throws(
    () => deliveredMessage(state.learn.review, run, state.learn.review.sessions[0].keys[1]),
    /已.*读/,
  )
  assert.throws(() => acknowledgeReview(state, run, 'stale', []))
  assert.equal(state.learn.review.sessions[0].index, 0)
  acknowledgeReview(state, run, page.batchId, [])
  assert.throws(() => acknowledgeReview(state, run, page.batchId, []))
  page = readReviewPage(state.learn.review, run)
  assert.equal(page.messages[0].continued, true)
  const first = page.messages[0]
  assert.equal(deliveredMessage(state.learn.review, run, first.key).text, first.text)
  acknowledgeReview(state, run, page.batchId, [])
  state = migrateState(structuredClone(state))
  run = await prepareReview(state, {}, scan)
  state.learn.review = run.review
  page = readReviewPage(state.learn.review, run)
  assert.equal(page.messages[0].offset, first.text.length)
  assert.equal(first.text + page.messages[0].text, questions[1].text)
  const partial = acknowledgeReview(state, run, page.batchId, [{ kind: 'question' }])
  assert.equal(partial.reviewed, 1)
  assert.equal(partial.complete, false)
  assert.equal(state.learn.flags.lastCollectAt, '')
  assert.match(readReviewPage(state.learn.review, run).paused, /失败/)
  broken = false
  run = await prepareReview(state, {}, scan)
  state.learn.review = run.review
  page = readReviewPage(state.learn.review, run)
  assert.deepEqual(
    page.messages.map((m) => m.text),
    ['另一个来源'],
  )
  const receipt = acknowledgeReview(state, run, page.batchId, [])
  assert.equal(receipt.complete, true)
  assert.equal(receipt.reviewed, 2)
  assert.equal(receipt.questions, 1)
  assert.equal(state.learn.flags.lastCollectAt, '', '单独补看不能推进日常整理水位')
})

test('长范围按会话自主读取；超过八页也可继续，未写不计完成，中断只重读未提交部分', async () => {
  let state = migrateState(null)
  const messages = Array.from({ length: 10 }, (_, i) =>
    row(`${i}`.padEnd(14000, 'A'), { at: new Date(Date.now() - 60000).toISOString(), sessionId: `s${i}` }),
  )
  const scan = async () => ({ messages, errors: [] })
  let run = await prepareReview(state, {}, scan)
  state.learn.review = run.review
  for (let i = 0; i < 8; i++) {
    const p = readReviewPage(state.learn.review, run)
    acknowledgeReview(state, run, p.batchId, [])
  }
  const paused = readReviewPage(state.learn.review, run)
  assert.equal(paused.progress.remaining, 2)
  assert.equal(paused.messages[0].sessionId, 's8')
  assert.equal(state.learn.flags.lastCollectAt, '')
  run = await prepareReview(state, {}, scan)
  state.learn.review = run.review
  const unconfirmed = readReviewPage(state.learn.review, run)
  run = await prepareReview(state, {}, scan)
  state.learn.review = run.review
  const replay = readReviewPage(state.learn.review, run)
  assert.deepEqual(unconfirmed.messages, replay.messages)
  const last = readReviewPage(state.learn.review, run, { afterBatchId: replay.batchId, sessionId: 's9' })
  assert.deepEqual(last.messages.map((r) => r.sessionId), ['s9'])
  assert.equal(last.hasMore, false)
  assert.deepEqual(readReviewPage(state.learn.review, run, { afterBatchId: replay.batchId }), last)
  assert.equal(deliveredMessage(state.learn.review, run, replay.messages[0].key).text, replay.messages[0].text)
  assert.throws(() => acknowledgeReview(state, run, replay.batchId, []))
  assert.equal(last.progress.remaining, 2)
  acknowledgeReview(state, run, last.batchId, [])
  assert.equal(state.learn.flags.lastCollectAt, run.review.scope.until)
  assert.equal(
    learningScope(state, {}, Date.parse(run.review.scope.until) + 10000).since,
    run.review.scope.until,
  )
})
