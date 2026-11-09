// 「收件箱」视图：待验收（自动收集，可展开看结果摘要）+ 灵感。
import React from 'react'
import { ago, decideReview, dropIdea, promoteIdea, useDesk } from '../desk.js'
import { sessionTitle } from '../nav.js'
import { t } from '../i18n.js'
import { Chip, Empty, Icon, KIND_LABEL, SessionChip } from '../ui.jsx'

function ReviewRow({ review }) {
  const [open, setOpen] = React.useState(false)
  const state = useDesk((s) => s.state)
  const task = review.taskId ? state?.tasks?.find((row) => row.id === review.taskId) : undefined
  return React.createElement('div', { className: `wb-review${open ? ' is-open' : ''}` },
    React.createElement('div', {
      className: 'wb-review-main', role: 'button', tabIndex: 0,
      onClick: () => setOpen(!open),
      onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open) } },
    },
      React.createElement('span', { className: 'wb-kind' }, t(KIND_LABEL[review.kind] ?? '后台任务')),
      React.createElement('span', { className: 'wb-review-title' }, review.title),
      React.createElement('span', { className: 'wb-meta' }, ago(review.createdAt)),
      review.sessionId ? React.createElement(SessionChip, { sessionId: review.sessionId, title: `${sessionTitle(review.sessionId)} · ${t('跳转会话')}` }) : null),
    open && (review.summary || task) ? React.createElement('div', { className: 'wb-review-detail' },
      task ? React.createElement('p', { className: 'wb-review-task' }, `${t('挂靠任务')}：${task.title}`) : null,
      review.summary ? React.createElement('p', { className: 'wb-review-summary' }, review.summary) : null) : null,
    React.createElement('div', { className: 'wb-review-actions' },
      React.createElement('button', { type: 'button', className: 'wb-btn', onClick: () => decideReview(review.id, 'accept') }, t('验收')),
      React.createElement('button', { type: 'button', className: 'wb-btn', onClick: () => decideReview(review.id, 'promote') }, t('转任务')),
      React.createElement('button', { type: 'button', className: 'wb-btn is-ghost', onClick: () => decideReview(review.id, 'dismiss') }, t('忽略'))))
}

function IdeaRow({ idea }) {
  const [open, setOpen] = React.useState(false)
  return React.createElement('div', { className: 'wb-idea' },
    React.createElement('div', {
      className: 'wb-idea-main', role: 'button', tabIndex: 0, onClick: () => setOpen(!open),
      onKeyDown: (e) => { if (e.key === 'Enter') setOpen(!open) },
    },
      React.createElement(Icon, { name: 'chat', size: 13 }),
      React.createElement('span', { className: 'wb-idea-text' }, idea.text),
      React.createElement('span', { className: 'wb-meta' }, ago(idea.createdAt), idea.source === 'chat' ? ` · ${t('来自对话')}` : '')),
    open && idea.note ? React.createElement('p', { className: 'wb-idea-note' }, idea.note) : null,
    React.createElement('div', { className: 'wb-review-actions' },
      React.createElement('button', { type: 'button', className: 'wb-btn', onClick: () => promoteIdea(idea.id) }, t('转任务')),
      React.createElement('button', { type: 'button', className: 'wb-btn is-ghost', onClick: () => dropIdea(idea.id) }, t('忽略'))))
}

export function InboxView() {
  const state = useDesk((s) => s.state)
  const pending = state.reviews.filter((row) => row.status === 'pending').sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  const parked = state.ideas.filter((row) => row.status === 'parked')
  return React.createElement('div', { className: 'wb-page' },
    React.createElement('section', { className: 'wb-section' },
      React.createElement('h3', null, React.createElement(Icon, { name: 'inbox', size: 14 }), t('待验收'),
        pending.length ? React.createElement(Chip, { tone: 'warn' }, pending.length) : null),
      pending.length
        ? pending.map((review) => React.createElement(ReviewRow, { key: review.id, review }))
        : React.createElement(Empty, { text: t('没有待验收，并行任务的结果完成后会自动出现在这里') })),
    React.createElement('section', { className: 'wb-section' },
      React.createElement('h3', null, React.createElement(Icon, { name: 'star', size: 14 }), t('灵感'),
        parked.length ? React.createElement(Chip, { tone: 'idle' }, parked.length) : null),
      parked.length
        ? parked.map((idea) => React.createElement(IdeaRow, { key: idea.id, idea }))
        : React.createElement(Empty, { text: t('灵感收件箱是空的') })))
}
