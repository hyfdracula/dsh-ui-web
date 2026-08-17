/**
 * Usage recorder 的纯决策逻辑（与 React 解耦，便于单元测试）。
 *
 * 协议（C1/H3 家族）：
 *  - 首次见到一个会话（挂载 / 页面刷新 / 切会话后）建立基线：随快照发
 *    reset:true。宿主收到 reset 只替换 bySession 桶，之后该会话的增长
 *    差值严格等于真实新增 —— 宿主快照再怎么落后（丢 flush / 外部改旧）
 *    也不会把"上次没传上来的一段"重复计入 day/model/total。
 *  - 增长：armed settle flush（组件层）；长流期间由检查点定时器兜底，
 *    把丢失窗口从"整个流"缩到 10s。
 *  - 投影回退（压缩/重算/过期修正）：reset:true 重新对齐客户端与宿主的
 *    基线（这是 replace+delta 混合语义下唯一自洽的对齐方式；day/total
 *    保留已累计的历史，属于文档化的展示漂移，见 H5）。
 * @module @captain1275/dsh-usage-dashboard/client/recorder-core
 */

/** 一次投影观察（会话累计快照）。 */
export interface RecorderSnapshot {
  sessionId: string
  input: number
  output: number
  cache: number
  cacheWrite: number
}

/** 记录器内存态。 */
export interface RecorderMemory {
  /** 上次观察的会话 id。 */
  lastSid: string | undefined
  /** 会话累计基线（-1 = 未建立）。 */
  lastTotal: number
  /** 最近一次观察的快照（settle flush / 检查点 / 卸载补发用）。 */
  lastSeen: RecorderSnapshot | null
}

/** 初始内存态（基线未建立）。 */
export const EMPTY_RECORDER_MEMORY: RecorderMemory = { lastSid: undefined, lastTotal: -1, lastSeen: null }

/** 决策后的动作。 */
export type RecorderAction =
  /** 建立/重对齐基线：随快照发 reset:true。 */
  | 'reset'
  /** 增长：启动/重置 settle flush 定时器。 */
  | 'arm-settle'
  /** 无动作。 */
  | 'none'

/** 一次投影观察的决策结果。 */
export interface RecorderDecision {
  /** 更新后的内存态。 */
  next: RecorderMemory
  /** 需要执行的动作。 */
  action: RecorderAction
  /** 切会话时旧会话的未决快照（需先补发，避免整段丢失，C1）。 */
  staleFlush: RecorderSnapshot | null
  /** 是否发生了会话切换。 */
  switched: boolean
}

/** 一次投影观察后的状态机决策。 */
export function decideRecorderStep(
  memory: RecorderMemory,
  sessionId: string | undefined,
  snapshot: RecorderSnapshot | undefined,
): RecorderDecision {
  if (sessionId === undefined || snapshot === undefined) {
    // 会话或投影未就绪：保持现状，不建立基线。
    return { next: memory, action: 'none', staleFlush: null, switched: false }
  }
  const total = snapshot.input + snapshot.output + snapshot.cache + snapshot.cacheWrite
  // 首次见到（lastSid 尚未建立）不算"切换"：没有旧会话可切，也没有 stale 可补发。
  const switched = memory.lastSid !== undefined && memory.lastSid !== sessionId
  const staleFlush = switched ? memory.lastSeen : null
  if (switched || memory.lastTotal === -1) {
    // 首次见到该会话 / 换会话：建立基线，随快照发 reset:true（C2 的
    // "0 基线"也在此覆盖：投影累计为 0 时同样发 reset，宿主记下基线 0）。
    return {
      next: { lastSid: sessionId, lastTotal: total, lastSeen: snapshot },
      action: 'reset',
      staleFlush,
      switched,
    }
  }
  const prev = memory.lastTotal
  if (total > prev) {
    // 真实增长：基线推进到最新（仅在增长分支更新基线，C3），armed settle flush。
    return {
      next: { lastSid: sessionId, lastTotal: total, lastSeen: snapshot },
      action: 'arm-settle',
      staleFlush: null,
      switched: false,
    }
  }
  if (total < prev) {
    // 投影回退（压缩/重算/过期修正）：reset 重新对齐双方基线（C4 顺带
    // 消除"客户端认定增长、宿主认定 0 差"的两端不一致）。
    return {
      next: { lastSid: sessionId, lastTotal: total, lastSeen: snapshot },
      action: 'reset',
      staleFlush: null,
      switched: false,
    }
  }
  // 值未变：无动作（重复渲染 / 同快照重放不触发上报）。
  return { next: memory, action: 'none', staleFlush: null, switched: false }
}