// 切换桌面 profile 的工作台来源，只改依赖指向，不动事项数据：
//   dev      直链本开发目录，改完 build、重启桌面 Host 即生效
//   vX.Y.Z   ~/.local/share/<包名>/releases 里已发布的本地包，开发版出问题时用它回退
import { copyFile, lstat, mkdir, readFile, readlink, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const repo = await realpath(fileURLToPath(new URL('../', import.meta.url)))
const pkg = JSON.parse(await readFile(join(repo, 'package.json'), 'utf8'))
const args = process.argv.slice(2)
const option = (flag, fallback) => {
  const at = args.indexOf(flag)
  return at < 0 ? fallback : args.splice(at, 2)[1]
}
const profile = resolve(option('--profile', join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'profiles', 'desktop')))
const data = join(homedir(), '.local', 'share', pkg.name)
const releases = resolve(option('--releases', join(data, 'releases')))
const backups = join(releases, '..', 'backups')
const channel = args[0]
const manifest = join(profile, 'package.json')
const lockfile = join(profile, 'pnpm-lock.yaml')
const link = join(profile, 'node_modules', pkg.name)

let current
try {
  current = JSON.parse(await readFile(manifest, 'utf8')).dependencies?.[pkg.name]
} catch (error) {
  console.error(`读不到桌面 profile：${manifest}（${error.message}）`)
  process.exit(1)
}
if (!channel) {
  console.log(`桌面 profile：${profile}\n${pkg.name}：${current || '未安装'}\n用法：node scripts/channel.mjs <dev | vX.Y.Z>`)
  process.exit(0)
}

try {
  if (channel !== 'dev' && !/^v\d+\.\d+\.\d+$/.test(channel)) throw new Error(`不认识的来源「${channel}」，只能是 dev 或 vX.Y.Z`)
  const target = channel === 'dev' ? repo : join(releases, channel, 'package')
  const installed = await readFile(join(target, 'package.json'), 'utf8').then(JSON.parse, () => null)
  if (installed?.name !== pkg.name) throw new Error(channel === 'dev' ? `${target} 不是 ${pkg.name}` : `本机没有发布包 ${channel}（应在 ${target}）；先用 npm run release 发布一次`)
  const spec = `link:${target}`
  if (current === spec) {
    console.log(`桌面已经指向${channel === 'dev' ? '开发目录' : `发布包 ${channel}`}：${target}`)
    process.exit(0)
  }
  if (!current?.startsWith('link:')) throw new Error(`桌面 profile 里的 ${pkg.name} 不是 link 依赖（${current || '未声明'}），没有改动`)

  // 先把要写的内容全部算好，再动文件。
  const pattern = new RegExp(`"${escape(pkg.name)}"\\s*:\\s*"[^"]*"`)
  if (!pattern.test(await readFile(manifest, 'utf8'))) throw new Error(`桌面 package.json 里找不到 ${pkg.name} 的依赖声明，没有改动`)
  const nextManifest = (await readFile(manifest, 'utf8')).replace(pattern, `"${pkg.name}": "${spec}"`)
  if (JSON.parse(nextManifest).dependencies[pkg.name] !== spec) throw new Error('改写桌面 package.json 的结果不对，没有改动')
  const block = new RegExp(`(\\n[ \\t]*['"]?${escape(pkg.name)}['"]?:\\n[ \\t]*specifier: )link:[^\\n]*(\\n[ \\t]*version: )link:[^\\n]*`)
  const lock = await readFile(lockfile, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  const nextLock = lock && block.test(lock)
    ? lock.replace(block, (_, head, tail) => `${head}${spec}${tail}link:${relative(profile, target)}`)
    : null

  const info = await lstat(link).catch((error) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (info && !info.isSymbolicLink()) throw new Error(`${link} 是实际安装的目录而不是软链接，没有改动`)

  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  const stamp = [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join('')
  const backup = join(backups, `pre-${channel}-${stamp}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`)
  await mkdir(backup, { recursive: true })
  await copyFile(manifest, join(backup, 'package.json'))
  if (lock) await copyFile(lockfile, join(backup, 'pnpm-lock.yaml'))
  await writeFile(join(backup, 'previous-link.txt'), `${current}\n${info ? await readlink(link) : ''}\n`)

  await writeFile(manifest, nextManifest)
  if (nextLock) await writeFile(lockfile, nextLock)
  if (info) await rm(link)
  await symlink(target, link, 'dir')
  if ((await realpath(link)) !== (await realpath(target))) throw new Error('软链接校验失败')

  console.log(`${pkg.name} → ${channel === 'dev' ? '开发目录' : `发布包 ${channel}`}\n  ${target}\n改前的 profile 文件备份在 ${backup}\n重启 DSH 桌面后 Host 生效；前端刷新页面即可。`)
  if (lock && !nextLock) console.log('锁文件里没有 link 形式的条目，未改动；下次 pnpm install 会自行更新。')
} catch (error) {
  console.error(`切换失败：${error.message}`)
  process.exit(1)
}
