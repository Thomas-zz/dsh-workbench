import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  dateTimestamp,
  normalizeCalendarEvents,
  readCalendar,
  saveCalendarSettings,
} from '../src/calendar.js'
const opts = {
  start: '2026-11-16',
  end: '2026-11-19',
  timezone: 'Asia/Shanghai',
}
const stamp = (iso) => String(Date.parse(iso) / 1000)
const event = (id, start, end, patch = {}) => ({
  event_id: id,
  summary: id,
  start_time: { timestamp: stamp(start) },
  end_time: { timestamp: stamp(end) },
  ...patch,
})
const store = () => {
  const state = {
    plan: {
      config: { timezone: 'Asia/Shanghai' },
      calendar: { enabled: true, profile: 'work', calendarId: 'primary' },
    },
  }
  return { read: async () => state, mutate: async (label, fn) => fn(state) }
}
test('日历日期转时间戳使用配置时区，包含夏令时边界', () => {
  assert.equal(
    dateTimestamp('2026-11-16', 'Asia/Shanghai'),
    Date.parse('2026-11-16T00:00:00+08:00') / 1000,
  )
  assert.equal(
    dateTimestamp('2026-03-09', 'America/New_York'),
    Date.parse('2026-03-09T00:00:00-04:00') / 1000,
  )
})
test('飞书实例去重、取消/拒绝过滤、跨日截断、全天与空闲日程', () => {
  const a = event(
    'night',
    '2026-11-16T23:30:00+08:00',
    '2026-11-17T01:00:00+08:00',
  )
  const items = [
    a,
    a,
    { ...a, event_id: 'cancel', status: 'cancelled' },
    { ...a, event_id: 'decline', self_rsvp_status: 'decline' },
    {
      event_id: 'all',
      start_time: { date: '2026-11-16' },
      end_time: { date: '2026-11-16' },
    },
    event('free', '2026-11-18T10:00:00+08:00', '2026-11-18T11:00:00+08:00', {
      free_busy_status: 'free',
    }),
  ]
  const rows = normalizeCalendarEvents(items, opts)
  assert.equal(rows.length, 4)
  assert.equal(
    rows.find((t) => t.title === 'night' && t.plannedDate === '2026-11-16')
      .estimateMinutes,
    30,
  )
  assert.equal(
    rows.find((t) => t.title === 'night' && t.plannedDate === '2026-11-17')
      .estimateMinutes,
    60,
  )
  assert.equal(rows.find((t) => t.title === 'free').busy, false)
  assert.ok(rows.every((t) => t.external))
  assert.equal(rows.find((t) => t.title === '忙碌').startMinute, null)
})
test('日历缓存并发合并，长范围分段，CLI argv 不走 shell', async () => {
  const s = store()
  let calls = 0
  const run = async (bin, args) => {
    calls++
    assert.equal(bin, 'lark-cli')
    assert.ok(args.includes('instance_view'))
    assert.equal(args.at(-1), 'work')
    return { stdout: JSON.stringify({ ok: true, data: { items: [] } }) }
  }
  const request = { start: '2026-11-01', end: '2026-12-13', run }
  const [a, b] = await Promise.all([
    readCalendar(s, request),
    readCalendar(s, request),
  ])
  assert.equal(calls, 2)
  assert.equal(a.status, 'ready')
  assert.deepEqual(a, b)
  await readCalendar(s, request)
  assert.equal(calls, 2)
})
test('失败不会伪装空成功，保留相同范围的缓存，关闭后不查询', async () => {
  const s = store()
  const run = async () => ({
    stdout: JSON.stringify({
      ok: true,
      data: {
        items: [
          event(
            'meeting',
            '2026-11-16T10:00:00+08:00',
            '2026-11-16T11:00:00+08:00',
          ),
        ],
      },
    }),
  })
  const first = await readCalendar(s, { ...opts, run })
  assert.equal(first.events.length, 1)
  const failure = async () => {
    throw { stderr: JSON.stringify({ error: { subtype: 'token_missing' } }) }
  }
  const next = await readCalendar(s, { ...opts, refresh: true, run: failure })
  assert.equal(next.status, 'error')
  assert.equal(next.stale, true)
  assert.equal(next.events.length, 1)
  assert.match(next.error, /授权/)
  const other = await readCalendar(s, {
    start: '2026-12-01',
    end: '2026-12-02',
    run: failure,
  })
  assert.equal(other.events.length, 0)
  await saveCalendarSettings(s, { enabled: false })
  assert.equal(
    (await readCalendar(s, { ...opts, run: failure })).status,
    'disabled',
  )
})

