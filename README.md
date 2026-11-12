# dsh-workbench · 个人工作台

DeepSeek Harness 的插件：一个以 todo 为核心、尽量自动化的个人工作台。DSH 只是入口，
工作台是你的全局视角——DSH 会话、ZCode 会话产生的任务汇入同一份看板。装在侧栏里，
打开是「今天」视图；事情由各会话里的 agent 自动登记，并行任务的结果自动汇成待验收，
灵感一句话停靠——你几乎不用手动维护。

## 它解决什么

- **事情多且并发**：任务天然支持多个「进行中」，不强迫聚焦单一任务。
- **验收不漏**：子代理（subagent）、工作流（workflow）、后台任务（job）完成时自动生成待验收卡
  （job 为 settled 事件推送，短任务不漏），卡片带结果摘要，不用跳会话就能判断；每个会话每一步
  都能看到待验收数量，agent 会在回合收尾时提醒。
- **老板视图**：接手任务的会话用 `workbench_update` 的 `progress` 汇报环节；subagent/workflow/job
  的完成结果自动挂靠到该会话正在执行的任务。展开任务即见「谁在执行 / 做到哪 / 挂靠了哪些结果」。
- **灵光一现不打断**：对话里冒出题外想法，agent 自动停靠进灵感收件箱，然后继续原任务。
- **每天从这里开始**：「今天」= 进行中 ∪ 今天及以前到期 ∪ 焦点；顶部有零调用的晨报卡，
  到点还会把晨报推进会话让 agent 给出当日建议。
- **跨入口汇聚**：ZCode 等外部会话通过 `scripts/wb.mjs` 写入同一份状态，任务带 Zcode 标识。

## 视图

| 视图 | 内容 |
|---|---|
| 今天 | 晨报卡、快速捕获框、进行中 / 今天到期 / 焦点、今日完成 |
| 全部 | 按状态分组（待办 / 进行中 / 受阻 / 已完成），支持过滤 |
| 收件箱 | 待验收卡（展开看摘要、点会话号跳来源会话）+ 灵感（转任务 / 丢弃） |

任务展开的编辑器里有老板视图三件套：**执行**（哪些会话/外部执行者在做）、
**环节**（progress 时间线）、**挂靠执行**（自动关联到这个任务的验收结果）。
对话区左上角还有浮动卡片，显示当前会话名下未完结的任务，可直接勾掉；点标题可收起成小胶囊。

## Agent 工具（所有 DSH 会话可用）

- `workbench_add` — 登记任务（对话中提到新事项时 agent 自动调用）
- `workbench_update` — 更新任务（完成、推进、改期、改优先级/焦点），`patch.progress` 一句话汇报环节
- `workbench_query` — 查询 today / all / reviews / ideas 视图
- `workbench_capture_idea` — 一句话停靠灵感
- `workbench_review` — 处置待验收（accept / dismiss / promote）

系统提示同时注册了行为规则（自动登记、进展挂靠、停靠灵感、收尾提醒）和每步刷新的活状态计数。

## 每日晨报

- **面板晨报卡**（零模型调用）：今天视图顶部，昨日完成 / 今日到期 / 受阻 / 待验收 / 灵感。
- **会话推送**：到 `briefingHour`（默认 9 点，晚启动会补发）把晨报作为触发卡送进目标会话，
  agent 简短确认并对受阻/逾期项给出建议顺序（每天一轮调用）。目标会话默认取工作台里最近
  活跃的会话，也可用 `briefingSessionId` 指定。标记先于推送（跨进程宁漏勿重）。

## 学习模块（learn）

自动收集你在各 AI 工具里问过的知识性问题，判断分类并回答后写入 Obsidian，每晚出日报。
不实时记录，也不改会话内容。预筛只保留概念、原理、方法和区别类问题；整理 agent 再判断是否能脱离本次任务独立复习。
任务进度、界面反馈、一次性排障和催办不写入学习卡。没有可靠答案时跳过该条，不生成只有问题的笔记。

**数据源**（可开关，默认全开）：ZCode（`~/.zcode` 输入历史库）、DSH（`~/.dsh` 会话记录）、
Claude Code（`~/.claude/history.jsonl`）、Codex（`~/.codex` 会话记录）。扫描纯代码零模型成本，
手动或定时整理时调用所选模型（定时默认 22 点，费用按对应模型服务计费）。

四种触发方式：

| 方式 | 说明 |
|---|---|
| 对话里说「记一下这个问题」 | agent 调 `workbench_learn_capture` 一句话进收件箱，不打断当前任务 |
| `/学习任务` 指令 | 武装本会话；下一条消息被 Host `agent/pre-step` 拦截，**零模型调用**直接记为提问 |
| 每晚定时（默认 22 点） | 扫描候选 → 触发卡推进目标会话 → agent 分类整理 → 写笔记与日报 → 简短回执 |
| `/闲时任务` 写「做一次学习整理」 | 复用闲时队列到点执行，与定时完全同一套指令 |

**Agent 工具**：`workbench_learn_collect`（扫描候选，零成本）、`workbench_learn_write`
（批量写 Obsidian 笔记 + 更新日报 + 消化收件箱）、`workbench_learn_capture`（手动记录）、
`workbench_learn_decide`（已掌握/忽略，同步笔记标记）。

**分类口径**：weak 弱项补强（反复问、核心概念不清）/ know 了解即可 / term 名词解释；
同概念（concept 字段）出现 ≥2 次未掌握进日报「查漏补缺」。

