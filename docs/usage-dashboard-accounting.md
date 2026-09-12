# 用量看板：记账口径与两个已知陷阱

本文记录 2026-09-12 那次"数字对不上"的排查结论。三件事互相纠缠，任何一件单独
看都会得出错误结论，所以放在一起写。

## 1. 生效的是哪一份代码（先查这个）

磁盘上可能同时存在多份克隆，**只有 profile 依赖里写的那份生效**：

```powershell
(Get-Content "$env:USERPROFILE\.dsh\profiles\web\package.json" -Raw | ConvertFrom-Json).dependencies
# 期望看到：@captain1275/dsh-usage-dashboard : link:C:/Users/19161/Documents/dsh-work/packages/dsh-usage-dashboard
```

同名的 parent-level fallback（`%USERPROFILE%\.dsh\profiles\node_modules\@captain1275\`）
会被 profile 自己的 `node_modules` **遮住**：只看 fallback 会得出"插件指向 A"的
错误结论。2026-09-12 的教训就是改了一整天的 `dsh-ui-web/` 克隆，而 GUI 加载的是
仓库根目录的 `packages/`。

## 2. 0.1.5 换了 sessionPersistence 的接口

| | 接口 |
| --- | --- |
| 0.1.1 | `listSnapshots()` + `readFrom(id, 0)` |
| 0.1.5 | `list()` + `open(id,'read')` + `handle.read()` + `handle.close()` |

只探测旧名字的插件在 0.1.5 上会**静默空转**：`scanAndBackfill` 立刻返回空，
宿主把扫描水位写成 `{}`、报 0 个会话，而且不告警（告警只在服务整个缺失时才打）。
于是看板显示的是"迁移兜底值"而不是重建后的真值。

`scan.ts` 现在两种形状都支持，`canScan()` 是唯一入口，形状不认识时宿主显式告警
（`[usage-dashboard] sessionPersistence has no readable API ...`）。判断补录是否
真的跑过，看 `~/.dsh/usage.json` 里会话行的 `authority`：`scan` = 日志已接管，
`live` = 只有 recorder 上报。

## 3. 记账：单账本 + 派生聚合（v2）

v1 同时维护两个账本：`bySession` 按最新快照覆盖，`byDay`/`byModel`/`total` 按
「新快照 − 旧快照」只增不减地累加。客户端会话投影与宿主日志 fold 对同一会话只要
报出不同数字，差值就被反复重加 —— 实测总费用虚高 3.03 倍、输出 token 9.6 倍、
调用数 4.6 倍（单日 73,781 次调用 > 全部会话累计 20,859 次）。

v2 的不变量：

- `bySession.days`（日 -> 模型 -> 桶）是**唯一真相**，会话行合计恒等于其 days 之和；
- `byDay`/`byModel`/`total` **不落盘**，读时由会话行派生（`recomputeAggregates`）；
- 带 `days` 的记录只可能来自日志扫描：整行替换并标记 `authority: 'scan'`，此后
  recorder 上报不再参与 token/调用记账；
- 会话费用按 `days` **逐模型**计价（`sessionCost`），不能用行上的单一 `lastModel`
  —— 一个会话经常跨模型，实测某会话 1996 次 deepseek-flash + 421 次
  deepseek-v4-flash，用 lastModel 会把整段按通用档算成 ¥28（真值 ¥64）。

v1 -> v2 迁移是自动的：旧文件整份留档 `usage.json.v1-<ts>`，被污染的聚合桶丢弃，
旧累计挂到 `unattributed`（进总额与模型分布、不进按天图表），并清空扫描水位触发
全量重建。

## 4. 单价：官方表优先，且统一取高峰档

`cost.ts` 的 `DEEPSEEK_OFFICIAL_RATES` 是唯一入口，优先于 LiteLLM 快照与用户级
覆盖（`~/.dsh/usage-pricing.json`）。flash 家族（`deepseek-flash` 及模型目录里的
旧 id `deepseek-v4-flash` / `-vision-exp`）同价，pro 单独一档：

| 模型 | 缓存命中 | 缓存未命中 | 输出 |
| --- | --- | --- | --- |
| flash 家族（高峰） | 0.04 | 2 | 8 |
| `deepseek-v4-pro`（高峰） | 0.3 | 9 | 27 |

官方表分空闲/高峰两档，看板无法按时段记账，**统一取高峰**（保守上界）。因此
DeepSeek 部分的估算系统性高于官方账单约 1.88 倍 —— 这是口径选择，不是 bug。
要对齐账单需要按本地小时分桶（未实现）。官方调价时只改这一处常量。
