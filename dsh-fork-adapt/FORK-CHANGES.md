# DSH Fork 改动适配清单（0.1.5）

> 用途：记录本 fork 相对 DSH 官方源码的全部改动，一处一份补丁，升级/换 checkout 后按此清单重放。
> 历史教训：rc.8 升级时 SettingsRoot 改动曾因未入库、未生成补丁而丢失（2026-08-20）。
> 现在 fork 改动**已经是真实提交**，"补丁"只是这些提交的可重放导出物。

## 基线

- 官方基线提交：`fb2c4b9e698e30edb738bca4cf0618587db7d203`
  （tag `dsh-v0.1.5-rc.2`，PR #3978 的 merge commit，2026-09-10）
- fork 分支 / 顶端：`fork/0.1.5-rc.2` = `8016f4fdc2bbb4b537d293f43cf2e85a481a9302`
- 本地 checkout：`C:\Users\19161\deepseek-harness-next`（4 个 fork 提交直接坐在基线之上，线性无分叉）
- 生成方式：**一个 fork 提交 = 一个补丁**
  `git diff --binary --full-index --no-color --output=<补丁> <commit>^ <commit>`
  （文件由 git 自己写：LF、无 BOM，不经 PowerShell 管道）
- 顺序：4 个补丁是**累积**的，必须按 010 → 020 → 030 → 040 顺序套
- 校验：`git apply --check` 干跑 + 每套一个补丁就 `git add -A && git write-tree`，
  与对应提交的 tree 逐字节比对（见文末验证记录）

## 补丁清单（6 个）

| 补丁 | fork 提交 | 功能 | 字节 | 行数 | 文件 |
| --- | --- | --- | --- | --- | --- |
| `010-fork-f1-f4-client-features.patch` | `20faee2` | F1 F2 F3 F4 | 40368 | 864 LF / 0 CR | 12 |
| `020-fork-f9-web-restart-launchers.patch` | `90fef94` | F9 | 53408 | 1354 LF / 0 CR | 16 |
| `030-fork-f7-glm-normalizer.patch` | `c41e032` | F7 | 60032 | 1401 LF / 0 CR | 17 |
| `040-fork-f6-turn-recovery.patch` | `8016f4f` | F6 | 28143 | 690 LF / 0 CR | 16 |
| `050-fork-desktop-entry-and-telemetry.patch` | `0e0f067` | 桌面入口 + 遥测退出 + host 键 | 7871 | 见 `regenerate -Verify` 输出 | 4 |
| `060-fork-aggregate-refs-and-spec-fixture.patch` | `7e49898` | 两个聚合 tsconfig 引用 + GLM 规格夹具 | 2444 | 同上 | 3 |

最后两个补丁是迁移收尾时加的：`050` 给桌面快捷方式一个能用的入口（`dsh-web-open.ps1/.vbs`：读 `dsh-web-service.json`、
必要时经同一 funnel 拉起 Host、再从 `dsh-web.log` 取带 token 的 URL 开浏览器），并把 `DSH_TELEMETRY_DISABLED=1`
写进 `dsh-web-host-launch.ps1`、给服务配置加了可选 `host` 键（**不要填 0.0.0.0**：0.1.5 的 CLI 会直接拒绝启动）。
`060` 把 fork 新增的两个包接进聚合工程（`tsconfig.host.json` → `packages/host/web-restart`；
`tsconfig.client.json` → `packages/client/ui-turn-recovery/tsconfig.client.json`，该包是 solution 式 tsconfig，
必须引用它自己的 client program），并给 `llm-pi-ai` 的 GLM 规格补上 pi-ai 0.85 起强制要求的 `Usage.cost`。
两者都由 `regenerate-fork-patches.ps1 -Verify` 实测重放到各自 commit 的 tree。

### 1. 客户端四条 fork 特性 — `010-fork-f1-f4-client-features.patch`

