/**
 * dsh-web-access host half — registers the `/web` slash command.
 *
 * The command is an entry point, not a browser driver: its handler turns the
 * typed instruction into one ordinary user message and steers it to the model
 * (the same pattern `/plan [message]` uses). The model's next step loads the
 * web-access skill from the skills catalog and drives a real Chrome/Edge
 * through CDP via the skill's cdp.mjs (Node native WebSocket, zero deps).
 *
 * The command itself submits nothing to the model and adds no tokens; the
 * steered user message is billed exactly like any other user input.
 *
 * @module @captain1275/dsh-web-access
 */

import type { Context } from '@deepseek-ai/cordis'
import type { CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import { createUserMessage } from '@deepseek-ai/dsh-llm'

/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export const name = 'web-access'

/** The command registry must be composed before this plugin activates. */
export const inject = ['commands']

/** Execute one invocation: forward the instruction to the model. */
function forwardToModel(invocation: CommandInvocation): CommandResult {
  const message = invocation.rawInput.trim()
  if (message === '') {
    return {
      kind: 'error',
      text: '用法：/web <指令>。示例：/web 打开百度、/web 打开 https://example.com 并告诉我标题、/web 关闭浏览器',
    }
  }
  invocation.agent.steer(
    createUserMessage({
      content: [{ type: 'text', text: `使用 web-access 技能执行浏览器操作：${message}` }],
      source: { kind: 'user' },
    }),
  )
  return { kind: 'success', text: `已交给模型执行浏览器操作：${message}` }
}

/** Register the `/web` slash command for every composed command adapter. */
export function apply(ctx: Context): void {
  ctx.commands.register({
    name: 'web',
    description: 'use the web-access skill to drive a real browser (Chrome/Edge via CDP)',
    input: { hint: '<浏览器操作指令，如 打开百度 / 搜索 node.js / 关闭浏览器>' },
    handler: forwardToModel,
  })
}
