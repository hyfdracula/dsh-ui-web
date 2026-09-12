# dsh-file-attachment

通用**文件附件存储 provider**（host 侧，node）：`fileLimits` / `validateFile` / `saveFile` / `readFile`，sha256 内容寻址存到 `DSH_HOME/attachments/v1`，读时完整性校验。

从 DSH fork 源码（`attachment-local/src/file-store.ts` + `store.ts` 图片无关子集）迁移，存储语义与 fork 逐字一致；File 类型在本包内重新声明（`src/types.ts`），因此可独立构建/测试，运行时与 fork 的 file 面结构兼容。

## 用法

```ts
import { FileAttachmentStore } from '@captain1275/dsh-file-attachment'

const store = FileAttachmentStore.atDshHome(dshHome) // 默认无限制
const ref = await store.saveFile({ data, mediaType: 'application/pdf', name: 'a.pdf' })
const { data: bytes } = await store.readFile(ref)
```

## 限额

默认与 fork 一致：`UNLIMITED_ATTACHMENT = Number.MAX_SAFE_INTEGER`（不限制数量/大小/总量）；可传显式 `FileAttachmentLimits` 构造。

## 构建与测试

```sh
pnpm --filter @captain1275/dsh-file-attachment build   # tsdown (host pass) → lib/
pnpm --filter @captain1275/dsh-file-attachment test    # vitest
```

## 接入说明（方案A）

当前是**独立 provider 库**（DSH fork 补丁 030/070 暂留，宿主仍走 fork 的 attachment-local）。要让宿主真正用本 provider，二选一：

1. 本包 node apply 把 store 注入宿主附件服务（需 DSH attachment seam 支持外部 file provider）；
2. DSH fork 的 attachment-local 补丁 import 本包、把 file 面委托给它（后续收敛 030/070 时做）。

两种都先保持本包可独立构建/测试，再接线上生效。
