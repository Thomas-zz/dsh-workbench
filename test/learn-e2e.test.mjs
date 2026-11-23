// 学习模块端到端：用 mock ctx 注册真实工具，走 capture → collect → write → decide 全链路，
// vault 指向临时目录；测试前把扫描源全部关掉（collect 返回真实结构但不扫盘，保持测试封闭）。
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { organizationContext } from './helpers/organization-context.js'
import { runLearnNow } from '../src/learn/nightly.js'
import { Store } from '../src/store.js'
import { registerLearnTools } from '../src/learn/tools.js'

let vault
let tools

before(async () => {
  const home = await mkdtemp(join(tmpdir(), 'wb-e2e-home-'))
  vault = await mkdtemp(join(tmpdir(), 'wb-e2e-vault-'))
  await mkdir(join(vault, '.obsidian'))
  const store = new Store(join(home, 'workbench'))
  await store.mutate('测试设置：关闭全部扫描源', (draft) => {
    draft.learn.config.sources = { zcode: false, dsh: false, claude: false, codex: false }
  })
  const ctx = organizationContext(() => ({hold:true}))
  registerLearnTools(ctx, store, { learnVaultPath: vault })
  tools = Object.fromEntries(ctx.registered)
  tools.$ctx = ctx
  tools.$store = store
  tools.$home = home
})

after(async () => {
  await rm(tools.$home, { recursive: true, force: true })
  await rm(vault, { recursive: true, force: true })
})

