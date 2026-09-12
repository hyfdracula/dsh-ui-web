/**
 * EffortWire —— 把 0.1.5 的模型目录服务适配成本插件组件原本就消费的调用形状。
 *
 * 0.1.5 删除了 `connection.api.sessions.models/selectModel`：每会话的模型目录
 * 改由官方 ui-model-selection 的 `ctx.modelDirectories` 服务持有（同一份状态
 * 同时喂给 /model 弹层与 composer 模型座位），写入走 `ModelDirectory.select()`，
 * 失败以抛异常表达而不是 `result.ok=false`。
 *
 * 这里只做形状适配、不改组件逻辑：`models()` 映射成旧的 `{result:{ok,value}}`
 * 信封，`selectModel()` 把抛出翻译回 `{result:{ok:false}}`，于是两个组件对
 * 「业务失败保留旧值并标错」的既有处理完全不变。
 * @module @captain1275/dsh-effort-slider/client/wire
 */
import type { ModelDirectoryResolver, ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { SessionId } from '@deepseek-ai/dsh-session'

/** One reasoning level as the slider renders it. */
export interface EffortLevel {
  id: string
  name: string
  description?: string
}

/** The advisory directory value the components render from. */
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

/** 组件使用的两个调用；由 apply() 用服务实现后经插槽注入面下沉。 */
export interface EffortWire {
  /** 拉取并返回本会话的模型目录；失败统一表达为 `ok:false`。 */
  models(input: { sessionId: string }): Promise<{ result: { ok: true; value: DirectoryValue } | { ok: false } }>
  /** 写入本会话的推理档位；失败统一表达为 `ok:false`。 */
  selectModel(input: {
    sessionId: string
    provider: string
    model: string
    reasoningEffort: string
  }): Promise<{ result: { ok: boolean } }>
}

/**
 * 把目录快照投影成组件消费的形状。
 * @param state - 官方每会话目录的快照。
 * @returns 只含组件实际读取字段的目录值。
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
    // Provider groups carry the same vocabulary the slider reads (id, models,
    // reasoning.efforts/defaultEffort); the extra members stay along harmlessly.
    groups: state.groups as unknown as DirectoryValue['groups'],
  }
}

/**
 * 用 0.1.5 的 `ctx.modelDirectories` 实现 {@link EffortWire}。
 * @param directories - 官方每会话模型目录服务。
 * @returns 组件可用的读写接口。
 */
export function createEffortWire(directories: ModelDirectoryResolver): EffortWire {
  // 插槽注入的 sessionId 字符串在宿主侧即合法 SessionId（原实现同款收窄）。
  const directoryFor = (sessionId: string) => directories.directoryFor(sessionId as SessionId)
  return {
    async models({ sessionId }) {
      try {
        const directory = directoryFor(sessionId)
        await directory.load()
        const state = directory.store.getSnapshot()
        if (state.status === 'error') return { result: { ok: false } }
        return { result: { ok: true, value: project(state) } }
      } catch {
        return { result: { ok: false } }
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
