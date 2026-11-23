import { LEARN_POLICY_TEXT } from './learn/tools.js'

// Task collection runs independently. Ordinary conversations receive no task
// bookkeeping instructions, per-step counts or review reminders.
export function registerPrompts(ctx) {
  return ctx.systemPrompt.section({ name: 'workbench:learning-policy', order: 3150, text: LEARN_POLICY_TEXT })
}
