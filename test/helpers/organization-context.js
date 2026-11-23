// In-memory DSH contract fixture; never reads user sessions or calls a real model.
export function organizationContext(
  build = () => ({ changes: [], summary: '本轮没有新增事项' }),
  selection = { provider: 'fixture', model: 'test-model' },
) {
  const listeners = new Map(),
    agents = new Map(),
    registered = new Map(),
    pending = new Set()
  let seq = 0
  const emit = (id, type, data) => {
    for (const fn of listeners.get('session/event') || [])
      fn({ id }, { type, data, seq: ++seq })
  }
  const ctx = {
    created: [],
    cards: [],
    receipts: [],
    titles: [],
    registered,
    agents,
    get: () => null,
    on: (name, fn, opts = {}) => {
      if (!listeners.has(name)) listeners.set(name, [])
      const list = listeners.get(name)
      if (opts.prepend) list.unshift(fn)
      else list.push(fn)
      return () => {
        if (list.includes(fn)) list.splice(list.indexOf(fn), 1)
      }
    },
    notify(name, ...args) {
      for (const fn of listeners.get(name) || []) fn(...args)
    },
    waterfall(name, payload, terminal) {
      return (listeners.get(name) || []).reduceRight(
        (next, fn) => () => fn(payload, next),
        terminal,
      )()
    },
    emit,
    tools: {
      register: (tool) => {
        registered.set(tool.name, tool)
        return () => registered.delete(tool.name)
      },
    },
    sessions: { flush: async () => {} },
    idle: async () => {
      await Promise.all([...pending])
      await new Promise((resolve) => setTimeout(resolve, 0))
    },
    sessionController: {
      modelCatalog: async () => ({
        default: selection,
        groups: [
          {
            id: selection.provider,
            models: [
              {
                id: selection.model,
                reasoning: {
                  efforts: [
                    { id: 'low', name: 'Low' },
                    { id: 'high', name: 'High' },
                  ],
                },
              },
            ],
          },
        ],
      }),
      create: async () => {
        const id = `organizer-${ctx.created.length + 1}`
        ctx.created.push(id)
        const agent = {
          session: { id },
          status: 'idle',
          ctx: {
            tools: {
              restrict({ allow }) {
                for (const name of allow) {
                  if (
                    name.startsWith('workbench_organize_') &&
                    !registered.has(name)
                  )
                    throw new Error(`Cannot restrict: unknown tool ${name}`)
                }
                agent.allowed = allow
                return () => {
                  delete agent.allowed
                }
              },
            },
          },
          cancel(reason) {
            agent.cancelReason = reason.reason
            if (agent.status !== 'running') return
            agent.status = 'idle'
            emit(id, 'turn/end', {
              turn: agent.turn,
              reason: { kind: 'aborted', reason },
            })
          },
          model: {
            select: (value) => {
              agent.selection = value
            },
          },
          followup: (card) => {
            ctx.cards.push({ sessionId: id, card })
            agent.status = 'running'
            const turn = (agent.turn = ++seq)
            delete agent.cancelReason
            emit(id, 'turn/start', { turn })
            emit(id, 'user/message', card)
            const job = Promise.resolve()
              .then(async () => {
                try {
                  const prompt = card.content[0].text
                  let material = prompt.includes('\n材料：')
                    ? JSON.parse(prompt.split('\n材料：')[1])
                    : []
                  const reviewedSessions = []
                  const inspect = registered.get('workbench_organize_inspect')
                  if (inspect && prompt.startsWith('【任务整理】')) {
                    const runId = prompt.match(/本轮编号：([^\n]+)/)[1]
                    const query = (args) =>
                      inspect.execute({ runId, ...args }, { agent })
                    await query({ action: 'tasks' })
                    const directory = await query({ action: 'sessions' })
                    for (const session of directory.sessions) {
                      const result = await query({
                        action: 'read',
                        ref: session.ref,
                      })
                      material.push(...result.messages)
                      reviewedSessions.push(session.ref)
                    }
                    if (!material.length) {
                      const planning = JSON.parse(
                        prompt.split('计划复核：')[1].split('。')[0],
                      )
                      if (planning?.requestKey)
                        material = [
                          { key: planning.requestKey, text: '复核现有计划' },
                        ]
                    }
                  }
                  const proposal = await build(material, prompt, ctx)
                  if (proposal?.hold) return
                  if (prompt.startsWith('【任务整理】')) {
                    const runId = prompt.match(/本轮编号：([^\n]+)/)[1]
                    const receipt = await registered
                      .get('workbench_organize_submit')
                      .execute(
                        {
                          runId,
                          changes: proposal.changes || [],
                          collaborations: proposal.collaborations || [],
                          summary: proposal.summary || '',
                          reviewedSessions,
                        },
                        { agent },
                      )
                    ctx.receipts.push(receipt)
                    emit(id, 'assistant/message', {
                      turn,
                      message: {
                        content: [
                          { type: 'text', text: JSON.stringify(receipt) },
                        ],
                      },
                    })
                  }
                  agent.status = 'idle'
                  emit(id, 'turn/end', { turn, reason: { kind: 'completed' } })
                } catch (error) {
                  agent.status = 'idle'
                  emit(id, 'turn/end', {
                    turn,
                    reason: {
                      kind: 'failed',
                      error: { message: error.message },
                    },
                  })
                }
              })
              .finally(() => pending.delete(job))
            pending.add(job)
          },
        }
        agents.set(id, agent)
        return { sessionId: id }
      },
      rename: async ({ sessionId, title }) => {
        ctx.titles.push({ sessionId, title })
      },
      resolveAgent: async (id) =>
        agents.has(id)
          ? { agent: agents.get(id) }
          : { error: new Error('session not found') },
      selectModel: () => {
        throw new Error('不得更改全局默认模型')
      },
    },
  }
  return ctx
}
