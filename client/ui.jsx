// 共享小组件：图标、任务行（含行内编辑与老板视图）、胶囊、空态、Toast。
import React from 'react'
import { ago, setDesk, useDesk, deleteTask, setTaskStatus, updateTask } from './desk.js'
import { jumpToSession, sessionTitle } from './nav.js'
import { t } from './i18n.js'

const PATHS = {
  check: 'M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 12-12L20.1 5.6z',
  plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
  trash: 'M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 12H7z',
  undo: 'M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z',
  refresh: 'M17.6 6.4A8 8 0 1 0 19.5 14h-2.1a6 6 0 1 1-1-6.4L13 11h7V4z',
  inbox: 'M4 4h16v10h-5a3 3 0 0 1-6 0H4zm0 12h4.6a5 5 0 0 0 6.8 0H20v4H4z',
  calendar: 'M7 2v2H4v18h16V4h-3V2h-2v2H9V2zm-1 8h12v8H6zm2 2v2h3v-2z',
  flag: 'M6 2v20h2v-8h9l-2-5 2-5H8V2z',
  star: 'm12 2 2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 16.9 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z',
  chat: 'M4 4h16v12H7l-3 3z',
  focus: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0-6 2 4h-4zm0 20-2-4h4zM2 12l4-2v4zm16 0 4-2v4z',
}

export function Icon({ name, size = 16 }) {
  return React.createElement('svg', {
    viewBox: '0 0 24 24', width: size, height: size, 'aria-hidden': true, focusable: false,
    style: { display: 'block', fill: 'currentColor' },
  }, React.createElement('path', { d: PATHS[name] ?? PATHS.check }))
}

export function IconButton({ icon, label, onClick, danger = false, disabled = false }) {
  return React.createElement('button', {
    type: 'button', className: `wb-iconbtn${danger ? ' is-danger' : ''}`, title: label, 'aria-label': label,
    onClick, disabled,
  }, React.createElement(Icon, { name: icon, size: 16 }))
}

export function Chip({ children, tone = 'plain', title }) {
  return React.createElement('span', { className: `wb-chip is-${tone}`, title }, children)
}

/** 验收来源类型标签（收件箱与任务挂靠执行共用）。 */
export const KIND_LABEL = { subagent: '子代理', workflow: '工作流', job: '后台任务' }

/** 可点按的会话胶囊：显示会话标题（取不到回退 #id），点击跳转该会话。 */
export function SessionChip({ sessionId, label, title }) {
  if (!sessionId) return null
  const text = label ?? sessionTitle(sessionId)
  return React.createElement('button', {
    type: 'button', className: 'wb-chip is-idle wb-chipbtn',
    title: title ?? `${t('来源会话')} · ${text}`,
    onClick: (e) => { e.stopPropagation(); jumpToSession(sessionId) },
  }, text)
}

const STATUS_LABEL = { todo: '待办', doing: '进行中', blocked: '受阻', done: '已完成' }
const PRIORITY_LABEL = ['低', '中', '高']
const PRIORITY_TONE = ['idle', 'plain', 'warn']

const REVIEW_STATUS_LABEL = { pending: '待验收', accepted: '已验收', dismissed: '已忽略' }
const REVIEW_STATUS_TONE = { pending: 'warn', accepted: 'plain', dismissed: 'idle' }

/**
 * 老板视图：任务展开后的「谁在执行 / 做到哪 / 挂靠了哪些执行结果」。
 * 数据全部来自任务 progress 时间线与自动挂靠的验收条目，不需要用户维护。
 */