- **提交**：`20faee250e8ab7b3d3a47a018870a431ef60ee45`（tree `9d2153dfadf71b58d63a8e9aaf1bcf2c5d3ad010`）
- **路径**（12）：
  `packages/client/ui-chat/src/client/chat/MessageItem.tsx`
  `packages/client/ui-model-selection/src/client/ModelSelect.tsx`
  `packages/client/ui-model-selection/tests/model-select.client.spec.tsx`
  `packages/client/ui-primitives/src/path-links.ts`（新）
  `packages/client/ui-primitives/src/user-text.tsx` / `user-text.module.css`
  `packages/client/ui-primitives/tests/user-text.client.spec.tsx`
  `packages/client/ui-settings-general/src/client/SettingsRoot.tsx` / `SettingsRoot.module.css`
  `packages/client/ui-workspace/src/client/locales.ts`
  `packages/client/ui-workspace/src/client/rows/WorkspaceBrowser.tsx`
  `packages/client/ui-workspace/tests/workspace-browser.client.spec.tsx`
- **F1 设置面板两段式关闭 + aqua 锚点**：`closing/onClosed` 退出生命周期挂在**活 dialog** 上
  （computed `animationName` 判定、`animationend` 过滤到 dialog 自身、600ms 兜底），
  `data-closing` 冻结指针输入，`data-dsh-aqua-settings` 作为玻璃主题定位锚点，触发器 34px 紧凑行。
- **F2 模型菜单去掉思考强度**：`Pane` 收敛为 `'model'`，根层「模型 / 推理等级」两行与 effort 面板删除，
  触发器只显示模型名，选择仍是原生 `{provider, model}` 提交；思考强度交由 aqua 侧 effort-slider 处理。
- **F3 裸路径链接**：新增 `path-links.ts` 词法切分（引号路径原样、裸路径去掉散文标点、遇 CJK 停下），
  `projectUserText` 增加可选 `openPath`，只有 ui-chat 提供宿主 `openFile` 时才渲染 `data-dsh-path-link`。
- **F4 会话列表加载态**：分组树与扁平列表在 `phase !== 'ready'` 时显示 `empty.loading`，
  刷新后不再闪「暂无会话」空态。

### 2. Web 重启命令 + 本地服务启动器 — `020-fork-f9-web-restart-launchers.patch`

- **提交**：`90fef94712d1c397d12bb03d467ca11d01a9637e`（tree `02c909b962c967ed722f079bbde9869fc184f7c2`）
- **路径**（16）：`.gitignore`、`pnpm-lock.yaml`、`restart-dsh-web.ps1`、`start-dsh-web.cmd`、
  `dsh-web-host-launch.ps1`、`dsh-web-service-launch.vbs`、`dsh-web-restart-worker-launch.vbs`、
  `dsh-web-restart.ps1`、`dsh-web-service.json`、
  `packages/host/web-restart/{README.md,package.json,tsconfig.json,tsdown.config.ts,src/index.ts,src/worker.ts,tests/worker.spec.ts}`
- **改动目的**：`/restart` 人类命令 + 让它在替换掉自己宿主之后仍能活下来的 Windows 服务链路。
  0.1.5 的 `ctx.commands.register` / `ctx.effect` 未变，命令半边是直搬；worker 的就绪判定改为
  「index 有应答（401/200/303）且 `/api/settings/describe` 应答 401（鉴权栅栏已挂）或 200」，
  并且不再把 `http://127.0.0.1:<port>/` 交给浏览器（0.1.5 一律 401），改为从宿主日志
  （`config.hostLog`，默认 `<repoRoot>/dsh-web.log`）里读新的 `?token=` URL。
