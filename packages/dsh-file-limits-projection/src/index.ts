/**
 * dsh-file-limits-projection: 把附件服务的 fileLimits 作为每次启动恒定的会话
 * 投影值发布（迁移自 DSH fork `host/apiproxy` 的 fileLimits unit）。
 *
 * 语义与 DSH 源码逐字一致：unit 只在「sessionProjections + attachments 两个
 * seam 都组合，且 attachment store 支持通用文件」时激活；store 不支持时
 * 静默不注册（客户端读到 key 缺席 = 能力缺失，等同 pre-file 基线）。
 *
 * 方案A 共存说明：DSH 源码补丁 040 已在宿主注册同 key 的 fileLimits unit。
 * 若本插件与源码补丁同时生效，会双份注册同 key —— 注册表按「先到先得/覆盖」
 * 语义处理（以 DSH 注册表实现为准）。验证本插件等效后，收敛 040 时应删除
 * 源码侧注册、仅保留本插件（见 README）。
 * @module @captain1275/dsh-file-limits-projection
 */

import { Context } from '@deepseek-ai/cordis'
import { z } from 'zod'
import type { FileAttachmentLimits } from '@deepseek-ai/dsh-attachment'
import type { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection'

/** 投影 unit 的 wire schema（与 DSH sessions.schema.ts 的 fileLimitsProjectionSchema 一致）。 */
export const fileLimitsProjectionSchema = z.object({
  maxFileBytes: z.number().int().positive(),
  maxFilesPerMessage: z.number().int().positive(),
  maxMessageFileBytes: z.number().int().positive(),
}) as unknown as z.ZodType<FileAttachmentLimits>

/** 注册所需的最小依赖面（便于单测注入 fixture）。 */
export interface FileLimitsProjectionDeps {
  sessionProjections: Pick<SessionProjectionRegistry, 'register'>
  /** 附件服务的 file 面；不支持通用文件的 store 读取 fileLimits 会抛错。 */
  attachments: { fileLimits: FileAttachmentLimits }
}

/**
 * 注册 fileLimits 投影 unit。store 不支持通用文件时静默跳过（key 缺席）。
 * @param deps - sessionProjections + attachments 依赖。
 * @returns 是否实际注册。
 */
export function registerFileLimitsProjection(deps: FileLimitsProjectionDeps): boolean {
  let fileSupport = false
  try { void deps.attachments.fileLimits; fileSupport = true } catch { fileSupport = false }
  if (!fileSupport) return false
  deps.sessionProjections.register<'fileLimits', null>({
    key: 'fileLimits',
    schema: fileLimitsProjectionSchema,
    init: () => null,
    apply: state => state,
    view: () => deps.attachments.fileLimits,
    stateVersion: 1,
  })
  return true
}

/** 需要的宿主服务：sessionProjections（注册表）+ attachments（file 面来源）。 */
export const inject = ['sessionProjections', 'attachments']

/**
 * 插件 apply：两个 seam 就绪后注册 fileLimits 投影 unit。
 * @param ctx - 宿主上下文（sessionProjections/attachments 服务）。
 */
export function apply(ctx: Context): void {
  ctx.inject(['sessionProjections', 'attachments'], (projectionCtx) => {
    registerFileLimitsProjection({
      sessionProjections: projectionCtx.sessionProjections,
      attachments: projectionCtx.attachments,
    })
  })
}
