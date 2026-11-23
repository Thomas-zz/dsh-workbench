// 持久化：$DSH_HOME/workbench/state.json。桌面端和 Web 端读同一份数据。
// 两个 Host 进程可能同时运行，所以每次写入前都按 mtime 判断是否需要重读。
import { mkdir, readFile, rename, stat, writeFile, open, unlink, copyFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { migrateState } from './ops.js'
import { settlePlan } from './planner.js'

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
function changes(before, after, path = []) {
  if (equal(before, after)) return []
  if (path.length === 1 && path[0] === 'revision') return []
  if (Array.isArray(before) && Array.isArray(after) && ['tasks', 'ideas', 'reviews'].includes(path[0]) && path.length === 1) {
    const a = Object.fromEntries(before.map((row) => [row.id, row]))
    const b = Object.fromEntries(after.map((row) => [row.id, row]))
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((key) => changes(a[key], b[key], [...path, key]))
  }
  if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((key) => changes(before[key], after[key], [...path, key]))
  }
  return [{ path, before, after }]
}
function atPath(state, path) {
  return path.reduce((value, key) => Array.isArray(value) && ['tasks', 'ideas', 'reviews'].includes(path[0]) ? value.find((row) => row.id === key) : value?.[key], state)
}
function restorePath(state, path, value) {
  const parent = atPath(state, path.slice(0, -1)), key = path.at(-1)
  if (Array.isArray(parent)) {
    const index = parent.findIndex((row) => row.id === key)
    if (index >= 0) parent.splice(index, 1)
    if (value !== undefined) parent.push(structuredClone(value))
  } else if (parent) {
    if (value === undefined) delete parent[key]
    else parent[key] = structuredClone(value)
  }
}

function dshHome(env = process.env) {
  return env.DSH_HOME || join(homedir(), '.dsh')
}

// A live host owns its work until it finishes or is cancelled, regardless of duration.
export function hostProcessAlive(pid) {
  if (pid === process.pid) return true
  if (!Number.isSafeInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true } catch (e) { return e.code !== 'ESRCH' }
}

export class Store {
  constructor(root = join(dshHome(), 'workbench')) {
    this.root = root
    this.file = join(root, 'state.json')
    this.state = null
    this.mtimeMs = 0
    this.undo = null
    this.queue = Promise.resolve()
  }

  /** 最近一次已知状态（同步读取，可能为 null 表示尚未加载）。 */
  latest() {
    return this.state
  }

  async refresh() {
    await mkdir(this.root, { recursive: true })
    let info = null
    try {
      info = await stat(this.file)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
    if (!info) {
      this.state = migrateState(null)
      await this.persist()
      return
    }
    if (this.state && info.mtimeMs === this.mtimeMs) return
    const raw = JSON.parse(await readFile(this.file, 'utf8'))
    if ((raw.schemaVersion || 0) < 2) {
      await copyFile(this.file, join(this.root, 'state.before-calendar-v2.json'), constants.COPYFILE_EXCL).catch((err) => { if (err.code !== 'EEXIST') throw err })
    }
    this.state = migrateState(raw)
    this.mtimeMs = info.mtimeMs
    if ((raw.schemaVersion || 0) < 2) await this.persist()
  }

  async persist() {
    const tmp = `${this.file}.${process.pid}.tmp`
    try {
      await writeFile(tmp, JSON.stringify(this.state))
      await rename(tmp, this.file)
      this.mtimeMs = (await stat(this.file)).mtimeMs
    } catch (error) {
      // A failed write must not remain as a successful in-memory state.
      this.state = null
      this.mtimeMs = 0
      this.undo = null
      throw error
    }
  }

  /** 串行执行，避免同一进程内的并发写互相覆盖。 */
  run(task) {
    const locked = async () => {
      await mkdir(this.root, { recursive: true })
      const file = join(this.root, '.write-lock')
      const token = `${process.pid}:${randomUUID()}`
      const started = Date.now()
      for (;;) {
        try {
          const handle = await open(file, 'wx', 0o600)
          try { await handle.writeFile(token) } finally { await handle.close() }
          break
        } catch (err) {
          if (err.code !== 'EEXIST') throw err
          const owner = await readFile(file, 'utf8').catch(() => '')
          const pid = Number(owner.split(':')[0])
          if (pid > 0) {
            try { process.kill(pid, 0) } catch (error) {
              if (error.code === 'ESRCH' && await readFile(file, 'utf8').catch(() => '') === owner) await unlink(file).catch(() => {})
            }
          } else {
            const info = await stat(file).catch(() => null)
            if (info && Date.now() - info.mtimeMs > 30000) await unlink(file).catch(() => {})
          }
          if (Date.now() - started > 10000) throw new Error('工作台正在保存，请稍后重试')
          await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 30))
        }
      }
      try { return await task() }
      finally { if (await readFile(file, 'utf8').catch(() => '') === token) await unlink(file).catch(() => {}) }
    }
    const next = this.queue.then(locked, locked)
    this.queue = next.catch(() => {})
    return next
  }

  read() {
    return this.run(async () => {
      await this.refresh()
      if (settlePlan(this.state, new Date(), hostProcessAlive)) { this.state.revision++; await this.persist() }
      return this.state
    })
  }

  /**
   * @param {string} label - 显示在撤销入口上的说明。
   * @param {(state: object) => any} mutate - 就地修改状态。
   * @param {{undoable?: boolean}} [options]
   * @returns {Promise<any>} mutate 的返回值。
   */
  mutate(label, mutate, { undoable = true } = {}) {
    return this.run(async () => {
      await this.refresh()
      const settled = settlePlan(this.state, new Date(), hostProcessAlive)
      const before = structuredClone(this.state)
      let result
      try { result = await mutate(this.state) }
      catch (error) {
        this.state = before
        // Rollover is independent of the rejected user/model operation.
        if (settled) { this.state.revision++; await this.persist() }
        throw error
      }
      if (undoable) {
        const delta = changes(before, this.state)
        if (delta.length) this.undo = { label, delta }
      }
      if (settled || !equal(before, this.state)) { this.state.revision++; await this.persist() }
      return result
    })
  }

  canUndo() {
    return this.undo !== null && this.undo.delta.every((d) => equal(atPath(this.state, d.path), d.after))
  }

  undoLast() {
    return this.run(async () => {
      const entry = this.undo
      if (!entry) return null
      await this.refresh()
      if (!this.canUndo()) { this.undo = null; throw new Error('这项内容已有新的修改，当前内容已保留') }
      for (const d of entry.delta) restorePath(this.state, d.path, d.before)
      this.undo = null
      this.state.revision++
      await this.persist()
      return entry.label
    })
  }
}
