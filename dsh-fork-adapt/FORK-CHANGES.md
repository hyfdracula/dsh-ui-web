# DSH Fork 改动适配清单

> 用途：记录我对 DSH 官方源码（deepseek-harness checkout）的所有**页面层 fork 改动**，
> 升级 DSH 后按此清单一键重放，避免「SettingsRoot 改动被新版本覆盖丢失」再次发生（2026-08-20 rc.8 就丢过一次）。

## 基线

- 官方基线提交：`528c682e061696f5a160f363f236ecbf53cbd006`（`origin/master`，`0.1.1-rc.1`，merge `f3922dda23` 已自动合入，2368 文件零冲突）
- 前序基线（历史）：`141eb6fef83422698aef7a981029e843e8161534`（`dsh-v0.1.0-rc.8`）
- 本地 checkout：`C:\Users\19161\deepseek-harness`（分支 `master`）
- 生成方式：`git diff origin/master -- <src>...` → 单文件补丁 `*.patch`（git apply 兼容）
- 适配操作：升级后用 `apply-fork-patches.ps1` 重放，或手工 `git apply` 每个补丁
- 再生成工具：`regenerate-fork-patches.ps1`（从当前工作树相对 origin/master 重生成全部 8 个补丁，
  自动 `git add -N` 新文件、无 BOM + LF 写入、逐补丁逆序校验；060 记录跨包 consumer 测试一致性）

## Fork 改动清单（8 个补丁）

### 1. 设置面板两段式关闭动画 + 玻璃钩子 — `010-settings-root-two-phase-close.patch`

- **文件**：`packages/client/ui-settings-general/src/client/SettingsRoot.tsx`
  `packages/client/ui-settings-general/src/client/SettingsRoot.module.css`
- **改动目的**：关闭设置面板时保留一拍，让主题层（aqua）的退出动画在**活面板**上播放。
  两段式：`closing` 状态 + overlay `data-closing` 属性；SettingsPanel 读 dialog 的 computed
  `animationName`：无动画立即卸载、有动画等 `animationend`（过滤冒泡）+ 600ms 兜底；
  activeId 重置挪到真正卸载。
- **附带**：`data-dsh-aqua-settings` 钩子挂在 dialog 上（aqua 玻璃化定位锚点）；settings 触发器
  改成 34px 紧凑行。
- **验证**：`vitest run packages/client/ui-settings-general` → 通过。
- **依赖**：aqua 插件侧 CSS 玻璃/退场动画（见 aqua 仓库）。

### 2. 模型选择去掉思考强度 — `020-model-select-no-reasoning-effort.patch`

- **文件**：`packages/client/ui-model-selection/src/client/ModelSelect.tsx`
  `packages/client/ui-model-selection/src/client/locales.ts`
  `packages/client/ui-model-selection/tests/model-select.client.spec.tsx`
- **改动目的**：官方 ModelSelect 触发器并排显示『模型·推理等级』、根菜单还有『推理等级』钻入。
  fork 后**触发器只显示模型名，点开直达模型列表**（删除 effort chip、根两层菜单、effort 行/面板），
  选择模型仍原生 `{provider,model}` 提交；思考强度改为由 effort-slider 插件（aqua 侧）贴右处理。
- **验证**：`vitest run packages/client/ui-model-selection` → 通过。

### 3. 附件通用文件同步（attachment 层） — `030-attachment-file-sync.patch`

- **文件**：`packages/attachment/attachment/src/{error,types,index}.ts`
  `packages/attachment/attachment-local/src/{store,index}.ts`
  `packages/attachment/attachment-local/src/file-store.ts`（新）
  `packages/attachment/attachment-local/tests/{file-store.spec.ts(新),index.spec.ts}`
- **改动目的**：在既有「图片附件」之外新增**通用文件附件**通路：`FileAttachmentRef`/
  `FileAttachmentLimits`/`SaveFileAttachment`/`StoredFileAttachment` 类型；`AttachmentStore` 增加
  `fileLimits`/`validateFile`/`saveFile`/`readFile` 抽象；`attachment-local` 用 `file-store.ts`
  实现内容寻址（sha256）持久化 + 完整性校验；新增错误码 `INVALID_FILE`/`FILE_TOO_LARGE`。
- **验证**：`vitest run packages/attachment packages/attachment-local` → 通过。

### 4. 宿主内容模型 file（llm/apiproxy/runtime/connection） — `040-host-content-file.patch`

- **文件**：`packages/llm/llm/src/types.ts`
  `packages/llm/llm-deepseek/src/{adapter,index}.ts`（兼容：`ModelModality` 新增 `'file'` 后，
   deepseek 目录限定 `DeepSeekModality`（text/image），否则 `tsc -b tsconfig.host.json` 报
   `ModelModality` 不可赋给 `"text"|"image"`）
  `packages/host/apiproxy/src/api-proxy.ts`
  `packages/host/apiproxy/src/api/sessions.schema.ts`
  `packages/host/apiproxy/src/api/sessions.ts`
  `packages/client/runtime/src/client/contract/session.ts`
  `packages/client/runtime/src/client/sessions/session.ts`
  `packages/client/connection/src/client/fixture.ts`
