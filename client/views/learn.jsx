import React from 'react'
import { ago, learnCapture, learnDropInbox, learnDecide, learnRunNow, learnModels, learnSetConfig, learnPreview, openLearnNote, exploreLearn, highlightLearn, syncLearn, learnReports, readLearnReport, readLearnNote, toast, setDesk, useDesk } from '../desk.js'
import { t } from '../i18n.js'
import { jumpToSession } from '../nav.js'
import { Empty } from '../ui.jsx'

const CATEGORY = { weak: '需要弄懂', know: '了解即可', term: '概念卡' }
const SOURCE = { zcode: 'ZCode', dsh: 'DSH', claude: 'Claude Code', codex: 'Codex', chat: '对话', command: '学习任务', cli: 'CLI', ui: '工作台' }

function StorageSettings({ learn, close }) {
  const [form, setForm] = React.useState({
    vaultPath: learn.config.vaultPath || learn.resolvedVaultPath || '',
    notesDir: learn.config.notesDir,
    reportHour: learn.config.reportHour,
    organizeModel: learn.config.organizeModel || null,
    reportSessionId: learn.config.reportSessionId || '',
    reportPush: learn.config.reportPush,
    sources: { ...learn.config.sources },
  })
  const [catalog, setCatalog] = React.useState(null)
  const [modelError, setModelError] = React.useState('')
  React.useEffect(() => {
    let active = true
    learnModels().then((data) => { if (active) setCatalog(data) }).catch((err) => { if (active) setModelError(err.message) })
    return () => { active = false }
  }, [])
  const modelKey = (selection) => selection ? JSON.stringify([selection.provider, selection.model]) : ''
  const options = (catalog?.groups || []).flatMap((group) => group.models.map((model) => ({ provider: group.id, model: model.id, label: `${group.name} / ${model.name}` })))
  const [saving, setSaving] = React.useState(false)
  const set = (patch) => setForm((old) => ({ ...old, ...patch }))
  const save = async () => {
    setSaving(true)
    const result = await learnSetConfig(form)
    setSaving(false)
    if (result && !result.errors?.length) close()
  }
  return <section className="wb-study-settings">
    <div className="wb-study-section-head"><div><span className="wb-study-eyebrow">STORAGE & ROUTINE</span><h2>{t('学习设置')}</h2></div><button type="button" className="wb-btn is-ghost" onClick={close}>{t('关闭')}</button></div>
    <div className="wb-study-settings-grid">
      <label className="wb-field"><span>{t('Obsidian 库路径')}</span><input value={form.vaultPath} onChange={(e) => set({ vaultPath: e.target.value })} placeholder="/Users/…/My Vault" /><small>{t('选择本机已有的 Obsidian 库；保存时验证 .obsidian 目录。')}</small></label>
      <label className="wb-field"><span>{t('笔记目录（库内）')}</span><input value={form.notesDir} onChange={(e) => set({ notesDir: e.target.value })} placeholder="AI/Agent学习" /><small>{t('知识卡与日报将写到这个目录。')}</small></label>
      <label className="wb-field"><span>{t('每日整理时间')}</span><input type="number" min="0" max="23" value={form.reportHour} onChange={(e) => set({ reportHour: Number(e.target.value) })} /></label>
      <label className="wb-field"><span>{t('整理模型')}</span><select value={modelKey(form.organizeModel)} onChange={(e) => { const value = e.target.value; const pair = value ? JSON.parse(value) : null; set({ organizeModel: pair ? { provider: pair[0], model: pair[1] } : null }) }}>
        <option value="">{t('跟随目标会话')}</option>
        {form.organizeModel && !options.some((option) => modelKey(option) === modelKey(form.organizeModel)) && <option value={modelKey(form.organizeModel)}>{form.organizeModel.provider} / {form.organizeModel.model}（{catalog ? t('不可用') : t('加载中…')}）</option>}
        {options.map((option) => <option key={modelKey(option)} value={modelKey(option)}>{option.label}</option>)}
      </select><small>{modelError || (!catalog ? t('正在加载 DSH 模型…') : t('选择模型后在独立 DSH 会话中整理；可选择已接入的 GLM 5.3。'))}</small>{catalog?.failures?.length > 0 && <small role="alert">{t('部分模型来源加载失败')}：{catalog.failures.map((item) => item.name).join('、')}</small>}</label>
      {!form.organizeModel && <label className="wb-field"><span>{t('目标会话 ID')}</span><input value={form.reportSessionId} onChange={(e) => set({ reportSessionId: e.target.value })} /><small>{t('留空则使用最近活跃的工作台任务会话。')}</small></label>}
      <label className="wb-study-switch"><input type="checkbox" checked={form.reportPush} onChange={(e) => set({ reportPush: e.target.checked })} />{t('每天自动整理')}</label>
    </div>
    <div className="wb-study-source-options"><span>{t('扫描来源')}</span>{Object.keys(form.sources).map((name) => <label key={name}><input type="checkbox" checked={form.sources[name]} onChange={(e) => set({ sources: { ...form.sources, [name]: e.target.checked } })} />{SOURCE[name] || name}</label>)}</div>
    <div className="wb-study-settings-foot"><span>{t('路径变更只影响之后新写入的笔记。')}</span><button type="button" className="wb-btn is-primary" disabled={saving} onClick={save}>{saving ? t('检查中…') : t('保存设置')}</button></div>
  </section>
}

