import {
  addDays,
  weekOf,
  dayTasks,
  isProject,
  isPersonalTask,
  byOrder,
} from './planner.js'

export function projectGroups(
  state,
  rows = state.tasks,
  { includeEmpty = false } = {},
) {
  const projects = state.tasks.filter((t) => isProject(t) && isPersonalTask(t))
  const groups = new Map(
    includeEmpty
      ? projects.map((project) => [project.id, { project, tasks: [] }])
      : [],
  )
  const independent = []
  for (const task of rows
    .filter((t) => !isProject(t) && isPersonalTask(t))
    .sort(byOrder)) {
    const parent =
      projects.find((p) => p.id === task.parentId) ||
      projects.find((p) => p.title === task.project)
    if (!parent && !task.project) {
      independent.push(task)
      continue
    }
    const key = parent?.id || `label:${task.project}`
    if (!groups.has(key))
      groups.set(key, {
        project: parent || {
          id: key,
          title: task.project,
          virtual: true,
          kind: 'project',
        },
        tasks: [],
      })
    groups.get(key).tasks.push(task)
  }
  return { groups: [...groups.values()], independent }
}

export function weekWork(state, date) {
  const start = weekOf(date),
    rows = new Map()
  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i)
    for (const task of dayTasks(state, day)) {
      if (task.movedTo || isProject(task)) continue
      const previous = rows.get(task.id)
      if (!previous || task.status === 'done' || previous.status !== 'done')
        rows.set(task.id, {
          ...task,
          displayDate: day,
          historical: !state.tasks.some(t=>t.id===task.id),
        })
    }
  }
  return {
    tasks: [...rows.values()],
    ...projectGroups(state, [...rows.values()]),
  }
}
