# aqua 皮肤（玻璃拟态 · Glass）

dsh-web-ui 家族里的**玻璃拟态**皮肤：把整套界面换成悬浮磨砂卡片，或保持原版排版只换材质。原先是 DSH checkout 里 `packages/extensions/ui-experience`（"ui-experience 三合一"）的 Aqua 那一半；0.1.5 升级时拆出来独立成皮肤，另外两半（effort 滑块、用量看板）由本仓既有的 `dsh-effort-slider` / `dsh-usage-dashboard` 两个插件承担。

## 功能

- **两种渲染模式**：云母（mica，悬浮磨砂卡片）/ 兼容（compat，保持官方排版只把材质换成玻璃，其他插件的界面一并覆盖）
- **背景**：内置流体着色器（WebGL，可调色相）或自定义壁纸（本机选图，自动压到 ≤1920px 的 JPEG），另有背景亮度旋钮（深色模式压暗 / 浅色模式提亮）
- **粒子鲸鱼**：聊天区正中央的深海鲸鱼粒子（deepseek.com/harness 同款），可关
- **字标徽章**：侧栏字标上的 HARNESS 徽章
- **深浅两套深海调色板**：走 `ctx.theme.overrideTokens()` 覆盖层（不是硬写 CSS 变量），深浅由主题服务解析，跟随「外观」设置里的浅色 / 深色 / 跟随系统
- **零残留**：每一层都是 `ctx.effect`，关闭皮肤或卸载插件时 token 覆盖层、`data-dsh-*` 属性、环境容器、WebGL 上下文、观察者全部回收，界面精确回到官方原样

## 设置

皮肤注册两个设置面（0.1.5 的 keyed 协议）：

| 位置 | 内容 |
| --- | --- |
| 设置 → 插件 → 玻璃主题（`settings.plugin.item`，key = `aqua`） | 总开关 |
| 设置 → 通用 → 外观下方（`settings.general.item`，id = `aqua`，order 12） | 模式 / 玻璃模糊度 / 磨砂度 / 背景流体颜色 / 背景亮度 / 背景（流体·壁纸）/ 壁纸模糊度 / 壁纸磨砂度 / 粒子鲸鱼 |

宿主半区只注册一个空的 `aqua` 设置命名空间（设置页按命名空间分发插件卡片），所有旋钮值存在浏览器 `localStorage`（`dsh.ui-aqua.*`），并监听 `storage` 事件做跨标签同步。

## 兼容性说明（0.1.5）

- 样式表挂在 `html[data-dsh-aqua]` 上，官方 UI 的挂钩由运行期 `seam-stamper` 打点（`data-dsh-frame` / `data-dsh-sidebar-root` / `data-dsh-inputbar` / `data-dsh-stats` …），因此对官方源码零改动。
- 官方 DOM 改名时只需要更新 `seam-stamper.ts` 的选择器表与 `aqua.module.css` 里少量 `[class*=...]` 子串选择器；拿不到挂钩的规则静默不生效（降级为官方外观），不会报错。
- 本皮肤**不能**在 `gallery/preview.html` 的沙盒模拟器里试穿：它的客户端 bundle 需要 `react` / `react/jsx-runtime` / `ctx.slots`（设置卡片是 React 组件），而模拟器只提供最小 ctx。Gallery 卡片使用仓库里的真机截图；试穿请用皮肤中心（跑在真实 shell 里）。

## 开发

```sh
pnpm --filter @captain1275/dsh-client-ui-skin-aqua run build
pnpm --filter @captain1275/dsh-client-ui-skin-aqua test
```

字体：`src/client/fonts.module.css` 内嵌 Space Grotesk（SIL Open Font License 1.1，仅拉丁/数字），CJK 走系统字体栈。
