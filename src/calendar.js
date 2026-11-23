import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { addDays, calendarDate, validDate } from './planner.js'
const exec = promisify(execFile)
const caches = new WeakMap()
export function calendarSettings(state) {
  const raw = state.plan.calendar || {}
  return {
    enabled: raw.enabled === true,
    appName: typeof raw.appName === 'string' ? raw.appName : '',
    appId: typeof raw.appId === 'string' ? raw.appId : '',
    cliPath: typeof raw.cliPath === 'string' ? raw.cliPath : '',
    profile: typeof raw.profile === 'string' ? raw.profile : '',
    calendarId:
      typeof raw.calendarId === 'string' && raw.calendarId
        ? raw.calendarId
        : 'primary',
  }
}
export async function saveCalendarSettings(store, body) {
  const current = calendarSettings(await store.read())
  body = { ...current, ...body }
  const appName = String(body.appName || '').trim(),
    appId = String(body.appId || '').trim(),
    cliPath = String(body.cliPath || '').trim(),
    profile = String(body.profile || '').trim(),
    calendarId = String(body.calendarId || 'primary').trim()
  if (
    appName.length > 100 ||
    (appId && !/^cli_[a-zA-Z0-9_-]{1,100}$/.test(appId)) ||
    cliPath.length > 1000 ||
    (cliPath && !cliPath.startsWith('/')) ||
    /[\x00-\x1f]/.test(appName + cliPath) ||
    profile.length > 100 ||
    calendarId.length > 300 ||
    /[\x00-\x1f]/.test(profile + calendarId)
  )
    throw new Error('账号或日历配置无效')
  await store.mutate(
    '设置飞书日历',
    (draft) => {
      draft.plan.calendar = {
        enabled: body.enabled === true,
        profile,
        calendarId,
        appName,
        appId,
        cliPath,
      }
    },
    { undoable: false },
  )
  caches.delete(store)
  return { ok: true }
}
const minute = (timestamp, timezone) => {
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestamp))
  return (
    Number(p.find((p) => p.type === 'hour').value) * 60 +
    Number(p.find((p) => p.type === 'minute').value)
  )
}
// Resolve local midnight explicitly; never rely on the server's local timezone.
export function dateTimestamp(date, timezone) {
  const base = Date.parse(`${date}T00:00:00Z`)
  let value = base
  for (let i = 0; i < 3; i++) {
    const local = calendarDate(new Date(value), timezone)
    const observed =
      Date.parse(`${local}T00:00:00Z`) + minute(value, timezone) * 60000
    value += base - observed
  }
  return Math.floor(value / 1000)
}
export function normalizeCalendarEvents(items, { start, end, timezone }) {
  const result = new Map()
  for (const event of items) {
    if (
      !event.event_id ||
      event.status === 'cancelled' ||
      ['decline', 'removed'].includes(event.self_rsvp_status)
    )
      continue
    const a = event.start_time,
      b = event.end_time
    if (!a || !b) continue
    const allDay = !!a.date
    const startMs = Number(a.timestamp) * 1000,
      endMs = Number(b.timestamp) * 1000
    if (
      !allDay &&
      (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs)
    )
      continue
    const first = allDay
      ? validDate(a.date)
      : calendarDate(new Date(startMs), timezone)
    // Feishu's all-day end date is inclusive. Timestamp end is exclusive.
    const last = allDay
      ? validDate(b.date)
      : calendarDate(new Date(endMs - 1), timezone)
    if (!first || !last) continue
    for (
      let date = first > start ? first : start;
      date <= last && date < end;
      date = addDays(date, 1)
    ) {
      const startMinute = allDay
        ? null
        : date === first
          ? minute(startMs, timezone)
          : 0
      const finish = allDay
        ? null
        : calendarDate(new Date(endMs), timezone) > date
          ? 1440
          : minute(endMs, timezone)
      const id = `feishu:${event.event_id}:${a.timestamp || a.date}:${date}`
      result.set(id, {
        id,
        title: event.summary || '忙碌',
        kind: 'event',
        status: 'todo',
        external: true,
        plannedDate: date,
        startMinute,
        estimateMinutes: allDay ? null : Math.max(1, finish - startMinute),
        location:
          typeof event.location === 'string'
            ? event.location
            : event.location?.name || '',
        busy: event.free_busy_status !== 'free',
      })
    }
  }
  return [...result.values()].sort(
    (a, b) =>
      a.plannedDate.localeCompare(b.plannedDate) ||
      (a.startMinute ?? -1) - (b.startMinute ?? -1),
  )
}
export async function readCalendar(
  store,
  { start, end, refresh = false, run = exec, executable } = {},
) {
  const state = await store.read(),
    config = calendarSettings(state),
    timezone = state.plan.config.timezone
  if (
    !validDate(start) ||
    !validDate(end) ||
    end <= start ||
    (Date.parse(end) - Date.parse(start)) / 86400000 > 62
  )
    throw new Error('日历查询范围应在 1 至 62 天内')
  if (!config.enabled) return { config, status: 'disabled', events: [] }
  let cache = caches.get(store)
  if (!cache) {
    cache = new Map()
    caches.set(store, cache)
  }
  const key = JSON.stringify([config, start, end, timezone]),
    prior = cache.get(key)
  if (prior?.pending) return prior.pending
  if (!refresh && prior && Date.now() - prior.at < 60000) return prior.value
  const pending = (async () => {
    const binary = executable || config.cliPath || 'lark-cli'
    try {
      if (config.appId)
        await verifyCalendarApp(config, { run, executable: binary })
      const items = []
      for (let from = start; from < end; from = addDays(from, 30)) {
        const to = addDays(from, 30) < end ? addDays(from, 30) : end
        const args = [
          'calendar',
          'events',
          'instance_view',
          '--as',
          'user',
          '--calendar-id',
          config.calendarId,
          '--start-time',
          String(dateTimestamp(from, timezone)),
          '--end-time',
          String(dateTimestamp(to, timezone) - 1),
          '--format',
          'json',
        ]
        if (config.profile) args.push('--profile', config.profile)
        const { stdout } = await run(binary, args, {
          timeout: 25000,
          maxBuffer: 4 * 1024 * 1024,
          env: {
            ...process.env,
            LARKSUITE_CLI_NO_UPDATE_NOTIFIER: '1',
            LARKSUITE_CLI_NO_SKILLS_NOTIFIER: '1',
          },
        })
        const response = JSON.parse(stdout)
        if (response.ok !== true || !Array.isArray(response.data?.items))
          throw new Error('invalid-response')
        items.push(...response.data.items)
      }
      const value = {
        config,
        status: 'ready',
        events: normalizeCalendarEvents(items, { start, end, timezone }),
        updatedAt: new Date().toISOString(),
      }
      cache.set(key, { at: Date.now(), value })
      return value
    } catch (error) {
      let code = ''
      try {
        code = JSON.parse(error.stderr).error?.subtype || ''
      } catch {}
      const message =
        error.code === 'APP_MISMATCH'
          ? '当前账号对应的应用已变化，请重新关联飞书应用。'
          : error.code === 'ENOENT'
            ? '本机未找到 lark-cli，请安装后重试。'
            : /token|scope|auth/.test(code)
              ? '飞书日历尚未授权，请为所选账号完成日历读取授权。'
              : '飞书日历暂时无法同步，请检查登录或网络后重试。'
      const value = {
        config,
        status: 'error',
        events: prior?.value?.events || [],
        updatedAt: prior?.value?.updatedAt || null,
        stale: !!prior?.value?.events?.length,
        error: message,
      }
      cache.set(key, { at: Date.now(), value })
      return value
    }
  })()
  cache.set(key, { ...prior, pending })
  if (cache.size > 16) cache.delete(cache.keys().next().value)
  return pending
}

