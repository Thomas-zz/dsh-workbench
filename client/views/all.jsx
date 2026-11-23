// 「全部」视图：按状态分组 + 过滤。
import React from 'react'
import { localToday, setDesk, useDesk } from '../desk.js'
import { t } from '../i18n.js'
import { Empty, TaskRow } from '../ui.jsx'

const GROUPS = [
  ['doing', '进行中', 'focus'],
  ['todo', '待办', 'inbox'],
  ['blocked', '受阻', 'flag'],
  ['done', '已完成', 'check'],
]

export function AllView() {
  const state = useDesk((s) => s.state)
  const filter = useDesk((s) => s.filter)
  const today = localToday()
  const needle = filter.trim().toLowerCase()
  const match = (row) => !needle
    || row.title.toLowerCase().includes(needle)
    || (row.note ?? '').toLowerCase().includes(needle)
    || (row.tags ?? []).some((tag) => tag.toLowerCase().includes(needle))
  const groups = GROUPS.map(([status, label]) => ({
    status, label, rows: state.tasks.filter((row) => row.status === status && match(row)),
  }))
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0)
  return React.createElement('div', { className: 'wb-page' },
    React.createElement('input', {
      className: 'wb-filter', value: filter, placeholder: t('搜索过滤…'),
      onChange: (e) => setDesk({ filter: e.target.value }),
    }),
    total === 0 ? React.createElement(Empty, { text: t('今天还没有安排；对话里提到的事情会自动登记进来') }) : null,
    groups.filter((group) => group.rows.length).map((group) => React.createElement('section', { key: group.status, className: 'wb-section' },
      React.createElement('h3', null, t(group.label), React.createElement('span', { className: 'wb-count' }, group.rows.length)),
      group.rows.map((task) => React.createElement(TaskRow, { key: task.id, task, today })))))
}
