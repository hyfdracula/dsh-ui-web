/**
 * dsh-effort-slider — browser half.
 *
 * 独立档位入口：在 `conversation.input.right` 列表座位（模型选择器右边）
 * 注册一个触发器 chip，点开即自己的滑块弹层（复用 EffortPanel 浮动卡片
 * 形态）。官方插槽注册，零 DOM 注入：不观察、不修改官方模型菜单，官方
 * 「推理等级」行保持原生行为。
 *
 * 当前模型不提供多档推理时触发器整体退场；无会话（Draft）不渲染。
 * 卸载语义与皮肤契约一致：apply() 只挂自己能回收的东西，ctx.effect 的
 * disposer 负责全部还原（插槽注销即卸载组件）。
 * @module @captain1275/dsh-effort-slider/client
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { EffortTrigger } from './EffortTrigger.tsx'

/** 需要的客户端服务：slots（插槽注册）、connection（模型目录读写）。 */
export const inject: string[] = ['slots', 'connection']

/**
 * 在 composer 工具条右侧注册档位触发器。
 * @param ctx - 宿主上下文（slots/connection 服务）。
 */
export function apply(ctx: Context): void {
  const slots = ctx.get('slots') as {
    inject(name: string, factory: () => unknown): void
  }
  const connection = ctx.get('connection') as ConnectionHandle

  slots.inject('conversation.input.right', () => (ctx.get('slots') as {
    register(spec: Record<string, unknown>, component: unknown): () => void
  }).register({
    name: 'conversation.input.right',
    id: 'effort-slider',
    order: 100,
    label: '推理等级',
    inject: (sessionId?: string) => ({
      connection,
      ...(sessionId === undefined ? {} : { sessionId }),
    }),
  }, EffortTrigger))
}