- **启动器**：checkout 根目录的 `dsh-web-service.json`（profile/port/node 单一事实来源）、
  `dsh-web-host-launch.ps1`（隐藏启动宿主，node 的 stdout/stderr 用 cmd.exe 重定向写日志，
  保证 `dsh web: …?token=` 立刻落盘）、`start-dsh-web.cmd` / `dsh-web-service-launch.vbs` /
  `dsh-web-restart-worker-launch.vbs` / `dsh-web-restart.ps1` / `restart-dsh-web.ps1`（隐藏进程链、
  就绪探测、只开一次浏览器）。**这些文件不再需要手工复制，全部在补丁里。**

### 3. GLM 流归一化接缝 — `030-fork-f7-glm-normalizer.patch`

- **提交**：`c41e032013aa9d841469ad7bea8a5d1c27e4cf2e`（tree `2a6ef84af4924014fc6d2e3d754d2a5d618f8d0d`）
- **路径**（17）：新增包 `packages/llm/llm-glm-normalize/**`（README 三份、package.json、
  `src/index.ts`、`src/invariant.ts`、`tests/normalize.spec.ts`、tsconfig、tsdown），
  `packages/llm/llm-pi-ai/{package.json,tsconfig.json,src/{adapter,config,index,stream}.ts,tests/glm-normalizer.spec.ts}`，
  `pnpm-lock.yaml`
- **改动目的**：把 GLM 网关的流折叠从 pi-ai 适配器里搬成独立库并留下接缝，使 profile 能组合供应商怪癖
  而不用改适配器。折叠本身（短前缀累计文本折叠、缺 `finish_reason` 终结折叠）在 `llm-glm-normalize`；
  `llm-pi-ai/src/stream.ts` 重导出 `chainStreamNormalizers` / `normalizersFor`，声明
  `AssistantEventNormalizer` 并在 `toStreamChunks` 里合成；`mapStopReason` 把
  「有内容但流结束无 finish_reason」判为正常停止（GLM 网关以 `[DONE]` 收尾）；
  `config.ts` 新增 `streamNormalizers.glm`（`enabled`、`providers`，默认 `['glm']`）。
  折叠参数以尾部 `StreamFoldOptions` 对象传递（0.1.5 已占用两个位置参数：caller signal 与重放模型）。

### 4. 中断回合恢复面板 — `040-fork-f6-turn-recovery.patch`

- **提交**：`8016f4fdc2bbb4b537d293f43cf2e85a481a9302`（tree `07b6d638e32489299a18ef9a1697b811f7c29a07`）
- **路径**（16）：`packages/bundle/web-app/cordis.patch.yml`、`pnpm-lock.yaml`、
  新增包 `packages/client/ui-turn-recovery/**`（package.json、`src/index.ts`、`src/invariant.ts`、
  `src/client/{ContinuePanel.tsx,ContinuePanel.module.css,continue-policy.ts,index.ts,locales.ts,css-modules.d.ts}`、
  `tests/continue-panel.client.spec.tsx`、tsconfig 三份、tsdown.config.ts）
- **改动目的**：把 `dsh-client-ui-turn-recovery` 移植到 0.1.5，并从 0.1.5 已有能力重新推导它的两个
  fork 侧依赖，使其保持为「可整体摘除的单个插件」，不再另外打 ui-conversation 补丁：
  - 选中逻辑改读 `owner.turn.end?.data.reason.kind === 'interrupted'`（`conversation.chat.turnTail`
    （0.1.5 由 ui-chat 声明）本身不带 interrupted 标志，但 `turn/end` 的 reason 带）；
  - 续跑走会话面 `ctx.sessions.binding(id).session.prompt([...], 'queue')`，
    幂等策略数据化（`continuationAlreadyRequested` 读实时 `SessionSnapshot` 的 `running` 与
    `queue[].text`），面板重挂不会排第二次自主续跑。
- **接线**：写进 web-app bundle 的 `cordis.patch.yml`（与 0.1.1 时期同位置），因此该 checkout 上
  每个 profile 都会加载它。

## 0.1.1 旧补丁的处置（8 个，全部归档）

