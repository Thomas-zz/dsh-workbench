// 提交脱敏审查：文件内容、路径、提交信息、身份、附注标签，以及 pre-push 钩子的安装与拦截。
// 敏感样式一律用 s() 拼接，否则这个测试文件自己会被审查拦下。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RULES, parseDeny } from '../scripts/release-scan.mjs'
import { auditCommits, auditPush, auditRevision, auditTagObject, auditTree, installPushHook, loadRules } from '../scripts/release-audit.mjs'

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts')
const NORELAY = '59272886+Thomas-zz@users.noreply.github.com'
const ZERO = '0'.repeat(40)
const rules = [...RULES, ...parseDeny('internal-foo')]
const s = (...parts) => parts.join('')
// 隔离用户的全局 git 配置：提交身份只来自仓库级配置，也不受全局 hooksPath 影响。
const ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }
const PRIVATE_PATH = s('vault /', 'Users/somebody/secret\n')
const PRIVATE_DENY = s('本机私有名单「internal-', 'foo」')

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', env: ENV, stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
function fresh(prefix) {
  return mkdtempSync(join(tmpdir(), prefix))
}
function scratch() {
  const dir = fresh('wb-audit-')
  git(dir, ['init', '-q', '-b', 'main'])
  git(dir, ['config', 'user.name', 'Thomas-zz'])
  git(dir, ['config', 'user.email', NORELAY])
  return dir
}
function bare(dir) {
  mkdirSync(dir, { recursive: true })
  git(dir, ['init', '-q', '--bare'])
  return dir
}
function commit(dir, file, body, message, identity = {}) {
  if (file) {
    mkdirSync(dirname(join(dir, file)), { recursive: true })
    writeFileSync(join(dir, file), body)
    git(dir, ['add', '-A'])
  }
  const overrides = Object.entries(identity).flatMap(([key, value]) => ['-c', `user.${key}=${value}`])
  git(dir, [...overrides, 'commit', '-q', '--allow-empty', '-m', message])
  return git(dir, ['rev-parse', 'HEAD'])
}
const subjects = (result) => result.commits.map((entry) => entry.subject)

// 审查工具的一份副本，放在临时目录里，名单也放在那里：读哪份名单只由测试决定，不看本机的。
// deny 为 null 表示那里没有名单。
function toolRoot(deny = 'internal-foo') {
  const root = fresh('wb-audit-tool-')
  mkdirSync(join(root, 'scripts'))
  for (const name of ['release-audit.mjs', 'release-scan.mjs']) cpSync(join(SCRIPTS, name), join(root, 'scripts', name))
  if (deny !== null) {
    mkdirSync(join(root, '.local'))
    writeFileSync(join(root, '.local', 'release-deny.txt'), `${deny}\n`)
  }
  return { root, tool: join(root, 'scripts', 'release-audit.mjs') }
}
const run = (tool, args, input, cwd = tmpdir()) => spawnSync(process.execPath, [tool, ...args], { cwd, encoding: 'utf8', input, env: ENV })
const push = (dir, remote) => spawnSync('git', ['push', '-q', remote, 'main'], { cwd: dir, encoding: 'utf8', env: ENV })

