import React from 'react'
import { PersonalEditor } from './personal-editor.jsx'
import { time } from './plan-shared.jsx'

// A day record (or a recurring calendar occurrence) isn't the live task with the same ID.
const entryKey = (t) =>
  JSON.stringify([
    t.id,
    t.historical ? 'history' : t.external ? 'calendar' : 'task',
    t.historical || t.external ? t.plannedDate : null,
  ])

function CalendarSummary({ task, close }) {
  const dismiss = React.useRef(null)
  React.useLayoutEffect(() => {
    dismiss.current?.focus({ preventScroll: true })
    dismiss.current
      ?.closest('section')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [])
  const start = task.startMinute
  return (
    <>
      <header>
        <span>飞书日程 · 只读</span>
        <button ref={dismiss} aria-label="收起日程" onClick={close}>
          ×
        </button>
      </header>
      <strong>{task.title}</strong>
      <p>
        {task.plannedDate} ·{' '}
        {Number.isFinite(start)
          ? `${time(start)}–${time(Math.min(1440, start + (task.scheduledMinutes || task.estimateMinutes || 30)))}`
          : '全天'}
      </p>
      {task.location && <p>{task.location}</p>}
    </>
  )
}

// One open entry per view. Switching entries parks only changed fields in memory;
// cancelling discards them, and simply inspecting a row never dispatches an op.
export function useEntryEditing(drafts) {
  const [selected, setSelected] = React.useState(null)
  const current = React.useRef(null)
  const regionId = React.useId()
  const open = (task, place, trigger, field) => {
    const key = entryKey(task)
    const next =
      current.current?.key === key &&
      current.current.place === place &&
      current.current.field === field
        ? null
        : { task, key, place, trigger, field }
    current.current = next
    setSelected(next)
  }
  const matches = (task, place) =>
    selected?.place === place && selected.key === entryKey(task)
  const button = (task, place, field) => {
    const expanded = matches(task, place)
    return {
      'aria-expanded': expanded,
      'aria-controls': expanded ? regionId : undefined,
      onClick: (e) => open(task, place, e.currentTarget, field),
    }
  }
  const render = (place, task) => {
    if (selected?.place !== place || (task && selected.key !== entryKey(task)))
      return null
    const { key, trigger, field } = selected
    const collapse = () => {
      if (current.current !== selected) return
      current.current = null
      setSelected(null)
      requestAnimationFrame(() => {
        if (
          !current.current &&
          trigger?.isConnected &&
          document.activeElement === document.body
        )
          trigger.focus({ preventScroll: true })
      })
    }
    const close = () => {
      drafts.delete(key)
      collapse()
    }
    const inline = {
      field,
      collapse,
      // A slow save must not discard edits made after switching away and back.
      afterWrite: () => {
        const submitted = drafts.get(key)
        return () => {
          if (drafts.get(key) === submitted) close()
        }
      },
      draft: drafts.get(key),
      remember: (patch) => drafts.set(key, { ...drafts.get(key), ...patch }),
    }
    return (
      <section
        key={key + ':' + (field || '')}
        id={regionId}
        className="pd-inline-entry pd-editor"
        aria-label={selected.task.external ? '飞书日程详情' : '就地编辑'}
        onKeyDown={(e) => {
          if (
            e.key === 'Escape' &&
            !e.nativeEvent.isComposing &&
            !e.defaultPrevented &&
            selected.task.external
          ) {
            e.stopPropagation()
            close()
          }
        }}
      >
        {selected.task.external ? (
          <CalendarSummary task={selected.task} close={close} />
        ) : (
          <PersonalEditor
            context={{ task: selected.task }}
            inline={inline}
            close={close}
          />
        )}
      </section>
    )
  }
  return { button, render, open, selected, matches }
}
