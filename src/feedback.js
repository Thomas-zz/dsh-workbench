import {
  mkdir,
  readdir,
  readFile,
  writeFile,
  rename,
  rm,
} from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

import { FEEDBACK_LIMITS } from './feedback-limits.js'
export { FEEDBACK_LIMITS } from './feedback-limits.js'
export const FEEDBACK_BODY_LIMIT = 17 * 1024 * 1024
const ID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const VIEWS = {
  today: '计划',
  all: '项目',
  learn: '学习',
  activity: '整理记录',
}
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status })
}
const validId = (id) => {
  if (typeof id !== 'string' || !ID.test(id)) fail('问题编号无效')
  return id
}
export const feedbackRoot = (store) => resolve(store.root, 'feedback')

function imageData(image, index) {
  const match =
    typeof image?.data === 'string' &&
    image.data.match(
      /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/,
    )
  if (!match) fail('截图仅支持 PNG、JPEG 或 WebP')
  const [, type, encoded] = match
  const bytes = Buffer.from(encoded, 'base64')
  if (bytes.toString('base64') !== encoded) fail('截图数据无效')
  if (!bytes.length || bytes.length > FEEDBACK_LIMITS.imageBytes)
    fail('每张截图不能超过 4 MB', 413)
  const signature =
    type === 'image/png'
      ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
      : type === 'image/jpeg'
        ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : bytes.toString('ascii', 0, 4) === 'RIFF' &&
          bytes.toString('ascii', 8, 12) === 'WEBP'
  if (!signature) fail('截图格式与内容不符')
  return { bytes, type, file: `${index + 1}.${TYPES[type]}` }
}

async function readRecord(store, id) {
  validId(id)
  try {
    return JSON.parse(
      await readFile(join(feedbackRoot(store), id, 'issue.json'), 'utf8'),
    )
  } catch (error) {
    if (error.code === 'ENOENT') fail('问题不存在', 404)
    throw error
  }
}
function present(store, row) {
  const directory = join(feedbackRoot(store), row.id)
  return {
    ...row,
    path: join(directory, 'issue.json'),
    images: row.images.map((image, index) => ({
      ...image,
      path: join(directory, image.file),
      url: `wb/feedback/image?id=${row.id}&index=${index}`,
    })),
  }
}
export async function listFeedback(store) {
  const root = feedbackRoot(store)
  let names
  try {
    names = await readdir(root, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return { root, issues: [] }
    throw error
  }
  const rows = await Promise.all(
    names
      .filter((entry) => entry.isDirectory() && ID.test(entry.name))
      .map((entry) => readRecord(store, entry.name)),
  )
  return {
    root,
    issues: rows
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((row) => present(store, row)),
  }
}
export async function readFeedback(store, id) {
  return present(store, await readRecord(store, id))
}

export async function createFeedback(store, body) {
  if (!body || typeof body !== 'object') fail('问题内容无效')
  const id = validId(body.id || randomUUID())
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (text.length > FEEDBACK_LIMITS.text) fail('问题描述不能超过 10000 字')
  if (body.images !== undefined && !Array.isArray(body.images))
    fail('截图列表无效')
  if ((body.images?.length || 0) > FEEDBACK_LIMITS.images)
    fail('每条问题最多 4 张截图')
  const images = (body.images || []).map(imageData)
  if (!text && !images.length) fail('写下问题或添加截图后再保存')
  if (
    images.reduce((sum, item) => sum + item.bytes.length, 0) >
    FEEDBACK_LIMITS.totalBytes
  )
    fail('截图总大小不能超过 12 MB', 413)
  // Independent files keep feedback out of task history and make it readable by local Agents.
  return store.run(async () => {
    try {
      const previous = await readFeedback(store, id)
      if (previous.text !== text || previous.images.length !== images.length)
        fail('问题已保存，请重新登记修改后的内容', 409)
      for (let index = 0; index < images.length; index++) {
        if (
          !(await readFeedbackImage(store, id, index)).bytes.equals(
            images[index].bytes,
          )
        )
          fail('问题已保存，请重新登记修改后的内容', 409)
      }
      return previous
    } catch (error) {
      if (error.status !== 404) throw error
    }
    const root = feedbackRoot(store),
      temporary = join(root, `.draft-${randomUUID()}`)
    const now = new Date().toISOString()
    const row = {
      id,
      text,
      view: VIEWS[body.view] || '工作台',
      status: 'open',
      createdAt: now,
      updatedAt: now,
      images: images.map(({ type, file, bytes }) => ({
        type,
        file,
        size: bytes.length,
      })),
    }
    await mkdir(root, { recursive: true, mode: 0o700 })
    await mkdir(temporary, { mode: 0o700 })
    try {
      for (const image of images)
        await writeFile(join(temporary, image.file), image.bytes, {
          mode: 0o600,
        })
      await writeFile(
        join(temporary, 'issue.json'),
        JSON.stringify(row, null, 2) + '\n',
        { mode: 0o600 },
      )
      await rename(temporary, join(root, id))
    } catch (error) {
      await rm(temporary, { recursive: true, force: true })
      throw error
    }
    return present(store, row)
  })
}
export async function setFeedbackStatus(store, id, status) {
  validId(id)
  if (!['open', 'resolved'].includes(status)) fail('问题状态无效')
  return store.run(async () => {
    const row = await readRecord(store, id)
    row.status = status
    row.updatedAt = new Date().toISOString()
    const file = join(feedbackRoot(store), id, 'issue.json'),
      temporary = `${file}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, JSON.stringify(row, null, 2) + '\n', {
        mode: 0o600,
      })
      await rename(temporary, file)
    } finally {
      await rm(temporary, { force: true })
    }
    return present(store, row)
  })
}
export async function readFeedbackImage(store, id, index) {
  if (!/^\d$/.test(String(index))) fail('截图编号无效')
  const row = await readRecord(store, id),
    image = row.images[Number(index)]
  if (
    !image ||
    !/^[1-4]\.(png|jpg|webp)$/.test(image.file) ||
    !TYPES[image.type]
  )
    fail('截图不存在', 404)
  return {
    type: image.type,
    bytes: await readFile(join(feedbackRoot(store), id, image.file)),
  }
}
