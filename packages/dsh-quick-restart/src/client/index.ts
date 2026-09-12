/**
 * dsh-quick-restart — 浏览器半区。
 *
 * 在 `sidebar.footer.action` 座位注册一个「重启 DSH」入口（设置按钮那一排）。
 * 点一下 POST /api/quick-restart/request，宿主半区写下重启请求文件；
 * 进程外的巡检（计划任务 DSH Restart Agent，每 2 分钟一次）发现请求后，
 * 先问宿主有没有回合在跑，等到空闲再停→起→替换窗口。所以这里不做任何
 * "立即重启"的假动作：入口只负责排队 + 把状态显示清楚。
 *
 * 轮询状态（15 s）只读一个 JSON，不碰官方任何服务。
 * @module @captain1275/dsh-quick-restart/client
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only：拉进 ui-sidebar 的 SlotMap 合并（'sidebar.footer.action' 座位）、
// ui-renderer 的 ctx.slots 合并，以及 locale 的 Context 合并。
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { QuickRestartEntry } from './QuickRestartEntry.tsx'
import { NS, dictionaries, type QuickRestartKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** 侧栏重启入口的文案。 */
    'quick-restart': QuickRestartKey
  }
}

/** 需要的客户端服务：slots（插槽）、locale（词典）。 */
export const inject: string[] = ['slots', 'locale']

interface SlotsService {
  inject(name: string, factory: () => unknown): void
  register(spec: Record<string, unknown>, component: unknown): () => void
}

interface LocaleService {
  register(namespace: string, dictionaries: Record<string, Record<string, string>>): () => void
}

/**
 * 注册词典与侧栏入口。
 * @param ctx - 宿主上下文（slots/locale 服务）。
 */
export function apply(ctx: Context): void {
  const locale = ctx.get('locale') as LocaleService | undefined
  const slots = ctx.get('slots') as SlotsService | undefined
  if (slots === undefined) return

  ctx.effect(() => {
    const disposeLocale = locale?.register(NS, dictionaries) ?? ((): void => {})
    return () => { disposeLocale() }
  }, 'quick-restart.locale')

  slots.inject('sidebar.footer.action', () => slots.register({
    name: 'sidebar.footer.action',
    id: 'quick-restart',
    order: 50,
    locale: NS,
    inject: () => ({}),
  }, QuickRestartEntry))
}
