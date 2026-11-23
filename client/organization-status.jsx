import React from 'react'
import { useDesk } from './desk.js'
import { jumpToSession } from './nav.js'

export function OrganizationStatus({ kind }) {
  const binding = useDesk((s) => s.state?.assistant?.sessions?.[kind])
  const pending = useDesk((s) => !!s.organizationPending?.[kind])
  const lease = useDesk(
    (s) => kind === 'tasks' && s.state?.plan?.organizer?.lease,
  )
  const run = useDesk(
    (s) => kind === 'tasks' && s.state?.plan?.organizer?.runs?.[0],
  )
  const busy = pending || !!lease || binding?.status === 'running'
  const failed =
    !busy && (binding?.status === 'error' || run?.status === 'error')
  const learningUnfinished = useDesk(s => kind === 'learn' && s.state?.learn?.review?.complete === false)
  if (!binding?.sessionId && !pending && !lease) return null
  const partial = !busy && (run?.status === 'partial' || learningUnfinished)
  const label = kind === 'tasks' ? '事项整理' : '学习整理'
  const status = busy
    ? '执行中'
    : failed
      ? '未完成'
      : partial
        ? '部分完成'
        : '已完成'
  return (
    <button
      className={`wb-organization-status ${busy ? 'is-running' : failed ? 'is-error' : ''}`}
      disabled={!binding?.sessionId}
      onClick={() => jumpToSession(binding.sessionId)}
      title={`${label} · ${status}${failed && binding?.error ? `：${binding.error}` : ''}，点击查看对话`}
      aria-label={`${label}${status}，查看对话`}
    >
      <span className="wb-organization-indicator" aria-hidden="true">
        {busy ? '' : failed ? '!' : '✓'}
      </span>
      <span aria-live="polite">
        {label}
        <small>{status}</small>
      </span>
      <span aria-hidden="true">↗</span>
    </button>
  )
}