test('e2e：capture → collect → write 写笔记与日报 → decide 回写 frontmatter', async () => {
  // 1. 对话内手动捕获
  const captured = await tools.workbench_learn_capture.execute({ question: 'MCP 的 Resource 和 Tool 有什么区别', context: '聊协议时问的' }, { agent: { session: { id: 'sess-chat' } } })
  assert.equal(captured.pending, 1)

  // 2. collect：结构完整，收件箱可见（源全关，候选为空——扫描链路由 learn-scan 覆盖）
  const {sessionId} = await runLearnNow(tools.$ctx, tools.$store)
  await tools.$ctx.idle()
  const exec = {agent: {session: {id:sessionId}}}
  const collected = await tools.workbench_learn_collect.execute({}, exec)
  assert.deepEqual(collected.sessions, [])
  assert.equal(collected.inbox.length, 1)
  assert.deepEqual(collected.progress.errors, [])
  const {batchId} = await tools.workbench_learn_read.execute({}, exec)

  // 3. write：带收件箱条目一并写入
  const written = await tools.workbench_learn_write.execute({
    batchId, items: [
      {
        title: 'MCP Resource vs Tool',
        question: 'MCP 的 Resource 和 Tool 有什么区别',
        category: 'weak',
        concept: 'MCP',
        answer: 'Resource 是模型可读的数据引用，Tool 是模型可调用的操作。',
        why: '设计 MCP 服务时选错形态会导致模型行为不符合预期。',
        source: { harness: 'chat', project: '', sessionId: 'sess-chat' },
        askedAt: new Date().toISOString(),
        inboxId: collected.inbox[0].id,
      },
    ],
  }, exec)
  assert.equal(written.progress.complete, true)
  assert.equal(written.ok, true)
  assert.equal(written.created.length, 1)
  assert.match(written.reportPath, /日报\/\d{4}-\d{2}-\d{2}\.md$/)

  // 笔记与日报都落盘了
  const note = await readFile(join(vault, written.created[0].notePath), 'utf8')
  assert.match(note, /category: "weak"/)
  assert.match(note, /## 核心/)
  const report = await readFile(join(vault, written.reportPath), 'utf8')
  assert.match(report, /# 学习日报/)

  // 收件箱被消化
  const afterWrite = await tools.$store.read()
  assert.equal(afterWrite.learn.inbox.length, 0)
  assert.equal(afterWrite.learn.entries[0].answer, 'Resource 是模型可读的数据引用，Tool 是模型可调用的操作。')
  assert.match(afterWrite.learn.entries[0].why, /选错形态/)
  assert.equal(afterWrite.learn.entries[0].vaultPath, vault)

  // 重复整理不应在 vault 中再生成同题笔记。
  const duplicate = await tools.workbench_learn_write.execute({ items: [{ title: 'MCP Resource vs Tool', question: 'MCP 的 Resource 和 Tool 有什么区别', category: 'weak', answer: 'Resource 提供数据，Tool 执行操作；两者用途不同。' }] })
  assert.equal(duplicate.ok, true)
  assert.equal(duplicate.skipped, 1)
  assert.deepEqual(duplicate.created, [])

  // 4. decide：标已掌握，frontmatter 回写
  const entryId = written.created[0].id
  const decided = await tools.workbench_learn_decide.execute({ idOrTitle: entryId, action: 'mastered' }, undefined)
  assert.equal(decided.ok, true)
  const noteAfter = await readFile(join(vault, written.created[0].notePath), 'utf8')
  assert.match(noteAfter, /mastered: true/)
})

test('e2e：write 传空 items 生成空日报', async () => {
  const result = await tools.workbench_learn_write.execute({ items: [] }, undefined)
  assert.equal(result.ok, true)
  assert.deepEqual(result.created, [])
  assert.match(result.reportPath, /日报/)
})

test('e2e：没有答案的学习条目被拒绝', async () => {
  const result = await tools.workbench_learn_write.execute({ items: [{ title: '没有答案', question: '什么是无答案条目', category: 'term', answer: '' }] })
  assert.equal(result.ok, false)
  assert.match(result.error, /可复习答案/)
})

test('整理批次只接受专用会话已读证据；重试不会冒充完整整理或重复写卡', async () => {
  const { prepareReview, bindReview } = await import('../src/learn/review.js')
  const store = tools.$store,
    state = await store.read(),
    binding = state.assistant.sessions.learn
  const question = '为什么分页的精确总数更慢？',
    answer = '取当前页只需找到足够多的行；精确总数要计算全部匹配行。'
  const messages = [
    {
      source: 'codex',
      sessionId: 'example',
      project: '/test',
      role: 'user',
      text: question,
      at: '2026-11-19T08:00:00.000Z',
    },
    {
      source: 'codex',
      sessionId: 'example',
      project: '/test',
      role: 'assistant',
      text: answer,
      at: '2026-11-19T08:00:01.000Z',
    },
  ]
  await store.mutate('启用隔离来源', (s) => {
    s.learn.config.sources.codex = true
  })
  const run = await prepareReview(
    await store.read(),
    { since: '2026-11-19T07:00:00Z', until: '2026-11-19T09:00:00Z' },
    async () => ({ messages, errors: [] }),
  )
  await store.mutate('固定测试窗口', (s) => {
    s.learn.review = run.review
  })
  bindReview(store, run, binding.requestId)
  const exec = { agent: { session: { id: binding.sessionId } } }
  await assert.rejects(
    tools.workbench_learn_read.execute({}, { agent: { session: { id: 'other' } } }),
    /专用学习对话/,
  )
  assert.equal((await tools.workbench_learn_write.execute({ items: [] }, exec)).ok, false)
  const page = await tools.workbench_learn_read.execute({}, exec),
    write = (items) => tools.workbench_learn_write.execute({ items, batchId: page.batchId }, exec)
  const item = {
    title: '分页与计数',
    question,
    answer,
    category: 'know',
    kind: 'question',
    evidence: question,
    messageKey: page.messages[0].key,
  }
  assert.match((await write([{ ...item, evidence: '没说过的原话' }])).error, /摘录/)
  assert.match(
    (await write([{ ...item, messageKey: page.messages[1].key, evidence: answer }])).error,
    /助手发言/,
  )
  assert.equal((await store.read()).learn.review.revision, 0)
  const saved = await write([item])
  assert.equal(saved.progress.complete, true)
  assert.equal(saved.progress.questions, 1)
  assert.equal(saved.created[0].source.messageKey, page.messages[0].key)
  assert.match(await readFile(saved.reportAbsolutePath, 'utf8'), /已整理 1\/1/)
  assert.equal((await write([item])).ok, false)
})


test('关闭的专用对话可在重启后直接整理昨天：收到正文才可空交，失败重试、旧进度和普通对话隔离', async (t) => {
  const { learningScope } = await import('../src/learn/review.js')
  const root = await mkdtemp(join(tmpdir(), 'wb-manual-review-'))
  const previousHome = process.env.HOME
  process.env.HOME = root
  t.after(async () => {
    if (previousHome === undefined) delete process.env.HOME
    else process.env.HOME = previousHome
    await rm(root, { recursive: true, force: true })
  })
  const ctx = organizationContext()
  const stateDir = join(root, 'state'), vaultPath = join(root, 'vault')
  await mkdir(join(vaultPath, '.obsidian'), { recursive: true })
  const store = new Store(stateDir)
  const scope = learningScope(await store.read(), { date: '昨天' })
  const records = [{ type: 'session_meta', payload: { id: 'alpha', cwd: '/projects/demo' } }]
  function message(text, at, role = 'user', channel = 'final') {
    records.push({ type: 'response_item', timestamp: at, payload: {
      type: 'message', channel, role, content: [{ type: role === 'user' ? 'input_text' : 'output_text', text }],
    } })
  }
  message('打开预览', scope.since)
  message('已打开预览', scope.since, 'assistant')
  message('不交付思考', scope.since, 'assistant', 'analysis')
  message('不交付边界以外的请求', scope.until)
  const logDir = join(root, '.codex', 'sessions')
  await mkdir(logDir, { recursive: true })
  await writeFile(join(logDir, 'rollout-alpha.jsonl'), records.map((row) => JSON.stringify(row)).join('\n'))
  await store.mutate('限定测试范围', (s) => {
    s.learn.config.sources = { codex: true, claude: false, zcode: false, dsh: false }
    s.learn.flags.lastCollectAt = scope.since
  })
  registerLearnTools(ctx, store, { learnVaultPath: vaultPath })
  const ordinary = await ctx.registered.get('workbench_learn_collect').execute({ start: true }, { agent: { session: { id: '普通会话' } } })
  assert.doesNotMatch(JSON.stringify(ordinary), /打开预览/)
  await ctx.idle()
  const first = await store.read(), binding = first.assistant.sessions.learn
  assert.equal(binding.status, 'error', '派发回合未提交，不能声称完成')
  const prompt = ctx.cards[0].card.content[0].text
  assert.match(prompt, /打开预览/)
  assert.doesNotMatch(prompt, /不交付思考/)
  const initialId = first.learn.review.id
  const restarted = new Store(stateDir)
  registerLearnTools(ctx, restarted, { learnVaultPath: vaultPath })
  const exec = { agent: { session: { id: binding.sessionId } } }
  const readVisible = async (name, args) => {
    const tool = ctx.registered.get(`workbench_learn_${name}`)
    const value = await tool.execute(args, exec)
    // DSH validates lossless JSON *before* invoking output.render; JSON.stringify alone hides undefined.
    assert.deepEqual(JSON.parse(JSON.stringify(value)), value)
    return JSON.parse(tool.output.render(args, value)[0].text)
  }
  const startArgs = { start: true, date: 'yesterday', project: 'demo' }
  const material = await readVisible('collect', startArgs)
  assert.equal(ctx.cards.length, 1, '专用对话不向自己二次派发')
  assert.deepEqual(material.page.messages.map((row) => row.text), ['打开预览', '已打开预览'])
  assert.equal(material.scope.since, scope.since)
  assert.equal(material.scope.until, scope.until)
  const write = (args) => ctx.registered.get('workbench_learn_write').execute(args, exec)
  // 重现已生成 read 结果、但宿主没有成功交付的时序。弱回执不得清空进度。
  await ctx.registered.get('workbench_learn_read').execute({}, exec)
  const empty = { batchId: material.page.batchId, items: [] }
  assert.equal((await write(empty)).ok, false)
  assert.equal((await write({ ...empty, noLearning: { reason: '未收到正文', quote: '完全没有的原话' } })).ok, false)
  assert.equal((await restarted.read()).learn.review.revision, 0)
  const replay = await readVisible('read', {})
  assert.deepEqual(replay, material.page)
  const saved = await write({ ...empty, noLearning: { reason: '只有打开预览的操作与确认', quote: '打开预览' } })
  assert.equal(saved.progress.complete, true)
  assert.match(await readFile(saved.reportAbsolutePath, 'utf8'), /只有打开预览的操作与确认/)
  assert.equal((await restarted.read()).learn.flags.lastCollectAt, scope.since)
  const again = await readVisible('collect', startArgs)
  assert.notEqual(again.page.batchId, replay.batchId)
  assert.equal((await write(empty)).ok, false)
  assert.equal((await write({ batchId: again.page.batchId, items: [], noLearning: { reason: '操作确认', quote: '已打开预览' } })).ok, true)
  await readVisible('collect', { start: true })
  assert.equal((await restarted.read()).learn.review.id, initialId, '已完成手动重扫仍可续原范围')
})
