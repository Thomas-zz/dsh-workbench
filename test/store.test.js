import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Store } from '../src/store.js'
import { migrateState } from '../src/ops.js'

async function tempStore() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-workbench-'))
  return { store: new Store(dir), dir }
}

test('空目录初始化出完整结构并落盘', async () => {
  const { store, dir } = await tempStore()
  try {
    const state = await store.read()
    assert.deepEqual(Object.keys(state).sort(), ['flags', 'ideas', 'learn', 'reviews', 'schemaVersion', 'tasks'])
    assert.equal(state.schemaVersion, 1)
    const raw = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8'))
    assert.equal(raw.schemaVersion, 1)
    assert.equal(store.canUndo(), false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('mutate 串行写入、单步撤销、后续后台变更使旧快照失效', async () => {
  const { store, dir } = await tempStore()
  try {
    await store.mutate('加一', (draft) => { draft.tasks.push({ id: 't1', title: '任务一', status: 'todo' }) })
    assert.equal(store.canUndo(), true)
    await store.mutate('非撤销', (draft) => { draft.tasks.push({ id: 't2', title: '任务二', status: 'todo' }) }, { undoable: false })
    assert.equal(store.canUndo(), false)
    await store.mutate('加三', (draft) => { draft.tasks.push({ id: 't3', title: '任务三', status: 'todo' }) })
    const label = await store.undoLast()
    assert.equal(label, '加三')
    const state = await store.read()
    assert.deepEqual(state.tasks.map((row) => row.id), ['t1', 't2'])
    assert.equal(store.canUndo(), false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('外部修改后按 mtime 重新加载（双进程共存）', async () => {
  const { store, dir } = await tempStore()
  try {
    await store.read()
    const file = join(dir, 'state.json')
    const external = migrateState(JSON.parse(await readFile(file, 'utf8')))
    external.reviews.push({ id: 'r_ext', kind: 'job', title: '外部写入', dedupeKey: 'job:x', status: 'pending' })
    await writeFile(file, JSON.stringify(external))
    const state = await store.read()
    assert.equal(state.reviews.some((row) => row.id === 'r_ext'), true)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
