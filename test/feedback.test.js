import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:http'
import { Store } from '../src/store.js'
import {
  createFeedback,
  listFeedback,
  readFeedback,
  readFeedbackImage,
  setFeedbackStatus,
  feedbackRoot,
} from '../src/feedback.js'
import { route } from '../src/host.js'

const exec = promisify(execFile)
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=',
  'base64',
)
const image = (bytes = png) => ({
  data: `data:image/png;base64,${bytes.toString('base64')}`,
})
async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), 'wb-feedback-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return new Store(root)
}
test('问题和截图持久化、重试去重，不改变事项或撤销记录；CLI 可读取和关闭', async (t) => {
  const store = await setup(t)
  await store.mutate('原有事项', (state) =>
    state.ideas.push({ id: 'keep', text: '保留' }),
  )
  const before = await readFile(store.file, 'utf8'),
    undo = store.canUndo()
  const id = randomUUID(),
    body = {
      id,
      text: '输入框圆角问题\n截图中的内框太硬',
      images: [image()],
      view: 'learn',
    }
  const [first, retry] = await Promise.all([
    createFeedback(store, body),
    createFeedback(new Store(store.root), body),
  ])
  assert.equal(first.id, retry.id)
  await assert.rejects(
    createFeedback(store, { ...body, text: '变更后的内容' }),
    (error) => error.status === 409,
  )
  assert.equal((await listFeedback(new Store(store.root))).issues.length, 1)
  assert.deepEqual((await readFeedbackImage(store, id, '0')).bytes, png)
  assert.equal((await stat(first.images[0].path)).mode & 0o777, 0o600)
  const { stdout } = await exec(
    process.execPath,
    ['scripts/feedback.mjs', 'read', id, '--root', store.root],
    { cwd: new URL('..', import.meta.url) },
  )
  assert.equal(JSON.parse(stdout).text, body.text)
  assert.equal(JSON.parse(stdout).images[0].path, first.images[0].path)
  await exec(
    process.execPath,
    ['scripts/feedback.mjs', 'resolve', id, '--root', store.root],
    { cwd: new URL('..', import.meta.url) },
  )
  assert.equal((await readFeedback(store, id)).status, 'resolved')
  await setFeedbackStatus(store, id, 'open')
  assert.equal((await readFeedback(store, id)).status, 'open')
  assert.equal(await readFile(store.file, 'utf8'), before)
  assert.equal(store.canUndo(), undo)
})
test('截图或文字可单独登记，非法附件、大小和路径不会留下半条问题', async (t) => {
  const store = await setup(t)
  assert.equal(
    (await createFeedback(store, { text: '单独文字' })).images.length,
    0,
  )
  assert.equal((await createFeedback(store, { images: [image()] })).text, '')
  for (const body of [
    {},
    { text: 'x'.repeat(10001) },
    { images: 'bad' },
    { images: Array(5).fill(image()) },
    { id: '../state', text: 'x' },
    { images: [{ data: 'data:image/svg+xml;base64,PHN2Zz4=' }] },
    { images: [image(Buffer.from('not png'))] },
    { images: [image(Buffer.alloc(4 * 1024 * 1024 + 1))] },
    {
      images: Array(4).fill(
        image(Buffer.concat([png, Buffer.alloc(4 * 1024 * 1024 - png.length)])),
      ),
    },
  ])
    await assert.rejects(createFeedback(store, body))
  assert.equal((await readdir(feedbackRoot(store))).length, 2)
  await assert.rejects(readFeedback(store, '../state'))
  const issue = (await listFeedback(store)).issues[0]
  await assert.rejects(readFeedbackImage(store, issue.id, '../state'))
  await assert.rejects(setFeedbackStatus(store, issue.id, 'deleted'))
})
test('真实 HTTP 支持大截图、状态回读、图片类型及跨站拒绝', async (t) => {
  const store = await setup(t)
  const server = createServer((req, res) =>
    route({}, store, {}, req, res).catch((error) => {
      res.statusCode = error.status || 500
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: error.message }))
    }),
  )
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}/wb/`
  const post = (path, body, headers = {}) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  const bytes = Buffer.concat([png, Buffer.alloc(1600000)])
  const response = await post('feedback/create', {
    text: '大图',
    images: [image(bytes)],
  })
  assert.equal(response.status, 200)
  const { issue } = await response.json()
  const picture = await fetch(base + `feedback/image?id=${issue.id}&index=0`)
  assert.equal(picture.headers.get('content-type'), 'image/png')
  assert.equal(picture.headers.get('x-content-type-options'), 'nosniff')
  assert.deepEqual(Buffer.from(await picture.arrayBuffer()), bytes)
  assert.equal(
    (await post('feedback/status', { id: issue.id, status: 'resolved' }))
      .status,
    200,
  )
  const data = await (await fetch(base + 'feedback')).json()
  assert.equal(data.issues[0].status, 'resolved')
  assert.equal(data.stateRoot, store.root)
  assert.match(data.scriptPath, /scripts\/feedback.mjs$/)
  assert.equal(
    (
      await post(
        'feedback/create',
        { text: '不允许' },
        { 'sec-fetch-site': 'cross-site' },
      )
    ).status,
    403,
  )
  assert.equal(
    (await post('feedback/create', { text: 'x'.repeat(18 * 1024 * 1024) }))
      .status,
    413,
  )
  assert.equal((await listFeedback(store)).issues.length, 1)
})
