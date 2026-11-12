// 学习扫描器测试：heuristic 纯函数 + 四源适配器（fixture 目录）。
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import zlib from 'node:zlib'
import { DatabaseSync } from 'node:sqlite'

import { isLikelyQuestion, dedupeKey, extractCandidates } from '../src/learn/scan/heuristic.js'
import { splitZstdFrames, decodeZstdFile } from '../src/learn/scan/zstd.js'
import { scanZcode } from '../src/learn/scan/zcode.js'
import { scanClaude } from '../src/learn/scan/claude.js'
import { scanCodex } from '../src/learn/scan/codex.js'
import { scanDsh, decodeProjectDir } from '../src/learn/scan/dsh.js'
import { scanRaw } from '../src/learn/scan/index.js'

const HOUR = 3_600_000
let root

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'wb-learn-'))
})

after(async () => {
  await rm(root, { recursive: true, force: true })
})

// ---------- heuristic ----------

test('heuristic：问号与疑问词识别，命令/JSON/环境注入被排除', () => {
  assert.equal(isLikelyQuestion('什么是sdk，数据库的sdk是啥'), true)
  assert.equal(isLikelyQuestion('npm run hot:fat还是不行啊，是node版本问题吗'), false)
  assert.equal(isLikelyQuestion('为什么跨域请求会被浏览器拦截'), true)
  assert.equal(isLikelyQuestion('32和33为什么还是进行中'), false)
  assert.equal(isLikelyQuestion('不能挂在左上角吗，你自己不能测试看看吗'), false)
  assert.equal(isLikelyQuestion('你给画个图，现在的调用关系是怎样的'), false)
  assert.equal(isLikelyQuestion('提交到sit'), false)
  assert.equal(isLikelyQuestion('/闲时任务'), false)
  assert.equal(isLikelyQuestion('{"a":1,"b":[2,3]}'), false)
  assert.equal(isLikelyQuestion('# AGENTS.md instructions for /x\n<INSTRUCTIONS>'), false)
  assert.equal(isLikelyQuestion('短句'), false)
  assert.equal(isLikelyQuestion('x'.repeat(301) + '？'), false)
})

test('heuristic：dedupeKey 忽略标点与大小写，extractCandidates 去重排序', () => {
  assert.equal(dedupeKey('什么是 SDK？'), dedupeKey('什么是sdk'))
  const messages = [
    { source: 'zcode', text: '什么是sdk？', at: '2026-11-10T01:00:00.000Z' },
    { source: 'claude', text: '什么是sdk！！', at: '2026-11-10T02:00:00.000Z' },
    { source: 'zcode', text: '为什么要有网关', at: '2026-11-10T03:00:00.000Z' },
    { source: 'zcode', text: '修一下登录bug', at: '2026-11-10T04:00:00.000Z' },
  ]
  const candidates = extractCandidates(messages, { excludeKeys: new Set([dedupeKey('为什么要有网关')]) })
  assert.equal(candidates.length, 1)
  assert.match(candidates[0].text, /sdk/)
})

// ---------- zstd 帧切分 ----------

test('zstd：多帧容器逐帧解压，与压缩前一致', async () => {
  const part1 = zlib.zstdCompressSync(Buffer.from('第一帧内容\n', 'utf8'))
  const part2 = zlib.zstdCompressSync(Buffer.from('第二帧内容\n', 'utf8'))
  const container = Buffer.concat([part1, part2])
  assert.deepEqual(splitZstdFrames(container).map((frame) => frame.end - frame.start), [part1.length, part2.length])
  const file = join(root, 'multi.zst')
  await writeFile(file, container)
  assert.equal(decodeZstdFile(file), '第一帧内容\n第二帧内容\n')
})

// ---------- zcode ----------