function Inbox({ rows }) {
  if (!rows.length) return null
  return <section className="wb-study-section"><div className="wb-study-section-head"><div><span className="wb-study-eyebrow">INBOX</span><h2>{t('待整理的学习问题')} <em>{rows.length}</em></h2></div></div>
    <div className="wb-study-inbox">{rows.map((row) => <div key={row.id} className="wb-study-inbox-item"><span className="wb-study-inbox-dot" /><div><strong>{row.question}</strong>{row.context && <small>{row.context}</small>}</div><span>{SOURCE[row.source] || row.source}</span><button type="button" className="wb-btn is-ghost" onClick={() => learnDropInbox(row.id)}>{t('移除')}</button></div>)}</div>
  </section>
}

function CandidatePreview() {
  const [preview, setPreview] = React.useState(null)
  React.useEffect(() => { learnPreview().then(setPreview).catch(() => setPreview(null)) }, [])
  if (!preview) return null
  return <details className="wb-study-candidates"><summary>{t('查看近期扫描候选')} <span>{preview.candidates.length}</span><small>{t('仅作预览，整理时还会判断是否值得记录')}</small></summary>
    {preview.errors?.length > 0 && <p>{t('部分来源扫描失败')}：{preview.errors.map((e) => e.source).join('、')}</p>}
    {preview.candidates.length ? <ul>{preview.candidates.slice(0, 20).map((row) => <li key={row.key}><b>{SOURCE[row.source] || row.source}</b><span>{row.text}</span></li>)}</ul> : <p>{t('近期没有候选问题')}</p>}
  </details>
}

