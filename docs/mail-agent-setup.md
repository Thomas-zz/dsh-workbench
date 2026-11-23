# 邮箱 Agent 配置

在工作台「助手设置 → 邮箱接入」复制 Prompt，发给自己的 Agent 并说明邮箱。Prompt 包含当前宿主的脚本路径和数据目录。配置后回到工作台点击「检查连接」，它会重新读取外部 Agent 保存的配置。

## 命令

在包目录执行 `node scripts/mail.mjs --help`，实际操作使用 Prompt 给出的绝对脚本路径和数据目录：

```sh
node scripts/mail.mjs status --state-root <目录>
node scripts/mail.mjs configure --state-root <目录> --host <IMAP主机> --port 993 --tls-mode tls --user <账号> --address <收件地址> --folder INBOX
node scripts/mail.mjs check --state-root <目录>
```

新密码需要 `--password-stdin`，从已授权的本机安全凭证来源传入标准输入；不接收密码命令行参数，也不在交互式、会回显的终端里输入。用户也可以在「手动配置」的密码框输入。已有相同主机、登录账号的密码可以保留。

`configure` 先通过 TLS / STARTTLS 连接、以只读方式打开邮箱，成功后保存；失败保留之前的配置。结果仅包含连接状态、文件夹、邮件数量等元信息，无邮件正文。邮箱为空同样可以验证成功。独立凭证文件权限为 0600，不把密码存入事项 state 或接口返回。

连接检查不调用整理模型，不改变已读状态，不发送或删除邮件。自动收取默认关闭，已有偏好保持。主动收取时邮件正文会交给用户配置的整理模型。

当前接入方式为 IMAP 应用密码。需要 OAuth 的邮箱暂不支持；Agent 应根据所选服务商的官方文档指导开通，不关闭证书校验或绕过账号安全策略。

隔离预览的 Prompt 只能配置预览数据。日常使用请从实际 DSH 工作台复制；新增接入接口需要重启 DSH 后加载。
