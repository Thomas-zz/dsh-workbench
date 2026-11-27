// 提交脱敏审查：内容推到公开仓之前，逐个检查要发布的提交，规则见 DEVELOPMENT.md「个人内容不进仓库」。
// 检查范围：提交里每个文件的内容和路径、提交信息全文、作者和提交者的身份；附注标签的标签信息和打标签的人。
// 任何东西推到公开仓之前都要过这一关，手工 git push 也不例外（由 installPushHook 装的 pre-push 钩子把关）。
//
//   node scripts/release-audit.mjs main                     审查这些提交（写法同 git rev-list）
//   node scripts/release-audit.mjs origin/main..HEAD        审查一段范围里的提交
//   node scripts/release-audit.mjs --push --remote <远端>    pre-push 钩子调用：审查这次推送里新的提交和标签
//   node scripts/release-audit.mjs --install-hook <目录> [--only-remote <地址特征>]
//                                                           给这个仓库装上 pre-push 钩子
import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RULES, parseDeny, scanText } from './release-scan.mjs'

const MARKER = 'dsh-plugins 开发规范：提交脱敏审查'
const NORELAY = /@users\.noreply\.github\.com$/
const ZERO = /^0+$/
const USAGE = '用法：node scripts/release-audit.mjs <提交或范围…> | --push --remote <远端> | --install-hook <目录>'

// 只用底层命令读仓库，结果不受用户 git 配置（别名、输出格式、签名显示）影响。
const git = (cwd, args, input) => {
  const result = spawnSync('git', args, { cwd, input, maxBuffer: 1 << 28 })
  if (result.status !== 0) throw new Error(`「git ${args.slice(0, 3).join(' ')}」失败：${result.stderr.toString('utf8').trim()}`)
  return result.stdout
}
const text = (cwd, args) => git(cwd, args).toString('utf8').trimEnd()

/**
 * 通用规则加本机私有名单。名单在仓库根的 .local/ 下，不入库。
 * required 时名单必须存在而且至少有一条规则：少了它只剩通用规则，拦不住本机专属的词。
 */
export async function loadRules(root = fileURLToPath(new URL('../', import.meta.url)), { required = false } = {}) {
  const file = join(root, '.local', 'release-deny.txt')
  const deny = await readFile(file, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return ''
    throw error
  })
  if (required && !parseDeny(deny).length) throw new Error(`找不到私有名单 ${file}，或者里面一条规则都没有`)
  return [...RULES, ...parseDeny(deny)]
}

const auditText = (body, rules, kind) => scanText(body, rules).map((hit) => ({ kind, location: kind, line: hit.line, rule: hit.rule, excerpt: hit.excerpt }))
const auditIdentity = (role, name, email, rules) => [
  ...(NORELAY.test(email) ? [] : [{ kind: `${role}邮箱`, location: `${role}邮箱`, rule: '不是 GitHub noreply 地址', excerpt: email }]),
  ...scanText(name, rules).map((hit) => ({ kind: `${role}名字`, location: `${role}名字`, rule: hit.rule, excerpt: hit.excerpt })),
]
/** 提交或附注标签对象：头部的 author / committer / tagger 行，后面空一行是全文。 */
function readObject(cwd, sha) {
  const [header, ...body] = text(cwd, ['cat-file', '-p', sha]).split('\n\n')
  const actors = header.split('\n').map((line) => line.match(/^(author|committer|tagger) (.*) <([^>]*)> \d+ [+-]\d{4}$/)).filter(Boolean)
    .map((match) => ({ role: match[1], name: match[2], email: match[3] }))
  return { actors, body: body.join('\n\n') }
}

function readBlobs(cwd, shas) {
  const blobs = new Map()
  // 带着空请求去问 git，它会回一行 missing；所有文件都在缓存里时直接返回。
  if (!shas.length) return blobs
  const data = git(cwd, ['cat-file', '--batch'], `${shas.join('\n')}\n`)
  let at = 0
  while (at < data.length) {
    const endOfHeader = data.indexOf(0x0a, at)
    const [sha, , size] = data.subarray(at, endOfHeader).toString('utf8').split(' ')
    if (!Number.isInteger(Number(size))) throw new Error(`读不到对象 ${sha}`)
    const end = endOfHeader + 1 + Number(size)
    blobs.set(sha, data.subarray(endOfHeader + 1, end))
    at = end + 1
  }
  return blobs
}