/** 只渲染文本和登记过的知识链接，不执行 HTML 或外部链接。 */
function LearningText({ text, entries, select }) {
  return <div className="wb-learning-prose">{String(text || '').split('\n').map((line, index) => {
    const parts = line.split(/(\[\[[^\]]+\]\])/g).map((part, i) => {
      if (!part.startsWith('[[')) return part.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((token,j) => token.startsWith('**') ? <strong key={j}>{token.slice(2,-2)}</strong> : token.startsWith('`') ? <code key={j}>{token.slice(1,-1)}</code> : token)
      const [path, label] = part.slice(2,-2).split('|')
      const entry = entries.find((row) => row.notePath?.replace(/\.md$/, '') === path || row.title === path)
      return entry ? <button className="wb-text-link" key={i} onClick={() => select(entry.id)}>{label || entry.title}</button> : (label || path)
    })
    const heading = line.match(/^(#{1,3}) /)
    return heading ? <h3 key={index}>{line.replace(/^#+ /,'')}</h3> : <div key={index}>{parts.length === 1 && !line ? '\u00a0' : parts}</div>
  })}</div>
}

function Branch({ entry, entries, selected, select, seen = [] }) {
  if (seen.includes(entry.id) || seen.length > 14) return null
  const children = entries.filter((row) => row.parentIds?.includes(entry.id))
  const ancestors = new Set()
  const pending = [selected]
  while (pending.length) { const id = pending.pop(); if (ancestors.has(id)) continue; ancestors.add(id); pending.push(...(entries.find((row) => row.id === id)?.parentIds || [])) }
  return <li><button type="button" className={`wb-branch-row ${selected === entry.id ? 'is-selected' : ''}`} onClick={() => select(entry.id)} aria-current={selected === entry.id ? 'true' : undefined}>
    <span className={`wb-branch-dot is-${entry.kind || 'question'}`} />
    <span>{entry.title}<small>{entry.kind === 'suggested' ? '建议探索' : !entry.answer ? '待回答' : entry.status === 'mastered' ? '已掌握' : entry.concept || '已记录'}</small></span>
  </button>{children.length > 0 && <details open={seen.length < 1 || ancestors.has(entry.id)}><summary>{children.length} 个延伸问题</summary><ul>{children.map((child) => <Branch key={child.id} entry={child} entries={entries} selected={selected} select={select} seen={[...seen,entry.id]} />)}</ul></details>}</li>
}

function KnowledgeDetail({ entry, entries, select, review = false }) {
  const [revealed, setRevealed] = React.useState(!review)
  const [question, setQuestion] = React.useState('')
  const [quote, setQuote] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [note, setNote] = React.useState(null)
  const [noteError, setNoteError] = React.useState('')
  const content = React.useRef(null)
  const captureSelection = () => {
    const selection = window.getSelection()
    if (selection && content.current?.contains(selection.anchorNode) && content.current?.contains(selection.focusNode)) {
      const text = selection.toString().trim().slice(0,2000)
      if (text && [entry.answer,entry.question].some((value) => value.includes(text))) setQuote(text)
    }
  }
  const ask = async (event) => {
    event.preventDefault()
    if (busy || !question.trim()) return
    setBusy(true)
    const result = await exploreLearn(entry.id, question, quote)
    setBusy(false)
    if (result) { select(result.entryId); jumpToSession(result.sessionId) }
  }
  const act = async (action) => { setBusy(true); await learnDecide(entry.id, action, entry.title); setBusy(false) }
  const linked = (ids) => entries.filter((row) => ids?.includes(row.id))
  const parents = linked(entry.parentIds)
  const children = entries.filter((row) => row.parentIds?.includes(entry.id))
  const related = entries.filter((row) => entry.relatedIds?.includes(row.id) || row.relatedIds?.includes(entry.id))
  return <article className="wb-knowledge-detail">
    <nav className="wb-knowledge-path" aria-label="知识来源">{parents.length ? parents.map((row) => <button key={row.id} className="wb-text-link" onClick={() => select(row.id)}>{row.title} →</button>) : <span>学习起点</span>}</nav>
    <div className="wb-knowledge-heading"><span>{entry.kind === 'suggested' ? 'AI 建议 · 待你判断' : entry.kind === 'followup' ? '我的追问' : '我的知识点'}</span><span>{entry.concept}</span></div>
    <h2>{entry.title}</h2>
    {entry.evidence && <p className="wb-learning-evidence">{entry.kind === 'suggested' ? '建议依据：' : '来源：'}{entry.evidence}</p>}
    <div ref={content} onMouseUp={captureSelection} onKeyUp={captureSelection}>
      <p className="wb-knowledge-question">{entry.question}</p>
      {review && !revealed ? <div className="wb-learning-recall"><p>先试着用自己的话回答，再展开核对。</p><button className="wb-btn" onClick={() => setRevealed(true)}>看答案</button></div> : entry.answer ? <LearningText text={entry.answer} entries={entries} select={select} /> : <p className="wb-learning-empty-answer">这个追问已记录。对话中的回答会自动回到这里；若回答中断，可继续进入原对话。</p>}
    </div>
    {entry.lastRunError && <p role="alert" className="wb-learning-evidence">这轮回答未完成：{entry.lastRunError}。问题已保留，可继续原对话重试。</p>}
    {entry.why && <p className="wb-study-why">{entry.why}</p>}
    <div className="wb-knowledge-actions">
      {entry.learningSessionId && <button className="wb-btn" onClick={() => jumpToSession(entry.learningSessionId)}>继续原对话 ↗</button>}
      {revealed && entry.answer && entry.kind !== 'suggested' && entry.status === 'recorded' && <button className="wb-btn" disabled={busy} onClick={() => act('reviewed')}>已复习</button>}
      <button className="wb-btn is-ghost" disabled={busy} onClick={() => act(entry.status === 'mastered' ? 'reopen' : 'mastered')}>{entry.status === 'mastered' ? '重新学习' : '已掌握'}</button>
      <button className="wb-btn is-ghost" disabled={busy} onClick={() => act(entry.status === 'ignored' ? 'reopen' : 'ignored')}>{entry.status === 'ignored' ? '恢复记录' : '暂不学习'}</button>
    </div>
    <form className="wb-learning-followup" onSubmit={ask}>
      <label htmlFor="wb-followup">继续探索这个问题</label>
      <p>追问会在新的 DSH 对话中展开；新的问题和回答会留在这条学习脉络里。</p>
      {quote && <div className="wb-learning-quote"><blockquote>{quote}</blockquote><button type="button" className="wb-btn" onClick={() => highlightLearn(entry.id, quote)}>保存划线</button><button type="button" className="wb-btn is-ghost" onClick={() => setQuote('')}>清除选中</button></div>}
      <textarea id="wb-followup" value={question} maxLength={12000} onChange={(event) => setQuestion(event.target.value)} placeholder={quote ? '这段话哪里不理解？' : '例如：它为什么这样设计？能给我一个实际例子吗？'} />
      <div><small>可选中上方原问题或答案中的文字追问，也可直接输入问题。</small><button type="submit" className="wb-btn is-primary" disabled={busy || !question.trim()}>{busy ? '正在创建…' : '新建对话追问 ↗'}</button></div>
    </form>
    {entry.highlights?.length > 0 && <section className="wb-learning-links"><h3>我的划线</h3>{entry.highlights.map((row) => <button className="wb-highlight" key={row.id} onClick={() => {setQuote(row.text);setQuestion('请结合例子进一步解释这段话')}}>{row.text}</button>)}</section>}
    {[['延伸问题',children],['关联知识',related]].map(([title,rows]) => rows.length > 0 && <section className="wb-learning-links" key={title}><h3>{title} <small>{rows.length}</small></h3>{rows.map((row) => <button key={row.id} onClick={() => select(row.id)}><span>{row.kind === 'suggested' ? '建议探索 · ' : ''}{row.title}</span><span>→</span></button>)}</section>)}
    <details className="wb-learning-storage"><summary>笔记文件与同步</summary><p>{entry.syncError || entry.notePath || '对话完成后同步到笔记库'}</p><button className="wb-btn" onClick={() => syncLearn(entry.id)}>同步笔记</button>{entry.notePath && <><button className="wb-btn" onClick={async () => {try { setNote(await readLearnNote(entry.id));setNoteError('') } catch(error) {setNoteError(error.message)} }}>在此查看笔记原文</button><button className="wb-btn is-ghost" onClick={() => openLearnNote(entry.notePath)}>在 Obsidian 打开 ↗</button></>}{noteError && <p role="alert">{noteError}</p>}{note && <LearningText text={note.content} entries={entries} select={select} />}</details>
  </article>
}

function Reports({ entries, select }) {
  const [reports,setReports] = React.useState([])
  const [report,setReport] = React.useState(null)
  const [error,setError] = React.useState('')
  const [loading,setLoading] = React.useState(true)
  React.useEffect(() => { let active = true; learnReports().then((data) => {if(active) setReports(data.reports)}).catch((err) => {if(active)setError(err.message)}).finally(() => {if(active)setLoading(false)});return () => {active=false} }, [])
  const read = async (id) => { setLoading(true);setError('');try {setReport(await readLearnReport(id))}catch(err){setError(err.message)}finally{setLoading(false)} }
  return <section className="wb-learning-reports"><div className="wb-learning-report-list"><h2>学习日报</h2>{reports.map((row) => <button className={`wb-btn ${report?.id === row.id ? 'is-primary' : ''}`} key={row.id} onClick={() => read(row.id)}>{row.date}</button>)}</div><div>{error && <p role="alert">{error}</p>}{loading ? <p>正在读取日报…</p> : report ? <LearningText text={report.content} entries={entries} select={select} /> : <p>{reports.length ? '选择日期，在工作台内查看日报。点击知识链接可进入学习脉络。' : '还没有学习日报；完成一轮整理后会出现在这里。'}</p>}</div></section>
}

export function LearnView() {
  const state = useDesk((s) => s.state)
  const filter = useDesk((s) => s.filter)
  const settings = useDesk((s) => s.learnSettings)
  const selectedId = useDesk((s) => s.learnSelectedId)
  const [section, setSection] = React.useState('library')
  const [question, setQuestion] = React.useState('')
  const [organizing,setOrganizing] = React.useState(false)
  const learn = state?.learn
  if (!learn) return <Empty text={t('加载中…')} />
  const entries = learn.entries || []
  const due = entries.filter((row) => row.status === 'recorded' && row.kind !== 'suggested' && row.answer && (!row.nextReviewAt || Date.parse(row.nextReviewAt) <= Date.now()))
  const needle = filter.trim().toLowerCase()
  const visible = entries.filter((row) => section === 'ignored' ? row.status === 'ignored' : row.status !== 'ignored')
  const list = (section === 'review' ? due : section === 'suggested' ? visible.filter((row) => row.kind === 'suggested') : visible).filter((row) => !needle || [row.title,row.question,row.concept,row.answer].some((text) => String(text).toLowerCase().includes(needle)))
  const roots = list.filter((row) => !row.parentIds?.some((id) => list.some((parent) => parent.id === id)))
  const selected = list.find((row) => row.id === selectedId) || list.find((row) => row.kind !== 'suggested') || list[0]
  const select = (id) => {setDesk({learnSelectedId:id});if(section === 'reports' || !list.some((row) => row.id === id))setSection('library')}
  const submit = async (event) => { event.preventDefault(); const value = question.trim(); if (!value) return; const result = await learnCapture(value); if (result && !result.errors?.length) setQuestion('') }
  return <div className="wb-study-page">
    <header className="wb-learning-header"><div><h1>学习脉络</h1><p>从一个问题出发，把追问、理解与复习连在一起。</p></div><div><button className="wb-btn" disabled={organizing} onClick={async () => {setOrganizing(true);await learnRunNow();setOrganizing(false)}}>{organizing ? '正在提交…' : '立即整理'}</button><button className="wb-btn is-ghost" onClick={() => setDesk({learnSettings:!settings})}>设置</button></div></header>
    {settings && <StorageSettings learn={learn} close={() => setDesk({learnSettings:false})} />}
    <form className="wb-study-capture" onSubmit={submit}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="记下一个想弄懂的问题…" aria-label="记下一个想弄懂的问题" /><button className="wb-btn" disabled={!question.trim()}>加入待整理</button></form>
    <Inbox rows={learn.inbox} />
    <nav className="wb-study-tabs" aria-label="学习视图">{[['library','学习网络',visible.length],['review','今日复习',due.length],['suggested','建议探索',entries.filter((row) => row.kind === 'suggested' && row.status !== 'ignored').length],['reports','学习日报',null],['ignored','暂不学习',entries.filter((row) => row.status === 'ignored').length]].map(([id,label,count]) => <button key={id} className={section===id?'is-on':''} aria-current={section===id?'page':undefined} onClick={() => setSection(id)}>{label}{count !== null && <span>{count}</span>}</button>)}</nav>
    {section === 'reports' ? <Reports entries={entries} select={select} /> : <div className="wb-learning-workspace"><aside className="wb-learning-outline"><input className="wb-filter" aria-label="搜索学习内容" value={filter} placeholder="搜索问题、概念或答案" onChange={(event) => setDesk({filter:event.target.value})} /><p>{section === 'review' ? '待复习的问题' : section === 'suggested' ? '建议不是结论，可选择探索或暂不学习' : '问题与延伸分支'}</p><ul>{roots.map((entry) => <Branch key={entry.id} entry={entry} entries={list} selected={selected?.id} select={select} />)}</ul>{!list.length && <p>这里暂时没有记录。记录问题或整理历史对话后，再从知识点开始追问。</p>}</aside>{selected ? <KnowledgeDetail key={`${selected.id}:${section}`} entry={selected} entries={entries} select={select} review={section === 'review'} /> : <div className="wb-study-empty"><h2>从一个想弄懂的问题开始</h2><p>整理已有提问后，选择知识点阅读、划线或追问，延伸的问题会在左侧连起来。</p></div>}</div>}
    <CandidatePreview />
  </div>
}
