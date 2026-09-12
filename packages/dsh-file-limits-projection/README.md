# dsh-file-limits-projection

把附件服务的 `fileLimits`（`maxFileBytes` / `maxFilesPerMessage` / `maxMessageFileBytes`）作为**每次启动恒定**的会话投影值发布给客户端，供 intake 预检与配额文案。从 DSH fork 源码（`host/apiproxy` 的 fileLimits unit）迁移，注册逻辑逐字一致。

## 机制

- host 插件：`ctx.inject(['sessionProjections', 'attachments'])` 就绪后注册 `fileLimits` unit（`key/schema/init/apply/view/stateVersion` 与 DSH 源码同构）。
- 附件 store 不支持通用文件时静默跳过（key 缺席 = 能力缺失），与 DSH pre-file 基线一致。

## 构建与测试

```sh
pnpm --filter @captain1275/dsh-file-limits-projection build   # tsdown → lib/
pnpm --filter @captain1275/dsh-file-limits-projection test    # vitest
```

## 接入说明（方案A）

默认不 insert（避免与 DSH fork 040 补丁里已注册的同 key unit 双份冲突）。生效路径：先在宿主组合本插件 → 验证投影等效 → 从 DSH 040 补丁删除源码侧 fileLimits 注册，仅保留本插件。
