// 发布脚本的参数解析。npm 会把没写在 -- 后面的 --dry-run、--bump、--yes 当成它自己的配置吃掉，
// 脚本收不到这些参数却照常运行（实测 npm 11：脚本只收到多出来的那个值）。所以除了认参数，
// 还认 npm 留在环境变量里的痕迹，遇到就拒绝执行。
const USAGE = '用法：npm run release -- --dry-run --bump patch（演练）；npm run release -- --bump patch（发布）'
// 参数名 → 后面是否带一个值。
const FLAGS = { '--dry-run': false, '--yes': false, '--bump': true, '--version': true, '--notes': true, '--public': true, '--releases': true }
const key = (flag) => flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
const envName = (flag) => `npm_config_${flag.slice(2).replace(/-/g, '_')}`

/** 解析参数，返回 { dryRun, yes, bump, version, notes, public, releases }；有不认识的参数就抛错。 */
export function parseReleaseArgs(args, env = process.env) {
  // 这三个和 npm 自己的配置同名，最容易被吃掉；先认这个，再解析剩下的参数。
  const given = (flag) => args.includes(flag)
  const swallowed = ['--dry-run', '--bump', '--yes'].filter((flag) => !given(flag) && env[envName(flag)] !== undefined)
  if (swallowed.length) {
    throw new Error(`参数被 npm 当成它自己的配置吃掉了（${swallowed.join('、')}），脚本没有收到。参数要写在 -- 后面：npm run release -- ${swallowed.join(' ')} …`)
  }
  const values = { dryRun: false, yes: false }
  for (let i = 0; i < args.length;) {
    const takesValue = FLAGS[args[i]]
    if (takesValue === undefined) throw new Error(`不认识的参数「${args[i]}」。${USAGE}`)
    if (takesValue && (args[i + 1] === undefined || args[i + 1].startsWith('--'))) throw new Error(`「${args[i]}」后面要带一个值。${USAGE}`)
    values[key(args[i])] = takesValue ? args[i + 1] : true
    i += takesValue ? 2 : 1
  }
  return values
}
