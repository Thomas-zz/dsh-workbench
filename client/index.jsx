// dsh-workbench 浏览器半片：侧栏入口 + main 全局面板 + 会话内停靠条。
import React from 'react'
import { OrganizationStatus } from './organization-status.jsx'
import css from './styles.css'
import { ensurePolling, loadDesk, learnArm, refreshDesk, setDesk, todaySections, undo, useDesk } from './desk.js'
import { setLanguage, t } from './i18n.js'
import { setNav } from './nav.js'
import { SessionTasksCard } from './dock.jsx'
import { AssistantSettings, AssistantActivity } from './views/assistant.jsx'
import { LearnView } from './views/learn.jsx'
import { ProjectsView } from './views/planner.jsx'
import { PlannerView } from './views/personal-planner.jsx'
import { PersonalEditor } from './personal-editor.jsx'
import personalCss from './personal-plan.css'
import { FeedbackPanel, FeedbackIcon } from './feedback.jsx'
import feedbackCss from './feedback.css'
import { Empty, Icon, Toast } from './ui.jsx'

const PANEL_ID = 'workbench'

const VIEWS = { today: PlannerView, all: ProjectsView, activity: AssistantActivity, learn: LearnView }
const TABS = [
  ['today', '计划', 'calendar'],
  ['all', '项目', 'inbox'],
  ['learn', '学习', 'focus'],
  ['activity', '整理记录', 'history'],
]

export function Workbench() {
  const [entryDrafts] = React.useState(() => new Map())
  const [feedbackOpen, setFeedbackOpen] = React.useState(false)
  const refreshing = useDesk(s=>s.refreshing)
  const captureOpen = useDesk(s=>s.captureOpen)
  const assistantSettings = useDesk(s=>s.assistantSettings)
  const ready = useDesk((s) => Boolean(s.state))
  const error = useDesk((s) => s.error)
  const view = useDesk((s) => s.view)
  const canUndo = useDesk((s) => s.canUndo)
  const state = useDesk((s) => s.state)

  React.useEffect(() => { loadDesk(); return ensurePolling() }, [])

  const parkedIdeas = state?.ideas?.filter((row) => row.status === 'parked').length ?? 0
  const pendingLearn = state?.learn?.inbox?.length ?? 0
  const { sections } = state ? todaySections(state) : { sections: [] }
  const todayCount = sections.reduce((sum, section) => sum + section.tasks.length, 0)

  const Active = VIEWS[view] ?? PlannerView
  return React.createElement('div', { className: `wb-root wb-view-${view}` },
    React.createElement('style', null, css + personalCss + feedbackCss),
    React.createElement('header', { className: 'wb-topbar' },
      React.createElement('span', { className: 'wb-title' }, React.createElement(Icon, { name: 'check', size: 15 }), t('个人工作台')),
      React.createElement('nav', { className: 'wb-nav', 'aria-label': t('工作台面板') },
        TABS.map(([id, label]) => React.createElement('button', {
          key: id, type: 'button', className: view === id ? 'is-on' : '', 'aria-current': view === id ? 'page' : undefined,
          onClick: () => setDesk({ view: id, expandedId: null }),
        },
          t(label),
          id === 'today' && todayCount ? React.createElement('i', { className: 'wb-badge' }, todayCount) : null,

          id === 'learn' && pendingLearn ? React.createElement('i', { className: 'wb-badge is-warn' }, pendingLearn) : null))),
      React.createElement('span', { style: { flex: 1 } }),
      React.createElement(OrganizationStatus, {kind:'tasks'}),
      React.createElement(OrganizationStatus, {kind:'learn'}),
      React.createElement('button', { className: 'wb-global-capture', onClick:()=>setDesk({captureOpen:true}) }, '＋ 记录一下'),
      React.createElement('button', { className:'wb-global-settings', onClick:()=>setDesk({assistantSettings:true}) }, '助手设置'),
      canUndo ? React.createElement('button', { className:'wb-topbar-action', title:'撤销上一次工作台修改', onClick:undo }, React.createElement(Icon,{name:'undo',size:14}), '撤销') : null,
      React.createElement('button', { className:'wb-topbar-action', title:'重新读取工作台数据', disabled:refreshing, onClick:refreshDesk }, React.createElement(Icon,{name:'refresh',size:14}), refreshing ? '刷新中' : '刷新'),
      React.createElement('button', { className:'wb-feedback-entry', onClick:()=>setFeedbackOpen(true) }, React.createElement(FeedbackIcon), '问题反馈')),
    React.createElement('main', { className: 'wb-content' },
      error && !state
        ? React.createElement('div', { className: 'wb-page' },
          React.createElement('p', { className: 'wb-empty' }, t('工作台加载失败：{error}', { error })),
          React.createElement('button', { type: 'button', className: 'wb-btn', onClick: loadDesk }, t('重试')))
        : ready ? React.createElement(Active, { entryDrafts }) : React.createElement(Empty, { text: t('加载中…') })),
    captureOpen && state ? React.createElement(PersonalEditor,{close:()=>setDesk({captureOpen:false}),onSaved:()=>setDesk({view:'today',poolFocus:'backlog'})}) : null,
    assistantSettings && state ? React.createElement(AssistantSettings,{close:()=>setDesk({assistantSettings:false})}) : null,
    React.createElement(FeedbackPanel,{open:feedbackOpen,close:()=>setFeedbackOpen(false),view}),
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

  // /学习任务 指令：武装当前会话，下一条消息零成本记录为学习提问（Host pre-step 拦截）
  const commandUi = typeof ctx.get === 'function' ? ctx.get('commandUi') : undefined
  if (commandUi && typeof commandUi.register === 'function') {
    ctx.effect(() => commandUi.register({
      name: '学习任务',
      label: () => t('学习任务：下一条消息零成本记为学习提问'),
      description: () => t('开启后，本会话你发送的下一条消息会被直接记录为学习提问（不触发模型回复），记录会在每晚整理时写进 Obsidian。'),
      available: () => true,
      ui: {
        kind: 'action',
        run: (session) => {
          const sessionId = typeof session?.sessionId === 'string' ? session.sessionId : ''
          if (!sessionId) return
          void learnArm(sessionId, true)
        },
      },
    }), 'dsh-workbench: learn command')
  }

  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, Workbench))
  // 会话内未完结投影：卡片浮在对话区左上角，inject 回调按会话传参
  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register(
    { name: 'conversation.input.dock', id: 'workbench-open', order: 30, inject: (sessionId) => ({ sessionId: String(sessionId ?? '') }) },
    SessionTasksCard,
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
