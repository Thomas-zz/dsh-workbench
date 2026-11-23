export const isProject = (task) => ['project', 'goal'].includes(task.kind)
export const isAction = (task) => !isProject(task) && task.kind !== 'event'
// Only explicit personal responsibilities belong in the user's plan.
export const isPersonalTask = (task) =>
  ['user_action', 'user_confirmation'].includes(task.ownership?.kind) ||
  (!task.ownership && task.origin?.kind !== 'auto')
export function personalState(state) {
  return {
    ...state,
    tasks: state.tasks.filter(isPersonalTask),
    excludedTasks:
      state.excludedTasks || state.tasks.filter((t) => !isPersonalTask(t)),
  }
}

// Allocate using rendered bounds, including the minimum hit target for short entries.
export function overlapLayout(tasks) {
  const rows = tasks
    .filter((t) => Number.isFinite(t.startMinute))
    .map((task) => ({
      task,
      start: task.startMinute,
      height: Math.max(
        24,
        Math.min(
          task.scheduledMinutes || task.estimateMinutes || 30,
          1440 - task.startMinute,
        ),
      ),
    }))
    .sort(
      (a, b) =>
        a.start - b.start ||
        b.height - a.height ||
        a.task.id.localeCompare(b.task.id),
    )
  const groups = []
  let group = [],
    end = -1
  for (const row of rows) {
    if (row.start >= end && group.length) {
      groups.push(group)
      group = []
    }
    end = Math.max(group.length ? end : -1, row.start + row.height)
    group.push(row)
  }
  if (group.length) groups.push(group)
  return groups.flatMap((group) => {
    const lanes = []
    const placed = group.map((row) => {
      let lane = lanes.findIndex(
        (items) => items.at(-1).start + items.at(-1).height <= row.start,
      )
      if (lane < 0) {
        lane = lanes.length
        lanes.push([])
      }
      lanes[lane].push(row)
      return { ...row, lane }
    })
    return placed.map((row) => {
      let span = 1
      for (let lane = row.lane + 1; lane < lanes.length; lane++) {
        if (
          lanes[lane].some(
            (other) =>
              row.start < other.start + other.height &&
              other.start < row.start + row.height,
          )
        )
          break
        span++
      }
      return { ...row, span, count: lanes.length }
    })
  })
}

// Shared calendar semantics for the Host, CLI and UI. No browser or Node dependencies.
export const openTask = (task) =>
  isPersonalTask(task) && !['done', 'paused', 'cancelled'].includes(task.status)
export const byOrder = (a, b) =>
  (a.order ?? 0) - (b.order ?? 0) ||
  (a.createdAt || '').localeCompare(b.createdAt || '') ||
  a.id.localeCompare(b.id)
