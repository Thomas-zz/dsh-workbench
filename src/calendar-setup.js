// A portable handoff for the user's own agent. Paths come from the running host.
export function calendarSetupPrompt({ scriptPath, stateRoot, config = {} }) {
  return `请帮我配置 DSH 个人工作台的飞书接入，用我指定的飞书机器人/应用读取我本人的日历。

目标：工作台知道关联的是哪个应用，并能只读同步我的个人日程。机器人消息通道在线不等于个人日历已授权；本次无需创建新的聊天机器人或连接 WebSocket。

当前关联：${config.appName || '尚未指定'}；App ID：${config.appId || '尚未指定'}。
工作台配置脚本路径（作为命令的独立参数传入，不要直接拼接 shell）：${JSON.stringify(scriptPath)}
工作台数据目录（所有操作都显式传 --state-root）：${JSON.stringify(stateRoot)}

请按以下步骤直接帮我完成：
1. 先读取脚本 --help，并查看本机 lark-cli 的 config、auth、calendar 帮助或对应技能。优先复用我指定或已经使用的飞书机器人/应用；若有多个候选且我未指定，列出名称和 App ID 让我选择。不要仅凭截图中的示例名称替我选应用。
2. 确认该应用的 App ID、可读名称以及一个明确的 lark-cli profile。已有 profile 可直接复用；从其他 Agent 复用应用前，确认其支持的授权/导出方式。不要擅自读取 ZCode 的内部凭证数据库或覆盖它的机器人配置，不要修改全局默认账号。没有受支持的复用方式就引导我为指定应用配置独立 profile，不要假装只填机器人名字就能连通。
3. 检查所选应用的用户身份和日历读取权限。个人日历必须使用 --as user；不要用 bot 自己的空日历作为成功证据。只申请本次读取需要的权限，按 CLI 错误或 schema 确认具体 scope，不要申请全部权限。需要我授权时，给我官方链接和二维码；我完成后，由你继续完成登录与检查。
4. 用此脚本 configure --state-root <上面的数据目录> --profile <明确的profile> --app-id <确认的App ID> --name <应用名称> --calendar-id primary。脚本会核对 profile 对应的 App ID 并真实读取日历，成功才保存启用。需要指定日历时使用确认过的 calendar ID；CLI 不在宿主 PATH 时，可通过 --cli-path 指定其绝对路径。
5. 再运行此脚本 check --state-root <同一目录>，确认 status 为 ready。零日程可以是正常结果，但必须是指定应用下的用户日历读取成功。不要把“已保存配置”当成“已连接”。
6. 回报关联应用名称、App ID、授权结果及检查结果，让我回工作台点击“检查连接”。如果宿主尚未加载新版接口，说明需要重启 DSH，不要用旧页面的状态声称验证成功。

密钥和 token 只交给 CLI 的安全凭证存储，不贴进聊天、截图、Prompt 或工作台 state。不要替我创建会议、发送消息或改动日程。不要手工覆盖整个 state.json，使用脚本保留我的原有事项和其他设置。`
}
