import React from 'react'
import { dispatchOps, useDesk } from './desk.js'
import { calendarDate, weekOf, isProject } from '../src/planner.js'

export const send = (ops, label = '调整计划') =>
  dispatchOps(ops, { label, silent: true })
export const time = (n) =>
  `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
export const parseTime = (value) =>
  value ? Number(value.split(':')[0]) * 60 + Number(value.split(':')[1]) : null
export const minutes = (n) =>
  n
    ? `${Math.floor(n / 60) ? `${Math.floor(n / 60)}h` : ''}${n % 60 ? `${n % 60}m` : ''}`
    : '待估时'
export function Dialog({ children, close, label, anchor, className = '' }) {
  const ref = React.useRef(null)
  const [viewport, setViewport] = React.useState({
    width: window.innerWidth,
    height: window.innerHeight,
  })
  React.useEffect(() => {
    const resize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  React.useEffect(() => {
    const el = ref.current
    el.showModal()
    return () => el.close()
  }, [])
  const width = Math.min(480, viewport.width - 32)
  const style = anchor
    ? {
        margin: 0,
        bottom: 'auto',
        left: Math.max(16, Math.min(anchor.x, viewport.width - width - 16)),
        top: Math.max(
          16,
          Math.min(anchor.bottom || anchor.y, viewport.height - 590),
        ),
        width,
        maxHeight:
          viewport.height -
          Math.max(
            16,
            Math.min(anchor.bottom || anchor.y, viewport.height - 590),
          ) -
          16,
      }
    : undefined
  return (
    <dialog
      ref={ref}
      style={style}
      className={`wb-dialog ${className}`}
      aria-label={label}
      onCancel={(e)=>{e.preventDefault();close()}}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="wb-dialog-body">{children}</div>
    </dialog>
  )
}
export function Field({ value, save, multiline = false, ...props }) {
  const [text, setText] = React.useState(value ?? ''),
    dirty = React.useRef(false)
  React.useEffect(() => {
    if (!dirty.current) setText(value ?? '')
  }, [value])
  const commit = async () => {
    if (!dirty.current) return
    const result = await save(text)
    if (result && !result.errors?.length) dirty.current = false
  }
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <Tag
      {...props}
      value={text}
      onChange={(e) => {
        dirty.current = true
        setText(e.target.value)
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (!multiline && e.key === 'Enter' && !e.nativeEvent.isComposing)
          e.currentTarget.blur()
      }}
    />
  )
}
export function TaskEditor({ selected, close, onSelect }) {
  const state = useDesk((s) => s.state),
    creating = !selected.task,
    historic = !!selected.historical,
    compact = selected.context !== 'projects'
  const original = selected.task
  const task = creating
    ? null
    : historic
      ? (original.kind === 'goal' ? state.plan.weeks : state.plan.days)[
          selected.date
        ]?.items.find((t) => t.id === original.id) || original
      : state.tasks.find((t) => t.id === original.id)
  const today = calendarDate(new Date(), state.plan.config.timezone)
  const initial = React.useMemo(
    () => ({
      title: selected.title || '',
      note: '',
      status: 'todo',
      kind: selected.kind || 'action',
      project: selected.project || '',
      parentId: selected.parentId || null,
      plannedDate: selected.date || today,
      plannedWeek: null,
      startMinute: selected.startMinute ?? null,
      estimateMinutes: selected.estimateMinutes || null,
      due: null,
      location: '',
      ...task,
    }),
    [task?.id, task?.kind],
  )
  const [form, setForm] = React.useState(initial),
    [busy, setBusy] = React.useState(false),
    [nodeTitle, setNodeTitle] = React.useState(''),
    [error, setError] = React.useState('')
  React.useEffect(() => setForm(initial), [initial])
  const change = (patch) => setForm((v) => ({ ...v, ...patch }))
  const project = isProject(form),
    event = form.kind === 'event'
  const projects = state.tasks.filter((t) => isProject(t) && t.id !== task?.id)
  const children = state.tasks.filter((t) => t.parentId === task?.id)
  const evidence = (task?.evidence || []).filter(
    (e) => !['自动估时', '手动安排'].includes(e.source),
  )
  const fields = [
    'title',
    'note',
    'status',
    'project',
    'parentId',
    'plannedDate',
    'plannedWeek',
    'startMinute',
    'estimateMinutes',
    'due',
    'location',
  ]
  const save = async (dismiss = true) => {
    if (!form.title.trim() || busy) return null
    setBusy(true)
    setError('')
    const patch = Object.fromEntries(
      fields
        .filter((key) => creating || form[key] !== initial[key])
        .map((key) => [key, form[key]]),
    )
    if ('estimateMinutes' in patch) patch.scheduledMinutes = null
    const ops = creating
      ? [
          {
            op: 'add_task',
            ...patch,
            kind: form.kind,
            plannedDate: project ? null : form.plannedDate,
            order: Date.now(),
          },
        ]
      : Object.keys(patch).length
        ? [
            historic
              ? {
                  op: 'plan_record',
                  id: task.id,
                  date: selected.date,
                  period: task.kind === 'goal' ? 'week' : 'day',
                  patch,
                }
              : { op: 'update_task', id: task.id, ...patch },
          ]
        : []
    const result = ops.length
      ? await send(ops, '保存事项')
      : { errors: [], state }
    setBusy(false)
    if (!result || result.errors?.length) {
      setError(result?.errors?.[0] || '保存失败，请重试')
      return null
    }
    if (dismiss) close()
    return result
  }
  const convert = async (kind) => {
    if (creating) {
      change({
        kind,
        ...(kind === 'project'
          ? { plannedDate: null, parentId: null }
          : { plannedDate: form.plannedDate || today }),
      })
      return
    }
    if (!(await save(false))) return
    setBusy(true)
    const result = await send(
      [{ op: 'convert_task', id: task.id, kind }],
      '转换事项',
    )
    setBusy(false)
    if (!result || result.errors?.length)
      setError(result?.errors?.[0] || '操作失败，请重试')
    if (result && !result.errors?.length)
      setForm({
        ...initial,
        ...result.state.tasks.find((t) => t.id === task.id),
      })
  }
  const addNode = async () => {
    if (!nodeTitle.trim() || busy) return
    setBusy(true)
    const r = await send(
      [
        {
          op: 'add_task',
          title: nodeTitle.trim(),
          parentId: task.id,
          project: task.title,
          plannedDate: null,
        },
      ],
      '添加项目节点',
    )
    setBusy(false)
    if (r && !r.errors?.length) setNodeTitle('')
  }
  return (
    <Dialog
      close={close}
      label={creating ? '新建事项' : '事项详情'}
      anchor={compact ? selected.anchor : undefined}
      className={`wb-detail-dialog ${compact ? 'wb-compact-editor' : ''}`}
    >
      <header className="wb-detail-header">
        <div>
          <span
            className={`wb-kind-label is-${project ? 'project' : event ? 'event' : 'action'}`}
          >
            {historic
              ? '历史记录'
              : project
                ? '长期项目'
                : event
                  ? '日程'
                  : '任务'}
          </span>
          <small>
            {project
              ? '持续推进 · 多个节点'
              : event
                ? '固定日期 · 不自动顺延'
                : '明确下一步，安排自己的时间'}
          </small>
        </div>
        <button
          type="button"
          className="wb-close"
          aria-label="关闭编辑"
          onClick={close}
        >
          ×
        </button>
      </header>
      <div className="wb-detail-content">
        <textarea
          className="wb-detail-title"
          aria-label="事项标题"
          rows={form.title.length > 48 ? 2 : 1}
          autoFocus
          value={form.title}
          placeholder="这件事是什么？"
          onChange={(e) => change({ title: e.target.value })}
        />
        {!historic && (
          <div className="wb-detail-convert" aria-label="转换事项类型">
            {['action', 'project', 'event']
              .filter(
                (kind) =>
                  kind !== form.kind &&
                  !(
                    kind === 'project' &&
                    (project || (!creating && (form.parentId || form.project)))
                  ),
              )
              .map((kind) => (
                <button
                  key={kind}
                  type="button"
                  disabled={busy}
                  onClick={() => convert(kind)}
                >
                  {kind === 'project' && !creating
                    ? '创建关联项目'
                    : `${creating ? '设为' : '转为'}${{ action: '任务', project: '项目', event: '日程' }[kind]}`}
                </button>
              ))}
            <span>
              {project
                ? '项目不会被当作一条每日待办'
                : event
                  ? '会议、提交截止、重要日期'
                  : '创建关联项目，保留当前任务与排期'}
            </span>
          </div>
        )}
        <div className="wb-detail-grid">
          <details className="wb-detail-main" open={compact ? undefined : true}>
            <summary>说明、材料与进展{form.note ? ' · 有内容' : ''}</summary>
            <label>
              说明与材料
              <textarea
                aria-label="说明与材料"
                className="wb-detail-notes"
                rows={7}
                placeholder="背景、材料链接、验收要求和自己的笔记…"
                value={form.note || ''}
                onChange={(e) => change({ note: e.target.value })}
              />
            </label>
            {project && !creating && !historic && (
              <section className="wb-detail-nodes">
                <h3>
                  项目节点{' '}
                  <small>
                    {children.filter((t) => t.status === 'done').length} /{' '}
                    {children.length} 已完成
                  </small>
                </h3>
                {children.map((child) => (
                  <button
                    type="button"
                    className={`wb-node-row ${child.status === 'done' ? 'is-done' : ''}`}
                    key={child.id}
                    onClick={async () => {
                      if (await save(false))
                        onSelect(child, child.plannedDate, false)
                    }}
                  >
                    <span>
                      {child.kind === 'event'
                        ? '▦'
                        : child.status === 'done'
                          ? '✓'
                          : '○'}
                    </span>
                    <strong>{child.title}</strong>
                    <small>{child.plannedDate || '待安排'}</small>
                  </button>
                ))}
                <div className="wb-node-create">
                  <input
                    aria-label="新节点名称"
                    value={nodeTitle}
                    onChange={(e) => setNodeTitle(e.target.value)}
                    placeholder="写下一个明确的节点"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                        e.preventDefault()
                        addNode()
                      }
                    }}
                  />
                  <button
                    disabled={busy || !nodeTitle.trim()}
                    type="button"
                    onClick={addNode}
                  >
                    ＋ 添加节点
                  </button>
                </div>
              </section>
            )}
            {!creating &&
              (evidence.length > 0 || task?.progress?.length > 0) && (
                <section className="wb-detail-evidence">
                  <h3>来源与进展</h3>
                  {evidence.slice(-5).map((e, i) => (
                    <p key={`e${i}`}>
                      <small>{e.source}</small>
                      {e.quote}
                    </p>
                  ))}
                  {task.progress?.slice(-5).map((p, i) => (
                    <p key={`p${i}`}>{p.note}</p>
                  ))}
                </section>
              )}
          </details>
          <aside className="wb-detail-properties">
            {!project && !historic && (
              <label>
                所属项目
                <select
                  aria-label="所属项目"
                  value={
                    form.parentId ||
                    (form.project ? `label:${form.project}` : '')
                  }
                  onChange={(e) => {
                    const p = projects.find((p) => p.id === e.target.value)
                    change({
                      parentId: p?.id || null,
                      project:
                        p?.title ||
                        (e.target.value.startsWith('label:')
                          ? e.target.value.slice(6)
                          : ''),
                    })
                  }}
                >
                  <option value="">未关联项目</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                  {[
                    ...new Set(
                      state.tasks
                        .map((t) => t.project)
                        .filter(
                          (name) =>
                            name && !projects.some((p) => p.title === name),
                        ),
                    ),
                  ].map((name) => (
                    <option key={name} value={`label:${name}`}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!project && (
              <>
                <label>
                  {event ? '日程日期' : '安排日期'}
                  <input
                    aria-label="安排日期"
                    type="date"
                    disabled={historic}
                    value={form.plannedDate || ''}
                    onChange={(e) =>
                      change({ plannedDate: e.target.value || null })
                    }
                  />
                </label>
                <label>
                  {event ? '时间（留空为全天）' : '开始时间'}
                  <input
                    aria-label="开始时间"
                    type="time"
                    value={
                      Number.isFinite(form.startMinute)
                        ? time(form.startMinute)
                        : ''
                    }
                    onChange={(e) =>
                      change({ startMinute: parseTime(e.target.value) })
                    }
                  />
                </label>
                <label>
                  {event ? '时长（分钟）' : '预计用时（分钟）'}
                  <input
                    aria-label="预计分钟"
                    type="number"
                    min="1"
                    max="1440"
                    placeholder={event ? '全天日程可留空' : '由助手默认估计'}
                    value={form.estimateMinutes || ''}
                    onChange={(e) =>
                      change({
                        estimateMinutes: Number(e.target.value) || null,
                      })
                    }
                  />
                </label>
              </>
            )}
            {!event && (
              <label>
                {project ? '项目截止日期' : '交付截止日期'}
                <input
                  aria-label="交付期限"
                  type="date"
                  value={form.due || ''}
                  onChange={(e) => change({ due: e.target.value || null })}
                />
              </label>
            )}
            {!event && !creating && !historic && form.due && (
              <button
                type="button"
                className="wb-deadline-event"
                disabled={busy}
                onClick={async () => {
                  if (await save(false))
                    await send(
                      [{ op: 'deadline_event', id: task.id }],
                      '建立截止日程',
                    )
                }}
              >
                ▦ 将截止日期加入日程
              </button>
            )}
            {event && (
              <label>
                地点 / 会议链接
                <input
                  aria-label="日程地点"
                  value={form.location || ''}
                  onChange={(e) => change({ location: e.target.value })}
                />
              </label>
            )}
            <label>
              状态
              <select
                aria-label="事项状态"
                value={form.status}
                onChange={(e) => change({ status: e.target.value })}
              >
                {Object.entries(
                  event
                    ? { todo: '已安排', done: '已结束', cancelled: '已取消' }
                    : {
                        todo: '待办',
                        doing: '进行中',
                        blocked: '等待',
                        paused: '暂时搁置',
                        done: '已完成',
                        cancelled: '已取消',
                      },
                ).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {form.status === 'done' && (
              <div className="wb-completion-seal">
                ✓ 已完成<small>这一步，已经做到。</small>
              </div>
            )}
            {task?.rolloverWarning && (
              <p role="status">{task.rolloverWarning}</p>
            )}
          </aside>
        </div>
      </div>
      <footer className="wb-detail-footer">
        {error && <span role="alert">{error}</span>}
        {!creating && !historic && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              const r = await send([{ op: 'delete_task', id: task.id }])
              if (r && !r.errors?.length) close()
            }}
          >
            删除
          </button>
        )}
        <span className="wb-detail-save-hint">
          {historic ? '只更正这一天的记录' : '修改后点击保存'}
        </span>
        <button type="button" onClick={close}>
          取消
        </button>
        <button
          type="button"
          className="wb-accent-button"
          disabled={busy || !form.title.trim()}
          onClick={() => save()}
        >
          {busy ? '保存中…' : creating ? '创建' : '保存'}
        </button>
      </footer>
    </Dialog>
  )
}
