// 会话内未完结投影：锚定在对话区消息列表左上角的浮动卡片，显示本会话名下还没做完的工作台任务。
import React from 'react'
import css from './styles.css'
import { ensurePolling, refreshQuiet, setTaskStatus, useDesk } from './desk.js'
import { t } from './i18n.js'

const MAX_ROWS = 4
const COLLAPSE_KEY = 'wb.dockCollapsed'

/** 本会话「名下」的未完结任务：origin 是它，或 progress 里出现过它。 */
function owedTasks(state, sessionId) {
  if (!state || !sessionId) return []
  return state.tasks.filter((row) => row.status !== 'done'
    && (row.origin?.sessionId === sessionId || (row.progress ?? []).some((entry) => entry.sessionId === sessionId)))
}

/**
 * 浮窗锚点：对话区滚动容器。宿主契约里消息列表与输入区（含本卡片）同在
 * `[data-conversation-scroll]` 里，取它的左上角定位即可。拿不到（宿主改版）
 * 时返回 null，卡片退化为原位停靠条。
 */
function findAnchorEl(dockEl) {
  return dockEl?.closest?.('[data-conversation-scroll]') ?? null
}

/** 悬浮卡片：可收起成小胶囊，收起状态记在 localStorage。 */
export function SessionTasksCard({ sessionId }) {
  const state = useDesk((s) => s.state)
  const [collapsed, setCollapsed] = React.useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
  })
  // mode: measure=定位中（卡片先隐藏）；float=已定位；fallback=宿主契约失效，退化为原位停靠条
  const [mode, setMode] = React.useState('measure')
  const [anchor, setAnchor] = React.useState(null) // 相对实际包含块的 left/top
  const rootRef = React.useRef(null)
  const cardRef = React.useRef(null)

  React.useEffect(() => {
    // 卡片可能先于面板出现（面板没打开时也要有数据），挂载即拉一次并保持轮询
    refreshQuiet()
    return ensurePolling()
  }, [])

  const owed = owedTasks(state, sessionId)
  const hasTasks = owed.length > 0

  // 定位到消息区左上角。注意 position:fixed 的实际包含块未必是视口：宿主把
  // composerSeat 设了 will-change:transform，它会接管 fixed 后代的定位。所以
  // 不假设包含块是谁，直接读卡片 offsetParent（浏览器给出的真实包含块），
  // 把锚点视口坐标换算成相对包含块的坐标——有没有劫持都自洽。
  React.useEffect(() => {
    const root = rootRef.current
    if (!hasTasks || !root) return
    const measure = () => {
      const card = cardRef.current
      const scroller = findAnchorEl(root)
      if (!card || !scroller) return
      const rect = scroller.getBoundingClientRect()
      const cb = card.offsetParent
      const cbRect = cb ? cb.getBoundingClientRect() : { left: 0, top: 0 }
      const cbLeft = cbRect.left + (cb?.clientLeft ?? 0)
      const cbTop = cbRect.top + (cb?.clientTop ?? 0)
      const next = { left: Math.round(rect.left + 12 - cbLeft), top: Math.round(rect.top + 12 - cbTop) }
      setMode((current) => (current === 'fallback' ? current : 'float'))
      setAnchor((prev) => (prev && Math.abs(prev.left - next.left) < 1 && Math.abs(prev.top - next.top) < 1 ? prev : next))
      // 包含块或锚点尺寸变化（侧栏伸缩、窗口缩放）时跟随重定位
      if (scroller !== observed) { observed = scroller; observer.observe(scroller) }
      if (cb && cb !== cbObserved) { cbObserved = cb; observer.observe(cb) }
    }
    const observer = new ResizeObserver(() => measure())
    let observed = null
    let cbObserved = null
    measure()
    const timers = [setTimeout(measure, 300), setTimeout(measure, 900)]
    // 迟迟拿不到锚点（宿主改版）→ 退化为原位停靠条
    const giveUp = setTimeout(() => setMode((current) => (current === 'float' ? current : 'fallback')), 1200)
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(giveUp)
      window.removeEventListener('resize', onResize)
      observer.disconnect()
    }
  }, [hasTasks])

  if (!owed.length) return null
  const shown = owed.slice(0, MAX_ROWS)
  const rest = owed.length - shown.length

  const checkButton = (task) => React.createElement('button', {
    type: 'button', className: 'wb-dock-done', title: t('完成「{title}」', { title: task.title }),
    'aria-label': t('完成「{title}」', { title: task.title }),
    onClick: () => setTaskStatus(task.id, 'done', task.title),
  }, '✓')

  const head = React.createElement('button', {
    type: 'button', className: 'wb-float-head', 'aria-expanded': !collapsed,
    title: collapsed ? t('展开') : t('收起'),
    onClick: () => setCollapsed((value) => {
      const next = !value
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch { /* 私有模式忽略 */ }
      return next
    }),
  },
    React.createElement('span', { className: 'wb-float-label' }, t('工作台 {n}', { n: owed.length })),
    React.createElement('span', { className: 'wb-float-chevron', 'aria-hidden': true }, collapsed ? '▸' : '▾'))

  return React.createElement('div',
    { ref: rootRef, style: mode === 'float' ? { height: 0 } : undefined },
    React.createElement('style', null, css),
    mode !== 'fallback'
      ? React.createElement('div',
        {
          ref: cardRef,
          className: `wb-float${collapsed ? ' is-collapsed' : ''}`,
          style: anchor ? { left: anchor.left, top: anchor.top } : { visibility: 'hidden' },
        },
        head,
        !collapsed ? React.createElement('div', { className: 'wb-float-list' },
          shown.map((task) => React.createElement('div', { key: task.id, className: 'wb-float-row' },
            checkButton(task),
            React.createElement('span', { className: 'wb-float-title', title: task.title }, task.title))),
          rest > 0 ? React.createElement('span', { className: 'wb-float-more' }, `+${rest}`) : null) : null)
      // 宿主改版找不到消息区锚点时，退化为输入框上方的原位停靠条
      : React.createElement('div', { className: 'wb-dock' },
        React.createElement('span', { className: 'wb-dock-label' }, t('工作台 {n}', { n: owed.length })),
        shown.map((task) => React.createElement('span', { key: task.id, className: 'wb-dock-item' },
          checkButton(task),
          React.createElement('span', { className: 'wb-dock-title', title: task.title }, task.title))),
        rest > 0 ? React.createElement('span', { className: 'wb-dock-item is-more' }, `+${rest}`) : null))
}
