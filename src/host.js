import { fileURLToPath } from 'node:url'
import { calendarSetupPrompt } from './calendar-setup.js'
import { mailSetupPrompt } from './mail-setup.js'
import { listFeedback, createFeedback, setFeedbackStatus, readFeedbackImage, FEEDBACK_BODY_LIMIT } from './feedback.js'
import { readCalendar, saveCalendarSettings, calendarSettings, checkCalendarConnection } from './calendar.js'
import { mailSettings, saveMailSettings, configureMailConnection, testMailConnection, runMail, startMail } from './mail.js'
// dsh-workbench host 半片：/workbench/* 接口、agent 工具、系统提示、事件收集与每日晨报。
import { randomUUID } from 'node:crypto'

import { Store } from './store.js'
import { applyOps } from './ops.js'
import { registerTools } from './tools.js'
import { registerPrompts } from './prompts.js'
import { installCollectors } from './collect.js'
import { startBriefing } from './briefing.js'
import { registerLearnTools } from './learn/tools.js'
import { startLearnNightly, runLearnNow } from './learn/nightly.js'
import { installLearnPrestep } from './learn/prestep.js'
import { startOrganizer, runOrganizer } from './organizer.js'
import { installOrganizationSessions } from './organization-session.js'
import { planView } from './planner.js'
import { indexLearning, learningScope, reviewProgress } from './learn/review.js'
import { collectCandidates } from './learn/collect.js'
import { learnTarget, readLearningFile, listLearningReports, updateNoteFields, validateLearnTarget } from './learn/obsidian.js'

import { startLearning, installLearningNetwork, syncLearningEntry } from './learn/network.js'

const MAX_JSON = 2_000_000

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

async function readJson(req, limit = MAX_JSON) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw Object.assign(new Error('请求体太大'), { status: 413 })
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('请求不是有效的 JSON'), { status: 400 })
  }
}

/**
 * Web 服务不会替插件路由鉴权，所以每个请求都要自己走一遍 Host/Origin 和登录凭证检查。
 * 拿不到鉴权服务时一律拒绝。
 */
function requestRejection(ctx, req) {
  const connection = ctx.get('connection')
  if (typeof connection?.requestRejection !== 'function') return 403
  return connection.requestRejection({ headers: req.headers })
}

// 面板只展示覆盖进度，不必随每次轮询、撤销或修改传输全部消息键。
function panelState(state, config) {
  const { review, deferredReviews, ...learn } = state.learn
  return { ...state, learn: { ...learn, hasDeferredReview: deferredReviews?.some((r) => r.scope.sources.every((s) => learn.config.sources[s])) || false, review: review ? {scope:review.scope, ...reviewProgress(review)} : null, resolvedVaultPath: learnTarget(state, config).vaultPath } }
}

