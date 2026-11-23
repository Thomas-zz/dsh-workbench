import { CollaborationPanel } from '../collaboration-panel.jsx'
import { FeishuConnection } from '../feishu-connection.jsx'
import { CalendarIcon, CheckIcon } from '../connection-shared.jsx'
import React from 'react'
import {
  useDesk,
  setDesk,
  runPlanOrganizer,
  workbenchRequest,
} from '../desk.js'
import { useEntryEditing } from '../entry-editing.jsx'
import { send, time } from '../plan-shared.jsx'
import { AiMark } from '../ai-mark.jsx'
import { planningTaskIds } from '../../src/personal-plan.js'
import { PersonalEditor, ProjectTag } from '../personal-editor.jsx'
import { drag, acceptDrop, usePlanDrag } from '../plan-drag.js'
import {
  calendarDate,
  addDays,
  weekOf,
  dayTasks,
  overlapLayout,
} from '../../src/planner.js'
import {
  poolTasks,
  projectName,
  projectColor,
  projectOptions,
} from '../../src/personal-plan.js'

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const weekday = (d) => weekdays[new Date(`${d}T12:00:00Z`).getUTCDay()]
const duration = (t) => t.scheduledMinutes || t.estimateMinutes || 30
const eventTime = (t) =>
  Number.isFinite(t.startMinute)
    ? `${time(t.startMinute)}–${time(Math.min(1440, t.startMinute + duration(t)))}`
    : '全天'
const prefs = () => {
  try {
    return JSON.parse(localStorage.getItem('wb-personal-view') || '{}')
  } catch {
    return {}
  }
}
const toggle = (task) => {
  const patch = { status: task.status === 'done' ? 'todo' : 'done' }
  return send(
    [
      task.historical
        ? { op: 'plan_record', id: task.id, date: task.plannedDate, patch }
        : { op: 'update_task', id: task.id, ...patch },
    ],
    '标记完成',
  )
}

