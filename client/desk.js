// 浏览器侧的状态：Host 状态的本地镜像 + 只属于界面的选中、视图、轮询。
import React from 'react'
import { t } from './i18n.js'

const BASE = 'wb/'
const POLL_MS = 15_000

let snapshot = {
  state: null, canUndo: false, error: null, view: 'today',
  expandedId: null, captureKind: 'idea', filter: '', toastObj: null, refreshing: false,
}
const listeners = new Set()

export function getDesk() {
  return snapshot
}

export function setDesk(patch) {
  snapshot = { ...snapshot, ...(typeof patch === 'function' ? patch(snapshot) : patch) }
  listeners.forEach((fn) => fn())
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useDesk(selector) {
  return React.useSyncExternalStore(subscribe, () => selector(snapshot))
}

async function request(path, body) {
  const res = await fetch(BASE + path, body === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`)
  return data
}

let toastTimer = null
export function toast(text, { error = false } = {}) {
  clearTimeout(toastTimer)
  setDesk({ toastObj: { text, error, key: Date.now() } })
  toastTimer = setTimeout(() => setDesk({ toastObj: null }), 3200)
}

function report(err) {
  toast(err.message || String(err), { error: true })
}

export async function loadDesk() {
  try {
    const data = await request('state')
    setDesk({ state: data.state, canUndo: data.canUndo, error: null })
  } catch (err) {
    setDesk({ error: err.message })
  }
}

export async function refreshQuiet() {
  try {
    const data = await request('state')
    if (!getDesk().error) setDesk({ state: data.state, canUndo: data.canUndo })
    else setDesk({ state: data.state, canUndo: data.canUndo, error: null })
  } catch {
    // 轮询失败不打扰，下一轮再试
  }
}

export async function dispatchOps(ops, { label = '操作', undoable = true, silent = false } = {}) {
  try {
    const data = await request('ops', { ops, label, undoable })
    setDesk({ state: data.state, canUndo: data.canUndo || getDesk().canUndo })
    if (data.errors?.length) toast(data.errors[0], { error: true })
    else if (!silent && data.receipts?.[0]) toast(data.receipts[0].text)
    return data
  } catch (err) {
    report(err)
    return null
  }
}

export async function undo() {
  try {
    const data = await request('undo', {})
    setDesk({ state: data.state, canUndo: data.canUndo, toastObj: null })
    if (data.label) toast(t('已撤销：{label}', { label: data.label }))
  } catch (err) {
    report(err)
  }
}

// —— 高层动作 ——
export const addTask = (patch, label) => dispatchOps([{ op: 'add_task', ...patch }], { label })
export const updateTask = (id, patch, label) => dispatchOps([{ op: 'update_task', id, ...patch }], { label })
export const setTaskStatus = (id, status, title) => dispatchOps([{ op: 'update_task', id, status }], { label: `${status === 'done' ? '完成' : '更新'}「${(title || '').slice(0, 16)}」` })
export const deleteTask = (id, title) => dispatchOps([{ op: 'delete_task', id }], { label: `删除「${(title || '').slice(0, 16)}」` })
export const captureIdea = (text, note) => dispatchOps([{ op: 'capture_idea', text, note, source: 'ui' }], { label: '停靠灵感' })
export const promoteIdea = (id, title) => dispatchOps([{ op: 'promote_idea', id, ...(title ? { title } : {}) }], { label: '灵感转任务' })
export const dropIdea = (id) => dispatchOps([{ op: 'drop_idea', id }], { label: '丢弃灵感' })
export const decideReview = (id, action, taskTitle) => dispatchOps([{ op: 'decide_review', id, action, ...(taskTitle ? { taskTitle } : {}) }], { label: '处置验收' })

/** 本地日期串 YYYY-MM-DD（宿主按本地日算「今天」，UTC 切片会在午夜前后错判）。 */
export function localToday(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** ISO 时间戳的本地日期串。 */
export function localDateOf(iso) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : localToday(date)
}

/** 今天视图（客户端镜像版：进行中 ∪ 今天及以前到期 ∪ 焦点；section 带稳定 key）。 */
export function todaySections(state, now = new Date()) {
  const today = localToday(now)
  const active = (row) => row.status !== 'done'
  const sections = []
  const seen = new Set()
  const push = (key, title, rows) => {
    const fresh = rows.filter((row) => { if (seen.has(row.id)) return false; seen.add(row.id); return true })
    if (fresh.length) sections.push({ key, title, tasks: fresh })
  }
  push('doing', '进行中', state.tasks.filter((row) => active(row) && row.status === 'doing'))
  push('due', '今天到期', state.tasks.filter((row) => active(row) && row.due && row.due <= today).sort((a, b) => (a.due < b.due ? -1 : 1)))
  push('focus', '焦点', state.tasks.filter((row) => active(row) && row.focus && row.status !== 'doing' && !(row.due && row.due <= today)))
  const doneToday = state.tasks.filter((row) => row.status === 'done' && row.completedAt && localDateOf(row.completedAt) === today)
  return { sections, doneToday, today }
}

/** 相对时间。 */
export function ago(iso, now = Date.now()) {
  const ms = now - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 60_000) return '刚刚'
  if (ms < 3_600_000) return t('{n} 分钟前', { n: Math.floor(ms / 60_000) })
  if (ms < 86_400_000) return t('{n} 小时前', { n: Math.floor(ms / 3_600_000) })
  return t('{n} 天前', { n: Math.floor(ms / 86_400_000) })
}

/** 开始轮询（agent 在会话里写，面板要跟上），返回停止函数。 */
export function startPolling() {
  const timer = setInterval(refreshQuiet, POLL_MS)
  const onVisible = () => { if (document.visibilityState === 'visible') refreshQuiet() }
  document.addEventListener('visibilitychange', onVisible)
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
}

// 面板与各会话的停靠条都要最新状态，用引用计数共享一份轮询。
let pollUsers = 0
let stopPolling = null

/** 挂载的消费者（面板、dock）各自调用；最后一个卸载时停止轮询。 */
export function ensurePolling() {
  if (pollUsers++ === 0) stopPolling = startPolling()
  return () => {
    if (--pollUsers > 0) return
    pollUsers = 0
    stopPolling?.()
    stopPolling = null
  }
}