export async function route(ctx, store, config, req, res, signal) {
  const url = new URL(req.url || '/', 'http://local')
  const path = url.pathname.replace(/^\/wb\/?/, '')
  const method = req.method || 'GET'

  if (method === 'GET') {
    if (path === 'feedback') return json(res, 200, { ...await listFeedback(store), stateRoot: store.root, scriptPath: fileURLToPath(new URL('../scripts/feedback.mjs', import.meta.url)) })
    if (path === 'feedback/image') {
      const image = await readFeedbackImage(store, url.searchParams.get('id'), url.searchParams.get('index'))
      res.setHeader('content-type', image.type)
      res.setHeader('cache-control', 'no-store')
      res.setHeader('x-content-type-options', 'nosniff')
      return res.end(image.bytes)
    }
    if (path === 'calendar/setup') {
      const settings = calendarSettings(await store.read())
      return json(res,200,{config:settings,prompt:calendarSetupPrompt({scriptPath:fileURLToPath(new URL('../scripts/calendar.mjs',import.meta.url)),stateRoot:store.root,config:settings})})
    }
    if (path === 'calendar/events') return json(res, 200, await readCalendar(store, {start:url.searchParams.get('start'),end:url.searchParams.get('end'),refresh:url.searchParams.get('refresh')==='1',executable:config.larkCliPath}))
    if (path === 'mail/settings') return json(res, 200, await mailSettings(store))
    if (path === 'mail/setup') {
      const settings = await mailSettings(store)
      return json(res, 200, { config: settings, prompt: mailSetupPrompt({scriptPath: fileURLToPath(new URL('../scripts/mail.mjs', import.meta.url)), stateRoot: store.root, config: settings}) })
    }
    if (path === 'plan') return json(res, 200, planView(await store.read(), { view: url.searchParams.get('view'), date: url.searchParams.get('date'), project: url.searchParams.get('project') }))
    if (path === 'state') {
      const state = await store.read()
      return json(res, 200, { state: panelState(state, config), canUndo: store.canUndo() })
    }
    if (path === 'learn/models') {
      return json(res, 200, await ctx.sessionController.modelCatalog())
    }
    if (path === 'learn/scope') {
      const state = await store.read()
      const scope = learningScope(state, Object.fromEntries(url.searchParams))
      const { rows, sessions, errors } = await indexLearning(state, scope)
      const choices = sessions.map(({source, sessionId, project, keys}) => {
        const first = keys.map(key => rows.get(key)).find(row => row.role === 'user')
        return {source, sessionId, project, messages:keys.length, label:first?.text.replace(/\s+/gu, ' ').slice(0, 52) || sessionId}
      })
      return json(res, 200, {scope, errors, sessions:choices})
    }
    if (path === 'learn/preview') {
      const data = await learnPreview(ctx, store)
      return json(res, 200, data)
    }
    if (path === 'learn/reports' || path === 'learn/report') {
      const state = await store.read()
      const reports = await listLearningReports(state, learnTarget(state, config))
      if (path === 'learn/reports') return json(res, 200, { reports })
      const report = reports.find((row) => row.id === url.searchParams.get('id'))
      if (!report) return json(res, 404, { error: '日报不存在或已移动' })
      return json(res, 200, { ...report, ...await readLearningFile(report.vaultPath, report.path) })
    }
    if (path === 'learn/uri' || path === 'learn/note') {
      const state = await store.read()
      const entry = state.learn.entries.find((row) => row.id === url.searchParams.get('id') || (url.searchParams.has('path') && row.notePath === url.searchParams.get('path')))
      if (!entry?.notePath) return json(res, 404, { error: '笔记尚未同步；可直接在工作台阅读已记录的答案' })
      return json(res, 200, await readLearningFile(entry.vaultPath || learnTarget(state, config).vaultPath, entry.notePath))
    }
    return json(res, 404, { error: '接口不存在' })
  }
  if (method !== 'POST') return json(res, 405, { error: '不支持的方法' })

  // 所有写操作都拒绝跨站请求
  const site = req.headers['sec-fetch-site']
  if (site && site !== 'same-origin' && site !== 'none') return json(res, 403, { error: '拒绝跨站请求' })

  const body = await readJson(req, path === 'feedback/create' ? FEEDBACK_BODY_LIMIT : MAX_JSON)
  switch (path) {
    case 'feedback/create': return json(res, 200, { issue: await createFeedback(store, body) })
    case 'feedback/status': return json(res, 200, { issue: await setFeedbackStatus(store, body.id, body.status) })
    case 'calendar/check': return json(res,200,await checkCalendarConnection(store,{executable:config.larkCliPath}))
    case 'calendar/settings': return json(res, 200, await saveCalendarSettings(store, body))
    case 'mail/settings': return json(res, 200, await saveMailSettings(store, body))
    case 'mail/configure': return json(res, 200, await configureMailConnection(store, body))
    case 'mail/test': return json(res, 200, await testMailConnection(store))
    case 'mail/check': return json(res, 200, await testMailConnection(store))
    case 'mail/run-now': {
      void runMail(ctx, store).catch(() => {})
      return json(res, 202, {status:'queued'})
    }
    case 'plan/run-now': {
      if (body.mode === 'decompose') return json(res, 409, { error: '自动拆分已关闭，请保留完整事项或手动添加行动' })
      const result = await new Promise((resolve, reject) => {
        runOrganizer(ctx, store, { signal, trigger: 'manual', mode: body.mode ?? 'collect', project: body.project, date: body.date, goalId: body.goalId, calendarExecutable: config.larkCliPath, onSessionReady: (sessionId) => resolve({status:'running',sessionId}) }).then(resolve, reject)
      })
      return json(res, result.status === 'error' ? 500 : 202, result)
    }
    case 'learn/explore': {
      return json(res, 200, await startLearning(ctx, store, body, config))
    }
    case 'learn/highlight': {
      const text = typeof body.text === 'string' ? body.text.trim().slice(0, 2000) : ''
      await store.mutate('保存学习划线', (draft) => {
        const entry = draft.learn.entries.find((row) => row.id === body.entryId)
        if (!entry || !text || ![entry.question, entry.answer].some((value) => value.includes(text))) throw new Error('请在当前知识点的原问题或答案中选择文字')
        if (!entry.highlights.some((row) => row.text === text)) entry.highlights.push({ id: randomUUID(), text, at: new Date().toISOString() })
      }, { undoable: false })
      await syncLearningEntry(store, body.entryId, config)
      return json(res, 200, { ok: true })
    }
    case 'learn/sync': {
      const state = await store.read()
      if (!state.learn.entries.some((row) => row.id === body.entryId)) return json(res,404,{error:'知识点不存在'})
      await syncLearningEntry(store, body.entryId, config)
      const entry = (await store.read()).learn.entries.find((row) => row.id === body.entryId)
      return json(res, entry.syncError ? 500 : 200, entry.syncError ? {error:entry.syncError} : {ok:true})
    }
    case 'learn/validate-storage': {
      const state = await store.read()
      const target = await validateLearnTarget({ vaultPath: typeof body.vaultPath === 'string' && body.vaultPath.trim() ? body.vaultPath.trim() : learnTarget(state, config).vaultPath, notesDir: body.notesDir ?? state.learn.config.notesDir })
      return json(res, 200, { vaultPath: target.vaultPath, notesDir: target.notesDir })
    }
    case 'learn/run-now': {
      // 手动和定时整理共用固定学习对话。
      const result = await runLearnNow(ctx, store, body)
      return json(res, 200, result)
    }
    case 'ops': {
      const label = typeof body.label === 'string' && body.label ? body.label : '操作'
      const ops = Array.isArray(body.ops) ? body.ops : []
      const configPatch = ops.find((op) => op.op === 'learn_config')?.patch
      if (configPatch && (configPatch.vaultPath !== undefined || configPatch.notesDir !== undefined)) {
        const current = await store.read()
        await validateLearnTarget({
          vaultPath: configPatch.vaultPath || learnTarget(current, config).vaultPath,
          notesDir: configPatch.notesDir ?? current.learn.config.notesDir,
        })
      }
      const result = await store.mutate(label, (draft) => {
        const applied = applyOps(draft, ops)
        return { ...applied, state: draft }
      }, { undoable: body.undoable !== false })
      if (configPatch && !result.errors.length) learnPreviewCache = { at: 0, data: null }
      for (const op of ops.filter((item) => item.op === 'learn_decide')) {
        const entry = result.state.learn.entries.find((row) => row.id === op.id)
        if (entry?.notePath) {
          try {
            await updateNoteFields({ vaultPath: entry.vaultPath || learnTarget(result.state, config).vaultPath, notesDir: entry.notePath.split('/').slice(0, -1).join('/') }, entry.notePath, { mastered: entry.status === 'mastered' })
          } catch (err) { console.warn('workbench: 学习笔记状态同步失败', err) }
        }
      }
      return json(res, 200, { ...result, state: panelState(result.state, config), canUndo: store.canUndo() })
    }
    case 'undo': {
      const label = await store.undoLast()
      return json(res, 200, { label, state: panelState(await store.read(), config), canUndo: store.canUndo() })
    }
    default:
      return json(res, 404, { error: '接口不存在' })
  }
}

