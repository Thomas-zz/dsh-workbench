# 飞书接入：交给自己的 Agent 配置

工作台只需要明确关联哪个飞书应用，以及确认能读取本人的日历。默认入口不要求用户填写 profile、日历 ID 或密钥。

## 使用

1. 重启 DSH，打开工作台的「飞书日历」。
2. 点击「复制配置 Prompt」，发给自己的 Agent，并告诉它要关联哪个机器人/应用。
3. 按 Agent 提供的流程完成必要的用户授权。
4. 回工作台点击「检查连接」。成功后显示应用名称、App ID 和「日历已连接」。

Prompt 由当前宿主生成，含配置脚本的绝对路径和实际数据目录。隔离预览生成的 Prompt 指向预览数据，不能用于配置日常工作台。

## Agent 使用的命令

从包目录执行 `node scripts/calendar.mjs --help`。实际配置时使用 Prompt 中的绝对脚本路径和 `--state-root`：

```sh
node scripts/calendar.mjs status --state-root <工作台数据目录>
node scripts/calendar.mjs configure --state-root <工作台数据目录> --profile <明确账号> --app-id <cli_xxx> --name <应用名称> --calendar-id primary
node scripts/calendar.mjs check --state-root <工作台数据目录>
```

如果 DSH 的 PATH 中没有 `lark-cli`，配置时增加 `--cli-path <CLI绝对路径>`。脚本不接收应用密钥；密钥与 token 由 CLI 的凭证存储管理。不得把 `lark-cli config show` 的原始输出贴到聊天，因为它可能包含密钥。

`configure` 先核对所选 profile 的 App ID，再以用户身份实际读取未来七天日历，成功后才合并保存配置，保留原有事项与其他设置。失败不覆盖现有关联。`check` 返回连接状态和事件数量，不返回事件内容。无事件也可以成功，但必须真实读取通过。

## 与 ZCode 等 Agent 的关系

可以复用用户指定的同一个飞书应用；消息通道连接和个人日历授权分别验证。工作台不接管机器人消息通道，也不要求新建机器人。当前没有实现 ZCode 凭证自动导入；已有受支持的 profile 可复用，否则由用户的 Agent 为指定应用完成独立配置。

不根据示例截图擅自选应用；多个候选时让用户选择。需要授权时申请最小日历读取权限，不改全局默认账号，不创建会议、发送消息或写回日程。

## 验收记录 · 2026-11-16

- 构建通过；Node 测试 138 项通过。
- CLI 集成测试在隔离目录中验证指定 profile、App ID、用户身份和跨进程读取，使用模拟 CLI，不代表真实飞书授权完成。
- 浏览器验收通过：高级设置默认收起、复制 Prompt 成功、展开查看内容包含当前宿主路径与数据目录、未配置时检查给出明确提示。截图保存在本次工作台视觉产物目录的 `workbench-feishu-agent.png`。
- 真实 DSH 插件目录链接到本地包，前端产物已构建。新增 Host 接口需要重启加载；本轮未重启实际 DSH、未修改真实飞书凭证。