test('zcode：按窗口取 prompt 并带出项目目录', async () => {
  const home = join(root, 'zcode')
  await mkdir(join(home, 'cli', 'db'), { recursive: true })
  const db = new DatabaseSync(join(home, 'cli', 'db', 'db.sqlite'))
  db.exec('CREATE TABLE session (id text primary key, directory text not null)')
  db.exec(`CREATE TABLE input_history (id text primary key, project_id text not null, session_id text,
    text text not null, kind text not null, time_created integer not null)`)
  const now = Date.now()
  const insert = db.prepare('INSERT INTO input_history VALUES (?, ?, ?, ?, ?, ?)')
  insert.run('1', 'p', 'sess_a', '什么是 sdk', 'prompt', now - HOUR)
  insert.run('2', 'p', 'sess_a', '继续上面的任务', 'prompt', now - 2 * HOUR)
  insert.run('3', 'p', 'sess_a', '太老的提问', 'prompt', now - 48 * HOUR)
  insert.run('4', 'p', 'sess_a', '工具自动补全的候选项', 'completion', now - HOUR)
  db.prepare('INSERT INTO session VALUES (?, ?)').run('sess_a', '/Users/x/proj')
  db.close()
  const rows = await scanZcode({ sinceMs: now - 6 * HOUR, home })
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map((row) => row.text).sort(), ['什么是 sdk', '继续上面的任务'])
  assert.equal(rows[0].project, '/Users/x/proj')
  assert.equal(rows[0].source, 'zcode')
})

// ---------- claude ----------

test('claude：history.jsonl 过滤窗口并展开粘贴内容', async () => {
  const home = join(root, 'claude')
  await mkdir(home, { recursive: true })
  const now = Date.now()
  const lines = [
    JSON.stringify({ display: '为什么会报错 EPERM', timestamp: now - HOUR, project: '/Users/x/a', sessionId: 's1' }),
    JSON.stringify({ display: '看下这段[Pasted text #1 +6 lines]', pastedContents: { 1: { type: 'text', content: 'line1\nline2' } }, timestamp: now - HOUR, project: '/Users/x/a', sessionId: 's1' }),
    JSON.stringify({ display: '太老的', timestamp: now - 48 * HOUR, project: '/Users/x/a', sessionId: 's1' }),
    '不是 json',
  ]
  await writeFile(join(home, 'history.jsonl'), lines.join('\n') + '\n')
  const rows = await scanClaude({ sinceMs: now - 6 * HOUR, home })
  assert.equal(rows.length, 2)
  assert.match(rows[1].text, /line1 line2/)
  assert.equal(rows[0].sessionId, 's1')
})

// ---------- codex ----------

test('codex：rollout 提取用户输入，跳过 AGENTS 注入与窗口外记录', async () => {
  const home = join(root, 'codex')
  const day = join(home, 'sessions', '2026', '11', '10')
  await mkdir(day, { recursive: true })
  const now = Date.now()
  const records = [
    { timestamp: new Date(now - HOUR).toISOString(), type: 'session_meta', payload: { session_id: 'cx1', cwd: '/Users/x/cx' } },
    { timestamp: new Date(now - HOUR).toISOString(), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '# AGENTS.md instructions for /x\n<INSTRUCTIONS>...' }] } },
    { timestamp: new Date(now - HOUR).toISOString(), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'MCP 协议里的 Resource 到底是什么意思' }] } },
    { timestamp: new Date(now - HOUR).toISOString(), type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '回答……' }] } },
    { timestamp: new Date(now - 48 * HOUR).toISOString(), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '很早的问题' }] } },
  ]
  await writeFile(join(day, 'rollout-2026-11-10T09-00-00-cx1.jsonl'), records.map((row) => JSON.stringify(row)).join('\n') + '\n')
  // 归档：同一内容压成 .zst
  const archiveDir = join(home, 'archived_sessions')
  await mkdir(archiveDir, { recursive: true })
  const plain = records.map((row) => JSON.stringify(row)).join('\n') + '\n'
  await writeFile(join(archiveDir, 'rollout-old-cx1.jsonl.zst'), zlib.zstdCompressSync(Buffer.from(plain)))
  const rows = await scanCodex({ sinceMs: now - 6 * HOUR, home })
  assert.equal(rows.length, 2) // 当天明文 1 条 + 归档解压出同 1 条
  assert.match(rows[0].text, /Resource/)
  assert.equal(rows[0].project, '/Users/x/cx')
  assert.equal(rows[0].source, 'codex')
})