export function calendarDate(now = new Date(), timezone = 'Asia/Shanghai') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (key) => parts.find((p) => p.type === key).value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null
  const time = Date.parse(`${value}T12:00:00Z`)
  return Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
    ? value
    : null
}
export function addDays(date, days) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10)
}
export function weekOf(date) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay()
  return addDays(date, -((day + 6) % 7))
}
export function monthWeeks(date) {
  const first = `${date.slice(0, 7)}-01`
  const next = new Date(`${first}T12:00:00Z`)
  next.setUTCMonth(next.getUTCMonth() + 1)
  const last = addDays(next.toISOString().slice(0, 10), -1)
  const weeks = []
  for (let day = weekOf(first); day <= last; day = addDays(day, 7))
    weeks.push(day)
  return weeks
}
export function normalizePlan(raw = {}, now = new Date()) {
  let timezone =
    raw.config?.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    'Asia/Shanghai'
  try {
    calendarDate(now, timezone)
  } catch {
    timezone = 'Asia/Shanghai'
  }
  const today = calendarDate(now, timezone)
  return {
    ...raw,
    config: {
      timezone,
      weekdaysOnly: raw.config?.weekdaysOnly === true,
      dailyCapacityMinutes: Math.max(
        30,
        Math.min(1440, Number(raw.config?.dailyCapacityMinutes) || 360),
      ),
      slots: Array.isArray(raw.config?.slots)
        ? raw.config.slots.filter(
            (s) =>
              Array.isArray(s) &&
              Number.isFinite(s[0]) &&
              Number.isFinite(s[1]) &&
              s[0] >= 0 &&
              s[1] <= 1440 &&
              s[1] > s[0],
          )
        : [
            [540, 720],
            [840, 1080],
          ],
      enabled: raw.config?.enabled !== false,
      scheduleMode:
        raw.config?.scheduleMode === 'interval' ? 'interval' : 'nightly',
      nightlyHour: Number.isInteger(raw.config?.nightlyHour)
        ? Math.max(0, Math.min(23, raw.config.nightlyHour))
        : 22,
      intervalMinutes: Math.max(
        5,
        Math.min(1440, Number(raw.config?.intervalMinutes) || 30),
      ),
      model:
        raw.config?.model?.provider && raw.config?.model?.model
          ? raw.config.model
          : null,
      sources: {
        dsh: true,
        codex: true,
        claude: true,
        zcode: true,
        ...raw.config?.sources,
      },
    },
    days: raw.days && typeof raw.days === 'object' ? raw.days : {},
    weeks: raw.weeks && typeof raw.weeks === 'object' ? raw.weeks : {},
    lastDate: validDate(raw.lastDate) || today,
    organizer: {
      runs: [],
      lastNightlyDate: '',
      cursors: {},
      processed: [],
      excludedSessions: [],
      lastRunAt: '',
      lastSummary: '',
      error: '',
      ...raw.organizer,
    },
  }
}
export function planFields(raw = {}) {
  return {
    ownership:
      raw.ownership &&
      ['user_action', 'user_confirmation', 'agent', 'unconfirmed'].includes(
        raw.ownership.kind,
      )
        ? { ...raw.ownership }
        : null,
    kind: ['goal', 'project', 'event'].includes(raw.kind) ? raw.kind : 'action',
    sourceTaskId:
      typeof raw.sourceTaskId === 'string' ? raw.sourceTaskId : null,
    location:
      typeof raw.location === 'string' ? raw.location.slice(0, 500) : '',
    project: typeof raw.project === 'string' ? raw.project.slice(0, 200) : '',
    parentId: typeof raw.parentId === 'string' ? raw.parentId : null,
    plannedDate: validDate(raw.plannedDate),
    plannedWeek: validDate(raw.plannedWeek)
      ? weekOf(raw.plannedWeek)
      : validDate(raw.plannedDate)
        ? weekOf(raw.plannedDate)
        : null,
    estimateMinutes:
      Number.isFinite(raw.estimateMinutes) && raw.estimateMinutes > 0
        ? Math.min(1440, Math.round(raw.estimateMinutes))
        : null,
    scheduledMinutes:
      Number.isFinite(raw.scheduledMinutes) && raw.scheduledMinutes > 0
        ? Math.min(1440, Math.round(raw.scheduledMinutes))
        : null,
    startMinute: Number.isFinite(raw.startMinute)
      ? Math.max(0, Math.min(1439, Math.round(raw.startMinute)))
      : null,
    order: Number.isFinite(raw.order) ? raw.order : 0,
    carriedFrom: validDate(raw.carriedFrom),
    rolloverWarning:
      typeof raw.rolloverWarning === 'string' ? raw.rolloverWarning : null,
    legacyDue: raw.legacyDue || null,
    userFields:
      raw.userFields && typeof raw.userFields === 'object'
        ? raw.userFields
        : {},
    evidence: Array.isArray(raw.evidence) ? raw.evidence.slice(-30) : [],
    firstCompletedAt: raw.firstCompletedAt || raw.completedAt || null,
  }
}
export function initializePlanner(state, oldVersion, now = new Date()) {
  state.plan = normalizePlan(state.plan, now)
  const today = calendarDate(now, state.plan.config.timezone)
  if (oldVersion < 2) {
    for (const task of state.tasks) {
      task.legacyDue = task.due
      task.plannedDate =
        task.status === 'done'
          ? task.completedAt
            ? calendarDate(
                new Date(task.completedAt),
                state.plan.config.timezone,
              )
            : null
          : task.due
            ? task.due
            : task.status === 'doing' || task.focus
              ? today
              : null
      task.plannedWeek = task.plannedDate ? weekOf(task.plannedDate) : null
      task.due = null
    }
  }
  return state
}
function recordTask(task) {
  const {
    id,
    title,
    status,
    project,
    kind,
    parentId,
    plannedDate,
    plannedWeek,
    startMinute,
    estimateMinutes,
    scheduledMinutes,
    order,
    createdAt,
    completedAt,
    carriedFrom,
    due,
    focus,
    ownership,
    origin,
    note,
    location,
    evidence,
    progress,
  } = task
  return {
    id,
    title,
    status,
    project,
    kind,
    parentId,
    plannedDate,
    plannedWeek,
    startMinute,
    estimateMinutes,
    scheduledMinutes,
    order,
    createdAt,
    completedAt,
    carriedFrom,
    due,
    focus,
    ownership,
    origin,
    note,
    location,
    evidence,
    progress,
  }
}
function localMinute(now, timezone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now)
  return (
    Number(parts.find((p) => p.type === 'hour').value) * 60 +
    Number(parts.find((p) => p.type === 'minute').value)
  )
}

