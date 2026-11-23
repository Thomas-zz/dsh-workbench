import {
  isProject,
  isPersonalTask,
  isAction,
  openTask,
  weekOf,
  byOrder,
  calendarDate,
} from './planner.js'

export function planningTaskIds(state, date, now = new Date()) {
  const today = calendarDate(now, state.plan.config.timezone)
  return state.tasks
    .filter(
      (t) =>
        isPersonalTask(t) &&
        isAction(t) &&
        openTask(t) &&
        t.plannedDate &&
        t.plannedDate <= date &&
        (t.plannedDate < today ||
          (t.plannedDate === date &&
            t.startMinute === null &&
            t.status !== 'blocked')),
    )
    .map((t) => t.id)
}

export const projectColor = (name = '') => {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)) >>> 0
  return ['blue', 'violet', 'teal', 'amber', 'rose', 'indigo'][hash % 6]
}
export const projectName = (task, tasks) =>
  tasks.find((t) => t.id === task.parentId)?.title || task.project || ''
export function projectOptions(tasks) {
  return [
    ...new Set(
      tasks.flatMap((t) =>
        isProject(t) ? [t.title] : t.project ? [t.project] : [],
      ),
    ),
  ].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}
export function poolTasks(state, week = null) {
  return state.tasks
    .filter(
      (t) =>
        !isProject(t) &&
        t.kind !== 'event' &&
        isPersonalTask(t) &&
        t.status !== 'cancelled' &&
        !t.plannedDate &&
        (t.plannedWeek || null) === week,
    )
    .sort(
      (a, b) =>
        Number(a.status === 'done') - Number(b.status === 'done') ||
        byOrder(a, b),
    )
}
export function taskSuggestions(tasks, query) {
  const key = query.trim().toLocaleLowerCase().replace(/\s+/g, '')
  if (!key) return []
  const seen = new Set()
  return tasks
    .filter(
      (t) =>
        !isProject(t) &&
        t.kind !== 'event' &&
        isPersonalTask(t) &&
        t.status !== 'cancelled' &&
        t.title.toLocaleLowerCase().replace(/\s+/g, '').includes(key),
    )
    .sort(
      (a, b) =>
        Number(a.status === 'done') - Number(b.status === 'done') ||
        (b.updatedAt || '').localeCompare(a.updatedAt || ''),
    )
    .filter((t) => {
      const k = `${t.title}:${t.project}:${t.status === 'done'}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .slice(0, 5)
}
export function capturePlacement(context = {}) {
  return {
    plannedDate: context.date || null,
    plannedWeek: context.date
      ? weekOf(context.date)
      : context.week
        ? weekOf(context.week)
        : null,
    startMinute: context.date ? (context.startMinute ?? null) : null,
  }
}
