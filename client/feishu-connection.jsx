import React from 'react'
import { workbenchRequest } from './desk.js'
import { Dialog } from './plan-shared.jsx'
import { CalendarIcon, CheckIcon, ConfigPrompt } from './connection-shared.jsx'

const identity = (c = {}) =>
  JSON.stringify([c.enabled, c.appId, c.profile, c.calendarId, c.cliPath])
export function FeishuConnection({ close, reload, config, connection }) {
  const [form, setForm] = React.useState(
    config || { enabled: false, profile: '', calendarId: 'primary' },
  )
  const [prompt, setPrompt] = React.useState('')
  const [busy, setBusy] = React.useState('')
  const [error, setError] = React.useState('')
  const [status, setStatus] = React.useState(connection?.status || 'unchecked')
  const [checkedAt, setCheckedAt] = React.useState(
    connection?.updatedAt || null,
  )
  const ready = status === 'ready'
  React.useEffect(() => {
    let alive = true
    workbenchRequest('calendar/setup')
      .then((result) => {
        if (!alive) return
        setForm(result.config)
        setPrompt(result.prompt)
        if (identity(result.config) !== identity(config)) {
          setStatus('unchecked')
          setCheckedAt(null)
        }
      })
      .catch(() => {
        if (alive) setError('配置入口尚未加载，请重启 DSH 后重试。')
      })
    return () => {
      alive = false
    }
  }, [])
  const check = async () => {
    setBusy('check')
    setError('')
    try {
      const result = await workbenchRequest('calendar/check', {})
      setForm(result.config)
      setStatus(result.status)
      setCheckedAt(result.updatedAt)
      if (result.error) setError(result.error)
      if (result.status === 'disabled')
        setError('尚未启用日历同步，请先让 Agent 完成配置。')
      await reload(true)
      const setup = await workbenchRequest('calendar/setup')
      setPrompt(setup.prompt)
    } catch {
      setStatus('error')
      setError('检查失败，请确认 DSH 已加载新版接入模块后重试。')
    } finally {
      setBusy('')
    }
  }
  const save = async () => {
    setBusy('save')
    setError('')
    try {
      await workbenchRequest('calendar/settings', form)
      setStatus('unchecked')
      setCheckedAt(null)
      await reload(true)
      const setup = await workbenchRequest('calendar/setup')
      setForm(setup.config)
      setPrompt(setup.prompt)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy('')
    }
  }
  const handoff = (
    <ConfigPrompt
      prompt={prompt}
      busy={!!busy}
      compact={ready}
      title={ready ? '' : '让 Agent 帮你配置'}
      description={
        ready
          ? '更换关联应用或重新授权时，把配置 Prompt 交给你的 Agent。'
          : '复制后发给你的 Agent，告诉它要关联哪个飞书机器人。'
      }
    />
  )
  return (
    <Dialog
      close={busy ? () => {} : close}
      label="飞书接入"
      className={`pd-editor pd-feishu-dialog ${ready ? 'is-connected' : ''}`}
    >
      <header>
        <strong>飞书接入</strong>
        <button disabled={!!busy} onClick={close} aria-label="关闭飞书设置">
          ×
        </button>
      </header>
      {ready && (
        <section className="pd-connected-hero" role="status">
          <span className="pd-success-mark">
            <CheckIcon size={30} />
          </span>
          <div>
            <h2>飞书日历已连接</h2>
            <p>个人日程已同步到工作台</p>
          </div>
        </section>
      )}
      <section className="pd-feishu-identity">
        <span className="pd-feishu-symbol">
          <CalendarIcon size={24} />
        </span>
        <div>
          <h2>{form.appName || '关联飞书应用'}</h2>
          <p>{form.appId || '交给你的 Agent 完成配置'}</p>
        </div>
        <span
          className={`pd-feishu-status ${ready ? 'is-ready' : ''}`}
          role={ready ? undefined : 'status'}
        >
          {ready ? (
            <>
              <span className="pd-live-dot" />
              同步正常
            </>
          ) : status === 'error' ? (
            '连接失败'
          ) : form.appId ? (
            status === 'disabled' ? (
              '未启用'
            ) : (
              '待检查'
            )
          ) : (
            '未关联'
          )}
        </span>
      </section>
      {!ready && handoff}
      <dl className="pd-connection-details">
        <div>
          <dt>同步内容</dt>
          <dd>
            个人日历 <span>只读</span>
          </dd>
        </div>
        {ready && checkedAt && (
          <div>
            <dt>最近同步</dt>
            <dd>
              <time dateTime={checkedAt}>
                {new Date(checkedAt).toLocaleString('zh-CN', {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </dd>
          </div>
        )}
      </dl>
      {error && (
        <p className="pd-connection-error" role="alert">
          {error}
        </p>
      )}
      {ready && (
        <details className="pd-reconfigure">
          <summary>重新配置</summary>
          {handoff}
        </details>
      )}
      <details className="pd-feishu-advanced">
        <summary>高级设置</summary>
        <label className="pd-setting-check">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          />
          显示飞书日程
        </label>
        <label className="pd-setting-field">
          账号配置
          <input
            aria-label="飞书账号配置"
            value={form.profile || ''}
            onChange={(e) => setForm({ ...form, profile: e.target.value })}
          />
        </label>
        <label className="pd-setting-field">
          日历
          <input
            aria-label="飞书日历 ID"
            value={form.calendarId || 'primary'}
            onChange={(e) => setForm({ ...form, calendarId: e.target.value })}
          />
        </label>
        <button disabled={!!busy} onClick={save}>
          {busy === 'save' ? '保存中…' : '保存高级设置'}
        </button>
      </details>
      <footer>
        <span />
        <button disabled={!!busy || !prompt} onClick={check}>
          {busy === 'check' ? '检查中…' : '检查连接'}
        </button>
        {ready && (
          <button className="pd-primary" disabled={!!busy} onClick={close}>
            完成
          </button>
        )}
      </footer>
    </Dialog>
  )
}
