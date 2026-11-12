#!/usr/bin/env node
// 学习模块 CLI（ZCode 等外部进程用）：与 DSH 插件共用同一个 state.json，
// 扫描各 harness 的用户提问做零成本预览，手动补录问题，查看统计与弱项。
//
// 用法：
//   learn.mjs scan [--hours N=48] [--limit N=80] [--json]   预览各源提问候选（不写库）
//   learn.mjs add <问题> [--context 备注]                     补录一条提问进待整理收件箱
//   learn.mjs status                                         统计与弱项概念清单
import { parseArgs } from 'node:util'
import { Store } from '../src/store.js'
import { applyOps, learnView, LEARN_SOURCE_LABELS, LEARN_CATEGORY_LABELS } from '../src/ops.js'
import { scanRaw } from '../src/learn/scan/index.js'
import { extractCandidates, dedupeKey } from '../src/learn/scan/heuristic.js'

const HELP = `学习模块 CLI（与 DSH 插件共用数据；DSH_HOME 环境变量可改根目录）
scan [--hours N] [--limit N] [--json]   扫描各 harness 提问候选（只读预览）
add <问题> [--context 备注]             补录提问进待整理收件箱
status                                  学习统计与弱项概念`

const STRING_OPTS = { type: 'string' }

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

function parse(argv, options) {
  try {
    return parseArgs({ args: argv, options, allowPositionals: true, strict: false })
  } catch (err) {
    fail(String(err.message ?? err))
  }
}

function report(result) {
  for (const receipt of result.receipts ?? []) process.stdout.write(`${receipt.text}\n`)
  if (result.errors?.length) {
    for (const text of result.errors) process.stderr.write(`${text}\n`)
    process.exit(1)
  }
}

/** 扫描 + heuristic 预筛 + 排除已落库的提问。 */
async function collectCandidates(state, { hours, limit }) {
  const sinceMs = Date.now() - hours * 3_600_000
  const sources = Object.entries(state.learn.config.sources).filter(([, on]) => on).map(([name]) => name)
  const { messages, errors } = await scanRaw({ sinceMs, sources })
  const excludeKeys = new Set([
    ...state.learn.entries.map((row) => row.key).filter(Boolean),
    ...state.learn.inbox.map((row) => dedupeKey(row.question)).filter(Boolean),
  ])
  const candidates = extractCandidates(messages, { limit, excludeKeys })
  return { candidates, errors }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const store = new Store()
  if (!command || command === 'help' || command === '--help') {
    process.stdout.write(`${HELP}\n`)
    return
  }

  if (command === 'scan') {
    const { values } = parse(rest, { hours: STRING_OPTS, limit: STRING_OPTS, json: { type: 'boolean' } })
    const hours = Math.max(1, Math.min(720, Number(values.hours ?? 48) || 48))
    const limit = Math.max(1, Math.min(200, Number(values.limit ?? 80) || 80))
    const state = await store.read()
    const { candidates, errors } = await collectCandidates(state, { hours, limit })
    if (values.json) {
      process.stdout.write(`${JSON.stringify({ hours, candidates, errors }, null, 2)}\n`)
    } else {
      process.stdout.write(`近 ${hours} 小时提问候选 ${candidates.length} 条（已排除落库过的）：\n`)
      for (const row of candidates) {
        const source = LEARN_SOURCE_LABELS[row.source] ?? row.source
        const project = row.project ? row.project.replace(/^\/Users\/[^/]+/, '~') : ''
        process.stdout.write(`  [${source}] ${row.at.slice(5, 16)} ${project}\n    ${row.text}\n`)
      }
      for (const err of errors) process.stderr.write(`源 ${err.source} 扫描失败：${err.error}\n`)
    }
    return
  }

  if (command === 'add') {
    const { values, positionals } = parse(rest, { context: STRING_OPTS })
    const question = positionals.join(' ').trim()
    if (!question) fail('add 需要一个问题参数')
    const result = await store.mutate(`补录学习提问「${question.slice(0, 16)}」`, (draft) => applyOps(draft, [{
      op: 'learn_capture', question, context: values.context, source: 'cli',
    }]))
    report(result)
    return
  }

  if (command === 'status') {
    const state = await store.read()
    const view = learnView(state)
    const { counts, config } = view
    process.stdout.write([
      `学习条目：已记录 ${counts.recorded}（${LEARN_CATEGORY_LABELS.weak} ${counts.weak} · ${LEARN_CATEGORY_LABELS.know} ${counts.know} · ${LEARN_CATEGORY_LABELS.term} ${counts.term}）`,
      `待整理收件箱 ${counts.pendingInbox} · 已掌握 ${counts.mastered} · 已忽略 ${counts.ignored} · 今日新增 ${counts.addedToday}`,
      `设置：整理时间 ${config.reportHour}:00 · 笔记目录 ${config.notesDir} · 源 ${Object.entries(config.sources).filter(([, on]) => on).map(([name]) => LEARN_SOURCE_LABELS[name]).join('/')}`,
    ].join('\n') + '\n')
    if (view.concepts.length) {
      process.stdout.write(`弱项概念（按出现次数）：\n`)
      for (const row of view.concepts.slice(0, 10)) {
        process.stdout.write(`  ${row.urgent ? '★' : '·'} ${row.concept} ×${row.count}（最近 ${row.lastAskedAt.slice(5, 10)}）\n`)
      }
    }
    if (view.inbox.length) {
      process.stdout.write(`待整理：\n${view.inbox.map((row) => `  ${row.id} ${row.question}`).join('\n')}\n`)
    }
    return
  }

  fail(`未知命令：${command}\n${HELP}`)
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)))
