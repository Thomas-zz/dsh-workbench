// 系统提示：静态行为规则（section）+ 每步刷新的活状态（context）。
import { countsOf } from './ops.js'
import { LEARN_POLICY_TEXT } from './learn/tools.js'

const POLICY_TEXT = `# 个人工作台（workbench）

你有一个跨会话共享的个人工作台，通过工具读写。行为规则：

- **自动登记**：用户在对话中提出新任务、答应要做的事、给出新的待办需求时，调用 workbench_add 登记（标题自动拟好），一句话回执后继续当前工作；不要反复确认。
- **状态同步**：任务被完成、开始、受阻或改期时，调用 workbench_update 同步（完成传 status: done）。
- **进展挂靠**：本会话开始执行某条工作台任务、推进到新环节、或把任务派给子代理/工作流时，调用 workbench_update 传 patch.progress 一句话记录（如「已开始整理大纲」「已派出子代理抓取数据」）。任务下会形成「谁在执行、做到哪」的时间线，用户以老板视角查看。
- **停靠灵感**：对话中出现与当前任务无关的灵光一现（用户提起或你自己想到），调用 workbench_capture_idea 一句话停靠，然后继续原任务；不要顺着灵感切换上下文，除非用户明确要求现在就做。
- **查询优先**：用户问今天做什么、什么没做完、待验收有什么、灵感有哪些时，先 workbench_query 再回答；给建议时按「待验收 → 今天到期 → 受阻 → 进行中」排序。
- **收拢验收**：每回合收尾前，若运行时上下文显示待验收 > 0，主动向用户提一句（或直接代为查看并处置：workbench_review）。
- 并行做多件事是常态：允许同时存在多个 doing，不要催用户聚焦到单一任务。

${LEARN_POLICY_TEXT}`

function statusText(state) {
  if (!state) return ''
  const counts = countsOf(state)
  if (counts.pendingReviews === 0 && counts.doing === 0 && counts.todo === 0 && counts.parkedIdeas === 0 && counts.dueToday === 0 && counts.blocked === 0) return ''
  const lines = []
  lines.push(`工作台：进行中 ${counts.doing} · 待办 ${counts.todo}${counts.blocked ? ` · 受阻 ${counts.blocked}` : ''}${counts.dueToday ? ` · 今日到期 ${counts.dueToday}` : ''} · 今日完成 ${counts.doneToday}`)
  if (counts.pendingReviews) {
    const age = counts.oldestReviewAgeMin === null ? '' : counts.oldestReviewAgeMin >= 60 ? `（最早已等 ${Math.round(counts.oldestReviewAgeMin / 60)} 小时）` : `（最早已等 ${counts.oldestReviewAgeMin} 分钟）`
    lines.push(`待验收 ${counts.pendingReviews} 条${age}：子代理/工作流/后台任务的结果在等确认，收尾前提醒用户或代为处置`)
  }
  if (counts.parkedIdeas) lines.push(`灵感收件箱 ${counts.parkedIdeas} 条`)
  return lines.join('\n')
}

/** 注册提示片段与活状态上下文；返回注销函数。 */
export function registerPrompts(ctx, store) {
  const disposers = []
  disposers.push(ctx.systemPrompt.section({
    name: 'workbench:policy',
    order: 3150,
    text: POLICY_TEXT,
  }))
  disposers.push(ctx.systemPrompt.context({
    name: 'workbench:status',
    order: 126,
    text: () => {
      // 异步刷新缓存（外部进程可能改过 state.json），下一步就能看到最新计数
      store.read().catch(() => {})
      return statusText(store.latest())
    },
  }))
  return () => disposers.forEach((dispose) => dispose())
}
