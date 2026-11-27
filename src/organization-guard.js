import { automaticModelAllowed, shouldRotateSession } from './assistant.js'

import { organizationProgress } from './organization-progress.js'

const followupTools = ['workbench_query']
const allowed = {
  tasks: ['workbench_organize_inspect', 'workbench_organize_submit'],
  learn: [
    'workbench_learn_collect',
    'workbench_learn_read',
    'workbench_learn_write',
  ],
}

/** Own the physical Agent until turn/end, not just until a business tool returns. */
export function installOrganizationGuard(
  ctx,
  store,
  recordEnd,
  forwardLearning,
) {
  let disposed = false
  const active = new Map(),
    hooks = []
  const on = (event, fn) => hooks.push(ctx.on(event, fn, { prepend: true }))
  // A request from a retired chat, or one that survived a reload/cancel without
  // admission, must not fall through as a normal paid request or tool execution.
  async function dedicated(id) {
    if (!id) return false
    const { assistant } = store.latest() || (await store.read())
    return (
      Object.values(assistant.sessions).some((b) => b.sessionId === id) ||
      assistant.retiredSessions.includes(id)
    )
  }
  function release(run) {
    if (active.get(run.id) !== run) return
    active.delete(run.id)
    run.unrestrict()
  }
  function stop(run, reason) {
    if (active.get(run.id) !== run || run.error) return
    run.error = reason
    // Cancel before any asynchronous bookkeeping or the next model step.
    try {
      run.agent.cancel({ kind: 'hook', reason })
    } finally {
      run.onStop?.(new Error(reason))
      if (!run.followup) recordEnd(run, reason)
    }
  }
  function arm(
    kind,
    agent,
    requestId,
    {
      onStop,
      automatic = false,
      submitOnly = false,
      scopeStarted = false,
      followup = false,
    } = {},
  ) {
    if (disposed) throw new Error('宿主已停止，未启动整理')
    if (
      typeof agent.cancel !== 'function' ||
      typeof agent.ctx?.tools?.restrict !== 'function'
    )
      throw new Error('宿主不支持整理安全限制，未发送模型请求')
    const id = agent.session.id
    if (active.has(id)) throw new Error('原整理回合尚未结束')
    // Estimates already carry their material and do not register an inspect tool.
    const tools = followup
      ? followupTools
      : kind === 'tasks' && submitOnly
        ? ['workbench_organize_submit']
        : allowed[kind]
    const unrestrict = agent.ctx.tools.restrict({ allow: tools })
    const run = {
      kind,
      agent,
      id,
      requestId,
      onStop,
      automatic,
      unrestrict,
      tools,
      scopeStarted,
      followup,
      observe: organizationProgress(),
      gotResult: false,
      advanced: false,
      recovering: false,
      requests: 0,
      bytes: 0,
      calls: 0,
      turn: null,
    }
    active.set(id, run)
    return run
  }
  // Admit a fresh human message only in a currently bound chat.
  // Never recreate a budget for an orphaned continuation or an assistant/tool message.
  on('agent/pre-step', async ({ agent, messages, turn, step }, next) => {
    const id = agent.session.id
    let run = active.get(id)
    if (!run) {
      const state = await store.read()
      const kind = Object.keys(allowed).find(
        (k) => state.assistant.sessions[k]?.sessionId === id,
      )
      if (!kind && !state.assistant.retiredSessions.includes(id)) return next()
      const human = messages.find(
        (m) => m.source?.kind === 'user' && m.content?.length,
      )
      if (
        kind === 'learn' &&
        step === 1 &&
        human?.id &&
        shouldRotateSession(state, state.assistant.sessions.learn)
      ) {
        const text = human.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('\n')
        let reason = '请从工作台或普通对话发起本次学习整理'
        if (text.trim()) {
          const sent = await forwardLearning(agent, text)
          reason = sent.busy
            ? '学习整理仍在执行，本次未重复派发'
            : '已将本次要求转到新的学习整理对话，旧对话不调用模型'
        }
        agent.cancel({ kind: 'hook', reason })
        return { kind: 'reject' }
      }
      if (!kind || step !== 1 || !human?.id) {
        agent.cancel({
          kind: 'hook',
          reason:
            '没有当前整理授权。可从工作台启动，学习整理也可从普通对话指定范围启动。',
        })
        return { kind: 'reject' }
      }
      if (kind === 'tasks') {
        // A human follow-up may discuss the receipt or query current items. It
        // neither reopens the previous submit tool nor owns an organizer lease.
        run = arm(kind, agent, human.id, { followup: true })
      } else {
        run = arm(kind, agent, human.id)
        run.turn = turn
        try {
          await store.mutate(
            '开始手动学习回合',
            (draft) => {
              const binding = draft.assistant.sessions.learn
              if (
                binding?.sessionId !== id ||
                shouldRotateSession(draft, binding)
              )
                throw new Error('学习对话已换新')
              binding.createdAt ||=
                binding.startedAt || new Date().toISOString()
              Object.assign(binding, {
                status: 'running',
                startedAt: new Date().toISOString(),
                requestId: human.id,
                ownerPid: process.pid,
                error: '',
              })
            },
            { undoable: false },
          )
        } catch (e) {
          stop(run, e.message)
          throw e
        }
      }
    }
    if (run.turn === null) run.turn = turn
    if (
      run.turn !== turn ||
      (step === 1 && !messages.some((m) => m.id === run.requestId))
    )
      stop(run, '本轮整理与触发消息不一致，已停止')
    if (run.error) return { kind: 'reject' }
    const decision = await next()
    if (run.kind !== 'tasks' || decision.kind !== 'enter') return decision
    // DSH can offer text sent while busy as input to the next *step*. Keep it
    // for its own turn instead of feeding it into a sealed or in-flight batch.
    const later = decision.messages.filter(
      (m) =>
        m.source?.kind === 'user' &&
        m.id !== run.requestId &&
        m.content?.length,
    )
    if (!later.length) return decision
    for (const message of later) agent.followup(message)
    const queued = new Set(later.map((m) => m.id))
    return {
      ...decision,
      messages: messages.every((m) => queued.has(m.id))
        ? []
        : decision.messages.filter((m) => !queued.has(m.id)),
    }
  })
  // Admit the first request normally. A new request needs a receipt from the
  // preceding step. Allow a recovery/submit turn for an unproductive read;
  // if recovery also brings back only old material, stop BEFORE spending again.
  on('llm/stream', async function* (options, next) {
    const run = active.get(options.sessionId)
    if (!run && (await dedicated(options.sessionId)))
      throw new Error('整理回合已关闭，未发起模型请求')
    options.signal?.throwIfAborted()
    if (run) {
      if (run.automatic && !automaticModelAllowed(await store.read(), options))
        stop(run, '当前模型没有定时整理授权，未发送请求')
      options.signal?.throwIfAborted()
      // A reused incident chat can contain a whole shell/capture loop in its history.
      // Quarantine that history by its contents, not its size; never silently rerun it.
      if (
        !run.requests &&
        options.messages.some(
          (message) =>
            message.role === 'assistant' &&
            Array.isArray(message.content) &&
            message.content.some(
              (block) =>
                block.type === 'tool-call' &&
                !allowed[run.kind].includes(block.name) &&
                !(run.kind === 'tasks' && followupTools.includes(block.name)),
            ),
        )
      ) {
        stop(
          run,
          '旧整理对话包含本类不允许的工具调用；未重发历史，请选择下次用新对话后手动整理',
        )
      }
      if (run.sealed) stop(run, '本轮已提交，不再调用模型')
      else if (run.requests && !run.gotResult)
        stop(run, '没有新的整理工具回执，已停止重复请求')
      else if (run.recovering && !run.advanced)
        stop(run, '重取后仍没有新材料或已保存的进度，已暂停整理')
      if (run.error) throw new Error(run.error)
      run.recovering = run.requests > 0 && !run.advanced
      run.advanced = false
      run.gotResult = false
      ++run.requests
      const { messages, tools, toolHistory } = options
      run.bytes += Buffer.byteLength(
        JSON.stringify({ messages, tools, toolHistory }),
      )
    }
    yield* next()
  })
  on('agent/request-error', ({ agent, failure }, next) => {
    const run = active.get(agent.session.id)
    if (!run) return next()
    stop(
      run,
      `模型请求失败，未重试：${failure?.message || failure?.code || failure?.status || '未知错误'}`,
    )
    // Do not delegate to the provider retry middleware.
  })
  on('tools/pre-execute', async (exec, next) => {
    const run = active.get(exec.agent?.session?.id)
    if (!run)
      return (await dedicated(exec.agent?.session?.id))
        ? { kind: 'deny', reason: '整理回合已关闭' }
        : next()
    if (!run.tools.includes(exec.name) || run.sealed)
      stop(run, `本轮不允许执行 ${exec.name}`)
    else if (exec.name === 'workbench_learn_collect' && exec.arguments?.start) {
      if (run.scopeStarted)
        stop(run, '本轮已有学习范围，不能在同一回合重新启动整理')
      run.scopeStarted = true
    }
    ++run.calls
    return run.error ? { kind: 'deny', reason: run.error } : next()
  })
  on('tools/result', (exec, result) => {
    const run = active.get(exec.agent?.session?.id)
    if (!run || run.error) return
    if (result.isError || result.value?.ok === false)
      stop(
        run,
        `整理工具失败：${result.error?.message || result.value?.error || exec.name}`,
      )
    else if (result.value?.paused) stop(run, result.value.paused)
    else if (
      exec.name === 'workbench_organize_submit' ||
      (exec.name === 'workbench_learn_write' &&
        result.value?.progress?.complete)
    )
      run.sealed = true
    else {
      run.gotResult = true
      const advanced = run.observe(
        exec,
        result.value,
        store.latest()?.learn?.review,
      )
      if (advanced) run.advanced = true
    }
  })
  on('session/event', (session, event) => {
    const run = active.get(session?.id)
    if (!run) return
    const { turn, message, reason } = event.data || {}
    if (event.type === 'turn/start' && run.turn === null) run.turn = turn
    if (run.turn !== turn) return
    if (event.type === 'assistant/message') {
      const forbidden = message.content.find(
        (block) =>
          block.type === 'tool-call' &&
          (!run.tools.includes(block.name) || run.sealed),
      )
      if (forbidden) stop(run, `本轮不允许调用 ${forbidden.name}`)
    }
    if (event.type === 'turn/end') {
      release(run)
      if (!run.error && !run.followup) {
        const error =
          reason?.kind === 'completed'
            ? run.sealed
              ? ''
              : '本轮未完整提交，已停止；可手动继续'
            : reason?.reason?.reason ||
              reason?.error?.message ||
              reason?.kind ||
              '执行中断'
        if (error) run.onStop?.(new Error(error))
        recordEnd(run, error)
      }
    }
  })
  return {
    arm,
    stop,
    release,
    dispose() {
      disposed = true
      for (const run of active.values()) {
        stop(run, '宿主停止，整理已取消')
        release(run)
      }
      for (const hook of hooks) hook()
    },
  }
}
