// dsh-workbench 浏览器半片：侧栏入口 + main 全局面板 + 会话内停靠条。
import React from 'react'
import css from './styles.css'
import { ensurePolling, loadDesk, refreshQuiet, setDesk, todaySections, undo, useDesk } from './desk.js'
import { setLanguage, t } from './i18n.js'
import { setNav } from './nav.js'
import { SessionTasksBar } from './dock.jsx'
import { AllView } from './views/all.jsx'
import { InboxView } from './views/inbox.jsx'
import { TodayView } from './views/today.jsx'
import { Empty, IconButton, Icon, Toast } from './ui.jsx'

const PANEL_ID = 'workbench'

const VIEWS = { today: TodayView, all: AllView, inbox: InboxView }
const TABS = [
  ['today', '今天', 'calendar'],
  ['all', '全部', 'inbox'],
  ['inbox', '收件箱', 'star'],
]

function Workbench() {
  const ready = useDesk((s) => Boolean(s.state))
  const error = useDesk((s) => s.error)
  const view = useDesk((s) => s.view)
  const canUndo = useDesk((s) => s.canUndo)
  const state = useDesk((s) => s.state)

  React.useEffect(() => { loadDesk(); return ensurePolling() }, [])

  const pendingReviews = state?.reviews?.filter((row) => row.status === 'pending').length ?? 0
  const parkedIdeas = state?.ideas?.filter((row) => row.status === 'parked').length ?? 0
  const { sections, doneToday, today } = state ? todaySections(state) : { sections: [], doneToday: [], today: '' }
  const todayCount = sections.reduce((sum, section) => sum + section.tasks.length, 0)

  const Active = VIEWS[view] ?? TodayView
  return React.createElement('div', { className: 'wb-root' },
    React.createElement('style', null, css),
    React.createElement('header', { className: 'wb-topbar' },
      React.createElement('span', { className: 'wb-title' }, React.createElement(Icon, { name: 'check', size: 15 }), t('个人工作台')),
      React.createElement('nav', { className: 'wb-nav', 'aria-label': t('工作台面板') },
        TABS.map(([id, label]) => React.createElement('button', {
          key: id, type: 'button', className: view === id ? 'is-on' : '', 'aria-current': view === id ? 'page' : undefined,
          onClick: () => setDesk({ view: id, expandedId: null }),
        },
          t(label),
          id === 'today' && todayCount ? React.createElement('i', { className: 'wb-badge' }, todayCount) : null,
          id === 'inbox' && pendingReviews ? React.createElement('i', { className: 'wb-badge is-warn' }, pendingReviews) : null))),
      React.createElement('span', { style: { flex: 1 } }),
      canUndo ? React.createElement(IconButton, { icon: 'undo', label: t('撤销'), onClick: undo }) : null,
      React.createElement(IconButton, { icon: 'refresh', label: t('刷新'), onClick: refreshQuiet })),
    React.createElement('div', { className: 'wb-strip' },
      `${t('今天')} ${todayCount} · ${t('进行中')} ${state?.tasks?.filter((row) => row.status === 'doing').length ?? 0} · ${t('今日完成 {n} 件', { n: doneToday.length })}`
      + (pendingReviews ? ` · ${t('待验收')} ${pendingReviews}` : '')
      + (parkedIdeas ? ` · ${t('灵感')} ${parkedIdeas}` : '')),
    React.createElement('main', { className: 'wb-content' },
      error && !state
        ? React.createElement('div', { className: 'wb-page' },
          React.createElement('p', { className: 'wb-empty' }, t('工作台加载失败：{error}', { error })),
          React.createElement('button', { type: 'button', className: 'wb-btn', onClick: loadDesk }, t('重试')))
        : ready ? React.createElement(Active, null) : React.createElement(Empty, { text: t('加载中…') })),
    React.createElement(Toast, null))
}

function PanelIcon({ size }) {
  return React.createElement(Icon, { name: 'inbox', size })
}

export const inject = ['slots']

export function apply(ctx) {
  // 会话跳转与标题（照 offpeak-queue 的 best-effort 写法，服务不可用时降级为 #id 显示）
  const openSession = (sessionId) => {
    try {
      const workspace = (typeof ctx.get === 'function' ? ctx.get('uiWorkspace') : undefined) || (typeof ctx.uiWorkspace === 'object' ? ctx.uiWorkspace : undefined)
      if (workspace && typeof workspace.openSession === 'function') {
        workspace.openSession(sessionId)
        return
      }
      console.warn('[dsh-workbench] uiWorkspace 服务不可用，无法跳转会话')
    } catch (error) {
      console.warn('[dsh-workbench] 跳转会话失败：', error)
    }
  }
  const sessionLabel = (sessionId) => {
    try {
      const sessions = typeof ctx.get === 'function' ? ctx.get('sessions') : undefined
      const entry = sessions?.list?.getSnapshot?.()?.byId?.[sessionId]
      const title = typeof entry?.displayTitle === 'string' ? entry.displayTitle : typeof entry?.title === 'string' ? entry.title : ''
      return title
    } catch {
      return ''
    }
  }
  setNav({ openSession, sessionLabel })

  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, Workbench))
  // 会话内未完结投影：停靠在对话输入区，inject 回调按会话传参
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register(
    { name: 'conversation.input.dock', id: 'workbench-open', order: 30, inject: (sessionId) => ({ sessionId: String(sessionId ?? '') }) },
    SessionTasksBar,
  ))
  ctx.effect(() => {
    let release = null
    const mount = () => {
      release?.()
      release = ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: PANEL_ID,
        order: 5,
        label: () => t('个人工作台'),
      }, PanelIcon))
    }
    mount()
    // 跟随宿主语言：能拿到 locale 服务就读一次（重新挂载侧栏入口以刷新标签）。
    try {
      const locale = ctx.get('locale')
      if (locale && typeof locale.getLocale === 'function') {
        const snapshot = locale.getLocale()
        setLanguage(snapshot?.id ?? snapshot)
      }
    } catch { /* 保持中文 */ }
    return () => { release?.() }
  }, 'dsh-workbench: sidebar entry')
}
