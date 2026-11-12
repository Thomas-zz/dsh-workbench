// 持久化：$DSH_HOME/workbench/state.json。桌面端和 Web 端读同一份数据。
// 两个 Host 进程可能同时运行，所以每次写入前都按 mtime 判断是否需要重读。
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { migrateState } from './ops.js'

function dshHome(env = process.env) {
  return env.DSH_HOME || join(homedir(), '.dsh')
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
    this.state = migrateState(JSON.parse(await readFile(this.file, 'utf8')))
    this.mtimeMs = info.mtimeMs
  }

  async persist() {
    const tmp = `${this.file}.${process.pid}.tmp`
    await writeFile(tmp, JSON.stringify(this.state))
    await rename(tmp, this.file)
    this.mtimeMs = (await stat(this.file)).mtimeMs
  }

  /** 串行执行，避免同一进程内的并发写互相覆盖。 */
  run(task) {
    const next = this.queue.then(task, task)
    this.queue = next.catch(() => {})
    return next
  }

  read() {
    return this.run(async () => {
      await this.refresh()
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
      const before = undoable ? JSON.stringify(this.state) : null
      const result = await mutate(this.state)
      if (undoable) {
        const after = JSON.stringify(this.state)
        // 什么都没改的操作不占撤销位；单步撤销：任何后续可撤销操作都会覆盖它，
        // 因此撤销目标永远是「最近一次修改之前」的状态，回退总是安全的。
        if (after !== before) this.undo = { label, before, after }
      }
      await this.persist()
      return result
    })
  }

  canUndo() {
    return this.undo !== null && JSON.stringify(this.state) === this.undo.after
  }

  undoLast() {
    return this.run(async () => {
      const entry = this.undo
      if (!entry) return null
      this.undo = null
      await this.refresh()
      if (JSON.stringify(this.state) !== entry.after) throw new Error('已有新的记录或外部更新，无法撤销旧快照；当前内容已保留')
      this.state = migrateState(JSON.parse(entry.before))
      await this.persist()
      return entry.label
    })
  }
}
