// 五个模型工具：登记、更新、查询、停靠灵感、验收。全部读写同一个 store。
import { applyOps, countsOf, resolveTask, todayView, allView, reviewsView, ideasView } from './ops.js'

function sessionIdOf(exec) {
  const id = exec?.agent?.session?.id
  return typeof id === 'string' && id ? id : undefined
}

function outputSchema(properties, required) {
  return {
    type: 'object',
    additionalProperties: false,
    ...(required.length ? { required } : {}),
    properties,
  }
}

function textBlock(text) {
  return [{ type: 'text', text }]
}

function briefCounts(counts) {
  const parts = [`进行中 ${counts.doing}`, `待办 ${counts.todo}`]
  if (counts.blocked) parts.push(`受阻 ${counts.blocked}`)
  if (counts.pendingReviews) parts.push(`待验收 ${counts.pendingReviews}`)
  if (counts.parkedIdeas) parts.push(`灵感 ${counts.parkedIdeas}`)
  return parts.join(' · ')
}

const patchSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', description: '新标题。' },
    note: { type: 'string', description: '备注（替换原文）。' },
    status: { type: 'string', enum: ['todo', 'doing', 'blocked', 'done'], description: 'todo 待办 | doing 进行中 | blocked 受阻 | done 完成。' },
    due: { type: 'string', description: '截止日期 YYYY-MM-DD；传空字符串清除。' },
    priority: { type: 'integer', enum: [0, 1, 2], description: '0 低 | 1 中 | 2 高。' },
    focus: { type: 'boolean', description: '是否列入今天焦点。' },
    tags: { type: 'array', items: { type: 'string' }, description: '标签（整体替换）。' },
    progress: { type: 'string', description: '环节进展一句话汇报，追加到任务时间线（自动带上本会话身份）。接手执行、推进到新环节、派出子代理/工作流时都记一笔。' },
    checklist: {
      type: 'array',
      description: '子步骤清单（整体替换）。',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: {
          text: { type: 'string' },
          done: { type: 'boolean' },
        },
      },
    },
  },
}

