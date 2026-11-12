// 学习模块端到端：用 mock ctx 注册真实工具，走 capture → collect → write → decide 全链路，
// vault 指向临时目录；测试前把扫描源全部关掉（collect 返回真实结构但不扫盘，保持测试封闭）。
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
  const defs = []
  const ctx = { tools: { register: (def) => { defs.push(def); return () => {} } } }
  registerLearnTools(ctx, store, { learnVaultPath: vault })
  tools = Object.fromEntries(defs.map((def) => [def.name, def]))
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
  const collected = await tools.workbench_learn_collect.execute({}, undefined)
  assert.deepEqual(collected.candidates, [])
  assert.equal(collected.inbox.length, 1)
  assert.ok(collected.stats.bySource)

  // 3. write：带收件箱条目一并写入
  const written = await tools.workbench_learn_write.execute({
    items: [
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
  }, undefined)
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
