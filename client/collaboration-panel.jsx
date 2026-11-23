import React from 'react'
import { useDesk, dispatchOps, toast } from './desk.js'
import { Dialog } from './plan-shared.jsx'
import { ProjectTag } from './personal-editor.jsx'
import { jumpToSession } from './nav.js'

const sources = {
  codex: 'Codex',
  dsh: 'DSH',
  claude: 'Claude Code',
  zcode: 'ZCode',
}
const statusLabel = (row) =>
  row.promotedTaskId
    ? '已转为事项'
    : row.status === 'accepted'
      ? '已处理'
      : row.status === 'dismissed'
        ? '已忽略'
        : '待回应'

export function CollaborationPanel({ collapsed, onToggle, project = '' }) {
  const state = useDesk((s) => s.state)
  const [selected, setSelected] = React.useState(null)
  const [busy, setBusy] = React.useState(null)
  const rows = state.reviews
    .filter(
      (r) => r.kind === 'collaboration' && (!project || r.project === project),
    )
    .sort(
      (a, b) =>
        Number(b.status === 'pending') - Number(a.status === 'pending') ||
        b.createdAt.localeCompare(a.createdAt),
    )
  const pending = rows.filter((r) => r.status === 'pending').length
  const detail = rows.find((r) => r.id === selected)
  const decide = async (row, action) => {
    if (busy) return
    setBusy(row.id)
    try {
      const result = await dispatchOps(
        [{ op: 'decide_review', id: row.id, action }],
        { label: '处理协作' },
      )
      if (result && !result.errors?.length) setSelected(null)
    } finally {
      setBusy(null)
    }
  }
  const copySource = async (row) => {
    const text = [
      sources[row.source] || '来源对话',
      `会话 ID：${row.sessionId || '未关联'}`,
      row.title,
      row.ownership?.quote || row.summary,
    ]
      .filter(Boolean)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast('已复制对话定位信息')
    } catch {
      toast('复制失败，可选中下方会话 ID 复制', { error: true })
    }
  }
  return (
    <section
      className={`pd-collaboration ${collapsed ? 'is-collapsed' : ''}`}
      aria-label="待协作"
    >
      <header>
        <button
          className="pd-collaboration-heading"
          aria-label={collapsed ? '展开待协作' : '收起待协作'}
          aria-expanded={!collapsed}
          aria-controls="pd-collaboration-items"
          onClick={onToggle}
        >
          <svg
            viewBox="0 0 20 20"
            width="17"
            height="17"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M13 11.5H7l-3.5 3V5A2 2 0 0 1 5.5 3h8A2 2 0 0 1 15.5 5v4.5a2 2 0 0 1-2 2Z" />
            <path d="M8 14.5h5l3.5 2V8" />
          </svg>
          <h2>待协作</h2>
          <span className="pd-collaboration-count">{pending}</span>
          <span className="pd-collaboration-chevron" aria-hidden="true">
            {collapsed ? '⌄' : '⌃'}
          </span>
        </button>
      </header>
      {!collapsed && (
        <div
          id="pd-collaboration-items"
          className="pd-collaboration-items"
          tabIndex={rows.length ? 0 : undefined}
          aria-label="协作列表"
        >
          {!rows.length && <p className="pd-collaboration-empty">暂无待协作</p>}
          {rows.map((row) => (
            <article
              key={row.id}
              className={`pd-collaboration-card ${row.status !== 'pending' ? 'is-resolved' : ''}`}
            >
              <button
                className="pd-collaboration-title"
                onClick={() => setSelected(row.id)}
                title={row.title}
              >
                {row.title}
              </button>
              <div className="pd-collaboration-meta">
                <ProjectTag name={row.project} />
                <span>{sources[row.source] || '手动移入'}</span>
              </div>
              <div className="pd-collaboration-actions">
                <button onClick={() => setSelected(row.id)}>
                  查看来源 <span aria-hidden="true">↗</span>
                </button>
                {row.status === 'pending' ? (
                  <button
                    disabled={!!busy}
                    onClick={() => decide(row, 'accept')}
                  >
                    标为已处理 <span aria-hidden="true">✓</span>
                  </button>
                ) : (
                  <span>{statusLabel(row)}</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {detail && (
        <Dialog
          label="协作详情"
          close={() => setSelected(null)}
          className="pd-collaboration-dialog"
        >
          <header>
            <h2>{detail.title}</h2>
            <button aria-label="关闭协作详情" onClick={() => setSelected(null)}>
              ×
            </button>
          </header>
          <div className="pd-collaboration-meta">
            <ProjectTag name={detail.project} />
            <span>
              {sources[detail.source] || '手动移入'} · {statusLabel(detail)}
            </span>
          </div>
          {detail.summary && (
            <p className="pd-collaboration-summary">{detail.summary}</p>
          )}
          {(detail.ownership?.quote || detail.evidence?.length > 0) && (
            <blockquote>
              {detail.ownership?.quote || detail.evidence.at(-1)?.quote}
            </blockquote>
          )}
          {detail.sessionId && (
            <div className="pd-collaboration-source">
              <small>来源对话 · {sources[detail.source] || '未知来源'}</small>
              <code>{detail.sessionId}</code>
              {detail.source === 'dsh' ? (
                <button
                  onClick={() => {
                    jumpToSession(detail.sessionId)
                    setSelected(null)
                  }}
                >
                  打开对话 ↗
                </button>
              ) : (
                <button onClick={() => copySource(detail)}>
                  复制对话定位信息
                </button>
              )}
            </div>
          )}
          {!detail.sessionId && (
            <p className="pd-collaboration-empty">未关联来源对话</p>
          )}
          <footer>
            {detail.status === 'pending' ? (
              <>
                <button
                  disabled={!!busy}
                  onClick={() => decide(detail, 'dismiss')}
                >
                  忽略
                </button>
                <span />
                <button
                  disabled={!!busy}
                  onClick={() => decide(detail, 'promote')}
                >
                  转入事项池
                </button>
                <button
                  className="pd-primary"
                  disabled={!!busy}
                  onClick={() => decide(detail, 'accept')}
                >
                  标为已处理
                </button>
              </>
            ) : (
              <>
                <span />
                {!detail.promotedTaskId && (
                  <button
                    disabled={!!busy}
                    onClick={() => decide(detail, 'reopen')}
                  >
                    重新打开
                  </button>
                )}
                <button onClick={() => setSelected(null)}>关闭</button>
              </>
            )}
          </footer>
        </Dialog>
      )}
    </section>
  )
}
