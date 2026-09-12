# @captain1275/dsh-web-access

DSH `/web` 斜杠命令插件。纯 host 插件，无浏览器半区。

## 它做什么

注册一个人类命令 `/web <指令>`（走官方 `ctx.commands` 机制，Web / TUI 输入斜杠即触发）。
命令本身不驱动浏览器：它把指令转成一条普通用户消息交给模型（与 `/plan [message]`
同款模式），模型下一步自动加载 web-access 技能，通过该技能脚本 `cdp.mjs`
（Node 原生 WebSocket 直连 CDP，零依赖）驱动真实 Chrome/Edge。

## 安装

```sh
dsh plugin --profile web add link:<repo>/packages/dsh-web-access
```

或手工把 `@captain1275/dsh-web-access` 加入 profile `web` 的
`package.json`（`link:` 依赖 + `dsh.profile.bundles`），再 `pnpm install`。

## 使用

```
/web 打开百度
/web 打开 https://example.com 并告诉我页面标题
/web 搜索 node.js 并把前三条结果列出来
/web 关闭浏览器
```

命令执行后模型会：启动浏览器（launch）→ 导航（navigate）→ 读取/交互
（content / eval / click / type）→ 截图（screenshot）→ 关闭（close），
全程参考技能 `SKILL.md` 的命令表。

## 构建

```sh
pnpm --filter @captain1275/dsh-web-access build
pnpm --filter @captain1275/dsh-web-access typecheck
```
