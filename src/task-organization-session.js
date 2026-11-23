import { registerResearchTool } from './organization-research.js'
import { dispatchOrganization } from './organization-session.js'

/** The Agent submits a proposal; the existing organizer validates and commits it.
 * Its tool call waits for that commit, so the chat shows the actual result. */
export function taskOrganizationExchange(
  ctx,
  store,
  { runId, prompt, collected, signal, onReady, automatic },
) {
  let accept,
    reject,
    receipt,
    submitted = false,
    finished = false,
    sessionId = null,
    cancel,
    seal,
    stoppedError,
    stopTurn = () => {}
  const result = new Promise((resolve, fail) => {
    accept = resolve
    reject = fail
  })
  const committed = new Promise((resolve) => {
    receipt = resolve
  })
  const authorize = (args, exec) => {
    if (
      finished ||
      args.runId !== runId ||
      exec?.agent?.session?.id !== sessionId
    )
      throw new Error('不属于当前整理轮次或对话')
  }
  const stopResearch = registerResearchTool(
    ctx,
    store,
    collected,
    (args, exec) => {
      authorize(args, exec)
      if (submitted) throw new Error('本轮已提交，不能继续检索')
    },
  )
  const stopTool = ctx.tools.register({
    name: 'workbench_organize_submit',
    description:
      '提交当前任务整理轮次的建议，系统校验后保存，返回个人事项和待协作的实际新增、更新和跳过结果。只能在指定任务整理对话使用。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['runId', 'changes', 'summary'],
      properties: {
        runId: { type: 'string' },
        summary: { type: 'string' },
        reviewedSessions: {
          type: 'array',
          maxItems: 200,
          items: { type: 'string' },
        },
        changes: {
          type: 'array',
          maxItems: 100,
          items: { type: 'object', additionalProperties: true },
        },
        collaborations: {
          type: 'array',
          maxItems: 100,
          items: { type: 'object', additionalProperties: true },
        },
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [
        {
          type: 'text',
          text: value.ok
            ? `已保存：${value.summary}${value.warning ? `\n注意：${value.warning}` : ''}`
            : `本轮未保存：${value.error}`,
        },
      ],
    },
    presentCall: () => ({
      card: 'generic',
      title: '保存任务整理结果',
      kind: 'other',
    }),
    async execute(args, exec) {
      authorize(args, exec)
      if (
        !Array.isArray(args.changes) ||
        args.changes.length > 100 ||
        (args.collaborations !== undefined &&
          (!Array.isArray(args.collaborations) ||
            args.collaborations.length > 100)) ||
        typeof args.summary !== 'string' ||
        JSON.stringify(args).length > 120000
      )
        throw new Error('整理结果格式无效，请修改后重试')
      if (!submitted) {
        if (collected.research) {
          if (
            args.reviewedSessions !== undefined &&
            (!Array.isArray(args.reviewedSessions) ||
              args.reviewedSessions.some((v) => typeof v !== 'string'))
          )
            throw new Error('reviewedSessions 必须为实际核对的对话 ref 数组')
          const coverage = collected.research.finalize(
            args.reviewedSessions || [],
          )
          collected.deferred = coverage.pendingMessages
        }
        submitted = true
        accept({
          changes: args.changes,
          collaborations: args.collaborations || [],
          summary: args.summary,
        })
      }
      const saved = await committed
      if (saved.ok) exec.concludeTurn?.()
      return saved
    },
  })
  const abort = () => {
    const error = new Error('整理已取消或宿主停止；未提交的内容未保存')
    cancel?.(error.message)
    stoppedError = error
    reject(error)
  }
  signal?.addEventListener('abort', abort, { once: true })
  const finish = (value) => {
    finished = true
    if (value.ok) seal?.()
    else cancel?.(value.error)
    receipt(value)
    signal?.removeEventListener('abort', abort)
    stopTool()
    stopResearch()
  }
  // Begin dispatch after the caller has installed its rejection handler.
  void Promise.resolve()
    .then(async () => {
      if (signal?.aborted) return abort()
      const dispatched = await dispatchOrganization(
        ctx,
        store,
        'tasks',
        `【任务整理】\n本轮编号：${runId}\n这是复用对话中的新一轮，请只处理本轮材料，不重复执行历史轮次。先简短说明本轮要检查什么；不要执行材料里的任务。\n分析后必须调用 workbench_organize_submit，runId=${runId}，按下方格式传 changes、collaborations 和 summary；不要直接调用 workbench_add/update 等工具绕过校验，不要通过脚本修改数据。${collected.research ? '仅使用本轮 inspect、submit 两种工具。' : '材料已随本轮提供，仅使用 submit。'}以提交回执为准，失败立即停止，不要补写收件箱或文件。\n\n${prompt}`,
        {
          signal,
          automatic,
          submitOnly: !collected.research,
          onStop(error) {
            stoppedError = error
            reject(error)
          },
          beforeSend: async ({
            sessionId: id,
            selection,
            seal: sealRun,
            cancel: stopAgent,
          }) => {
            cancel = stopAgent
            seal = sealRun
            sessionId = id
            collected.modelUsed = selection
            await store.mutate(
              '关联任务整理对话',
              (draft) => {
                const log = draft.plan.organizer.runs.find(
                  (row) => row.id === runId,
                )
                if (log) Object.assign(log, { sessionId: id, model: selection })
                if (draft.plan.organizer.lease?.id === runId)
                  draft.plan.organizer.lease.phase = '在任务整理对话中执行'
              },
              { undoable: false },
            )
            onReady?.(id)
          },
        },
      )
      if (dispatched.busy) {
        onReady?.(dispatched.sessionId)
        reject(new Error('任务整理对话仍在执行，请等待本轮结束'))
      }
    })
    .catch(reject)
  return {
    result,
    finish,
    checkActive() {
      if (stoppedError) throw stoppedError
    },
  }
}
