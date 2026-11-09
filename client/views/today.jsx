// 「今天」视图：晨报卡 + 快速捕获 + 进行中/到期/焦点 + 今日完成。
import React from 'react'
import { captureIdea, addTask, localDateOf, localToday, setDesk, todaySections, useDesk } from '../desk.js'
import { t } from '../i18n.js'
import { Chip, Empty, Icon, TaskRow } from '../ui.jsx'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const SECTION_ICON = { doing: 'focus', due: 'calendar', focus: 'star' }

/** 晨报卡：零模型调用的当日汇总（昨完/到期/受阻/待验收），点击展开明细。 */
function BriefingCard({ state }) {
  const [open, setOpen] = React.useState(false)
  const now = new Date()
  const today = localToday(now)
  const yesterday = localToday(new Date(now.getTime() - 86_400_000))
  const doneYesterday = state.tasks.filter((row) => row.status === 'done' && row.completedAt && localDateOf(row.completedAt) === yesterday)
  const due = state.tasks.filter((row) => row.status !== 'done' && row.due && row.due <= today)
  const blocked = state.tasks.filter((row) => row.status === 'blocked')
  const pending = state.reviews.filter((row) => row.status === 'pending')
  const ideas = state.ideas.filter((row) => row.status === 'parked').length
  const hasNews = doneYesterday.length || due.length || blocked.length || pending.length
  if (!hasNews) return null
  const summary = [
    `${t('昨日完成')} ${doneYesterday.length}`,
    `${t('今天到期')} ${due.length}`,
    blocked.length ? `${t('受阻')} ${blocked.length}` : '',
    pending.length ? `${t('待验收')} ${pending.length}` : '',
    ideas ? `${t('灵感')} ${ideas}` : '',
  ].filter(Boolean).join(' · ')
  return React.createElement('div', { className: 'wb-brief' },
    React.createElement('div', {
      className: 'wb-brief-head', role: 'button', tabIndex: 0, onClick: () => setOpen(!open),
      onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open) } },
    },
      React.createElement(Icon, { name: 'calendar', size: 13 }),
      React.createElement('span', { className: 'wb-brief-date' }, `${today.slice(5)} ${t(WEEKDAYS[now.getDay()])}`),
      React.createElement('span', { className: 'wb-brief-summary' }, summary),
      React.createElement('span', { className: 'wb-count' }, open ? '−' : '+')),
    open ? React.createElement('div', { className: 'wb-brief-body' },
      doneYesterday.length ? React.createElement('p', null, `${t('昨日完成')} ${doneYesterday.length}：`, doneYesterday.map((row) => row.title).join('；')) : null,
      due.length ? React.createElement('p', null, `${t('今天到期')} ${due.length}：`, due.map((row) => `${row.title}${row.due < today ? t('（逾期）') : ''}`).join('；')) : null,
      blocked.length ? React.createElement('p', { className: 'is-warn' }, `${t('受阻')} ${blocked.length}：`, blocked.map((row) => row.title).join('；')) : null,
      pending.length ? React.createElement('p', null, `${t('待验收')} ${pending.length}`) : null) : null)
}

function Capture() {
  const kind = useDesk((s) => s.captureKind)
  const [text, setText] = React.useState('')
  const submit = async (event) => {
    event.preventDefault()
    const value = text.trim()
    if (!value) return
    setText('')
    if (kind === 'task') await addTask({ title: value, status: 'todo' }, `新建「${value.slice(0, 16)}」`)
    else await captureIdea(value)
  }
  return React.createElement('form', { className: 'wb-capture', onSubmit: submit },
    React.createElement('input', {
      value: text, onChange: (e) => setText(e.target.value), 'aria-label': t('记一句话，回车收进灵感收件箱'),
      placeholder: t('记一句话，回车收进灵感收件箱'),
    }),
    React.createElement('div', { className: 'wb-capture-kind', role: 'tablist' },
      ['idea', 'task'].map((id) => React.createElement('button', {
        key: id, type: 'button', role: 'tab', 'aria-selected': kind === id,
        className: kind === id ? 'is-on' : '', onClick: () => setDesk({ captureKind: id }),
      }, t(id === 'idea' ? '灵感' : '任务')))),
    React.createElement('button', { type: 'submit', className: 'wb-btn is-primary', disabled: !text.trim() },
      t(kind === 'idea' ? '收进收件箱' : '直接建任务')))
}

export function TodayView() {
  const state = useDesk((s) => s.state)
  const [showDone, setShowDone] = React.useState(false)
  const { sections, doneToday, today } = todaySections(state)
  return React.createElement('div', { className: 'wb-page' },
    React.createElement(BriefingCard, { state }),
    React.createElement(Capture, null),
    sections.length === 0 && !doneToday.length
      ? React.createElement(Empty, { text: t('今天还没有安排；对话里提到的事情会自动登记进来') })
      : null,
    sections.map((section) => React.createElement('section', { key: section.key, className: 'wb-section' },
      React.createElement('h3', null,
        React.createElement(Icon, { name: SECTION_ICON[section.key] ?? 'calendar', size: 14 }),
        t(section.title),
        React.createElement('span', { className: 'wb-count' }, section.tasks.length)),
      section.tasks.map((task) => React.createElement(TaskRow, { key: task.id, task, today })))),
    doneToday.length ? React.createElement('section', { className: 'wb-section' },
      React.createElement('h3', { onClick: () => setShowDone(!showDone), style: { cursor: 'pointer' } },
        React.createElement(Icon, { name: 'check', size: 14 }),
        t('今日完成 {n} 件', { n: doneToday.length }),
        React.createElement('span', { className: 'wb-count' }, showDone ? '−' : '+')),
      showDone ? doneToday.map((task) => React.createElement(TaskRow, { key: task.id, task, today })) : null) : null)
}