// Never return config-show output: it may include an application secret.
export async function verifyCalendarApp(
  config,
  { run = exec, executable = config.cliPath || 'lark-cli' } = {},
) {
  const args = ['config', 'show']
  if (config.profile) args.push('--profile', config.profile)
  let response
  try {
    const { stdout } = await run(executable, args, {
      timeout: 10000,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        LARKSUITE_CLI_NO_UPDATE_NOTIFIER: '1',
        LARKSUITE_CLI_NO_SKILLS_NOTIFIER: '1',
      },
    })
    response = JSON.parse(stdout)
  } catch {
    throw new Error('无法读取指定飞书配置，请先检查 lark-cli 和 profile。')
  }
  if (!config.appId || response.appId !== config.appId)
    throw Object.assign(
      new Error('profile 对应的 App ID 与指定应用不一致，未保存配置。'),
      { code: 'APP_MISMATCH' },
    )
  return { appId: response.appId }
}
export async function checkCalendarConnection(store, options = {}) {
  const state = await store.read()
  const start = calendarDate(new Date(), state.plan.config.timezone)
  const result = await readCalendar(store, {
    ...options,
    start,
    end: addDays(start, 7),
    refresh: true,
  })
  const { events, ...rest } = result
  return { ...rest, eventCount: events.length }
}
export async function configureCalendarConnection(store, body, options = {}) {
  if (
    ['profile', 'appId', 'appName'].some(
      (field) => typeof body[field] !== 'string' || !body[field].trim(),
    )
  )
    throw new Error('请指定 profile、App ID 和应用名称。')
  // Validate against an isolated draft, then commit only after a successful read.
  const draft = structuredClone(await store.read())
  const candidate = {
    read: async () => draft,
    mutate: async (label, fn) => fn(draft),
  }
  await saveCalendarSettings(candidate, { ...body, enabled: true })
  const result = await checkCalendarConnection(candidate, options)
  if (result.status !== 'ready')
    throw new Error(result.error || '日历连接未验证，未保存配置。')
  await saveCalendarSettings(store, result.config)
  return result
}
