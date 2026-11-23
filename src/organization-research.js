import { messageKey, SCANNERS as scanners } from './learn/scan/index.js'
import { organizationSessionIds } from './organization-session.js'
import { calendarDate, openTask } from './planner.js'

export { messageKey }

const locations = {
  codex: '~/.codex/sessions 与 archived_sessions：用户消息、助手最终回复',
  dsh: '~/.dsh/sessions：用户及助手文本消息',
  claude: '~/.claude/projects：主对话的用户及助手文本消息',
  zcode: '~/.zcode/cli/db/db.sqlite：只读 message / part / session 表',
}
const pageSize = (n, fallback = 12) =>
  Number.isInteger(n) ? Math.max(1, Math.min(30, n)) : fallback
const offsetOf = (n) => (Number.isInteger(n) && n >= 0 ? n : 0)
const sessionRef = (source, sessionId) => `${source}:${sessionId}`
const normalize = (row) => ({
  ...row,
  role: row.role || 'user',
  key: messageKey(row),
})
const snippet = (text) =>
  String(text || '')
    .replace(/\s+/g, ' ')
    .slice(0, 180)

/** Build a local index, not a model payload. Only messages read through the tools
 * become admissible evidence, and only reviewed, fully delivered messages advance progress. */
export async function collectTaskResearch(
  state,
  { now = new Date(), scan = scanners } = {},
) {
  const seen = new Set(state.plan.organizer.processed)
  const excluded = organizationSessionIds(state)
  const until = now.toISOString(),
    sessions = new Map(),
    sourceRows = new Map(),
    scopes = []
  const collected = {
    messages: [],
    context: [],
    cursors: {},
    errors: [],
    inspected: [],
    deferred: 0,
  }
  const allowed = (row) =>
    Date.parse(row.at) <= now.getTime() &&
    !excluded.has(row.sessionId) &&
    !state.learn?.sessions?.[row.sessionId] &&
    !/^【(?:工作台 · 展开学习|学习整理|任务整理)/u.test(row.text)
  const dedupe = (rows) =>
    [
      ...new Map(
        rows.filter(allowed).map((row) => {
          const message = normalize(row)
          return [message.key, message]
        }),
      ).values(),
    ].sort((a, b) => a.at.localeCompare(b.at))
  const addSession = (source, sessionId, rows = [], pending = []) => {
    if (
      !sessionId ||
      excluded.has(sessionId) ||
      state.learn?.sessions?.[sessionId]
    )
      return
    const ref = sessionRef(source, sessionId)
    if (!sessions.has(ref))
      sessions.set(ref, {
        ref,
        source,
        sessionId,
        rows,
        pending,
        readKeys: new Set(),
      })
    return sessions.get(ref)
  }
  for (const source of Object.keys(scan).filter(
    (s) => state.plan.config.sources[s],
  )) {
    const since =
      state.plan.organizer.cursors[source] ||
      new Date(now.getTime() - 86400000).toISOString()
    scopes.push({
      source,
      since,
      until,
      location: locations[source],
      overlapMinutes: 5,
    })
    try {
      const rows = dedupe(
        await scan[source]({
          sinceMs: Date.parse(since) - 300000,
          includeAssistant: true,
          strict: true,
        }),
      )
      sourceRows.set(
        source,
        rows.filter((row) => !seen.has(row.key)),
      )
      const groups = new Map()
      for (const row of rows) {
        if (!row.sessionId) continue
        if (!groups.has(row.sessionId)) groups.set(row.sessionId, [])
        groups.get(row.sessionId).push(row)
      }
      for (const [id, messages] of groups) {
        const pending = messages.filter((m) => !seen.has(m.key))
        if (pending.length) addSession(source, id, messages, pending)
      }
    } catch (error) {
      collected.errors.push({ source, error: error.message })
    }
  }
  // Existing items may refer to an older conversation outside the incremental window.
  // It is addressable by exact ID without opening access to arbitrary files or sessions.
  for (const task of state.tasks.filter(openTask)) {
    for (const evidence of task.evidence || [])
      if (state.plan.config.sources[evidence.source] && scan[evidence.source])
        addSession(evidence.source, evidence.sessionId)
    const originSource =
      task.origin?.source || { chat: 'dsh', zcode: 'zcode' }[task.origin?.kind]
    if (task.origin?.sessionId && originSource && sourceRows.has(originSource))
      addSession(originSource, task.origin.sessionId)
  }
  for (const review of state.reviews.filter(
    (r) => r.kind === 'collaboration' && r.status === 'pending',
  )) {
    if (state.plan.config.sources[review.source] && scan[review.source])
      addSession(review.source, review.sessionId)
    for (const evidence of review.evidence || [])
      if (state.plan.config.sources[evidence.source] && scan[evidence.source])
        addSession(evidence.source, evidence.sessionId)
  }
  for (const note of state.ideas.filter((n) => n.status === 'parked')) {
    const row = normalize({
      source: '随手记',
      sessionId: '',
      noteId: note.id,
      role: 'user',
      text: note.text + (note.note ? '\n' + note.note : ''),
      at: note.createdAt,
      noteVersion: note.updatedAt || note.createdAt,
    })
    row.key = messageKey({ ...row, at: row.noteVersion })
    if (!seen.has(row.key)) {
      const ref = `note:${note.id}`
      sessions.set(ref, {
        ref,
        source: row.source,
        sessionId: '',
        rows: [row],
        pending: [row],
        full: [row],
        readKeys: new Set(),
      })
    }
  }
  const summary = (session) => ({
    ref: session.ref,
    source: session.source,
    sessionId: session.sessionId,
    project: session.rows[0]?.project || '',
    pendingMessages: session.pending.length,
    lastAt: session.rows.at(-1)?.at || null,
    request: snippet(session.rows.find((m) => m.role === 'user')?.text),
    latest: snippet(session.rows.at(-1)?.text),
    linkedCollaborationIds: state.reviews
      .filter(
        (r) =>
          r.kind === 'collaboration' &&
          r.source === session.source &&
          r.sessionId === session.sessionId,
      )
      .map((r) => r.id),
    linkedTaskIds: state.tasks
      .filter(
        (t) =>
          (t.origin?.sessionId === session.sessionId && session.sessionId) ||
          t.evidence?.some(
            (e) =>
              e.source === session.source &&
              e.sessionId === session.sessionId &&
              e.sessionId,
          ),
      )
      .map((t) => t.id),
  })
  const ordered = () =>
    [...sessions.values()].sort(
      (a, b) =>
        Number(!!b.pending.length) - Number(!!a.pending.length) ||
        (a.rows[0]?.at || '').localeCompare(b.rows[0]?.at || ''),
    )
  const expose = (row, text) => {
    const evidence = { ...row, text }
    const target = [...sessions.values()].some((s) =>
      s.pending.some((m) => m.key === row.key),
    )
      ? collected.messages
      : collected.context
    const existing = target.find((m) => m.key === row.key)
    if (!existing) target.push(evidence)
    else if (text.length > existing.text.length) existing.text = text
  }
  const load = async (ref) => {
    const session = sessions.get(ref)
    if (!session)
      throw new Error('对话不在本轮已启用来源和排查范围内，请先列出对话')
    if (!session.full) {
      try {
        session.full = dedupe(
          await scan[session.source]({
            sinceMs: 0,
            sessionId: session.sessionId,
            includeAssistant: true,
            strict: true,
          }),
        ).filter(
          (row) =>
            row.source === session.source &&
            row.sessionId === session.sessionId,
        )
        if (!session.full.length) {
          session.full = null
          throw new Error('未找到可读取的对话文本，不能据此判断事项已完成')
        }
      } catch (error) {
        session.error = error.message
        collected.errors.push({ source: session.ref, error: error.message })
        throw error
      }
    }
    return session
  }
  collected.research = {
    scope: {
      sources: scopes,
      until,
      sessions: sessions.size,
      note: '仅索引摘要；不是完成证据。不读取思考过程、工具输出或图片内容；缺少交付证据时保留待核实。',
    },
    setPlanning(value) {
      collected.planning = value
    },
    initial: ordered().slice(0, 12).map(summary),
    async inspect(args, store) {
      let value
      const commit = []
      if (args.action === 'sessions') {
        const rows = ordered().filter(
          (s) => !args.source || s.source === args.source,
        )
        const offset = offsetOf(args.offset),
          size = pageSize(args.limit)
        value = {
          sessions: rows.slice(offset, offset + size).map(summary),
          total: rows.length,
          nextOffset: offset + size < rows.length ? offset + size : null,
          errors: collected.errors,
        }
      } else if (args.action === 'collaborations') {
        const current = await store.read()
        const query = String(args.query || '').toLocaleLowerCase()
        const rows = current.reviews.filter(
          (r) =>
            r.kind === 'collaboration' &&
            (!args.id || r.id === args.id) &&
            (!args.status ||
              r.status === args.status ||
              (args.status === 'open' && r.status === 'pending')) &&
            (!query ||
              `${r.title}\n${r.summary}\n${r.project}`
                .toLocaleLowerCase()
                .includes(query)),
        )
        const offset = offsetOf(args.offset),
          size = pageSize(args.limit, 20)
        value = {
          collaborations: rows
            .slice(offset, offset + size)
            .map(({ originalTask, ...r }) => r),
          total: rows.length,
          nextOffset: offset + size < rows.length ? offset + size : null,
          readAt: new Date().toISOString(),
        }
      } else if (args.action === 'tasks') {
        const current = await store.read()
        const query = String(args.query || '').toLocaleLowerCase()
        const rows = current.tasks.filter(
          (t) =>
            (!args.id || args.id === t.id) &&
            (!args.status ||
              (args.status === 'open'
                ? openTask(t)
                : t.status === args.status)) &&
            (!query ||
              `${t.title}\n${t.note}\n${t.project}`
                .toLocaleLowerCase()
                .includes(query)),
        )
        const offset = offsetOf(args.offset),
          size = pageSize(args.limit, 20)
        value = {
          tasks: rows.slice(offset, offset + size).map((t) => ({
            ...t,
            note: t.note?.slice(0, 2000),
            evidence: t.evidence?.slice(-10),
            progress: t.progress?.slice(-10),
          })),
          total: rows.length,
          nextOffset: offset + size < rows.length ? offset + size : null,
          planning: collected.planning || null,
          slots: current.plan.config.slots,
          readAt: new Date().toISOString(),
        }
      } else if (args.action === 'read') {
        const session = await load(args.ref)
        let rows = session.full
        if (args.pendingOnly)
          rows = rows.filter(
            (m) =>
              session.pending.some((p) => p.key === m.key) && !seen.has(m.key),
          )
        if (args.key) rows = rows.filter((m) => m.key === args.key)
        const size = pageSize(args.limit),
          end =
            args.before === undefined
              ? rows.length
              : Math.min(rows.length, offsetOf(args.before))
        const start = Math.max(0, end - size),
          textOffset = offsetOf(args.textOffset)
        const messages = rows.slice(start, end).map((row) => {
          const text = row.text.slice(textOffset, textOffset + 6000)
          const existing = [...collected.messages, ...collected.context].find(
            (m) => m.key === row.key,
          )
          if (
            textOffset > 0 &&
            (!existing || existing.text.length < textOffset)
          )
            throw new Error(
              '请先从 textOffset=0 开始，沿 nextTextOffset 顺序读取长消息',
            )
          const evidenceText = textOffset
            ? existing.text.slice(0, textOffset) + text
            : text
          // Publish evidence only after every slice in the page validates.
          commit.push(() => {
            expose(row, evidenceText)
            if (evidenceText.length === row.text.length)
              session.readKeys.add(row.key)
          })
          return {
            ...row,
            text,
            textOffset,
            atLocalDate: calendarDate(
              new Date(row.at),
              state.plan.config.timezone,
            ),
            nextTextOffset:
              textOffset + text.length < row.text.length
                ? textOffset + text.length
                : null,
          }
        })
        value = {
          ref: session.ref,
          messages,
          total: rows.length,
          before: start || null,
          limitation: '仅对话文本，不能视为文件、部署或外部验收的独立核验。',
          unreadPending: session.pending.filter(
            (m) => !session.readKeys.has(m.key),
          ).length,
        }
      } else if (args.action === 'search') {
        const query = String(args.query || '')
          .trim()
          .toLocaleLowerCase()
        if (query.length < 2) throw new Error('请输入至少两个字符的检索词')
        const candidates = args.ref
          ? [await load(args.ref)]
          : ordered().filter((s) => !args.source || s.source === args.source)
        const hits = candidates.flatMap((s) =>
          (s.full || s.rows)
            .filter((m) => m.text.toLocaleLowerCase().includes(query))
            .map((m) => ({
              ref: s.ref,
              key: m.key,
              at: m.at,
              role: m.role,
              excerpt: snippet(
                m.text.slice(
                  Math.max(0, m.text.toLocaleLowerCase().indexOf(query) - 60),
                ),
              ),
            })),
        )
        const offset = offsetOf(args.offset),
          size = pageSize(args.limit)
        value = {
          hits: hits.slice(offset, offset + size),
          total: hits.length,
          nextOffset: offset + size < hits.length ? offset + size : null,
          scope: args.ref
            ? '指定完整对话'
            : '本轮增量索引和已读取对话；更早的内容请指定 ref 搜索',
          evidence: '搜索片段不是提交依据，请调用 read 读取原文',
        }
      } else throw new Error('未知检索动作')
      for (const apply of commit) apply()
      if (args.action === 'read') {
        const session = sessions.get(args.ref)
        value.unreadPending = session.pending.filter(
          (m) => !session.readKeys.has(m.key),
        ).length
      }
      collected.inspected.push({
        action: args.action,
        ref: args.ref,
        query: args.query,
        count:
          value.messages?.length ||
          value.tasks?.length ||
          value.collaborations?.length ||
          value.sessions?.length ||
          value.hits?.length ||
          0,
      })
      return value
    },
    finalize(reviewed = []) {
      const refs = new Set(reviewed)
      for (const ref of refs)
        if (!sessions.has(ref))
          throw new Error('核对列表包含不在本轮范围内的对话')
      const consumed = new Set()
      for (const session of sessions.values())
        if (refs.has(session.ref))
          for (const row of session.pending)
            if (session.readKeys.has(row.key)) consumed.add(row.key)
      collected.consumedKeys = [...consumed]
      collected.deferred = [...sessions.values()].reduce(
        (n, s) => n + s.pending.filter((m) => !consumed.has(m.key)).length,
        0,
      )
      for (const [source, rows] of sourceRows) {
        const firstUnread = rows.find((m) => !consumed.has(m.key))
        collected.cursors[source] = firstUnread?.at || until
      }
      return {
        pendingMessages: collected.deferred,
        reviewedSessions: refs.size,
      }
    },
  }
  return collected
}

