// /学习任务 武装拦截：armed 会话的下一条消息被 agent/pre-step 截住，
// 原文直接进学习收件箱（零模型调用）。被 reject 的消息不会写入会话日志，
// 插件也不能自己写 user/message（会话格式要求首个模型可见事件是受保护的
// system/message），所以记录只进工作台 state，会话保持干净。
import { applyOps } from '../ops.js'

/** 从 pre-step payload 里取用户消息纯文本。 */
function extractText(messages) {
  if (!Array.isArray(messages)) return ''
  const parts = []
  for (const message of messages) {
    const blocks = Array.isArray(message?.content) ? message.content : []
    const text = blocks
      .filter((block) => block?.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join(' ')
    if (text.trim()) parts.push(text.trim())
  }
  return parts.join('\n').trim()
}

/**
 * @param {object} ctx - 插件上下文。
 * @param {import('../store.js').Store} store
 * @returns {() => void} 注销函数
 */
export function installLearnPrestep(ctx, store) {
  return ctx.on('agent/pre-step', async (payload, next) => {
    try {
      const sessionId = payload?.agent?.session?.id
      if (typeof sessionId !== 'string' || !sessionId) return next()
      const state = await store.read()
      if (!state.learn.armed[sessionId]) return next()
      const text = extractText(payload.messages)
      if (!text) return next()
      // 先落库再 reject：失败时走 next() 让消息按普通对话发送，绝不丢用户输入
      await store.mutate('学习任务记录', (draft) => applyOps(draft, [
        { op: 'learn_capture', question: text.slice(0, 2000), context: '/学习任务 拦截记录', sessionId, source: 'command' },
        { op: 'learn_arm', sessionId, on: false },
      ]))
      return { kind: 'reject' }
    } catch (err) {
      console.error('workbench: 学习任务拦截失败（按普通消息放行）', err)
      return next()
    }
  })
}
