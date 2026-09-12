# @captain1275/dsh-bilibili-download

DSH Web GUI 的 B 站视频下载插件。

插件**不占用侧边栏/主页空间**：入口是「设置 → 插件配置 → Web UI 插件」组里的「B 站视频下载」卡片。点开卡片 → 「打开下载面板」，以全屏模态层弹出：粘贴视频链接、登录 Cookie（SESSDATA / bili_jct / DedeUserID），选择画质，调用本机 `yt-dlp` + `ffmpeg` 下载并实时显示进度，完成后给出本地文件路径。

## 功能

- 视频信息获取：输入链接后自动拉取标题、时长、所有可用格式。
- 画质选择：内置 4K/1080P/720P 预设（HEVC / AV1 / AVC 编码）。
- 实时进度：下载百分比、速度、剩余时间。
- Cookie 登录：支持大会员/充电专属内容的高画质下载。
- 记住 Cookie：点「记住 Cookie」把 SESSDATA / bili_jct / DedeUserID 存入本地设置命名空间（`~/.dsh/settings.yaml`），下次打开面板自动填入；Cookie 失效后重新复制并更新即可。
- 复用 CDN 优化：自动走腾讯源（`cdn=coso1`），避免部分线路限速。

## 安装

本仓库（`packages/dsh-bilibili-download`）属于 `dsh-web-ui` 全家桶：

```sh
# 方式 A：把全家桶全部链接进 profile（推荐）
node scripts/link-profile.mjs

# 方式 B：单独链接本插件
dsh plugin --profile web add link:<repo>/packages/dsh-bilibili-download
```

重启 `dsh web` 后生效。

## 依赖

插件依赖宿主机已安装：

- `yt-dlp`（Python 的 `Scripts/yt-dlp.exe`，或 PATH 中可达）
- `ffmpeg`（可用 `pip install imageio-ffmpeg` 获得二进制，插件会自动探测该路径）

插件启动时会调用 `/api/dsh-bilibili-download/check` 探测并报告二者是否就绪。

## 使用

1. 打开 DSH Web → 设置 → 插件配置 → 展开「Web UI 插件」组。
2. 找到「B 站视频下载」卡片，展开，点「打开下载面板」。
3. 粘贴视频链接，填入 Cookie 三个值：`SESSDATA`（长串）、`bili_jct`、`DedeUserID`（你的 UID）。
4. 点「获取视频信息」，确认画质与格式。
5. 选好画质与保存位置，点「开始下载」，观察进度。
6. 完成后面板给出文件路径（默认保存到桌面 `B 站下载` 文件夹）。

## 架构

- **host 半区** `src/index.ts`：注册 `/api/dsh-bilibili-download/{check,info,start}` 三个路由；`start` 以 NDJSON 流式返回进度；下载用 `spawn` 启 `yt-dlp`。
- **browser 半区** `src/client/`：注册进 `web-ui.plugin.item` 插槽（设置页 Web UI 插件组的子槽）的卡片组件；下载面板以 React portal 到 `document.body` 的全屏模态层承载（`z-index: 9999` + fixed 遮罩），Esc 或点遮罩关闭。
- 类型/常量（`BILI_API`、`QUALITY_PRESETS`）放 `src/protocol.ts`，两半区共享。
- 文案走 `ctx.locale`：`src/client/locales.ts`（zh 源、en 对照）。

## 许可证

Apache-2.0
