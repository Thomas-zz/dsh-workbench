// Obsidian 写入器测试：临时 vault 目录里验笔记、改名去重、frontmatter 回写与日报。
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { writeLearnNote, updateNoteFields, writeDailyReport, slugify, obsidianUri, validateLearnTarget } from '../src/learn/obsidian.js'
import { migrateState, applyOps } from '../src/ops.js'

let vault

before(async () => {
  vault = await mkdtemp(join(tmpdir(), 'wb-vault-'))
  await mkdir(join(vault, '.obsidian'))
})

after(async () => {
  await rm(vault, { recursive: true, force: true })
})

const target = () => ({ vaultPath: vault, notesDir: 'AI/Agent学习' })

test('writeLearnNote：frontmatter + 三段正文 + 中文文件名', async () => {
  const { path, created } = await writeLearnNote(target(), {
    title: 'SDK 是什么',
    question: '什么是sdk，数据库的sdk是啥',
    category: 'term',
    concept: 'SDK',
    answer: 'SDK 是对接某系统的一组封装好的库与工具。',
    why: '选型与排查调用问题时需要分清 SDK / API / 中间件。',
    source: { harness: 'zcode', project: '/Users/x/p' },
    date: '2026-11-10',
  })
  assert.equal(created, true)
  assert.equal(path, 'AI/Agent学习/2026-11-10-SDK 是什么.md')
  const body = await readFile(join(vault, path), 'utf8')
  assert.match(body, /^---\n/)
  assert.match(body, /date: "2026-11-10"/)
  assert.match(body, /category: "term"/)
  assert.match(body, /concept: "SDK"/)
  assert.match(body, /mastered: false/)
  assert.match(body, /## 问题/)
  assert.match(body, /## 核心/)
  assert.match(body, /## 为什么重要/)
  assert.match(body, /> 来源：ZCode · \/Users\/x\/p/)
})

test('writeLearnNote：同日同标题自动加序号，不覆盖', async () => {
  const first = await writeLearnNote(target(), { title: '网关', question: 'q1', category: 'term', date: '2026-11-11' })
  const second = await writeLearnNote(target(), { title: '网关', question: 'q2', category: 'term', date: '2026-11-11' })
  assert.equal(first.created, true)
  assert.equal(second.created, true)
  assert.notEqual(first.path, second.path)
  assert.match(second.path, /-2\.md$/)
  const older = await readFile(join(vault, first.path), 'utf8')
  assert.match(older, /q1/) // 第一篇没被覆盖
})

test('writeLearnNote：notePath 已有时按原路径重写（不新建）', async () => {
  const target2 = target()
  const first = await writeLearnNote(target2, { title: '幂等', question: '什么是幂等', category: 'know', date: '2026-11-12' })
  const second = await writeLearnNote(target2, { title: '幂等性详解', question: '什么是幂等', category: 'weak', date: '2026-11-12', notePath: first.path })
  assert.equal(second.created, false)
  assert.equal(second.path, first.path)
  const body = await readFile(join(vault, second.path), 'utf8')
  assert.match(body, /category: "weak"/)
  assert.match(body, /幂等性详解/) // title 改了但文件没动
})

test('updateNoteFields：mastered 回写 frontmatter；文件不存在静默跳过', async () => {
  const target3 = target()
  const { path } = await writeLearnNote(target3, { title: 'MCP', question: 'MCP 是什么', category: 'term', date: '2026-11-10' })
  assert.equal(await updateNoteFields(target3, path, { mastered: true, concept: 'MCP 协议' }), true)
  const body = await readFile(join(vault, path), 'utf8')
  assert.match(body, /mastered: true/)
  assert.match(body, /concept: "MCP 协议"/)
  assert.equal(await updateNoteFields(target3, 'AI/Agent学习/不存在.md', { mastered: true }), false)
})

test('writeDailyReport：统计、新增清单链接、查漏补缺', async () => {
  const state = migrateState({})
  const target4 = target()
  const written = []
  for (const item of [
    { question: 'GraphQL 是什么', title: 'GraphQL', category: 'term', concept: 'GraphQL', key: 'k1' },
    { question: 'GraphQL 和 REST 的差异', title: 'GraphQL vs REST', category: 'weak', concept: 'GraphQL', key: 'k2' },
    { question: '什么是幂等', title: '幂等', category: 'know', concept: '幂等', key: 'k3' },
  ]) {
    const note = await writeLearnNote(target4, { ...item, date: '2026-11-13' })
    written.push({ ...item, notePath: note.path })
  }
  applyOps(state, [{ op: 'learn_write', items: written }])
  const { path } = await writeDailyReport(target4, state, { date: '2026-11-13', addedToday: written })
  assert.equal(path, 'AI/Agent学习/日报/2026-11-13.md')
  const body = await readFile(join(vault, path), 'utf8')
  assert.match(body, /# 学习日报 · 2026-11-13/)
  assert.match(body, /今日新增（3）/)
  assert.match(body, /\[\[AI\/Agent学习\/2026-11-13-GraphQL]]/)
  assert.match(body, /查漏补缺/)
  assert.match(body, /\*\*GraphQL\*\*：近期问了 2 次/)
  // 同日再写一次：整体重生成，结构不变（幂等）
  await writeDailyReport(target4, state, { date: '2026-11-13', addedToday: written })
  const again = await readFile(join(vault, path), 'utf8')
  assert.equal(again.match(/# 学习日报/g).length, 1)
})

test('slugify：路径分隔与特殊字符清理', () => {
  assert.equal(slugify('a/b:c?d*e'), 'a b c d e')
  assert.equal(slugify(''), '未命名')
  assert.ok(slugify('长'.repeat(60)).length <= 40)
})

test('obsidianUri：vault 与文件名编码', () => {
  assert.equal(
    obsidianUri('Fighting for Wealth', 'AI/Agent学习/2026-11-10-SDK 是什么.md'),
    'obsidian://open?vault=Fighting%20for%20Wealth&file=AI%2FAgent%E5%AD%A6%E4%B9%A0%2F2026-11-10-SDK%20%E6%98%AF%E4%BB%80%E4%B9%88',
  )
})

test('validateLearnTarget：拒绝非 vault 与越界目录', async () => {
  await assert.rejects(validateLearnTarget({ vaultPath: '/tmp/not-a-vault', notesDir: 'AI/学习' }), /找不到 Obsidian 库/)
  await assert.rejects(validateLearnTarget({ vaultPath: vault, notesDir: '../outside' }), /相对路径/)
  assert.equal((await validateLearnTarget(target())).vaultPath, vault)
})
