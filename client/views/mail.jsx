import React from 'react'
import { useDesk, workbenchRequest, refreshQuiet } from '../desk.js'
import { MailIcon, CheckIcon, ConfigPrompt } from '../connection-shared.jsx'

export function MailSettings() {
  const mail = useDesk((s) => s.state.mail)
  const [form, setForm] = React.useState({ ...mail.config, password: '' }),
    [hasPassword, setHasPassword] = React.useState(false),
    [busy, setBusy] = React.useState(false),
    [message, setMessage] = React.useState(''),
    [error, setError] = React.useState(''),
    [prompt, setPrompt] = React.useState(''),
    [status, setStatus] = React.useState('unchecked')
  const loadSetup = async () => {
    const data = await workbenchRequest('mail/setup')
    setHasPassword(data.config.hasPassword)
    setForm({ ...data.config, password: '' })
    setPrompt(data.prompt)
    return data
  }
  React.useEffect(() => {
    loadSetup().catch(() =>
      setError('邮箱配置入口尚未加载，请重启 DSH 后重试。'),
    )
  }, [])
  const change = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setStatus('unchecked')
  }
  const execute = async (action) => {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      if (action === 'check') {
        await loadSetup()
        await workbenchRequest('mail/check', {})
        setStatus('ready')
        setMessage('连接检查通过')
      } else if (action === 'run') {
        await workbenchRequest('mail/run-now', {})
        setMessage('已开始收取，结果会显示在下方。')
      } else {
        await workbenchRequest('mail/configure', form)
        await loadSetup()
        setStatus('ready')
        setMessage('配置已保存，连接检查通过')
      }
      await refreshQuiet()
    } catch (e) {
      if (action !== 'run') setStatus('error')
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }
  const running = mail.lease && Date.now() - mail.lease.at < 240000
  return (
    <details className="wb-assistant-setting wb-mail-settings">
      <summary>
        邮箱接入{' '}
        {status === 'ready' ? '· 已连接' : hasPassword ? '· 已配置' : ''}
      </summary>
      <div
        className={`pd-mail-identity ${status === 'ready' ? 'is-connected' : ''}`}
      >
        <span className="pd-mail-symbol">
          {status === 'ready' ? <CheckIcon size={24} /> : <MailIcon />}
        </span>
        <div>
          <strong>{form.address || form.user || '关联你的邮箱'}</strong>
          <small>
            {status === 'ready'
              ? '连接正常 · 只读访问'
              : hasPassword
                ? '已保存配置，检查连接后即可收取'
                : '交给你的 Agent 完成配置'}
          </small>
        </div>
      </div>
      {hasPassword ? (
        <details className="pd-reconfigure">
          <summary>重新配置</summary>
          <ConfigPrompt
            prompt={prompt}
            busy={busy}
            compact
            title=""
            description="复制给你的 Agent，更换邮箱或更新授权。"
          />
        </details>
      ) : (
        <ConfigPrompt
          prompt={prompt}
          busy={busy}
          description="复制给你的 Agent，告诉它要接入哪个邮箱。"
        />
      )}
      <p className="pd-mail-disclosure">
        收取时，邮件正文会交给当前整理模型，提取你的事项与日程。
      </p>
      <details className="pd-mail-manual">
        <summary>手动配置</summary>
        <div className="wb-mail-fields">
          <label>
            IMAP 服务器
            <input
              aria-label="IMAP 服务器"
              placeholder="imap.example.com"
              value={form.host}
              onChange={(e) => change('host', e.target.value)}
            />
          </label>
          <label>
            端口
            <input
              aria-label="IMAP 端口"
              type="number"
              value={form.port}
              onChange={(e) => change('port', Number(e.target.value))}
            />
          </label>
          <label>
            连接方式
            <select
              aria-label="IMAP 连接方式"
              value={form.tlsMode}
              onChange={(e) => change('tlsMode', e.target.value)}
            >
              <option value="tls">TLS（通常 993）</option>
              <option value="starttls">STARTTLS（通常 143）</option>
            </select>
          </label>
          <label>
            登录账号
            <input
              aria-label="邮箱登录账号"
              autoComplete="off"
              value={form.user}
              onChange={(e) => change('user', e.target.value)}
            />
          </label>
          <label>
            我的收件地址
            <input
              aria-label="我的收件地址"
              type="email"
              placeholder="用于判断哪些邮件与你有关"
              value={form.address}
              onChange={(e) => change('address', e.target.value)}
            />
          </label>
          <label>
            授权码 / 应用密码
            <input
              aria-label="邮箱授权码"
              type="password"
              autoComplete="new-password"
              placeholder={
                hasPassword
                  ? '已保存，留空保留'
                  : '在邮箱设置中开通 IMAP 后获取'
              }
              value={form.password}
              onChange={(e) => change('password', e.target.value)}
            />
          </label>
          <label>
            读取文件夹
            <input
              aria-label="邮件文件夹"
              value={form.folder}
              onChange={(e) => change('folder', e.target.value)}
            />
          </label>
          <label>
            首次读取范围
            <select
              aria-label="首次邮件范围"
              value={form.lookbackDays}
              onChange={(e) => change('lookbackDays', Number(e.target.value))}
            >
              {[1, 3, 7, 14, 30, 90].map((n) => (
                <option key={n} value={n}>
                  最近 {n} 天
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="wb-mail-auto">
          <input
            type="checkbox"
            aria-label="自动收取邮件"
            checked={form.automatic}
            onChange={(e) => change('automatic', e.target.checked)}
          />
          自动收取
          <select
            aria-label="邮件收取频率"
            value={form.intervalMinutes}
            onChange={(e) => change('intervalMinutes', Number(e.target.value))}
          >
            {[5, 15, 30, 60, 120].map((n) => (
              <option key={n} value={n}>
                每 {n} 分钟
              </option>
            ))}
          </select>
        </label>
        <small>
          每轮最多读取 20
          封，按进度继续。只读收取，不改变已读状态。授权码仅保存在本机受限文件中；自动收取需要
          Host 保持运行。
        </small>
        <div className="wb-mail-actions">
          <button disabled={busy || running} onClick={() => execute('save')}>
            {busy ? '处理中…' : '保存并检查'}
          </button>
        </div>
      </details>
      <div className="wb-mail-actions pd-mail-primary-actions">
        <button
          disabled={busy || running || !prompt}
          onClick={() => execute('check')}
        >
          {busy ? '处理中…' : '检查连接'}
        </button>
        <button
          className="wb-accent-button"
          disabled={busy || running || !hasPassword}
          onClick={() => execute('run')}
        >
          {running ? '收取整理中…' : '立即收取'}
        </button>
      </div>
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="pd-connection-error" role="alert">
          {error}
        </p>
      )}
      {mail.error && !error && (
        <p className="pd-connection-error" role="alert">
          {mail.error}
        </p>
      )}
      <MailRuns mail={mail} />
    </details>
  )
}
export function MailRuns({ mail }) {
  if (!mail?.runs?.length) return null
  return (
    <section className="wb-mail-runs">
      <h3>邮件收取记录</h3>
      {mail.runs.slice(0, 5).map((run) => (
        <article key={run.id}>
          <strong>
            {run.status === 'error'
              ? '未完成'
              : `读取 ${run.read} 封 · 新增 ${run.created} 项`}
          </strong>
          <small>{new Date(run.at).toLocaleString('zh-CN')}</small>
          <p>{run.summary}</p>
          {run.rejected > 0 && (
            <small>{run.rejected} 项责任或证据不足，未加入待办。</small>
          )}
          {run.duplicates > 0 && (
            <small>{run.duplicates} 项已存在，未重复创建。</small>
          )}
          {run.skipped > 0 && (
            <small>
              跳过 {run.skipped} 封：
              {[...new Set(run.skippedDetails?.map((r) => r.reason))].join(
                '、',
              )}
            </small>
          )}
        </article>
      ))}
    </section>
  )
}