- **改动目的**：宿主侧把「通用文件」纳入内容模型：llm `FileBlock` + `ContentBlockMap['file']`；
  apiproxy `PromptContentPart {type:'file'}` + `fileAttachmentRefSchema` + api-proxy 文件持久化
  admit；attachment 错误新增 `TOO_MANY_FILES`/`FILES_TOO_LARGE`/`INVALID_FILE_BASE64`；
  client runtime `readAttachment` 扩展 file union；connection fixture 同步 file 负载。
- **fileLimits 投影要点**（api-proxy.ts）：新增 `fileLimits` 会话投影，但只在组合的
  attachment store **支持通用文件**时注册——stock 基类 getter 对不支持文件的 store 会 throw，
  无条件注册会让每个 `session.history` 快照失败（已修，`.api-proxy-projections.spec.ts` 14/14 回绿）。
- **rc.1 同步修补**：
  - `sessions.ts`：`SessionProjectionStateMap` 补充 `fileLimits: null`（rc.1 的
    `SessionProjectionRegistry.register<K, S>` 要求 K ∈ `keyof SessionProjectionStateMap`）。
  - `sessions.schema.ts`：`promptContentPartSchema` 增加 `{type:'file', mediaType, data, name?}`
    分支（客户端早已发送 file prompt part，此前真实 `/api` safeParse 会拒绝）。
  - `attachment-local/src/index.ts`：private `#fileLimits` 改为公开 backing field
    `fileLimitsValue`——cordis service proxy 经 getter 访问 private field 会抛
    `Cannot read private member`，公开字段可安全转发；`fileLimits` accessor 合约不变。
  - `api-proxy.ts`：fileLimits 投影注册改为「inject proxy 探测 + `ctx.get` 真实例回退」双路径，
    任一成功即可注册（proxy 修复），调试日志已清理。
- **验证**：host 测试（llm/apiproxy/attachment）通过。

### 5. ui-conversation 同步全链路（输入/附件/路径链接） — `050-ui-conversation-file.patch`

- **文件**：`packages/client/ui-conversation/src/client/`（contract/slots、input/{contract,facade,hub,
  machine}、service、apply、locales、image-labels、`path-links.ts`(新)、skeleton/{ConversationSession,
  InputBar(.tsx/.module.css)}、chat/{MessageItem(.tsx/.module.css)}）
  `packages/client/ui-conversation/tests/`（input-bar、input-matrix、input-reference-submit、
  input-scenarios、skeleton、chat-view、gate-branch-tails、queue-dock）
- **改动目的**：复制粘贴全套同步到头：输入层 contract/machine/facade/hub 支持通用文件附件
  （`InputActions` 增 `addFiles/removeFile/pruneFiles`、`InputState` 增 `fileIds`、
  `SessionInputDeps` 增 `commandFiles`、`ConversationSessionInjected` 增 `releaseSessionFiles`）；
  InputBar 展示已粘贴文件（含无限制粘贴）；MessageItem 的 fork 版 projectUserText 消费
  `path-links.ts`（把 Windows 绝对路径渲染成可点击链接，走宿主 openFile）；image-labels 同步；
  service/slots/apply 打通会话提交链路。
- **验证**：`vitest run packages/client/ui-conversation` → 462/462 通过。

### 6. 跨包 consumer 测试兼容 — `060-input-contract-consumer-tests.patch`

- **文件**：`packages/client/ui-tool/tests/{diff-card,read-card,search-card,terminal-card,web-card}`
  `packages/client/ui-trajectory/tests/views.client.spec.tsx`
  `packages/client/ui-attachment/tests/message-image.client.spec.tsx`
- **改动目的**：050 的输入契约新增 file 成员（`InputActions.addFiles/removeFile/pruneFiles`、
  `InputState.fileIds`、`releaseSessionFiles`）会破坏**未改动的上游 consumer 测试 fixture**
  （它们按旧契约构造，缺新成员），导致 `tsc -b tsconfig.client.json` 报错。本补丁给这些跨包
  fixture 补齐新成员，保证契约补丁重放后 build 仍绿。这些改动只是 build 一致性，无运行行为变更。
- **验证**：随 050 契约一起，纳入全量 client build + 测试通过。

### 7. connection 无限制附件哨兵跳过守卫 — `070-connection-unlimited-skip.patch`

- **文件**：`packages/client/connection/src/index.ts`
- **改动目的**：恢复 `assertImageBodyCapacity` 的「无限制哨兵跳过」guard。rc.8 丢失了 backup/
  `local-changes-rc5` 里这处守卫生效前的提前返回：当部署把附件大小上限取消为
  `UNLIMITED_ATTACHMENT`（`maxMessageImageBytes = Number.MAX_SAFE_INTEGER`）时，4/3 base64
  放大后 `requiredImageBodyBytes≈1.2e16` 恒大于 `DEFAULT_MAX_REQUEST_BODY_BYTES=160MiB`，导致
  `client-connection/apply()` 抛出异常，恰好卡在注册 HTTP `/api` 路由（`ctx.webServer.register`）
  之后、注册两条 WebSocket downlink upgrade 路由（`registerUpgrade` 193-194）之前 ——
  **事件通道永不注册**。修复后刷新页面：WS downlink 正常 101 握手，`session.list` 事件及时到达，
  会话列表 ≤1s 出现（此前 15s+ 不出现或 ~10.7s 才恢复）。
