import { join } from 'node:path'
import { unlink } from 'node:fs/promises'
import { validateLinks } from './network.js'
// 学习模块 agent 工具：收集（零成本扫描）、写入（笔记+日报）、手动捕获、处置。
// 定时整理的触发卡、/闲时任务 里的「做一次学习整理」、对话里的手动请求走的是同一组工具。
import { applyOps, localDateOf, todayString, LEARN_CATEGORY_LABELS } from '../ops.js'
import {
  activeReview, bindReview, prepareReview, installReview, initialMaterial, reviewInbox, reviewManifest,
  REVIEW_GUIDE, readReviewPage, reviewProgress, progressText, acknowledgeReview, deliveredMessage,
} from './review.js'
import { runLearnNow } from './nightly.js'
import { learnTarget, writeLearnNote, writeDailyReport, updateNoteFields } from './obsidian.js'
import { dedupeKey } from './scan/heuristic.js'


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

/** 供 host.js 注册全部学习工具。 */
export function registerLearnTools(ctx, store, config = {}) {
  const registrations = []

  const material = {
    schema: { type: 'object', additionalProperties: true },
    render: (_args, value) => textBlock(JSON.stringify(value)),
  }
  registrations.push(
    ctx.tools.register({
      name: 'workbench_learn_collect',
      description:
        '用户要求整理或重扫时传 start:true 和指定范围；在学习整理对话当场启动，其他对话派发到专用对话。无参仅查看清单。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          start: { type: 'boolean', description: '用户明确要求时开始或继续整理；指定范围总是重新阅读。' },
          date: { type: 'string', description: '按工作台时区的 YYYY-MM-DD 或 yesterday（昨天），不要用小时数猜自然日。' },
          since: { type: 'string', description: '开始时刻，含时区的 ISO 格式（含）。' },
          until: { type: 'string', description: '结束时刻，含时区的 ISO 格式（不含）。' },
          project: { type: 'string', description: '项目路径或唯一的项目目录名。' },
          sessionId: { type: 'string', description: '限定一个来源会话。' },
          source: { type: 'string', enum: ['dsh','codex','zcode','claude'] },
          sinceHours: { type: 'integer', minimum: 1, maximum: 168 },
        },
      },
      output: material,
      async execute(args, exec) {
        const state = await store.read(),
          id = sessionIdOf(exec)
        if (!id) throw new Error('无法识别当前会话')
        const { start, ...scope } = args || {}
        if (!start && Object.keys(scope).length) throw new Error('要整理指定范围，请带 start:true')
        const binding = state.assistant.sessions.learn
        if (id !== binding?.sessionId) {
          if (start) {
            const dispatched = await runLearnNow(ctx, store, scope)
            exec.concludeTurn?.()
            return { dispatched }
          }
          return {
            progress: state.learn.review ? reviewProgress(state.learn.review) : null,
            inboxCount: state.learn.inbox.length,
            hint: '未启动整理。需要整理时传 start:true；历史原文只在专用会话读取。',
          }
        }
        if (!start) {
          activeReview(store, state, id)
          return reviewManifest(state, state.learn.review)
        }
        // 真人就在学习整理对话里：用当前回合，不再向自己排队发送 followup。
        const requestId = binding.requestId
        const run = await prepareReview(state, scope)
        const material = initialMaterial(state, run)
        await store.mutate('在当前对话开始学习整理', (draft) => {
          const current = draft.assistant.sessions.learn
          if (current?.sessionId !== id || current.requestId !== requestId) throw new Error('整理对话已变化，请重试')
          installReview(draft, run)
        }, { undoable: false })
        run.inline = true
        bindReview(store, run, requestId)
        return { instructions: REVIEW_GUIDE, ...material }
      },
      presentCall: () => ({ card: 'generic', title: '学习 · 查看会话清单', kind: 'other' }),
    }),
  )
  registrations.push(
    ctx.tools.register({
      name: 'workbench_learn_read',
      description:
        '无参读取或重发完整当前页；带 afterBatchId 读下一页，可按清单指定会话。不要求边读边写。回看可给 messageKey 和 offset。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          afterBatchId: { type: 'string' }, sessionId: { type: 'string' },
          source: { type: 'string', enum: ['dsh','codex','zcode','claude'] },
          messageKey: { type: 'string' }, offset: { type: 'integer', minimum: 0 },
        },
      },
      output: material,
      async execute(args, exec) {
        const state = await store.read(),
          run = activeReview(store, state, sessionIdOf(exec))
        if (!args?.messageKey) return readReviewPage(state.learn.review, run, args)
        const row = deliveredMessage(state.learn.review, run, args.messageKey),
          offset = args.offset || 0
        return {
          message: { ...row, offset, text: row.text.slice(offset, offset + 4000) },
          nextOffset: offset + 4000 < row.text.length ? offset + 4000 : null,
        }
      },
      presentCall: () => ({ card: 'generic', title: '学习 · 阅读对话', kind: 'other' }),
    }),
  )

  registrations.push(
    ctx.tools.register({
      name: 'workbench_learn_write',
      description:
        '把整理好的学习提问批量写入 Obsidian 并落库：每条含标题、原问题、分类（weak 弱项补强 / know 了解即可 / term 名词解释）、概念名、核心答案（answer，三五句话）、为什么重要（why，可选）。收件箱来源的条目带 inboxId 以便一并消化。写完自动生成/更新当日学习日报。',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['items'],
        properties: {
          batchId: { type: 'string', description: '专用整理会话必传，来自最后已读正文末尾。' },
          noLearning: {
            type: 'object', additionalProperties: false, required: ['reason', 'quote'],
            description: '已读到正文但没有可入册内容时，说明原因并摘录末页原话；读取错误不能提交。',
            properties: { reason: { type: 'string', minLength: 1, maxLength: 300 }, quote: { type: 'string', minLength: 1, maxLength: 160 } },
          },
          items: {
            type: 'array',
            description: '整理后的条目列表。',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'question', 'category', 'answer'],
              properties: {
                kind: {
                  type: 'string',
                  enum: ['question', 'suggested'],
                  description:
                    '真实提问 question；AI 推测的补充学习建议 suggested，必须带 evidence，不能冒充用户提问。',
                },
                messageKey: {
                  type: 'string',
                  description: '来源发言的 key。明确提问需来自用户，收件箱项改传 inboxId。',
                },
                evidence: {
                  type: 'string',
                  description: '整理批次必填：精确摘录已读发言中的连续原文。建议理由另写 why。',
                },
                parentIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '来源或前置知识点 ID，从 collect.knowledge 取，不可编造。',
                },
                relatedIds: {
                  type: 'array',
                  items: { type: 'string' },
                  description: '其他相关知识点 ID，构成横向关联。',
                },
                title: { type: 'string', description: '笔记标题，短语。' },
                question: {
                  type: 'string',
                  description: '用户原问题（收件箱/已读对话中的原问；建议则写成可复习的问题）。',
                },
                category: {
                  type: 'string',
                  enum: ['weak', 'know', 'term'],
                  description: 'weak 弱项补强（反复问/核心概念不清）| know 了解即可 | term 名词解释。',
                },
                concept: {
                  type: 'string',
                  description: '所属概念名，如 MCP、幂等性；同概念多次出现会进查漏补缺。',
                },
                answer: { type: 'string', description: '核心答案摘要，三五句话，写给复习时的自己。' },
                why: { type: 'string', description: '为什么重要，一两句，可选。' },
                source: {
                  type: 'object',
                  additionalProperties: true,
                  description: '来源 {harness, project, sessionId}，取自已读原文。',
                },
                askedAt: { type: 'string', description: '提问时间 ISO，取自已读原文。' },
                inboxId: { type: 'string', description: '收件箱条目 id（有就带上，写完自动消化）。' },
              },
            },
          },
        },
      },
      output: {
        schema: outputSchema(
          {
            ok: { type: 'boolean' },
            created: { type: 'array', items: { type: 'object', additionalProperties: true } },
            skipped: { type: 'integer' },
            progress: { type: 'object', additionalProperties: true },
            reportPath: { type: 'string' },
            reportAbsolutePath: { type: 'string' },
            error: { type: 'string' },
          },
          ['ok'],
        ),
        render: (_args, value) =>
          textBlock(
            value.ok
              ? `${value.progress ? (value.progress.complete ? '本轮完成' : '本轮未完成，继续 read') + '：' + progressText(value.progress) : '已写入'}。本批新增 ${value.created?.length ?? 0} 条；日报：${value.reportAbsolutePath || value.reportPath}`
              : `学习写入失败：${value.error ?? '未知原因'}`,
          ),
      },
      async execute(args, exec) {
        const newNotes = []
        try {
          const result = await store.mutate(
            '学习整理写入',
            async (state) => {
              exec?.signal?.throwIfAborted()
              const items = (args.items || []).map((item) => ({ ...item }))
              const id = sessionIdOf(exec),
                target = learnTarget(state, config)
              let run, emptyReason = ''
              if (args.batchId || (id && id === state.assistant.sessions.learn?.sessionId)) {
                run = activeReview(store, state, id)
                const review = state.learn.review
                if (
                  review.complete ||
                  !run.pending ||
                  run.pending.page.batchId !== args.batchId ||
                  run.pending.revision !== review.revision
                )
                  throw new Error('请先 read 当前批次，不能跳过未读内容或重复提交')
                if (!items.length && run.pending.page.messages.length) {
                  const reason = args.noLearning?.reason?.trim(), quote = args.noLearning?.quote?.trim()
                  if (!reason || !quote || !run.pending.page.messages.some((m) => m.text.includes(quote)))
                    throw new Error('空提交需要说明已读后不入册的原因并摘录末页原话；没有收到正文请重新 read，不会记作完成')
                  emptyReason = reason
                }
                for (const item of items) {
                  if (item.inboxId) {
                    const inbox = reviewInbox(state, review).find((x) => x.id === item.inboxId)
                    if (!inbox) throw new Error('收件箱条目不存在')
                    item.kind = 'question'
                    item.evidence = inbox.question
                    item.askedAt = inbox.createdAt
                    item.source = { harness: inbox.source, sessionId: inbox.sessionId }
                    continue
                  }
                  const row = deliveredMessage(review, run, item.messageKey)
                  if (!item.evidence?.trim() || !row.text.includes(item.evidence.trim()))
                    throw new Error('学习依据须摘录已读发言原文')
                  if (item.kind !== 'suggested' && row.role !== 'user')
                    throw new Error('助手发言不能当作用户的明确提问')
                  item.source = {
                    harness: row.source,
                    project: row.project,
                    sessionId: row.sessionId,
                    messageKey: row.key,
                  }
                  item.askedAt = row.at
                }
                const known = new Set(state.learn.entries.map((x) => x.key))
                const suggestions = new Set(
                  items
                    .filter((x) => x.kind === 'suggested')
                    .map((x) => dedupeKey(x.question))
                    .filter((key) => !known.has(key)),
                )
                if (review.suggested + suggestions.size > 3) throw new Error('本轮最多新增三个补学建议')
              }
              for (const item of items) {
                if (
                  item.kind === 'suggested' &&
                  (!String(item.evidence || '').trim() || !(item.parentIds?.length || item.source?.sessionId))
                )
                  throw new Error('补充学习建议必须提供原文依据及来源知识点或会话')
                validateLinks(state, '', item.parentIds || [], item.relatedIds || [])
              }
              const seen = new Set(state.learn.entries.map((row) => row.key).filter(Boolean))
              const invalid = items.some(
                (item) =>
                  !item.question?.trim() ||
                  !item.title?.trim() ||
                  !['weak', 'know', 'term'].includes(item.category) ||
                  !item.answer ||
                  item.answer.trim().length < 12,
              )
              if (invalid) throw new Error('每条学习笔记必须有原问题、标题、分类和至少 12 字的可复习答案')
              const consumeInboxIds = [],
                forOp = []
              let skipped = 0
              for (const item of items) {
                exec?.signal?.throwIfAborted()
                if (item.inboxId) consumeInboxIds.push(item.inboxId)
                const question = item.question.trim(),
                  answer = item.answer.trim(),
                  key = dedupeKey(question)
                if (!key || seen.has(key)) {
                  skipped++
                  continue
                }
                seen.add(key)
                const entry = {
                  key,
                  question,
                  answer,
                  title: item.title,
                  category: item.category,
                  concept: item.concept || '',
                  kind: item.kind,
                  evidence: item.evidence,
                  source: item.source || {},
                  askedAt: item.askedAt,
                  why: item.why || '',
                  parentIds: item.parentIds,
                  relatedIds: item.relatedIds,
                }
                const links = [...(item.parentIds || []), ...(item.relatedIds || [])]
                  .map((id) => state.learn.entries.find((row) => row.id === id))
                  .filter(Boolean)
                const note = await writeLearnNote(target, {
                  ...entry,
                  links,
                  date: item.askedAt ? localDateOf(item.askedAt) : undefined,
                })
                if (note.created) newNotes.push(join(target.vaultPath, note.path))
                forOp.push({ ...entry, note: answer, notePath: note.path, vaultPath: target.vaultPath })
              }
              exec?.signal?.throwIfAborted()
              let created = []
              if (forOp.length) {
                const applied = applyOps(state, [{ op: 'learn_write', items: forOp, consumeInboxIds }])
                if (applied.errors.length) throw new Error(applied.errors.join('；'))
                created = applied.results[0].created
              } else if (consumeInboxIds.length)
                state.learn.inbox = state.learn.inbox.filter((row) => !consumeInboxIds.includes(row.id))
              const progress = run ? acknowledgeReview(state, run, args.batchId, created, emptyReason) : undefined
              if (run) state.learn.review.reportDate = todayString()
              const report = await writeDailyReport(target, state, { addedToday: created, progress })
              return {
                ok: true,
                created,
                skipped,
                ...(progress && { progress }),
                reportPath: report.path,
                reportAbsolutePath: join(target.vaultPath, report.path),
              }
            },
            { undoable: !args.batchId && args.items?.length > 0 },
          )
          if (result.progress?.complete) exec?.concludeTurn?.()
          return result
        } catch (error) {
          // 只清理本次新建且没有成功登记的文件，不动已有笔记。
          if (newNotes.length) {
            const latest = await store.read()
            const saved = new Set(
              latest.learn.entries
                .filter((e) => e.vaultPath && e.notePath)
                .map((e) => join(e.vaultPath, e.notePath)),
            )
            for (const path of newNotes)
              if (!saved.has(path))
                await unlink(path).catch((err) => {
                  if (err.code !== 'ENOENT')
                    console.warn('workbench: 清理未提交的学习笔记失败', path, err.message)
                })
          }
          return { ok: false, error: error.message }
        }
      },
      presentCall: (args) => ({
        card: 'generic',
        title: `学习 · 写入 ${Array.isArray(args.items) ? args.items.length : 0} 条`,
        kind: 'other',
        rawInput: args,
      }),
    }),
  )

  registrations.push(ctx.tools.register({
    name: 'workbench_learn_capture',
    description: '把用户提到的知识性疑问/想学的概念一句话记进学习收件箱（待下次整理成笔记），一句话回执后继续当前工作，不展开、不切换上下文。用户说「记一下这个问题」「这个我要学」时调用。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['question'],
      properties: {
        question: { type: 'string', description: '问题或概念本身，保留用户原意。' },
        context: { type: 'string', description: '当时的上下文（在做什么、为什么问），可选。' },
      },
    },
    output: {
      schema: outputSchema({ id: { type: 'string' }, pending: { type: 'integer' } }, ['id', 'pending']),
      render: (_args, value) => textBlock(`学习提问已记录（待整理 ${value.pending} 条），继续当前任务。`),
    },
    async execute(args, exec) {
      const result = await store.mutate('记录学习提问', (draft) => applyOps(draft, [{
        op: 'learn_capture', question: args.question, context: args.context, sessionId: sessionIdOf(exec), source: 'chat',
      }]))
      const state = store.latest()
      return { id: state.learn.inbox[0]?.id ?? '', pending: state.learn.inbox.length }
    },
    presentCall: (args) => ({ card: 'generic', title: `学习 · 记录「${String(args.question).slice(0, 24)}」`, kind: 'other', rawInput: args }),
  }))

  registrations.push(ctx.tools.register({
    name: 'workbench_learn_decide',
    description: '处置一条学习条目：用户说「这个我已经掌握了/不用学了」时用 mastered，忽略用 ignored，重新待复习用 reopen。idOrTitle 传条目 id 或标题（模糊匹配）。会同步更新 Obsidian 笔记标记。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['idOrTitle', 'action'],
      properties: {
        idOrTitle: { type: 'string', description: '学习条目 id 或标题。' },
        action: { type: 'string', enum: ['mastered', 'ignored', 'reopen', 'reviewed'], description: 'mastered 已掌握 | ignored 忽略 | reopen 重新待复习 | reviewed 已复习，安排下次复习。' },
      },
    },
    output: {
      schema: outputSchema({ ok: { type: 'boolean' }, entry: { type: 'object', additionalProperties: true }, error: { type: 'string' } }, ['ok']),
      render: (_args, value) => textBlock(value.ok ? `学习条目「${value.entry?.title ?? ''}」已更新（${value.entry?.status ?? ''}）` : `处置失败：${value.error ?? '未知原因'}`),
    },
    async execute(args) {
      const state = await store.read()
      const key = String(args.idOrTitle ?? '').trim()
      const entry = state.learn.entries.find((row) => row.id === key)
        ?? state.learn.entries.find((row) => row.title === key)
        ?? state.learn.entries.find((row) => row.title.includes(key) || key.includes(row.title))
      if (!entry) return { ok: false, error: `没有找到学习条目「${key.slice(0, 40)}」` }
      const result = await store.mutate('处置学习条目', (draft) => applyOps(draft, [{ op: 'learn_decide', id: entry.id, action: args.action }]))
      if (result.errors.length) return { ok: false, error: result.errors.join('；') }
      // 同步 Obsidian frontmatter（文件被挪走时静默跳过）
      if (entry.notePath) {
        await updateNoteFields({ vaultPath: entry.vaultPath || learnTarget(store.latest(), config).vaultPath, notesDir: entry.notePath.split('/').slice(0, -1).join('/') }, entry.notePath, { mastered: args.action === 'mastered' })
      }
      const updated = store.latest().learn.entries.find((row) => row.id === entry.id)
      return { ok: true, entry: updated }
    },
    presentCall: (args) => ({ card: 'generic', title: `学习 · 处置「${String(args.idOrTitle).slice(0, 24)}」`, kind: 'other', rawInput: args }),
  }))

  return () => registrations.forEach((dispose) => dispose())
}

