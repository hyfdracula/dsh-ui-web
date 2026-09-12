/**
 * quick-restart 的词典。zh 是 key 源，en 完整对照（仓库 i18n 惯例）。
 * @module @captain1275/dsh-quick-restart/client/locales
 */

/** 词典命名空间。 */
export const NS = 'quick-restart'

/** zh 是 key 源：这个联合类型就是词典的键集合。 */
export type QuickRestartKey =
  | 'entry.label'
  | 'entry.tooltip'
  | 'entry.pending'
  | 'entry.pendingHint'
  | 'entry.failed'
  | 'entry.requested'
  | 'entry.state.pending'
  | 'entry.state.idle'
  | 'entry.keeper'

/** zh（key 源）/ en 对照。 */
export const dictionaries: Record<string, Record<string, string>> = {
  zh: {
    'entry.label': '重启 DSH',
    'entry.tooltip': '排队重启：宿主空闲时自动重启，不需要手动参与',
    'entry.pending': '已排队重启',
    'entry.pendingHint': '巡检会在没有回合运行时自动重启',
    'entry.failed': '排队失败',
    'entry.requested': '已排队：空闲后自动重启',
    'entry.state.pending': '状态：已排队（{time}）',
    'entry.state.idle': '状态：无待处理请求',
    'entry.keeper': '巡检日志',
  },
  en: {
    'entry.label': 'Restart DSH',
    'entry.tooltip': 'Queue a restart: the keeper bounces the Host once it is idle',
    'entry.pending': 'Restart queued',
    'entry.pendingHint': 'The keeper restarts as soon as no turn is running',
    'entry.failed': 'Could not queue',
    'entry.requested': 'Queued: restarts automatically when idle',
    'entry.state.pending': 'State: queued ({time})',
    'entry.state.idle': 'State: nothing pending',
    'entry.keeper': 'Keeper log',
  },
}