- **guard 语义**：对 `>= Number.MAX_SAFE_INTEGER` 这个「无有限上界」哨兵，任何有限请求体上限都
  无法覆盖其 4/3 放大，容量校验对该哨兵无意义，直接 return。
- **验证**：`npx vitest run packages/client/connection` → 全绿；
  `restart-dsh-web.ps1` 重启后 `ws-latency-probe.mjs` 两通道 `ok:true`（101 握手，mux 5/5、host 5/5、并发 3/3）；
  `repro-refresh-list.mjs --loop 3` 首行会话 +785/+653/+739ms（均 ≤3s，无 NEVER）。

### 8. 工作区会话列表加载态 — `080-ui-workspace-loading-state.patch`

- **文件**：`packages/client/ui-workspace/src/client/{WorkspaceBrowser.tsx,locales.ts}`
  `packages/client/ui-workspace/tests/workspace-browser.client.spec.tsx`
- **改动目的**：会话列表 phase 未就绪（如刷新后加载中）时显示『正在加载会话…』，
  而不是上游的『暂无会话』（上游对任意空列表都显示 empty.none，加载瞬间会闪错误空态）。
  与 070 同属刷新后会话列表修复（fork commit 8c3c5b4d4b）。
- **验证**：`vitest run packages/client/ui-workspace` → 通过。

## Web 启动 / 重启机制（用户环境脚本，非补丁，直接复制）

- **文件**（checkout 根目录，origin 里不存在，直接放进新 checkout 根目录）：
  - `start-dsh-web.cmd` —— 用 kimi-desktop node 跑 `apps/cli/lib/bin.js --profile web`，输出到 `dsh-web.log`
  - `dsh-web-launch.ps1` —— 端口 3080 守护启动器（无窗口，可 -OpenBrowser）
  - `dsh-web-launch.vbs` —— wscript 无窗口桥（SW_HIDE），同时拉起剪贴板视觉 watcher
  - `dsh-web-restart.ps1` —— 唯一重启实现（停止 3080 host → CREATE_NO_WINDOW detached 启动 → IPv4 HTTP 200 校验；IPv6 仅记录）
  - `restart-dsh-web.ps1` —— 兼容入口，转发到 `dsh-web-restart.ps1`，避免两套逻辑漂移
  - `dsh-web-launch.vbs.bak` —— vbs 历史版本备份

## 应用步骤（升级到新 DSH 后）

```powershell
# 1. 拉新代码后，确认补丁能干净套用（-3way 自动三方合并）
cd C:\Users\19161\deepseek-harness
git apply --3way "C:\Users\19161\Documents\dsh-work\dsh-fork-adapt\010-....patch"   # 逐个
# 若冲突：git apply --reject 生成 *.rej，手工合并（官方改过同一区域时）

# 2. 重新 build 受影响包（SettingsRoot 属 ui-settings-general，整条 client 链都要重建）
npm run build   # 全量重建（lib:host + lib:client + web bundle）

# 3. 复制启动脚本
Copy-Item "$env:USERPROFILE\Documents\dsh-work\dsh-fork-adapt\start-dsh-web.cmd" .
Copy-Item "$env:USERPROFILE\Documents\dsh-work\dsh-fork-adapt\dsh-web-launch.ps1" .
# ...（其余 4 个）

# 4. 重启 Web 服务
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\19161\deepseek-harness\dsh-web-restart.ps1"

# 5. 验证
#    设置页关闭动画回归；模型选择无思考强度；复制粘贴附件/路径链接；
#    全量测试（含 host）：
npx vitest run packages/attachment packages/attachment/attachment-local \
  packages/client/ui-conversation packages/client/ui-model-selection \
  packages/client/ui-settings-general packages/llm packages/host/apiproxy
#    实测：99 test files / 1681 passed / 0 failed（rc.8 基线）
```

脚本化：直接跑 `./一键适配DSH改动.cmd`（或 `apply-fork-patches.ps1`），自动套全部 `*.patch` +
复制启动脚本 + 重建。

## 升级注意事项

- rc.8 升级时此改动曾丢失（当时未入库、未生成补丁）。**升级前先确认本目录补丁 = 最新改动**，
  用 `regenerate-fork-patches.ps1` 重生成即可。
- 若官方后续把设置面板/模型选择/附件结构改掉，相关补丁可能冲突/不命中：需人工核对 rc.8 结构再套。
- aqua 插件自身的页面改动（设置面板玻璃化、popupSelect 磨砂、退场动画 CSS、effort-slider 滑块贴右）
  在 **aqua 仓库**（`~/.dsh/plugins/@deepseek-ai/dsh-client-ui-aqua`，remote `WYH66666666/DSH-Transparent-UI-Plugin`），
  不在本清单——那是插件内容，不是 DSH 原版改动。
