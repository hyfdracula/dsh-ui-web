# 0.1.1 时代补丁归档（不可用于 0.1.5）

> 本目录**不属于** `dsh-fork-adapt/` 的有效适配集：`apply-fork-patches.ps1` 只读取
> `NNN-fork-*.patch` 四个文件，永远不会 glob 到这里。
> **不要对任何 checkout 执行本目录里的 `*.patch`。**

## 为什么归档

这 8 个补丁是 0.1.1-rc.1 时代的产物：基线是 `528c682e061696f5a160f363f236ecbf53cbd006`
（0.1.1-rc.1），本地 checkout 是 `C:\Users\19161\deepseek-harness`。2026-09 换到
0.1.5-rc.2 checkout（`C:\Users\19161\deepseek-harness-next`）后：

- 一部分内容已被上游吸收（0.1.5 原生就有），
- 一部分被 fork 的 0.1.5 真实提交重新实现（见 `../FORK-CHANGES.md` 的 4 个 `NNN-fork-*.patch`），
- 一部分按决定退役（070 无限制附件）。

因此它们**不能**应用到 0.1.5 checkout：`index` 行的 blob 与上下文都对不上 0.1.5 树。

## 关于行尾（F12）

本仓库 `.gitattributes` 有 `*.patch text eol=lf`，工作树里的这 8 个文件当前均为 LF
（逐字节实测 CR=0），所以“CRLF 补丁套不上 LF 工作树”这个机械故障在 2026-09-12 的
`fdeded2` 之后已不再复现。现在它们套不上的原因是**基线不同**（0.1.1 树 vs 0.1.5 树）。
`fdeded2` 的实测记录：8 个补丁在 0.1.1-rc.1 上 8/8 可套，在 0.1.5-rc.2 上只有 070 可套，
而 070 已按决定退役。

## 逐个处置

| 旧补丁 | 处置 | 替换/说明 |
| --- | --- | --- |
| `010-settings-root-two-phase-close.patch` | 被新补丁取代 | `010-fork-f1-f4-client-features.patch`（F1，0.1.5 的 SettingsRoot.tsx/.module.css） |
| `020-model-select-no-reasoning-effort.patch` | 被新补丁取代 | `010-fork-f1-f4-client-features.patch`（F2，0.1.5 的 ModelSelect.tsx + 测试） |
| `030-attachment-file-sync.patch` | 已被上游吸收 | 0.1.5 base 已有 `attachment-local/src/file-store.ts`、`FileAttachmentRef`、`saveFile/readFileStream` |
| `040-host-content-file.patch` | 已被上游吸收 | 0.1.5 base 的 `packages/llm/llm/src/types.ts` 已有 `FileBlock` 与 `ContentBlockMap['file']` |
| `050-ui-conversation-file.patch` | 部分取代 / 部分退役 | 路径链接部分由 `010-fork-f1-f4-client-features.patch`（F3）在新位置重做（`ui-primitives/path-links.ts` + `user-text.tsx` + `ui-chat/chat/MessageItem.tsx`）；通用文件**输入链路**（`addFiles/removeFile/pruneFiles`、`InputState.fileIds`、`releaseSessionFiles`）在 0.1.5 上游与 fork 提交里都不存在，未再移植 |
| `060-input-contract-consumer-tests.patch` | 随之作废 | 它只为修补 050 新契约打破的上游 fixture；0.1.5 无该契约变更，无需修补 |
| `070-connection-unlimited-skip.patch` | 按决定退役 | 无限制附件方案已放弃，未再移植（也无对应 fork 提交） |
| `080-ui-workspace-loading-state.patch` | 被新补丁取代 | `010-fork-f1-f4-client-features.patch`（F4，0.1.5 的 `rows/WorkspaceBrowser.tsx` + locales + 测试） |

## 归档的启动器副本

`launchers-0.1.1/` 里是 0.1.1 时代的启动脚本副本，全部硬编码旧 checkout
`C:\Users\19161\deepseek-harness`，且入口名（`dsh-web-launch.ps1`、`native-drag-bridge-launch.vbs`、
`start-dsh-web.cmd` 旧版、`restart-dsh-web.ps1` 旧版等）在 0.1.5 的启动链里已不存在。
0.1.5 的启动器链由 `020-fork-f9-web-restart-launchers.patch`（F9）直接在 checkout 根目录生成
（`dsh-web-service.json`、`dsh-web-host-launch.ps1`、`dsh-web-service-launch.vbs`、
`start-dsh-web.cmd`、`dsh-web-restart-worker-launch.vbs`、`dsh-web-restart.ps1`、
`restart-dsh-web.ps1`），不再需要手工复制。

保留它们只是为了在排查旧机器/旧 checkout 行为时能对照历史实现。**任何一条都不参与 0.1.5
的重放。**

## 一个先于本次整理的仓库规则违例（emoji）

`050-ui-conversation-file.patch` 内含一个 emoji 字符 `U+1F4CE`（纸夹），出现在它给 InputBar
新增的文件 chip 行里（`<span className={css.fileAttachmentIcon}>…</span>`）。该字符在 `HEAD`
的已跟踪 blob 中就已存在——本次整理只是把文件整体移动、未改一个字节——但它确实违反仓库
「禁止 emoji」的规则。若要求工作树严格无 emoji，最小操作是删除
`archive-0.1.1/050-ui-conversation-file.patch` 及只为它服务的
`archive-0.1.1/060-input-contract-consumer-tests.patch`（两者都已作废、不可套用）；
保留它们只是为了对照 0.1.1 的实现历史。
