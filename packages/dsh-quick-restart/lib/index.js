import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
//#region src/index.ts
/**
* dsh-quick-restart — 宿主半区。
*
* 只做一件事：把「请重启」变成 checkout 里那个巡检脚本看得懂的文件。
*  `C:\Users\19161\deepseek-harness-next\dsh-restart.request`
* 由 `dsh-restart-agent.ps1`（计划任务 `DSH Restart Agent`，每 2 分钟一次）读取：
* 它检测到请求后先问宿主「有没有回合在跑」，等到空闲才停→起→替换窗口。
*
* 端点（同源 JSON，和 dsh-pet 的 /api/pet 家族同一套做法）：
*   GET  /api/quick-restart/state    -> { ok, pending, requestedAt, note, keeperTail }
*   POST /api/quick-restart/request  -> 写请求文件，返回同上结构
*
* 为什么写文件而不是直接在这里重启：重启要杀掉本插件所在的进程，
* 只有进程外的巡检（计划任务）能可靠地干这件事——宿主挂了它也还在。
* @module @captain1275/dsh-quick-restart
*/
/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
const name = "ui-quick-restart";
/** 需要宿主 web 服务器来挂自己的 JSON 端点。 */
const inject = ["webServer"];
const DEFAULT_REPO_ROOT = "C:\\Users\\19161\\deepseek-harness-next";
const REQUEST_FILE = "dsh-restart.request";
const KEEPER_LOG = "dsh-restart-agent.log";
/** 重启请求文件的内容上限（防止写进一大堆东西）。 */
const MAX_NOTE_LENGTH = 500;
function json(res, status, body) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(body));
}
function requireMethod(req, res, method) {
	if (req.method === method) return true;
	json(res, 405, {
		ok: false,
		error: "method-not-allowed"
	});
	return false;
}
/** 读请求体（有上限），空体当 {}。 */
function readJsonBody(req) {
	return new Promise((resolve, reject) => {
		let size = 0;
		const chunks = [];
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > 64 * 1024) {
				reject(/* @__PURE__ */ new Error("body-too-large"));
				queueMicrotask(() => req.destroy());
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => {
			if (chunks.length === 0) {
				resolve({});
				return;
			}
			try {
				const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
				resolve(parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {});
			} catch {
				reject(/* @__PURE__ */ new Error("invalid-json"));
			}
		});
		req.on("error", reject);
	});
}
/** 当前状态：请求文件在不在、里面写了什么、巡检日志最后几行。 */
function readState(repoRoot) {
	const requestPath = join(repoRoot, REQUEST_FILE);
	const keeperTail = [];
	try {
		const logPath = join(repoRoot, KEEPER_LOG);
		if (existsSync(logPath)) {
			const lines = readFileSync(logPath, "utf8").split(/\r?\n/).filter((line) => line.trim() !== "");
			for (const line of lines.slice(-3)) keeperTail.push(line);
		}
	} catch {}
	if (!existsSync(requestPath)) return {
		ok: true,
		pending: false,
		requestPath,
		keeperTail
	};
	let note = "";
	let requestedAt;
	try {
		note = readFileSync(requestPath, "utf8").trim().slice(0, MAX_NOTE_LENGTH);
		requestedAt = statSync(requestPath).mtime.toISOString();
	} catch {}
	return {
		ok: true,
		pending: true,
		requestPath,
		...requestedAt === void 0 ? {} : { requestedAt },
		...note === "" ? {} : { note },
		keeperTail
	};
}
/**
* 挂上两个端点。
* @param ctx - 宿主上下文（需要 webServer）。
* @param config - 插件配置（repoRoot）。
*/
function apply(ctx, config = {}) {
	const repoRoot = config.repoRoot ?? DEFAULT_REPO_ROOT;
	const requestPath = join(repoRoot, REQUEST_FILE);
	const stateRoute = {
		kind: "exact",
		path: "/api/quick-restart/state",
		handler: (req, res) => {
			if (!requireMethod(req, res, "GET")) return;
			try {
				json(res, 200, readState(repoRoot));
			} catch (error) {
				json(res, 500, {
					ok: false,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}
	};
	const requestRoute = {
		kind: "exact",
		path: "/api/quick-restart/request",
		handler: (req, res) => {
			if (!requireMethod(req, res, "POST")) return;
			readJsonBody(req).then((body) => {
				const note = typeof body.note === "string" ? body.note.slice(0, MAX_NOTE_LENGTH) : "sidebar quick-restart";
				writeFileSync(requestPath, `${note}\n`, { encoding: "utf8" });
				json(res, 200, readState(repoRoot));
			}, (error) => {
				json(res, 400, {
					ok: false,
					error: error instanceof Error ? error.message : String(error)
				});
			});
		}
	};
	ctx.effect(() => {
		const disposers = [ctx.webServer.register(stateRoute), ctx.webServer.register(requestRoute)];
		return () => {
			for (const dispose of disposers) dispose();
		};
	}, "quick-restart.routes");
}
//#endregion
export { apply, inject, name };
