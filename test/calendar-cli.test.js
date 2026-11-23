import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
const exec = promisify(execFile)
const script = fileURLToPath(
  new URL('../scripts/calendar.mjs', import.meta.url),
)
test('Agent CLI 配置与检查使用指定数据目录，零事件也必须验证用户身份与应用', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wb-calendar-cli-'))
  try {
    const binary = join(dir, 'lark-test')
    await writeFile(
      binary,
      `#!${process.execPath}
const a=process.argv.slice(2);
if(!a.includes('--profile')||a[a.indexOf('--profile')+1]!=='specific')process.exit(3);
if(a[0]==='config')console.log(JSON.stringify({appId:'cli_test',appSecret:'not-for-state'}));
else if(a.includes('--as')&&a[a.indexOf('--as')+1]==='user')console.log(JSON.stringify({ok:true,data:{items:[]}}));
else process.exit(4);
`,
      { mode: 0o700 },
    )
    const root = join(dir, 'state')
    const result = JSON.parse(
      (
        await exec(process.execPath, [
          script,
          'configure',
          '--state-root',
          root,
          '--profile',
          'specific',
          '--app-id',
          'cli_test',
          '--name',
          '测试秘书',
          '--cli-path',
          binary,
        ])
      ).stdout,
    )
    assert.equal(result.status, 'ready')
    assert.equal(result.eventCount, 0)
    const state = await readFile(join(root, 'state.json'), 'utf8')
    assert.ok(!state.includes('not-for-state'))
    assert.equal(JSON.parse(state).plan.calendar.appName, '测试秘书')
    const check = JSON.parse(
      (await exec(process.execPath, [script, 'check', '--state-root', root]))
        .stdout,
    )
    assert.equal(check.ok, true)
    assert.equal(check.config.appId, 'cli_test')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