// ---------- dsh ----------

test('dsh：解压会话取真人 user/message，触发卡与窗口外排除', async () => {
  const home = join(root, 'dsh')
  const projectDir = join(home, 'sessions', '--Users-x-Documents-zzy-Fighting~0020for~0020Wealth--')
  const sessionDir = join(projectDir, 'session-abc123')
  await mkdir(sessionDir, { recursive: true })
  const now = Date.now()
  const events = [
    { type: 'session', version: 4, id: 'session-abc123', createdAt: now, cwd: '/Users/x/Documents/zzy/Fighting for Wealth' },
    { type: 'user/message', seq: 2, time: now - HOUR, surfaceOp: 'append', data: { role: 'user', content: [{ type: 'text', text: '为什么跨域请求会被浏览器拦截' }], source: { kind: 'user' } } },
    { type: 'user/message', seq: 3, time: now - HOUR, surfaceOp: 'append', data: { role: 'user', content: [{ type: 'text', text: '闲时任务正文（插件推的）' }], source: { kind: 'cordis-host-runner' } } },
    { type: 'user/message', seq: 4, time: now - 48 * HOUR, surfaceOp: 'append', data: { role: 'user', content: [{ type: 'text', text: '很早的提问' }], source: { kind: 'user' } } },
    { type: 'assistant/message', seq: 5, data: { content: [] } },
  ]
  const plain = events.map((row) => JSON.stringify(row)).join('\n') + '\n'
  // 一个文件走明文，一个走 zstd，两条路径都验
  await writeFile(join(sessionDir, 'session.v4.jsonl'), plain)
  const project2 = join(home, 'sessions', '--Users-x-other--')
  const session2 = join(project2, 'session-def456')
  await mkdir(session2, { recursive: true })
  const zstEvents = [
    { type: 'session', version: 4, cwd: '/Users/x/other' },
    { type: 'user/message', seq: 2, time: now - HOUR, surfaceOp: 'append', data: { content: [{ type: 'text', text: 'DSL 和 SQL 的区别是什么' }], source: { kind: 'user' } } },
  ]
  await writeFile(join(session2, 'session.v4.jsonl.zstd'), zlib.zstdCompressSync(Buffer.from(zstEvents.map((row) => JSON.stringify(row)).join('\n') + '\n')))
  const rows = await scanDsh({ sinceMs: now - 6 * HOUR, home })
  assert.equal(rows.length, 2)
  assert.match(rows[0].text, /跨域/)
  assert.equal(rows[0].sessionId, 'abc123')
  assert.equal(rows[0].project, '/Users/x/Documents/zzy/Fighting for Wealth')
  assert.equal(rows[1].sessionId, 'def456')
})

test('dsh：无 session 首行时用目录名兜底', () => {
  assert.equal(decodeProjectDir('--Users-zhangzhiyuan-Documents-zzy-code~0020dsh--'), '/Users/zhangzhiyuan/Documents/zzy/code dsh')
})

// ---------- 汇总入口 ----------

test('scanRaw：并行四源，单源失败记入 errors 不拖垮整轮', async () => {
  const homes = {
    zcode: join(root, 'zcode'),
    claude: join(root, 'claude'),
    codex: join(root, 'codex'),
    dsh: join(root, 'dsh'),
  }
  const { messages, errors } = await scanRaw({ sinceMs: Date.now() - 6 * HOUR, homes })
  assert.equal(errors.length, 0)
  assert.ok(messages.length >= 5)
  const sources = new Set(messages.map((row) => row.source))
  assert.deepEqual([...sources].sort(), ['claude', 'codex', 'dsh', 'zcode'])
  // 传不存在的 home：zcode 抛错（sqlite 打不开），其他源照常
  const bad = await scanRaw({ sinceMs: Date.now() - 6 * HOUR, homes: { ...homes, zcode: '/nonexistent-zcode' } })
  assert.equal(bad.errors.filter((row) => row.source === 'zcode').length, 1)
  assert.ok(bad.messages.length > 0)
})
