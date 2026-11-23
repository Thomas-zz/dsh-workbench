// Run the actual web host, without mounting the desktop profile, credentials or sessions.
import { createHash } from 'node:crypto'
import { mkdir, readlink, stat, symlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { Store } from '../src/store.js'

const repo = fileURLToPath(new URL('../', import.meta.url))
const base = join(homedir(), '.local', 'share', 'dsh-workbench-web')
await mkdir(base, { recursive: true, mode: 0o700 })
// One home per checkout: testing another branch must not switch this host's code.
const home = join(base, createHash('sha256').update(repo).digest('hex').slice(0, 16))
const dshHome = join(home, '.dsh')
const profile = join(dshHome, 'profiles', 'workbench-web')
const modules = join(profile, 'node_modules')
await mkdir(modules, { recursive: true, mode: 0o700 })
async function seed(path, contents) {
  try { await writeFile(path, contents, { flag: 'wx', mode: 0o600 }) }
  catch (e) { if (e.code !== 'EEXIST') throw e }
}
await seed(join(profile, 'package.json'), JSON.stringify({ name: 'dsh-profile-workbench-web', private: true,
  dependencies: { 'dsh-workbench': `link:${repo}` }, dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-workbench'] } },
}, null, 2))
await seed(join(profile, 'cordis.yml'), '[]\n')
await seed(join(profile, 'cordis.patch.yml'), '[]\n')
const link = join(modules, 'dsh-workbench')
try { await symlink(repo, link, 'dir') } catch (e) {
  if (e.code !== 'EEXIST' || resolve(await readlink(link)) !== resolve(repo)) throw e
}
const vault = join(home, 'Test Vault')
await mkdir(join(vault, '.obsidian'), { recursive: true })
const store = new Store(join(dshHome, 'workbench'))
// Do not enable automatic model use in a developer profile, even on restart.
await store.mutate('Web 测试启动', (s) => {
  s.plan.config.enabled = false
  s.learn.config.reportPush = false
  s.mail.config.automatic = false
  s.learn.config.vaultPath = vault
}, { undoable: false })
const macCLI = '/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh'
const cli = process.env.DSH_BIN || (process.platform === 'darwin' && await stat(macCLI).catch(() => false) ? macCLI : 'dsh')
const tmp = join(home, 'tmp')
await mkdir(tmp, { recursive: true, mode: 0o700 })
const env = { PATH: process.env.PATH, HOME: home, USERPROFILE: home, DSH_HOME: dshHome,
  XDG_CONFIG_HOME: join(home, '.config'), XDG_DATA_HOME: join(home, '.local/share'), XDG_CACHE_HOME: join(home, '.cache'),
  LANG: process.env.LANG || 'en_US.UTF-8', TMPDIR: tmp }
for (const key of ['SystemRoot', 'ComSpec', 'PATHEXT']) if (process.env[key]) env[key] = process.env[key]
console.log(`DSH Web 开发环境：${dshHome}`)
const args = ['--profile', 'workbench-web', '--host', '127.0.0.1', '--port', process.env.WB_WEB_PORT || '4327']
if (process.env.WB_WEB_NO_OPEN === '1') args.push('--no-open')
const child = spawn(cli, args, { env, cwd: home, stdio: 'inherit' })
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig))
child.on('error', (err) => { console.error(`无法启动 DSH Web：${err.message}。可用 DSH_BIN 指定 CLI。`); process.exitCode = 1 })
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 0 : 1) })
