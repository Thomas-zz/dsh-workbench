// 提问识别与去重（纯函数）：从各 harness 的用户输入里挑出「知识性提问」。
// 刻意保守——宁漏勿滥，最终去留由整理时的 agent 判断，这里只做零成本预筛。

const MIN_LEN = 6
const MAX_LEN = 240

/** 已知的环境注入/噪音开头，命中即丢弃（Codex 的 AGENTS 注入、各家系统提醒等）。 */
const NOISE_PREFIXES = [
  '# AGENTS.md instructions',
  '<INSTRUCTIONS>',
  '<system-reminder>',
  '<environment_context>',
  '<send_user_message',
  'Caveat:',
  '[Request interrupted',
]

// 只让可迁移的概念性问题进入待判断池。单凭问号/「怎么、吗」会把工作指令大量误收。
const CONCEPT_QUESTION = /(?:什么(?:是|叫|意思)|是(?:什么|啥)(?:意思)?|啥(?:是|意思)|(?:区别|差异|原理|含义|机制)(?:是什么|在哪|有|如何|怎么)|(?:如何|怎样|为什么|为何).{0,28}(?:工作|实现|设计|运作|产生|形成|影响|计算|保证)|为什么.{3,40}(?:会|要|需要|导致|不能|可以|被)|(?:有哪些|有什么).{0,18}(?:方法|方案|类型|原因|原则)|(?:与|和|跟|vs\.?|VS\.?|对比).{0,24}(?:区别|差异))/u
const ACTION_REQUEST = /(?:你|帮我|给我|请|先|再|现在|我们)(?:.{0,12})(?:看看|看下|检查|确认|修改|修复|改|做|画|测试|验证|提交|推送|整理|查|补|跑|发|选|告诉)/u
const CONTEXTUAL_QUESTION = /(?:怎么还是|为什么还是|现在|今天|昨天|这个|那个|这条|这些|第\d+|报错|不行|能不能|可不可以|有没有|应该怎么|该怎么|怎么做|怎么办|取不到|查不到|获取不到)/u

/** 归一化：去首尾空白、压掉连续空白，保留原文语义。 */
export function normalizeText(text) {
  if (typeof text !== 'string') return ''
  return text.replace(/\s+/g, ' ').trim()
}

/** 判断一条用户输入是否像知识性提问（排除命令、JSON、环境注入与过短过长的文本）。 */
export function isLikelyQuestion(rawText) {
  const text = normalizeText(rawText)
  if (text.length < MIN_LEN || text.length > MAX_LEN) return false
  if (text.startsWith('/')) return false
  if (text.startsWith('{') || text.startsWith('[')) return false
  for (const prefix of NOISE_PREFIXES) {
    if (text.startsWith(prefix)) return false
  }
  // 纯粘贴占位（Claude 的 display 里常见）不算
  if (/^\[Pasted text #\d+/.test(text) && text.length < 120) return false
  if (ACTION_REQUEST.test(text) || CONTEXTUAL_QUESTION.test(text)) return false
  return CONCEPT_QUESTION.test(text)
}

/** 去重键：小写、去标点空白后取前 80 字符，同一问题换个标点也能对上。 */
export function dedupeKey(rawText) {
  const text = normalizeText(rawText).toLowerCase()
  return text.replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 80)
}

/**
 * 从消息流里筛出提问候选：识别 → 按键去重 → 按时间倒序。
 * @param {Array<{source: string, project?: string, sessionId?: string, text: string, at: string}>} messages
 * @param {{limit?: number, excludeKeys?: Set<string>}} [options]
 * @returns {{source: string, project: string, sessionId: string, text: string, at: string, key: string}[]}
 */
export function extractCandidates(messages, { limit = 80, excludeKeys } = {}) {
  const seen = new Set(excludeKeys ?? [])
  const out = []
  for (const message of Array.isArray(messages) ? messages : []) {
    if (!isLikelyQuestion(message.text)) continue
    const key = dedupeKey(message.text)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({
      source: String(message.source ?? ''),
      project: String(message.project ?? ''),
      sessionId: String(message.sessionId ?? ''),
      text: normalizeText(message.text),
      at: typeof message.at === 'string' ? message.at : new Date().toISOString(),
      key,
    })
  }
  out.sort((a, b) => (a.at < b.at ? 1 : -1))
  return out.slice(0, limit)
}
