import React from 'react'

export function AiMark({ task }) {
  return ['auto', 'mail', 'chat', 'review'].includes(task.origin?.kind) ? (
    <span className="pd-ai-mark" title="AI 创建" aria-label="AI 创建">
      AI
    </span>
  ) : null
}
