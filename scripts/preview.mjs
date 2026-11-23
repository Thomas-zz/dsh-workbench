import { organizationContext } from '../test/helpers/organization-context.js'
// Isolated preview of the production UI and HTTP handlers. Never scans real sessions.
import { createServer } from 'node:http'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { Store } from '../src/store.js'
import { route } from '../src/host.js'
import { dateTimestamp } from '../src/calendar.js'
import { applyOps } from '../src/ops.js'
import { calendarDate, addDays, weekOf, settlePlan } from '../src/planner.js'

const root = await mkdtemp(join(tmpdir(), 'workbench-calendar-preview-'))
// Even if scan sources are enabled in the UI, use only this preview home.
process.env.HOME = process.env.USERPROFILE = root
process.env.DSH_HOME = join(root, '.dsh')
const store = new Store(root)
const today = calendarDate(),
  yesterday = addDays(today, -1)
// Optional, explicit fixture mode. Never uses the user's Feishu profile or tokens.
const calendarFixture = process.env.WB_PREVIEW_CALENDAR === '1'
const previewCalendarCli = calendarFixture
  ? join(root, 'preview-calendar.mjs')
  : undefined
if (calendarFixture) {
  const midnight = dateTimestamp(today, 'Asia/Shanghai')
  const events = [
    {
      event_id: 'preview-meeting',
      summary: '产品方向沟通',
      start_time: { timestamp: String(midnight + 10 * 3600) },
      end_time: { timestamp: String(midnight + 11 * 3600) },
      location: { name: '线上会议' },
    },
    {
      event_id: 'preview-sync',
      summary: '每周进度同步',
      start_time: { timestamp: String(midnight + 11 * 3600) },
      end_time: { timestamp: String(midnight + 11.5 * 3600) },
    },
    {
      event_id: 'preview-all-day',
      summary: '材料提交截止',
      start_time: { date: addDays(today, 1) },
      end_time: { date: addDays(today, 1) },
    },
  ]
  await writeFile(
    previewCalendarCli,
    `#!${process.execPath}\nconst result=process.argv[2]==='config'?{appId:'cli_preview'}:{ok:true,data:{items:${JSON.stringify(events)}}};console.log(JSON.stringify(result));\n`,
    { mode: 0o700 },
  )
}
await store.mutate(
  '预览样例',
  (draft) => {
    draft.plan.config.enabled = false
    if (calendarFixture)
      draft.plan.calendar = {
        enabled: true,
        appName: '工作台预览应用',
        appId: 'cli_preview',
        profile: 'preview-fixture',
        calendarId: 'primary',
      }
    draft.plan.config.sources = {
      dsh: false,
      codex: false,
      claude: false,
      zcode: false,
    }
    draft.learn.config.sources = {
      dsh: false,
      codex: false,
      claude: false,
      zcode: false,
    }
    draft.learn.config.reportPush = false
    draft.plan.lastDate = yesterday
    const add = (patch) => {
      const result = applyOps(draft, [{ op: 'add_task', ...patch }])
      if (result.errors.length) throw new Error(result.errors.join())
      return result.targets[0]
    }
    for (const [title, project, source, summary] of [
      [
        '确认本次发布版本',
        '工作台',
        'codex',
        '实现和回归已完成，需要确认本次采用的发布版本。',
      ],
      [
        '关闭已合并的旧 MR',
        '示例项目',
        'dsh',
        '替代版本已合并，旧 MR 可由你关闭。',
      ],
      [
        '补充接口返回示例',
        '个人工具',
        'zcode',
        '字段映射还缺一个实际返回示例。',
      ],
    ])
      applyOps(draft, [
        {
          op: 'add_review',
          kind: 'collaboration',
          title,
          project,
          source,
          summary,
          sessionId: `preview-${source}`,
          ownership: { kind: 'user_confirmation', quote: `请你${title}` },
          dedupeKey: `preview-${source}`,
        },
      ])
    const goal = add({
      title: '工作台日历改版',
      kind: 'goal',
      project: '个人工具',
      plannedWeek: weekOf(today),
    })
    add({
      title: '整理昨日体验反馈',
      plannedDate: yesterday,
      parentId: goal,
      project: '个人工具',
      estimateMinutes: 30,
      order: 0,
    })
    add({
      title: '实现跨日拖动',
      plannedDate: today,
      parentId: goal,
      project: '个人工具',
      estimateMinutes: 60,
      startMinute: 540,
      order: 1,
    })
    add({
      title: '验证任务历史记录',
      plannedDate: today,
      parentId: goal,
      project: '个人工具',
      estimateMinutes: 45,
      startMinute: 570,
      order: 2,
    })
    add({
      title: '等待接口确认',
      plannedDate: today,
      project: '协作事项',
      status: 'blocked',
      order: 3,
    })
    add({
      title: '整理发布说明',
      plannedDate: addDays(today, 1),
      project: '个人工具',
      estimateMinutes: 30,
      order: 4,
    })
    add({
      title: '想一想下周安排',
      project: '个人工具',
      estimateMinutes: 15,
      order: 5,
    })
    add({
      title: '示例项目本周验证',
      kind: 'goal',
      project: '业务项目',
      plannedWeek: weekOf(today),
      order: 1,
    })
    const study = add({
      title: '学习 super-agent 架构',
      kind: 'goal',
      project: '个人学习',
      plannedWeek: weekOf(today),
    })
    for (const [i, title] of [
      '理解整体架构与职责边界',
      '拆解任务协调与上下文传递',
      '做一个最小实验并复述',
    ].entries())
      add({
        title,
        parentId: study,
        project: '个人学习',
        plannedDate: addDays(today, i),
        estimateMinutes: 45,
        startMinute: i === 0 ? 840 : null,
        order: i,
      })
    add({ title: '整理下个版本的想法', project: '个人工具', order: 6 })
    add({
      title: '整理评审材料',
      project: '职业成长',
      plannedWeek: weekOf(today),
      order: 7,
    })
    add({
      title: '梳理本周验证反馈',
      project: '业务项目',
      plannedWeek: weekOf(today),
      order: 8,
    })
    add({
      title: '确认发布清单',
      project: '业务项目',
      plannedDate: today,
      status: 'done',
      order: 4,
    })
    draft.plan.lastDate = yesterday
    draft.plan.days[yesterday] = {
      note: '昨天先记录问题，今天继续推进。',
      items: [],
    }
    settlePlan(draft)
  },
  { undoable: false },
)
const base = fileURLToPath(new URL('..', import.meta.url))
const out = await build({
  stdin: {
    contents:
      "import React from 'react';import{createRoot}from'react-dom/client';import{Workbench}from'./client/index.jsx';import{setNav}from'./client/nav.js';setNav({openSession:(id)=>window.__previewOpenSession=id});createRoot(document.getElementById('root')).render(React.createElement(Workbench));",
    resolveDir: base,
    loader: 'jsx',
  },
  bundle: true,
  write: false,
  format: 'iife',
  loader: { '.css': 'text' },
  define: { 'process.env.NODE_ENV': '"development"' },
})
const ctx = organizationContext(
  async (messages, prompt) => {
    const delay = Math.min(
      10000,
      Number(process.env.WB_PREVIEW_AGENT_DELAY) || 0,
    )
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    const changes = []
    if (prompt.includes('本轮方式：estimate')) {
      const tasks = JSON.parse(
        prompt.split('\n已有事项：')[1].split('\n材料：')[0],
      )
      for (const task of tasks)
        changes.push({
          id: task.id,
          evidenceKeys: [messages[0].key],
          patch: { estimateMinutes: /确认|等待/.test(task.title) ? 15 : 45 },
        })
    } else if (!prompt.includes('本轮方式：schedule'))
      for (const message of messages) {
        changes.push({
          evidenceKeys: [message.key],
          scope: 'standalone',
          ownership: {
            kind: 'user_action',
            evidenceKey: message.key,
            quote: message.text,
          },
          patch: {
            title: message.text.replace(/^明天提醒我/, ''),
            kind: /学习/.test(message.text) ? 'goal' : 'action',
            plannedDate: /学习/.test(message.text)
              ? null
              : addDays(today, /明天/.test(message.text) ? 1 : 0),
            plannedWeek: weekOf(today),
            estimateMinutes: 30,
          },
        })
      }

    return { changes, summary: '隔离测试 Agent 已完成整理' }
  },
  { provider: 'preview', model: 'fixture' },
)
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>个人工作台 · 隔离预览</title><style>:root{--dsw-alias-bg-base:#faf9fb;--dsw-alias-bg-layer-1:#f2f0f4;--dsw-alias-bg-layer-2:#e9e6ed;--dsw-alias-bg-overlay:#fff;--dsw-alias-label-primary:#28332e;--dsw-alias-label-secondary:#718077;--dsw-alias-border-l1:#dfe5df;--dsw-alias-brand-primary:#398068;--dsw-alias-state-warn-primary:#aa691f;--dsw-alias-state-danger-primary:#bb4646}*{box-sizing:border-box}html,body,#root{height:100%;margin:0}button,input,select,textarea{font:inherit}button{cursor:pointer}</style><style>html[data-theme=dark]{color-scheme:dark;--dsw-alias-bg-base:#202024;--dsw-alias-bg-layer-1:#29292e;--dsw-alias-bg-layer-2:#36363c;--dsw-alias-bg-overlay:rgba(190,200,210,.45);--dsw-alias-label-primary:#ecebf0;--dsw-alias-label-secondary:#aba8b1;--dsw-alias-border-l1:#45434c}</style><div id="root"></div><script>if(location.search.includes("dark"))document.documentElement.dataset.theme="dark"</script><script src="/preview.js"></script></html>`
const server = createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/wb/'))
      return await route(
        ctx,
        store,
        { larkCliPath: previewCalendarCli },
        req,
        res,
      )
    res.setHeader(
      'content-type',
      req.url === '/preview.js'
        ? 'application/javascript'
        : 'text/html; charset=utf-8',
    )
    res.end(req.url === '/preview.js' ? out.outputFiles[0].contents : html)
  } catch (error) {
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: error.message }))
  }
})
server.listen(Number(process.env.WB_PREVIEW_PORT) || 4317, '127.0.0.1', () =>
  console.log(
    JSON.stringify({
      url: `http://127.0.0.1:${server.address().port}`,
      data: root,
    }),
  ),
)
