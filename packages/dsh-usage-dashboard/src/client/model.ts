/**
 * 客户端模型的模块级状态：当前活跃会话 id 与当前模型名（尽力而为）。
 * 由入口的模型轮询写入，recorder 上报时读取；
 * 无活跃会话时轮询暂停（X1），flush 时模型未知则按需取一次（C5）。
 * @module @captain1275/dsh-usage-dashboard/client/model
 */

/** 当前模型标识（provider/model），unknown 表示尚未取到。 */
let currentModel = 'unknown'

/** 当前活跃会话 id（recorder 每次挂载/更新时同步；入口轮询按它查询）。 */
let activeSessionId: string | undefined

/** 会话 id 变化监听（入口的模型轮询用它启停定时器）。 */
let sessionChangeListener: (() => void) | undefined

/** 连接层模型查询器（入口注册；recorder 在 flush 时按需调用）。 */
let modelFetcher: ((sessionId: string) => Promise<string | undefined>) | undefined

/** 设置当前模型（连接层回调 / 一对一查询结果）。 */
export function setCurrentModel(model: string | undefined): void {
  if (typeof model === 'string' && model.length > 0) currentModel = model
}

/** 读当前模型。 */
export function getCurrentModel(): string {
  return currentModel
}

/** 读当前活跃会话 id（入口的模型轮询用）。 */
export function getActiveSessionId(): string | undefined {
  return activeSessionId
}

/** 设置当前活跃会话 id；变化时通知入口重启/暂停轮询。 */
export function setActiveSessionId(sessionId: string | undefined): void {
  if (activeSessionId === sessionId) return
  activeSessionId = sessionId
  sessionChangeListener?.()
}

/** 注册会话 id 变化监听（入口的模型轮询用）。 */
export function setSessionChangeListener(listener: (() => void) | undefined): void {
  sessionChangeListener = listener
}

/** 注册连接层模型查询器（入口注册）。 */
export function setModelFetcher(fetcher: ((sessionId: string) => Promise<string | undefined>) | undefined): void {
  modelFetcher = fetcher
}

/** 按会话查询一次模型；结果写入 currentModel。 */
export async function refreshCurrentModel(sessionId: string): Promise<void> {
  if (modelFetcher === undefined) return
  try {
    const model = await modelFetcher(sessionId)
    if (typeof model === 'string' && model.length > 0) currentModel = model
  } catch {
    /* 查询失败保持上次值 */
  }
}