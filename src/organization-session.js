import { randomUUID } from 'node:crypto'
import { installOrganizationGuard } from './organization-guard.js'
import { hostProcessAlive } from './store.js'
import { calendarDate } from './planner.js'
import {
  automaticModelAllowed,
  organizationModel,
  shouldRotateSession,
} from './assistant.js'

const titles = { tasks: '任务整理', learn: '学习整理' }
export function organizationSessionIds(state) {
  const ids = [
    ...(state.assistant?.retiredSessions || []),
    ...Object.values(state.assistant?.sessions || {})
      .map((row) => row.sessionId)
      .filter(Boolean),
  ]
  return new Set(ids.flatMap((id) => [id, id.replace(/^session-/, '')]))
}

/** Claim and persist the dedicated chat before sending; concurrent hosts share this lock. */
export async function dispatchOrganization(
  ctx,
  store,
  kind,
  text,
  {
    beforeSend,
    onStop,
    automatic = false,
    rotatingFrom,
    submitOnly = false,
    signal,
    requestId = randomUUID(),
  } = {},
) {
  const tracker = installOrganizationSessions(ctx, store)
  const state = await store.read()
  const catalog = await ctx.sessionController.modelCatalog()
  const selection = organizationModel(state, catalog)
  let agent, guardRun
  const result = await store.mutate(
    '准备整理对话',
    async (draft) => {
      if (automatic && !automaticModelAllowed(draft, selection))
        throw new Error(
          '当前模型没有定时整理授权；请手动整理，或在助手设置确认服务商限额后授权',
        )
      const bindings = (draft.assistant.sessions ||= {})
      let binding = bindings[kind]
      if (binding?.sessionId) {
        const resolved = await ctx.sessionController.resolveAgent(
          binding.sessionId,
        )
        if (resolved?.error || !resolved?.agent) {
          const error = resolved?.error
          // Only recreate a known missing chat. Ownership/connection errors must not create duplicates.
          if (
            !/not.?found|不存在|ENOENT/i.test(
              `${error?.code || ''} ${error?.message || ''}`,
            )
          )
            throw error || new Error('整理对话暂时不可恢复，请稍后重试')
          binding = null
        } else agent = resolved.agent
      }
      if (
        (agent?.status === 'running' &&
          !(
            kind === 'learn' &&
            agent.session.id === rotatingFrom?.session.id &&
            shouldRotateSession(draft, binding)
          )) ||
        (binding?.status === 'running' && hostProcessAlive(binding.ownerPid))
      )
        return { status: 'running', busy: true, sessionId: binding.sessionId }
      const now = new Date().toISOString()
      const today = calendarDate(new Date(now), draft.plan.config.timezone)
      const previous = bindings[kind]
      if (automatic && previous?.safetyHold)
        throw new Error('自动整理已暂停，请先手动成功完成一次整理')
      if (automatic && previous?.failureDate === today)
        throw new Error('今日自动整理已暂停；可手动整理')
      if (!binding || shouldRotateSession(draft, binding)) {
        const created = await ctx.sessionController.create({})
        agent = null
        if (
          previous &&
          !draft.assistant.retiredSessions.includes(previous.sessionId)
        )
          draft.assistant.retiredSessions.push(previous.sessionId)
        binding = {
          sessionId: created.sessionId,
          createdAt: now,
          failureDate: previous?.failureDate || '',
          safetyHold: previous?.safetyHold || '',
        }
        // Persist the ID even if naming or delivery subsequently fails, so retries reuse it.
        bindings[kind] = binding
      }
      binding.createdAt ||= binding.startedAt || now
      Object.assign(binding, {
        requestId,
        status: 'running',
        startedAt: now,
        ownerPid: process.pid,
        error: '',
        turn: null,
      })
      return { sessionId: binding.sessionId, status: 'running' }
    },
    { undoable: false },
  )
  if (result.busy) return result
  const sessionId = result.sessionId
  try {
    if (!agent) {
      const resolved = await ctx.sessionController.resolveAgent(sessionId)
      if (resolved?.error || !resolved?.agent)
        throw resolved?.error || new Error('整理对话不可用')
      agent = resolved.agent
    }
    if (typeof agent.model?.select !== 'function')
      throw new Error('当前宿主不支持会话模型选择')
    await ctx.sessionController.rename({ sessionId, title: titles[kind] })
    guardRun = tracker.arm(kind, agent, requestId, {
      onStop,
      automatic,
      submitOnly,
      scopeStarted: kind === 'learn' && !!beforeSend,
    })
    if (beforeSend)
      await beforeSend({
        sessionId,
        selection,
        requestId,
        seal: () => {
          guardRun.sealed = true
        },
        cancel: (reason) => tracker.stop(guardRun, reason),
      })
    if (signal?.aborted) throw new Error('整理启动已取消')
    await agent.model.select(selection)
    if (guardRun.error || signal?.aborted)
      throw new Error(guardRun.error || '整理启动已取消')
    agent.followup({
      id: requestId,
      role: 'user',
      content: [{ type: 'text', text }],
      source: { kind: 'cordis-host-runner' },
    })
    await ctx.sessions.flush(agent.session)
    return { ...result, requestId }
  } catch (error) {
    if (guardRun) {
      tracker.stop(guardRun, error.message)
      if (agent.status !== 'running') tracker.release(guardRun)
    }
    await store.mutate(
      '记录整理对话错误',
      (draft) => {
        const binding = draft.assistant.sessions[kind]
        if (binding?.requestId === requestId)
          Object.assign(binding, {
            status: 'error',
            error: error.message,
            failureDate: calendarDate(new Date(), draft.plan.config.timezone),
          })
      },
      { undoable: false },
    )
    throw Object.assign(error, { sessionId })
  }
}

const trackers = new WeakMap()
export function installOrganizationSessions(ctx, store) {
  if (trackers.has(store)) return trackers.get(store)
  const writes = new Set()
  const guard = installOrganizationGuard(
    ctx,
    store,
    (run, error) => {
      const endedAt = new Date()
      const write = store
        .mutate(
          '整理对话结束',
          (draft) => {
            const binding = draft.assistant.sessions[run.kind]
            if (
              binding?.requestId !== run.requestId ||
              binding.sessionId !== run.id
            )
              return
            Object.assign(binding, {
              status: error ? 'error' : 'completed',
              finishedAt: endedAt.toISOString(),
              error,
              usage: {
                requests: run.requests,
                inputBytes: run.bytes,
                tools: run.calls,
              },
            })
            if (error)
              binding.failureDate = calendarDate(
                endedAt,
                draft.plan.config.timezone,
              )
            if (run.error) binding.safetyHold = run.error
            else if (!error && !run.automatic) delete binding.safetyHold
          },
          { undoable: false },
        )
        .catch((e) => console.warn('workbench: 整理状态保存失败', e.message))
        .finally(() => writes.delete(write))
      writes.add(write)
    },
    (agent, text) =>
      dispatchOrganization(
        ctx,
        store,
        'learn',
        `【学习整理】这是用户在上一个学习对话发起的新回合。请按用户指定的范围调用 workbench_learn_collect(start:true)，不沿用旧材料。\n用户原话：\n${text}`,
        { rotatingFrom: agent },
      ),
  )
  const tracker = {
    ...guard,
    dispose() {
      guard.dispose()
      trackers.delete(store)
      return Promise.allSettled([...writes])
    },
  }
  trackers.set(store, tracker)
  return tracker
}
