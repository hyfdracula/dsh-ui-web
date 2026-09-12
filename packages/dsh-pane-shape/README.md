# dsh-pane-shape

**跨皮肤的面板形状层**：只决定三块区域的"形状"，配色/材质仍由皮肤决定。

## 它管什么

| 形状 | 做法 |
|---|---|
| 右栏不再是"实心平板" | 面板落到回退材质（半透明填充 + 背景模糊），内部 `data-dockkit-*` 容器保持透明，标签条加一条分隔线 |
| 右栏也作为气泡（不再顶天立地） | 只在停靠 `push` 形态内缩 12px 并四角圆角；套件自己的全屏/浮层形态原样不动 |
| 三块圆角统一 | 会话区顶卡、侧栏列、右栏气泡共用 `--dsh-pane-radius`（默认 24px） |
| 三块顶行对齐 | 侧栏列上内边距归零 + 品牌行上提，让三块的第一行落在同一条线 |
| 侧栏也有磨砂 | 补上这一层缺失的背景模糊 |

## 它不管什么（留给皮肤）

玻璃配方（渐变、磨砂强度滑块）、字号、投影颜色、品牌装饰。皮肤只要用自己的规则覆盖同名属性即可——**因此本 bundle 必须排在皮肤之前**（`dsh.profile.bundles` 的顺序就是层叠顺序）。

可调旋钮（皮肤可覆盖）：`--dsh-pane-inset` / `--dsh-pane-radius` / `--dsh-pane-blur` / `--dsh-pane-fill` / `--dsh-pane-hairline` / `--dsh-pane-shadow`。

## 已知雷区（本层已处理）

`backdrop-filter` 会让元素成为 `position: fixed` 后代的**包含块**。设置对话框注册在侧栏列里（`sidebar.settings`），遮罩是 `position: fixed; inset: 0`——所以侧栏的磨砂一旦常开，设置面板就会被压进侧栏宽度（实测 254×802 / 视口 1500×950）。本层用
`[data-dsh-pane-shape-col]:has([aria-modal='true']) { backdrop-filter: none }`
在有模态时让位，关闭即恢复。

## 安装

```powershell
node C:\Users\19161\deepseek-harness-next\apps\cli\lib\bin.js plugin --profile web add link:C:/Users/19161/Documents/dsh-work/packages/dsh-pane-shape
```

装完需要一次宿主重启（它要进 boot 图）。**不随聚合包发布**：它依赖本机的皮肤组合与 profile 顺序。

## 卸载

从 profile 的 `dependencies` 与 `dsh.profile.bundles` 里去掉即可；本层在卸载时会自己摘掉
`data-dsh-pane-shape` 与全部钩子，界面回到原样。
