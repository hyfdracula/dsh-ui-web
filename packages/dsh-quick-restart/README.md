# dsh-quick-restart

侧栏底部的 **「重启 DSH」** 入口：点一下排队，宿主空闲时由进程外的巡检自动重启，
整个过程不需要任何人手动参与。

> **本机状态（2026-09-12 23:05）：已卸载。** 用户明确表示不需要这个侧栏按钮，
> 它已从 `~/.dsh/profiles/web` 的依赖与 bundles 中移除（junction 也删了），源码保留在
> 本仓库，需要时按下面「安装」一节装回。无人值守重启**不依赖**本插件：那是计划任务
> `DSH Restart Agent` + `dsh-restart-agent.ps1` 的职责，仍在运行。

## 它怎么工作

```
侧栏按钮 ──POST /api/quick-restart/request──▶ 写 dsh-restart.request
                                                   │
        （计划任务 DSH Restart Agent，每 2 分钟）──▶ 读到请求
                                                   │
                              宿主自己的 session/list：有回合在跑？
                                                   │ 空闲
                                                   ▼
                          dsh-web-restart.ps1：停 → 起 → 等授权栅栏 → 替换窗口
```

- **宿主半区**（`src/index.ts`）：只挂两个同源 JSON 端点，`/state` 读状态、`/request`
  写请求文件；不碰官方任何服务，也不自己做重启动作。
- **浏览器半区**（`src/client/*`）：在官方 `sidebar.footer.action` 座位注册一个按钮，
  每 15 秒读一次 `/state` 显示是否已排队。
- **为什么写文件而不是直接重启**：重启要杀掉本插件所在的宿主进程，只有进程外的巡检
  （计划任务，宿主挂了它也在）能可靠地做这件事；插件只负责"排队 + 显示状态"。

## 配置

`cordis.patch.yml` 里的 `repoRoot` 决定请求文件与巡检日志的位置：

```yaml
- insert:
    - id: ui-quick-restart
      name: '@captain1275/dsh-quick-restart'
      config:
        repoRoot: C:\Users\19161\deepseek-harness-next
```

## 端点

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/quick-restart/state` | `{ ok, pending, requestedAt, note, keeperTail }` |
| POST | `/api/quick-restart/request` | 请求体 `{ note? }`，写请求文件并返回同一结构 |

## 安装

```powershell
node C:\Users\19161\deepseek-harness-next\apps\cli\lib\bin.js plugin --profile web add link:C:/Users/19161/Documents/dsh-work/packages/dsh-quick-restart
```

装完需要一次宿主重启才会出现（`dsh plugin` 会把它加进 profile 的 bundles）。

## 不随聚合包发布

本包依赖**本机 checkout** 里的巡检脚本与请求文件路径（`repoRoot` 配置），对别人的机器没有意义，
因此**不加入** `dsh-web-ui-all` 聚合包，也不在 README 的插件表里；它属于本机自用的运维插件。