/** 供 host.js 注册全部工具。 */
export function registerTools(ctx, store) {
  const registrations = []

  registrations.push(ctx.tools.register({
    name: 'workbench_add',
    description: '把一件事登记进个人工作台（todo 系统）。用户在对话中提到新任务、答应要做的事、新的待办需求时自动调用，登记后用一句话回执即可，不要打断当前工作。也可用于把用户口述的多条事项逐条登记。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['title'],
      properties: {
        title: { type: 'string', description: '任务标题，一句短语，自动替用户拟好（动宾结构，含关键对象）。' },
        note: { type: 'string', description: '补充说明、验收标准或上下文，可选。' },
        due: { type: 'string', description: '截止日期，格式 YYYY-MM-DD，可选。' },
        priority: { type: 'integer', enum: [0, 1, 2], description: '优先级：0 低（默认）| 1 中 | 2 高。' },
        tags: { type: 'array', items: { type: 'string' }, description: '少量标签，可选。' },
        status: { type: 'string', enum: ['todo', 'doing'], description: '初始状态，默认 todo；用户明确说正在做/马上做时用 doing。' },
        focus: { type: 'boolean', description: '是否列入今天焦点，默认 false。' },
      },
    },
    output: {
      schema: outputSchema({
        id: { type: 'string' },
        title: { type: 'string' },
        counts: { type: 'object', additionalProperties: true },
      }, ['id', 'title', 'counts']),
      render: (_args, value) => textBlock(`工作台已登记「${value.title}」。当前：${briefCounts(value.counts)}`),
    },
    async execute(args, exec) {
      const result = await store.mutate('登记任务', (draft) => applyOps(draft, [{
        op: 'add_task',
        title: args.title,
        note: args.note,
        due: args.due,
        priority: args.priority,
        tags: args.tags,
        status: args.status,
        focus: args.focus,
        source: 'chat',
        sessionId: sessionIdOf(exec),
      }]))
      const task = draftTask(store, result.targets[0])
      return { id: task?.id ?? '', title: task?.title ?? String(args.title), counts: countsOf(store.latest()) }
    },
    presentCall: (args) => ({ card: 'generic', title: `工作台 · 登记「${String(args.title).slice(0, 30)}」`, kind: 'other', rawInput: args }),
  }))

  registrations.push(ctx.tools.register({
    name: 'workbench_update',
    description: '更新工作台任务：完成、推进状态、改截止日期/优先级/焦点、汇报环节进展（patch.progress）。idOrTitle 传任务 id 或标题（标题支持模糊匹配，多命中会返回候选列表）。任务完成时 status 传 done。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['idOrTitle', 'patch'],
      properties: {
        idOrTitle: { type: 'string', description: '任务 id 或标题（支持包含式模糊匹配）。' },
        patch: { ...patchSchema, description: '要修改的字段，只传需要改的。' },
      },
    },
    output: {
      schema: outputSchema({
        ok: { type: 'boolean' },
        task: { type: 'object', additionalProperties: true },
        counts: { type: 'object', additionalProperties: true },
        candidates: { type: 'array', items: { type: 'object', additionalProperties: true } },
        error: { type: 'string' },
      }, ['ok']),
      render: (_args, value) => textBlock(value.ok
        ? `已更新「${value.task?.title ?? ''}」（${value.task?.status ?? ''}）。当前：${value.task ? briefCounts(value.counts ?? {}) : ''}`
        : `更新失败：${value.error ?? '未知原因'}${value.candidates?.length ? `；候选：${value.candidates.map((row) => `${row.id} ${row.title}(${row.status})`).join('；')}` : ''}`),
    },
    async execute(args, exec) {
      const state = await store.read()
      const resolved = resolveTask(state, args.idOrTitle)
      if (!resolved.task) {
        return {
          ok: false,
          error: resolved.error ?? '匹配到多个任务，请从候选中选择',
          ...(resolved.candidates ? { candidates: resolved.candidates.map((row) => ({ id: row.id, title: row.title, status: row.status, due: row.due })) } : {}),
        }
      }
      const target = resolved.task
      // progress 汇报自动携带本会话身份，任务时间线上能看到是谁推进到哪个环节
      const op = { op: 'update_task', id: target.id, ...args.patch }
      if (typeof op.progress === 'string' && op.progress.trim()) op.progressSession = sessionIdOf(exec)
      const result = await store.mutate('更新任务', (draft) => applyOps(draft, [op]))
      if (result.errors.length) return { ok: false, error: result.errors.join('；') }
      const updated = store.latest().tasks.find((row) => row.id === target.id)
      return { ok: true, task: updated, counts: countsOf(store.latest()) }
    },
    presentCall: (args) => ({ card: 'generic', title: `工作台 · 更新「${String(args.idOrTitle).slice(0, 30)}」`, kind: 'other', rawInput: args }),
  }))

  registrations.push(ctx.tools.register({
    name: 'workbench_query',
    description: '查询个人工作台。用户问「我今天做什么 / 有什么没做完 / 最近完成了什么 / 待验收有什么 / 灵感有哪些」时先调用本工具再回答；today 视图 = 进行中 ∪ 今天及以前到期 ∪ 焦点。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        view: { type: 'string', enum: ['today', 'all', 'reviews', 'ideas'], description: 'today 今日视图（默认）| all 全部任务 | reviews 待验收 | ideas 灵感收件箱。' },
      },
    },
    output: {
      schema: outputSchema({ data: { type: 'object', additionalProperties: true } }, ['data']),
      render: (args, value) => textBlock(`工作台 ${String(args.view ?? 'today')} 视图（详见结构化结果）：${summaryText(args.view ?? 'today', value.data)}`),
    },
    async execute(args) {
      const state = await store.read()
      const view = args.view ?? 'today'
      const data = view === 'today' ? todayView(state)
        : view === 'all' ? allView(state)
        : view === 'reviews' ? reviewsView(state)
        : ideasView(state)
      return { data }
    },
    presentCall: () => ({ card: 'generic', title: '工作台 · 查询', kind: 'other', rawInput: {} }),
  }))

  registrations.push(ctx.tools.register({
    name: 'workbench_capture_idea',
    description: '把突然出现的灵感/与当前任务无关的想法一句话停靠到工作台收件箱，之后继续当前任务，不展开、不切换上下文。对话中察觉用户（或你自己）冒出题外想法时自动调用。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['text'],
      properties: {
        text: { type: 'string', description: '想法本身，保留用户原意，一句到几句。' },
        note: { type: 'string', description: '关联上下文（当时在做什么、来源），可选。' },
      },
    },
    output: {
      schema: outputSchema({ id: { type: 'string' }, parked: { type: 'integer' } }, ['id', 'parked']),
      render: (_args, value) => textBlock(`灵感已停靠（收件箱共 ${value.parked} 条），继续当前任务。`),
    },
    async execute(args, exec) {
      await store.mutate('停靠灵感', (draft) => applyOps(draft, [{
        op: 'capture_idea', text: args.text, note: args.note, source: 'chat', sessionId: sessionIdOf(exec),
      }]))
      const state = store.latest()
      return { id: state.ideas[0]?.id ?? '', parked: state.ideas.filter((row) => row.status === 'parked').length }
    },
    presentCall: (args) => ({ card: 'generic', title: `工作台 · 停靠灵感「${String(args.text).slice(0, 24)}」`, kind: 'other', rawInput: args }),
  }))

  registrations.push(ctx.tools.register({
    name: 'workbench_review',
    description: '处置一条待验收：accept 确认没问题、dismiss 忽略、promote 验收后转为跟进任务。idOrTitle 传验收条目 id 或标题（模糊匹配）。子代理/工作流/后台任务的结果看完后调用。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['idOrTitle', 'action'],
      properties: {
        idOrTitle: { type: 'string', description: '验收条目 id 或标题。' },
        action: { type: 'string', enum: ['accept', 'dismiss', 'promote'], description: 'accept 验收 | dismiss 忽略 | promote 验收并转为任务。' },
        taskTitle: { type: 'string', description: 'promote 时的任务标题，默认用验收标题。' },
      },
    },
    output: {
      schema: outputSchema({
        ok: { type: 'boolean' },
        review: { type: 'object', additionalProperties: true },
        taskId: { type: 'string' },
        pending: { type: 'integer' },
        error: { type: 'string' },
      }, ['ok']),
      render: (_args, value) => textBlock(value.ok
        ? `验收处置完成：${value.review?.title ?? ''}${value.taskId ? ' → 已转任务' : ''}。剩余待验收 ${value.pending ?? 0} 条。`
        : `处置失败：${value.error ?? '未知原因'}`),
    },
    async execute(args) {
      const state = await store.read()
      const key = String(args.idOrTitle ?? '').trim()
      const pending = state.reviews.filter((row) => row.status === 'pending')
      const review = pending.find((row) => row.id === key)
        ?? pending.find((row) => row.title === key)
        ?? pending.find((row) => row.title.includes(key) || key.includes(row.title))
      if (!review) {
        return { ok: false, error: `没有找到待验收条目「${key.slice(0, 40)}」`, pending: pending.length }
      }
      const result = await store.mutate('处置验收', (draft) => applyOps(draft, [{
        op: 'decide_review', id: review.id, action: args.action, taskTitle: args.taskTitle,
      }]))
      if (result.errors.length) return { ok: false, error: result.errors.join('；') }
      const next = store.latest().reviews.find((row) => row.id === review.id)
      const taskId = next?.promotedTaskId ?? ''
      return { ok: true, review: next, taskId, pending: store.latest().reviews.filter((row) => row.status === 'pending').length }
    },
    presentCall: (args) => ({ card: 'generic', title: `工作台 · 验收「${String(args.idOrTitle).slice(0, 24)}」`, kind: 'other', rawInput: args }),
  }))

  return () => registrations.forEach((dispose) => dispose())
}

function draftTask(store, id) {
  if (!id) return undefined
  return store.latest()?.tasks.find((row) => row.id === id)
}

function summaryText(view, data) {
  if (!data || typeof data !== 'object') return '(空)'
  if (view === 'today') {
    const lines = []
    for (const section of data.sections ?? []) lines.push(`${section.title}：${section.tasks.map((row) => row.title).join('；')}`)
    if (data.doneToday?.length) lines.push(`今日完成 ${data.doneToday.length} 件`)
    return lines.join('。') || '(今天暂无安排)'
  }
  if (view === 'all') {
    return `待办 ${data.todo?.length ?? 0} · 进行中 ${data.doing?.length ?? 0} · 受阻 ${data.blocked?.length ?? 0} · 已完成 ${data.done?.length ?? 0}`
  }
  if (view === 'reviews') {
    return data.pending?.length ? `待验收 ${data.pending.length} 条：${data.pending.map((row) => row.title).join('；')}` : '没有待验收'
  }
  return data.parked?.length ? `灵感 ${data.parked.length} 条：${data.parked.map((row) => row.text.slice(0, 18)).join('；')}` : '灵感收件箱是空的'
}
