window.__ModuleLoader__.load({
	id: "@captain1275/dsh-effort-slider",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:C:\Users\19161\Documents\dsh-work\dsh-ui-web\packages\dsh-effort-slider\src\client\effort.module.css.mjs
		const css$1 = ".v5_bmW_panel{user-select:none;z-index:10;pointer-events:auto;width:280px;position:absolute;top:0;left:0}.v5_bmW_glow{opacity:.55;filter:blur(10px);z-index:0;pointer-events:none;background:linear-gradient(135deg,#6e9be847,#3f76d81f,#6e9be82e);border-radius:22px;position:absolute;inset:-3px}.v5_bmW_inner{z-index:1;border:1px solid var(--dsw-alias-border-l2,#132d5342);background:linear-gradient(180deg, var(--dsw-alias-bg-layer-1,#ffffffb8), var(--dsw-alias-bg-layer-2,#ffffff94));backdrop-filter:blur(var(--dsh-aqua-blur,14px));border-radius:20px;padding:14px 16px 12px;position:relative;box-shadow:inset 0 1px #ffffff80,0 12px 32px #132d5324}body[data-ds-dark-theme] .v5_bmW_inner,html[data-ds-dark-theme] .v5_bmW_inner,[data-theme=dark] .v5_bmW_inner{border-color:var(--dsw-alias-border-l2,#94b4dc52);background:linear-gradient(#2a2e38d1,#161922d1);box-shadow:inset 0 1px #ffffff12,0 12px 32px #02060e80}.v5_bmW_head{justify-content:space-between;align-items:center;margin-bottom:2px;display:flex}.v5_bmW_headLeft{align-items:center;gap:7px;font-size:14px;font-weight:500;display:inline-flex;overflow:hidden}.v5_bmW_labelText{color:var(--dsw-alias-label-secondary,#132d539e);letter-spacing:.03em;font-weight:600}.v5_bmW_status{color:var(--dsw-alias-label-caption,#132d5373);text-transform:uppercase;letter-spacing:.04em;vertical-align:middle;font-weight:700;transition:color .25s,text-shadow .25s;display:inline-block}.v5_bmW_statusError{color:var(--dsw-alias-state-error-primary,#c93a3a)}.v5_bmW_statusUnknown{color:var(--dsw-alias-label-tertiary,#132d5373)}.v5_bmW_statusGlow{color:#3f76d8;text-shadow:0 0 14px #3f76d88c}body[data-ds-dark-theme] .v5_bmW_statusGlow,html[data-ds-dark-theme] .v5_bmW_statusGlow,[data-theme=dark] .v5_bmW_statusGlow{color:#6e9be8;text-shadow:0 0 14px #6e9be899}.v5_bmW_level0{color:#132d5366}.v5_bmW_level1{color:#3f76d88c}.v5_bmW_level2{color:#3f76d8bf}.v5_bmW_level3{color:#3f76d8;text-shadow:0 0 10px #3f76d873}.v5_bmW_level4{color:#2f62c4;text-shadow:0 0 12px #3f76d899}body[data-ds-dark-theme] .v5_bmW_level0,html[data-ds-dark-theme] .v5_bmW_level0,[data-theme=dark] .v5_bmW_level0{color:#94b4dc59}body[data-ds-dark-theme] .v5_bmW_level1,html[data-ds-dark-theme] .v5_bmW_level1,[data-theme=dark] .v5_bmW_level1{color:#6e9be880}body[data-ds-dark-theme] .v5_bmW_level2,html[data-ds-dark-theme] .v5_bmW_level2,[data-theme=dark] .v5_bmW_level2{color:#6e9be8b3}body[data-ds-dark-theme] .v5_bmW_level3,html[data-ds-dark-theme] .v5_bmW_level3,[data-theme=dark] .v5_bmW_level3{color:#6e9be8;text-shadow:0 0 10px #6e9be880}body[data-ds-dark-theme] .v5_bmW_level4,html[data-ds-dark-theme] .v5_bmW_level4,[data-theme=dark] .v5_bmW_level4{color:#9dbcf0;text-shadow:0 0 12px #6e9be8a6}.v5_bmW_close{border:1px solid var(--dsw-alias-border-l2,#132d5329);background:var(--dsw-alias-interactive-bg-hover,#ffffff59);color:var(--dsw-alias-label-secondary,#132d539e);cursor:pointer;border-radius:8px;justify-content:center;align-items:center;width:24px;height:24px;font-size:13px;line-height:1;display:inline-flex}.v5_bmW_close:hover{color:var(--dsw-alias-label-primary,#132d53);border-color:var(--dsw-alias-border-l3,#132d5357);background:var(--dsw-alias-interactive-bg-hover-accent,#ffffff8c)}body[data-ds-dark-theme] .v5_bmW_close,html[data-ds-dark-theme] .v5_bmW_close,[data-theme=dark] .v5_bmW_close{border-color:var(--dsw-alias-border-l2,#94b4dc33);color:#94b4dcbf;background:#94b4dc14}body[data-ds-dark-theme] .v5_bmW_close:hover,html[data-ds-dark-theme] .v5_bmW_close:hover,[data-theme=dark] .v5_bmW_close:hover{color:#dbe7f7;background:#94b4dc29;border-color:#94b4dc66}.v5_bmW_levelLabels{height:15px;margin-bottom:4px;position:relative}.v5_bmW_levelLabel{color:var(--dsw-alias-label-caption,#132d5373);letter-spacing:.04em;text-transform:uppercase;font-size:10px;font-weight:700;transition:color .15s;position:absolute;top:0;transform:translate(-50%)}.v5_bmW_levelLabelActive{color:#3f76d8}body[data-ds-dark-theme] .v5_bmW_levelLabelActive,html[data-ds-dark-theme] .v5_bmW_levelLabelActive,[data-theme=dark] .v5_bmW_levelLabelActive{color:#6e9be8}.v5_bmW_trackWrapper{border:1px solid var(--dsw-alias-border-l2,#132d531f);background:var(--dsw-alias-interactive-bg-hover,#132d530d);isolation:isolate;border-radius:10px;height:32px;position:relative;overflow:hidden}body[data-ds-dark-theme] .v5_bmW_trackWrapper,html[data-ds-dark-theme] .v5_bmW_trackWrapper,[data-theme=dark] .v5_bmW_trackWrapper{border-color:var(--dsw-alias-border-l2,#94b4dc24);background:#0a0e1680}.v5_bmW_trackBg{z-index:0;position:absolute;inset:0}.v5_bmW_fill{z-index:1;pointer-events:none;background:linear-gradient(90deg,#3f76d838,#3f76d880);border-radius:9px 0 0 9px;transition:width 80ms linear;position:absolute;top:0;bottom:0;left:0;box-shadow:inset 0 1px #ffffff40}body[data-ds-dark-theme] .v5_bmW_fill,html[data-ds-dark-theme] .v5_bmW_fill,[data-theme=dark] .v5_bmW_fill{background:linear-gradient(90deg,#6e9be82e,#6e9be873);box-shadow:inset 0 1px #ffffff1f}.v5_bmW_dotsLayer{pointer-events:none;z-index:2;position:absolute;inset:0}.v5_bmW_dot{background:#3f76d84d;border-radius:50%;width:4px;height:4px;transition:background .15s,box-shadow .15s;position:absolute;top:50%;transform:translate(-50%,-50%)}.v5_bmW_dotActive{background:#3f76d8;box-shadow:0 0 8px #3f76d8cc}body[data-ds-dark-theme] .v5_bmW_dot,html[data-ds-dark-theme] .v5_bmW_dot,[data-theme=dark] .v5_bmW_dot{background:#6e9be84d}body[data-ds-dark-theme] .v5_bmW_dotActive,html[data-ds-dark-theme] .v5_bmW_dotActive,[data-theme=dark] .v5_bmW_dotActive{background:#6e9be8;box-shadow:0 0 8px #6e9be8d9}.v5_bmW_range{-webkit-appearance:none;appearance:none;cursor:pointer;z-index:5;background:0 0;outline:none;width:100%;height:100%;margin:0;padding:0;position:absolute;inset:0}.v5_bmW_range::-webkit-slider-thumb{-webkit-appearance:none;cursor:grab;background:linear-gradient(145deg,#fff 0%,#dce7f7 55%,#c9d9f0 100%);border:none;border-radius:9px;width:26px;height:26px;transition:box-shadow .25s,transform .2s cubic-bezier(.34,1.56,.64,1);box-shadow:0 2px 8px #132d5340,0 0 0 1px #3f76d847,inset 0 1px #fffc}.v5_bmW_range::-webkit-slider-thumb:active{cursor:grabbing;transform:scale(.92)}.v5_bmW_rangeGlow::-webkit-slider-thumb{box-shadow:0 2px 8px #132d534d,0 0 0 1px #3f76d873,0 0 18px #3f76d866,0 0 36px #3f76d82e,inset 0 1px #fffc}.v5_bmW_range::-moz-range-thumb{cursor:grab;background:linear-gradient(145deg,#fff 0%,#dce7f7 55%,#c9d9f0 100%);border:none;border-radius:8px;width:24px;height:24px;box-shadow:0 2px 8px #132d5340,0 0 0 1px #3f76d847}.v5_bmW_range::-moz-range-thumb:active{cursor:grabbing;transform:scale(.95)}.v5_bmW_range::-moz-range-track{background:0 0;border:none;height:32px}.v5_bmW_pointLight{pointer-events:none;z-index:3;opacity:0;background:radial-gradient(circle,#3f76d838 0%,#3f76d812 30%,#3f76d805 55%,#0000 70%);border-radius:50%;width:150px;height:150px;transition:opacity .25s;position:absolute;transform:translate(-50%,-50%)}.v5_bmW_pointLightOn{opacity:1}.v5_bmW_emptyOverlay{color:var(--dsw-alias-label-caption,#132d5373);letter-spacing:.02em;text-align:center;padding:10px 0 2px;font-size:13px;font-weight:600}.v5_bmW_failedBox{flex-direction:column;align-items:center;gap:8px;display:flex}.v5_bmW_retry{border:1px solid var(--dsw-alias-border-l2,#132d5333);background:var(--dsw-alias-interactive-bg-hover,#132d530f);color:var(--dsw-alias-label-primary,#132d53);cursor:pointer;border-radius:8px;padding:3px 12px;font-size:12px;font-weight:600}.v5_bmW_retry:hover{background:var(--dsw-alias-interactive-bg-hover-accent,#132d531f)}.v5_bmW_inlinePanel{box-sizing:border-box;border-top:1px solid var(--dsw-alias-border-l2,#132d531f);user-select:none;width:100%;padding:8px 10px 10px;position:relative}body[data-ds-dark-theme] .v5_bmW_inlinePanel,html[data-ds-dark-theme] .v5_bmW_inlinePanel,[data-theme=dark] .v5_bmW_inlinePanel{border-top-color:var(--dsw-alias-border-l2,#94b4dc24)}.v5_bmW_inlinePanel .v5_bmW_head{margin-bottom:4px}";
		const tagId$1 = "@captain1275/dsh-effort-slider/effort.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@captain1275/dsh-effort-slider";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var effort_module_css_default = {
			"close": "v5_bmW_close",
			"dot": "v5_bmW_dot",
			"dotActive": "v5_bmW_dotActive",
			"dotsLayer": "v5_bmW_dotsLayer",
			"emptyOverlay": "v5_bmW_emptyOverlay",
			"failedBox": "v5_bmW_failedBox",
			"fill": "v5_bmW_fill",
			"glow": "v5_bmW_glow",
			"head": "v5_bmW_head",
			"headLeft": "v5_bmW_headLeft",
			"inlinePanel": "v5_bmW_inlinePanel",
			"inner": "v5_bmW_inner",
			"labelText": "v5_bmW_labelText",
			"level0": "v5_bmW_level0",
			"level1": "v5_bmW_level1",
			"level2": "v5_bmW_level2",
			"level3": "v5_bmW_level3",
			"level4": "v5_bmW_level4",
			"levelLabel": "v5_bmW_levelLabel",
			"levelLabelActive": "v5_bmW_levelLabelActive",
			"levelLabels": "v5_bmW_levelLabels",
			"panel": "v5_bmW_panel",
			"pointLight": "v5_bmW_pointLight",
			"pointLightOn": "v5_bmW_pointLightOn",
			"range": "v5_bmW_range",
			"rangeGlow": "v5_bmW_rangeGlow",
			"retry": "v5_bmW_retry",
			"status": "v5_bmW_status",
			"statusError": "v5_bmW_statusError",
			"statusGlow": "v5_bmW_statusGlow",
			"statusUnknown": "v5_bmW_statusUnknown",
			"trackBg": "v5_bmW_trackBg",
			"trackWrapper": "v5_bmW_trackWrapper"
		};
		/** 轮询/写入基准间隔（ms）。 */
		const POLL_BASE_MS = 1e3;
		/** 退避封顶（ms）。 */
		const RETRY_MAX_MS = 3e4;
		/** 目录请求挂起超时（ms）：超过即按失败处理（条目 5）。 */
		const DIRECTORY_TIMEOUT_MS = 1e4;
		/**
		* 指数退避间隔：基准 1s 起按 5 倍增殖，封顶 30s
		* （1s -> 5s -> 25s -> 30s -> 30s ...，即审查要求的 1s->5s->30s 上限）。
		* 调用约定按用途偏移：轮询直接传"连续失败次数"（0 失败 = 1s 基准）；自动写
		* 传"失败次数 - 1"（第 1 次失败后等 1s、第 2 次 5s、第 3 次起 25s/30s）。
		*/
		function retryDelayMs(steps) {
			return Math.min(POLL_BASE_MS * 5 ** Math.max(steps, 0), RETRY_MAX_MS);
		}
		/**
		* 自动写下一次重试的等待毫秒数：0 表示立刻可写；null 表示同一 key 已失败
		* AUTO_WRITE_MAX_ATTEMPTS 次，放弃（等待 key 变化——模型切换或目录换档——
		* 才能重新计数）。"失败时间戳 + 推演间隔"而不是"清空 key"，避免每秒重试风暴
		* （条目 4）。
		*/
		function nextAutoWriteDelay(record, now) {
			if (record === void 0) return 0;
			if (record.attempts >= 5) return null;
			const delay = retryDelayMs(record.attempts - 1);
			return Math.max(0, record.lastFailureAt + delay - now);
		}
		/**
		* reasoningEffort 是否"未设置"：仅 undefined/null 视为未设置；
		* '' 是显式取值（OFF 语义），不触发自动写也不与缺省混淆（条目 16）。
		*/
		function isEffortUnset(value) {
			return value === void 0 || value === null;
		}
		/**
		* 推断最高档位。efforts 契约只是"展示顺序"，不保证按强度升序（第三方
		* 适配器可能是降序或乱序），因此不能盲信"最后一项 = 最高档"（条目 8）。
		* 策略：按语义提示词（max/ultra/high）在 id/name 中匹配，同一提示词命中
		* 多项时取最后一个（升序展示下即该档的最高者）；全部未命中才回退到
		* "最后一项"。
		* 假设：官方适配器的展示顺序为强度升序，最后一项即最高档；对不遵循升序的
		* 第三方适配器，语义匹配在多数情况下给出正确结果，极端乱序时仍可能出错——
		* 这是目录契约不提供强度字段下的最佳可做法。
		*/
		const HIGHEST_HINTS = [
			"max",
			"ultra",
			"high"
		];
		function pickHighest(efforts) {
			if (efforts.length === 0) return void 0;
			for (const hint of HIGHEST_HINTS) {
				let match;
				for (const entry of efforts) if (`${entry.id} ${entry.name}`.toLowerCase().includes(hint)) match = entry;
				if (match !== void 0) return match;
			}
			return efforts[efforts.length - 1];
		}
		/** 档位间的步长（0..100 连续滑块）：n 档平均分 100，1 档/空档退化为占满。 */
		function step100ForCount(count) {
			return count > 1 ? 100 / (count - 1) : 100;
		}
		/** 滑块原始值 -> 最近档位下标（含 0..count-1 夹取；count 无效时 -1）。 */
		function effortIndexForRaw(raw, step100, count) {
			if (count <= 0) return -1;
			if (step100 <= 0) return 0;
			const idx = Math.round(raw / step100);
			return Math.max(0, Math.min(count - 1, idx));
		}
		/** 在目录 efforts 中按 id 找档位下标；找不到返回 -1。 */
		function effortIndexForId(efforts, id) {
			return efforts.findIndex((entry) => entry.id === id);
		}
		/**
		* 档位槽位在轨道上的左偏移（px）：与 thumb 中心行程对齐（条目 17）。
		* thumb 中心从 THUMB_HALF 走到 TRACK_W - THUMB_HALF；fraction 0..1 会被夹取。
		* 标签、圆点、光斑、填充前缘全部使用同一公式。
		*/
		function slotLeftPx(fraction) {
			return 13 + (fraction < 0 ? 0 : fraction > 1 ? 1 : fraction) * 222;
		}
		/**
		* 档位标签文案：默认用 entry.name（第一档也不再硬编码 OFF，条目 20）；
		* 仅当 id/name 含 off/关闭 语义时才显示 OFF。
		*/
		function levelLabel(entry) {
			const hay = `${entry.id} ${entry.name}`.toLowerCase();
			if (hay.includes("off") || hay.includes("关闭")) return "OFF";
			return entry.name;
		}
		//#endregion
		//#region src/client/EffortPanel.tsx
		/**
		* Effort slider panel — Aqua glass edition.
		*
		* 交互与 aurora EffortPanel 一致（连续 0..100 拖动、松手吸附最近档位、
		* 写入走 sessions.selectModel 只改 reasoningEffort）；视觉为 Aqua 玻璃。
		*
		* 审查修复后的数据流：
		* - 目录默认由本组件自取（useDirectory）；宿主若已持有目录（EffortTrigger
		*   传入 directory prop），则完全复用、不再发起重复请求（条目 11）；
		* - 目录采用 stale-while-revalidate：轮询刷新期间保留旧值不闪空，
		*   仅 sessionId 变化或首次加载才清空（条目 1）；失败进入 error 态并在
		*   overlay 提供重试按钮，挂起超过 10s 视为失败（条目 5）；
		* - 写入必须检查 response.result.ok（业务失败 resolve 而非 reject）：失败时
		*   滑块回弹到最近一次成功档位并给出可见提示（条目 2）；commit 幂等去重、
		*   键盘/指针取消兜底补写（条目 9）；
		* - current.reasoningEffort 在目录中找不到时，保持当前 rawValue 并显示
		*   "未知档位"，绝不落回 MAX（条目 6）；
		* - current 缺失时直接判定不可用，不再回退到无关模型（条目 13）。
		*/
		/**
		* 目录加载 hook：stale-while-revalidate + 失败态 + 挂起超时。
		* 刷新期间不把 value 置空：只有 sessionId 变化或首次加载才清空，数据回来
		* 才替换（条目 1）；失败（传输错误或 result.ok=false）进入 error 态（条目 5），
		* 挂起超过 DIRECTORY_TIMEOUT_MS（10s）视为失败。
		*/
		function useDirectory(connection, sessionId, options) {
			const { reloadTick = 0, enabled = true } = options ?? {};
			const [state, setState] = (0, react.useState)({
				status: "idle",
				value: null
			});
			const [internalTick, setInternalTick] = (0, react.useState)(0);
			const lastSessionRef = (0, react.useRef)(void 0);
			const retry = (0, react.useCallback)(() => {
				setInternalTick((n) => n + 1);
			}, []);
			(0, react.useEffect)(() => {
				if (!enabled) return;
				if (sessionId === void 0) {
					lastSessionRef.current = void 0;
					setState({
						status: "idle",
						value: null
					});
					return;
				}
				const sessionChanged = lastSessionRef.current !== sessionId;
				lastSessionRef.current = sessionId;
				if (sessionChanged) setState({
					status: "loading",
					value: null
				});
				let alive = true;
				const hangTimer = window.setTimeout(() => {
					if (!alive) return;
					setState((prev) => prev.status === "ready" ? prev : {
						status: "error",
						value: prev.value,
						errorAt: Date.now()
					});
				}, DIRECTORY_TIMEOUT_MS);
				connection.api.sessions.models({ sessionId }).then((response) => {
					if (!alive) return;
					window.clearTimeout(hangTimer);
					if (response.result.ok) setState({
						status: "ready",
						value: response.result.value
					});
					else setState((prev) => ({
						status: "error",
						value: prev.value,
						errorAt: Date.now()
					}));
				}).catch(() => {
					if (!alive) return;
					window.clearTimeout(hangTimer);
					setState((prev) => ({
						status: "error",
						value: prev.value,
						errorAt: Date.now()
					}));
				});
				return () => {
					alive = false;
					window.clearTimeout(hangTimer);
				};
			}, [
				connection,
				sessionId,
				reloadTick,
				internalTick,
				enabled
			]);
			return {
				value: state.value,
				status: state.status,
				errorAt: state.errorAt,
				retry
			};
		}
		/**
		* The effort slider panel (inline 或浮动卡片两种形态)。
		* @param props - session + wire face + mode + verbs.
		* @returns the panel element.
		*/
		function EffortPanel(props) {
			const { sessionId, connection, onClose, inline = false, onResolved, inputRef } = props;
			const externalDirectory = props.directory ?? null;
			const ownDirectory = useDirectory(connection, sessionId, { enabled: externalDirectory === null });
			const directory = externalDirectory ?? ownDirectory;
			const [dragging, setDragging] = (0, react.useState)(false);
			const [rawValue, setRawValue] = (0, react.useState)(0);
			const [writeFailed, setWriteFailed] = (0, react.useState)(false);
			const hasValue = directory.value !== null;
			const loading = directory.status === "loading";
			const failed = directory.status === "error" && directory.value === null;
			const current = directory.value?.current ?? null;
			const efforts = ((current === null ? void 0 : directory.value?.groups.find((entry) => entry.id === current.provider))?.models.find((entry) => entry.id === current?.model))?.reasoning?.efforts ?? [];
			const usable = hasValue && current !== null && efforts.length >= 2;
			const step100 = step100ForCount(efforts.length);
			const rawIndex = current === null || isEffortUnset(current.reasoningEffort) ? -1 : effortIndexForId(efforts, current.reasoningEffort);
			const settledIdxRef = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				if (!usable) return;
				let idx;
				if (rawIndex >= 0) idx = rawIndex;
				else if (current === null || isEffortUnset(current.reasoningEffort)) idx = efforts.length - 1;
				else idx = settledIdxRef.current;
				settledIdxRef.current = idx;
				setRawValue(step100 * idx);
				setDragging(false);
			}, [directory.value]);
			const displayIndex = usable ? effortIndexForRaw(rawValue, step100, efforts.length) : 0;
			const level = efforts[displayIndex];
			const unknownEffort = usable && rawIndex === -1 && !isEffortUnset(current?.reasoningEffort);
			const slider100 = usable ? rawValue : 0;
			const labelFraction = (index) => efforts.length > 1 ? index / (efforts.length - 1) : 0;
			const fillStyle = { width: `${slotLeftPx(slider100 / 100)}px` };
			const pointLightStyle = {
				left: `${slotLeftPx(slider100 / 100)}px`,
				top: inline ? "66px" : "76px"
			};
			const lastWrittenRef = (0, react.useRef)(null);
			const errorTimerRef = (0, react.useRef)(null);
			const trailingTimerRef = (0, react.useRef)(null);
			const pendingRef = (0, react.useRef)(null);
			const lastWriteAtRef = (0, react.useRef)(0);
			const markWriteError = (on) => {
				setWriteFailed(on);
				if (on) {
					if (errorTimerRef.current !== null) window.clearTimeout(errorTimerRef.current);
					errorTimerRef.current = window.setTimeout(() => setWriteFailed(false), 2500);
				}
			};
			/** 写入失败：回弹到最近一次成功档位并给可见提示（条目 2）。 */
			const revertToSettled = () => {
				setRawValue(settledIdxRef.current * step100);
				markWriteError(true);
			};
			/** 写当前档位到会话；检查 result.ok，失败回弹；与当前值一致则跳过（幂等）。 */
			const writeEffort = (v) => {
				if (!usable || current === null) return;
				const idx = effortIndexForRaw(v, step100, efforts.length);
				const effort = efforts[idx];
				if (effort === void 0) return;
				if (effort.id === lastWrittenRef.current) return;
				if (effort.id === current.reasoningEffort) {
					settledIdxRef.current = idx;
					return;
				}
				connection.api.sessions.selectModel({
					sessionId,
					provider: current.provider,
					model: current.model,
					reasoningEffort: effort.id
				}).then((response) => {
					if (response.result.ok) {
						lastWrittenRef.current = effort.id;
						settledIdxRef.current = idx;
						markWriteError(false);
					} else revertToSettled();
				}).catch(() => {
					revertToSettled();
				});
			};
			/** 节流补写：把节流窗口内最后记录的帧值写出去（条目 9 末帧保证）。 */
			const flushPending = () => {
				trailingTimerRef.current = null;
				const v = pendingRef.current;
				if (v === null) return;
				pendingRef.current = null;
				lastWriteAtRef.current = performance.now();
				writeEffort(v);
			};
			const onInput = (event) => {
				if (!usable) return;
				const v = Number(event.target.value);
				setRawValue(v);
				pendingRef.current = v;
				const now = performance.now();
				if (now - lastWriteAtRef.current >= 16) {
					lastWriteAtRef.current = now;
					pendingRef.current = null;
					writeEffort(v);
				} else if (trailingTimerRef.current === null) trailingTimerRef.current = window.setTimeout(flushPending, 24);
			};
			/** 松手/失焦/键盘结束/指针取消时吸附到最近档位并补发一次确认（条目 9）。 */
			const commit = (event) => {
				if (!usable) return;
				if (trailingTimerRef.current !== null) {
					window.clearTimeout(trailingTimerRef.current);
					trailingTimerRef.current = null;
				}
				pendingRef.current = null;
				const v = Number(event.target.value);
				const idx = effortIndexForRaw(v, step100, efforts.length);
				setRawValue(idx * step100);
				setDragging(false);
				writeEffort(v);
			};
			(0, react.useEffect)(() => {
				return () => {
					if (trailingTimerRef.current !== null) window.clearTimeout(trailingTimerRef.current);
					if (errorTimerRef.current !== null) window.clearTimeout(errorTimerRef.current);
				};
			}, []);
			const resolvedRef = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (!hasValue || resolvedRef.current) return;
				resolvedRef.current = true;
				onResolved?.(usable);
			}, [directory.value]);
			if (inline && !usable) return null;
			const head = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: effort_module_css_default.head,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: effort_module_css_default.headLeft,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: effort_module_css_default.labelText,
						children: "Effort"
					}), writeFailed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `${effort_module_css_default.status} ${effort_module_css_default.statusError}`,
						children: "写入失败"
					}) : unknownEffort ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `${effort_module_css_default.status} ${effort_module_css_default.statusUnknown}`,
						children: "未知档位"
					}) : usable && level !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: `${effort_module_css_default.status} ${effort_module_css_default[`level${displayIndex}`] ?? ""} ${displayIndex === efforts.length - 1 ? effort_module_css_default.statusGlow : ""}`,
						children: level.name
					}, level.name) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: effort_module_css_default.status,
						children: "—"
					})]
				}), !inline && onClose !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: effort_module_css_default.close,
					onClick: onClose,
					"aria-label": "关闭",
					children: "×"
				})]
			});
			const track = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: effort_module_css_default.levelLabels,
				children: efforts.map((entry, labelIndex) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: `${effort_module_css_default.levelLabel}${labelIndex === displayIndex ? ` ${effort_module_css_default.levelLabelActive}` : ""}`,
					style: { left: `${slotLeftPx(labelFraction(labelIndex))}px` },
					children: levelLabel(entry)
				}, entry.id))
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: effort_module_css_default.trackWrapper,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: effort_module_css_default.trackBg }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: effort_module_css_default.fill,
						style: fillStyle
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: effort_module_css_default.dotsLayer,
						children: efforts.map((entry, dotIndex) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: `${effort_module_css_default.dot}${dotIndex === displayIndex ? ` ${effort_module_css_default.dotActive}` : ""}`,
							style: { left: `${slotLeftPx(labelFraction(dotIndex))}px` }
						}, entry.id))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: `${effort_module_css_default.pointLight}${dragging ? ` ${effort_module_css_default.pointLightOn}` : ""}`,
						style: pointLightStyle
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						ref: inputRef,
						type: "range",
						min: 0,
						max: 100,
						step: 1,
						value: usable ? rawValue : 0,
						disabled: !usable,
						"aria-label": "推理等级滑块",
						className: `${effort_module_css_default.range}${dragging ? ` ${effort_module_css_default.rangeGlow}` : ""}`,
						onInput,
						onPointerDown: () => setDragging(true),
						onPointerUp: commit,
						onPointerCancel: commit,
						onKeyUp: commit,
						onPointerLeave: () => setDragging(false),
						onBlur: commit
					})
				]
			})] });
			if (inline) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: effort_module_css_default.inlinePanel,
				"data-effort-panel": "inline",
				children: [head, track]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: effort_module_css_default.panel,
				"data-effort-panel": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: effort_module_css_default.glow }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: effort_module_css_default.inner,
					children: [
						head,
						track,
						!usable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: effort_module_css_default.emptyOverlay,
							children: failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: effort_module_css_default.failedBox,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "目录加载失败" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: effort_module_css_default.retry,
									onClick: () => directory.retry(),
									children: "重试"
								})]
							}) : loading || directory.value === null ? "模型目录加载中…" : current === null ? "模型不可用" : "当前模型不提供多档推理等级"
						})
					]
				})]
			});
		}
		//#endregion
		//#region \0dsh-css:C:\Users\19161\Documents\dsh-work\dsh-ui-web\packages\dsh-effort-slider\src\client\effort-trigger.module.css.mjs
		const css = ".JZLxAW_root{align-items:center;display:inline-flex;position:relative}.JZLxAW_trigger{color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:999px;align-items:center;gap:3px;padding:2px 8px;font-size:13px;font-weight:500;line-height:20px;display:inline-flex}.JZLxAW_trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.JZLxAW_trigger:focus-visible{outline:2px solid var(--dsw-alias-label-secondary);outline-offset:2px}.JZLxAW_label{text-overflow:ellipsis;white-space:nowrap;max-width:120px;overflow:hidden}.JZLxAW_chevron{color:var(--dsw-alias-label-caption);flex:none}.JZLxAW_popup{z-index:40;position:absolute;bottom:calc(100% + 8px);right:0}.JZLxAW_popup [data-effort-panel=true]{position:relative;top:auto;left:auto}";
		const tagId = "@captain1275/dsh-effort-slider/effort-trigger.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@captain1275/dsh-effort-slider";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var effort_trigger_module_css_default = {
			"chevron": "JZLxAW_chevron",
			"label": "JZLxAW_label",
			"popup": "JZLxAW_popup",
			"root": "JZLxAW_root",
			"trigger": "JZLxAW_trigger"
		};
		//#endregion
		//#region src/client/EffortTrigger.tsx
		/**
		* EffortTrigger —— 独立档位入口。挂在 `conversation.input.right` 列表座位
		* （视觉上紧贴模型选择器、在其左侧），不再触碰官方菜单 DOM。
		*
		* 触发器显示当前推理档位名，点击弹出浮动卡片形态的 EffortPanel（复用
		* 原有滑块 UI）。当前模型不提供多档推理时整个触发器自动退场。
		*
		* 审查修复后的行为：
		* - 目录 SWR 轮询：刷新不闪空（条目 1）；可用时 1s 轮询、目录失败按
		*   1s->5s->30s 退避、不支持多档时降为 30s 低频兜底（换模型后能恢复显示），
		*   不再每秒空转（条目 4/7）；
		* - 自动写：弹层打开期间绝不写（条目 3）；同一 key 失败按时间戳退避重试、
		*   至多 5 次后放弃到下次模型切换（条目 2/4）；key 含 highest.id，目录换档
		*   后允许重写新最高档（条目 15）；'' 视为显式值不触发自动写（条目 16）；
		* - 最高档用 pickHighest 推断而不是盲信最后一项（条目 8）；
		* - 弹层为 role=dialog，打开聚焦滑块、关闭还焦点给触发器、Esc 关闭
		*   （条目 10）；面板复用本组件已拉的目录，不再重复请求（条目 11）；
		* - 会话 effort 在目录中找不到时，显示 effort id 原文而不是"默认"（条目 6）。
		*/
		/**
		* 渲染档位触发器 + 弹层。
		* @param props - connection 与会话 id（框架注入）。
		* @returns 触发器元素；不支持多档或无会话时为 null。
		*/
		function EffortTrigger({ connection, sessionId }) {
			const [open, setOpen] = (0, react.useState)(false);
			const rootRef = (0, react.useRef)(null);
			const triggerRef = (0, react.useRef)(null);
			const sliderRef = (0, react.useRef)(null);
			const wasOpenRef = (0, react.useRef)(false);
			const [reloadTick, setReloadTick] = (0, react.useState)(0);
			const directoryState = useDirectory(connection, sessionId, { reloadTick });
			const directory = directoryState.value;
			const current = directory?.current ?? null;
			const efforts = ((current === null ? void 0 : directory?.groups.find((entry) => entry.id === current.provider))?.models.find((entry) => entry.id === current?.model))?.reasoning?.efforts ?? [];
			const usable = directory !== null && current !== null && efforts.length >= 2;
			const highest = pickHighest(efforts);
			const failuresRef = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				if (directoryState.status === "ready") failuresRef.current = 0;
				else if (directoryState.status === "error" && directoryState.value === null) failuresRef.current += 1;
			}, [directoryState.status, directoryState.value]);
			const pollDelay = directory === null ? retryDelayMs(failuresRef.current) : usable ? POLL_BASE_MS : RETRY_MAX_MS;
			(0, react.useEffect)(() => {
				if (open || sessionId === void 0) return;
				const id = window.setInterval(() => {
					setReloadTick((n) => n + 1);
				}, pollDelay);
				return () => {
					window.clearInterval(id);
				};
			}, [
				open,
				sessionId,
				pollDelay
			]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onDown = (event) => {
					if (!rootRef.current?.contains(event.target)) setOpen(false);
				};
				document.addEventListener("mousedown", onDown);
				return () => {
					document.removeEventListener("mousedown", onDown);
				};
			}, [open]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onKey = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("keydown", onKey);
				};
			}, [open]);
			(0, react.useEffect)(() => {
				if (open) {
					wasOpenRef.current = true;
					const id = window.setTimeout(() => {
						sliderRef.current?.focus();
					}, 0);
					return () => {
						window.clearTimeout(id);
					};
				}
				if (wasOpenRef.current) {
					wasOpenRef.current = false;
					triggerRef.current?.focus();
				}
			}, [open]);
			const autoWriteStateRef = (0, react.useRef)(null);
			const pendingWriteKeyRef = (0, react.useRef)(null);
			const writtenKeyRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (open) return;
				if (!usable || current === null || highest === void 0 || sessionId === void 0) return;
				if (!isEffortUnset(current.reasoningEffort)) return;
				const key = `${sessionId}|${current.provider}|${current.model}|${highest.id}`;
				if (autoWriteStateRef.current !== null && autoWriteStateRef.current.key !== key) autoWriteStateRef.current = null;
				const record = autoWriteStateRef.current;
				const wait = record === null ? 0 : nextAutoWriteDelay(record, Date.now());
				if (wait === null) return;
				if (record !== null && wait > 0) return;
				if (writtenKeyRef.current === key) return;
				if (pendingWriteKeyRef.current === key) return;
				pendingWriteKeyRef.current = key;
				connection.api.sessions.selectModel({
					sessionId,
					provider: current.provider,
					model: current.model,
					reasoningEffort: highest.id
				}).then((response) => {
					if (pendingWriteKeyRef.current === key) pendingWriteKeyRef.current = null;
					if (response.result.ok) {
						writtenKeyRef.current = key;
						autoWriteStateRef.current = null;
					} else autoWriteStateRef.current = {
						key,
						attempts: (record?.attempts ?? 0) + 1,
						lastFailureAt: Date.now()
					};
				}).catch(() => {
					if (pendingWriteKeyRef.current === key) pendingWriteKeyRef.current = null;
					autoWriteStateRef.current = {
						key,
						attempts: (record?.attempts ?? 0) + 1,
						lastFailureAt: Date.now()
					};
				});
			}, [
				directory,
				usable,
				sessionId,
				connection,
				open
			]);
			if (sessionId === void 0) return null;
			if (!usable) return null;
			const explicit = !isEffortUnset(current?.reasoningEffort);
			const effortId = explicit ? current.reasoningEffort : highest?.id;
			const knownLevel = effortId === void 0 ? void 0 : efforts.find((entry) => entry.id === effortId);
			let label;
			if (!explicit) label = highest?.name ?? "—";
			else if (knownLevel !== void 0) label = knownLevel.name;
			else label = current?.reasoningEffort === "" ? "—" : current?.reasoningEffort;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: effort_trigger_module_css_default.root,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					ref: triggerRef,
					type: "button",
					className: effort_trigger_module_css_default.trigger,
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					title: "推理等级",
					onClick: () => {
						setOpen((v) => !v);
						if (!open) setReloadTick((n) => n + 1);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: effort_trigger_module_css_default.label,
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						className: effort_trigger_module_css_default.chevron,
						width: "10",
						height: "10",
						viewBox: "0 0 10 10",
						"aria-hidden": true,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M2 6.5 5 3.5 8 6.5",
							stroke: "currentColor",
							strokeWidth: "1.4",
							fill: "none",
							strokeLinecap: "round"
						})
					})]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: effort_trigger_module_css_default.popup,
					role: "dialog",
					"aria-modal": false,
					"aria-label": "推理等级",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EffortPanel, {
						sessionId,
						connection,
						directory: directoryState,
						inputRef: sliderRef,
						onClose: () => setOpen(false)
					})
				})]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** 需要的客户端服务：slots（插槽注册）、connection（模型目录读写）。 */
		const inject = ["slots", "connection"];
		/**
		* 在 composer 工具条注册档位触发器，紧贴模型选择器（视觉上在模型按钮左侧）。
		* @param ctx - 宿主上下文（slots/connection 服务）。
		*/
		function apply(ctx) {
			const slots = ctx.get("slots");
			const connection = ctx.get("connection");
			slots.inject("conversation.input.right", () => ctx.get("slots").register({
				name: "conversation.input.right",
				id: "effort-slider",
				order: 100,
				label: "推理等级",
				inject: (sessionId) => ({
					connection,
					...sessionId === void 0 ? {} : { sessionId }
				})
			}, EffortTrigger));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map