/** 学习模块的系统提示规则（prompts.js 注册时引用）。 */
export const LEARN_POLICY_TEXT = `# 学习记录（learn）

你有一个学习记录系统（自动收集各 AI 工具里的知识性提问，整理进 Obsidian）。行为规则：

- **随手记**：用户说「记一下这个问题」「这个我要学」时，调用 workbench_learn_capture 一句话记录，回执后继续当前任务；不要展开讲解，除非用户明确要现在弄懂。
- **主动整理**：用户要求「整理昨天」「重扫某天」时，立即 workbench_learn_collect(start:true, date:"yesterday" 或 YYYY-MM-DD)，传上用户指定的时段、项目、来源或会话，不用回工作台，也别用旧日报代替。没有指定日期或时段就不要猜；无范围且已有进度时续读。普通会话收到 dispatched 就停，由专用对话继续（busy 表示本次没启动）。
- **专用整理对话**：按启动 prompt 读取限定范围的可见问答；已附材料就直接用，不要重新 start。旧回执不能代替重读，读失败不许空交。仅在用户明确要求改范围时重开。
- 收件箱条目用 inboxId；相同概念去重或用 parentIds/relatedIds 关联。category 取 weak/know/term，三五句给出可独立复习的答案，不能确认的不要编造。
- **展开学习**：工作台创建的学习对话会自动保留真人提问及回答。每轮先回答，再用 workbench_learn_answer 保存精炼答案；不要把学习问题登记为工作任务。学习建议必须带依据，并和当前知识点关联。
- **掌握反馈**：用户说某概念已掌握时，workbench_learn_decide 标 mastered。`

export { LEARN_CATEGORY_LABELS }
