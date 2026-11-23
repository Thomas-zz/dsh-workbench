export function mailSetupPrompt({ scriptPath, stateRoot, config = {} }) {
  return `请帮我配置 DSH 工作台的邮箱接入，使用 IMAP 只读连接我指定的邮箱。

配置脚本路径（作为命令独立参数传入）：${JSON.stringify(scriptPath)}
工作台数据目录（所有操作都显式传 --state-root）：${JSON.stringify(stateRoot)}
当前邮箱：${config.address || config.user || '尚未指定'}。

请按以下步骤完成：
1. 读取脚本 --help 和 status。先确认我要使用的邮箱；不要根据浏览器里其他已登录账号替我选择。优先使用已有配置，不直接编辑或覆盖 state.json、mail-account.json。
2. 从邮箱服务商的官方文档确认 IMAP 主机、端口、TLS 方式和开通步骤。使用 TLS 或 STARTTLS，不能关闭证书校验。如果服务商要求 OAuth 而不支持应用密码，说明当前工作台尚不支持，不要绕过账号安全策略。
3. 需要开通 IMAP 或申请应用专用密码时，给我官方操作入口。授权码不要发进聊天、截图、命令行参数或日志；可由我在工作台「邮箱接入 → 手动配置」的密码框输入，或者在我授权后，从本机已有安全凭证来源通过标准输入传给脚本 --password-stdin。不要把秘密写进临时脚本或共享文件。
4. 使用脚本 configure --state-root <上面目录> --host <IMAP主机> --port <端口> --tls-mode <tls或starttls> --user <登录账号> --address <我的收件地址> --folder INBOX。已有同一账号的密码可保留；需要新密码时追加 --password-stdin。脚本仅在真实连接并以只读方式打开文件夹成功后保存，失败保留原配置。不要让终端回显密码。
5. 再运行 check --state-root <同一目录>，必须 status=ready 才算完成。零封邮件是正常结果，但不能用“配置已保存”代替连接成功。不要读取邮件正文、发送/删除邮件或改变已读状态来测试。
6. 回报邮箱、服务器、连接结果，让我回工作台点击「检查连接」。如果新版接口尚未加载，提醒重启 DSH。不要自动触发邮件整理或开启自动收取；需要我主动选择，因为邮件正文会交给当前整理模型分析。

本机授权码由工作台保存在权限为 0600 的独立文件中，不进入事项数据、返回结果或配置 Prompt。已有账号的收取进度和任务应保留。`
}
