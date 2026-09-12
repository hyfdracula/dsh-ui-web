window.__ModuleLoader__.load({
	id: "@captain1275/dsh-quick-restart",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/QuickRestartEntry.tsx
		/**
		* 侧栏底部的「重启 DSH」入口。
		*
		* 一个按钮 + 一行状态，全部走插件自己的同源端点，不碰官方服务：
		*  - 点按钮：POST /api/quick-restart/request（写重启请求）
		*  - 每 15 秒：GET /api/quick-restart/state（有没有排队、巡检日志尾巴）
		*  - 排队后按钮变成"已排队"状态色，鼠标悬停给出解释
		*
		* 组件只持有自己的局部状态（不跨 remount 存活），插槽注销即卸载。
		* @module @captain1275/dsh-quick-restart/client/entry
		*/
		const STATE_URL = "/api/quick-restart/state";
		const REQUEST_URL = "/api/quick-restart/request";
		const POLL_MS = 15e3;
		/** 一个 12px 的循环箭头。 */
		function RestartIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "16",
				height: "16",
				viewBox: "0 0 16 16",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M13.5 8a5.5 5.5 0 1 1-1.7-3.95M13.5 2.5v3.2h-3.2",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.4",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		/** 把 ISO 时间显示成本地时分。 */
		function clock(iso) {
			if (iso === void 0) return "-";
			const date = new Date(iso);
			return Number.isNaN(date.getTime()) ? "-" : date.toLocaleTimeString();
		}
		/**
		* 渲染侧栏重启入口。
		* @param props - 座位组合出的 props（wide = 侧栏展开态、t = 词典）。
		* @returns 入口元素树。
		*/
		function QuickRestartEntry({ wide, t }) {
			const [state, setState] = (0, react.useState)({ pending: false });
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(void 0);
			const [hint, setHint] = (0, react.useState)(false);
			const refresh = (0, react.useCallback)(async () => {
				try {
					const response = await fetch(STATE_URL, { headers: { accept: "application/json" } });
					if (!response.ok) return;
					const body = await response.json();
					setState({
						pending: body.pending === true,
						requestedAt: body.requestedAt,
						note: body.note,
						keeperTail: body.keeperTail
					});
					setError(void 0);
				} catch {}
			}, []);
			(0, react.useEffect)(() => {
				refresh();
				const timer = window.setInterval(() => {
					refresh();
				}, POLL_MS);
				return () => {
					window.clearInterval(timer);
				};
			}, [refresh]);
			const request = (0, react.useCallback)(async () => {
				if (busy) return;
				setBusy(true);
				try {
					const response = await fetch(REQUEST_URL, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ note: "sidebar quick-restart" })
					});
					const body = await response.json();
					if (!response.ok || body.ok === false) throw new Error(body.error ?? `HTTP ${response.status}`);
					setState({
						pending: body.pending === true,
						requestedAt: body.requestedAt,
						note: body.note,
						keeperTail: body.keeperTail
					});
					setError(void 0);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			}, [busy]);
			const label = state.pending ? t("entry.pending") : t("entry.label");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 2,
					width: "100%"
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => {
						request();
					},
					onMouseEnter: () => {
						setHint(true);
					},
					onMouseLeave: () => {
						setHint(false);
					},
					title: state.pending ? `${t("entry.pendingHint")}${state.requestedAt === void 0 ? "" : ` (${clock(state.requestedAt)})`}` : t("entry.tooltip"),
					disabled: busy,
					style: {
						display: "flex",
						alignItems: "center",
						gap: 8,
						width: "100%",
						padding: wide ? "6px 10px" : "6px 0",
						justifyContent: wide ? "flex-start" : "center",
						background: "transparent",
						border: "none",
						borderRadius: 8,
						color: state.pending ? "var(--dsh-color-warning, #d09a2a)" : "inherit",
						cursor: busy ? "progress" : "pointer",
						font: "inherit"
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RestartIcon, {}), wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label })]
				}), wide && hint && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						fontSize: 11,
						opacity: .7,
						padding: "0 10px 4px"
					},
					children: error === void 0 ? state.pending ? t("entry.state.pending", { time: clock(state.requestedAt) }) : t("entry.state.idle") : `${t("entry.failed")}: ${error}`
				})]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* quick-restart 的词典。zh 是 key 源，en 完整对照（仓库 i18n 惯例）。
		* @module @captain1275/dsh-quick-restart/client/locales
		*/
		/** 词典命名空间。 */
		const NS = "quick-restart";
		/** zh（key 源）/ en 对照。 */
		const dictionaries = {
			zh: {
				"entry.label": "重启 DSH",
				"entry.tooltip": "排队重启：宿主空闲时自动重启，不需要手动参与",
				"entry.pending": "已排队重启",
				"entry.pendingHint": "巡检会在没有回合运行时自动重启",
				"entry.failed": "排队失败",
				"entry.requested": "已排队：空闲后自动重启",
				"entry.state.pending": "状态：已排队（{time}）",
				"entry.state.idle": "状态：无待处理请求",
				"entry.keeper": "巡检日志"
			},
			en: {
				"entry.label": "Restart DSH",
				"entry.tooltip": "Queue a restart: the keeper bounces the Host once it is idle",
				"entry.pending": "Restart queued",
				"entry.pendingHint": "The keeper restarts as soon as no turn is running",
				"entry.failed": "Could not queue",
				"entry.requested": "Queued: restarts automatically when idle",
				"entry.state.pending": "State: queued ({time})",
				"entry.state.idle": "State: nothing pending",
				"entry.keeper": "Keeper log"
			}
		};
		//#endregion
		//#region src/client/index.ts
		/** 需要的客户端服务：slots（插槽）、locale（词典）。 */
		const inject = ["slots", "locale"];
		/**
		* 注册词典与侧栏入口。
		* @param ctx - 宿主上下文（slots/locale 服务）。
		*/
		function apply(ctx) {
			const locale = ctx.get("locale");
			const slots = ctx.get("slots");
			if (slots === void 0) return;
			ctx.effect(() => {
				const disposeLocale = locale?.register("quick-restart", dictionaries) ?? (() => {});
				return () => {
					disposeLocale();
				};
			}, "quick-restart.locale");
			slots.inject("sidebar.footer.action", () => slots.register({
				name: "sidebar.footer.action",
				id: "quick-restart",
				order: 50,
				locale: NS,
				inject: () => ({})
			}, QuickRestartEntry));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map