// Completion markers are display-only; they do not invent a work start or duration.
export function timelineTasks(tasks, date, timezone) {
  return tasks
    .filter(
      (t) =>
        (!t.movedTo || t.status === 'done') &&
        ['todo', 'doing', 'done'].includes(t.status),
    )
    .flatMap((task) => {
      if (Number.isFinite(task.startMinute)) return [task]
      if (task.kind === 'event')
        return [
          {
            ...task,
            startMinute: 480,
            scheduledMinutes: 40,
            untimedEvent: true,
          },
        ]
      if (
        task.status !== 'done' ||
        !task.completedAt ||
        !Number.isFinite(Date.parse(task.completedAt)) ||
        calendarDate(new Date(task.completedAt), timezone) !== date
      )
        return []
      return [
        {
          ...task,
          startMinute: localMinute(new Date(task.completedAt), timezone),
          scheduledMinutes: 24,
          completionMarker: true,
        },
      ]
    })
}

// Housekeeping only: reading or starting the app never reschedules tasks.
export function settlePlan(state, now = new Date(), ownerAlive) {
  const plan = state.plan
  if (!plan) return false
  let changed = false
  const lease = plan.organizer.lease
  // Legacy records had a deadline but no process owner. Never time out a live, owned run.
  if (
    lease &&
    (lease.ownerPid
      ? ownerAlive && !ownerAlive(lease.ownerPid)
      : now.getTime() >= (lease.expiresAt || lease.at + 5 * 60000))
  ) {
    const log = plan.organizer.runs?.find(
      (r) => r.id === plan.organizer.lease.id,
    )
    if (log?.status === 'running') {
      log.status = 'error'
      log.error = '上一轮未完成，可以重新整理'
      log.finishedAt = now.toISOString()
    }
    plan.organizer.error = '上一轮未完成，可以重新整理'
    delete plan.organizer.lease
    changed = true
  }
  if (ownerAlive) {
    for (const binding of Object.values(state.assistant?.sessions || {})) {
      if (
        binding.status !== 'running' ||
        !binding.ownerPid ||
        ownerAlive(binding.ownerPid)
      )
        continue
      const error = '上次整理的宿主已退出，保留已提交进度；请手动继续'
      Object.assign(binding, {
        status: 'error',
        error,
        safetyHold: error,
        finishedAt: now.toISOString(),
      })
      changed = true
    }
  }
  // Time passing is never consent to move a personal commitment.
  const today = calendarDate(now, plan.config.timezone)
  if (plan.lastDate !== today) {
    plan.lastDate = today
    changed = true
  }
  return changed
}

