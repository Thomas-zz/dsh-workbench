import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = join(ROOT, 'scripts', 'wb.mjs')

/** 在独立 DSH_HOME 里跑一次 CLI，返回 stdout。 */
function run(home, args, { expectFail = false } = {}) {
  const output = execFileSync(process.execPath, [SCRIPT, ...args], {
    env: { ...process.env, DSH_HOME: home },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', expectFail ? 'pipe' : 'inherit'],
  })
  return output
}

test('CLI：add 幂等 / progress / update / query 全链路', () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-workbench-cli-'))
  try {
    const added = run(home, ['add', '整理 pitch 分享内容', '--priority', '2', '--focus'])
    assert.ok(added.includes('已登记任务「整理 pitch 分享内容」'))
    let state = JSON.parse(readFileSync(join(home, 'workbench', 'state.json'), 'utf8'))
    assert.equal(state.tasks.length, 1)
    assert.equal(state.tasks[0].origin.kind, 'zcode')
    assert.equal(state.tasks[0].priority, 2)
    assert.equal(state.tasks[0].focus, true)

    // 同名未完结任务已存在：跳过，不重复登记
    const again = run(home, ['add', '整理 pitch 分享内容'])
    assert.ok(again.includes('跳过登记'))
    state = JSON.parse(readFileSync(join(home, 'workbench', 'state.json'), 'utf8'))
    assert.equal(state.tasks.length, 1)

    const progressed = run(home, ['progress', 'pitch', '素材已抓取完毕，开始排版'])
    assert.ok(progressed.includes('已记录进展'))
    state = JSON.parse(readFileSync(join(home, 'workbench', 'state.json'), 'utf8'))
    assert.equal(state.tasks[0].progress.length, 1)
    assert.equal(state.tasks[0].progress[0].actor, 'ZCode')

    run(home, ['update', 'pitch', '--status', 'done'])
    state = JSON.parse(readFileSync(join(home, 'workbench', 'state.json'), 'utf8'))
    assert.equal(state.tasks[0].status, 'done')
    assert.ok(state.tasks[0].completedAt)

    const queried = run(home, ['query', 'today'])
    assert.ok(queried.includes('今日完成 1 件'))

    const idea = run(home, ['idea', '给工作台加个统计页'])
    assert.ok(idea.includes('已停靠灵感'))
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
