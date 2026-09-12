/**
 * EffortWire —— 把 0.1.5 的模型目录服务适配成 EffortPanel 原本消费的调用形状。
 *
 * 0.1.5 删除了 `connection.api.sessions.models/selectModel`：每会话的模型目录
 * 改由官方 ui-model-selection 的 `ctx.modelDirectories` 服务持有（同一份状态
 * 同时喂给 /model 弹层与 composer 模型座位），写入走 `ModelDirectory.select()`，
 * 失败以抛异常表达而不是 `result.ok=false`。
 *
 * 适配器的失败信封保留 `error` 字段：面板的诊断日志会读 `result.error.code`，
 * 保持这一点可以让面板在迁移后仍打印可读原因。
 * @module @captain1275/dsh-client-ui-skin-aurora/effort/wire
 */
import type { ModelDirectoryResolver, ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** One reasoning level as the panel renders it. */
export interface EffortLevel {
  id: string
  name: string
  description?: string
}

/** The advisory directory value the panel renders from. */
export interface DirectoryValue {
  current: { provider: string; model: string; reasoningEffort?: string } | null
  groups: Array<{
    id: string
    models: Array<{
      id: string
      reasoning?: { efforts?: EffortLevel[]; defaultEffort?: string }
    }>
  }>
}

/** 面板使用的两个调用；由 apply() 用服务实现后下沉。 */
export interface EffortWire {
  /** 拉取本会话的模型目录；失败统一表达为 `ok:false` 并带上原因。 */
  models(input: { sessionId: string }): Promise<{
    result:
      | { ok: true; value: DirectoryValue }
      | { ok: false; error: { code: string; message: string } }
  }>
  /** 写入本会话的推理档位；失败统一表达为 `ok:false`。 */
  selectModel(input: {
    sessionId: string
    provider: string
    model: string
    reasoningEffort: string
  }): Promise<{ result: { ok: boolean } }>
}

/**
 * 把目录快照投影成面板消费的形状。
 * @param state - 官方每会话目录的快照。
 * @returns 只含面板实际读取字段的目录值。
 */
function project(state: ModelDirectoryState): DirectoryValue {
  return {
    current: state.current === null
      ? null
      : {
        provider: state.current.provider,
        model: state.current.model,
        ...state.current.reasoningEffort === undefined
          ? {}
          : { reasoningEffort: state.current.reasoningEffort },
      },
    // Provider groups carry the same vocabulary the panel reads (id, models,
    // reasoning.efforts/defaultEffort); extra members ride along harmlessly.
    groups: state.groups as unknown as DirectoryValue['groups'],
  }
}

/**
 * 用 0.1.5 的 `ctx.modelDirectories` 实现 {@link EffortWire}。
 * @param directories - 官方每会话模型目录服务。
 * @returns 面板可用的读写接口。
 */
export function createEffortWire(directories: ModelDirectoryResolver): EffortWire {
  const directoryFor = (sessionId: string) => directories.directoryFor(sessionId as SessionId)
  return {
    async models({ sessionId }) {
      try {
        const directory = directoryFor(sessionId)
        await directory.load()
        const state = directory.store.getSnapshot()
        if (state.status === 'error') {
          return { result: { ok: false, error: { code: 'directory/error', message: state.error ?? 'directory unavailable' } } }
        }
        return { result: { ok: true, value: project(state) } }
      } catch (error) {
        return {
          result: {
            ok: false,
            error: {
              code: 'directory/unavailable',
              message: error instanceof Error ? error.message : String(error),
            },
          },
        }
      }
    },
    async selectModel({ sessionId, provider, model, reasoningEffort }) {
      try {
        await directoryFor(sessionId).select({ provider, model, reasoningEffort })
        return { result: { ok: true } }
      } catch {
        return { result: { ok: false } }
      }
    },
  }
}
