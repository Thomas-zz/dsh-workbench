// 发布脚本的参数解析：正常写法、被 npm 吃掉的写法、缺值和不认识的参数。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseReleaseArgs } from '../scripts/release-args.mjs'

const clean = {}

test('写在 -- 后面的参数原样解析', () => {
  assert.deepEqual(parseReleaseArgs(['--dry-run', '--bump', 'patch'], clean), { dryRun: true, yes: false, bump: 'patch' })
  assert.deepEqual(
    parseReleaseArgs(['--version', '0.3.0', '--yes', '--notes', '修复', '--public', '/p', '--releases', '/r'], clean),
    { dryRun: false, yes: true, version: '0.3.0', notes: '修复', public: '/p', releases: '/r' },
  )
  assert.deepEqual(parseReleaseArgs([], clean), { dryRun: false, yes: false })
})

test('没写 -- 时参数被 npm 吃掉：按环境变量认出来并拒绝', () => {
  const eaten = { npm_config_dry_run: 'true', npm_config_bump: 'true', npm_lifecycle_event: 'release' }
  assert.throws(
    () => parseReleaseArgs(['patch'], eaten),
    /参数被 npm 当成它自己的配置吃掉了（--dry-run、--bump）.*npm run release -- --dry-run --bump/,
  )
  assert.throws(() => parseReleaseArgs([], { npm_config_yes: 'true' }), /（--yes）.*npm run release -- --yes/)
})

test('参数写对了就不受同名环境变量影响', () => {
  assert.deepEqual(
    parseReleaseArgs(['--dry-run', '--bump', 'patch'], { npm_config_dry_run: 'true', npm_config_bump: 'true' }),
    { dryRun: true, yes: false, bump: 'patch' },
  )
})

test('缺值和不认识的参数直接拒绝', () => {
  assert.throws(() => parseReleaseArgs(['patch'], clean), /不认识的参数「patch」/)
  assert.throws(() => parseReleaseArgs(['--dryrun'], clean), /不认识的参数「--dryrun」/)
  assert.throws(() => parseReleaseArgs(['--bump'], clean), /「--bump」后面要带一个值/)
  assert.throws(() => parseReleaseArgs(['--bump', '--yes'], clean), /「--bump」后面要带一个值/)
})
