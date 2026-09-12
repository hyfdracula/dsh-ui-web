# dsh-pane-shape

**跨皮肤的面板形状层**：只决定三块区域的"形状"，配色/材质仍由皮肤决定。

## 它管什么

| 形状 | 做法 |
|---|---|
| 右栏不再是"实心平板" | 面板落到形状层的材质（半透明填充 + 背景模糊），内部 `data-dockkit-*` 容器保持透明 |
| 右栏也作为气泡（不再顶天立地） | 只在停靠 `push` 形态内缩 12px 并四角圆角；套件自己的浮层/全屏形态原样不动，只给朝向会话的那条边留圆角（`--dsh-pane-radius-flush`，18px） |
| 三块圆角统一 | 会话区顶卡、侧栏列、右栏气泡共用 `--dsh-pane-radius`（默认 24px） |
| 三块顶行对齐 | 侧栏列上内边距归零 + 品牌行上提 13px，让三块的第一行落在同一条线 |
| 侧栏也有磨砂 | 补上这一层缺失的背景模糊 |
| 接缝与分隔线 | 面板接缝 `--dsh-pane-hairline`、面板内标签条分隔线 `--dsh-pane-divider` |

## 它不管什么（留给皮肤）

玻璃配方（渐变、磨砂强度滑块）、字号、投影颜色、品牌装饰。皮肤通过**旋钮**把自己的材质交给本层：

```css
/* Aqua 里的写法：两个属性选择器（0-2-0）压过本层在 [data-dsh-pane-shape] 上的默认值 */
[data-dsh-aqua][data-dsh-pane-shape] {
  --dsh-pane-blur: var(--dsh-aqua-blur, 14px);
  --dsh-pane-fill: var(--dsh-aqua-glass-card-light);
  --dsh-pane-hairline: rgba(19, 45, 83, 0.26);
  --dsh-pane-divider: rgba(19, 45, 83, 0.12);
  --dsh-pane-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 8px 32px rgba(19, 45, 83, 0.12);
}
```

可调旋钮：`--dsh-pane-inset` / `--dsh-pane-radius` / `--dsh-pane-radius-flush` /
`--dsh-pane-blur` / `--dsh-pane-fill` / `--dsh-pane-hairline` / `--dsh-pane-divider` /
`--dsh-pane-shadow`。

## 层叠（为什么门控写 `:root[data-dsh-pane-shape]`）

本 bundle 排在皮肤**之前**（`dsh.profile.bundles` 的顺序就是层叠顺序），所以：

- **旋钮**声明在 `[data-dsh-pane-shape]`（0-1-0）：皮肤用 `[data-…][data-dsh-pane-shape]`（0-2-0）覆盖，与两个 bundle 的先后无关；
- **元素规则**门控写 `:root[data-dsh-pane-shape]`（0-2-0，再加本层自己贴的钩子属性=0-3-0）：外壳自己的卡片规则
  （`[data-dsh-float] [class*='sidebarCol'] { box-shadow: …; padding: … }`）也是 0-2-0 **且排在本 bundle 之后**，
  同权重时会赢——侧栏列就会留着外壳的 10px 上内边距和自己的卡片阴影（实测品牌行 35px 而不是 25px）；
- 皮肤要**按元素**覆盖某个形状属性时，需要写到 0-3-1 以上（Aqua 的深色卡片规则就踩过这个坑：它带 `body` 类型选择器
  是 0-3-1，会盖住本层的列规则 0-3-0，让深色下"列比面板小一号阴影"）。**优先用旋钮**，不要按元素抢属性。

## 已知雷区（本层已处理）

`backdrop-filter` 会让元素成为 `position: fixed` 后代的**包含块**。设置对话框注册在侧栏列里（`sidebar.settings`），遮罩是 `position: fixed; inset: 0`——所以侧栏的磨砂一旦常开，设置面板就会被压进侧栏宽度（实测 254×802 / 视口 1500×950）。本层用
`:root[data-dsh-pane-shape] [data-dsh-pane-shape-col]:has([aria-modal='true']) { backdrop-filter: none }`
在有模态时让位，关闭即恢复。

## 安装

```powershell
node C:\Users\19161\deepseek-harness-next\apps\cli\lib\bin.js plugin --profile web add link:C:/Users/19161/Documents/dsh-work/packages/dsh-pane-shape
```

装完需要一次宿主重启（它要进 boot 图），并且这一行要排在皮肤之前。**不随聚合包发布**：它依赖本机的皮肤组合与 profile 顺序。

## 卸载

从 profile 的 `dependencies` 与 `dsh.profile.bundles` 里去掉即可；本层在卸载时会自己摘掉
`data-dsh-pane-shape` 与全部钩子，界面回到原样。

## 验收

```powershell
node dsh-0.1.5-upgrade/pane-shape-verify.mjs --port 3080 --token <t> --fingerprint fp.json
```

25 条断言：boot 图/门控/钩子/旋钮、三块几何（inset 12、圆角 24、顶行对齐）、设置面板模态与磨砂守卫、
展开态（面板真正落进视口仍是 push 形状）、深色（列与右栏同一张卡片阴影、接缝与分隔线、磨砂跟随滑块、圆角）、console 无错误。
`--fingerprint` 打出计算样式指纹，供"把形状规则从皮肤里抽出来"这类改动做前后逐值比对（本轮实测浅色两态 0 差异）。
