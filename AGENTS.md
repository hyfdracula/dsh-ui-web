# dsh-web-ui — 仓库规则

## 插件只能基于官方 NPM SDK 开发（禁止改 DSH 源码）

- 本仓库所有插件**禁止修改 DeepSeek Harness (DSH) 源码**（对官方源码 checkout 零写入），
  挂载只走 `cordis.patch.yml` + profile 机制。
- 开发**只能基于官方 NPM SDK**：`@deepseek-ai/*` 官方 NPM SDK 包（scope registry 为
  registry.npmjs.org，内测已结束），类型来源是各包 `devDependencies` 中的 SDK 包（node_modules 解析）。
- **禁止** tsconfig `extends` / `paths` / `references` 指向任何 DSH 源码 checkout
  （`test-zhu1090093659`、`~/.dsh/source/current` 等引用一律不得新增）。
- 构建预设统一用仓库内单一共享副本 `shared/tsdown.client.ts`，禁止在包内复制。
- 环境：若仍使用私有 scope 认证，需要 `NPM_TOKEN` 环境变量（真实令牌只放环境变量，勿提交）；
  当前 SDK 已结束内测，公开包通常可直接安装。
  认证配置：token 放**用户级 `~/.npmrc`**（`//registry.npmjs.org/:_authToken=${NPM_TOKEN}`，
  由 pnpm 展开环境变量）；**项目 `.npmrc` 只留 scope 映射**
  （`@deepseek-ai:registry=https://registry.npmjs.org/`）。注意：项目级 `.npmrc` 里的
  `${NPM_TOKEN}` 占位符在 pnpm 11 下不会被展开、被忽略，不承担认证职责，详见 `docs/plugins.md`。

### 例外：dsh-fork-adapt 一键适配目录

- 本仓库允许保留 **`dsh-fork-adapt/`** 作为 DSH 官方源码的本地补丁适配集。当前基线是
  0.1.5 checkout（`C:\Users\19161\deepseek-harness-next`，tag `dsh-v0.1.5-rc.2` = `fb2c4b9`），
  一个 fork commit 一个补丁：`010-fork-f1-f4-client-features` / `020-fork-f9-web-restart-launchers` /
  `030-fork-f7-glm-normalizer` / `040-fork-f6-turn-recovery`（全部 LF、无 BOM）。
  0.1.1 时代的 8 个补丁与旧启动器副本移入 `archive-0.1.1/`，逐条取代关系写在该目录的 README 与
  `FORK-CHANGES.md` 里。
- 该目录**不参与本仓库的插件构建与发布**，仅作为“克隆后一键重放”工具，使
  `https://github.com/hyfdracula/dsh-ui-web.git` 克隆即直接可用；补丁在用户本地 checkout 上
  `git apply` 重放，不改本仓库的插件源码边界。
- 用法：`powershell -File apply-fork-patches.ps1 -Check`（只读试算）、`-VerifyTree`（重放后与各
  fork commit 的树逐一比对）、`-Build` / `-Restart`（可选）；`regenerate-fork-patches.ps1` 从
  commit 重新生成（幂等，SHA256 不变）。
- 该例外仅限 `dsh-fork-adapt/` 目录；其余 `packages/` 仍严格遵守本节的 SDK-only 与零写入规则。

## 新包命名统一 dsh- 前缀

**此后新建的插件包（`packages/` 下新目录）一律以 `dsh-` 开头**（如 `dsh-aionui-panel`、
`dsh-task-board`）。既有包已全部更名对齐，新包直接沿用，不允许再出现不带 `dsh-` 前缀的
包目录。npm 包名沿用 `@deepseek-ai/dsh-*`（UI 类插件按惯例用 `@deepseek-ai/dsh-client-ui-*`）。

## 禁止使用 emoji

本仓库**禁止出现任何 emoji 字符**（含 Emoji_Presentation、变化选择符 U+FE0F、ZWJ 序列、
区域指示符、Dingbats/杂项符号等 Unicode Emoji 属性字符），覆盖所有文件类型：
代码、注释、README / 文档、UI 文案、脚本输出、提交信息均不得使用 emoji。

- 需要装饰性符号时，改用非 emoji 的普通字符（如 `×`、`-`、`*`），或直接去掉。
- 新提交前先检查：`git diff` 或全局搜索 Unicode Emoji 范围字符。

