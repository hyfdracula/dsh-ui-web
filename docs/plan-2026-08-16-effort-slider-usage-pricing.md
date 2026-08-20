# 计划：推理滑块独立插件 + 用量看板全价目表

日期：2026-08-16
范围：本仓库（dsh-ui-web）内新增一个独立插件，并增强用量看板插件。
不安装移动端远控。

## 约束

- 只基于官方 NPM SDK 开发，不修改 DSH 源码。
- 新包目录名统一 `dsh-*` 前缀。
- 所有文件（代码、注释、文档、UI 文案）不出现 emoji。
- 构建使用仓库共享预设 `shared/tsdown.client.ts`。
- 视觉风格对齐当前 DSH 中的 Aqua 玻璃主题。

## 一、新增 `packages/dsh-effort-slider`

目标：只保留 Aurora 皮肤中的推理等级滑块功能，剥离背景皮肤和 token 覆盖。

1. 新建包目录 `packages/dsh-effort-slider`，package name 使用 `@captain1275/dsh-effort-slider`（与现有工作区 scope 一致）。
2. 从 `packages/skins/aurora/src/client/effort/` 复制并精简：
   - `EffortPanel.tsx` —— 滑块面板主体
   - `effort.module.css` —— 面板样式（后续按 Aqua 风格重写）
   - `useWebglFire.ts` / `shaders.ts` —— 移除，改为纯 CSS 滑块轨道与发光 thumb
3. `src/client/index.ts` 只保留 document click 拦截逻辑：
   - capture 阶段监听点击
   - 命中 `button[role="menuitem"]` 且文本以 `推理等级` 或 `Effort` 开头
   - `event.preventDefault()` + `stopPropagation()`
   - 取当前 session id，渲染 `EffortPanel` 到固定 host
   - 不注册 `body[data-dsh-aurora]`，不创建背景层
4. `src/index.ts` / `src/invariant.ts`：标准空 host plugin + invariant companion。
5. `cordis.patch.yml`：注册插件。
6. 样式按 Aqua 玻璃风格重写：
   - 半透明玻璃渐变背景（复用 Aqua 的 `--dsh-aqua-glass-card-light/dark` 变量思路）
   - 1px 细边框、20px 圆角、顶部内高光
   - 无 WebGL 火焰，轨道用 CSS 渐变，thumb 用 CSS 发光
   - 字体、颜色 token 与 Aqua 一致
7. 构建：`pnpm --filter @captain1275/dsh-effort-slider build`

## 二、增强 `packages/dsh-usage-dashboard`

目标：把仅覆盖 DeepSeek 的单一费率表换成可更新的全 provider 价目表。

1. 新增 `src/host/pricing-default.json`：
   - 内置 LiteLLM `model_prices_and_context_window.json` 快照
   - 文件头含 `_updatedAt`、`_source`、`_commitShort`
2. 新增 `src/host/pricing.ts`：
   - 优先读取用户级覆盖 `~/.dsh/usage-pricing.json`
   - 不存在时回退到内置 `pricing-default.json`
3. 新增 host 路由：
   - `GET /api/usage-pricing` —— 返回当前生效的价目表元数据（来源、更新时间、provider 数、模型数）
   - `POST /api/usage-pricing/refresh` —— 拉取 LiteLLM JSON、归一化、写入用户级文件，返回新统计
4. 重构 `src/cost.ts`：
   - 按 `provider/model` 完整字符串精确匹配
   - 内置常用别名映射（如 `deepseek-chat` -> `deepseek/deepseek-chat`）
   - provider 前缀兜底 + 通用档（cache 0.02 / input 1 / output 2 元/百万）
   - per-model 记录支持 `cached_input_per_m`、`cache_creation_per_m`
5. 新增 `src/client/PricingCard.tsx`：
   - 设置面板显示"定价快照"卡片
   - 展示当前来源、覆盖 provider/模型数、最后更新时间
   - 一键刷新按钮，调用 `POST /api/usage-pricing/refresh`
6. 新增 CLI：`scripts/refresh-pricing.mjs`
   - 离线/CI 环境手动刷新用户级价目文件
7. 构建：`pnpm --filter @captain1275/dsh-usage-dashboard build`

## 三、安装与验证

1. 构建两个包：
   - `pnpm --filter @captain1275/dsh-effort-slider build`
   - `pnpm --filter @captain1275/dsh-usage-dashboard build`
2. 链接进 DSH profile：`node scripts/link-profile.mjs`
3. 确认 profile 的 `cordis.patch.yml` 或 `package.json` bundles 已包含：
   - `@captain1275/dsh-effort-slider`
   - `@captain1275/dsh-usage-dashboard`
4. 刷新 `http://127.0.0.1:3080`。
5. 验证项：
   - 模型菜单点击"推理等级"弹出 Aqua 风滑块面板，可拖动并吸附
   - 设置面板出现"定价快照"卡片，可点击刷新并显示最新时间
   - 用量看板统计页显示多 provider 费用估算
   - 刷新页面后状态保持

## 四、风险与注意

- 与 Aqua 主题共存：滑块面板样式使用 Aqua 玻璃 token，避免背景、边框、圆角冲突。
- LiteLLM 刷新依赖网络；失败时回退到内置快照，看板仍可正常使用。
- 上游 npm 包更新会覆盖本地对 `dsh-usage-dashboard` 的修改；后续如需保留改动，需重新打补丁或维护本地分支。
- 本计划文件及后续代码均不包含 emoji。

## 五、交付物

- `packages/dsh-effort-slider/`（新增）
- `packages/dsh-usage-dashboard/`（修改）
- `docs/plan-2026-08-16-effort-slider-usage-pricing.md`（本文档）
- `scripts/refresh-pricing.mjs`（新增 CLI）
