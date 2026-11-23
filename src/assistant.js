import { calendarDate, weekOf } from './planner.js'

// One model selection shared by task planning and learning organization.
export function modelSelection(value) {
  return value?.provider && value?.model
    ? { provider: String(value.provider), model: String(value.model) }
    : null
}
export function initializeAssistant(state, source = {}) {
  const model = Object.hasOwn(source.assistant || {}, 'model')
    ? modelSelection(source.assistant.model)
    : modelSelection(
        source.learn?.config?.organizeModel || source.plan?.config?.model,
      )
  state.assistant = {
    model,
    reasoningEffort:
      source.assistant?.reasoningEffort ||
      source.assistant?.model?.reasoningEffort ||
      source.learn?.config?.organizeModel?.reasoningEffort ||
      null,
    automaticModel: modelSelection(source.assistant?.automaticModel),
    sessionPeriod:
      source.assistant?.sessionPeriod === 'monthly' ? 'monthly' : 'weekly',
    retiredSessions: Array.isArray(source.assistant?.retiredSessions)
      ? source.assistant.retiredSessions.filter((id) => typeof id === 'string')
      : [],
    sessions: Object.fromEntries(
      Object.entries(source.assistant?.sessions || {})
        .filter(
          ([kind, row]) =>
            ['tasks', 'learn'].includes(kind) &&
            typeof row?.sessionId === 'string',
        )
        .map(([kind, row]) => [kind, { ...row }]),
    ),
  }
  state.learn.config.organizeModel = model
  if (state.plan) state.plan.config.model = model
  return state
}
export function setAssistantModel(state, value) {
  if (
    value !== null &&
    (!value ||
      typeof value.provider !== 'string' ||
      !value.provider.trim() ||
      typeof value.model !== 'string' ||
      !value.model.trim())
  )
    throw new Error('请选择有效的整理模型')
  const model = modelSelection(value)
  const previous = state.assistant?.model
  const sameRoute =
    previous?.provider === model?.provider && previous?.model === model?.model
  state.assistant = {
    ...state.assistant,
    model,
    automaticModel: sameRoute ? state.assistant.automaticModel : null,
    reasoningEffort:
      value?.reasoningEffort ||
      (sameRoute ? state.assistant?.reasoningEffort : null) ||
      null,
  }
  state.learn.config.organizeModel = model
  state.plan.config.model = model
  return model
}
export const selectedModel = (state) =>
  Object.hasOwn(state.assistant || {}, 'model')
    ? state.assistant.model
    : (state.learn?.config?.organizeModel ?? state.plan?.config?.model ?? null)

export function setAssistantConfig(state, op) {
  if (Object.hasOwn(op, 'sessionPeriod')) {
    if (!['weekly', 'monthly'].includes(op.sessionPeriod))
      throw new Error('请选择按周或按月换对话')
    state.assistant.sessionPeriod = op.sessionPeriod
  }
  if (Object.hasOwn(op, 'rotateSession')) {
    if (!['tasks', 'learn'].includes(op.rotateSession))
      throw new Error('未知整理对话')
    const binding = state.assistant.sessions[op.rotateSession]
    if (binding) binding.rotateNext = true
  }
  if (Object.hasOwn(op, 'model')) setAssistantModel(state, op.model)
  if (Object.hasOwn(op, 'automaticModel')) {
    const route = op.automaticModel
    if (
      route !== null &&
      (typeof route?.provider !== 'string' ||
        !route.provider.trim() ||
        typeof route?.model !== 'string' ||
        !route.model.trim())
    )
      throw new Error('请选择要授权定时整理的模型')
    state.assistant.automaticModel = modelSelection(route)
  }
  if (Object.hasOwn(op, 'reasoningEffort')) {
    const value = op.reasoningEffort
    if (
      value !== null &&
      (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(value))
    )
      throw new Error('请选择有效的思考强度')
    state.assistant.reasoningEffort = value
  }
  return { receipts: [] }
}

export function organizationModel(state, catalog) {
  const selection = selectedModel(state) || catalog.default
  const info = catalog.groups
    ?.find((g) => g.id === selection?.provider)
    ?.models.find((m) => m.id === selection?.model)
  if (!info) throw new Error('整理模型不可用，请在助手设置中重新选择')
  const effort = state.assistant?.reasoningEffort || selection.reasoningEffort
  if (effort && !info.reasoning?.efforts?.some((e) => e.id === effort))
    throw new Error('当前整理模型不支持所选思考强度，请在助手设置中重新选择')
  return { ...selection, ...(effort ? { reasoningEffort: effort } : {}) }
}

// Anchor the period to creation, not the last reuse. Older bindings only had startedAt.
export function shouldRotateSession(state, binding, now = new Date()) {
  if (!binding) return false
  if (binding.rotateNext) return true
  const anchor = new Date(binding.createdAt || binding.startedAt)
  if (!Number.isFinite(anchor.getTime())) return false
  const zone = state.plan.config.timezone
  const first = calendarDate(anchor, zone),
    today = calendarDate(now, zone)
  return state.assistant.sessionPeriod === 'monthly'
    ? first.slice(0, 7) !== today.slice(0, 7)
    : weekOf(first) !== weekOf(today)
}

// This records user consent for an exact route, not a claim about the provider's billing.
export function automaticModelAllowed(state, route) {
  const approved = state.assistant.automaticModel
  return (
    !!approved &&
    approved.provider === route?.provider &&
    approved.model === route?.model
  )
}
