// 发布稳定版：取私有仓 main 上的一个提交，在干净的导出目录里安装、测试、构建并做脱敏审查，
// 通过后把同一个提交以「一个版本一个提交」的快照推到公开仓并建 Release。
// 公开仓只收快照；私有历史、未发布的分支和本机文件都不过去。流程与安装见 DEVELOPMENT.md。
//
//   npm run release -- --dry-run --bump patch   只演练到公开仓快照校验，不提交、不推送
//   npm run release -- --bump patch             升版本号并发布；也可写 --version 0.3.0
//   npm run release                              中断后重跑：接着发 HEAD 上已打过标签的版本
// 参数必须写在 -- 后面。npm 会把直接跟在后面的 --dry-run 当成它自己的配置，脚本会拒绝执行并提示写法。
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { parseReleaseArgs } from './release-args.mjs'
import { auditTree, installPushHook, loadRules } from './release-audit.mjs'
import { scanText } from './release-scan.mjs'

const sh = (command, args, cwd, { show = false, env } = {}) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: show ? 'inherit' : 'pipe', env: { ...process.env, ...env } })
  if (result.status !== 0) {
    const label = show ? [command, ...args].slice(0, 4).join(' ') : `${command} ${args.join(' ')}`
    throw new Error(`「${label}」失败（退出码 ${result.status}）${show ? '' : `\n${(result.stderr || result.stdout || '').trim()}`}`)
  }
  return (result.stdout || '').trim()
}
const git = (dir, args, options) => sh('git', args, dir, options)
const ask = (question) => new Promise((answer) => {
  const io = createInterface({ input: process.stdin, output: process.stdout })
  io.question(question, (text) => { io.close(); answer(text) })
})
const bumpVersion = (version, part) => {
  const parts = version.split('.').map(Number)
  const index = { major: 0, minor: 1, patch: 2 }[part]
  if (parts.length !== 3 || !parts.every(Number.isInteger) || index === undefined) throw new Error(`版本号 ${version} 或 --bump ${part} 不合法`)
  parts[index] += 1
  for (let i = index + 1; i < 3; i++) parts[i] = 0
  return parts.join('.')
}

/** 把版本号写进 package.json 与锁文件并提交、打标签；出现版本号以外的差异就还原并拒绝。 */
async function stampVersion(repo, version, tag) {
  const files = ['package.json', 'package-lock.json']
  const before = files.map((file) => git(repo, ['show', `HEAD:${file}`]))
  const after = before.map((text) => {
    const json = JSON.parse(text)
    json.version = version
    if (json.packages?.['']) json.packages[''].version = version
    return `${JSON.stringify(json, null, 2)}\n`
  })
  try {
    for (const [index, file] of files.entries()) await writeFile(join(repo, file), after[index])
    const changed = git(repo, ['diff', '--name-only']).split('\n').filter(Boolean)
    const lines = git(repo, ['diff', '--unified=0']).split('\n').filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---)/.test(line))
    if (changed.some((file) => !files.includes(file)) || !lines.every((line) => /^[+-]\s*"version": "\d+\.\d+\.\d+",?$/.test(line))) throw new Error('升版本号产生了版本号以外的差异')
    if (changed.length) git(repo, ['commit', '-am', tag])
    git(repo, ['tag', '-a', tag, '-m', tag])
  } catch (error) {
    for (const [index, file] of files.entries()) await writeFile(join(repo, file), before[index])
    throw error
  }
}

