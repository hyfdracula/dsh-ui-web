/**
 * dsh-effort-slider 纯逻辑层：档位数学、最高档推断、重试/退避策略、
 * 语义判定等不依赖 React/CSS 的部分。集中在这里以便 vitest 直接单测
 * （tests/logic.test.ts），组件层只负责把它们接到状态与 DOM 上。
 *
 * 关键契约（与 @deepseek-ai/dsh-host-apiproxy 的 SessionModels 一致）：
 * - efforts 是 "adapter-preferred display order"（展示顺序），不承诺按强度升序；
 * - current.reasoningEffort 缺省（undefined/null）表示沿用适配器默认；
 * - '' 属于显式取值（OFF/关闭语义），不属于缺省（条目 16）。
 */

/** 面板宽度（与 effort.module.css .panel 一致）。 */
export const PANEL_W = 280
/** 面板左右内边距合计（.inner 的 padding 16px * 2）。 */
export const PANEL_PADDING_X = 32
/** 轨道宽度：range 输入实际可用宽度。 */
export const TRACK_W = PANEL_W - PANEL_PADDING_X
/** range thumb 直径（CSS .range 的滑块玻璃珠 26px）。 */
export const THUMB_SIZE = 26
/** thumb 半径：thumb 中心在轨道两端的缩进量。 */
export const THUMB_HALF = THUMB_SIZE / 2

/** 轮询/写入基准间隔（ms）。 */
export const POLL_BASE_MS = 1000
/** 退避封顶（ms）。 */
export const RETRY_MAX_MS = 30000
/** 同一自动写 key 的最大失败次数，超过后放弃到下次模型切换（key 变化）。 */
export const AUTO_WRITE_MAX_ATTEMPTS = 5
/** 目录请求挂起超时（ms）：超过即按失败处理（条目 5）。 */
export const DIRECTORY_TIMEOUT_MS = 10000

/** 档位项的最小子集（与 dsh-host-apiproxy ModelReasoningEffort 对齐）。 */
export interface EffortLevelLike {
  id: string
  name: string
  description?: string
}

/**
 * 指数退避间隔：基准 1s 起按 5 倍增殖，封顶 30s
 * （1s -> 5s -> 25s -> 30s -> 30s ...，即审查要求的 1s->5s->30s 上限）。
 * 调用约定按用途偏移：轮询直接传"连续失败次数"（0 失败 = 1s 基准）；自动写
 * 传"失败次数 - 1"（第 1 次失败后等 1s、第 2 次 5s、第 3 次起 25s/30s）。
 */
export function retryDelayMs(steps: number): number {
  return Math.min(POLL_BASE_MS * 5 ** Math.max(steps, 0), RETRY_MAX_MS)
}

/** 自动写重试状态：同一 key 的失败计数与最近失败时间戳。 */
export interface AutoWriteRecord {
  key: string
  attempts: number
  lastFailureAt: number
}

/**
 * 自动写下一次重试的等待毫秒数：0 表示立刻可写；null 表示同一 key 已失败
 * AUTO_WRITE_MAX_ATTEMPTS 次，放弃（等待 key 变化——模型切换或目录换档——
 * 才能重新计数）。"失败时间戳 + 推演间隔"而不是"清空 key"，避免每秒重试风暴
 * （条目 4）。
 */
export function nextAutoWriteDelay(record: AutoWriteRecord | undefined, now: number): number | null {
  if (record === undefined) return 0
  if (record.attempts >= AUTO_WRITE_MAX_ATTEMPTS) return null
  const delay = retryDelayMs(record.attempts - 1)
  return Math.max(0, record.lastFailureAt + delay - now)
}

/**
 * reasoningEffort 是否"未设置"：仅 undefined/null 视为未设置；
 * '' 是显式取值（OFF 语义），不触发自动写也不与缺省混淆（条目 16）。
 */
export function isEffortUnset(value: string | undefined | null): value is undefined | null {
  return value === undefined || value === null
}

/**
 * 推断最高档位。efforts 契约只是"展示顺序"，不保证按强度升序（第三方
 * 适配器可能是降序或乱序），因此不能盲信"最后一项 = 最高档"（条目 8）。
 * 策略：按语义提示词（max/ultra/high）在 id/name 中匹配，同一提示词命中
 * 多项时取最后一个（升序展示下即该档的最高者）；全部未命中才回退到
 * "最后一项"。
 * 假设：官方适配器的展示顺序为强度升序，最后一项即最高档；对不遵循升序的
 * 第三方适配器，语义匹配在多数情况下给出正确结果，极端乱序时仍可能出错——
 * 这是目录契约不提供强度字段下的最佳可做法。
 */
const HIGHEST_HINTS = ['max', 'ultra', 'high'] as const

export function pickHighest<E extends EffortLevelLike>(efforts: readonly E[]): E | undefined {
  if (efforts.length === 0) return undefined
  for (const hint of HIGHEST_HINTS) {
    let match: E | undefined
    for (const entry of efforts) {
      const hay = `${entry.id} ${entry.name}`.toLowerCase()
      if (hay.includes(hint)) match = entry
    }
    if (match !== undefined) return match
  }
  return efforts[efforts.length - 1]
}

/** 档位间的步长（0..100 连续滑块）：n 档平均分 100，1 档/空档退化为占满。 */
export function step100ForCount(count: number): number {
  return count > 1 ? 100 / (count - 1) : 100
}

/** 档位下标 -> 滑块原始值。 */
export function rawForEffortIndex(index: number, step100: number): number {
  return index * step100
}

/** 滑块原始值 -> 最近档位下标（含 0..count-1 夹取；count 无效时 -1）。 */
export function effortIndexForRaw(raw: number, step100: number, count: number): number {
  if (count <= 0) return -1
  if (step100 <= 0) return 0
  const idx = Math.round(raw / step100)
  return Math.max(0, Math.min(count - 1, idx))
}

/** 在目录 efforts 中按 id 找档位下标；找不到返回 -1。 */
export function effortIndexForId(efforts: readonly EffortLevelLike[], id: string): number {
  return efforts.findIndex((entry) => entry.id === id)
}

/**
 * 档位槽位在轨道上的左偏移（px）：与 thumb 中心行程对齐（条目 17）。
 * thumb 中心从 THUMB_HALF 走到 TRACK_W - THUMB_HALF；fraction 0..1 会被夹取。
 * 标签、圆点、光斑、填充前缘全部使用同一公式。
 */
export function slotLeftPx(fraction: number): number {
  const f = fraction < 0 ? 0 : fraction > 1 ? 1 : fraction
  return THUMB_HALF + f * (TRACK_W - THUMB_SIZE)
}

/**
 * 档位标签文案：默认用 entry.name（第一档也不再硬编码 OFF，条目 20）；
 * 仅当 id/name 含 off/关闭 语义时才显示 OFF。
 */
export function levelLabel(entry: EffortLevelLike): string {
  const hay = `${entry.id} ${entry.name}`.toLowerCase()
  if (hay.includes('off') || hay.includes('关闭')) return 'OFF'
  return entry.name
}