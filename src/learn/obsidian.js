// Obsidian 写入器：把学习笔记与每日报告写成 vault 里的 markdown 文件。
// 直写文件（vault 被 Obsidian/git 自动感知），不依赖任何 API；幂等靠「已存在就跳过」。
import { mkdir, readFile, readdir, realpath, rename, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'

import { LEARN_CATEGORY_LABELS, LEARN_SOURCE_LABELS, learnView, localDateOf, todayString } from '../ops.js'

/** 只允许写进现有 Obsidian vault 的相对目录。 */
export async function validateLearnTarget(target) {
  if (!isAbsolute(target.vaultPath)) throw new Error('Obsidian 库路径必须是绝对路径')
  const relativeDir = String(target.notesDir ?? '').trim()
  if (!relativeDir || isAbsolute(relativeDir) || relativeDir.split(/[\\/]+/).includes('..')) throw new Error('笔记目录必须是库内相对路径')
  const vault = resolve(target.vaultPath)
  const notes = resolve(vault, relativeDir)
  if (relative(vault, notes).startsWith('..')) throw new Error('笔记目录超出了 Obsidian 库')
  try {
    if (!(await stat(join(vault, '.obsidian'))).isDirectory()) throw new Error('不是 Obsidian 库')
  } catch {
    throw Object.assign(new Error(`找不到 Obsidian 库：${vault}（目录内应有 .obsidian）`), { status: 400 })
  }
  return { vaultPath: vault, notesDir: relativeDir }
}

/** 标题 → 文件名安全片段：去掉路径分隔与文件系统保留字符，限长。 */
export function slugify(title, max = 40) {
  const text = String(title ?? '')
    .replaceAll('/', ' ').replaceAll('\\', ' ').replaceAll(':', ' ')
    .replace(/[#*?'"<>|[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return (text || '未命名').slice(0, max)
}

function frontmatter(fields) {
  const lines = ['---']
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') continue
    lines.push(typeof value === 'boolean' || typeof value === 'number' ? `${key}: ${value}` : `${key}: ${JSON.stringify(value)}`)
  }
  lines.push('---')
  return lines.join('\n')
}

/** 笔记正文：刻意简短——问题、核心答案、为什么重要，三段封顶。 */
function noteBody({ question, answer, why, sourceLabel, project }) {
  const lines = []
  lines.push(`## 问题`)
  lines.push('')
  lines.push(question)
  lines.push('')
  if (answer) {
    lines.push(`## 核心`)
    lines.push('')
    lines.push(answer)
    lines.push('')
  }
  if (why) {
    lines.push(`## 为什么重要`)
    lines.push('')
    lines.push(why)
    lines.push('')
  }
  lines.push(`> 来源：${sourceLabel}${project ? ` · ${project}` : ''}`)
  return lines.join('\n')
}

/**
 * 写一条学习笔记。
 * 路径规则：给了 notePath 就按原路径重写（改分类重生成场景）；
 * 否则找「日期-标题」空闲文件名（重名追加序号，绝不覆盖已有笔记）。
 * @param {{vaultPath: string, notesDir: string}} target
 * @param {{title: string, question: string, category: string, concept: string, answer?: string,
 *   why?: string, source?: {harness?: string, project?: string}, askedAt?: string, date?: string,
 *   notePath?: string}} item
 * @returns {Promise<{path: string, created: boolean}>} vault 内相对路径与是否新建。
 */
export async function writeLearnNote(target, item) {
  target = await validateLearnTarget(target)
  if (item.notePath && (!item.notePath.endsWith('.md') || item.notePath.split(/[\\/]+/).some((part) => part === '..' || part === '.obsidian') || !item.notePath.startsWith(`${target.notesDir}/`))) throw new Error('笔记路径不在学习目录内')
  const date = item.date ?? todayString()
  await mkdir(join(target.vaultPath, target.notesDir), { recursive: true })
  const exists = async (relative) => {
    try {
      await stat(join(target.vaultPath, relative))
      return true
    } catch {
      return false
    }
  }
  const stem = join(target.notesDir, `${date}-${slugify(item.title)}`)
  let path
  let created
  if (item.notePath) {
    path = item.notePath
    created = !(await exists(path))
  } else {
    path = `${stem}.md`
    let suffix = 2
    while (await exists(path)) {
      path = `${stem}-${suffix}.md`
      suffix += 1
    }
    created = true
  }
  const sourceLabel = LEARN_SOURCE_LABELS[item.source?.harness] ?? '手动'
  const body = [
    frontmatter({
      date,
      category: item.category,
      concept: item.concept,
      source: item.source?.harness ?? 'manual',
      project: item.source?.project,
      mastered: item.mastered === true,
      learning_id: item.id,
      learning_kind: item.kind,
      parent_ids: item.parentIds,
      related_ids: item.relatedIds,
      tags: ['agent-learning', LEARN_CATEGORY_LABELS[item.category] ?? '学习'],
    }),
    '',
    `# ${item.title}`,
    '',
    noteBody({ question: item.question, answer: item.answer, why: item.why, sourceLabel, project: item.source?.project }),
    item.evidence ? `\n## 学习依据\n\n${item.evidence}\n` : '',
    item.links?.length ? `\n## 学习脉络\n\n${item.links.map((row) => row.notePath ? `- [[${row.notePath.replace(/\.md$/, '')}|${row.title}]]` : `- ${row.title}`).join('\n')}\n` : '',
    item.highlights?.length ? `\n## 划线记录\n\n${item.highlights.map((row) => `> ${row.text.replaceAll('\n', '\n> ')}${row.note ? `\n\n${row.note}` : ''}`).join('\n\n')}\n` : '',
    '',
  ].join('\n')
  await atomicWrite(join(target.vaultPath, path), body)
  return { path, created }
}

/** 更新一条已写笔记的 frontmatter 字段（mastered 状态回写）。 */
export async function updateNoteFields(target, notePath, fields) {
  target = await validateLearnTarget(target)
  if (!String(notePath).endsWith('.md') || !String(notePath).startsWith(`${target.notesDir}/`) || String(notePath).split(/[\\/]+/).some((part) => part === '..' || part === '.obsidian')) return false
  const file = join(target.vaultPath, notePath)
  let body
  try {
    body = await readFile(file, 'utf8')
  } catch {
    return false // 笔记文件不在（可能被用户挪走），静默跳过
  }
  if (!body.startsWith('---')) return false
  const end = body.indexOf('---', 3)
  if (end < 0) return false
  let fmText = body.slice(3, end).trim()
  for (const [key, value] of Object.entries(fields)) {
    const line = typeof value === 'boolean' ? `${key}: ${value}` : `${key}: ${JSON.stringify(value)}`
    const pattern = new RegExp(`^${key}:.*$`, 'm')
    fmText = pattern.test(fmText) ? fmText.replace(pattern, line) : `${fmText}\n${line}`
  }
  await atomicWrite(file, `---\n${fmText}\n${body.slice(end)}`)
  return true
}

function atomicWrite(file, body) {
  const tmp = `${file}.${process.pid}.tmp`
  return writeFile(tmp, body).then(() => rename(tmp, file))
}

/**
 * 生成/更新当日学习日报（同日重复整理时追加分节，不重复计数）。
 * 内容：统计、三类清单（带笔记相对链接）、查漏补缺（出现≥2次的未掌握概念）。
 * @param {{vaultPath: string, notesDir: string}} target
 * @param {object} state - 工作台 state（取 learn 段聚合）。
 * @param {{date?: string, addedToday?: Array<{title: string, notePath: string, category: string}>}} [options]
 */
export async function writeDailyReport(target, state, options = {}) {
  target = await validateLearnTarget(target)
  const date = options.date ?? todayString()
  const view = learnView(state)
  const dir = join(target.vaultPath, target.notesDir, '日报')
  await mkdir(dir, { recursive: true })
  const file = join(dir, `${date}.md`)
  // 同日多次整理要保留全天新增；仅用本次 created 会把早些时候的条目从日报抹掉。
  const addedMap = new Map()
  for (const row of state.learn.entries.filter((entry) => localDateOf(entry.createdAt) === date)) addedMap.set(row.notePath || row.id, row)
  for (const row of options.addedToday ?? []) addedMap.set(row.notePath || row.id || row.title, row)
  const added = [...addedMap.values()]
  const lines = []
  lines.push(`# 学习日报 · ${date}`)
  lines.push('')
  lines.push(`知识卡 ${state.learn.entries.length} 条 · 今日待复习 ${view.counts.dueReview} · 已掌握 ${view.counts.mastered} · 待整理 ${view.counts.pendingInbox}`)
  lines.push('')
  if (added.length) {
    lines.push(`## 今日新增（${added.length}）`)
    lines.push('')
    for (const row of added) {
      const label = LEARN_CATEGORY_LABELS[row.category] ?? row.category
      const link = row.notePath ? `[[${row.notePath.replace(/\.md$/, '')}]]` : row.title
      lines.push(`- ${label} · ${link}${row.answer ? ` — ${row.answer.replace(/\s+/g, ' ').slice(0, 80)}` : ''}`)
    }
    lines.push('')
  }
  const urgent = view.concepts.filter((row) => row.urgent)
  if (urgent.length) {
    lines.push(`## 查漏补缺（反复出现、还没掌握）`)
    lines.push('')
    for (const row of urgent) {
      lines.push(`- **${row.concept}**：近期问了 ${row.count} 次，最近 ${row.lastAskedAt.slice(5, 10)}`)
    }
    lines.push('')
  }
  const weak = view.recent.filter((row) => row.status === 'recorded' && row.category === 'weak').slice(0, 10)
  if (weak.length) {
    lines.push(`## 弱项清单`)
    lines.push('')
    for (const row of weak) {
      lines.push(`- [[${(row.notePath || row.title).replace(/\.md$/, '')}]]（${row.concept || '—'}）`)
    }
    lines.push('')
  }
  lines.push(`> 由工作台学习模块整理 · 概念掌握后在面板标记，日报次日更新`)
  await atomicWrite(file, lines.join('\n') + '\n')
  return { path: join(target.notesDir, '日报', `${date}.md`) }
}

/** 生成 obsidian:// 打开链接（面板「打开笔记」用）。 */
export function obsidianUri(vaultName, notePath) {
  const file = notePath.replace(/\.md$/, '')
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(file)}`
}

/** 控制台读取只能访问已登记的学习文件，且真实路径必须仍在 vault 内。 */
export async function readLearningFile(vaultPath, notePath) {
  if (typeof notePath !== 'string' || isAbsolute(notePath) || notePath.split(/[\\/]+/).some((part) => part === '..' || part === '.obsidian') || !notePath.endsWith('.md')) throw Object.assign(new Error('无效的学习文件路径'), { status: 400 })
  const root = await realpath(vaultPath)
  let file
  try { file = await realpath(join(root, notePath)) } catch (error) {
    if (error.code === 'ENOENT') throw Object.assign(new Error('文件已移动或删除；知识点的已记录内容仍可在工作台阅读'), { status: 404 })
    throw error
  }
  if (relative(root, file).startsWith('..') || isAbsolute(relative(root, file))) throw Object.assign(new Error('学习文件超出库目录'), { status: 403 })
  return { content: await readFile(file, 'utf8'), absolutePath: file, uri: `obsidian://open?path=${encodeURIComponent(file)}` }
}

export async function listLearningReports(state, target) {
  const targets = new Map([[`${target.vaultPath}/${target.notesDir}`, target]])
  for (const row of state.learn.reports || []) targets.set(`${row.vaultPath}/${row.path.split('/').slice(0,-2).join('/')}`, { vaultPath: row.vaultPath, notesDir: row.path.split('/').slice(0,-2).join('/') })
  for (const row of state.learn.entries) if (row.vaultPath && row.notePath) {
    const notesDir = row.notePath.split('/').slice(0,-1).join('/')
    targets.set(`${row.vaultPath}/${notesDir}`, {vaultPath:row.vaultPath,notesDir})
  }
  const reports = []
  for (const location of targets.values()) {
    const files = await readdir(join(location.vaultPath, location.notesDir, '日报')).catch((error) => { if (error.code === 'ENOENT') return []; throw error })
    for (const name of files.filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))) {
      const path = join(location.notesDir, '日报', name)
      reports.push({ id: Buffer.from(JSON.stringify([location.vaultPath,path])).toString('base64url'), date:name.slice(0,-3), path, vaultPath:location.vaultPath })
    }
  }
  return reports.sort((a,b) => b.date.localeCompare(a.date))
}
