window.__ModuleLoader__.load({
	id: "@captain1275/dsh-usage-dashboard",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_dom_client = require("react-dom/client");
		let react = require("react");
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:C:\Users\19161\Desktop\dsh-ui-web\packages\dsh-usage-dashboard\src\client\usage.module.css.mjs
		const css$2 = ".dgj50q_overlay{z-index:2147483001;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}.dgj50q_mask{-webkit-backdrop-filter:blur(6px);background:#eaf2fc8c;position:absolute;inset:0}body[data-ds-dark-theme] .dgj50q_mask{background:#0409108c}.dgj50q_panel{z-index:1;box-sizing:border-box;width:880px;max-width:calc(100vw - 48px);max-height:calc(100vh - 48px);backdrop-filter:blur(var(--dsh-aqua-blur,14px));color:var(--dsw-alias-label-primary,#132d53);background:linear-gradient(#ffffffc7,#ffffffa3);border:1px solid #132d5342;border-radius:20px;flex-direction:column;padding:22px 26px;font-size:13px;display:flex;position:relative;overflow:auto;box-shadow:inset 0 1px #ffffff80,0 18px 60px #132d532e}body[data-ds-dark-theme] .dgj50q_panel{color:var(--dsw-alias-label-primary,#dbe7f7);background:linear-gradient(#2a2e38d9,#161922d9);border-color:#94b4dc52;box-shadow:inset 0 1px #ffffff12,0 18px 60px #02060e80}.dgj50q_header{justify-content:space-between;align-items:center;margin-bottom:16px;display:flex}.dgj50q_title{color:var(--dsw-alias-label-primary,#132d53);margin:0;font-size:18px;font-weight:700}body[data-ds-dark-theme] .dgj50q_title{color:var(--dsw-alias-label-primary,#dbe7f7)}.dgj50q_close{width:30px;height:30px;color:var(--dsw-alias-label-secondary,#132d539e);cursor:pointer;background:#132d5314;border:none;border-radius:8px;flex:none;justify-content:center;align-items:center;transition:background .12s,color .12s;display:inline-flex}.dgj50q_close:hover{color:var(--dsw-alias-label-primary,#132d53);background:#132d5329}body[data-ds-dark-theme] .dgj50q_close{color:#94b4dccc;background:#94b4dc1f}body[data-ds-dark-theme] .dgj50q_close:hover{color:#fff;background:#94b4dc38}.dgj50q_body{flex-direction:column;gap:18px;display:flex}.dgj50q_statGrid{grid-template-columns:repeat(4,1fr);gap:12px;display:grid}.dgj50q_statCard{border:1px solid;border-radius:14px;flex-direction:column;gap:3px;padding:14px 16px;display:flex}.dgj50q_statValue{font-variant-numeric:tabular-nums;font-size:26px;font-weight:800;line-height:1.1}.dgj50q_statLabel{color:var(--dsw-alias-label-secondary,#132d53b3);font-size:12px;font-weight:600}body[data-ds-dark-theme] .dgj50q_statLabel{color:var(--dsw-alias-label-secondary,#dbe7f7d9)}.dgj50q_statSub{color:var(--dsw-alias-label-tertiary,#132d5380);font-size:11px}body[data-ds-dark-theme] .dgj50q_statSub{color:var(--dsw-alias-label-tertiary,#dbe7f78c)}.dgj50q_section{flex-direction:column;gap:6px;display:flex}.dgj50q_sectionTitle{color:var(--dsw-alias-label-primary,#132d53);font-size:13px;font-weight:700}body[data-ds-dark-theme] .dgj50q_sectionTitle{color:var(--dsw-alias-label-primary,#dbe7f7)}.dgj50q_sectionSub{color:var(--dsw-alias-label-tertiary,#132d5380);font-size:11px}body[data-ds-dark-theme] .dgj50q_sectionSub{color:var(--dsw-alias-label-tertiary,#dbe7f780)}.dgj50q_twoCol{grid-template-columns:1fr 1.2fr;align-items:start;gap:20px;display:grid}.dgj50q_chart{width:100%;height:auto;margin-top:4px}.dgj50q_axisLabel{fill:var(--dsw-alias-label-tertiary,#132d5373);font-size:9px}body[data-ds-dark-theme] .dgj50q_axisLabel{fill:var(--dsw-alias-label-tertiary,#dbe7f773)}.dgj50q_gridLine{stroke:var(--dsw-alias-label-tertiary,#132d531f);stroke-dasharray:3 3;stroke-width:1px}body[data-ds-dark-theme] .dgj50q_gridLine{stroke:var(--dsw-alias-label-tertiary,#dbe7f71f)}.dgj50q_axisValue{fill:var(--dsw-alias-label-tertiary,#132d5380);font-size:9px}body[data-ds-dark-theme] .dgj50q_axisValue{fill:var(--dsw-alias-label-tertiary,#dbe7f780)}.dgj50q_donutWrap{align-items:center;gap:16px;display:flex}.dgj50q_donut{flex:none;width:150px;height:150px}.dgj50q_donutTotal{fill:var(--dsw-alias-label-primary,#132d53);font-size:16px;font-weight:800}body[data-ds-dark-theme] .dgj50q_donutTotal{fill:var(--dsw-alias-label-primary,#dbe7f7)}.dgj50q_donutLabel{fill:var(--dsw-alias-label-tertiary,#132d5380);font-size:9px}body[data-ds-dark-theme] .dgj50q_donutLabel{fill:var(--dsw-alias-label-tertiary,#dbe7f780)}.dgj50q_legend{flex-direction:column;gap:5px;min-width:0;display:flex}.dgj50q_legendRow{align-items:center;gap:7px;font-size:11px;display:flex}.dgj50q_legendDot{border-radius:3px;flex:none;width:9px;height:9px}.dgj50q_legendName{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-secondary,#132d53b3);flex:1;overflow:hidden}body[data-ds-dark-theme] .dgj50q_legendName{color:var(--dsw-alias-label-secondary,#dbe7f7d9)}.dgj50q_legendVal{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary,#132d538c)}body[data-ds-dark-theme] .dgj50q_legendVal{color:var(--dsw-alias-label-tertiary,#dbe7f799)}.dgj50q_sessionList{flex-direction:column;gap:9px;max-height:320px;display:flex;overflow:auto}.dgj50q_sessionRow{align-items:center;gap:10px;display:flex}.dgj50q_sessionRank{text-align:center;flex:none;width:20px;font-size:14px;font-weight:800}.dgj50q_sessionInfo{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.dgj50q_sessionName{color:var(--dsw-alias-label-primary,#132d53);text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600;overflow:hidden}body[data-ds-dark-theme] .dgj50q_sessionName{color:var(--dsw-alias-label-primary,#dbe7f7)}.dgj50q_sessionMeta{color:var(--dsw-alias-label-tertiary,#132d5380);font-size:10px}body[data-ds-dark-theme] .dgj50q_sessionMeta{color:var(--dsw-alias-label-tertiary,#dbe7f780)}.dgj50q_sessionBar{background:#132d5314;border-radius:999px;height:4px;margin-top:2px;overflow:hidden}body[data-ds-dark-theme] .dgj50q_sessionBar{background:#94b4dc1f}.dgj50q_sessionBarFill{border-radius:999px;height:100%;transition:width .4s}.dgj50q_sessionTokens{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary,#132d53);flex-direction:column;flex:none;align-items:flex-end;gap:2px;font-size:12px;font-weight:700;display:flex}body[data-ds-dark-theme] .dgj50q_sessionTokens{color:var(--dsw-alias-label-primary,#dbe7f7)}.dgj50q_sessionCost{color:var(--dsw-alias-label-tertiary,#132d538c);font-size:10px;font-weight:600}body[data-ds-dark-theme] .dgj50q_sessionCost{color:var(--dsw-alias-label-tertiary,#dbe7f78c)}.dgj50q_empty{flex-direction:column;align-items:center;gap:8px;padding:60px 0;display:flex}.dgj50q_emptyTitle{color:var(--dsw-alias-label-secondary,#132d53b3);font-size:15px;font-weight:700}body[data-ds-dark-theme] .dgj50q_emptyTitle{color:var(--dsw-alias-label-secondary,#dbe7f7bf)}.dgj50q_emptyHint{color:var(--dsw-alias-label-tertiary,#132d5373);text-align:center;font-size:12px;line-height:1.6}body[data-ds-dark-theme] .dgj50q_emptyHint{color:var(--dsw-alias-label-tertiary,#dbe7f773)}.dgj50q_error{color:#c63e3e;background:#d645451a;border:1px solid #d645454d;border-radius:10px;padding:10px 14px;font-size:12px}body[data-ds-dark-theme] .dgj50q_error{color:#fca5a5;background:#f8717124;border-color:#f8717159}@media (width<=720px){.dgj50q_panel{border-radius:0;width:100%;max-width:100vw;max-height:100vh;padding:16px}.dgj50q_statGrid,.dgj50q_twoCol{grid-template-columns:1fr}}";
		const tagId$2 = "@captain1275/dsh-usage-dashboard/usage.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@captain1275/dsh-usage-dashboard";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var usage_module_css_default = {
			"axisLabel": "dgj50q_axisLabel",
			"axisValue": "dgj50q_axisValue",
			"body": "dgj50q_body",
			"chart": "dgj50q_chart",
			"close": "dgj50q_close",
			"donut": "dgj50q_donut",
			"donutLabel": "dgj50q_donutLabel",
			"donutTotal": "dgj50q_donutTotal",
			"donutWrap": "dgj50q_donutWrap",
			"empty": "dgj50q_empty",
			"emptyHint": "dgj50q_emptyHint",
			"emptyTitle": "dgj50q_emptyTitle",
			"error": "dgj50q_error",
			"gridLine": "dgj50q_gridLine",
			"header": "dgj50q_header",
			"legend": "dgj50q_legend",
			"legendDot": "dgj50q_legendDot",
			"legendName": "dgj50q_legendName",
			"legendRow": "dgj50q_legendRow",
			"legendVal": "dgj50q_legendVal",
			"mask": "dgj50q_mask",
			"overlay": "dgj50q_overlay",
			"panel": "dgj50q_panel",
			"section": "dgj50q_section",
			"sectionSub": "dgj50q_sectionSub",
			"sectionTitle": "dgj50q_sectionTitle",
			"sessionBar": "dgj50q_sessionBar",
			"sessionBarFill": "dgj50q_sessionBarFill",
			"sessionCost": "dgj50q_sessionCost",
			"sessionInfo": "dgj50q_sessionInfo",
			"sessionList": "dgj50q_sessionList",
			"sessionMeta": "dgj50q_sessionMeta",
			"sessionName": "dgj50q_sessionName",
			"sessionRank": "dgj50q_sessionRank",
			"sessionRow": "dgj50q_sessionRow",
			"sessionTokens": "dgj50q_sessionTokens",
			"statCard": "dgj50q_statCard",
			"statGrid": "dgj50q_statGrid",
			"statLabel": "dgj50q_statLabel",
			"statSub": "dgj50q_statSub",
			"statValue": "dgj50q_statValue",
			"title": "dgj50q_title",
			"twoCol": "dgj50q_twoCol"
		};
		//#endregion
		//#region src/client/locales.ts
		/**
		* dsh-usage-dashboard locale copy (zh source of truth, en mirror).
		* @module @captain1275/dsh-usage-dashboard/client/locales
		*/
		const NS = "usage-dashboard";
		const zh = {
			"usage.entry": "用量",
			"usage.title": "用量看板",
			"usage.total": "累计用量",
			"usage.today": "今日",
			"usage.calls": "调用",
			"usage.input": "输入",
			"usage.output": "输出",
			"usage.cache": "缓存",
			"usage.trend": "近 14 天趋势",
			"usage.trendDetail": "每日 token 消耗（输入 + 输出 + 缓存）",
			"usage.sessions": "会话排行",
			"usage.models": "模型分布",
			"usage.tokens": "token",
			"usage.close": "关闭用量看板",
			"usage.empty": "暂无用量数据",
			"usage.noData": "使用 DSH 对话后，这里会显示详细用量统计。",
			"usage.settingsTitle": "用量看板",
			"usage.settingsHint": "记录每次响应的 token 用量并展示统计看板。",
			"usage.cost": "估算费用",
			"usage.costHint": "按定价快照估算",
			"usage.daysRecorded": "{days} 天有记录",
			"usage.cacheHit": "缓存命中",
			"usage.pricingTitle": "定价快照",
			"usage.pricingHint": "费用估算用的模型价目表（LiteLLM 全量，可一键更新）。",
			"usage.pricingSource": "价目来源",
			"usage.pricingOriginUser": "用户级覆盖（~/.dsh/usage-pricing.json）",
			"usage.pricingOriginBuiltin": "包内置快照",
			"usage.pricingOriginEmpty": "无（回退内置常量）",
			"usage.pricingCoverage": "覆盖 {providers} 个 provider / {models} 个模型",
			"usage.pricingUpdatedAt": "最后更新",
			"usage.pricingFx": "USD 汇率",
			"usage.pricingRefresh": "立即更新",
			"usage.pricingRefreshing": "更新中…",
			"usage.pricingRefreshOk": "已更新到最新价目",
			"usage.pricingRefreshFail": "更新失败"
		};
		const en = {
			"usage.entry": "Usage",
			"usage.title": "Usage Dashboard",
			"usage.total": "Total usage",
			"usage.today": "Today",
			"usage.calls": "calls",
			"usage.input": "Input",
			"usage.output": "Output",
			"usage.cache": "Cache",
			"usage.trend": "Last 14 days",
			"usage.trendDetail": "Daily token usage (input + output + cache)",
			"usage.sessions": "Top sessions",
			"usage.models": "Model distribution",
			"usage.tokens": "tokens",
			"usage.close": "Close usage dashboard",
			"usage.empty": "No usage data yet",
			"usage.noData": "Start chatting with DSH and detailed usage stats will appear here.",
			"usage.settingsTitle": "Usage dashboard",
			"usage.settingsHint": "Records per-response token usage and renders a stats dashboard.",
			"usage.cost": "Estimated cost",
			"usage.costHint": "Estimated from the pricing snapshot",
			"usage.daysRecorded": "{days} days on record",
			"usage.cacheHit": "Cache hits",
			"usage.pricingTitle": "Pricing snapshot",
			"usage.pricingHint": "Model price table used for cost estimates (full LiteLLM set, one-click refresh).",
			"usage.pricingSource": "Source",
			"usage.pricingOriginUser": "User override (~/.dsh/usage-pricing.json)",
			"usage.pricingOriginBuiltin": "Bundled snapshot",
			"usage.pricingOriginEmpty": "None (built-in constants)",
			"usage.pricingCoverage": "Covers {providers} providers / {models} models",
			"usage.pricingUpdatedAt": "Last updated",
			"usage.pricingFx": "USD rate",
			"usage.pricingRefresh": "Refresh now",
			"usage.pricingRefreshing": "Refreshing...",
			"usage.pricingRefreshOk": "Pricing table is up to date",
			"usage.pricingRefreshFail": "Refresh failed"
		};
		/** Translate helper bound to the usage namespace (component-local). */
		function t(key, params) {
			let text = (typeof document !== "undefined" && document.documentElement.lang === "en" ? en : zh)[key] ?? key;
			for (const [name, value] of Object.entries(params ?? {})) text = text.replaceAll(`{${name}}`, String(value));
			return text;
		}
		//#endregion
		//#region src/client/DashboardPanel.tsx
		/**
		* Usage dashboard panel — the colorful full-screen overlay. Reads the host
		* `/api/usage/summary` and renders: rainbow stat cards, a 14-day bar chart,
		* a model-donut chart, and a session ranking table. Hand-drawn SVG, no chart
		* library.
		* @module @captain1275/dsh-usage-dashboard/client/DashboardPanel
		*/
		/** 一个聚合桶的总 token（输入 + 输出 + 缓存读 + 缓存写），与会话排行口径一致。 */
		function bucketTokens(b) {
			return b.inputTokens + b.outputTokens + b.cacheReadTokens + (b.cacheWriteTokens ?? 0);
		}
		/** 看板色板：Aqua 蓝系（同一色相族内区分系列，避免彩虹噪点）。 */
		const PALETTE = [
			"#3f76d8",
			"#6e9be8",
			"#4a9eda",
			"#8fb5ef",
			"#2f62c4",
			"#7bc4e8",
			"#5b8fe6",
			"#a8ccf2"
		];
		/** 数值格式化：千分位 + 大数缩写。 */
		function fmt(n) {
			if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
			if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
			return String(n);
		}
		/** 十六进制颜色转 rgba。 */
		function hexToRgba(hex, alpha) {
			const v = parseInt(hex.slice(1), 16);
			return `rgba(${v >> 16 & 255}, ${v >> 8 & 255}, ${v & 255}, ${alpha})`;
		}
		/** 费用格式化：¥X.XX，小额保留 4 位。 */
		function fmtCost(n) {
			if (n >= 100) return `¥${Math.round(n)}`;
			if (n >= 1) return `¥${n.toFixed(2)}`;
			return `¥${n.toFixed(4)}`;
		}
		/** 拉取看板数据。 */
		async function fetchSummary() {
			const res = await fetch("/api/usage/summary");
			if (!res.ok) throw new Error(`usage summary failed: ${res.status}`);
			return await res.json();
		}
		/** 彩色统计卡片。 */
		function StatCard(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_css_default.statCard,
				style: {
					background: `linear-gradient(135deg, ${hexToRgba(props.color, .22)}, ${hexToRgba(props.color, .05)})`,
					borderColor: hexToRgba(props.color, .4)
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: usage_module_css_default.statValue,
						style: { color: props.color },
						children: props.value
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: usage_module_css_default.statLabel,
						children: props.label
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: usage_module_css_default.statSub,
						children: props.sub
					})
				]
			});
		}
		/** 单日 token 总量（输入 + 输出 + 缓存读 + 缓存写），与看板其它口径一致。 */
		function dayTotal(d) {
			return d.inputTokens + d.outputTokens + d.cacheReadTokens + (d.cacheWriteTokens ?? 0);
		}
		/** 近 14 天柱状图（SVG）。含右侧参考轴（0 / 半高 / 满高）。 */
		function TrendChart(props) {
			const W = 560;
			const H = 160;
			const PAD = {
				left: 8,
				right: 40,
				top: 12,
				bottom: 24
			};
			const max = Math.max(1, ...props.recent.map(dayTotal));
			const innerW = W - PAD.left - PAD.right;
			const innerH = H - PAD.top - PAD.bottom;
			const barW = innerW / props.recent.length;
			const gridValues = Array.from(/* @__PURE__ */ new Set([
				max,
				Math.round(max / 2),
				0
			]));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: usage_module_css_default.chart,
				viewBox: `0 0 ${W} ${H}`,
				role: "img",
				"aria-label": t("usage.trend"),
				children: [gridValues.map((v) => {
					const y = PAD.top + innerH - v / max * innerH;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
						x1: PAD.left,
						y1: y,
						x2: W - PAD.right,
						y2: y,
						className: usage_module_css_default.gridLine
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
						x: W - 4,
						y: y + 3,
						textAnchor: "end",
						className: usage_module_css_default.axisValue,
						children: fmt(v)
					})] }, v);
				}), props.recent.map((d, i) => {
					const total = dayTotal(d);
					const h = total === 0 ? 0 : Math.max(2, total / max * innerH);
					const x = PAD.left + i * barW;
					const y = PAD.top + innerH - h;
					const color = PALETTE[i % PALETTE.length];
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: x + barW * .18,
						y,
						width: barW * .64,
						height: h,
						rx: 3,
						fill: color,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("title", { children: `${d.day}: ${fmt(total)} tokens\n${t("usage.input")} ${fmt(d.inputTokens)} / ${t("usage.output")} ${fmt(d.outputTokens)} / ${t("usage.cache")} ${fmt(d.cacheReadTokens)}` })
					}), props.recent.length <= 14 && i % 2 === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
						x: x + barW / 2,
						y: H - 8,
						textAnchor: "middle",
						className: usage_module_css_default.axisLabel,
						children: d.day.slice(5)
					})] }, d.day);
				})]
			});
		}
		/** 模型分布环形图（SVG）。口径与会话排行一致：输入 + 输出 + 缓存读 + 缓存写。 */
		function ModelDonut(props) {
			const entries = Object.entries(props.byModel).sort((a, b) => bucketTokens(b[1]) - bucketTokens(a[1]));
			const total = entries.reduce((acc, [, v]) => acc + bucketTokens(v), 0);
			const R = 56;
			const CX = 90;
			const CY = 90;
			const STROKE = 26;
			const CIRC = 2 * Math.PI * R;
			let acc = 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_css_default.donutWrap,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					viewBox: "0 0 180 180",
					className: usage_module_css_default.donut,
					role: "img",
					"aria-label": t("usage.models"),
					children: [
						entries.map(([name, v], i) => {
							const frac = total === 0 ? 0 : bucketTokens(v) / total;
							const dash = frac * CIRC;
							const offset = -(acc * CIRC);
							acc += frac;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
								cx: CX,
								cy: CY,
								r: R,
								fill: "none",
								stroke: PALETTE[i % PALETTE.length],
								strokeWidth: STROKE,
								strokeDasharray: `${dash} ${CIRC - dash}`,
								strokeDashoffset: offset,
								strokeLinecap: "butt",
								transform: `rotate(-90 ${CX} ${CY})`,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("title", { children: `${name}: ${fmt(bucketTokens(v))} tokens` })
							}, name);
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
							x: CX,
							y: CY - 2,
							textAnchor: "middle",
							className: usage_module_css_default.donutTotal,
							children: fmt(total)
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
							x: CX,
							y: 104,
							textAnchor: "middle",
							className: usage_module_css_default.donutLabel,
							children: t("usage.tokens")
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: usage_module_css_default.legend,
					children: entries.map(([name, v], i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: usage_module_css_default.legendRow,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_css_default.legendDot,
								style: { background: PALETTE[i % PALETTE.length] }
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_css_default.legendName,
								children: name
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_module_css_default.legendVal,
								children: fmt(bucketTokens(v))
							})
						]
					}, name))
				})]
			});
		}
		/**
		* The dashboard overlay panel.
		* @param props - onClose callback.
		* @returns portal element tree.
		*/
		function DashboardPanel(props) {
			const [summary, setSummary] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const load = (0, react.useCallback)(() => {
				setError(null);
				fetchSummary().then(setSummary).catch((e) => setError(e instanceof Error ? e.message : String(e)));
			}, []);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			const hasData = summary !== null && summary.total.calls > 0;
			const totalTokens = summary === null ? 0 : bucketTokens(summary.total);
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: usage_module_css_default.overlay,
				role: "presentation",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: usage_module_css_default.mask,
					"aria-hidden": "true",
					onClick: props.onClose
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_module_css_default.panel,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": t("usage.title"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_module_css_default.header,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
								className: usage_module_css_default.title,
								children: t("usage.title")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: usage_module_css_default.close,
								"aria-label": t("usage.close"),
								onClick: props.onClose,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
									viewBox: "0 0 16 16",
									width: "16",
									height: "16",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
										d: "M4 4l8 8M12 4l-8 8",
										stroke: "currentColor",
										strokeWidth: "1.6",
										strokeLinecap: "round"
									})
								})
							})]
						}),
						error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: usage_module_css_default.error,
							children: error
						}),
						summary !== null && !hasData && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_module_css_default.empty,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: usage_module_css_default.emptyTitle,
								children: t("usage.empty")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: usage_module_css_default.emptyHint,
								children: t("usage.noData")
							})]
						}),
						summary !== null && hasData && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_module_css_default.body,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: usage_module_css_default.statGrid,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatCard, {
											label: t("usage.total"),
											value: fmt(totalTokens),
											sub: `${fmt(summary.total.inputTokens)} in / ${fmt(summary.total.outputTokens)} out`,
											color: PALETTE[0]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatCard, {
											label: t("usage.calls"),
											value: fmt(summary.total.calls),
											sub: t("usage.daysRecorded", { days: summary.byDayCount }),
											color: PALETTE[1]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatCard, {
											label: t("usage.cache"),
											value: fmt(summary.total.cacheReadTokens),
											sub: t("usage.cacheHit"),
											color: PALETTE[2]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatCard, {
											label: t("usage.cost"),
											value: fmtCost(summary.cost?.total ?? 0),
											sub: t("usage.costHint"),
											color: PALETTE[3]
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: usage_module_css_default.section,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: usage_module_css_default.sectionTitle,
											children: t("usage.trend")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: usage_module_css_default.sectionSub,
											children: t("usage.trendDetail")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TrendChart, { recent: summary.recent })
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: usage_module_css_default.twoCol,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: usage_module_css_default.section,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: usage_module_css_default.sectionTitle,
											children: t("usage.models")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelDonut, { byModel: summary.byModel })]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: usage_module_css_default.section,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: usage_module_css_default.sectionTitle,
											children: t("usage.sessions")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: usage_module_css_default.sessionList,
											children: summary.sessions.map((s, i) => {
												const max = summary.sessions[0]?.totalTokens ?? 1;
												const pct = Math.max(2, Math.round(s.totalTokens / max * 100));
												const color = PALETTE[i % PALETTE.length];
												return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: usage_module_css_default.sessionRow,
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: usage_module_css_default.sessionRank,
															style: { color },
															children: i + 1
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: usage_module_css_default.sessionInfo,
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																	className: usage_module_css_default.sessionName,
																	children: s.title
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																	className: usage_module_css_default.sessionMeta,
																	children: [
																		s.model,
																		" · ",
																		s.calls,
																		" ",
																		t("usage.calls")
																	]
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																	className: usage_module_css_default.sessionBar,
																	children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																		className: usage_module_css_default.sessionBarFill,
																		style: {
																			width: `${pct}%`,
																			background: color
																		}
																	})
																})
															]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: usage_module_css_default.sessionTokens,
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: fmt(s.totalTokens) }), s.cost !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: usage_module_css_default.sessionCost,
																children: fmtCost(s.cost)
															})]
														})
													]
												}, s.id);
											})
										})]
									})]
								})
							]
						})
					]
				})]
			}), document.body);
		}
		//#endregion
		//#region \0dsh-css:C:\Users\19161\Desktop\dsh-ui-web\packages\dsh-usage-dashboard\src\client\usage-entry.module.css.mjs
		const css$1 = ".mJiKha_entry{width:100%;height:32px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;background:0 0;border:none;border-radius:8px;align-items:center;gap:8px;padding:0 12px;font-size:13px;transition:background-color .12s,color .12s;display:flex}.mJiKha_entry:hover{background:var(--dsw-specific-sidebar-nav-item-hover);color:var(--dsw-alias-label-primary)}.mJiKha_entry:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.mJiKha_entryIcon{flex:none;justify-content:center;align-items:center;display:inline-flex}.mJiKha_entryLabel{text-overflow:ellipsis;overflow:hidden}[data-dsh-frame][data-sidebar-collapsed] .mJiKha_entry{justify-content:center;width:100%;padding:0}[data-dsh-frame][data-sidebar-collapsed] .mJiKha_entryLabel{display:none}";
		const tagId$1 = "@captain1275/dsh-usage-dashboard/usage-entry.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@captain1275/dsh-usage-dashboard";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var usage_entry_module_css_default = {
			"entry": "mJiKha_entry",
			"entryIcon": "mJiKha_entryIcon",
			"entryLabel": "mJiKha_entryLabel"
		};
		//#endregion
		//#region src/client/UsageEntry.tsx
		/**
		* Usage dashboard sidebar entry — DOM-level injection.
		*
		* dsh's sidebar shell exposes no slot an external plugin can register into
		* (`sidebar.workspaces` / `sidebar.settings` are single-occupant and already
		* taken), so — following the task-board / ssh precedent of DOM-level
		* extension — the entry row is injected between the shell's New Session
		* button and the workspace browser. The injection self-heals: a
		* MutationObserver watches the sidebar root and re-inserts the row whenever
		* a React re-render displaces it.
		*
		* The row is plain DOM; clicking it mounts the full-screen dashboard overlay
		* as a separate React root (see mountDashboard).
		* @module @captain1275/dsh-usage-dashboard/client/UsageEntry
		*/
		/** Inline icon (matches the shell's 16px nav-icon look): three Aqua-blue bars. */
		const ICON = "<svg viewBox=\"0 0 16 16\" width=\"14\" height=\"14\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"2.5\" y=\"8\" width=\"3\" height=\"5\" rx=\"0.8\" fill=\"#a8ccf2\"/><rect x=\"7\" y=\"4.5\" width=\"3\" height=\"8.5\" rx=\"0.8\" fill=\"#6e9be8\"/><rect x=\"11.5\" y=\"1.5\" width=\"3\" height=\"11.5\" rx=\"0.8\" fill=\"#3f76d8\"/></svg>";
		/** Find the sidebar shell root element, or undefined while not yet mounted. */
		function sidebarRoot() {
			const column = document.querySelector("[data-pane=\"sidebar\"], [class*=\"sidebarCol\"]");
			if (column === null) return void 0;
			return column.querySelector("[class*=\"logoRow\"]")?.parentElement ?? column.firstElementChild;
		}
		/** The New Session button: nested in the logo row on current shells, a direct child on legacy shells. */
		function newSessionButton(root) {
			const nested = root.querySelector("button[class*=\"newSession\"]");
			if (nested !== null) return nested;
			for (const child of root.children) if (child.tagName === "BUTTON") return child;
		}
		/** The injected dashboard overlay root (single instance while open). */
		let overlayRoot;
		let overlayHost;
		/** Close the dashboard overlay if open. */
		function closeDashboard() {
			overlayRoot?.unmount();
			overlayRoot = void 0;
			overlayHost?.remove();
			overlayHost = void 0;
		}
		/** Open the full-screen dashboard overlay. */
		function openDashboard() {
			if (overlayRoot !== void 0) return;
			overlayHost = document.createElement("div");
			overlayHost.dataset.dshUsageOverlay = "";
			document.body.appendChild(overlayHost);
			overlayRoot = (0, react_dom_client.createRoot)(overlayHost);
			overlayRoot.render(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(DashboardPanel, { onClose: closeDashboard }));
		}
		/** Build the entry row (a detached button; insert once the shell is up). */
		function createEntry() {
			const entry = document.createElement("button");
			entry.type = "button";
			entry.dataset.dshUsageEntry = "";
			entry.className = usage_entry_module_css_default.entry;
			entry.setAttribute("aria-label", t("usage.entry"));
			entry.setAttribute("title", t("usage.entry"));
			entry.innerHTML = `<span class="${usage_entry_module_css_default.entryIcon}">${ICON}</span><span class="${usage_entry_module_css_default.entryLabel}">${t("usage.entry")}</span>`;
			entry.addEventListener("click", () => {
				openDashboard();
			});
			return entry;
		}
		/** Re-insert the entry after the New Session row (before the browser region). */
		function placeEntry(root, entry) {
			const button = newSessionButton(root);
			if (button === void 0) return false;
			if (entry.parentElement !== root) {
				const row = button.closest("[class*=\"logoRow\"]");
				const base = row !== null && row.parentElement === root ? row : button;
				const family = Array.from(root.children).filter((el) => el instanceof HTMLElement && el.matches("[data-dsh-taskboard-entry], [data-dsh-ssh-entry], [data-dsh-usage-entry]"));
				const anchor = family.length > 0 ? family[family.length - 1].nextElementSibling : base.nextElementSibling;
				root.insertBefore(entry, anchor);
			}
			return true;
		}
		/**
		* Mount the sidebar entry, waiting for the shell to render and self-healing
		* on later React re-renders.
		* @returns disposer removing the entry and its observers.
		*/
		function mountUsageEntry() {
			const entry = createEntry();
			let root;
			let placed = false;
			const tryPlace = () => {
				if (root !== void 0 && !root.isConnected) {
					rootObserver.disconnect();
					root = void 0;
					placed = false;
				}
				if (placed) {
					if (document.body.contains(entry)) return;
					rootObserver.disconnect();
					root = void 0;
					placed = false;
				}
				root ??= sidebarRoot();
				if (root === void 0) return;
				placed = placeEntry(root, entry);
				if (placed) rootObserver.observe(root, {
					childList: true,
					subtree: true
				});
			};
			const waitObserver = new MutationObserver(() => {
				tryPlace();
			});
			waitObserver.observe(document.body, {
				childList: true,
				subtree: true
			});
			const rootObserver = new MutationObserver(() => {
				if (root === void 0 || !root.isConnected) {
					placed = false;
					tryPlace();
					return;
				}
				if (!root.contains(entry)) placed = placeEntry(root, entry);
			});
			tryPlace();
			return () => {
				waitObserver.disconnect();
				rootObserver.disconnect();
				entry.remove();
				closeDashboard();
			};
		}
		//#endregion
		//#region src/client/UsageRecorder.tsx
		/**
		* Usage recorder — an invisible conversation-dock seat that watches the
		* `tokenUsage` projection and uploads per-response snapshots to the host.
		*
		* Semantics:
		*  - The projection is a session-cumulative total that may already be large
		*    when this component mounts (page refresh, session switch, HMR reload).
		*    The FIRST sight only establishes a baseline — never uploaded, so a
		*    mount never counts the whole history as new usage.
		*  - While the total GROWS (a response is streaming), uploads are debounced
		*    to one per second. When growth stops for SETTLE_MS, the recorder
		*    flushes one final snapshot — one completed response = one upload, so
		*    the host's calls counter tracks real response rounds.
		*  - The host stores the LATEST snapshot per session (replace semantics);
		*    repeated uploads overwrite instead of double counting.
		*  - The session title rides the live `title` projection (per-session,
		*    real-time); a title that lands AFTER the last growth flush triggers one
		*    metadata-only re-upload (zero growth, so it never inflates calls).
		*  - A session switch re-baselines the recorder: switching back to a larger
		*    session is never mistaken for growth.
		* @module @captain1275/dsh-usage-dashboard/client/UsageRecorder
		*/
		/** 一轮响应结束判定的静默时长（ms）。 */
		const SETTLE_MS = 2e3;
		/** 上报当前快照到宿主（replace 语义：同会话覆盖，不累加）。 */
		async function postSnapshot(snapshot) {
			try {
				await fetch("/api/usage/record", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						...snapshot,
						ts: Date.now()
					})
				});
			} catch {}
		}
		/** 当前模型（由入口从连接层更新，尽力而为）。 */
		let currentModel = "unknown";
		/** 当前活跃会话 id（recorder 每次渲染同步；入口的模型轮询按它查询）。 */
		let activeSessionId;
		/** 供入口设置当前模型（连接层回调）。 */
		function setCurrentModel(model) {
			if (typeof model === "string" && model.length > 0) currentModel = model;
		}
		/** 读当前活跃会话 id（入口的模型轮询用）。 */
		function getActiveSessionId() {
			return activeSessionId;
		}
		/**
		* The invisible recorder seat.
		* @param props - framework runtime share.
		* @returns null (renders nothing).
		*/
		const UsageRecorder = (0, react.memo)(function UsageRecorder(props) {
			const session = props.useSession((s) => ({ sessionId: s.sessionId }));
			const usage = props.useProjection("tokenUsage");
			const title = props.useProjection("title");
			const lastTotalRef = (0, react.useRef)(-1);
			const lastSidRef = (0, react.useRef)(void 0);
			const settleTimerRef = (0, react.useRef)(null);
			const lastSeenRef = (0, react.useRef)(null);
			const titleRef = (0, react.useRef)("");
			const uploadedTitleRef = (0, react.useRef)("");
			activeSessionId = session.sessionId;
			const flush = () => {
				settleTimerRef.current = null;
				const seen = lastSeenRef.current;
				if (seen === null) return;
				const snapshotTitle = titleRef.current;
				uploadedTitleRef.current = snapshotTitle;
				postSnapshot({
					sessionId: seen.sessionId,
					sessionTitle: snapshotTitle,
					model: currentModel,
					inputTokens: seen.input,
					outputTokens: seen.output,
					cacheReadTokens: seen.cache,
					cacheWriteTokens: seen.cacheWrite
				});
			};
			(0, react.useEffect)(() => {
				const sid = session.sessionId;
				if (sid === void 0 || usage === void 0) return;
				if (lastSidRef.current !== sid) {
					lastSidRef.current = sid;
					lastTotalRef.current = -1;
					lastSeenRef.current = null;
					uploadedTitleRef.current = "";
				}
				const total = usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
				const prev = lastTotalRef.current;
				if (prev === -1) {
					lastTotalRef.current = total;
					return;
				}
				lastTotalRef.current = total;
				if (total <= 0) return;
				if (total <= prev) return;
				lastSeenRef.current = {
					sessionId: sid,
					input: usage.uncachedInputTokens,
					output: usage.outputTokens,
					cache: usage.cacheReadTokens,
					cacheWrite: usage.cacheWriteTokens
				};
				if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
				settleTimerRef.current = window.setTimeout(flush, SETTLE_MS);
			}, [session.sessionId, usage]);
			(0, react.useEffect)(() => {
				const next = typeof title === "string" ? title : "";
				titleRef.current = next;
				const seen = lastSeenRef.current;
				if (next === "" || seen === null) return;
				if (seen.sessionId !== session.sessionId) return;
				if (next === uploadedTitleRef.current) return;
				if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
				settleTimerRef.current = window.setTimeout(flush, SETTLE_MS);
			}, [title, session.sessionId]);
			(0, react.useEffect)(() => {
				return () => {
					if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
				};
			}, []);
			return null;
		});
		//#endregion
		//#region \0dsh-css:C:\Users\19161\Desktop\dsh-ui-web\packages\dsh-usage-dashboard\src\client\usage-settings.module.css.mjs
		const css = ".dx_IMa_card{border:1px solid var(--dsw-alias-border-l2,#8ca0ff38);background:var(--dsw-alias-surface-card,#12182e99);border-radius:10px;list-style:none;overflow:hidden}.dx_IMa_header{width:100%;color:inherit;font:inherit;cursor:pointer;text-align:left;background:0 0;border:none;align-items:center;gap:10px;padding:12px 16px;display:flex}.dx_IMa_headText{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.dx_IMa_name{color:var(--dsw-alias-label-primary,#eef1ff);font-size:14px;font-weight:600}.dx_IMa_description{color:var(--dsw-alias-label-tertiary,#8b95c4);font-size:12px}.dx_IMa_chevron{color:var(--dsw-alias-label-tertiary,#8b95c4);font-size:12px;transition:transform .12s}.dx_IMa_chevronOpen{color:var(--dsw-alias-label-tertiary,#8b95c4);font-size:12px;transform:rotate(180deg)}.dx_IMa_body{flex-direction:column;gap:8px;padding:4px 16px 14px;display:flex}.dx_IMa_legendRow{color:var(--dsw-alias-label-secondary,#b9c2e8);align-items:center;gap:8px;font-size:12px;display:flex}.dx_IMa_dot{border-radius:50%;flex:none;width:9px;height:9px}.dx_IMa_actionsRow{align-items:center;gap:10px;margin-top:4px;display:flex}.dx_IMa_refreshButton{border:1px solid var(--dsw-alias-border-l2,#8ca0ff38);background:var(--dsw-alias-surface-control,#8ca0ff14);color:var(--dsw-alias-label-primary,#eef1ff);cursor:pointer;border-radius:8px;padding:5px 12px;font-size:12px;font-weight:600;transition:background .12s,border-color .12s}.dx_IMa_refreshButton:hover:not(:disabled){background:var(--dsw-alias-surface-control-hover,#8ca0ff29);border-color:var(--dsw-alias-border-l3,#8ca0ff66)}.dx_IMa_refreshButton:disabled{opacity:.55;cursor:default}.dx_IMa_refreshMessage{color:var(--dsw-alias-label-tertiary,#8b95c4);font-size:12px}";
		const tagId = "@captain1275/dsh-usage-dashboard/usage-settings.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@captain1275/dsh-usage-dashboard";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var usage_settings_module_css_default = {
			"actionsRow": "dx_IMa_actionsRow",
			"body": "dx_IMa_body",
			"card": "dx_IMa_card",
			"chevron": "dx_IMa_chevron",
			"chevronOpen": "dx_IMa_chevronOpen",
			"description": "dx_IMa_description",
			"dot": "dx_IMa_dot",
			"headText": "dx_IMa_headText",
			"header": "dx_IMa_header",
			"legendRow": "dx_IMa_legendRow",
			"name": "dx_IMa_name",
			"refreshButton": "dx_IMa_refreshButton",
			"refreshMessage": "dx_IMa_refreshMessage"
		};
		//#endregion
		//#region src/client/UsageSettingsCard.tsx
		/**
		* Usage dashboard settings card — a simple informational card for the
		* Web UI plugin group: explains what the dashboard records and where the
		* data lives. No configuration fields (the dashboard is zero-config).
		* @module @captain1275/dsh-usage-dashboard/client/UsageSettingsCard
		*/
		/**
		* Render the informational settings card.
		* @returns the card element.
		*/
		function UsageSettingsCard(_props) {
			const [open, setOpen] = (0, react.useState)(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: usage_settings_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: usage_settings_module_css_default.header,
					"aria-expanded": open,
					"aria-label": `${open ? "收起" : "展开"}: ${t("usage.settingsTitle")}`,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: usage_settings_module_css_default.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_settings_module_css_default.name,
							children: t("usage.settingsTitle")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_settings_module_css_default.description,
							children: t("usage.settingsHint")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: open ? usage_settings_module_css_default.chevronOpen : usage_settings_module_css_default.chevron,
						children: "▾"
					})]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_settings_module_css_default.body,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_settings_module_css_default.legendRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_settings_module_css_default.dot,
								style: { background: "#3f76d8" }
							}), " 每次响应的 token 用量自动记录"]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_settings_module_css_default.legendRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_settings_module_css_default.dot,
								style: { background: "#6e9be8" }
							}), " 侧边栏图表按钮打开看板"]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_settings_module_css_default.legendRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_settings_module_css_default.dot,
								style: { background: "#a8ccf2" }
							}), " 数据保存在 ~/.dsh/usage.json（本机）"]
						})
					]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/PricingCard.tsx
		/**
		* Pricing snapshot settings card — shows which pricing table is in effect
		* (builtin snapshot vs user override), coverage stats and last refresh time,
		* with a one-click refresh that pulls the latest LiteLLM table through the
		* host route. Lives in the Web UI plugin group next to the dashboard card.
		* @module @captain1275/dsh-usage-dashboard/client/PricingCard
		*/
		/** 格式化 ISO 时间为本地短格式。 */
		function formatTime(iso) {
			if (iso === "") return "—";
			const d = new Date(iso);
			if (Number.isNaN(d.getTime())) return iso;
			const pad = (n) => String(n).padStart(2, "0");
			return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
		}
		/**
		* Render the pricing snapshot card.
		* @returns the card element.
		*/
		function PricingCard(_props) {
			const [open, setOpen] = (0, react.useState)(false);
			const [meta, setMeta] = (0, react.useState)(null);
			const [refreshing, setRefreshing] = (0, react.useState)(false);
			const [message, setMessage] = (0, react.useState)("");
			const load = () => {
				fetch("/api/usage-pricing").then(async (res) => await res.json()).then((data) => {
					if (data.ok && data.pricing !== void 0) setMeta(data.pricing);
				}).catch(() => {});
			};
			(0, react.useEffect)(() => {
				if (open) load();
			}, [open]);
			const refresh = () => {
				if (refreshing) return;
				setRefreshing(true);
				setMessage("");
				fetch("/api/usage-pricing/refresh", { method: "POST" }).then(async (res) => await res.json()).then((data) => {
					if (data.ok && data.pricing !== void 0) {
						setMeta(data.pricing);
						setMessage(t("usage.pricingRefreshOk"));
					} else setMessage(`${t("usage.pricingRefreshFail")}: ${data.error ?? "unknown"}`);
				}).catch((error) => {
					setMessage(`${t("usage.pricingRefreshFail")}: ${error instanceof Error ? error.message : String(error)}`);
				}).finally(() => {
					setRefreshing(false);
				});
			};
			const originText = meta === null ? "—" : meta.origin === "user" ? t("usage.pricingOriginUser") : meta.origin === "builtin" ? t("usage.pricingOriginBuiltin") : t("usage.pricingOriginEmpty");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: usage_settings_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: usage_settings_module_css_default.header,
					"aria-expanded": open,
					"aria-label": `${open ? "收起" : "展开"}: ${t("usage.pricingTitle")}`,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: usage_settings_module_css_default.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_settings_module_css_default.name,
							children: t("usage.pricingTitle")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: usage_settings_module_css_default.description,
							children: t("usage.pricingHint")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: open ? usage_settings_module_css_default.chevronOpen : usage_settings_module_css_default.chevron,
						children: "▾"
					})]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: usage_settings_module_css_default.body,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_settings_module_css_default.legendRow,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: usage_settings_module_css_default.dot,
									style: { background: "#3f76d8" }
								}),
								t("usage.pricingSource"),
								": ",
								originText
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_settings_module_css_default.legendRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_settings_module_css_default.dot,
								style: { background: "#6e9be8" }
							}), t("usage.pricingCoverage", {
								providers: meta?.providers ?? 0,
								models: meta?.models ?? 0
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_settings_module_css_default.legendRow,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: usage_settings_module_css_default.dot,
									style: { background: "#a8ccf2" }
								}),
								t("usage.pricingUpdatedAt"),
								": ",
								meta === null ? "—" : formatTime(meta.updatedAt)
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_settings_module_css_default.legendRow,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: usage_settings_module_css_default.dot,
									style: { background: "#4a9eda" }
								}),
								t("usage.pricingFx"),
								": ",
								meta?.fx ?? "—"
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: usage_settings_module_css_default.actionsRow,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: usage_settings_module_css_default.refreshButton,
								disabled: refreshing,
								onClick: refresh,
								children: refreshing ? t("usage.pricingRefreshing") : t("usage.pricingRefresh")
							}), message !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: usage_settings_module_css_default.refreshMessage,
								children: message
							})]
						})
					]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** Services required. */
		const inject = [
			"slots",
			"locale",
			"connection",
			"settingsScope"
		];
		/**
		* Register the usage dashboard surface.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "usage-dashboard: dictionaries");
			let disposeEntry;
			ctx.effect(() => {
				disposeEntry = mountUsageEntry();
				return () => disposeEntry?.();
			}, "usage-dashboard: sidebar entry");
			ctx.effect(() => {
				const connection = ctx.get("connection");
				if (connection?.api?.sessions === void 0) return () => {};
				let cancelled = false;
				const tick = async () => {
					const sessionId = getActiveSessionId();
					if (sessionId === void 0 || cancelled) return;
					try {
						const model = (await connection.api?.sessions?.models({ sessionId }))?.result?.value?.current?.model;
						if (model !== void 0 && !cancelled) setCurrentModel(model);
					} catch {}
				};
				tick();
				const timer = window.setInterval(() => {
					tick();
				}, 5e3);
				return () => {
					cancelled = true;
					window.clearInterval(timer);
				};
			}, "usage-dashboard: model subscription");
			ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
				name: "conversation.composer.dock",
				id: "usage-recorder",
				order: 5
			}, UsageRecorder));
			ctx.slots.inject("web-ui.plugin.item", () => ctx.slots.register({
				name: "web-ui.plugin.item",
				id: "usage-dashboard",
				order: 130,
				locale: NS
			}, UsageSettingsCard));
			ctx.slots.inject("web-ui.plugin.item", () => ctx.slots.register({
				name: "web-ui.plugin.item",
				id: "usage-pricing",
				order: 131,
				locale: NS
			}, PricingCard));
		}
		//#endregion
		exports.apply = apply;
		exports.closeDashboard = closeDashboard;
		exports.inject = inject;
		exports.mountUsageEntry = mountUsageEntry;
		exports.openDashboard = openDashboard;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map