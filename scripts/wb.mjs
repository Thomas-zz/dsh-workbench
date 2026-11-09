#!/usr/bin/env node
// 外部会话（ZCode 等）共用的工作台命令行入口：与 DSH 插件读写同一个 state.json
// （$DSH_HOME/workbench/state.json，默认 ~/.dsh/workbench/）。store 的 mtime 重载与
// 原子写本就为多进程共存设计，本脚本只是一个短生命周期的第三写入方。
//
// 用法：
//   wb.mjs add <标题> [--note 备注] [--due YYYY-MM-DD] [--priority 0|1|2] [--focus] [--status todo|doing]
//   wb.mjs update <id或标题> [--status todo|doing|blocked|done] [--due YYYY-MM-DD|空串清除] [--priority 0|1|2] [--focus] [--title 新标题] [--note 新备注]
//   wb.mjs progress <id或标题> <一句话> [--actor 执行者名，默认 ZCode]
//   wb.mjs idea <想法> [--note 备注]
//   wb.mjs query [today|all|reviews|ideas]
import { parseArgs } from 'node:util'
import { Store } from '../src/store.js'
import { applyOps, resolveTask, todayView, allView, reviewsView, ideasView } from '../src/ops.js'

const HELP = `工作台 CLI（与 DSH 插件共用数据；DSH_HOME 环境变量可改根目录）
add <标题> [--note] [--due] [--priority 0|1|2] [--focus] [--status todo|doing]
update <id或标题> [--status todo|doing|blocked|done] [--due|--priority|--focus|--title|--note]
progress <id或标题> <一句话> [--actor 名字]
idea <想法> [--note]
query [today|all|reviews|ideas]`

const STRING_OPTS = { type: 'string' }
const BOOLEAN_OPTS = { type: 'boolean' }

function parse(argv, options) {
  try {
    return parseArgs({ args: argv, options, allowPositionals: true, strict: false })
  } catch (err) {
    fail(String(err.message ?? err))
  }
}

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

function report(result) {
  for (const receipt of result.receipts ?? []) process.stdout.write(`${receipt.text}\n`)
  if (result.errors?.length) {
    for (const text of result.errors) process.stderr.write(`${text}\n`)
    process.exit(1)
  }
}

/** 使命令行参数变成 update_task 可用的 patch（只收有值的键）。 */
function patchFrom(values, keys) {
  const patch = {}
  for (const key of keys) {
    if (values[key] === undefined) continue
    patch[key] = key === 'priority' ? Number(values[key]) : values[key]
  }
  return patch
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const store = new Store()
  if (!command || command === 'help' || command === '--help') {
    process.stdout.write(`${HELP}\n`)
    return
  }

  if (command === 'add') {
    const { values, positionals } = parse(rest, {
      note: STRING_OPTS, due: STRING_OPTS, priority: STRING_OPTS, focus: BOOLEAN_OPTS, status: STRING_OPTS,
    })
    const title = positionals.join(' ').trim()
    if (!title) fail('add 需要一个标题参数')
    const state = await store.read()
    // 幂等：同名未完结任务已存在就跳过，重试不会重复登记
    if (state.tasks.some((row) => row.status !== 'done' && row.title === title)) {
      process.stdout.write(`已有未完结的同名任务「${title}」，跳过登记\n`)
      return
    }
    const result = await store.mutate(`登记「${title.slice(0, 16)}」`, (draft) => applyOps(draft, [{
      op: 'add_task',
      title,
      note: values.note,
      due: values.due,
      priority: values.priority === undefined ? undefined : Number(values.priority),
      focus: values.focus === true,
      status: values.status,
      origin: { kind: 'zcode' },
    }]))
    report(result)
    return
  }

  if (command === 'update') {
    const { values, positionals } = parse(rest, {
      status: STRING_OPTS, due: STRING_OPTS, priority: STRING_OPTS, focus: BOOLEAN_OPTS, title: STRING_OPTS, note: STRING_OPTS,
    })
    const key = positionals.join(' ').trim()
    if (!key) fail('update 需要任务 id 或标题')
    const state = await store.read()
    const resolved = resolveTask(state, key)
    if (!resolved.task) {
      fail(resolved.error ?? '匹配到多个任务，请用 id 指定')
    }
    const patch = patchFrom(values, ['status', 'due', 'title', 'note'])
    if (values.priority !== undefined) patch.priority = Number(values.priority)
    if (values.focus !== undefined) patch.focus = values.focus === true
    if (!Object.keys(patch).length) fail('update 至少传一个要修改的字段')
    const result = await store.mutate(`更新「${resolved.task.title.slice(0, 16)}」`, (draft) => applyOps(draft, [
      { op: 'update_task', id: resolved.task.id, ...patch },
    ]))
    report(result)
    return
  }

  if (command === 'progress') {
    const { values, positionals } = parse(rest, { actor: STRING_OPTS })
    const key = positionals[0] ?? ''
    const note = positionals.slice(1).join(' ').trim()
    if (!key || !note) fail('progress 需要 <id或标题> <一句话>')
    const state = await store.read()
    const resolved = resolveTask(state, key)
    if (!resolved.task) fail(resolved.error ?? '匹配到多个任务，请用 id 指定')
    const result = await store.mutate(`汇报进展「${resolved.task.title.slice(0, 16)}」`, (draft) => applyOps(draft, [{
      op: 'update_task',
      id: resolved.task.id,
      progress: note,
      progressActor: values.actor ?? 'ZCode',
    }]))
    report(result)
    return
  }

  if (command === 'idea') {
    const { values, positionals } = parse(rest, { note: STRING_OPTS })
    const text = positionals.join(' ').trim()
    if (!text) fail('idea 需要想法内容')
    const result = await store.mutate('停靠灵感', (draft) => applyOps(draft, [
      { op: 'capture_idea', text, note: values.note, source: 'ui' },
    ]))
    report(result)
    return
  }

  if (command === 'query') {
    const view = rest[0] ?? 'today'
    const state = await store.read()
    if (view === 'today') {
      const data = todayView(state)
      for (const section of data.sections) {
        process.stdout.write(`${section.title}（${section.tasks.length}）：${section.tasks.map((row) => row.title).join('；')}\n`)
      }
      process.stdout.write(`今日完成 ${data.doneToday.length} 件\n`)
    } else if (view === 'all') {
      const data = allView(state)
      process.stdout.write(`待办 ${data.todo.length} · 进行中 ${data.doing.length} · 受阻 ${data.blocked.length} · 已完成 ${data.done.length}\n`)
      for (const group of ['todo', 'doing', 'blocked']) {
        for (const row of data[group]) process.stdout.write(`  [${group}] ${row.id} ${row.title}\n`)
      }
    } else if (view === 'reviews') {
      const data = reviewsView(state)
      process.stdout.write(data.pending.length
        ? `待验收 ${data.pending.length} 条：\n${data.pending.map((row) => `  ${row.id} ${row.title}`).join('\n')}\n`
        : '没有待验收\n')
    } else if (view === 'ideas') {
      const data = ideasView(state)
      process.stdout.write(data.parked.length
        ? `灵感 ${data.parked.length} 条：\n${data.parked.map((row) => `  ${row.id} ${row.text}`).join('\n')}\n`
        : '灵感收件箱是空的\n')
    } else {
      fail(`未知视图：${view}（today | all | reviews | ideas）`)
    }
    return
  }

  fail(`未知命令：${command}\n${HELP}`)
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)))
