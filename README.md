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
对话输入区还有停靠条，显示当前会话名下未完结的任务，可直接勾掉。

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
  CLI 共用；多进程按 mtime 重载，写入串行。完成 90 天 / 处理过 30 天的记录自动清理。
- 行配置（`cordis.patch.yml` 里该行的 `config`）：
  - `watchJobs`（默认 `true`）：是否收集后台 job 的完成事件。
  - `briefingHour`（默认 `9`）：晨报推送的整点小时（0-23）。
  - `briefingSessionId`（可选）：晨报推送的目标会话；缺省自动取最近活跃的工作台会话。
  - `briefingPush`（默认 `true`）：设为 `false` 关闭会话推送（面板晨报卡不受影响）。

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
