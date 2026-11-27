import { createHash } from 'node:crypto'
import { applyOps } from './ops.js'

const normalized = (text) =>
  String(text || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase()
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** Collaboration actions have no dates and never enter the planner's task array. */
export function applyCollaborations(
  draft,
  base,
  collected,
  proposals,
  personalOwnership,
) {
  const counts = {
    collaborationAdded: 0,
    collaborationResolved: 0,
    collaborationMoved: 0,
  }
  const affected = [],
    skipped = []
  if (['schedule', 'estimate', 'pool'].includes(collected.mode))
    return { counts, affected, skipped }
  const messages = new Map(
    [...collected.messages, ...(collected.context || [])].map((m) => [
      m.key,
      m,
    ]),
  )
  const fresh = new Map(collected.messages.map((m) => [m.key, m]))
  for (const proposal of proposals) {
    const id = proposal?.id || proposal?.taskId
    const label = {
      id: typeof id === 'string' ? id : undefined,
      title: typeof proposal?.title === 'string' ? proposal.title : undefined,
    }
    const evidence = (
      Array.isArray(proposal?.evidenceKeys) ? proposal.evidenceKeys : []
    )
      .map((key) => messages.get(key))
      .filter(Boolean)
    if (!evidence.length) {
      skipped.push({
        ...label,
        reason: '没有可核对的来源依据',
        needsReview: true,
      })
      continue
    }
    // An operation validation error rejects this proposal; storage errors still fail the run.
    const apply = (op) => {
      const result = applyOps(draft, [op])
      if (!result.errors.length) return result
      skipped.push({
        ...label,
        reason: result.errors.join('；'),
        needsReview: true,
      })
      return null
    }
    const record = (review, action) =>
      affected.push({
        id: review.id,
        title: review.title,
        action,
        evidenceKeys: evidence.map((m) => m.key),
      })
    if (proposal.id) {
      const review = draft.reviews.find(
        (r) => r.id === proposal.id && r.kind === 'collaboration',
      )
      const original = base.reviews.find((r) => r.id === proposal.id)
      if (!review || review.status !== 'pending' || !same(review, original)) {
        skipped.push({
          ...label,
          reason: '条目已处理或在整理期间发生变化',
        })
        continue
      }
      // A later message from the same conversation must establish resolution.
      if (
        !['accepted', 'dismissed'].includes(proposal.status) ||
        !evidence.some(
          (m) =>
            m.sessionId === review.sessionId &&
            m.source === review.source &&
            Date.parse(m.at) >
              Math.max(
                ...(review.evidence || []).map((e) => Date.parse(e.at) || 0),
                0,
              ) &&
            typeof proposal.resolutionQuote === 'string' &&
            proposal.resolutionQuote.length >= 4 &&
            m.text.includes(proposal.resolutionQuote),
        )
      ) {
        skipped.push({ id: review.id, reason: '缺少对应对话的后续处理证据' })
        continue
      }
      if (
        !apply({ op: 'decide_review', id: review.id, action: proposal.status })
      )
        continue
      counts.collaborationResolved++
      record(review, proposal.status)
      continue
    }
    if (proposal.taskId) {
      const task = draft.tasks.find((t) => t.id === proposal.taskId)
      const original = base.tasks.find((t) => t.id === proposal.taskId)
      // Only untouched automatic pool entries may be reclassified automatically.
      // Manual and scheduled items require the explicit UI action.
      if (
        !task ||
        !same(task, original) ||
        task.origin?.kind !== 'auto' ||
        task.kind !== 'action' ||
        task.plannedDate ||
        task.plannedWeek ||
        Number.isFinite(task.startMinute) ||
        Object.keys(task.userFields || {}).length ||
        ['done', 'cancelled', 'paused'].includes(task.status) ||
        !evidence.some(
          (m) =>
            m.sessionId === task.origin?.sessionId &&
            m.source === task.origin?.source,
        )
      ) {
        skipped.push({
          ...label,
          reason: '保留已安排、手动修改或缺少关联证据的事项，可手动移到待协作',
        })
        continue
      }
      const result = apply({ op: 'move_to_collaboration', id: task.id })
      if (!result) continue
      const review = draft.reviews.find((r) => r.id === result.targets[0])
      counts.collaborationMoved++
      record(review, 'moved')
      continue
    }
    if (proposal.status && proposal.status !== 'pending') continue
    const ownership = personalOwnership(proposal, fresh)
    if (
      !ownership ||
      typeof proposal.title !== 'string' ||
      !proposal.title.trim()
    ) {
      skipped.push({
        ...label,
        reason: '缺少新的本人协作请求或责任依据',
        needsReview: true,
      })
      continue
    }
    const source = fresh.get(ownership.evidenceKey)
    const stillRelevant = (task) =>
      !['done', 'cancelled'].includes(task.status) ||
      !(Date.parse(source.at) > Date.parse(task.completedAt || task.updatedAt))
    const project =
      typeof proposal.project === 'string' ? proposal.project.trim() : ''
    const related = draft.reviews.filter(
      (r) =>
        r.kind === 'collaboration' &&
        normalized(r.title) === normalized(proposal.title) &&
        normalized(r.project) === normalized(project),
    )
    if (
      related.some(
        (r) =>
          r.status === 'pending' ||
          (r.promotedTaskId &&
            draft.tasks.some(
              (t) => t.id === r.promotedTaskId && stillRelevant(t),
            )) ||
          Date.parse(source.at) <= Date.parse(r.decidedAt),
      )
    )
      continue
    if (
      draft.tasks.some(
        (t) =>
          normalized(t.title) === normalized(proposal.title) &&
          normalized(t.project) === normalized(project) &&
          stillRelevant(t),
      )
    ) {
      skipped.push({
        title: proposal.title,
        reason: '已有同名事项，请核对现有条目',
      })
      continue
    }
    const dedupeKey =
      'collaboration:' +
      createHash('sha256')
        .update(
          [
            source.source,
            source.sessionId,
            ownership.evidenceKey,
            normalized(proposal.title),
          ].join('\n'),
        )
        .digest('hex')
    const result = apply({
      op: 'add_review',
      kind: 'collaboration',
      title: proposal.title,
      summary: proposal.summary,
      project,
      source: source.source,
      sessionId: source.sessionId,
      ownership,
      dedupeKey,
      evidence: evidence.map(({ key, source, role, sessionId, at, text }) => ({
        key,
        source,
        role,
        sessionId,
        at,
        quote: text.slice(0, 500),
      })),
    })
    if (result && !result.results[0].deduped) {
      counts.collaborationAdded++
      record(
        draft.reviews.find((r) => r.id === result.targets[0]),
        'created',
      )
    }
  }
  return { counts, affected, skipped }
}
