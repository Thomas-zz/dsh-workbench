import { applyOps } from './ops.js'
import {
  autoSchedule,
  calendarDate,
  isAction,
  isPersonalTask,
  openTask,
  weekOf,
} from './planner.js'

// An explicit organization run may carry actions; simply opening the app does not.
export function reconcilePlan(
  draft,
  base,
  planning,
  { busy = [], skipTimes = false, newIds = [], now = new Date() } = {},
) {
  const { date } = planning
  const today = calendarDate(now, draft.plan.config.timezone)
  const result = { carried: 0, scheduled: 0, unscheduled: 0, tasks: [] }
  if (date < today) return result
  const candidates = new Set([...planning.taskIds, ...newIds])
  const ids = [],
    before = new Map()
  for (const task of draft.tasks) {
    if (
      !candidates.has(task.id) ||
      !isAction(task) ||
      !isPersonalTask(task) ||
      !openTask(task) ||
      !task.plannedDate ||
      task.plannedDate > date ||
      (task.plannedDate !== date && task.plannedDate >= today)
    )
      continue
    const original = base.tasks.find((t) => t.id === task.id)
    // Manual changes made while the Agent thinks always win, including completion.
    if (
      original &&
      (JSON.stringify(task.userFields) !==
        JSON.stringify(original.userFields) ||
        task.plannedDate !== original.plannedDate ||
        task.startMinute !== original.startMinute)
    )
      continue
    if (task.plannedDate === date && task.startMinute !== null) continue
    before.set(task.id, structuredClone(task))
    if (task.plannedDate < date) {
      const applied = applyOps(draft, [
        {
          op: 'update_task',
          id: task.id,
          plannedDate: date,
          plannedWeek: weekOf(date),
          startMinute: null,
          scheduledMinutes: null,
          carriedFrom: task.carriedFrom || task.plannedDate,
          actor: 'organizer',
        },
      ])
      if (applied.errors.length) throw new Error(applied.errors.join('；'))
      result.carried++
    }
    if (task.status !== 'blocked') ids.push(task.id)
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: draft.plan.config.timezone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now)
  const minute =
    Number(parts.find((p) => p.type === 'hour').value) * 60 +
    Number(parts.find((p) => p.type === 'minute').value)
  if (!skipTimes)
    autoSchedule(draft, date, {
      ids,
      force: true,
      fit: false,
      busy,
      notBefore: date === today ? Math.ceil(minute / 15) * 15 : 0,
    })
  for (const [id, original] of before) {
    const task = draft.tasks.find((t) => t.id === id)
    if (ids.includes(id)) {
      if (task.startMinute !== null) result.scheduled++
      else result.unscheduled++
    }
    const changed = [
      'plannedDate',
      'startMinute',
      'scheduledMinutes',
      'estimateMinutes',
    ].some((key) => task[key] !== original[key])
    if (!changed) continue
    task.updatedAt = now.toISOString()
    result.tasks.push({
      id,
      title: task.title,
      kind: task.kind,
      plannedDate: task.plannedDate,
      previousDate: original.plannedDate,
      startMinute: task.startMinute,
      scheduledMinutes: task.scheduledMinutes,
      action:
        task.plannedDate !== original.plannedDate ? 'carried' : 'scheduled',
      evidenceKeys: [planning.requestKey],
    })
  }
  return result
}
