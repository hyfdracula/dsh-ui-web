import { createUserMessage } from "@deepseek-ai/dsh-llm";
//#region src/index.ts
/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
const name = "web-access";
/** The command registry must be composed before this plugin activates. */
const inject = ["commands"];
/** Execute one invocation: forward the instruction to the model. */
function forwardToModel(invocation) {
	const message = invocation.rawInput.trim();
	if (message === "") return {
		kind: "error",
		text: "用法：/web <指令>。示例：/web 打开百度、/web 打开 https://example.com 并告诉我标题、/web 关闭浏览器"
	};
	invocation.agent.steer(createUserMessage({
		content: [{
			type: "text",
			text: `使用 web-access 技能执行浏览器操作：${message}`
		}],
		source: { kind: "user" }
	}));
	return {
		kind: "success",
		text: `已交给模型执行浏览器操作：${message}`
	};
}
/** Register the `/web` slash command for every composed command adapter. */
function apply(ctx) {
	ctx.commands.register({
		name: "web",
		description: "use the web-access skill to drive a real browser (Chrome/Edge via CDP)",
		input: { hint: "<浏览器操作指令，如 打开百度 / 搜索 node.js / 关闭浏览器>" },
		handler: forwardToModel
	});
}
//#endregion
export { apply, inject, name };
