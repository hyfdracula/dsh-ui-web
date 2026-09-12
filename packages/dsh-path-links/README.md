# dsh-path-links

把文本里的 Windows 绝对路径切分成可点击 token 的**纯函数库**。

从 DSH fork 源码（`ui-conversation/src/client/path-links.ts`）迁移而来，保持逻辑逐字一致，供任何 client bundle 通过 loader 模块表 import 复用（例如官方 `MessageItem` 的 `projectUserText` 增强版），也可独立发布 npm。

## 用法

```ts
import { splitPathTokens, type PathToken } from '@captain1275/dsh-path-links'

const tokens = splitPathTokens('请查看 C:\\Users\\19161\\Desktop\\a.md 这个文件')
// [{ text: '请查看 ' }, { path: 'C:\\Users\\19161\\Desktop\\a.md' }, { text: ' 这个文件' }]
```

## 规则

- 裸路径：盘符前需词边界；尾部半角/全角标点裁剪；字符集排除 CJK（含中文的裸路径请带引号）。
- 带引号路径（`"C:\…"` / `"\\server\share\…"`）：引号内逐字保留（复制为路径语义）。
- 排除 `\\?\` `\\.\` 设备前缀。
- UNC 路径（`\\server\share\...`）支持。

## 构建与测试

```sh
pnpm --filter @captain1275/dsh-path-links build   # tsdown → lib/
pnpm --filter @captain1275/dsh-path-links test    # vitest
```

## 说明

纯函数库包，无 client apply 副作用，**不需要**在 profile `cordis.patch.yml` insert。若未来作为独立渲染插件挂载（slot 渲染可点击路径），再补 insert。