/** 一个提交的全部文件：路径和内容。不看提交信息，也不看祖先。 */
export function auditTree(cwd, sha, rules, cache = new Map()) {
  const findings = []
  const entries = text(cwd, ['ls-tree', '-r', '-z', sha]).split('\0').filter(Boolean).map((entry) => {
    const tab = entry.indexOf('\t')
    const [mode, type, blob] = entry.slice(0, tab).split(' ')
    return { mode, type, blob, path: entry.slice(tab + 1) }
  })
  for (const entry of entries) {
    findings.push(...scanText(entry.path, rules).map((hit) => ({ kind: '文件路径', location: entry.path, rule: hit.rule, excerpt: hit.excerpt })))
  }
  const missing = entries.filter((entry) => entry.type === 'blob' && !cache.has(entry.blob))
  for (const [blob, bytes] of readBlobs(cwd, missing.map((entry) => entry.blob))) cache.set(blob, bytes)
  for (const entry of entries) {
    if (entry.type !== 'blob') continue
    const bytes = cache.get(entry.blob)
    if (bytes.subarray(0, 8000).includes(0)) continue
    findings.push(...scanText(bytes.toString('utf8'), rules).map((hit) => ({ kind: '文件内容', location: entry.path, line: hit.line, rule: hit.rule, excerpt: hit.excerpt })))
  }
  return findings.map((finding) => ({ where: sha.slice(0, 7), ...finding }))
}

/** 单独一个提交，不看祖先：提交信息全文、作者和提交者身份，加上它的全部文件。 */
export function auditRevision(cwd, rev, rules) {
  const sha = text(cwd, ['rev-parse', rev])
  const commit = auditCommit(cwd, sha, rules, new Map())
  return { commits: [commit], findings: commit.findings.map((finding) => ({ where: commit.sha, ...finding })) }
}

function auditCommit(cwd, sha, rules, cache) {
  const { actors, body } = readObject(cwd, sha)
  const names = { author: '作者', committer: '提交者' }
  const findings = [
    ...auditText(body, rules, '提交信息'),
    ...actors.flatMap((actor) => auditIdentity(names[actor.role] || actor.role, actor.name, actor.email, rules)),
    ...auditTree(cwd, sha, rules, cache).map(({ where, ...finding }) => finding),
  ]
  return { sha: sha.slice(0, 7), subject: body.split('\n')[0], findings }
}

/** 审查 revs 可达、但不被 exclude 可达的提交。 */
export function auditCommits(cwd, revs, { exclude = [], rules } = {}) {
  if (!revs.length) return { commits: [], findings: [] }
  const cache = new Map()
  const commits = text(cwd, ['rev-list', ...revs, ...(exclude.length ? ['--not', ...exclude] : [])]).split('\n').filter(Boolean)
    .map((sha) => auditCommit(cwd, sha, rules, cache))
  return { commits, findings: commits.flatMap((commit) => commit.findings.map((finding) => ({ where: commit.sha, ...finding }))) }
}

/** 附注标签的标签信息和打标签的人；轻量标签没有标签对象，返回空。 */
export function auditTagObject(cwd, ref, rules) {
  if (text(cwd, ['cat-file', '-t', ref]) !== 'tag') return []
  const { actors, body } = readObject(cwd, ref)
  return [
    ...(actors.length ? actors.flatMap((actor) => auditIdentity('打标签的人', actor.name, actor.email, rules)) : [{ kind: '标签', location: '标签', rule: '没有 tagger', excerpt: '' }]),
    ...auditText(body, rules, '标签信息'),
  ]
}

/** 审查一次推送：input 是 pre-push 钩子从标准输入读到的「本地引用 本地值 远端引用 远端值」各行。
 *  remoteRefs 是远端上现有的引用值（调用方用 git ls-remote 取得），这些提交一定已经发布。 */
