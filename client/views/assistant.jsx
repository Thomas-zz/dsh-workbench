import { MailSettings, MailRuns } from './mail.jsx'
import React from 'react'
import { useDesk, setDesk, learnModels, runPlanOrganizer } from '../desk.js'
import { Dialog, send } from '../plan-shared.jsx'
import { jumpToSession } from '../nav.js'

const names = { dsh: 'DSH', codex: 'Codex', claude: 'Claude', zcode: 'ZCode' }
const stamp = (at, zone) =>
  at
    ? new Date(at).toLocaleString('zh-CN', {
        timeZone: zone,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''
const jump = (id) =>
  setDesk({ view: 'today', focusTaskId: id, captureOpen: false })
export function CaptureContent({ state }) {
  const [text, setText] = React.useState(''),
    [saving, setSaving] = React.useState(false)
  const pending = state.ideas.filter((n) => n.status === 'parked'),
    organized = state.ideas.filter(
      (n) => n.status === 'organized' || n.status === 'promoted',
    )
  const capture = async (e) => {
    e.preventDefault()
    if (!text.trim() || saving) return
    setSaving(true)
    const result = await send(
      [{ op: 'capture_idea', text, source: 'ui' }],
      '记下想法',
    )
    setSaving(false)
    if (result && !result.errors?.length)
      setText((current) => (current === text ? '' : current))
  }
  return (
    <div className="wb-capture-content">
      <form onSubmit={capture}>
        <textarea
          autoFocus
          aria-label="公共随手记"
          placeholder={
            '明天提醒我整理发布说明\n记得学习 DS 的 super-agent 架构…'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (
              (e.metaKey || e.ctrlKey) &&
              e.key === 'Enter' &&
              !e.nativeEvent.isComposing
            )
              capture(e)
          }}
        />
        <div className="wb-capture-submit">
          <span>记下你要做或确认的事，助手整理并排期</span>
          <button
            className="wb-accent-button"
            disabled={saving || !text.trim()}
          >
            {saving ? '保存中…' : '记下来'}
          </button>
        </div>
      </form>
      <div className="wb-capture-list-head">
        <strong>
          待整理 <span>{pending.length}</span>
        </strong>
        <button
          className="wb-text-button"
          disabled={!!state.plan.organizer.lease}
          onClick={() => runPlanOrganizer()}
        >
          {state.plan.organizer.lease ? '正在整理…' : '现在整理 →'}
        </button>
      </div>
      {!pending.length && (
        <p className="wb-muted">
          这里是所有日期共用的随手记。记下的安排会在整理后进入日历。
        </p>
      )}
      {pending.map((note) => (
        <article key={note.id} className="wb-capture-note">
          <p>{note.text}</p>
          <div>
            <time>{stamp(note.createdAt, state.plan.config.timezone)}</time>
            <button
              aria-label={`移除 ${note.text}`}
              onClick={() => send([{ op: 'drop_idea', id: note.id }])}
            >
              ×
            </button>
          </div>
        </article>
      ))}
      {organized.length > 0 && (
        <details className="wb-capture-archive">
          <summary>已整理 · {organized.length}</summary>
          {organized.slice(0, 30).map((note) => (
            <article key={note.id} className="wb-capture-note">
              <p>{note.text}</p>
              <small>{note.organizationNote || '已转为行动'}</small>
              <div className="wb-note-links">
                {(note.taskIds?.length ? note.taskIds : [note.promotedTaskId])
                  .filter(Boolean)
                  .map((id) => {
                    const task = state.tasks.find((t) => t.id === id)
                    return (
                      task && (
                        <button key={id} onClick={() => jump(id)}>
                          {task.kind === 'goal' ? '◎' : '↳'} {task.title}
                        </button>
                      )
                    )
                  })}
              </div>
              <button
                className="wb-text-button"
                onClick={() => send([{ op: 'retry_note', id: note.id }])}
              >
                重新整理
              </button>
            </article>
          ))}
        </details>
      )}
    </div>
  )
}
export function CapturePanel({ close }) {
  const state = useDesk((s) => s.state)
  return (
    <Dialog label="公共随手记" close={close} className="wb-capture-dialog">
      <header className="wb-dialog-heading">
        <div>
          <h2>随手记</h2>
          <p>一个公共入口，记下想做的事。</p>
        </div>
        <button className="wb-close" onClick={close} aria-label="关闭随手记">
          ×
        </button>
      </header>
      <CaptureContent state={state} />
    </Dialog>
  )
}
export function AssistantSettings({ close }) {
  const state = useDesk((s) => s.state),
    config = state.plan.config
  const [catalog, setCatalog] = React.useState(null),
    [error, setError] = React.useState('')
  React.useEffect(() => {
    learnModels()
      .then(setCatalog)
      .catch((e) => setError(e.message))
  }, [])
  const model = state.assistant?.model,
    modelKey = (m) => (m ? JSON.stringify([m.provider, m.model]) : '')
  const options = (catalog?.groups || []).flatMap((g) =>
    g.models.map((m) => ({
      provider: g.id,
      model: m.id,
      label: `${g.name} / ${m.name}`,
    })),
  )
  const effectiveModel = model || catalog?.default
  const modelInfo = catalog?.groups
    ?.find((g) => g.id === effectiveModel?.provider)
    ?.models.find((m) => m.id === effectiveModel?.model)
  const efforts = modelInfo?.reasoning?.efforts || []
  const effort = state.assistant?.reasoningEffort || ''
  const save = (patch) => send([{ op: 'plan_config', patch }], '更新助手设置')
  const [slotText, setSlotText] = React.useState(
    config.slots
      .map(
        ([a, b]) =>
          `${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}-${String(Math.floor(b / 60)).padStart(2, '0')}:${String(b % 60).padStart(2, '0')}`,
      )
      .join('，'),
  )
  const saveSlots = () => {
    const slots = slotText
      .split(/[,，;；]/)
      .map((v) =>
        v.trim().match(/^(\d{1,2}):(\d{2})\s*[-–至]\s*(\d{1,2}):(\d{2})$/),
      )
      .filter(Boolean)
      .map((m) => [
        Number(m[1]) * 60 + Number(m[2]),
        Number(m[3]) * 60 + Number(m[4]),
      ])
    if (slots.length) save({ slots })
  }
  return (
    <Dialog label="助手设置" close={close} className="wb-settings-dialog">
      <header className="wb-dialog-heading">
        <div>
          <h2>助手设置</h2>
          <p>任务整理与学习，共用一个模型。</p>
        </div>
        <button className="wb-close" onClick={close} aria-label="关闭助手设置">
          ×
        </button>
      </header>
      <section className="wb-assistant-setting">
        <label htmlFor="wb-shared-model">整理模型</label>
        <select
          id="wb-shared-model"
          value={modelKey(model)}
          onChange={(e) => {
            const pair = e.target.value ? JSON.parse(e.target.value) : null
            send(
              [
                {
                  op: 'assistant_config',
                  model: pair ? { provider: pair[0], model: pair[1] } : null,
                },
              ],
              '切换共用模型',
            )
          }}
        >
          <option value="">
            宿主默认{catalog?.default ? ` · ${catalog.default.model}` : ''}
          </option>
          {model && !options.some((o) => modelKey(o) === modelKey(model)) && (
            <option value={modelKey(model)}>
              {model.provider} / {model.model}
            </option>
          )}
          {options.map((o) => (
            <option key={modelKey(o)} value={modelKey(o)}>
              {o.label}
            </option>
          ))}
        </select>
        <small>
          {error || '用于个人事项收集、排期和学习整理。改一次，两边同步。'}
        </small>
        <label>
          <input
            type="checkbox"
            disabled={!modelInfo}
            checked={
              !!effectiveModel &&
              modelKey(state.assistant?.automaticModel) ===
                modelKey(effectiveModel)
            }
            onChange={(e) =>
              send(
                [
                  {
                    op: 'assistant_config',
                    automaticModel: e.target.checked ? effectiveModel : null,
                  },
                ],
                '更新定时模型授权',
              )
            }
          />
          允许定时整理使用此模型（已确认服务商限额）
        </label>
        <small>
          未授权时仍可手动整理。工作台不会读取余额或替你设置服务商限额。
        </small>
      </section>
      <section className="wb-assistant-setting">
        <label htmlFor="wb-session-period">整理对话复用周期</label>
        <select
          id="wb-session-period"
          value={state.assistant?.sessionPeriod || 'weekly'}
          onChange={(e) =>
            send(
              [{ op: 'assistant_config', sessionPeriod: e.target.value }],
              '更新复用周期',
            )
          }
        >
          <option value="weekly">每周一换新</option>
          <option value="monthly">每月一日换新</option>
        </select>
        <small>任务和学习各用一个对话。下次整理时才换新，保留旧记录。</small>
        {Object.entries({ tasks: '任务', learn: '学习' }).map(
          ([kind, label]) => {
            const binding = state.assistant?.sessions?.[kind]
            const usage = binding?.usage
            return (
              <div key={kind}>
                <button
                  disabled={!binding || binding.rotateNext}
                  onClick={() =>
                    send(
                      [{ op: 'assistant_config', rotateSession: kind }],
                      '下次整理用新对话',
                    )
                  }
                >
                  {binding?.rotateNext
                    ? `${label}整理已安排换新`
                    : `下次${label}整理用新对话`}
                </button>
                {binding?.status !== 'running' && usage && (
                  <small>
                    上轮：{usage.requests} 次模型请求，累计输入{' '}
                    {Math.ceil(usage.inputBytes / 1024)} KiB，{usage.tools}{' '}
                    次工具尝试。
                  </small>
                )}
                {binding?.error && <small>{binding.error}</small>}
                {binding?.safetyHold && (
                  <small>自动整理已暂停，请先手动成功完成一次。</small>
                )}
              </div>
            )
          },
        )}
      </section>
      <section className="wb-assistant-setting">
        <label htmlFor="wb-thinking-effort">思考强度</label>
        <select
          id="wb-thinking-effort"
          value={effort}
          disabled={!catalog || (!efforts.length && !effort)}
          onChange={(e) =>
            send(
              [
                {
                  op: 'assistant_config',
                  reasoningEffort: e.target.value || null,
                },
              ],
              '更新思考强度',
            )
          }
        >
          <option value="">
            {catalog && !efforts.length ? '当前模型不支持调节' : '模型默认'}
          </option>
          {effort && !efforts.some((e) => e.id === effort) && (
            <option value={effort}>不可用 · {effort}</option>
          )}
          {efforts.map((e) => (
            <option key={e.id} value={e.id}>
              {{
                off: '关闭',
                minimal: '极低',
                low: '低',
                medium: '中',
                high: '高',
                xhigh: '很高',
                max: '最高',
              }[e.id] || e.name}
            </option>
          ))}
        </select>
        <small>
          {effort && !efforts.some((e) => e.id === effort) && catalog
            ? '所选强度已不可用，请重新选择。'
            : '任务与学习整理共用；下一轮生效。'}
        </small>
      </section>
      <section className="wb-assistant-setting">
        <div className="wb-setting-inline">
          <strong>自动整理任务</strong>
          <input
            aria-label="自动整理任务"
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => save({ enabled: e.target.checked })}
          />
        </div>
        <div className="wb-setting-inline">
          <select
            aria-label="任务整理频率"
            value={config.scheduleMode}
            onChange={(e) => save({ scheduleMode: e.target.value })}
          >
            <option value="nightly">每天晚上</option>
            <option value="interval">每隔一段时间</option>
          </select>
          {config.scheduleMode === 'nightly' ? (
            <select
              aria-label="晚间整理时间"
              value={config.nightlyHour}
              onChange={(e) => save({ nightlyHour: Number(e.target.value) })}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option value={i} key={i}>
                  {String(i).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          ) : (
            <select
              aria-label="整理间隔"
              value={config.intervalMinutes}
              onChange={(e) =>
                save({ intervalMinutes: Number(e.target.value) })
              }
            >
              {[15, 30, 60, 120].map((n) => (
                <option key={n} value={n}>
                  {n} 分钟
                </option>
              ))}
            </select>
          )}
        </div>
        <small>处理随手记和新增会话记录；随时可以手动整理。</small>
      </section>
      <details className="wb-assistant-setting">
        <summary>每日时间与读取来源</summary>
        <label>
          每天大致可用时段
          <input
            aria-label="每天可用时段"
            value={slotText}
            onChange={(e) => setSlotText(e.target.value)}
            onBlur={saveSlots}
          />
        </label>
        <small>例如 09:00-12:00，14:00-18:00。排期可随时拖动。</small>
        <small>整理时核对未完成事项并顺延、排期；固定日程保持原位。</small>
        <div className="wb-setting-inline">
          <label>
            时区
            <input
              defaultValue={config.timezone}
              onBlur={(e) => save({ timezone: e.target.value })}
            />
          </label>
        </div>
        <div className="wb-source-switches">
          {Object.entries(config.sources).map(([key, on]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={on}
                onChange={(e) =>
                  save({
                    sources: { ...config.sources, [key]: e.target.checked },
                  })
                }
              />
              {names[key] || key}
            </label>
          ))}
        </div>
      </details>
      <MailSettings />
      <div className="wb-settings-end">
        <small>学习的笔记路径与每日整理时间仍在学习设置中。</small>
        <button
          className="wb-text-button"
          onClick={() => {
            close()
            setDesk({ view: 'learn', learnSettings: true })
          }}
        >
          学习设置 ↗
        </button>
      </div>
    </Dialog>
  )
}
export function AssistantActivity() {
  const state = useDesk((s) => s.state),
    org = state.plan.organizer,
    zone = state.plan.config.timezone
  const modes = {
      collect: '收集个人事项',
      schedule: '安排当天时间',
      estimate: '估计默认用时',
      decompose: '拆分阶段行动',
    },
    statuses = {
      running: '处理中',
      completed: '已完成',
      partial: '部分完成',
      error: '未完成',
    }
  return (
    <div className="wb-activity-page">
      <header className="wb-activity-heading">
        <div>
          <h1>整理记录</h1>
          <p>查看个人事项的来源、进展和安排。</p>
        </div>
        <button
          className="wb-accent-button"
          disabled={!!org.lease}
          onClick={() => runPlanOrganizer()}
        >
          {org.lease ? '整理中…' : '整理一次'}
        </button>
      </header>
      {org.lease && (
        <div className="wb-run-live">
          <span className="wb-live-dot" />
          {org.lease.phase || '正在整理'}
          <small>可以继续安排自己的事情</small>
        </div>
      )}
      {!org.runs?.length && (
        <div className="wb-activity-empty">
          <span>↳</span>
          <h2>下一轮整理，从这里看见</h2>
          <p>暂无整理记录</p>
          <button
            className="wb-text-button"
            onClick={() => setDesk({ captureOpen: true })}
          >
            记录一下 →
          </button>
        </div>
      )}
      <MailRuns mail={state.mail} />
      <div className="wb-run-list">
        {(org.runs || []).map((run, index) => (
          <details key={run.id} open={index === 0} className="wb-organizer-run">
            <summary>
              <span className={`wb-run-status is-${run.status}`}>
                {statuses[run.status]}
              </span>
              <strong>{modes[run.mode] || '收集个人事项'}</strong>
              <span>{stamp(run.startedAt, zone)}</span>
              <span>{run.trigger === 'manual' ? '手动' : '定时'}</span>
              <span className="wb-run-counts">
                {run.added || 0} 新增 · {run.updated || 0} 更新
                {!!run.collaborationAdded &&
                  ` · ${run.collaborationAdded} 待协作`}
                {!!run.collaborationResolved &&
                  ` · ${run.collaborationResolved} 协作已处理`}
              </span>
            </summary>
            <div className="wb-run-body">
              {run.sessionId && (
                <button
                  className="wb-text-button"
                  onClick={() => jumpToSession(run.sessionId)}
                >
                  查看执行对话 ↗
                </button>
              )}
              <p>{run.summary || run.error || '正在读取记录…'}</p>
              {run.error && run.summary && (
                <p className="wb-run-error">{run.error}</p>
              )}
              <div className="wb-run-sources">
                {Object.entries(run.sources || {}).map(([source, count]) => (
                  <span key={source}>
                    {names[source] || source} · {count} 条
                  </span>
                ))}
                {run.model && (
                  <span>
                    {run.model.model}
                    {run.model.reasoningEffort
                      ? ` · ${run.model.reasoningEffort}`
                      : ''}
                  </span>
                )}
                {!!run.inspected?.length && (
                  <span>查阅 {run.inspected.length} 次</span>
                )}
              </div>
              {run.tasks?.length > 0 && (
                <div className="wb-run-output">
                  {run.tasks.map((task, i) => (
                    <button
                      key={`${task.id}:${i}`}
                      onClick={() => jump(task.id)}
                      className={task.kind === 'goal' ? 'is-goal' : ''}
                    >
                      <span>{task.kind === 'goal' ? '◎' : '↳'}</span>
                      <span>
                        <strong>{task.title}</strong>
                        <small>
                          {task.kind === 'goal'
                            ? '周目标'
                            : state.tasks.find((t) => t.id === task.parentId)
                                ?.title || '独立行动'}{' '}
                          · {task.plannedDate || task.plannedWeek || '待安排'}
                        </small>
                      </span>
                      <em>
                        {{
                          created: '新增',
                          carried: '顺延',
                          scheduled: '排期',
                        }[task.action] || '更新'}
                      </em>
                    </button>
                  ))}
                </div>
              )}
              {run.collaborations?.length > 0 && (
                <div className="wb-run-collaborations">
                  {run.collaborations.map((row, i) => (
                    <p key={`${row.id}:${i}`}>
                      <strong>{row.title}</strong> ·{' '}
                      {{
                        created: '新增待协作',
                        moved: '移到待协作',
                        accepted: '已处理',
                        dismissed: '已忽略',
                      }[row.action] || '更新协作'}
                    </p>
                  ))}
                </div>
              )}
              {run.collaborationSkipped?.length > 0 && (
                <details className="wb-run-inputs">
                  <summary>
                    未变更的协作建议 · {run.collaborationSkipped.length}
                  </summary>
                  {run.collaborationSkipped.map((row, i) => (
                    <p key={i}>
                      {row.title ||
                        state.tasks.find((t) => t.id === row.id)?.title ||
                        state.reviews.find((r) => r.id === row.id)?.title ||
                        row.id}
                      ：{row.reason}
                    </p>
                  ))}
                </details>
              )}
              <details className="wb-run-inputs">
                <summary>查看读取的 {run.inputs?.length || 0} 条记录</summary>
                {run.inputs?.map((m) => (
                  <div key={m.key}>
                    <small>
                      {names[m.source] || m.source} · {stamp(m.at, zone)}
                    </small>
                    <p>{m.text}</p>
                  </div>
                ))}
              </details>
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
