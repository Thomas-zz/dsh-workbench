import React from 'react'
import { useEntryEditing } from '../entry-editing.jsx'
import { AiMark } from '../ai-mark.jsx'
import { PersonalEditor } from '../personal-editor.jsx'
import { projectGroups, weekWork } from '../../src/projects.js'
import { projectColor } from '../../src/personal-plan.js'
import { useDesk } from '../desk.js'
import { calendarDate, isProject } from '../../src/planner.js'
import { Dialog, send, time } from '../plan-shared.jsx'

function ProjectEditor({ selected, close }) {
  if (!isProject(selected.task || { kind: selected.kind }))
    return <PersonalEditor context={selected} close={close} />
  return <ProjectDetails selected={selected} close={close} />
}
function ProjectDetails({ selected, close }) {
  const original = selected.task
  const [title, setTitle] = React.useState(
    original?.title || selected.title || '',
  )
  const [note, setNote] = React.useState(original?.note || '')
  const [status, setStatus] = React.useState(original?.status || 'todo')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const input = React.useRef(null)
  React.useEffect(() => {
    input.current?.focus()
  }, [])
  const submit = async (remove = false) => {
    if (busy || (!remove && !title.trim())) return
    setBusy(true)
    const patch = { title: title.trim(), note, status }
    if (original)
      for (const key of Object.keys(patch))
        if (patch[key] === original[key]) delete patch[key]
    const result = await send(
      [
        remove
          ? { op: 'delete_task', id: original.id }
          : original
            ? { op: 'update_task', id: original.id, ...patch }
            : {
                op: 'add_task',
                kind: 'project',
                ...patch,
                plannedDate: null,
                plannedWeek: null,
                order: Date.now(),
              },
      ],
      remove ? '删除项目' : '保存项目',
    )
    setBusy(false)
    if (result && !result.errors?.length) close()
    else setError(result?.errors?.[0] || '保存失败，请重试')
  }
  return (
    <Dialog
      close={busy ? () => {} : close}
      label={original ? '编辑项目' : '新建项目'}
      className="pd-editor"
    >
      <header>
        <strong>{original ? '编辑项目' : '新建项目'}</strong>
        <button onClick={close} disabled={busy} aria-label="关闭项目编辑">
          ×
        </button>
      </header>
      <input
        ref={input}
        className="pd-title-input"
        aria-label="项目名称"
        placeholder="项目名称"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit()
        }}
      />
      <textarea
        aria-label="项目说明"
        placeholder="项目说明（可选）"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {original && (
        <label className="pd-setting-check">
          <input
            type="checkbox"
            checked={status === 'done'}
            onChange={(e) => setStatus(e.target.checked ? 'done' : 'todo')}
          />
          已完成
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      <footer>
        {original && (
          <button
            className="pd-delete"
            disabled={busy}
            onClick={() => submit(true)}
          >
            删除项目
          </button>
        )}
        <span />
        <button onClick={close} disabled={busy}>
          取消
        </button>
        <button
          className="pd-primary"
          disabled={busy || !title.trim()}
          onClick={() => submit()}
        >
          {busy ? '保存中…' : '保存'}
        </button>
      </footer>
    </Dialog>
  )
}

function ProjectTask({ task, entries }) {
  const date = task.displayDate || task.plannedDate
  return (
    <div
      className={`pd-project-task ${task.status === 'done' ? 'is-done' : ''}`}
    >
      <button
        className="pd-check"
        aria-label={`${task.status === 'done' ? '重新打开' : '完成'} ${task.title}`}
        aria-pressed={task.status === 'done'}
        onClick={() =>
          send(
            [
              task.historical
                ? {
                    op: 'plan_record',
                    id: task.id,
                    date,
                    patch: {
                      status: task.status === 'done' ? 'todo' : 'done',
                    },
                  }
                : {
                    op: 'update_task',
                    id: task.id,
                    status: task.status === 'done' ? 'todo' : 'done',
                  },
            ],
            '标记完成',
          )
        }
      >
        {task.status === 'done' ? '✓' : ''}
      </button>
      <button
        className="pd-project-task-title"
        {...entries.button(task, 'project')}
      >
        {task.title}
        <AiMark task={task} />
      </button>
      <button
        className="pd-project-task-date"
        {...entries.button(task, 'project', 'schedule')}
        aria-label={`安排 ${task.title}`}
      >
        {date
          ? `${Number(date.slice(5, 7))} 月 ${Number(date.slice(8))} 日`
          : task.plannedWeek
            ? `${task.plannedWeek.slice(5)} 当周`
            : '待安排'}
        {Number.isFinite(task.startMinute) && (
          <small>{time(task.startMinute)}</small>
        )}
      </button>
      {entries.render('project', task)}
    </div>
  )
}