export const name = 'workbench'
export const inject = ['tools', 'systemPrompt', 'sessionController', 'sessions', 'llm']

// 学习预览缓存：面板轮询不重复扫盘（各 harness 输入量不小，60 秒内复用）
let learnPreviewCache = { at: 0, data: null }

async function learnPreview(ctx, store) {
  if (learnPreviewCache.data && Date.now() - learnPreviewCache.at < 60_000) return learnPreviewCache.data
  const state = await store.read()
  const data = await collectCandidates(state, { hours: 48, limit: 40 })
  learnPreviewCache = { at: Date.now(), data }
  return data
}

export function apply(ctx, config = {}) {
  const store = new Store(config.stateRoot)
  ctx.effect(() => {
    const shutdown = new AbortController()
    const disposeTools = registerTools(ctx, store)
    const disposeLearnTools = registerLearnTools(ctx, store, config)
    const disposePrompts = registerPrompts(ctx, store)
    const disposeCollectors = installCollectors(ctx, store, config)
    const disposeBriefing = startBriefing(ctx, store, { ...config, briefingPush: config.briefingPush === true })
    const disposeMail = startMail(ctx, store)
    const disposeOrganizer = startOrganizer(ctx, store)
    const disposeLearnNightly = startLearnNightly(ctx, store, config)
    const disposeLearningNetwork = installLearningNetwork(ctx, store, config)
    const organizationSessions = installOrganizationSessions(ctx, store)
    const disposeLearnPrestep = installLearnPrestep(ctx, store)

    // 路由注册要等 webServer 就绪（宿主重启时本插件可能先激活），ctx.inject 负责「服务可用时挂上、卸载时摘掉」
    const disposeRoute = ctx.inject(['webServer'], (injected) => injected.webServer.register({
      kind: 'prefix',
      path: '/wb',
      handler: async (req, res) => {
        try {
          const rejection = requestRejection(ctx, req)
          if (rejection) {
            json(res, rejection, { error: '未授权' })
            return
          }
          await route(ctx, store, config, req, res, shutdown.signal)
        } catch (err) {
          if (res.headersSent) {
            res.end()
            return
          }
          json(res, err.status || 500, { error: err.message })
        }
      },
    }))

    return () => {
      shutdown.abort()
      organizationSessions.dispose()
      disposeRoute()
      disposeLearningNetwork()
      disposeLearnPrestep()
      disposeLearnNightly()
      disposeBriefing()
      disposeOrganizer()
      disposeMail()
      disposeCollectors()
      disposePrompts()
      disposeLearnTools()
      disposeTools()
    }
  }, 'workbench: apply')
}