旧补丁（`010-settings-root-two-phase-close.patch` … `080-ui-workspace-loading-state.patch`）已整体移入
`archive-0.1.1/`，**不得再对任何 checkout 使用**；逐条处置见 `archive-0.1.1/README.md`，摘要：

| 旧补丁 | 处置 | 依据 |
| --- | --- | --- |
| 010 设置两段式关闭 | 被取代 → `010-fork-f1-f4-client-features.patch`（F1） | 0.1.5 上重做，路径不变 |
| 020 模型选择去思考强度 | 被取代 → `010-fork-f1-f4-client-features.patch`（F2） | 0.1.5 上重做 |
| 030 附件通用文件同步 | 已被上游吸收 | base 已有 `attachment-local/src/file-store.ts`、`FileAttachmentRef`、`saveFile/readFileStream` |
| 040 宿主内容模型 file | 已被上游吸收 | base 的 `packages/llm/llm/src/types.ts` 已有 `FileBlock`、`ContentBlockMap['file']` |
| 050 ui-conversation 文件全链路 | 部分取代 / 部分退役 | 路径链接 → F3（新位置 `ui-primitives/path-links.ts` + `user-text.tsx` + `ui-chat`）；通用文件输入链（`addFiles/removeFile/pruneFiles`、`fileIds`、`releaseSessionFiles`）在 0.1.5 上游与 fork 提交里都不存在，未再移植 |
| 060 跨包 consumer 测试 | 随 050 作废 | 只为修补 050 新契约打破的 fixture；0.1.5 无该契约变更 |
| 070 无限制附件哨兵跳过 | 按决定退役 | 无限制附件方案放弃；它是旧集里唯一在 0.1.5 仍可套的一条（`fdeded2` 实测 1/8），但不再需要 |
| 080 工作区加载态 | 被取代 → `010-fork-f1-f4-client-features.patch`（F4） | 0.1.5 上重做 |

行尾问题（旧编号 F12）：仓库 `.gitattributes` 的 `*.patch text eol=lf` + `fdeded2`（2026-09-12）已经
把 8 个旧补丁在工作树里都变成 LF（逐字节实测 CR=0），所以「CRLF 补丁永远套不上」这一机械故障已不复现；
它们现在套不上的原因是**基线不同**（0.1.1 树 vs 0.1.5 树）。新补丁由 `git diff --output` 生成，
两个脚本都会在套用前逐字节检查 CR/BOM 并对 CRLF 直接报错（exit 2），而不是静默「修一下」再套。

## 启动器：不再手工复制

0.1.1 时代的启动器副本（`dsh-web-launch.ps1/.vbs/.vbs.bak`、`native-drag-bridge-launch.vbs`、
旧 `dsh-web-restart.ps1`、旧 `restart-dsh-web.ps1`、旧 `start-dsh-web.cmd`）硬编码旧 checkout
`C:\Users\19161\deepseek-harness`，入口名在 0.1.5 的启动链里也已不存在，一并归档到
`archive-0.1.1/launchers-0.1.1/`。0.1.5 的启动链由补丁 020 在 checkout 根目录生成。

## 脚本

### `apply-fork-patches.ps1`（重放）

```powershell
# 干跑：不写工作树、不碰真实 index（用临时 GIT_INDEX_FILE 串起 4 个补丁）
powershell -NoProfile -ExecutionPolicy Bypass -File apply-fork-patches.ps1 -Check

# 真实重放并逐提交校验 tree
powershell -NoProfile -ExecutionPolicy Bypass -File apply-fork-patches.ps1 -VerifyTree

# 常用：重放 + 重建 + 重启
powershell -NoProfile -ExecutionPolicy Bypass -File apply-fork-patches.ps1 -Build -Restart
```

- 参数：`-ReposRoot`（默认 `C:\Users\19161\deepseek-harness-next`）、`-PatchDir`、`-BaseCommit`、
  `-Check` / `-VerifyTree` / `-Build` / `-Restart`。