export function ProjectsView({ entryDrafts }) {
  const entries = useEntryEditing(entryDrafts)
  const state = useDesk((s) => s.state)
  const [selected, setSelected] = React.useState(null)
  const [scope, setScope] = React.useState('all')
  const [active, setActive] = React.useState(null)
  const [query, setQuery] = React.useState('')
  const today = calendarDate(new Date(), state.plan.config.timezone)
  const rows = scope === 'week' ? weekWork(state, today).tasks : state.tasks
  const { groups, independent } = projectGroups(state, rows, {
    includeEmpty: true,
  })
  const all = [
    ...groups,
    { project: { id: 'independent', title: '独立事项' }, tasks: independent },
  ]
  const options = all.filter((g) =>
    g.project.title.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const current = options.find((g) => g.project.id === active) || options[0]
  const project = current?.project
  const tasks = current?.tasks || []
  const select = (task, date, historical) =>
    setSelected({ task, date, historical, context: 'projects' })
  const create = (options = {}) =>
    setSelected({
      ...options,
      date: options.date || null,
      context: 'projects',
    })
  const addTask = () =>
    create({
      parentId:
        project?.virtual || project?.id === 'independent' ? null : project?.id,
      project: project?.id === 'independent' ? '' : project?.title,
    })
  return (
    <div className="pd-project-page pd-planner">
      <header className="pd-toolbar">
        <div className="pd-heading">
          <h1>项目</h1>
        </div>
        <div className="pd-view-controls">
          <select
            aria-label="项目展示范围"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="all">全部事项</option>
            <option value="week">本周事项</option>
          </select>
          <button
            className="pd-new-project"
            onClick={() => create({ kind: 'project' })}
          >
            ＋ 新建项目
          </button>
        </div>
      </header>
      <div className="pd-project-workspace">
        <nav className="pd-project-nav" aria-label="项目列表">
          <input
            type="search"
            aria-label="搜索项目"
            placeholder="搜索项目"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div>
            {options.map(({ project: p, tasks: items }) => (
              <button
                key={p.id}
                className={`pd-project-option tone-${projectColor(p.title)}`}
                aria-current={project?.id === p.id ? 'true' : undefined}
                onClick={() => setActive(p.id)}
              >
                <i aria-hidden="true" />
                <span>{p.title}</span>
                <small>{items.length}</small>
              </button>
            ))}
          </div>
        </nav>
        <section className="pd-project-detail">
          {project ? (
            <>
              <header className="pd-project-heading">
                <div>
                  <h2 className={`tone-${projectColor(project.title)}`}>
                    <i aria-hidden="true" />
                    {project.title}
                  </h2>
                  <span>
                    {tasks.length} 项 ·{' '}
                    {tasks.filter((t) => t.status === 'done').length} 项已完成
                  </span>
                </div>
                <div className="pd-project-actions">
                  {project.id !== 'independent' && (
                    <button
                      aria-label={`编辑项目 ${project.title}`}
                      onClick={() =>
                        project.virtual
                          ? create({ kind: 'project', title: project.title })
                          : select(project)
                      }
                    >
                      编辑项目
                    </button>
                  )}
                  <button className="pd-new-project" onClick={addTask}>
                    ＋ 添加事项
                  </button>
                </div>
              </header>
              <div className="pd-project-table">
                <div className="pd-project-table-heading">
                  <span />
                  <span>事项</span>
                  <span>安排</span>
                </div>
                {tasks.map((task) => (
                  <ProjectTask key={task.id} task={task} entries={entries} />
                ))}
                {!tasks.length && <p className="pd-empty">暂无事项</p>}
              </div>
            </>
          ) : (
            <p className="pd-empty">没有匹配的项目</p>
          )}
        </section>
      </div>
      {selected && (
        <ProjectEditor
          key={`${selected.task?.id || 'new'}:${selected.kind || ''}`}
          selected={selected}
          close={() => setSelected(null)}
        />
      )}
    </div>
  )
}