**面板「学习」视图**：左侧是问题与延伸分支，右侧阅读答案、查看来源与关联知识。点击知识点后输入追问，
会新建标题为「学习 · 问题」的 DSH 会话；原知识、选中原文和问题一并传入。
插件监听这个学习会话的持久消息事件：后续真人输入自动成为上一问题的延伸节点，回答自动回收到当前节点。
模型可以用 `workbench_learn_answer` 保存精炼答案；自动回收不依赖模型调用工具。
分支表示“从这里继续问”，不自动断言两个概念存在学术上的因果关系。跨主题知识可由 `relatedIds` 横向关联。

在原问题或答案中选中文字，可保存划线，也可带着划线追问。今日复习先隐藏答案，再展开核对并安排下次复习。
学习日报与笔记原文都在控制台内阅读；日报里的知识链接跳回知识点。「在 Obsidian 打开」使用经过文件存在性校验的绝对路径 URI，
外部应用调用仍取决于本机协议关联。文件移动不影响 state 中已记录答案；同步失败会显示错误并可手动重试。

**查漏补缺**：扫描仍不调用模型。整理工具现在把完整候选、近期理解线索、同会话相邻输入与已有知识点 ID 返回给模型，
而不是只有计数。明确提问与 AI 建议分别保存；建议必须带 `kind: suggested`、`evidence` 依据及来源关系，
不能仅凭提及某概念就断言用户不懂。每轮提示模型最多建议三项，实际质量取决于所选模型，需要用户判断。
来源只覆盖已启用的本机记录；这是上下文线索分析，不是完整对话的能力测评。

设置可选择 Obsidian 库路径、库内目录、整理时间、扫描源与模型。指定模型后，手动和定时整理使用独立 DSH 会话，
不修改日常会话或全局默认。整理会话标题为「学习整理 · 日期」。追问沿用学习设置的指定模型，未指定时使用 DSH 默认模型。
「跟随目标会话」只影响未指定模型时的整理推送。所选模型不可用时不静默替换。
现有卡片自动兼容为独立知识点；新关系、划线与会话绑定保存在工作台 state，笔记同步为 Markdown。
切换库只影响新笔记，旧知识点保留原库路径。Host 行配置 `stateRoot` 可用于隔离验收数据，日常不必配置。

**生效边界**：更新 Host 后必须重启 DSH，刷新页面只更新客户端。新建会话自动命名，历史未命名会话不会自动改名。
仅自动记录从工作台发起且当前 Host 正在处理的学习对话；导入其他历史对话仍通过学习整理完成。

**Obsidian 落盘**（vault 根路径走行配置 `learnVaultPath`，缺省指向主力库）：

```
<notesDir>/YYYY-MM-DD-标题.md     学习笔记（frontmatter + 原问题/答案/为什么重要）
<notesDir>/日报/YYYY-MM-DD.md      学习日报（全天新增、今日待复习、查漏补缺、弱项清单）
```

外部进程（ZCode 等）走 CLI：`node scripts/learn.mjs scan --hours 48`（预览候选）、
`add '问题'`（补录）、`status`（统计与弱项）。

## ZCode / 外部会话汇入

`scripts/wb.mjs` 与插件共享同一份 `state.json`（store 按 mtime 重载，多进程安全）：

```bash
node scripts/wb.mjs add '整理 pitch 分享内容' --priority 2 --focus   # 幂等：同名未完结任务跳过
node scripts/wb.mjs progress pitch '素材已抓取，开始排版'             # 追加环节时间线（actor=ZCode）
node scripts/wb.mjs update pitch --status done
node scripts/wb.mjs idea '给工作台加个统计页'
node scripts/wb.mjs query today
```

约定：一次用户目标登记一条任务（不逐条镜像 todo 项），里程碑用 progress 汇报，
全部完成且用户验收后置 done。`DSH_HOME` 环境变量可改数据根目录。

## 数据与配置

- 数据在本机 `$DSH_HOME/workbench/state.json`（默认 `~/.dsh/workbench/`），桌面版、网页版与
CLI 共用；多进程按 mtime 重载，写入串行。已完成任务与已处理验收按保留期清理；学习卡长期保留。
- 行配置（`cordis.patch.yml` 里该行的 `config`）：
  - `watchJobs`（默认 `true`）：是否收集后台 job 的完成事件。
  - `briefingHour`（默认 `9`）：晨报推送的整点小时（0-23）。
  - `briefingSessionId`（可选）：晨报推送的目标会话；缺省自动取最近活跃的工作台会话。
  - `briefingPush`（默认 `true`）：设为 `false` 关闭会话推送（面板晨报卡不受影响）。
  - `learnVaultPath`：旧版行配置的 Obsidian 库路径，面板中设置的路径优先；都未设置时默认本机主力库。
  - 学习模块设置（库路径 `vaultPath`、笔记目录 `notesDir` 默认 `AI/Agent学习`、整理时间 `reportHour` 默认 22、
    扫描源 `sources`、推送开关 `reportPush`、目标会话 `reportSessionId`）在面板「学习 → 设置」
    修改，存 state 即时生效。

## 开发

```bash
npm install        # 仅 devDependencies: esbuild
npm test           # Host 逻辑 + CLI 测试（node --test）
npm run build      # 打包 client/ → dist/client.js
npm run watch      # 监听 client/ 变更重新打包
```

目录：`src/` Host 半片（存储、ops、工具、提示、收集器、晨报、HTTP），`client/` 界面，
`scripts/wb.mjs` 外部汇入 CLI，`scripts/build.mjs` 打包脚本。改了 `src/` 要重启
DeepSeek Harness；改 `client/` 重新 build 后刷新页面即可。

## 路线图（未完成）

- 面板内嵌对话栏（对着任务直接派活）
- `/workbench` 人类命令
- 任务统计页（吃灰榜、完成趋势）
