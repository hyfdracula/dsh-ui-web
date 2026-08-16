import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
//#region src/index.ts
/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
const name = "open-path";
/** 路由前缀。 */
const OPEN_PATH_API_PREFIX = "/api/open-path";
/**
* 规范化一个待打开路径：必须是 Windows 绝对路径（盘符或 UNC），允许
* 两侧带引号（复制为路径会带引号）；不存在或非法返回 undefined。
* @param raw - 客户端传来的原始值。
* @returns 规范化后的绝对路径，或 undefined。
*/
function normalizeOpenTarget(raw) {
	if (typeof raw !== "string") return void 0;
	let p = raw.trim();
	if (p.length === 0) return void 0;
	if (p.startsWith("\"") && p.endsWith("\"") || p.startsWith("'") && p.endsWith("'")) p = p.slice(1, -1).trim();
	if (p.length === 0 || p.includes("\0")) return void 0;
	if (!/^[A-Za-z]:[\\/]/.test(p) && !/^\\\\/.test(p)) return void 0;
	const abs = resolve(p);
	if (!existsSync(abs)) return void 0;
	return abs;
}
/** 用 Explorer 打开绝对路径（detached，不阻塞请求）。 */
function openWithExplorer(abs) {
	spawn("explorer.exe", [abs], {
		detached: true,
		stdio: "ignore"
	}).unref();
}
function sendJson(res, status, data) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(data));
}
function readBody(req) {
	return new Promise((resolveBody, reject) => {
		let body = "";
		req.on("data", (chunk) => {
			body += chunk.toString("utf8");
			if (body.length > 1e6) {
				reject(/* @__PURE__ */ new Error("body too large"));
				req.destroy();
			}
		});
		req.on("end", () => resolveBody(body));
		req.on("error", reject);
	});
}
/** 请求分发：POST /api/open-path。 */
function handle(req, res) {
	if (new URL(req.url ?? "/", "http://dsh.local").pathname !== "/api/open-path") {
		sendJson(res, 404, {
			ok: false,
			error: "not found"
		});
		return;
	}
	if (req.method !== "POST") {
		sendJson(res, 405, {
			ok: false,
			error: "method not allowed"
		});
		return;
	}
	readBody(req).then((body) => {
		let parsed;
		try {
			parsed = JSON.parse(body);
		} catch {
			sendJson(res, 400, {
				ok: false,
				error: "bad json"
			});
			return;
		}
		const target = normalizeOpenTarget(parsed?.path);
		if (target === void 0) {
			sendJson(res, 400, {
				ok: false,
				error: "invalid path"
			});
			return;
		}
		openWithExplorer(target);
		sendJson(res, 200, { ok: true });
	}).catch((e) => sendJson(res, 400, {
		ok: false,
		error: e instanceof Error ? e.message : String(e)
	}));
}
/** 宿主插件体：注册打开路径路由（无 webServer 服务时为空操作）。 */
function apply(ctx) {
	ctx.inject(["webServer"], (httpCtx) => {
		const dispose = httpCtx.webServer.register({
			kind: "prefix",
			path: OPEN_PATH_API_PREFIX,
			handler: handle
		});
		httpCtx.effect(() => dispose, "open-path: route");
	});
}
//#endregion
export { OPEN_PATH_API_PREFIX, apply, name, normalizeOpenTarget, openWithExplorer };
