import React from 'react'
import { CalendarIcon } from './connection-shared.jsx'
import { useDesk } from './desk.js'
import { Dialog, send, time, parseTime } from './plan-shared.jsx'
import { addDays, weekOf, calendarDate, isProject } from '../src/planner.js'
import {
  capturePlacement,
  projectColor,
  projectName,
  projectOptions,
  taskSuggestions,
} from '../src/personal-plan.js'

export function ProjectTag({ name }) {
  return name ? (
    <span className={`pd-tag tone-${projectColor(name)}`}>
      <i />
      {name}
    </span>
  ) : null
}
export function PersonalEditor({ context = {}, close, onSaved, inline }) {
  const state = useDesk((s) => s.state)
  const titleInput = React.useRef(null)
  React.useEffect(() => {
    if (!inline) titleInput.current?.focus()
  }, [])
  React.useLayoutEffect(() => {
    const title = titleInput.current
    if (!title || !inline) return
    const region = title.closest('.pd-inline-entry')
    const target =
      inline.field === 'schedule'
        ? region?.querySelector('.pd-placement :is(select,input):enabled')
        : title
    if (!window.matchMedia('(pointer: coarse)').matches)
      (target || title).focus({ preventScroll: true })
    region?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [])
  const original = context.task
  const historical = !!original?.historical
  const [form, setForm] = React.useState(() => ({
    title: '',
    project: context.project || '',
    parentId: context.parentId || null,
    note: '',
    status: 'todo',
    kind: context.kind || 'action',
    location: '',
    estimateMinutes: context.duration || 30,
    ...capturePlacement(context),
    ...original,
    ...(original
      ? {
          estimateMinutes:
            original.scheduledMinutes || original.estimateMinutes || 30,
          project: projectName(original, state.tasks),
        }
      : {}),
    ...inline?.draft,
  }))
  const [section, setSection] = React.useState(inline?.field || '')
  const toggleSection = (name) => {
    setQueryProject(null)
    setSection((s) => (s === name ? '' : name))
  }
  const [reuse, setReuse] = React.useState(null),
    [queryProject, setQueryProject] = React.useState(null),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(''),
    [suggest, setSuggest] = React.useState(!original),
    [active, setActive] = React.useState(-1)
  const [dirty, setDirty] = React.useState(!!inline?.draft)
  const change = (patch) => {
    setDirty(true)
    inline?.remember(patch)
    setForm((v) => ({ ...v, ...patch }))
  }
  const today = calendarDate(new Date(), state.plan.config.timezone)
  const event = form.kind === 'event'
  const options = projectOptions(state.tasks)
  const suggestions =
    suggest && !original && !event
      ? taskSuggestions(state.tasks, form.title)
      : []
  const chooseKind = (kind) => {
    setReuse(null)
    setSuggest(false)
    setError('')
    change({
      kind,
      ...(kind === 'event' && !form.plannedDate
        ? {
            plannedDate: context.date || today,
            plannedWeek: weekOf(context.date || today),
          }
        : {}),
    })
  }
  const choose = (task) => {
    setReuse(task.status === 'done' ? null : task)
    change({
      title: task.title,
      project: projectName(task, state.tasks),
      parentId: task.parentId || null,
      note: task.status === 'done' ? '' : task.note || '',
    })
    setSuggest(false)
    setActive(-1)
  }
  const place = (value) => {
    if (value === 'day')
      change({
        plannedDate: form.plannedDate || today,
        plannedWeek: weekOf(form.plannedDate || today),
      })
    else
      change({
        plannedDate: null,
        plannedWeek: value === 'pool' ? null : value,
        startMinute: null,
      })
  }
  const save = async () => {
    if (!form.title.trim() || busy || (inline && !dirty)) return
    if (event && !form.plannedDate) {
      setError('请选择日程日期')
      return
    }
    const finish = inline?.afterWrite() || close
    setBusy(true)
    setError('')
    const parent = state.tasks.find(
      (t) => isProject(t) && t.title === form.project,
    )
    const patch = {
      title: form.title.trim(),
      kind: form.kind,
      project: form.project,
      parentId: parent?.id || null,
      note: form.note,
      plannedDate: form.plannedDate,
      plannedWeek: form.plannedDate
        ? weekOf(form.plannedDate)
        : form.plannedWeek,
      startMinute: form.plannedDate ? form.startMinute : null,
      ...(event ? { location: form.location } : {}),
    }
    if (event && !Number.isFinite(patch.startMinute)) {
      patch.estimateMinutes = null
      patch.scheduledMinutes = null
    }
    if (Number.isFinite(patch.startMinute)) {
      patch.estimateMinutes = Math.max(
        15,
        Math.min(1440 - patch.startMinute, form.estimateMinutes || 30),
      )
      patch.scheduledMinutes = null
    }
    if (original && !historical) {
      if (
        form.startMinute === original.startMinute &&
        form.estimateMinutes ===
          (original.scheduledMinutes || original.estimateMinutes || 30)
      ) {
        delete patch.estimateMinutes
        delete patch.scheduledMinutes
      }
      for (const key of Object.keys(patch)) {
        const previous =
          key === 'project' ? projectName(original, state.tasks) : original[key]
        if (patch[key] === previous) delete patch[key]
      }
    }
    const task = original || reuse
    const result = await send(
      [
        {
          op: task ? 'update_task' : 'add_task',
          ...(task ? { id: task.id } : { kind: form.kind, order: Date.now() }),
          ...patch,
          ...(historical
            ? {
                op: 'plan_record',
                date: original.plannedDate,
                id: original.id,
                patch,
              }
            : {}),
        },
      ],
      task ? '编辑事项' : '记录事项',
    )
    setBusy(false)
    if (result && !result.errors?.length) {
      onSaved?.()
      finish()
    } else setError(result?.errors?.[0] || '没有保存成功，请重试')
  }
  const remove = async () => {
    if (busy) return
    const finish = inline?.afterWrite() || close
    setBusy(true)
    const result = await send(
      [{ op: 'delete_task', id: original.id }],
      '删除事项',
    )
    setBusy(false)
    if (result && !result.errors?.length) finish()
    else setError('删除失败，请重试')
  }
  const week = weekOf(today)
  const weeks = [
    ...new Set([week, addDays(week, 7), form.plannedWeek].filter(Boolean)),
  ]
  const scheduleLabel = form.plannedDate
    ? `${form.plannedDate.slice(5)}${Number.isFinite(form.startMinute) ? ' · ' + time(form.startMinute) : event ? ' · 全天' : ''}`
    : form.plannedWeek
      ? `${form.plannedWeek.slice(5)} 这一周`
      : '待安排事项池'
  const titleField = (
    <input
      ref={titleInput}
      className="pd-title-input"
      aria-label="事项标题"
      placeholder={event ? '安排什么日程？' : '想做什么？'}
      value={form.title}
      maxLength={500}
      onChange={(e) => {
        change({ title: e.target.value })
        setSuggest(true)
        setReuse(null)
        setActive(-1)
      }}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return
        if (e.key === 'ArrowDown' && suggestions.length) {
          e.preventDefault()
          setActive((v) => (v + 1) % suggestions.length)
        }
        if (e.key === 'ArrowUp' && suggestions.length) {
          e.preventDefault()
          setActive((v) => (v + suggestions.length - 1) % suggestions.length)
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          if (active >= 0 && suggestions[active]) choose(suggestions[active])
          else save()
        }
      }}
      aria-expanded={original ? undefined : suggestions.length > 0}
      aria-controls={suggestions.length ? 'pd-suggestions' : undefined}
      aria-activedescendant={
        active >= 0 ? `pd-suggestion-${active}` : undefined
      }
      role={original ? undefined : 'combobox'}
      autoComplete="off"
    />
  )
  const content = (
    <>
      {!inline && (
        <header>
          <span>
            {original
              ? event
                ? '编辑日程'
                : '编辑事项'
              : context.date
                ? `${context.date.slice(5)} · ${event ? '添加日程' : '添加事项'}`
                : event
                  ? '添加日程'
                  : context.week
                    ? '添加周事项'
                    : '记录一下'}
          </span>
          <button aria-label="关闭编辑" disabled={busy} onClick={close}>
            ×
          </button>
        </header>
      )}
      {inline ? (
        <div className="pd-entry-heading">
          {titleField}
          <button
            className="pd-fold-entry"
            disabled={busy}
            aria-label={dirty ? '收起并保留草稿' : '收起事项'}
            title={dirty ? '收起并保留草稿' : '收起事项'}
            onClick={inline.collapse}
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path d="m4 10 4-4 4 4" />
            </svg>
          </button>
        </div>
      ) : (
        titleField
      )}
      {(!inline || section === 'more') && (
        <div className="pd-kind-switch" role="group" aria-label="记录类型">
          <button
            aria-pressed={!event}
            disabled={historical}
            onClick={() => chooseKind('action')}
          >
            事项
          </button>
          <button
            aria-pressed={event}
            disabled={historical}
            onClick={() => chooseKind('event')}
          >
            <CalendarIcon size={15} />
            日程
          </button>
        </div>
      )}
      {suggestions.length > 0 && (
        <div
          className="pd-suggestions"
          id="pd-suggestions"
          role="listbox"
          aria-label="相似事项"
        >
          <small>之前记过，直接接着安排</small>
          {suggestions.map((task, i) => (
            <button
              role="option"
              aria-selected={active === i}
              id={`pd-suggestion-${i}`}
              key={task.id}
              onClick={() => choose(task)}
              className={active === i ? 'is-selected' : ''}
            >
              <span>
                <strong>{task.title}</strong>
                <ProjectTag name={projectName(task, state.tasks)} />
              </span>
              <em>{task.status === 'done' ? '再做一次' : '使用这件事'}</em>
            </button>
          ))}
        </div>
      )}
      {reuse && <p className="pd-reuse">将调整已有事项的位置，保留原记录。</p>}
      <div className="pd-editor-meta">
        <button
          className="pd-project-picker"
          disabled={historical}
          aria-expanded={queryProject !== null}
          onClick={() => {
            setSection('')
            setQueryProject(queryProject === null ? '' : null)
          }}
        >
          {form.project ? <ProjectTag name={form.project} /> : '＋ 选择项目'}
        </button>
        {inline ? (
          <>
            <button
              className="pd-field-chip"
              aria-label={`修改安排：${scheduleLabel}`}
              aria-expanded={section === 'schedule'}
              onClick={() => toggleSection('schedule')}
            >
              {scheduleLabel} <span aria-hidden="true">⌄</span>
            </button>
            <button
              className="pd-field-chip"
              aria-expanded={section === 'more'}
              onClick={() => toggleSection('more')}
            >
              更多 <span aria-hidden="true">⌄</span>
            </button>
          </>
        ) : (
          <span>{scheduleLabel}</span>
        )}
      </div>
      {queryProject !== null && (
        <section className="pd-project-options">
          <input
            aria-label="搜索或新建项目"
            placeholder="搜索项目，或输入新名称"
            value={queryProject}
            onChange={(e) => setQueryProject(e.target.value)}
          />
          <div>
            <button
              onClick={() => {
                change({ project: '', parentId: null })
                setQueryProject(null)
              }}
            >
              独立事项
            </button>
            {options
              .filter((n) =>
                n.toLowerCase().includes(queryProject.toLowerCase()),
              )
              .map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    change({ project: name })
                    setQueryProject(null)
                  }}
                >
                  <ProjectTag name={name} />
                </button>
              ))}
            {queryProject.trim() && !options.includes(queryProject.trim()) && (
              <button
                onClick={() => {
                  change({ project: queryProject.trim(), parentId: null })
                  setQueryProject(null)
                }}
              >
                ＋ 使用项目「{queryProject.trim()}」
              </button>
            )}
          </div>
        </section>
      )}
      {(!inline || section === 'schedule') && (
        <>
          <div className="pd-placement">
            {!event && (
              <label>
                安排到
                <select
                  aria-label="安排到"
                  disabled={historical}
                  value={form.plannedDate ? 'day' : form.plannedWeek || 'pool'}
                  onChange={(e) => place(e.target.value)}
                >
                  <option value="pool">待安排事项池</option>
                  {weeks.map((w) => (
                    <option key={w} value={w}>
                      {w === week
                        ? '本周'
                        : w === addDays(week, 7)
                          ? '下周'
                          : w.slice(5) + ' 这一周'}{' '}
                      · {w.slice(5)}
                    </option>
                  ))}
                  <option value="day">某一天</option>
                </select>
              </label>
            )}
            {form.plannedDate || event ? (
              <label>
                {event ? '日程日期' : '日期'}
                <input
                  type="date"
                  aria-label="安排日期"
                  disabled={historical}
                  value={form.plannedDate || ''}
                  onInput={(e) =>
                    change({
                      plannedDate: e.target.value || null,
                      plannedWeek: e.target.value
                        ? weekOf(e.target.value)
                        : null,
                      ...(!e.target.value ? { startMinute: null } : {}),
                    })
                  }
                />
              </label>
            ) : form.plannedWeek ? (
              <label>
                选择其他周
                <input
                  type="date"
                  aria-label="需求池所在周"
                  disabled={historical}
                  value={form.plannedWeek}
                  onInput={(e) =>
                    change({
                      plannedWeek: e.target.value
                        ? weekOf(e.target.value)
                        : null,
                    })
                  }
                />
              </label>
            ) : null}
          </div>
          {form.plannedDate && (
            <div className="pd-time-fields">
              <label>
                <input
                  type="checkbox"
                  checked={Number.isFinite(form.startMinute)}
                  onChange={(e) =>
                    change({ startMinute: e.target.checked ? 540 : null })
                  }
                />{' '}
                {event ? '指定时段' : '指定时间'}
              </label>
              {event && !Number.isFinite(form.startMinute) && (
                <span className="pd-all-day-label">全天日程</span>
              )}
              {Number.isFinite(form.startMinute) && (
                <>
                  <input
                    type="time"
                    aria-label="开始时间"
                    value={time(form.startMinute)}
                    onInput={(e) =>
                      change({ startMinute: parseTime(e.target.value) })
                    }
                  />
                  <span>持续</span>
                  <input
                    type="number"
                    aria-label="持续分钟"
                    min="15"
                    max={1440 - form.startMinute}
                    step="15"
                    value={form.estimateMinutes || 30}
                    onChange={(e) =>
                      change({ estimateMinutes: Number(e.target.value) })
                    }
                  />
                  <span>分钟</span>
                </>
              )}
            </div>
          )}
        </>
      )}
      {(!inline || section === 'more') && (
        <>
          {event && (
            <label className="pd-event-location">
              地点
              <input
                aria-label="日程地点"
                placeholder="可选"
                value={form.location}
                onChange={(e) => change({ location: e.target.value })}
              />
            </label>
          )}
          <textarea
            aria-label="事项备注"
            placeholder="备注（可选）"
            rows={3}
            value={form.note}
            onChange={(e) => change({ note: e.target.value })}
          />
        </>
      )}
      {inline && section !== 'more' && form.note && (
        <button className="pd-entry-note" onClick={() => toggleSection('more')}>
          {form.note}
        </button>
      )}
      {error && (
        <p role="alert" className="pd-error">
          {error}
        </p>
      )}
      {(!inline || dirty || section === 'more' || historical) && (
        <footer>
          {(!inline || section === 'more') &&
            original &&
            !historical &&
            !event &&
            !isProject(original) &&
            !['done', 'cancelled'].includes(original.status) && (
              <button
                disabled={busy}
                onClick={async () => {
                  const finish = inline?.afterWrite() || close
                  setBusy(true)
                  const result = await send(
                    [{ op: 'move_to_collaboration', id: original.id }],
                    '移到待协作',
                  )
                  setBusy(false)
                  if (result && !result.errors?.length) finish()
                  else setError(result?.errors?.[0] || '移动失败，请重试')
                }}
              >
                移到待协作
              </button>
            )}
          {(!inline || section === 'more') && original && !historical && (
            <button className="pd-delete" disabled={busy} onClick={remove}>
              删除事项
            </button>
          )}
          {inline && (
            <small>{dirty ? '未保存' : historical ? '历史记录' : ''}</small>
          )}
          <span />
          {(!inline || dirty) && (
            <>
              <button disabled={busy} onClick={close}>
                取消
              </button>
              <button
                className="pd-primary"
                disabled={busy || !form.title.trim() || (inline && !dirty)}
                onClick={save}
              >
                {busy
                  ? '保存中…'
                  : original || reuse
                    ? '保存修改'
                    : event
                      ? '添加日程'
                      : '记下'}
              </button>
            </>
          )}
        </footer>
      )}
    </>
  )
  if (inline)
    return (
      <fieldset
        className="pd-inline-form"
        disabled={busy}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !busy && !e.nativeEvent.isComposing) {
            e.preventDefault()
            e.stopPropagation()
            close()
          }
        }}
      >
        {content}
      </fieldset>
    )
  return (
    <Dialog
      close={() => !busy && close()}
      label={
        original
          ? event
            ? '编辑日程'
            : '编辑事项'
          : event
            ? '添加日程'
            : '记录一下'
      }
      className="pd-editor"
    >
      {content}
    </Dialog>
  )
}
