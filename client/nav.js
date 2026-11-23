// 会话跳转与标题：宿主能力由 index.jsx 的 apply(ctx) 注入，UI 组件按需取用。
// 与 desk.js 一样走模块级单例，避免层层透传 props。
let opener = null
let labeler = null

/** 注入 uiWorkspace.openSession 与会话标题读取（读不到时保持降级显示）。 */
export function setNav({ openSession, sessionLabel } = {}) {
  opener = typeof openSession === 'function' ? openSession : null
  labeler = typeof sessionLabel === 'function' ? sessionLabel : null
}

/** 跳到某个会话（best effort，宿主没有该能力时静默）。 */
export function jumpToSession(sessionId) {
  if (!sessionId || !opener) return
  try {
    opener(sessionId)
  } catch {
    /* 打不开就算了 */
  }
}

/** 会话显示标题：优先宿主会话列表，取不到时回退 #id 前缀。 */
export function sessionTitle(sessionId) {
  if (!sessionId) return ''
  try {
    const title = labeler?.(sessionId)
    if (typeof title === 'string' && title) return title
  } catch {
    /* 保持回退 */
  }
  return `#${sessionId.slice(0, 6)}`
}