export function registerResearchTool(ctx, store, collected, authorize) {
  if (!collected.research) return () => {}
  return ctx.tools.register({
    name: 'workbench_organize_inspect',
    description:
      '任务整理只读检索：sessions 分页列出范围内对话；read 读取原文（默认尾部，before 向前翻页，key+textOffset 读长消息）；search 搜索；tasks 实时查询当前事项，包含完成记录；collaborations 查询待协作和已处理记录，支持 id/query/status/offset。摘要不作为证据。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['runId', 'action'],
      properties: {
        runId: { type: 'string' },
        action: {
          type: 'string',
          enum: ['sessions', 'read', 'search', 'tasks', 'collaborations'],
        },
        ref: { type: 'string' },
        source: { type: 'string' },
        query: { type: 'string' },
        key: { type: 'string' },
        id: { type: 'string' },
        status: { type: 'string' },
        pendingOnly: { type: 'boolean' },
        offset: { type: 'integer', minimum: 0 },
        before: { type: 'integer', minimum: 0 },
        textOffset: { type: 'integer', minimum: 0 },
        limit: { type: 'integer', minimum: 1, maximum: 30 },
      },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    presentCall: (args) => ({
      card: 'generic',
      title:
        {
          sessions: '查看近期对话',
          read: '查阅对话原文',
          search: '搜索相关记录',
          tasks: '核对当前事项',
          collaborations: '核对待协作',
        }[args.action] || '查阅整理依据',
      kind: 'other',
    }),
    async execute(args, exec) {
      authorize(args, exec)
      const value = await collected.research.inspect(args, store)
      authorize(args, exec)
      return value
    },
  })
}