export function auditPush(cwd, remote, input, rules, { remoteRefs = [] } = {}) {
  const updates = input.split('\n').filter(Boolean).map((line) => line.split(' '))
    .map(([localRef, localSha, remoteRef, remoteSha]) => ({ localRef, localSha, remoteRef, remoteSha }))
    .filter((update) => update.localSha && !ZERO.test(update.localSha) && /^refs\/(heads|tags)\//.test(update.remoteRef || ''))
  if (!updates.length) return { commits: [], findings: [] }
  // 只认远端自己的现状和这次推送里对方现有的值。本地缓存的远端分支可能过期，不算。
  const exclude = [...remoteRefs, ...updates.map((update) => update.remoteSha).filter((sha) => !ZERO.test(sha))]
  const { commits, findings } = auditCommits(cwd, updates.map((update) => update.localSha), { exclude, rules })
  const tags = updates.filter((update) => update.remoteRef.startsWith('refs/tags/')).map((update) => update.localSha)
  return { commits, findings: [...findings, ...tags.flatMap((ref) => auditTagObject(cwd, ref, rules).map((finding) => ({ where: ref.slice(0, 7), ...finding })))] }
}

/**
 * 给仓库装 pre-push 钩子：每次推送前把新的提交和标签过一遍审查，有命中就阻止推送，审查本身出错也阻止。
 * onlyRemote 是一段 shell 通配特征（如 github.com[:/]owner/repo），给了就只在远端地址匹配时才审查。
 */
export async function installPushHook({ cwd, tool = fileURLToPath(import.meta.url), onlyRemote } = {}) {
  const commonDir = text(cwd, ['rev-parse', '--git-common-dir'])
  const path = join(isAbsolute(commonDir) ? commonDir : join(cwd, commonDir), 'hooks', 'pre-push')
  const guard = onlyRemote ? `case "$2" in\n  *${onlyRemote}|*${onlyRemote}.git) ;;\n  *) exit 0 ;;\nesac\n` : ''
  const content = `#!/bin/sh\n# ${MARKER}。由发布脚本安装，不要手改。\n${guard}exec node "${tool}" --push --remote "$1" --repo "$(git rev-parse --show-toplevel)"\n`
  const current = await readFile(path, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (current === content) return { path, changed: false }
  if (current !== null && !current.includes(MARKER)) throw new Error(`${path} 已经有一个别的 pre-push 钩子，没有覆盖`)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, { mode: 0o755 })
  await chmod(path, 0o755)
  return { path, changed: true }
}

function report({ commits, findings }) {
  console.log(`脱敏审查：${commits.length} 个提交，${findings.length} 处命中`)
  for (const finding of findings) {
    const place = finding.line ? `${finding.location}:${finding.line}` : finding.location
    console.error(`  ${finding.where}  ${place}  [${finding.rule}] ${finding.excerpt}`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const value = (flag) => {
    const at = args.indexOf(flag)
    return at < 0 ? undefined : args[at + 1]
  }
  if (value('--install-hook')) {
    const { path, changed } = await installPushHook({ cwd: value('--install-hook'), onlyRemote: value('--only-remote') })
    console.log(`${changed ? '已安装' : '已是最新'} pre-push 钩子：${path}`)
    return
  }
  const cwd = value('--repo') || process.cwd()
  // 钩子把关的那一次不能没有私有名单：名单被挪走或删了就不放行，而不是当成没有名单。
  const rules = await loadRules(undefined, { required: args.includes('--push') })
  let result
  if (args.includes('--push')) {
    if (process.stdin.isTTY) throw new Error('--push 只供 pre-push 钩子调用')
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    const remote = value('--remote') || 'origin'
    // 直接问远端它现在有哪些引用；问不到就不放行。
    const remoteRefs = text(cwd, ['ls-remote', '--refs', remote]).split('\n').filter(Boolean).map((line) => line.split('\t')[0])
    result = auditPush(cwd, remote, Buffer.concat(chunks).toString('utf8'), rules, { remoteRefs })
  } else {
    const revs = args.filter((arg) => !arg.startsWith('--') && arg !== value('--repo'))
    if (!revs.length) throw new Error(USAGE)
    result = auditCommits(cwd, revs, { rules })
  }
  report(result)
  if (result.findings.length) {
    console.error(args.includes('--push') ? '\n推送已阻止：先处理上面的命中，再推到公开仓。' : '\n审查未通过：先处理上面的命中。')
    process.exitCode = 1
  }
}

// 是不是直接运行这个文件（而不是被 import）：按真实路径比。经软链接进来时（macOS 的 /tmp、/var）
// 命令行里是链接路径、import.meta.url 是真实路径，直接比不相等，钩子就会什么都不审、悄悄放行。
const invokedDirectly = () => {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
}
if (invokedDirectly()) {
  main().catch((error) => {
    console.error(`\n脱敏审查没能完成：${error.message}`)
    process.exitCode = 1
  })
}
