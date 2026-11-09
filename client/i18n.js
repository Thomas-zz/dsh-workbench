// 界面词条：中文优先，英文跟随宿主语言。t('...{x}...', {x}) 做插值。
const DICTS = {
  zh: {
    '工作台': '工作台', '今天': '今天', '全部': '全部', '收件箱': '收件箱',
    '记一句话，回车收进灵感收件箱': '记一句话，回车收进灵感收件箱',
    '灵感': '灵感', '任务': '任务', '收进收件箱': '收进收件箱', '直接建任务': '直接建任务',
    '进行中': '进行中', '今天到期': '今天到期', '逾期': '逾期', '焦点': '焦点',
    '今日完成 {n} 件': '今日完成 {n} 件', '待办': '待办', '受阻': '受阻', '已完成': '已完成',
    '待验收': '待验收', '验收': '验收', '忽略': '忽略', '转任务': '转任务',
    '子代理': '子代理', '工作流': '工作流', '后台任务': '后台任务',
    '已停靠灵感「{text}」': '已停靠灵感「{text}」', '已丢弃灵感': '已丢弃灵感',
    '灵感已转为任务「{title}」': '灵感已转为任务「{title}」',
    '验收完成，剩余 {n} 条': '验收完成，剩余 {n} 条',
    '标题': '标题', '备注': '备注', '截止': '截止', '优先级': '优先级', '低': '低', '中': '中', '高': '高',
    '状态': '状态', '标签': '标签', '今天焦点': '今天焦点', '删除': '删除', '保存': '保存', '取消': '取消',
    '编辑任务': '编辑任务', '来源会话': '来源会话', '灵感收件箱是空的': '灵感收件箱是空的',
    '没有待验收，并行任务的结果完成后会自动出现在这里': '没有待验收，并行任务的结果完成后会自动出现在这里',
    '今天还没有安排；对话里提到的事情会自动登记进来': '今天还没有安排；对话里提到的事情会自动登记进来',
    '撤销': '撤销', '已撤销：{label}': '已撤销：{label}', '刷新': '刷新',
    '加载中…': '加载中…', '工作台加载失败：{error}': '工作台加载失败：{error}', '重试': '重试',
    '刚刚': '刚刚', '{n} 分钟前': '{n} 分钟前', '{n} 小时前': '{n} 小时前', '{n} 天前': '{n} 天前',
    '个人工作台': '个人工作台', '搜索过滤…': '搜索过滤…', '展开': '展开', '收起': '收起',
    '来自对话': '来自对话', '工作台面板': '工作台面板',
    '执行': '执行', '环节': '环节', '挂靠执行': '挂靠执行', '挂靠任务': '挂靠任务',
    '外部执行者': '外部执行者', '暂无进展记录；接手的会话会自动汇报到这里': '暂无进展记录；接手的会话会自动汇报到这里',
    '已验收': '已验收', '已忽略': '已忽略', '跳转会话': '跳转会话', '来自 ZCode': '来自 ZCode',
    '昨日完成': '昨日完成', '（逾期）': '（逾期）', '周日': '周日', '周一': '周一', '周二': '周二',
    '周三': '周三', '周四': '周四', '周五': '周五', '周六': '周六',
    '工作台 {n}': '工作台 {n}', '完成「{title}」': '完成「{title}」',
  },
  en: {
    '工作台': 'Workbench', '今天': 'Today', '全部': 'All', '收件箱': 'Inbox',
    '记一句话，回车收进灵感收件箱': 'Capture a thought, press Enter to park it',
    '灵感': 'Idea', '任务': 'Task', '收进收件箱': 'Park idea', '直接建任务': 'Create task',
    '进行中': 'In progress', '今天到期': 'Due today', '逾期': 'Overdue', '焦点': 'Focus',
    '今日完成 {n} 件': '{n} done today', '待办': 'To do', '受阻': 'Blocked', '已完成': 'Done',
    '待验收': 'To review', '验收': 'Accept', '忽略': 'Dismiss', '转任务': 'To task',
    '子代理': 'Subagent', '工作流': 'Workflow', '后台任务': 'Job',
    '已停靠灵感「{text}」': 'Parked idea “{text}”', '已丢弃灵感': 'Idea dropped',
    '灵感已转为任务「{title}」': 'Idea promoted to task “{title}”',
    '验收完成，剩余 {n} 条': 'Reviewed, {n} left',
    '标题': 'Title', '备注': 'Note', '截止': 'Due', '优先级': 'Priority', '低': 'Low', '中': 'Med', '高': 'High',
    '状态': 'Status', '标签': 'Tags', '今天焦点': 'Today focus', '删除': 'Delete', '保存': 'Save', '取消': 'Cancel',
    '编辑任务': 'Edit task', '来源会话': 'Source session', '灵感收件箱是空的': 'The idea inbox is empty',
    '没有待验收，并行任务的结果完成后会自动出现在这里': 'Nothing to review. Finished parallel runs will land here automatically.',
    '今天还没有安排；对话里提到的事情会自动登记进来': 'Nothing planned today. Tasks mentioned in chats land here automatically.',
    '撤销': 'Undo', '已撤销：{label}': 'Undone: {label}', '刷新': 'Refresh',
    '加载中…': 'Loading…', '工作台加载失败：{error}': 'Workbench failed to load: {error}', '重试': 'Retry',
    '刚刚': 'just now', '{n} 分钟前': '{n}m ago', '{n} 小时前': '{n}h ago', '{n} 天前': '{n}d ago',
    '个人工作台': 'Personal workbench', '搜索过滤…': 'Filter…', '展开': 'Expand', '收起': 'Collapse',
    '来自对话': 'from chat', '工作台面板': 'Workbench panel',
    '执行': 'Runners', '环节': 'Progress', '挂靠执行': 'Linked runs', '挂靠任务': 'Attached task',
    '外部执行者': 'External runner', '暂无进展记录；接手的会话会自动汇报到这里': 'No progress yet; sessions that take this task will report here automatically.',
    '已验收': 'Accepted', '已忽略': 'Dismissed', '跳转会话': 'Open session', '来自 ZCode': 'from ZCode',
    '昨日完成': 'Done yesterday', '（逾期）': ' (overdue)', '周日': 'Sun', '周一': 'Mon', '周二': 'Tue',
    '周三': 'Wed', '周四': 'Thu', '周五': 'Fri', '周六': 'Sat',
    '工作台 {n}': 'Workbench {n}', '完成「{title}」': 'Complete “{title}”',
  },
}

let current = 'zh'

export function setLanguage(id) {
  current = String(id || '').toLowerCase().startsWith('en') ? 'en' : 'zh'
}

export function lang() {
  return current
}

export function t(key, params) {
  const dict = DICTS[current] ?? DICTS.zh
  const text = dict[key] ?? DICTS.zh[key] ?? key
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
}

export function useLang() {
  // 语言切换由 index.jsx 重新挂载侧栏入口处理；组件内目前不需要额外订阅。
}
