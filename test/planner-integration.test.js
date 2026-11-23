import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Store } from '../src/store.js'
import { route } from '../src/host.js'
import { registerTools } from '../src/tools.js'
import { organizationContext } from './helpers/organization-context.js'
import { installOrganizationSessions } from '../src/organization-session.js'

const exec = promisify(execFile)
test('实际 HTTP、Agent 工具与 CLI 共用计划状态，跨入口改期保持硬截止', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wb-plan-api-'))
  const store = new Store(join(root, 'workbench'))
  const ctx = organizationContext()
  const tools = ctx.registered
  const dispose = registerTools(ctx, store)
  const server = createServer((req, res) =>
    route(ctx, store, {}, req, res).catch((e) => {
      res.statusCode = 500
      res.end(JSON.stringify({ error: e.message }))
    }),
  )
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}/wb/`
  const post = (path, body) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  try {
    const response = await post('ops', {
      ops: [
        {
          op: 'add_task',
          title: '接口样例',
          plannedDate: '2030-11-12',
          due: '2030-11-16',
          estimateMinutes: 45,
        },
      ],
    })
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.deepEqual(result.errors, [])
    const id = result.targets[0]
    const day = await (
      await fetch(base + 'plan?view=day&date=2030-11-12')
    ).json()
    assert.equal(day.days[0].tasks[0].id, id)
    const query = await tools
      .get('workbench_query')
      .execute({ view: 'week', date: '2030-11-12' })
    assert.equal(query.data.days.flatMap((d) => d.tasks).length, 1)
    await exec(
      process.execPath,
      [
        'scripts/wb.mjs',
        'update',
        id,
        '--date',
        '2030-11-13',
        '--estimate',
        '90',
      ],
      {
        cwd: new URL('..', import.meta.url),
        env: { ...process.env, DSH_HOME: root },
      },
    )
    const updated = await (await fetch(base + 'state')).json()
    assert.equal(updated.state.tasks[0].plannedDate, '2030-11-13')
    assert.equal(updated.state.tasks[0].due, '2030-11-16')
    const cli = await exec(
      process.execPath,
      ['scripts/wb.mjs', 'query', 'day', '2030-11-13'],
      {
        cwd: new URL('..', import.meta.url),
        env: { ...process.env, DSH_HOME: root },
      },
    )
    assert.equal(JSON.parse(cli.stdout).days[0].tasks[0].estimateMinutes, 90)
    const rejected = await fetch(base + 'ops', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'sec-fetch-site': 'cross-site',
      },
      body: '{}',
    })
    assert.equal(rejected.status, 403)
    await store.mutate('禁用真实源', (s) => {
      s.plan.config.sources = {}
    })
    const disabled = await post('plan/run-now', {mode:'decompose',goalId:id})
    assert.equal(disabled.status,409)
    assert.match((await disabled.json()).error,/自动拆分已关闭/)
    const queued = await post('plan/run-now', {})
    assert.equal(queued.status, 202)
    assert.equal((await queued.json()).sessionId, ctx.created[0])
    for (let i = 0; i < 50; i++) {
      if ((await store.read()).plan.organizer.lastRunAt) break
      await new Promise((r) => setTimeout(r, 10))
    }
    assert.ok((await store.read()).plan.organizer.lastRunAt)
  } finally {
    await ctx.idle()
    await installOrganizationSessions(ctx, store).dispose()
    dispose()
    await new Promise((resolve) => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  }
})