test('绑定应用不匹配时拒绝读取，不把另一个应用的空日历当成成功', async () => {
  const s = store()
  await saveCalendarSettings(s, { appId: 'cli_expected', appName: '工作助手' })
  let calendarCalls = 0
  const result = await readCalendar(s, {
    ...opts,
    run: async (bin, args) => {
      if (args[0] === 'config')
        return {
          stdout: JSON.stringify({
            appId: 'cli_other',
            appSecret: 'do-not-expose',
          }),
        }
      calendarCalls++
      return { stdout: JSON.stringify({ ok: true, data: { items: [] } }) }
    },
  })
  assert.equal(result.status, 'error')
  assert.equal(calendarCalls, 0)
  assert.match(result.error, /应用已变化/)
  assert.ok(!JSON.stringify(result).includes('do-not-expose'))
})

test('Agent 配置实际验证后才写入，失败保留原关联和其他设置', async () => {
  const { configureCalendarConnection } = await import('../src/calendar.js')
  const s = store(),
    before = structuredClone(await s.read())
  const body = {
    profile: 'personal',
    appId: 'cli_personal',
    appName: '我的秘书',
    calendarId: 'primary',
  }
  const run = async (bin, args) =>
    args[0] === 'config'
      ? {
          stdout: JSON.stringify({
            appId: 'cli_personal',
            appSecret: 'never-copy',
          }),
        }
      : { stdout: JSON.stringify({ ok: true, data: { items: [] } }) }
  await assert.rejects(
    configureCalendarConnection(s, { ...body, profile: '   ' }, { run }),
    /请指定/,
  )
  assert.deepEqual(await s.read(), before)
  await assert.rejects(
    configureCalendarConnection(s, body, {
      run: async (bin, args) => {
        if (args[0] === 'config') return run(bin, args)
        throw {
          stderr: JSON.stringify({ error: { subtype: 'token_missing' } }),
        }
      },
    }),
    /授权/,
  )
  assert.deepEqual(await s.read(), before)
  const result = await configureCalendarConnection(s, body, { run })
  assert.equal(result.status, 'ready')
  assert.equal(result.eventCount, 0)
  assert.equal((await s.read()).plan.calendar.appId, 'cli_personal')
  assert.equal((await s.read()).plan.calendar.profile, 'personal')
  assert.ok(!JSON.stringify(await s.read()).includes('never-copy'))
  await saveCalendarSettings(s, { enabled: false })
  assert.equal((await s.read()).plan.calendar.appId, 'cli_personal')
})

test('配置 Prompt 绑定实际宿主路径，并要求核对应用和个人日历身份', async () => {
  const { calendarSetupPrompt } = await import('../src/calendar-setup.js')
  const prompt = calendarSetupPrompt({
    scriptPath: '/a b/calendar.mjs',
    stateRoot: '/a b/state',
    config: { appName: '工作秘书', appId: 'cli_work' },
  })
  assert.ok(prompt.includes(JSON.stringify('/a b/calendar.mjs')))
  assert.ok(prompt.includes(JSON.stringify('/a b/state')))
  assert.match(prompt, /--state-root/)
  assert.match(prompt, /--as user/)
  assert.match(prompt, /不要手工覆盖整个 state.json/)
})