function BossSection({ task }) {
  const state = useDesk((s) => s.state)
  const progress = task.progress ?? []

  // 执行者 = 来源会话 + progress 里出现过的会话/外部执行者（按最近活动排序）
  const actors = new Map()
  const touchActor = (key, entry) => {
    const prev = actors.get(key)
    if (!prev || entry.at > prev.at) actors.set(key, entry)
  }
  if (task.origin?.sessionId) {
    touchActor(`s:${task.origin.sessionId}`, { at: task.createdAt, sessionId: task.origin.sessionId })
  }
  for (const entry of progress) {
    if (entry.sessionId) touchActor(`s:${entry.sessionId}`, { at: entry.at, sessionId: entry.sessionId })
    if (entry.actor) touchActor(`a:${entry.actor}`, { at: entry.at, actor: entry.actor })
  }
  const actorList = [...actors.values()].sort((a, b) => (a.at < b.at ? 1 : -1))

  const linked = (state?.reviews ?? [])
    .filter((row) => row.taskId === task.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 8)

  const row = (label, children) => React.createElement('div', { className: 'wb-boss-row' },
    React.createElement('span', { className: 'wb-boss-label' }, label), children)

  return React.createElement('div', { className: 'wb-boss' },
    actorList.length ? row(t('执行'), React.createElement('span', { className: 'wb-boss-actors' },
      actorList.map((actor) => (actor.sessionId
        ? React.createElement(SessionChip, { key: `s:${actor.sessionId}`, sessionId: actor.sessionId })
        : React.createElement(Chip, { key: `a:${actor.actor}`, tone: 'idle', title: t('外部执行者') }, actor.actor))))) : null,
    row(t('环节'), progress.length
      ? React.createElement('ul', { className: 'wb-timeline' },
        progress.slice(-12).reverse().map((entry, index) => React.createElement('li', { key: `${entry.at}-${index}`, className: 'wb-timeline-item' },
          React.createElement('span', { className: 'wb-timeline-note' }, entry.note),
          React.createElement('span', { className: 'wb-meta' },
            entry.actor ?? (entry.sessionId ? sessionTitle(entry.sessionId) : ''), ' · ', ago(entry.at)))))
      : React.createElement('span', { className: 'wb-meta' }, t('暂无进展记录；接手的会话会自动汇报到这里'))),
    linked.length ? row(t('挂靠执行'), linked.map((review) => React.createElement('div', { key: review.id, className: 'wb-run' },
      React.createElement(Chip, { tone: REVIEW_STATUS_TONE[review.status] ?? 'idle' }, t(REVIEW_STATUS_LABEL[review.status] ?? '待验收')),
      React.createElement('span', { className: 'wb-run-kind' }, t(KIND_LABEL[review.kind] ?? '后台任务')),
      React.createElement('span', { className: 'wb-run-title', title: review.title }, review.title),
      review.sessionId ? React.createElement(SessionChip, { sessionId: review.sessionId }) : null))) : null)
}

function TaskEditor({ task, close }) {
  const [form, setForm] = React.useState({
    title: task.title, note: task.note ?? '', due: task.due ?? '', priority: task.priority, status: task.status, tags: (task.tags ?? []).join(' '),
  })
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }))
  const save = async () => {
    await updateTask(task.id, {
      title: form.title, note: form.note, due: form.due || null, priority: form.priority,
      status: form.status, tags: form.tags.split(/[\s,，]+/).filter(Boolean),
    }, `更新「${task.title.slice(0, 16)}」`)
    close()
  }
  const field = (labelText, control) => React.createElement('label', { className: 'wb-field' },
    React.createElement('span', null, labelText), control)
  return React.createElement('div', { className: 'wb-editor', onClick: (e) => e.stopPropagation() },
    field(t('标题'), React.createElement('input', { value: form.title, onChange: (e) => set({ title: e.target.value }) })),
    field(t('备注'), React.createElement('textarea', { rows: 2, value: form.note, onChange: (e) => set({ note: e.target.value }) })),
    React.createElement('div', { className: 'wb-field-row' },
      field(t('截止'), React.createElement('input', { type: 'date', value: form.due, onChange: (e) => set({ due: e.target.value }) })),
      field(t('优先级'), React.createElement('select', { value: form.priority, onChange: (e) => set({ priority: Number(e.target.value) }) },
        [0, 1, 2].map((p) => React.createElement('option', { key: p, value: p }, t(PRIORITY_LABEL[p]))))),
      field(t('状态'), React.createElement('select', { value: form.status, onChange: (e) => set({ status: e.target.value }) },
        ['todo', 'doing', 'blocked', 'done'].map((s) => React.createElement('option', { key: s, value: s }, t(STATUS_LABEL[s])))))),
    field(t('标签'), React.createElement('input', { value: form.tags, placeholder: '空格分隔', onChange: (e) => set({ tags: e.target.value }) })),
    React.createElement(BossSection, { task }),
    React.createElement('div', { className: 'wb-editor-foot' },
      React.createElement('span', { className: 'wb-meta' },
        task.origin?.sessionId ? React.createElement(React.Fragment, null,
          `${t('来源会话')} `, React.createElement(SessionChip, { sessionId: task.origin.sessionId }), ' · ')
          : task.origin?.kind === 'zcode' ? `${t('来自 ZCode')} · ` : '', ago(task.createdAt)),
      React.createElement('span', { style: { flex: 1 } }),
      React.createElement('button', { type: 'button', className: 'wb-btn is-danger', onClick: async () => { await deleteTask(task.id, task.title); close() } }, t('删除')),
      React.createElement('button', { type: 'button', className: 'wb-btn', onClick: close }, t('取消')),
      React.createElement('button', { type: 'button', className: 'wb-btn is-primary', onClick: save }, t('保存'))))
}

