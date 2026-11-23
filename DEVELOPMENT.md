# 工作台开发与发布

## 两个通道，一条主线

| 场景 | 代码和数据 |
|---|---|
| 日常桌面（包括维护者自己的桌面） | 使用公开 GitHub Release 的同一份版本包；沿用桌面自己的 profile、事项和本机设置。不链接源码，不跟踪 `main` 或 `latest`。 |
| 开发与验收 | 从最新公开 `main` 开短期功能分支，只推私有开发仓。真实宿主测试走本地 DSH Web；使用独立 HOME、DSH_HOME、profile、测试库和会话，不复制桌面数据或凭据。 |

公开 `main` 是共同的发布基线，不是所有用户自动跟随的安装通道。开发目录的 `origin` 指向私有仓，`upstream` 只读；公开发布用另一个干净克隆。不要把私有开发分支、备份 tag 或整个 Git 历史推到公开仓。**推送开发进度 ≠ 发布开源版。**

## 如何开发、验证

1. 在私有开发目录执行 `git fetch upstream`，从 `upstream/main` 新建 `dev/<功能>`。一个功能一个分支，频繁同步公开基线。个人路径、Vault、账户、会话和截图留在仓库外；专用适配和实验不上公开主线。
2. 使用与宿主兼容的 Node 和 DSH，运行 `npm ci`、`npm run build`、`npm run dev:web`。默认在浏览器打开；也可使用终端打印的**带临时令牌**的本机地址，进入工作台。不要分享令牌；设 `WB_WEB_NO_OPEN=1` 可不自动打开浏览器。默认 `127.0.0.1:4327`；`WB_WEB_PORT` 可覆盖，`DSH_BIN` 可指定 CLI。Ctrl+C 停止当前测试宿主。测试数据按开发目录持久化在 `~/.local/share/dsh-workbench-web/`；不要在里面配置生产账号。它隔离数据和默认凭据，不是操作系统沙箱。
3. 改 Host 后重启 **Web 测试宿主**；改前端后重新构建并刷新测试页。仅做 UI/样例验证可运行 `npm run preview`，它不是完整 DSH。真实模型测试需要另行授权；没有调用真实模型就不能宣称通过。
4. 功能就绪后，在公开克隆从最新 `main` 建候选分支，只应用审过的差异，重新提交，不合并私有分支的历史。检查**全部**待发布内容（代码、测试样例、文档、构建文件、包清单）是否有个人路径、业务数据、密钥或原始聊天。公开提交身份可用 GitHub noreply。真实凭据已泄露应先撤销或轮换；普通提交不会清除旧历史。

## 发布稳定版

- 先更新 `package.json` 与锁文件的版本，在干净候选目录运行 `npm ci`、`npm test`、`npm run build`、`git diff --check`，并用独立 Web profile 验证。不要从混有个人改动的开发目录打包。
- 合入公开 `main`；从准确的发布提交创建 `vX.Y.Z` 标签。用 `npm pack` 生成 `dsh-workbench-X.Y.Z.tgz`，检查包清单，并在不含开发依赖的空目录解压，验证 Host 导入、前端、语言包和 bundle patch。运行时依赖随包附带；不需要在桌面目录执行 npm 安装。
- 生成 `SHA256SUMS`（如 `shasum -a 256 dsh-workbench-X.Y.Z.tgz > SHA256SUMS`）。把**同一份**包和校验文件上传到 GitHub Release，校验发布资产后再切桌面。不要重打同版本或用 GitHub 自动生成的源码压缩包代替插件包。
- 安装时下载该 Release 的 `.tgz` 和 `SHA256SUMS` 至同一目录，运行 `shasum -a 256 -c SHA256SUMS`。解压到全新的、按版本命名的目录（如 `tar -xzf dsh-workbench-X.Y.Z.tgz -C <版本目录> --strip-components=1`）。让桌面 profile 的 `dsh-workbench` 依赖指向此目录并启用该 bundle；不要链接开发目录。保留上一版和 profile 备份，先结束手头工作再重启桌面加载 Host。
- 回退只改插件指向，不回退或覆盖事项数据库；跨不兼容的数据迁移需单独设计回退。紧急补丁从受影响的发布标签分支修复并同步到 `main`。每次发布后，开发分支重新对齐公开主线，不养另一条长期产品线。