- 每个补丁按 **strict → `--ignore-whitespace` → `--3way`** 三级尝试，三级都失败则带诊断信息
  以 exit 3 退出（并提示 `git apply --reject` 手工合并），**不会静默跳过**。
- 预检失败一律大声报错：checkout 不存在 / 不是 git 工作树 / `rev-parse --show-toplevel` 与
  `-ReposRoot` 不一致 / 基线提交不在该 checkout / 基线不是 HEAD 的祖先 / 补丁缺失 / 补丁含 CR 或 BOM
  （exit 2）；tree 校验不一致 exit 4。四个 fork 提交已在 HEAD 历史里时直接报告「already integrated」并 exit 0。
- `-VerifyTree` 要求工作树干净（否则 `git add -A` 会把本地改动算进比对），脏树直接 fail。

### `regenerate-fork-patches.ps1`（重生成）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File regenerate-fork-patches.ps1
# 生成后顺带在基线 worktree 里真套一遍并逐提交比对 tree，然后删掉 worktree
powershell -NoProfile -ExecutionPolicy Bypass -File regenerate-fork-patches.ps1 -Verify
```

- 只读**已提交对象**（`<commit>^` vs `<commit>`），不读工作树，所以脏 checkout 不会污染补丁；
  未提交的本地改动不会被捕获（见「已知缺口」）。
- 先校验 4 个提交构成 base → 20faee2 → 90fef94 → c41e032 → 8016f4f 的完整链（父提交逐级核对），
  再逐个 `git diff --binary --full-index --output=` 生成，然后逐字节复核 0x0D=0 / 无 BOM / 非空，
  并打印每个补丁的 `git apply --stat`。
- 会把每个提交的 tree 与 `apply-fork-patches.ps1` 里的期望表交叉核对，漂移时告警。
- `-Verify` 会 `git worktree add --detach <tmp> <base>`，对临时 worktree 跑真正的重放 + tree 比对，
  结束后删除（`-KeepWorktree` 可保留供人工检查）。

## 应用步骤（克隆 / 升级后）

```powershell
# 1. 确认 checkout 与基线（脚本会自己再查一遍）
git -C C:\Users\19161\deepseek-harness-next rev-parse HEAD
git -C C:\Users\19161\deepseek-harness-next rev-parse dsh-v0.1.5-rc.2   # 期望 fb2c4b9e698e30edb738bca4cf0618587db7d203

# 2. 干跑
powershell -NoProfile -ExecutionPolicy Bypass -File `
  C:\Users\19161\Documents\dsh-work\dsh-fork-adapt\apply-fork-patches.ps1 -Check

# 3. 真实重放（逐提交校验 tree）
powershell -NoProfile -ExecutionPolicy Bypass -File `
  C:\Users\19161\Documents\dsh-work\dsh-fork-adapt\apply-fork-patches.ps1 -VerifyTree

# 4. 重建产物 + 重启 web
cd C:\Users\19161\deepseek-harness-next
pnpm run build:lib          # host + client 两面
powershell -NoProfile -ExecutionPolicy Bypass -File .\dsh-web-restart.ps1