/** 一行任务：勾选完成 + 标题 + 元信息胶囊 + 行内编辑。 */
export function TaskRow({ task, today }) {
  const expandedId = useDesk((s) => s.expandedId)
  const expanded = expandedId === task.id
  const done = task.status === 'done'
  const overdue = !done && task.due && task.due < today
  return React.createElement('div', { className: `wb-task${done ? ' is-done' : ''}${expanded ? ' is-open' : ''}` },
    React.createElement('div', {
      className: 'wb-task-main', role: 'button', tabIndex: 0,
      onClick: () => setDesk({ expandedId: expanded ? null : task.id }),
      onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDesk({ expandedId: expanded ? null : task.id }) } },
    },
      React.createElement('button', {
        type: 'button', className: `wb-check${done ? ' is-on' : ''}`, role: 'checkbox', 'aria-checked': done,
        'aria-label': done ? '标记为未完成' : '标记为完成',
        onClick: (e) => { e.stopPropagation(); setTaskStatus(task.id, done ? 'todo' : 'done', task.title) },
      }, done ? React.createElement(Icon, { name: 'check', size: 13 }) : null),
      React.createElement('span', { className: 'wb-task-title' }, task.title),
      React.createElement('span', { className: 'wb-task-meta' },
        task.due ? React.createElement(Chip, { tone: overdue ? 'error' : 'plain', title: t('截止') }, `${overdue ? `${t('逾期')} ` : ''}${task.due.slice(5)}`) : null,
        task.priority === 2 ? React.createElement(Chip, { tone: 'warn' }, t('高')) : null,
        task.focus ? React.createElement(Chip, { tone: 'brand' }, t('焦点')) : null,
        task.status === 'blocked' ? React.createElement(Chip, { tone: 'error' }, t('受阻')) : null,
        task.origin?.kind === 'chat' && task.origin?.sessionId
          ? React.createElement(SessionChip, { sessionId: task.origin.sessionId, label: t('来自对话'), title: `${sessionTitle(task.origin.sessionId)} · ${t('跳转会话')}` })
          : task.origin?.kind === 'chat' ? React.createElement(Chip, { tone: 'idle' }, t('来自对话')) : null,
        task.origin?.kind === 'zcode' ? React.createElement(Chip, { tone: 'idle', title: t('来自 ZCode') }, 'Zcode') : null,
        (task.tags ?? []).slice(0, 3).map((tag) => React.createElement(Chip, { key: tag, tone: 'idle' }, tag)))),
    expanded ? React.createElement(TaskEditor, { task, close: () => setDesk({ expandedId: null }) }) : null)
}

export function Empty({ text }) {
  return React.createElement('p', { className: 'wb-empty' }, text)
}

export function Toast() {
  const toastObj = useDesk((s) => s.toastObj)
  if (!toastObj) return null
  return React.createElement('div', { className: `wb-toast${toastObj.error ? ' is-error' : ''}`, key: toastObj.key }, toastObj.text)
}