function TaskRow({ task, entries, place = 'row', tasks, date, week }) {
  const name = projectName(task, tasks),
    dragging = useDesk((s) => s.planDrag?.id)
  const trigger = entries.button(task, place)
  const editor = place === 'row' ? entries.render(place, task) : null
  if (task.kind === 'event')
    return (
      <article
        className={`pd-event-row ${task.external ? 'is-external' : ''} ${dragging === task.id ? 'is-dragging' : ''}`}
        data-plan-id={task.id}
        draggable={!editor && !task.external && !task.historical}
        onDragStart={editor ? undefined : (e) => drag(e, task)}
      >
        <button
          className="pd-event-main"
          {...trigger}
          aria-label={`${task.external ? '查看飞书日程' : '编辑日程'} ${task.title}`}
        >
          <span className="pd-event-icon">
            <CalendarIcon />
          </span>
          <span className="pd-event-body">
            <span className="pd-event-caption">
              <time>{eventTime(task)}</time>
              <span className="pd-event-source">
                {task.external ? '飞书' : '日程'}
              </span>
            </span>
            <strong>{task.title}</strong>
            <AiMark task={task} />
            {(name || task.location) && (
              <span className="pd-event-context">
                <ProjectTag name={name} />
                {task.location && <small>{task.location}</small>}
              </span>
            )}
          </span>
        </button>
        {editor}
      </article>
    )
  return (
    <article
      className={`pd-task ${task.status === 'done' ? 'is-done' : ''} ${task.external ? 'is-external' : ''} ${dragging === task.id ? 'is-dragging' : ''}`}
      data-plan-id={task.id}
      data-drop-before={!task.external ? task.id : undefined}
      draggable={!editor && !task.external && !task.historical}
      onDragStart={editor ? undefined : (e) => drag(e, task)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) =>
        !task.external && acceptDrop(e, date, task.id, undefined, week)
      }
    >
      <button
        className="pd-check"
        aria-label={`${task.status === 'done' ? '重新打开' : '完成'} ${task.title}`}
        aria-pressed={task.status === 'done'}
        onClick={() => toggle(task)}
      >
        {task.status === 'done' ? '✓' : ''}
      </button>
      <button className="pd-task-main" {...trigger}>
        <span className="pd-task-title">
          <strong>{task.title}</strong>
          <AiMark task={task} />
        </span>
        <span>
          {Number.isFinite(task.startMinute) && (
            <small>{time(task.startMinute)}</small>
          )}
          <ProjectTag name={name} />
          {task.external && <small>飞书 · 只读</small>}
        </span>
      </button>
      {editor}
    </article>
  )
}
function DayList({ items, date, tasks, entries }) {
  const events = items
    .filter((t) => t.kind === 'event')
    .sort((a, b) => (a.startMinute ?? -1) - (b.startMinute ?? -1))
  const actions = items.filter((t) => t.kind !== 'event')
  return (
    <div className="pd-day-list">
      {events.length > 0 && (
        <h3 className="pd-list-section-label">
          日程 <span>{events.length}</span>
        </h3>
      )}
      {events.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          date={date}
          tasks={tasks}
          entries={entries}
        />
      ))}
      {events.length > 0 && actions.length > 0 && (
        <h3 className="pd-list-section-label">
          事项 <span>{actions.length}</span>
        </h3>
      )}
      {actions.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          date={date}
          tasks={tasks}
          entries={entries}
        />
      ))}
      {!items.length && <p className="pd-empty">暂无事项</p>}
    </div>
  )
}
function TimeBlock({ row, entries, tasks }) {
  const { task, lane, count, span, height } = row,
    name = projectName(task, tasks)
  const [resizing, setResizing] = React.useState(null),
    suppress = React.useRef(0)
  const start = resizing?.start ?? task.startMinute,
    length = resizing?.length ?? duration(task)
  const trigger = entries.button(task, 'calendar')
  const edit = (e) => {
    if (Date.now() > suppress.current) trigger.onClick(e)
  }
  const resizeHandle = (edge) => (
    <div
      className={`pd-resize is-${edge}`}
      role="separator"
      aria-orientation="horizontal"
      aria-label={`调整 ${task.title} ${edge === 'top' ? '开始' : '结束'}时间`}
      tabIndex={0}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (!['ArrowUp', 'ArrowDown'].includes(e.key)) return
        e.preventDefault()
        e.stopPropagation()
        const diff = e.key === 'ArrowUp' ? -15 : 15
        const nextStart =
          edge === 'top'
            ? Math.max(
                0,
                Math.min(
                  task.startMinute + duration(task) - 15,
                  task.startMinute + diff,
                ),
              )
            : task.startMinute
        const nextLength =
          edge === 'top'
            ? duration(task) + task.startMinute - nextStart
            : Math.max(15, Math.min(1440 - nextStart, duration(task) + diff))
        send(
          [
            {
              op: 'update_task',
              id: task.id,
              startMinute: nextStart,
              estimateMinutes: nextLength,
              scheduledMinutes: null,
            },
          ],
          '调整时间',
        )
      }}
      onPointerDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        e.currentTarget.dataset.y = e.clientY
        setResizing({ start: task.startMinute, length: duration(task) })
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
        const diff =
          Math.round((e.clientY - Number(e.currentTarget.dataset.y)) / 15) * 15
        const nextStart =
          edge === 'top'
            ? Math.max(
                0,
                Math.min(
                  task.startMinute + duration(task) - 15,
                  task.startMinute + diff,
                ),
              )
            : task.startMinute
        setResizing({
          start: nextStart,
          length:
            edge === 'top'
              ? duration(task) + task.startMinute - nextStart
              : Math.max(15, Math.min(1440 - nextStart, duration(task) + diff)),
        })
      }}
      onPointerUp={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
        e.stopPropagation()
        suppress.current = Date.now() + 350
        e.currentTarget.releasePointerCapture(e.pointerId)
        if (resizing)
          send(
            [
              {
                op: 'update_task',
                id: task.id,
                startMinute: resizing.start,
                estimateMinutes: resizing.length,
                scheduledMinutes: null,
              },
            ],
            '调整时间',
          )
        setResizing(null)
      }}
      onPointerCancel={() => setResizing(null)}
    />
  )
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${task.external ? '查看飞书日程' : '编辑'} ${task.title}`}
      title={`${task.title} · ${time(start)} – ${time(Math.min(1440, start + length))}`}
      className={`pd-time-block tone-${projectColor(name)} ${task.kind === 'event' ? 'is-event' : ''} ${task.status === 'done' ? 'is-done' : ''} ${task.external ? 'is-external' : ''} ${length < 45 ? 'is-short' : ''} ${length < 30 ? 'is-tiny' : ''}`}
      data-plan-id={task.id}
      style={{
        top: start,
        height: resizing ? Math.max(24, length) : height,
        left: `calc(${(lane / count) * 100}% + 4px)`,
        width: `calc(${(span / count) * 100}% - 8px)`,
      }}
      draggable={!task.external && !task.historical && !resizing}
      onDragStart={(e) => {
        suppress.current = Date.now() + 1000
        drag(e, task)
      }}
      onDragEnd={() => {
        suppress.current = Date.now() + 350
      }}
      {...trigger}
      onClick={edit}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && ['Enter', ' '].includes(e.key)) {
          e.preventDefault()
          edit(e)
        }
      }}
    >
      {!task.external && !task.historical && resizeHandle('top')}
      {task.kind === 'event' ? (
        <div className="pd-event-block-content">
          <div className="pd-event-block-caption">
            <CalendarIcon size={13} />
            <time>
              {time(start)}–{time(Math.min(1440, start + length))}
            </time>
            <span>{task.external ? '飞书' : '日程'}</span>
          </div>
          <strong>{task.title}</strong>
          <AiMark task={task} />
          {length >= 75 && (task.location || name) && (
            <div className="pd-event-block-context">
              {task.location || name}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="pd-block-title">
            {task.kind !== 'event' && (
              <button
                className="pd-check"
                aria-label={`${task.status === 'done' ? '重新打开' : '完成'} ${task.title}`}
                aria-pressed={task.status === 'done'}
                onClick={(e) => {
                  e.stopPropagation()
                  toggle(task)
                }}
              >
                {task.status === 'done' ? '✓' : ''}
              </button>
            )}
            <strong>{task.title}</strong>
            <AiMark task={task} />
          </div>
          <div className="pd-block-meta">
            <small>
              {time(start)} – {time(Math.min(1440, start + length))}
            </small>
            {task.external ? (
              <span>飞书 · 只读</span>
            ) : (
              <ProjectTag name={name} />
            )}
          </div>
        </>
      )}
      {!task.external && !task.historical && resizeHandle('bottom')}
    </div>
  )
}
function TimeLane({ date, tasks, allTasks, entries, create }) {
  const ref = React.useRef(),
    [selection, setSelection] = React.useState(null)
  const at = (e) =>
    Math.max(
      0,
      Math.min(
        1425,
        Math.round((e.clientY - ref.current.getBoundingClientRect().top) / 15) *
          15,
      ),
    )
  const range = selection
    ? {
        start: Math.min(selection.a, selection.b),
        end: Math.min(1440, Math.max(selection.a, selection.b) + 15),
      }
    : null
  return (
    <div
      ref={ref}
      className="pd-time-lane wb-plan-time-lane"
      aria-label={`${date} 时间轴`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => acceptDrop(e, date, null, at(e))}
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget || e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        setSelection({ a: at(e), b: at(e) })
      }}
      onPointerMove={(e) => {
        if (selection) setSelection({ ...selection, b: at(e) })
      }}
      onPointerUp={(e) => {
        if (!range) return
        e.currentTarget.releasePointerCapture(e.pointerId)
        create({
          date,
          startMinute: range.start,
          duration: range.end - range.start,
        })
        setSelection(null)
      }}
      onPointerCancel={() => setSelection(null)}
    >
      {Array.from({ length: 24 }, (_, i) => (
        <div className="pd-hour" key={i} style={{ top: i * 60 }} />
      ))}
      {range && (
        <div
          className="pd-range"
          style={{ top: range.start, height: range.end - range.start }}
        >
          {time(range.start)} – {time(range.end)}
        </div>
      )}
      {overlapLayout(tasks.filter((t) => Number.isFinite(t.startMinute))).map(
        (row) => (
          <TimeBlock
            key={row.task.id}
            row={row}
            entries={entries}
            tasks={allTasks}
          />
        ),
      )}
    </div>
  )
}
export function PlannerView({ entryDrafts }) {
  const entries = useEntryEditing(entryDrafts)
  const poolFocus = useDesk((s) => s.poolFocus)
  const state = useDesk((s) => s.state),
    focus = useDesk((s) => s.focusTaskId),
    dragState = useDesk((s) => s.planDrag),
    message = useDesk((s) => s.planDropMessage)
  const today = calendarDate(new Date(), state.plan.config.timezone)
  const [date, setDate] = React.useState(today),
    [pref, setPref] = React.useState(prefs),
    [selected, setSelected] = React.useState(null),
    [pool, setPool] = React.useState('backlog'),
    [poolWeek, setPoolWeek] = React.useState(weekOf(today)),
    [filter, setFilter] = React.useState(''),
    [agent, setAgent] = React.useState(false),
    [calendar, setCalendar] = React.useState({
      events: [],
      config: { enabled: false },
      status: 'disabled',
    }),
    [settings, setSettings] = React.useState(false),
    [narrow, setNarrow] = React.useState(window.innerWidth < 720)
  const root = React.useRef(),
    scroll = React.useRef(),
    calendarRequest = React.useRef(0)
  usePlanDrag(root, state)
  const count = pref.count || (narrow ? 1 : 3),
    layout = pref.layout || 'list',
    view = pref.view || 'days'
  const change = (patch) => setPref((v) => ({ ...v, ...patch }))
  const togglePool = (collapsed) => {
    change({ poolCollapsed: collapsed })
    requestAnimationFrame(() =>
      root.current
        ?.querySelector(collapsed ? '.pd-pool-rail' : '.pd-pool-collapse')
        ?.focus({ preventScroll: true }),
    )
  }
  React.useEffect(() => {
    try {
      localStorage.setItem('wb-personal-view', JSON.stringify(pref))
    } catch {}
  }, [pref])
  React.useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setNarrow(entry.contentRect.width < 720),
    )
    observer.observe(root.current)
    return () => observer.disconnect()
  }, [])
  React.useEffect(() => {
    if (layout === 'time' && scroll.current) scroll.current.scrollTop = 480
  }, [layout, view])
  React.useEffect(() => {
    if (focus) {
      const task = state.tasks.find((t) => t.id === focus)
      if (task) {
        setDate(task.plannedDate || today)
        entries.open(task, 'linked')
      }
      setDesk({ focusTaskId: null })
    }
  }, [focus])
  React.useEffect(() => {
    if (poolFocus) {
      setPool(poolFocus)
      change({ poolCollapsed: false })
      setDesk({ poolFocus: null })
    }
  }, [poolFocus])
  const first =
    view === 'month'
      ? weekOf(`${date.slice(0, 7)}-01`)
      : count === 7
        ? weekOf(date)
        : date
  const days = Array.from({ length: view === 'month' ? 42 : count }, (_, i) =>
    addDays(first, i),
  )
  const reload = React.useCallback(
    async (force = false) => {
      const id = ++calendarRequest.current
      try {
        const result = await workbenchRequest(
          `calendar/events?start=${first}&end=${addDays(days.at(-1), 1)}${force ? '&refresh=1' : ''}`,
        )
        if (id === calendarRequest.current) setCalendar(result)
      } catch (e) {
        if (id === calendarRequest.current)
          setCalendar((v) => ({ ...v, error: e.message, status: 'error' }))
      }
    },
    [first, days.at(-1)],
  )
  React.useEffect(() => {
    reload()
    const timer = setInterval(() => reload(), 60000)
    return () => {
      calendarRequest.current++
      clearInterval(timer)
    }
  }, [reload])
  const rows = (d) =>
    [
      ...dayTasks(state, d),
      ...(calendar.events || []).filter((t) => t.plannedDate === d),
    ].filter(
      (t) => t.external || !filter || projectName(t, state.tasks) === filter,
    )
  const week = poolWeek,
    poolRows = poolTasks(state, pool === 'backlog' ? null : week).filter(
      (t) => t.external || !filter || projectName(t, state.tasks) === filter,
    )
  const select = (options) => setSelected(options)
  const navigate = (n) => {
    if (view === 'month') {
      const d = new Date(`${date.slice(0, 7)}-01T12:00:00Z`)
      d.setUTCMonth(d.getUTCMonth() + n)
      setDate(d.toISOString().slice(0, 10))
    } else setDate(addDays(date, n * count))
  }
  const untimedExpanded = pref.untimedExpanded === true
  const untimedHeight = !untimedExpanded
    ? 36
    : Math.min(
        280,
        Math.max(
          36,
          ...days.map(
            (d) =>
              rows(d).filter((t) => !Number.isFinite(t.startMinute)).length *
                68 +
              36,
          ),
        ),
      )
  return (
    <div
      ref={root}
      className={`pd-planner ${dragState ? 'is-dragging-plan' : ''}`}
    >
      <header className="pd-toolbar">
        <div className="pd-heading">
          <span className="pd-month">
            {date.slice(0, 4)} / {Number(date.slice(5, 7))}
          </span>
          <h1>
            {view === 'month'
              ? `${Number(date.slice(5, 7))} 月`
              : count === 1
                ? `${Number(date.slice(5, 7))} 月 ${Number(date.slice(8))} 日`
                : count === 7
                  ? '这一周'
                  : '这几天'}
          </h1>
        </div>
        <div className="pd-navigation">
          <button aria-label="上一段日期" onClick={() => navigate(-1)}>
            ‹
          </button>
          <button onClick={() => setDate(today)}>今天</button>
          <button aria-label="下一段日期" onClick={() => navigate(1)}>
            ›
          </button>
          <input
            aria-label="跳转日期"
            type="date"
            value={date}
            onInput={(e) => e.target.value && setDate(e.target.value)}
          />
        </div>
        <div className="pd-view-controls">
          <div className="pd-segment" aria-label="视图">
            {[
              ['list', '清单'],
              ['time', '时间轴'],
            ].map(([v, label]) => (
              <button
                key={v}
                aria-pressed={layout === v && view === 'days'}
                onClick={() => change({ layout: v, view: 'days' })}
              >
                {label}
              </button>
            ))}
            <button
              aria-pressed={view === 'month'}
              onClick={() => change({ view: 'month' })}
            >
              月
            </button>
          </div>
          {view !== 'month' && (
            <select
              aria-label="显示天数"
              value={count}
              onChange={(e) => change({ count: Number(e.target.value) })}
            >
              <option value="1">1 天</option>
              <option value="3">3 天</option>
              <option value="7">7 天</option>
            </select>
          )}
        </div>
      </header>
      <CollaborationPanel
        project={filter}
        collapsed={pref.collaborationCollapsed === true}
        onToggle={() =>
          change({ collaborationCollapsed: !pref.collaborationCollapsed })
        }
      />
      <div
        className={`pd-workspace ${pref.poolCollapsed ? 'is-pool-collapsed' : ''}`}
      >
        {pref.poolCollapsed && (
          <button
            className="pd-pool-rail"
            aria-label="展开事项池"
            aria-expanded="false"
            onClick={() => togglePool(false)}
          >
            <span aria-hidden="true">›</span>
            <span>事项池</span>
            <small>{poolRows.length}</small>
          </button>
        )}
        {!pref.poolCollapsed && (
          <aside
            className="pd-pool"
            data-drop-backlog={pool === 'backlog' ? 'true' : undefined}
            data-drop-week={pool === 'week' ? week : undefined}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) =>
              acceptDrop(e, null, null, null, pool === 'week' ? week : null)
            }
          >
            <header>
              <div>
                <h2>事项池</h2>
              </div>
              <div className="pd-pool-header-actions">
                <button
                  className="pd-pool-collapse"
                  aria-label="收起事项池"
                  aria-expanded="true"
                  title="收起事项池"
                  onClick={() => togglePool(true)}
                >
                  ‹
                </button>
                <button
                  aria-label="添加到当前事项池"
                  onClick={() =>
                    select({ week: pool === 'week' ? week : null })
                  }
                >
                  ＋
                </button>
              </div>
            </header>
            <div className="pd-pool-switch">
              <button
                aria-pressed={pool === 'backlog'}
                onClick={() => setPool('backlog')}
              >
                待安排 <span>{poolTasks(state).length}</span>
              </button>
              <button
                aria-pressed={pool === 'week'}
                onClick={() => setPool('week')}
              >
                周事项 <span>{poolTasks(state, week).length}</span>
              </button>
            </div>
            {pool === 'week' && (
              <div className="pd-pool-week">
                <button
                  aria-label="上一周事项池"
                  onClick={() => setPoolWeek(addDays(week, -7))}
                >
                  ‹
                </button>
                <label>
                  {week === weekOf(today)
                    ? '本周'
                    : week === addDays(weekOf(today), 7)
                      ? '下周'
                      : `${week.slice(5)} 这一周`}
                  <input
                    type="date"
                    aria-label="选择事项池周"
                    value={week}
                    onInput={(e) =>
                      e.target.value && setPoolWeek(weekOf(e.target.value))
                    }
                  />
                </label>
                <button
                  aria-label="下一周事项池"
                  onClick={() => setPoolWeek(addDays(week, 7))}
                >
                  ›
                </button>
              </div>
            )}
            <div className="pd-pool-items">
              {poolRows.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  tasks={state.tasks}
                  entries={entries}
                  week={pool === 'week' ? week : null}
                />
              ))}
              {!poolRows.length && <p className="pd-empty">暂无事项</p>}
            </div>
          </aside>
        )}
        <section
          className="pd-calendar"
          style={{
            '--pd-days': count,
            '--pd-ruler': layout === 'time' ? '48px' : '0px',
          }}
        >
          <div className="pd-calendar-caption">
            <select
              aria-label="筛选项目"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">全部项目</option>
              {projectOptions(state.tasks).map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            <div className="pd-calendar-tools">
              <button
                className={`pd-calendar-connect ${calendar.status === 'ready' ? 'is-connected' : ''}`}
                aria-label={
                  calendar.status === 'ready' ? '飞书日历，已连接' : '飞书日历'
                }
                onClick={() => setSettings(true)}
              >
                <svg
                  viewBox="0 0 20 20"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="14" height="13" rx="2" />
                  <path d="M6 2v4m8-4v4M3 8h14" />
                </svg>
                飞书日历
                {calendar.status === 'ready' && (
                  <span className="pd-connected-label">
                    <CheckIcon size={12} />
                    已连接
                  </span>
                )}
                <i
                  className={`pd-connection-dot is-${calendar.status}`}
                  title={
                    calendar.status === 'ready'
                      ? '已连接'
                      : calendar.status === 'error'
                        ? '连接失败'
                        : '未接入'
                  }
                />
              </button>
              {calendar.status === 'ready' && (
                <button onClick={() => reload(true)} aria-label="刷新飞书日程">
                  ↻
                </button>
              )}
              <button
                className="pd-agent"
                aria-expanded={agent}
                onClick={() => setAgent(!agent)}
              >
                <svg
                  viewBox="0 0 20 20"
                  width="15"
                  height="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path d="m10 2 2.2 5.8L18 10l-5.8 2.2L10 18l-2.2-5.8L2 10l5.8-2.2Z" />
                </svg>
                助手 <span aria-hidden="true">{agent ? '⌃' : '⌄'}</span>
              </button>
            </div>
          </div>
          {calendar.error && (
            <p className="pd-calendar-error" role="status">
              飞书日程暂不可用{' '}
              <button onClick={() => setSettings(true)}>检查连接</button>
            </p>
          )}
          {agent && (
            <div className="pd-agent-actions">
              <button
                disabled={!!state.plan.organizer.lease}
                onClick={() => runPlanOrganizer({ mode: 'collect' })}
              >
                整理事项
              </button>
              <button
                disabled={
                  !!state.plan.organizer.lease ||
                  date < today ||
                  !planningTaskIds(state, date).length
                }
                onClick={() => runPlanOrganizer({ mode: 'schedule', date })}
              >
                安排 {date.slice(5)} 时间
              </button>
              {state.plan.organizer.lease && (
                <small role="status">正在整理…</small>
              )}
              {state.plan.organizer.error && (
                <small role="alert">{state.plan.organizer.error}</small>
              )}
            </div>
          )}
          {view === 'month' ? (
            <div className="pd-month-grid">
              {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(
                (d) => (
                  <strong className="pd-month-weekday" key={d}>
                    {d}
                  </strong>
                ),
              )}
              {days.map((d) => (
                <section
                  key={d}
                  className={`pd-month-day ${d.slice(0, 7) !== date.slice(0, 7) ? 'is-other-month' : ''} ${d === today ? 'is-today' : ''}`}
                  data-drop-date={d}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => acceptDrop(e, d)}
                >
                  <header>
                    <button
                      onClick={() => {
                        setDate(d)
                        change({ view: 'days', count: 1 })
                      }}
                    >
                      {Number(d.slice(-2))}
                    </button>
                    <button
                      aria-label={`添加 ${d} 事项`}
                      onClick={() => select({ date: d })}
                    >
                      ＋
                    </button>
                  </header>
                  {rows(d).map((task) => (
                    <button
                      draggable={!task.external && !task.historical}
                      onDragStart={(e) => drag(e, task)}
                      className={`pd-month-item tone-${projectColor(projectName(task, state.tasks))} ${task.kind === 'event' ? 'is-event' : ''} ${task.status === 'done' ? 'is-done' : ''}`}
                      key={task.id}
                      {...entries.button(task, 'calendar')}
                    >
                      {task.kind === 'event' ? (
                        <CalendarIcon size={12} />
                      ) : (
                        <i />
                      )}
                      {task.status === 'done' ? '✓ ' : ''}
                      {task.title}
                      <AiMark task={task} />
                    </button>
                  ))}
                </section>
              ))}
            </div>
          ) : (
            <div
              className="pd-day-scroll wb-plan-surface"
              ref={scroll}
              tabIndex={0}
              aria-label="日历，可横向滚动"
            >
              <div className="pd-calendar-grid">
                <div
                  className={`pd-day-headers ${layout === 'time' ? 'is-time' : ''}`}
                  style={{ '--pd-days': count }}
                >
                  {layout === 'time' && <span />}
                  {days.map((d) => (
                    <header
                      className={d === today ? 'is-today' : ''}
                      key={d}
                      data-drop-date={d}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => acceptDrop(e, d)}
                    >
                      <button
                        onClick={() => {
                          setDate(d)
                          change({ count: 1 })
                        }}
                      >
                        <span>
                          {weekday(d)}
                          {d === today ? ' · 今天' : ''}
                        </span>
                        <strong>{Number(d.slice(-2))}</strong>
                      </button>
                      <small>{rows(d).length} 项</small>
                      <button
                        className="pd-day-add"
                        aria-label={`添加 ${d} 事项`}
                        onClick={() => select({ date: d })}
                      >
                        ＋
                      </button>
                    </header>
                  ))}
                </div>
                <div
                  className={`pd-days ${layout === 'time' ? 'is-time' : ''}`}
                  style={{ '--pd-days': count }}
                >
                  {layout === 'time' && (
                    <div className="pd-ruler">
                      <div style={{ height: untimedHeight }}>
                        <button
                          className="pd-untimed-ruler"
                          aria-label={
                            untimedExpanded
                              ? '收起未定时间事项'
                              : '展开未定时间事项'
                          }
                          aria-expanded={untimedExpanded}
                          onClick={() =>
                            change({ untimedExpanded: !untimedExpanded })
                          }
                        >
                          {untimedExpanded ? '⌃' : '⌄'}
                        </button>
                      </div>
                      <div className="pd-ruler-hours">
                        {Array.from({ length: 24 }, (_, i) => (
                          <span key={i} style={{ top: i * 60 }}>
                            {time(i * 60)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {days.map((d) => (
                    <section
                      className={`pd-day ${d === today ? 'is-today' : ''}`}
                      key={d}
                      data-drop-date={d}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => acceptDrop(e, d)}
                    >
                      {layout === 'list' ? (
                        <DayList
                          items={rows(d)}
                          date={d}
                          tasks={state.tasks}
                          entries={entries}
                        />
                      ) : (
                        <>
                          <div
                            className="pd-untimed"
                            style={{ height: untimedHeight }}
                          >
                            <button
                              className="pd-untimed-toggle"
                              aria-expanded={untimedExpanded}
                              onClick={() =>
                                change({ untimedExpanded: !untimedExpanded })
                              }
                            >
                              <span>未定时间 / 全天</span>
                              <span>
                                {
                                  rows(d).filter(
                                    (t) => !Number.isFinite(t.startMinute),
                                  ).length
                                }{' '}
                                · {untimedExpanded ? '收起' : '展开'}
                              </span>
                            </button>
                            {untimedExpanded &&
                              rows(d)
                                .filter((t) => !Number.isFinite(t.startMinute))
                                .map((task) => (
                                  <TaskRow
                                    key={task.id}
                                    task={task}
                                    date={d}
                                    tasks={state.tasks}
                                    entries={entries}
                                    place="calendar"
                                  />
                                ))}
                          </div>
                          <TimeLane
                            date={d}
                            tasks={rows(d)}
                            allTasks={state.tasks}
                            entries={entries}
                            create={select}
                          />
                        </>
                      )}
                    </section>
                  ))}
                </div>
              </div>
            </div>
          )}
          {(view === 'month' || layout === 'time') &&
            entries.selected?.place === 'calendar' &&
            days.some((d) =>
              rows(d).some((t) => entries.matches(t, 'calendar')),
            ) &&
            entries.render('calendar')}
          {entries.render('linked')}
        </section>
      </div>
      <div className="pd-drag-status" role="status" aria-live="polite">
        {message || ''}
      </div>
      {selected && (
        <PersonalEditor
          key={`${selected.date}:${selected.startMinute}:${selected.week}`}
          context={selected}
          close={() => setSelected(null)}
        />
      )}
      {settings && (
        <FeishuConnection
          config={calendar.config}
          connection={calendar}
          close={() => setSettings(false)}
          reload={reload}
        />
      )}
    </div>
  )
}
