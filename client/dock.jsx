// 会话内未完结投影：挂在对话输入区的停靠条，显示本会话名下还没做完的工作台任务。
import React from 'react'
import { ensurePolling, refreshQuiet, setTaskStatus, useDesk } from './desk.js'
import { t } from './i18n.js'

const MAX_CHIPS = 4

/** 本会话「名下」的未完结任务：origin 是它，或 progress 里出现过它。 */
function owedTasks(state, sessionId) {
  if (!state || !sessionId) return []
  return state.tasks.filter((row) => row.status !== 'done'
    && (row.origin?.sessionId === sessionId || (row.progress ?? []).some((entry) => entry.sessionId === sessionId)))
}

export function SessionTasksBar({ sessionId }) {
  const state = useDesk((s) => s.state)
  React.useEffect(() => {
    // dock 可能先于面板出现（面板没打开时也要有数据），挂载即拉一次并保持轮询
    refreshQuiet()
    return ensurePolling()
  }, [])
  const owed = owedTasks(state, sessionId)
  if (!owed.length) return null
  const shown = owed.slice(0, MAX_CHIPS)
  const rest = owed.length - shown.length
  return React.createElement('div', { className: 'wb-dock' },
    React.createElement('span', { className: 'wb-dock-label' }, t('工作台 {n}', { n: owed.length })),
    shown.map((task) => React.createElement('span', { key: task.id, className: 'wb-dock-item' },
      React.createElement('button', {
        type: 'button', className: 'wb-dock-done', title: t('完成「{title}」', { title: task.title }),
        'aria-label': t('完成「{title}」', { title: task.title }),
        onClick: () => setTaskStatus(task.id, 'done', task.title),
      }, '✓'),
      React.createElement('span', { className: 'wb-dock-title', title: task.title }, task.title))),
    rest > 0 ? React.createElement('span', { className: 'wb-dock-item is-more' }, `+${rest}`) : null)
}