async function main() {
  // 先验参数再做任何事：被 npm 吃掉参数的调用不能走到后面去。
  const { dryRun, yes, bump: part, version: explicit, notes, public: publicOption, releases: releasesOption } = parseReleaseArgs(process.argv.slice(2))
  const repo = fileURLToPath(new URL('../', import.meta.url))
  const pkg = JSON.parse(await readFile(join(repo, 'package.json'), 'utf8'))
  const publicDir = resolve(publicOption || join(repo, '..', `${pkg.name}-public`))
  const releasesDir = resolve(releasesOption || join(homedir(), '.local', 'share', pkg.name, 'releases'))
  const distFile = pkg.exports['./client']
  if (!dryRun && !yes && !process.stdin.isTTY) throw new Error('发布需要交互确认；非交互环境请加 --yes')

  // 1. 开发目录：在 main 上、没有未提交的改动、不落后于私有仓。
  if (git(repo, ['branch', '--show-current']) !== 'main') throw new Error('只在 main 上发布；功能分支先合回 main')
  if (git(repo, ['status', '--porcelain', '--untracked-files=all'])) throw new Error('开发目录有未提交的改动，先提交或收起')
  git(repo, ['fetch', 'origin', 'main'])
  if (git(repo, ['rev-list', '--count', 'HEAD..origin/main']) !== '0') throw new Error('本地的 main 落后于私有仓的 origin/main，先 git pull')

  // 2. 版本号与标签。演练时不落任何提交，把 HEAD 当作候选。
  if (explicit && part) throw new Error('--version 和 --bump 只能给一个')
  const head = git(repo, ['rev-parse', 'HEAD'])
  const onHead = (name) => !!git(repo, ['tag', '--list', name]) && git(repo, ['rev-parse', `${name}^{commit}`]) === head
  // 上次升完版本号就中断：标签已经打在 HEAD 上，接着发这个版本，不再往上升。
  const stamped = onHead(`v${pkg.version}`)
  const version = stamped ? pkg.version : explicit || (part ? bumpVersion(pkg.version, part) : pkg.version)
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`版本号 ${version} 不合法`)
  const tag = `v${version}`
  if (stamped) {
    if (explicit && explicit !== pkg.version) throw new Error(`HEAD 已经是打过标签的 v${pkg.version}，不能再发成 ${tag}`)
    if (explicit || part) console.log(`HEAD 上的 v${pkg.version} 已经打过标签，接着发布它`)
  } else if (!explicit && !part) {
    throw new Error(`没有指定版本（package.json 现在是 ${pkg.version}）。演练：npm run release -- --dry-run --bump patch；发布：npm run release -- --bump patch`)
  } else if (git(repo, ['tag', '--list', tag])) {
    // 只在本机、还没推到私有仓的同名标签，多半是上次检查没过留下的，删掉就能重跑。
    const pushed = spawnSync('git', ['ls-remote', '--exit-code', 'origin', `refs/tags/${tag}`], { cwd: repo, encoding: 'utf8' }).status === 0
    throw new Error(`${tag} 已经打过（在别的提交上），换一个版本号。${pushed ? '这个标签已经在私有仓上。' : `这个标签还没推到私有仓；如果是上次没发成的版本，git tag -d ${tag} 后重跑。`}`)
  } else if (!dryRun) {
    await stampVersion(repo, version, tag)
  }
  console.log(`\n== ${tag} ← ${git(repo, ['rev-parse', '--short', 'HEAD'])}${dryRun ? '（演练）' : ''}`)

  // 3. 导出这个提交，在干净目录里安装、测试、构建。
  const work = await mkdtemp(join(tmpdir(), `${pkg.name}-release-`))
  let keepWork = false
  try {
    const tar = join(work, 'head.tar')
    const source = join(work, 'source')
    git(repo, ['archive', '--format=tar', '-o', tar, 'HEAD'])
    await mkdir(source)
    sh('tar', ['-xf', tar, '-C', source], work)
    const exported = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'))
    if (exported.version !== version) await writeFile(join(source, 'package.json'), `${JSON.stringify({ ...exported, version }, null, 2)}\n`)
    console.log('\n== 干净目录安装')
    sh('npm', ['ci', '--no-audit', '--no-fund'], source, { show: true })
    console.log('\n== 测试')
    sh('npm', ['test'], source, { show: true })
    const committed = await readFile(join(source, distFile))
    sh('npm', ['run', 'build'], source)
    if (!(await readFile(join(source, distFile))).equals(committed)) throw new Error(`提交里的 ${distFile} 与源码的构建结果不一致：在开发目录 npm run build 后提交`)

    // 4. 脱敏审查：发布提交的每个文件（内容和路径）加上发布说明。公开的是快照提交，它的提交信息和身份
    //    由公开仓克隆决定，所以这两项在推送时由 pre-push 钩子审查，不看私有仓这个提交自己的信息，也不看祖先。
    const rules = await loadRules(repo, { required: true })
    const hits = [...auditTree(repo, head, rules), ...scanText(notes || '', rules).map((hit) => ({ where: '发布说明', kind: '发布说明', location: '发布说明', ...hit }))]
    console.log(`\n== 脱敏审查：${hits.length} 处命中`)
    if (hits.length) {
      for (const hit of hits) console.error(`  ${hit.where}  ${hit.line ? `${hit.location}:${hit.line}` : hit.location}  [${hit.rule}] ${hit.excerpt}`)
      throw new Error('脱敏审查有命中，先处理再发布')
    }

    // 5. 打包，核对包里只有清单内的内容，并留一份本地回退包。
    const tgzName = `${pkg.name}-${version}.tgz`
    sh('npm', ['pack', '--pack-destination', work], source)
    const tgz = join(work, tgzName)
    const sha = createHash('sha256').update(await readFile(tgz)).digest('hex')
    const entries = sh('tar', ['-tzf', tgz], work).split('\n').map((entry) => entry.replace(/^package\/|\/$/g, '')).filter(Boolean)
    // 清单里的目录包含其下全部内容，文件只包含自身；与 npm 的 files 规则一致。
    const expected = (entry) => ['package.json', 'index.js', 'README.md', 'LICENSE', 'LICENSE.md', 'LICENSE.txt'].includes(entry)
      || entry.startsWith('node_modules/')
      || pkg.files.some((path) => entry === path || entry.startsWith(`${path.replace(/\/$/, '')}/`))
    const unexpected = [...new Set(entries.filter((entry) => !expected(entry)))]
    if (unexpected.length) throw new Error(`包里出现了清单以外的内容：${unexpected.slice(0, 12).join('、')}`)
    console.log(`\n== 打包：${tgzName}，${entries.length} 个条目\n   sha256 ${sha}`)
    // 回退包等用户确认之后再落盘（见下方），中途停下不会留下没发布过的版本的包。
    const keep = join(releasesDir, version)

    // 6. 公开仓快照：先在临时索引里核对「导出内容 == 发布提交的树」，一致才动公开仓克隆。
    if (!(await stat(join(publicDir, '.git')))) throw new Error(`找不到公开仓克隆 ${publicDir}，可用 --public 指定`)
    git(publicDir, ['fetch', 'origin'])
    if (git(publicDir, ['branch', '--show-current']) !== 'main') throw new Error('公开仓克隆不在 main 上')
    if (git(publicDir, ['status', '--porcelain', '--untracked-files=all'])) throw new Error('公开仓克隆有未提交的改动，先处理')
    const email = git(publicDir, ['config', '--get', 'user.email'])
    if (!/@users\.noreply\.github\.com$/.test(email || '')) throw new Error(`公开仓克隆的提交邮箱（${email || '未设置'}）不是 GitHub noreply 地址，先改这个克隆的 user.email`)
    const tree = git(repo, ['rev-parse', 'HEAD^{tree}'])
    const snapshot = join(work, 'snapshot')
    await mkdir(snapshot)
    sh('tar', ['-xf', tar, '-C', snapshot], work)
    const staged = (...others) => sh('git', ['--git-dir', join(publicDir, '.git'), '--work-tree', snapshot, ...others], snapshot, { env: { GIT_INDEX_FILE: join(work, 'index') } })
    staged('read-tree', 'origin/main')
    staged('add', '-A')
    if (staged('write-tree') !== tree) throw new Error('导出内容与发布提交的树不一致，没有改动公开仓')
    const publicHead = git(publicDir, ['rev-parse', 'HEAD'])
    const remote = git(publicDir, ['rev-parse', 'origin/main'])
    const published = git(publicDir, ['tag', '--list', tag])
    const sameSnapshot = published && git(publicDir, ['rev-parse', `${tag}^{tree}`]) === tree
    // 上次推送到一半中断时，允许公开仓克隆停在本次要推的快照上。
    const resumed = sameSnapshot && git(publicDir, ['merge-base', remote, publicHead]) === remote
    if (publicHead !== remote && !resumed) throw new Error('公开仓克隆与 origin/main 不一致，先 git pull 或 reset')
    if (published && !sameSnapshot) throw new Error(`公开仓已经有 ${tag}，内容和本次发布不同；不覆盖`)
    const slug = git(publicDir, ['remote', 'get-url', 'origin']).match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)?.[1]
    // 脱敏审查的最后一道闸：公开仓克隆里的每次推送（包括手工 git push）都再审一遍；
    // 开发目录里指向公开仓地址的推送也拦下来审，私有历史不能从这条路出去。
    const auditTool = join(repo, 'scripts', 'release-audit.mjs')
    await installPushHook({ cwd: publicDir, tool: auditTool })
    if (slug) await installPushHook({ cwd: repo, tool: auditTool, onlyRemote: `github.com[:/]${slug}` })
    if (dryRun) {
      console.log(`\n演练通过：${tag} 的导出内容可原样作为公开仓快照（树 ${tree.slice(0, 12)}）。没有提交，没有推送。`)
      return
    }

    // 认不出 GitHub 仓库的克隆多半是测试环境，不让它往本机真实的回退包目录里写。
    if (!slug && !releasesOption) throw new Error(`公开仓克隆的 origin 不是 GitHub 地址，像是测试环境：回退包目录请用 --releases 显式指定（默认会写到 ${releasesDir}）。本次没有推送`)
    console.log(`\n== 即将发布\n   私有仓  ${git(repo, ['remote', 'get-url', 'origin'])}  main 与 ${tag}\n   公开仓  ${slug}  main 新增一个快照提交\n   回退包  ${keep}`)
    if (!yes && !/^y(es)?$/i.test((await ask('推送到公开仓并创建 Release？[y/N] ')).trim())) throw new Error('已取消：本地提交与标签保留，公开仓未改动')

    if (!(await stat(keep).catch(() => null))) {
      await mkdir(join(keep, 'package'), { recursive: true })
      await cp(tgz, join(keep, tgzName))
      await writeFile(join(keep, 'SHA256SUMS'), `${sha}  ${tgzName}\n`)
      sh('tar', ['-xzf', tgz, '-C', join(keep, 'package'), '--strip-components=1'], work)
    }

    if (!published) {
      // 把公开仓克隆的工作区换成导出内容：只删已跟踪的文件，未跟踪的（如 node_modules）不动。
      for (const file of git(publicDir, ['ls-files', '-z']).split('\0').filter(Boolean)) await rm(join(publicDir, file), { force: true })
      for (const entry of await readdir(snapshot)) await cp(join(snapshot, entry), join(publicDir, entry), { recursive: true })
      git(publicDir, ['add', '-A'])
      if (git(publicDir, ['write-tree']) !== tree) throw new Error('公开仓克隆暂存的内容与发布提交不一致，没有推送')
      git(publicDir, ['commit', '-m', tag])
      git(publicDir, ['tag', '-a', tag, '-m', tag])
    }

    // 7. 先推私有仓（标签与提交要有备份），再推公开仓。
    console.log('\n== 推送')
    git(repo, ['push', 'origin', 'main'], { show: true })
    git(repo, ['push', 'origin', tag], { show: true })
    git(publicDir, ['push', 'origin', 'main'], { show: true })
    git(publicDir, ['push', 'origin', tag], { show: true })

    // 8. Release 资产。gh 已登录且能认出 GitHub 仓库名就全自动，否则列出要手动上传的文件。
    // 只装没登录时每条 gh 命令都会失败，所以判断的是「已登录」而不是「已安装」。
    const assets = [join(keep, tgzName), join(keep, 'SHA256SUMS')]
    const gh = (others) => spawnSync('gh', others, { cwd: repo, stdio: 'ignore' }).status === 0
    if (slug && gh(['auth', 'status', '--hostname', 'github.com'])) {
      const exists = gh(['release', 'view', tag, '--repo', slug])
      sh('gh', exists ? ['release', 'upload', tag, ...assets, '--repo', slug] : ['release', 'create', tag, ...assets, '--repo', slug, '--title', tag, '--notes', notes || tag], repo, { show: true })
      console.log(`\n已发布：https://github.com/${slug}/releases/tag/${tag}`)
    } else {
      const why = slug ? 'gh 没有登录到 GitHub' : '公开仓克隆的 origin 不是 GitHub 地址'
      console.log(`\n代码与标签已推送。${why}，请手动建 Release 并上传：\n  ${assets.join('\n  ')}\n  https://github.com/${slug || '<owner>/<repo>'}/releases/new?tag=${tag}`)
    }
    console.log(`桌面仍指向开发目录，不受影响；需要回退时执行 node scripts/channel.mjs ${tag}`)
  } catch (error) {
    keepWork = true
    throw error
  } finally {
    if (keepWork) console.error(`临时目录保留供排查：${work}`)
    else await rm(work, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(`\n发布中止：${error.message}`)
  process.exit(1)
})
