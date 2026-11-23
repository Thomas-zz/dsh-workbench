import { dispatchOrganization } from '../organization-session.js'
import { calendarDate } from '../planner.js'
import { applyOps, todayString } from '../ops.js'
import {
  bindReview,
  installReview,
  initialMaterial,
  prepareReview,
  reviewProgress,
  progressText,
  reviewScopeText,
  REVIEW_GUIDE,
} from './review.js'
import { learnTarget, writeDailyReport } from './obsidian.js'

const TICK_MS = 60_000
export function buildLearnTrigger(
  review,
  { nightly = true, inbox = 0, material, timezone = 'Asia/Shanghai' } = {},
) {
  return [
    nightly ? `【学习整理 · ${todayString()}】` : '【学习整理】',
    reviewScopeText(review.scope, timezone),
    `来源：${review.scope.sources.join('、') || '无'}；${progressText(reviewProgress(review))}；学习收件箱 ${inbox} 条。`,
    REVIEW_GUIDE,
    ...(material ? [JSON.stringify(material)] : []),
  ].join('\n')
}

/**
 * 定时学习整理。
 * @param {object} ctx - 插件上下文。
 * @param {import('../store.js').Store} store
 * @param {{learnVaultPath?: string}} config - 行配置。
 * @returns {() => void} 注销函数
 */
export function startLearnNightly(ctx, store, config = {}) {
  const tick = async () => {
    let claimedDate = null
    try {
      const state = await store.read()
      if (!state.learn.config.reportPush || !learnTarget(state, config).vaultPath) return
      const now = new Date()
      const hour = Number(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: state.plan.config.timezone,
          hour: '2-digit',
          hourCycle: 'h23',
        }).format(now),
      )
      if (hour < state.learn.config.reportHour) return
      if (Date.parse(state.learn.flags.lastLearnAttemptAt || '') > Date.now() - 300000) return
      const today = calendarDate(now, state.plan.config.timezone)
      const binding = state.assistant.sessions.learn
      if (binding?.safetyHold || binding?.failureDate === today || state.learn.flags.lastLearnReportDate === today || state.learn.flags.lastLearnAttemptDate === today) return
      // 确认有执行路径后才占标记；多个 Host 进程里只有一个会继续。
      const won = await store.mutate(
        '标记学习整理',
        (draft) => {
          if (!draft.learn.config.reportPush || draft.learn.flags.lastLearnAttemptDate === today || draft.assistant.sessions.learn?.safetyHold) return false
          draft.learn.flags.lastLearnAttemptDate = today
          const result = applyOps(draft, [{ op: 'learn_flag_report', date: today }])
          return result.results[0]?.won === true
        },
        { undoable: false },
      )
      if (!won) return
      claimedDate = today
      const dispatched = await launchReview(ctx, store, {}, true, config)
      if (dispatched.busy) throw new Error('学习整理对话仍在执行，稍后重试')
    } catch (err) {
      if (claimedDate)
        await store.mutate(
          '学习整理启动失败',
          (draft) => {
            if (draft.learn.flags.lastLearnReportDate === claimedDate) draft.learn.flags.lastLearnReportDate = ''
            draft.learn.flags.lastLearnAttemptAt = new Date().toISOString()
          },
          { undoable: false },
        )
      console.error('workbench: 学习整理推送失败', err)
    }
  }

  const timer = setInterval(tick, TICK_MS)
  timer.unref?.()
  const kickoff = setTimeout(tick, 7_000) // 错开晨报的 5 秒补查
  kickoff.unref?.()
  return () => {
    clearInterval(timer)
    clearTimeout(kickoff)
  }
}

/** 手动整理与定时整理共用固定学习对话，不改变普通对话。 */
export function runLearnNow(ctx, store, options = {}) {
  return launchReview(ctx, store, options, false)
}

async function launchReview(ctx, store, options, nightly, config = {}) {
  const state = await store.read()
  const prepared = await prepareReview(state, options, undefined, nightly)
  const { review } = prepared
  const material = initialMaterial(state, prepared)
  const install = (draft) => installReview(draft, prepared)
  if (nightly && !review.sessions.length && !review.errors.length && !material.inbox.length) {
    await store.mutate(
      '完成空范围学习整理',
      async (draft) => {
        if (draft.learn.inbox.length) throw new Error('有新收件，稍后整理')
        install(draft)
        review.complete = true
        review.reportDate = todayString()
        const target = learnTarget(draft, config)
        await writeDailyReport(target, draft, { progress: reviewProgress(review) })
        if (!review.scope.custom) draft.learn.flags.lastCollectAt = review.scope.until
      },
      { undoable: false },
    )
    return { progress: reviewProgress(review) }
  }
  const dispatched = await dispatchLearn(
    ctx,
    store,
    buildLearnTrigger(review, {
      nightly,
      inbox: material.inbox.length,
      material,
      timezone: state.plan.config.timezone,
    }),
    async ({ requestId }) => {
      await store.mutate('登记学习阅读范围', install, { undoable: false })
      bindReview(store, prepared, requestId)
    },
    nightly,
  )
  return { ...dispatched, progress: reviewProgress(review), inbox: material.inbox.length }
}

export function dispatchLearn(ctx, store, text, beforeSend, automatic = false) {
  return dispatchOrganization(ctx, store, 'learn', text, { beforeSend, automatic })
}
