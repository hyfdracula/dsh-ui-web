/**
 * dsh-open-path 无浏览器行为：链接化逻辑在对话气泡渲染侧（ui-conversation
 * fork），它调用 POST /api/open-path。此 stub 只保证共享 client 构建预设
 * 的入口存在；包无 dsh.client 声明，运行时不会加载它。
 * @module @captain1275/dsh-open-path/client
 */
import type { Context } from '@deepseek-ai/cordis'

/** 需要的客户端服务：无。 */
export const inject: string[] = []

/** 浏览器半区：空实现。 */
export function apply(_ctx: Context): void {}