export function rememberMove(state, before, after, now = new Date()) {
  if (!before?.plannedDate || before.plannedDate === after?.plannedDate) return
  const today = calendarDate(now, state.plan.config.timezone)
  if (before.plannedDate > today) return
  const record = (state.plan.days[before.plannedDate] ||= {
    note: '',
    items: [],
  })
  // A closed day was already recorded at rollover; never update it from live task status.
  if (record.closed) return
  const item = {
    ...recordTask(before),
    movedTo: after?.plannedDate || '未安排',
  }
  record.items = [...record.items.filter((t) => t.id !== before.id), item]
}
export function dayTasks(state, date) {
  // Live records own placement. Old rollover receipts remain in storage as audit
  // history, but must not duplicate a live task or freeze yesterday's editor.
  const liveIds = new Set(
    [...state.tasks, ...(state.excludedTasks || [])].map((t) => t.id),
  )
  const historic = (state.plan?.days?.[date]?.items || []).filter(
    (t) =>
      !liveIds.has(t.id) &&
      !t.movedTo &&
      t.status !== 'cancelled' &&
      isPersonalTask(t),
  )
  return [
    ...historic.map((t) => ({ ...t, plannedDate: date, historical: true })),
    ...state.tasks.filter(
      (t) =>
        !isProject(t) &&
        isPersonalTask(t) &&
        t.status !== 'cancelled' &&
        t.plannedDate === date,
    ),
  ].sort(byOrder)
}
export function weekGoals(state, date) {
  const week = weekOf(date)
  return state.plan?.weeks?.[week]?.closed
    ? state.plan.weeks[week].items
        .filter((t) =>
          isPersonalTask(
            state.tasks.find((row) => row.id === t.id) ||
              state.excludedTasks?.find((row) => row.id === t.id) ||
              t,
          ),
        )
        .sort(byOrder)
    : state.tasks
        .filter(
          (t) =>
            isPersonalTask(t) && t.kind === 'goal' && t.plannedWeek === week,
        )
        .sort(byOrder)
}
export function planView(state, { view = 'day', date, project } = {}) {
  state = personalState(state)
  date = validDate(date) || calendarDate(new Date(), state.plan.config.timezone)
  const filter = (rows) =>
    project ? rows.filter((t) => t.project === project) : rows
  const days =
    view === 'month'
      ? monthWeeks(date).flatMap((w) =>
          Array.from({ length: 7 }, (_, i) => addDays(w, i)),
        )
      : view === 'week'
        ? Array.from({ length: 7 }, (_, i) => addDays(weekOf(date), i))
        : [date]
  const completed = state.tasks.filter(
    (t) =>
      !isProject(t) &&
      t.status === 'done' &&
      t.completedAt &&
      days.includes(
        calendarDate(new Date(t.completedAt), state.plan.config.timezone),
      ) &&
      (view !== 'month' ||
        calendarDate(new Date(t.completedAt), state.plan.config.timezone).slice(
          0,
          7,
        ) === date.slice(0, 7)),
  )
  return {
    date,
    timezone: state.plan.config.timezone,
    week: weekOf(date),
    days: days.map((d) => ({
      date: d,
      tasks: filter(dayTasks(state, d)),
      note: state.plan.days[d]?.note || '',
    })),
    weeks: [...new Set(days.map(weekOf))].map((w) => ({
      date: w,
      goals: filter(weekGoals(state, w)),
      note: state.plan.weeks[w]?.note || '',
    })),
    unscheduled: filter(
      state.tasks.filter((t) => isAction(t) && !t.plannedDate && openTask(t)),
    ),
    completed: filter(completed).length,
  }
}
export function autoSchedule(
  state,
  date,
  { ids, force = false, fit = false, busy = [], notBefore = 0 } = {},
) {
  date = validDate(date) || calendarDate(new Date(), state.plan.config.timezone)
  const selected = state.tasks
    .filter(
      (t) =>
        isAction(t) &&
        openTask(t) &&
        t.status !== 'blocked' &&
        (ids ? ids.includes(t.id) : t.plannedDate === date),
    )
    .sort(byOrder)
  const moving = selected.filter(
    (t) => force || (!t.userFields?.plannedDate && !t.userFields?.startMinute),
  )
  const slots = state.plan.config.slots.length
    ? state.plan.config.slots.slice().sort((a, b) => a[0] - b[0])
    : [[540, 1080]]
  const occupied = state.tasks
    .filter(
      (t) =>
        t.plannedDate === date &&
        !moving.includes(t) &&
        !['paused', 'cancelled'].includes(t.status) &&
        Number.isFinite(t.startMinute),
    )
    .map((t) => [
      t.startMinute,
      t.startMinute + (t.scheduledMinutes || t.estimateMinutes || 30),
    ])
  let gaps = slots
    .map(([a, b]) => [Math.max(a, notBefore), b])
    .filter(([a, b]) => b > a)
  for (const [a, b] of [...occupied, ...busy])
    gaps = gaps.flatMap(([x, y]) =>
      b <= x || a >= y
        ? [[x, y]]
        : [
            [x, Math.min(a, y)],
            [Math.max(b, x), y],
          ].filter(([s, e]) => e > s),
    )
  const total = moving.reduce((sum, t) => sum + (t.estimateMinutes || 30), 0)
  const available = gaps.reduce((sum, [a, b]) => sum + b - a, 0)
  const ratio = fit && total > available ? available / total : 1
  for (const task of moving) {
    task.estimateMinutes ||= 30
    task.plannedDate = date
    task.plannedWeek = weekOf(date)
    task.startMinute = null
    task.scheduledMinutes = null
    const desired = fit
      ? Math.max(1, Math.floor(task.estimateMinutes * ratio))
      : task.estimateMinutes
    let index = gaps.findIndex(([a, b]) => b - a >= desired)
    if (index < 0 && fit && gaps.length)
      index = gaps.reduce(
        (best, s, i) =>
          s[1] - s[0] > gaps[best][1] - gaps[best][0] ? i : best,
        0,
      )
    if (index >= 0) {
      const [a, b] = gaps[index],
        duration = Math.min(desired, b - a)
      task.startMinute = a
      task.scheduledMinutes = duration
      gaps.splice(index, 1, ...(a + duration < b ? [[a + duration, b]] : []))
    } else if (fit) {
      // The user allows overlap. A full day still gets a visible placement,
      // without inventing available hours or altering the effort estimate.
      const [a, b] = slots.at(-1)
      task.startMinute = a
      task.scheduledMinutes = Math.min(task.estimateMinutes, b - a)
    }
  }
  return moving.length
}