# 5. 回归：设置页关闭动画、模型菜单无思考强度、裸路径可点、刷新后会话列表不闪空态、
#    /restart 与启动链、GLM 流折叠、中断回合的 Continue 面板
```

一键入口：`一键适配DSH改动.cmd`（双击即可，内部调用 `apply-fork-patches.ps1` 并在成功后
`pnpm run build:lib` + `dsh-web-restart.ps1`）。

## 验证记录（2026-09-12 实测）

环境：Windows、PowerShell 5.1/7、git 2.x、node v24.15.0、pnpm 11.7.0。
临时 worktree：`C:\Users\19161\Documents\dsh-work\tmp-patchcheck-015`
（`git worktree add --detach <path> fb2c4b9`，验证完删除；全程未向 fork checkout 写入任何东西）。

1. **干跑** `apply-fork-patches.ps1 -Check`：4/4 全部 **strict** 通过（临时 `GIT_INDEX_FILE`
   串行模拟整条阶梯），工作树零改动（`git status --porcelain` 0 项）。
2. **真实重放** `apply-fork-patches.ps1 -VerifyTree`：4/4 以 `strict` 应用，且每套一个补丁后
   `git add -A && git write-tree` 与对应提交的 tree 完全一致：
   - 010 → `9d2153dfadf71b58d63a8e9aaf1bcf2c5d3ad010` = `20faee2^{tree}`
   - 020 → `02c909b962c967ed722f079bbde9869fc184f7c2` = `90fef94^{tree}`
   - 030 → `2a6ef84af4924014fc6d2e3d754d2a5d618f8d0d` = `c41e032^{tree}`
   - 040 → `07b6d638e32489299a18ef9a1697b811f7c29a07` = `8016f4f^{tree}` = fork HEAD tree

   最终 `git diff --cached 8016f4f^{tree}` 无差异 → **重放逐字节复现 fork 的四个提交**。
3. **行尾**：4 个补丁 CR=0、无 BOM（见上表）。重放生成的 `start-dsh-web.cmd` 在 0.1.5 的
   `.gitattributes`（`*.cmd text eol=crlf`）下按 CRLF 落盘（392 字节 / 7 个 CR），
   而 `git hash-object` 仍等于提交里的 blob `74a98cd9…` → 行尾不漂移。
4. **真实依赖下的类型检查**（worktree 内 `pnpm install --offline --frozen-lockfile --ignore-scripts`，
   32.1s 成功）：
   - 改动包的 host 面
     `tsc -b packages/host/web-restart packages/llm/llm-glm-normalize packages/llm/llm-pi-ai packages/bundle/web-app`
     → **exit 0，零诊断**。
   - 改动包的 client 面
     `tsc -b packages/client/{ui-chat,ui-model-selection,ui-primitives,ui-settings-general,ui-workspace,ui-turn-recovery}`
     → 改动包自身零诊断；11 条诊断全在 `packages/api/{session-controller,workspace-files,workspace-controller}`，
     内容是 `Cannot find module '@deepseek-ai/dsh-api-*/remote'`。这些 `./remote` 子路径指向 typert 生成的
     `lib/typert.remote-client.d.ts`（主 checkout 有、全新 worktree 没有 = 还没跑仓库的 build/codegen），
     且四个补丁**完全不碰 `packages/api/`**（补丁内匹配数 0）→ 环境性，与补丁无关。
   - 仓库**聚合面**（根 `tsconfig.host.json` / `tsconfig.client.json` 程序）另有既有缺口，详见下节。
5. **脚本护栏实测**（都大声失败并给出可执行提示）：
   - 不存在的 checkout → exit 2；`-ReposRoot` 不是工作树根 → exit 2；
   - 未知基线提交 → exit 2；`-PatchDir` 只含归档的 0.1.1 补丁 → exit 2（逐个列出缺失的 4 个名字）；
   - 把 030 改成 CRLF 再跑 → exit 2（`contains 1401 CR byte(s) (0x0D)`，即 F12 防线生效）；
   - 对已含四个提交的 fork checkout 直接跑 → `already integrated`，exit 0，零写入。
6. `regenerate-fork-patches.ps1` **幂等**：重跑后 4 个补丁的 SHA256 与重跑前完全一致。
7. 收尾：worktree 已删除并 `git worktree list` 只剩主 checkout；fork checkout 的 HEAD 仍是
   `8016f4f`，`git status` 里多出来的只有别的会话在改的启动器/日志（见下节），本次 C4 一行源码都没动。
   坑：为了跑第 4 步在 worktree 里 `pnpm install` 过，`node_modules` 深路径超过 MAX_PATH
   （本机 `LongPathsEnabled=0`），`git worktree remove` 与 PowerShell 都删不掉，最后用
   `cmd /c rd /s /q <worktree>` 收尾；脚本的 `-Verify` 流程不装依赖，所以不受影响（已写进脚本注释）。

## 已知缺口与残余风险

- **仓库聚合面（根 tsconfig）里有两条既有缺口，重放会如实复现**（补丁不改根 tsconfig，重放树 =
  fork HEAD 树，所以这是 fork 提交自身的状态，不是补丁引入的）：
  - `tsc -b tsconfig.host.json` 报 `packages/host/web-restart/tests/worker.spec.ts(4,8) TS6307`：
    根聚合 tsconfig 是「显式 include + 显式 references」清单，没有引用新增的
    `packages/host/web-restart`（`packages/client/ui-turn-recovery` 同理，client 面 4 条 TS6307）。
    消除办法：在 fork 里补两条 references（新提交 → 新补丁），而不是手工改根 tsconfig。
  - 同一聚合面还报 `packages/llm/llm-pi-ai/tests/glm-normalizer.spec.ts(19,3) TS2741:
    Property 'cost' is missing … required in type 'Usage'`：F7 移植过来的测试里构造 usage 时缺
    `cost` 字段；包级程序（`tsc -b packages/llm/llm-pi-ai/tsconfig.json`）是干净的，只有聚合程序
    看到的是 host 面声明版本。要修就在 fork 里补 `cost`（新提交 → 新补丁）。
  - 两者都不影响构建产物与运行（`pnpm run build:lib` 走的是包级程序），但会让整仓
    `pnpm run typecheck` 变红；本轮 C4 只做「诚实重放」，没有代 fork 改源码。
- **未提交的本地改动不在补丁里**：补丁只导出那四个提交，checkout 里任何未提交内容都**不会**被重放。
  2026-09-12 17:05 实测该 checkout 的未提交项为：`dsh-web-host-launch.ps1`（telemetry opt-out
  `DSH_TELEMETRY_DISABLED=1`，决定 D4）、`dsh-web-service.json`（新增 `_host` 说明键）、
  未跟踪的 `dsh-web-open.ps1` / `dsh-web-open.vbs`（桌面快捷方式的「读 token 再开浏览器」启动器）
  以及若干运行日志。这些内容仍在持续变动（同一 checkout 上还有别的会话在改），
  要用它们就先在 fork 里提交，再跑 `regenerate-fork-patches.ps1`（新增提交应成为新的 `050-fork-*.patch`，
  并同步更新两个脚本里的补丁表与基线）。
- **050/060 的通用文件输入链未移植**：0.1.1 fork 曾在输入层加过 `addFiles/removeFile/pruneFiles`、
  `fileIds`、`releaseSessionFiles` 与 InputBar 文件 chip。0.1.5 上游与 fork 提交都没有这套成员，
  因此当前 0.1.5 fork **不具备**「粘贴任意文件」能力（图片附件走上游原生路径）。如仍需该能力，
  需要在 0.1.5 上重新提交一份改动，而不是回套 050。
- **补丁与 checkout 强绑定**：4 个补丁只对 `fb2c4b9` 这一基线干净可套。升到 0.1.5-rc.3 / 0.1.6 时，
  先 rebase fork 提交到新基线，再用 `regenerate-fork-patches.ps1` 重新导出并更新两个脚本里的
  基线/tree 表，不要直接套旧补丁。
- **aqua 侧不在本清单**：设置面板玻璃化、popupSelect 磨砂、退场动画 CSS、effort-slider 贴右
  属 aqua 插件仓库（`~/.dsh/plugins/@deepseek-ai/dsh-client-ui-aqua`，
  remote `WYHY66666666/DSH-Transparent-UI-Plugin`），不是 DSH 原版改动。