test('干净的提交通过；文件内容、文件路径、提交信息、作者和提交者身份各自被拦', () => {
  const dir = scratch()
  try {
    const clean = commit(dir, 'README.md', 'hello\n', 'init')
    assert.deepEqual(auditCommits(dir, [clean], { rules }).findings, [])

    const content = commit(dir, 'notes.md', PRIVATE_PATH, 'add notes')
    assert.deepEqual(
      auditCommits(dir, [content], { rules }).findings.map((f) => `${f.where} ${f.kind} ${f.location}:${f.line} ${f.rule}`),
      [`${content.slice(0, 7)} 文件内容 notes.md:1 个人家目录路径`],
    )

    const path = commit(dir, 'docs/internal-foo-plan.md', 'fine\n', 'add plan')
    assert.deepEqual(
      auditCommits(dir, [path], { rules }).findings.filter((f) => f.kind === '文件路径').map((f) => f.location),
      ['docs/internal-foo-plan.md'],
    )

    const message = commit(dir, null, '', s('sync ', 'internal-foo', ' notes'))
    assert.deepEqual(
      auditCommits(dir, [message], { rules }).findings.filter((f) => f.kind === '提交信息').map((f) => `${f.location}:${f.line} ${f.rule}`),
      [`提交信息:1 ${PRIVATE_DENY}`],
    )

    const identity = commit(dir, null, '', 'oops', { name: s('internal-', 'foo'), email: s('somebody', '@mail.example.org.cn') })
    assert.deepEqual(
      auditCommits(dir, [identity], { rules }).findings.filter((f) => /邮箱|名字/.test(f.kind)).map((f) => `${f.kind} ${f.rule}`),
      ['作者邮箱 不是 GitHub noreply 地址', `作者名字 ${PRIVATE_DENY}`, '提交者邮箱 不是 GitHub noreply 地址', `提交者名字 ${PRIVATE_DENY}`],
    )

    // 二进制文件不按文本审查；符号链接的目标路径算文本。
    writeFileSync(join(dir, 'icon.bin'), Buffer.from([0x89, 0x50, 0x00, 0x2f]))
    symlinkSync(s('/', 'Users/somebody/vault'), join(dir, 'link'))
    git(dir, ['add', '-A'])
    const linked = commit(dir, null, '', 'binary and link')
    assert.deepEqual(
      auditCommits(dir, [linked], { rules }).findings.filter((f) => /^(icon\.bin|link)$/.test(f.location)).map((f) => `${f.location} ${f.rule}`),
      ['link 个人家目录路径'],
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('范围与 exclude：只审查还没发布的提交', () => {
  const dir = scratch()
  try {
    const first = commit(dir, 'a.md', 'a\n', 'first')
    commit(dir, 'b.md', 'b\n', 'second')
    assert.deepEqual(subjects(auditCommits(dir, ['HEAD'], { rules })), ['second', 'first'])
    assert.deepEqual(subjects(auditCommits(dir, ['HEAD'], { exclude: [first], rules })), ['second'])
    assert.deepEqual(subjects(auditCommits(dir, [`${first}..HEAD`], { rules })), ['second'])
    assert.deepEqual(auditCommits(dir, [], { rules }), { commits: [], findings: [] })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('auditTree 只看一个提交的文件；auditRevision 只看这一个提交，不牵连祖先', () => {
  const dir = scratch()
  try {
    commit(dir, 'old.md', PRIVATE_PATH, 'dirty ancestor')
    git(dir, ['rm', '-q', 'old.md'])
    const clean = commit(dir, 'README.md', 'hello\n', 'clean')
    assert.deepEqual(auditTree(dir, clean, rules), [])
    assert.deepEqual(auditRevision(dir, clean, rules).findings, [])
    assert.equal(auditCommits(dir, [clean], { rules }).commits.length, 2, 'walking the history still reaches the ancestor')

    const message = commit(dir, null, '', s('sync ', 'internal-foo'))
    assert.deepEqual(auditRevision(dir, message, rules).findings.map((f) => `${f.where} ${f.kind}`), [`${message.slice(0, 7)} 提交信息`])
    assert.deepEqual(auditTree(dir, message, rules), [], 'the files are clean even though the message is not')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('pre-push 输入：删除和不相关的引用不审查；远端上已有的提交不重复审查', () => {
  const dir = scratch()
  try {
    const first = commit(dir, 'a.md', 'a\n', 'first')
    const second = commit(dir, 'b.md', 'b\n', 'second')
    const line = (remoteSha = ZERO) => `refs/heads/main ${second} refs/heads/main ${remoteSha}\n`
    // 这次推送里对方现有的值，和 ls-remote 取到的远端引用，才算已发布。
    assert.deepEqual(subjects(auditPush(dir, 'origin', line(first), rules)), ['second'])
    assert.deepEqual(subjects(auditPush(dir, 'origin', line(), rules, { remoteRefs: [first] })), ['second'])
    assert.deepEqual(subjects(auditPush(dir, '/tmp/remote.git', line(), rules)), ['second', 'first'])
    assert.deepEqual(auditPush(dir, 'origin', `refs/heads/gone ${ZERO} refs/heads/gone ${first}\n`, rules).commits, [])
    assert.deepEqual(auditPush(dir, 'origin', `refs/notes/commits ${second} refs/notes/commits ${ZERO}\n`, rules).commits, [])
    // 本地缓存的远端分支可能过期（远端被删过、分支被删过），不能当作已发布。
    git(dir, ['remote', 'add', 'origin', '/tmp/remote.git'])
    git(dir, ['update-ref', 'refs/remotes/origin/main', second])
    assert.deepEqual(subjects(auditPush(dir, 'origin', line(), rules)), ['second', 'first'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('命令行：--repo 指向要审查的仓库；问不到远端时推送审查不放行', () => {
  const { root, tool } = toolRoot()
  const dir = scratch()
  try {
    commit(dir, 'a.md', 'a\n', 'first')
    const audit = run(tool, ['--repo', dir, 'HEAD'], '')
    assert.equal(audit.status, 0, audit.stderr)
    assert.match(audit.stdout, /脱敏审查：1 个提交，0 处命中/)
    const missing = run(tool, ['--push', '--repo', dir, '--remote', join(dir, 'no-such-repo.git')], '')
    assert.notEqual(missing.status, 0)
    assert.match(missing.stderr, /脱敏审查没能完成/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
    rmSync(root, { recursive: true, force: true })
  }
})

test('附注标签：标签信息和打标签的人也审查；轻量标签没有标签对象', () => {
  const dir = scratch()
  try {
    const head = commit(dir, 'a.md', 'a\n', 'first')
    git(dir, ['-c', s('user.name=internal-', 'foo'), '-c', s('user.email=somebody', '@mail.example.org.cn'), 'tag', '-a', 'v1', '-m', s('release ', 'internal-foo')])
    git(dir, ['tag', 'light'])
    assert.deepEqual(
      auditTagObject(dir, 'v1', rules).map((f) => `${f.kind} ${f.rule}`),
      ['打标签的人邮箱 不是 GitHub noreply 地址', `打标签的人名字 ${PRIVATE_DENY}`, `标签信息 ${PRIVATE_DENY}`],
    )
    assert.deepEqual(auditTagObject(dir, 'light', rules), [])
    const push = auditPush(dir, 'origin', `refs/tags/v1 ${git(dir, ['rev-parse', 'v1'])} refs/tags/v1 ${ZERO}\n`, rules)
    assert.deepEqual(push.commits.map((entry) => entry.sha), [head.slice(0, 7)])
    assert.equal(push.findings.length, 3)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('pre-push 钩子：干净的推送照常上去，带个人内容的推送被拦下', async () => {
  const { root, tool } = toolRoot()
  const dir = scratch()
  const remote = bare(fresh('wb-audit-remote-'))
  try {
    const installed = await installPushHook({ cwd: dir, tool })
    assert.equal(installed.changed, true)
    assert.equal(statSync(installed.path).mode & 0o777, 0o755)
    assert.match(readFileSync(installed.path, 'utf8'), /--push --remote "\$1"/)
    assert.equal((await installPushHook({ cwd: dir, tool })).changed, false)

    const clean = commit(dir, 'README.md', 'hello\n', 'init')
    const allowed = push(dir, remote)
    assert.equal(allowed.status, 0, allowed.stderr)
    assert.equal(git(remote, ['rev-parse', 'main']), clean)

    commit(dir, 'notes.md', PRIVATE_PATH, 'oops')
    const blocked = push(dir, remote)
    assert.notEqual(blocked.status, 0)
    assert.match(`${blocked.stdout}${blocked.stderr}`, /脱敏审查：1 个提交，1 处命中/)
    assert.match(`${blocked.stdout}${blocked.stderr}`, /notes\.md:1\s+\[个人家目录路径\]/)
    assert.match(`${blocked.stdout}${blocked.stderr}`, /推送已阻止/)
    assert.equal(git(remote, ['rev-parse', 'main']), clean)
  } finally {
    rmSync(dir, { recursive: true, force: true })
    rmSync(remote, { recursive: true, force: true })
    rmSync(root, { recursive: true, force: true })
  }
})

test('钩子安装：不覆盖别的钩子；给了 onlyRemote 时，只有远端地址匹配才审查', async () => {
  const { root, tool } = toolRoot()
  const dir = scratch()
  const remote = bare(fresh('wb-audit-remote-'))
  const matchingRoot = fresh('wb-audit-remote-')
  const matching = bare(join(matchingRoot, 'github.com', 'someone', 'else'))
  try {
    const hook = join(dir, '.git', 'hooks', 'pre-push')
    mkdirSync(dirname(hook), { recursive: true })
    writeFileSync(hook, '#!/bin/sh\necho custom\n')
    await assert.rejects(installPushHook({ cwd: dir, tool }), /别的 pre-push 钩子/)
    assert.equal(readFileSync(hook, 'utf8'), '#!/bin/sh\necho custom\n')

    rmSync(hook)
    await installPushHook({ cwd: dir, tool, onlyRemote: 'github.com[:/]someone/else' })
    commit(dir, 'notes.md', PRIVATE_PATH, 'oops')
    const elsewhere = push(dir, remote)
    assert.equal(elsewhere.status, 0, elsewhere.stderr)
    const blocked = push(dir, matching)
    assert.notEqual(blocked.status, 0)
    assert.match(`${blocked.stdout}${blocked.stderr}`, /推送已阻止/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
    rmSync(remote, { recursive: true, force: true })
    rmSync(matchingRoot, { recursive: true, force: true })
    rmSync(root, { recursive: true, force: true })
  }
})

test('私有名单：钩子要求它在，没有就不放行；手动审查没有名单时只剩通用规则', async () => {
  const none = toolRoot(null)
  const blank = toolRoot()
  const some = toolRoot()
  const dir = scratch()
  const remote = bare(fresh('wb-audit-remote-'))
  try {
    commit(dir, 'README.md', 'hello\n', 'init')
    await assert.rejects(loadRules(none.root, { required: true }), /找不到私有名单/)
    // 只有注释和空行的名单等于没有。
    writeFileSync(join(blank.root, '.local', 'release-deny.txt'), '# 还没写\n\n')
    await assert.rejects(loadRules(blank.root, { required: true }), /找不到私有名单/)
    assert.equal((await loadRules(some.root, { required: true })).length, RULES.length + 1)

    // 不是钩子那一次：没有名单也照常审，只是只有通用规则。
    const manual = run(none.tool, ['--repo', dir, 'HEAD'], '')
    assert.equal(manual.status, 0, manual.stderr)

    await installPushHook({ cwd: dir, tool: none.tool })
    const blocked = push(dir, remote)
    assert.notEqual(blocked.status, 0)
    assert.match(`${blocked.stdout}${blocked.stderr}`, /找不到私有名单/)
    assert.equal(spawnSync('git', ['rev-parse', '-q', '--verify', 'main'], { cwd: remote, encoding: 'utf8', env: ENV }).status !== 0, true, '远端上什么都没上去')
  } finally {
    for (const path of [dir, remote, none.root, blank.root, some.root]) rmSync(path, { recursive: true, force: true })
  }
})

test('经软链接路径运行审查工具也要真的审：入口判断按真实路径比', () => {
  const { root, tool } = toolRoot()
  const dir = scratch()
  const holder = fresh('wb-audit-link-')
  try {
    commit(dir, 'notes.md', PRIVATE_PATH, 'oops')
    // 命令行里写的是链接路径，工具看到的自己是真实路径。
    const linked = join(holder, 'tool')
    symlinkSync(root, linked)
    const viaLink = run(join(linked, 'scripts', 'release-audit.mjs'), ['--repo', dir, 'HEAD'], '')
    assert.equal(viaLink.status, 1, `${viaLink.stdout}${viaLink.stderr}`)
    assert.match(viaLink.stdout, /脱敏审查：1 个提交，1 处命中/)
    assert.equal(run(tool, ['--repo', dir, 'HEAD'], '').status, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
    rmSync(holder, { recursive: true, force: true }) // rm 不跟进链接，工具副本要单独清
    rmSync(root, { recursive: true, force: true })
  }
})