export function applyPlanOp(state, op) {
  if (op.op === 'plan_note') {
    const date = validDate(op.date)
    if (!date) throw new Error('日期无效')
    const rows = op.period === 'week' ? state.plan.weeks : state.plan.days
    const key = op.period === 'week' ? weekOf(date) : date
    const record = (rows[key] ||= { note: '', items: [] })
    record.note = String(op.note || '').slice(0, 50000)
  } else if (op.op === 'plan_record') {
    const record = (op.period === 'week' ? state.plan.weeks : state.plan.days)[
      op.date
    ]
    const item = record?.items.find((t) => t.id === op.id)
    if (!item) throw new Error('历史记录不存在')
    const before = { ...item }
    if (op.patch?.title !== undefined) {
      if (typeof op.patch.title !== 'string' || !op.patch.title.trim())
        throw new Error('标题不能为空')
      item.title = op.patch.title.trim().slice(0, 500)
    }
    if (op.patch?.status !== undefined) {
      if (
        !['todo', 'doing', 'blocked', 'done', 'paused', 'cancelled'].includes(
          op.patch.status,
        )
      )
        throw new Error('状态无效')
      item.status = op.patch.status
    }
    for (const key of ['note', 'location'])
      if (op.patch?.[key] !== undefined)
        item[key] = String(op.patch[key] || '').slice(0, 50000)
    if (op.patch?.due !== undefined) item.due = validDate(op.patch.due)
    const normalized = planFields(op.patch)
    for (const key of ['estimateMinutes', 'startMinute', 'scheduledMinutes'])
      if (op.patch?.[key] !== undefined) item[key] = normalized[key]
    ;(record.corrections ||= []).push({
      at: new Date().toISOString(),
      id: op.id,
      before,
      patch: op.patch,
    })
  } else if (op.op === 'plan_config') {
    state.plan = normalizePlan({
      ...state.plan,
      config: { ...state.plan.config, ...op.patch },
    })
  } else if (op.op === 'plan_schedule') {
    autoSchedule(state, op.date, { ids: op.ids, force: true })
    for (const task of state.tasks.filter((t) => t.plannedDate === op.date)) {
      task.userFields.startMinute = new Date().toISOString()
    }
  } else if (op.op === 'plan_move') {
    const task = state.tasks.find((t) => t.id === op.id)
    if (!task) throw new Error('任务不存在')
    if (task.kind === 'project') throw new Error('请安排项目中的任务节点')
    if (task.kind === 'event' && !validDate(op.date))
      throw new Error('日程必须选择日期')
    const before = { ...task }
    task.rolloverWarning = null
    task.plannedDate = validDate(op.date)
    task.plannedWeek = task.plannedDate
      ? weekOf(task.plannedDate)
      : validDate(op.week)
        ? weekOf(op.week)
        : null
    task.scheduledMinutes = null
    task.startMinute =
      task.plannedDate && Number.isFinite(op.startMinute)
        ? Math.max(0, Math.min(1439, Math.round(op.startMinute)))
        : null
    const rows = state.tasks
      .filter(
        (t) =>
          t.id !== task.id &&
          t.kind === task.kind &&
          (task.kind === 'goal'
            ? t.plannedWeek === task.plannedWeek
            : t.plannedDate === task.plannedDate),
      )
      .sort(byOrder)
    const index = rows.findIndex((t) => t.id === op.beforeId)
    rows.splice(index < 0 ? rows.length : index, 0, task)
    rows.forEach((t, i) => {
      t.order = i
    })
    const at = new Date().toISOString()
    for (const key of ['plannedDate', 'plannedWeek', 'order', 'startMinute'])
      task.userFields[key] = at
    task.updatedAt = at
    rememberMove(state, before, task)
    const record =
      task.kind === 'goal'
        ? state.plan.weeks[task.plannedWeek]
        : state.plan.days[task.plannedDate]
    if (record?.closed) {
      record.items = [
        ...record.items.filter((t) => t.id !== task.id),
        recordTask(task),
      ]
      ;(record.corrections ||= []).push({ at, id: task.id, action: 'moved-in' })
    }
  }
  return { receipts: [], target: op.id }
}
