import React from 'react'

export function CalendarIcon({ size = 18, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="4" y="5" width="16" height="16" rx="4" />
      <path d="M8 3v4m8-4v4M4 10h16m-12 4h3m-3 3h6" />
    </svg>
  )
}
export function MailIcon({ size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="4" />
      <path d="m4 7 6.7 5.4a2 2 0 0 0 2.6 0L20 7" />
    </svg>
  )
}
export function CheckIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  )
}
export function ConfigPrompt({
  prompt,
  busy,
  description,
  title = '让 Agent 帮你配置',
  compact = false,
}) {
  const [copied, setCopied] = React.useState(false)
  const [expanded, setExpanded] = React.useState(false)
  const [error, setError] = React.useState('')
  React.useEffect(() => {
    setCopied(false)
  }, [prompt])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setError('')
    } catch {
      setCopied(false)
      setExpanded(true)
      setError('请选中下方文字复制。')
    }
  }
  return (
    <section className={`pd-config-prompt ${compact ? 'is-compact' : ''}`}>
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      <button
        className="pd-copy-prompt"
        disabled={!prompt || busy}
        onClick={copy}
      >
        {copied ? (
          <>
            <CheckIcon size={16} />
            已复制配置 Prompt
          </>
        ) : (
          '复制配置 Prompt'
        )}
      </button>
      <button
        className="pd-prompt-preview"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {expanded ? '收起 Prompt' : '查看 Prompt'}
      </button>
      {expanded && (
        <textarea
          aria-label="配置 Prompt"
          readOnly
          value={prompt}
          onFocus={(e) => e.target.select()}
        />
      )}
      {error && <p role="status">{error}</p>}
    </section>
  )
}
