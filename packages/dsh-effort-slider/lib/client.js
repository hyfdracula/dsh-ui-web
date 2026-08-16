window.__ModuleLoader__.load({
	id: "@captain1275/dsh-effort-slider",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:C:\Users\19161\Documents\dsh-work\dsh-ui-web\packages\dsh-effort-slider\src\client\effort.module.css.mjs
		const css$1 = ".v5_bmW_panel{user-select:none;z-index:10;pointer-events:auto;width:280px;position:absolute;top:0;left:0}.v5_bmW_glow{opacity:.55;filter:blur(10px);z-index:0;pointer-events:none;background:linear-gradient(135deg,#6e9be847,#3f76d81f,#6e9be82e);border-radius:22px;position:absolute;inset:-3px}.v5_bmW_inner{z-index:1;backdrop-filter:blur(var(--dsh-aqua-blur,14px));background:linear-gradient(#ffffffb8,#ffffff94);border:1px solid #132d5342;border-radius:20px;padding:14px 16px 12px;position:relative;box-shadow:inset 0 1px #ffffff80,0 12px 32px #132d5324}body[data-ds-dark-theme] .v5_bmW_inner{background:linear-gradient(#2a2e38d1,#161922d1);border-color:#94b4dc52;box-shadow:inset 0 1px #ffffff12,0 12px 32px #02060e80}.v5_bmW_head{justify-content:space-between;align-items:center;margin-bottom:2px;display:flex}.v5_bmW_headLeft{align-items:center;gap:7px;font-size:14px;font-weight:500;display:inline-flex;overflow:hidden}.v5_bmW_labelText{color:var(--dsw-alias-label-secondary,#132d539e);letter-spacing:.03em;font-weight:600}.v5_bmW_status{color:var(--dsw-alias-label-caption,#132d5373);text-transform:uppercase;letter-spacing:.04em;vertical-align:middle;font-weight:700;transition:color .25s,text-shadow .25s;display:inline-block}.v5_bmW_statusGlow{color:#3f76d8;text-shadow:0 0 14px #3f76d88c}body[data-ds-dark-theme] .v5_bmW_statusGlow{color:#6e9be8;text-shadow:0 0 14px #6e9be899}.v5_bmW_level0{color:#132d5366}.v5_bmW_level1{color:#3f76d88c}.v5_bmW_level2{color:#3f76d8bf}.v5_bmW_level3{color:#3f76d8;text-shadow:0 0 10px #3f76d873}.v5_bmW_level4{color:#2f62c4;text-shadow:0 0 12px #3f76d899}body[data-ds-dark-theme] .v5_bmW_level0{color:#94b4dc59}body[data-ds-dark-theme] .v5_bmW_level1{color:#6e9be880}body[data-ds-dark-theme] .v5_bmW_level2{color:#6e9be8b3}body[data-ds-dark-theme] .v5_bmW_level3{color:#6e9be8;text-shadow:0 0 10px #6e9be880}body[data-ds-dark-theme] .v5_bmW_level4{color:#9dbcf0;text-shadow:0 0 12px #6e9be8a6}.v5_bmW_close{color:var(--dsw-alias-label-secondary,#132d539e);cursor:pointer;background:#ffffff59;border:1px solid #132d5329;border-radius:8px;justify-content:center;align-items:center;width:24px;height:24px;font-size:13px;line-height:1;display:inline-flex}.v5_bmW_close:hover{color:var(--dsw-alias-label-primary,#132d53);background:#ffffff8c;border-color:#132d5357}body[data-ds-dark-theme] .v5_bmW_close{color:#94b4dcbf;background:#94b4dc14;border-color:#94b4dc33}body[data-ds-dark-theme] .v5_bmW_close:hover{color:#dbe7f7;background:#94b4dc29;border-color:#94b4dc66}.v5_bmW_levelLabels{height:15px;margin-bottom:4px;position:relative}.v5_bmW_levelLabel{color:var(--dsw-alias-label-caption,#132d5373);letter-spacing:.04em;text-transform:uppercase;font-size:10px;font-weight:700;transition:color .15s;position:absolute;top:0;transform:translate(-50%)}.v5_bmW_levelLabelActive{color:#3f76d8}body[data-ds-dark-theme] .v5_bmW_levelLabelActive{color:#6e9be8}.v5_bmW_trackWrapper{isolation:isolate;background:#132d530d;border:1px solid #132d531f;border-radius:10px;height:32px;position:relative;overflow:hidden}body[data-ds-dark-theme] .v5_bmW_trackWrapper{background:#0a0e1680;border-color:#94b4dc24}.v5_bmW_trackBg{z-index:0;position:absolute;inset:0}.v5_bmW_fill{z-index:1;pointer-events:none;background:linear-gradient(90deg,#3f76d838,#3f76d880);border-radius:9px 0 0 9px;transition:width 80ms linear;position:absolute;top:0;bottom:0;left:0;box-shadow:inset 0 1px #ffffff40}body[data-ds-dark-theme] .v5_bmW_fill{background:linear-gradient(90deg,#6e9be82e,#6e9be873);box-shadow:inset 0 1px #ffffff1f}.v5_bmW_dotsLayer{pointer-events:none;z-index:2;position:absolute;inset:0}.v5_bmW_dot{background:#3f76d84d;border-radius:50%;width:4px;height:4px;transition:background .15s,box-shadow .15s;position:absolute;top:50%;transform:translateY(-50%)}.v5_bmW_dotActive{background:#3f76d8;box-shadow:0 0 8px #3f76d8cc}body[data-ds-dark-theme] .v5_bmW_dot{background:#6e9be84d}body[data-ds-dark-theme] .v5_bmW_dotActive{background:#6e9be8;box-shadow:0 0 8px #6e9be8d9}.v5_bmW_range{-webkit-appearance:none;appearance:none;cursor:pointer;z-index:5;background:0 0;outline:none;width:100%;height:100%;margin:0;padding:0;position:absolute;inset:0}.v5_bmW_range::-webkit-slider-thumb{-webkit-appearance:none;cursor:grab;background:linear-gradient(145deg,#fff 0%,#dce7f7 55%,#c9d9f0 100%);border:none;border-radius:9px;width:26px;height:26px;transition:box-shadow .25s,transform .2s cubic-bezier(.34,1.56,.64,1);box-shadow:0 2px 8px #132d5340,0 0 0 1px #3f76d847,inset 0 1px #fffc}.v5_bmW_range::-webkit-slider-thumb:active{cursor:grabbing;transform:scale(.92)}.v5_bmW_rangeGlow::-webkit-slider-thumb{box-shadow:0 2px 8px #132d534d,0 0 0 1px #3f76d873,0 0 18px #3f76d866,0 0 36px #3f76d82e,inset 0 1px #fffc}.v5_bmW_range::-moz-range-thumb{cursor:grab;background:linear-gradient(145deg,#fff 0%,#dce7f7 55%,#c9d9f0 100%);border:none;border-radius:8px;width:24px;height:24px;box-shadow:0 2px 8px #132d5340,0 0 0 1px #3f76d847}.v5_bmW_range::-moz-range-thumb:active{cursor:grabbing;transform:scale(.95)}.v5_bmW_range::-moz-range-track{background:0 0;border:none;height:32px}.v5_bmW_pointLight{pointer-events:none;z-index:3;opacity:0;background:radial-gradient(circle,#3f76d838 0%,#3f76d812 30%,#3f76d805 55%,#0000 70%);border-radius:50%;width:150px;height:150px;transition:opacity .25s;position:absolute;transform:translate(-50%,-50%)}.v5_bmW_pointLightOn{opacity:1}.v5_bmW_emptyOverlay{color:var(--dsw-alias-label-caption,#132d5373);letter-spacing:.02em;text-align:center;padding:10px 0 2px;font-size:13px;font-weight:600}.v5_bmW_inlinePanel{box-sizing:border-box;border-top:1px solid var(--dsw-alias-border-l2,#132d531f);user-select:none;width:100%;padding:8px 10px 10px;position:relative}body[data-ds-dark-theme] .v5_bmW_inlinePanel{border-top-color:#94b4dc24}.v5_bmW_inlinePanel .v5_bmW_head{margin-bottom:4px}";
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
			"status": "v5_bmW_status",
			"statusGlow": "v5_bmW_statusGlow",
			"trackBg": "v5_bmW_trackBg",
			"trackWrapper": "v5_bmW_trackWrapper"
		};
		//#endregion
		//#region src/client/EffortPanel.tsx
		/**
		* Effort slider panel — Aqua glass edition.
		*
		* 交互与 aurora EffortPanel 一致（连续 0..100 拖动、松手吸附最近档位、
		* 拖动中每帧最多一次写入、写入走 sessions.selectModel 只改
		* reasoningEffort）；视觉为 Aqua 玻璃：CSS 渐变填充轨道、发光玻璃
		* thumb，无 WebGL 依赖。
		*
		* 两种形态：
		* - inline：嵌在官方模型菜单里（原位替换「推理等级」行），无边框卡片、
		*   无关闭钮；目录未加载或模型不支持多档时渲染 null 并由 onResolved
		*   通知宿主还原官方行。
		* - 浮动卡片（默认）：玻璃卡片 + 关闭钮，供其它宿主复用。
		*/
		/** Panel width (must match the CSS `.panel` width). */
		const PANEL_W = 280;
		/** Load the per-session model directory once per panel open. */
		function useDirectory(connection, sessionId, reloadTick = 0) {
			const [directory, setDirectory] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (sessionId === void 0) {
					setDirectory(null);
					return;
				}
				let alive = true;
				setDirectory(null);
				connection.api.sessions.models({ sessionId }).then((response) => {
					if (alive && response.result.ok) setDirectory(response.result.value);
				}).catch(() => {});
				return () => {
					alive = false;
				};
			}, [
				connection,
				sessionId,
				reloadTick
			]);
			return directory;
		}
		/**
		* The effort slider panel (inline 或浮动卡片两种形态)。
		* @param props - session + wire face + mode + verbs.
		* @returns the panel element.
		*/
		function EffortPanel(props) {
			const { sessionId, connection, onClose, inline = false, onResolved } = props;
			const directory = useDirectory(connection, sessionId);
			const [dragging, setDragging] = (0, react.useState)(false);
			const [rawValue, setRawValue] = (0, react.useState)(0);
			const disabled = directory === null;
			const rawCurrent = directory?.current ?? null;
			const fallback = directory !== null && directory.groups.length > 0 && directory.groups[0].models.length > 0 ? {
				provider: directory.groups[0].id,
				model: directory.groups[0].models[0].id
			} : null;
			const current = rawCurrent ?? fallback;
			const efforts = ((current === null ? void 0 : directory?.groups.find((entry) => entry.id === current.provider))?.models.find((entry) => entry.id === current?.model))?.reasoning?.efforts ?? [];
			const usable = !disabled && current !== null && efforts.length >= 2;
			const currentEffortId = current?.reasoningEffort || efforts[efforts.length - 1]?.id;
			const rawIndex = currentEffortId === void 0 ? -1 : efforts.findIndex((level) => level.id === currentEffortId);
			const step100 = efforts.length > 1 ? 100 / (efforts.length - 1) : 100;
			const initialRaw = usable ? (rawIndex >= 0 ? rawIndex : efforts.length - 1) * step100 : 0;
			(0, react.useEffect)(() => {
				setRawValue(initialRaw);
				setDragging(false);
			}, [directory]);
			const resolvedRef = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (disabled || resolvedRef.current) return;
				resolvedRef.current = true;
				onResolved?.(usable);
			}, [directory]);
			const displayIndex = usable ? Math.round(rawValue / step100) : 0;
			const level = efforts[displayIndex];
			const slider100 = usable ? rawValue : 0;
			const fillStyle = { width: `${slider100}%` };
			const pointLightStyle = {
				left: `${22 + slider100 / 100 * (PANEL_W - 44)}px`,
				top: inline ? "66px" : "76px"
			};
			/** 写入当前档位到会话（供拖动中节流调用）。 */
			const writeEffort = (v) => {
				if (!usable || current === null) return;
				const idx = Math.round(v / step100);
				const effort = efforts[idx];
				if (effort === void 0) return;
				connection.api.sessions.selectModel({
					sessionId,
					provider: current.provider,
					model: current.model,
					reasoningEffort: effort.id
				}).catch(() => {});
			};
			const lastWriteRef = (0, react.useRef)(0);
			const onInput = (event) => {
				if (!usable) return;
				const v = Number(event.target.value);
				setRawValue(v);
				const now = performance.now();
				if (now - lastWriteRef.current >= 16) {
					lastWriteRef.current = now;
					writeEffort(v);
				}
			};
			/** 松手/失焦/键盘结束时吸附到最近档位并补发一次确认。 */
			const commit = (event) => {
				if (!usable) return;
				const v = Number(event.target.value);
				const idx = Math.round(v / step100);
				setRawValue(idx * step100);
				setDragging(false);
				writeEffort(v);
			};
			if (inline && !usable) return null;
			const head = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: effort_module_css_default.head,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: effort_module_css_default.headLeft,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: effort_module_css_default.labelText,
						children: "Effort"
					}), usable && level !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
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
					style: { left: `${10 + labelIndex / Math.max(efforts.length - 1, 1) * 80}%` },
					children: labelIndex === 0 ? "OFF" : labelIndex === efforts.length - 1 ? "MAX" : entry.name
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
							style: { left: `${10 + dotIndex / Math.max(efforts.length - 1, 1) * 80}%` }
						}, entry.id))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: `${effort_module_css_default.pointLight}${dragging ? ` ${effort_module_css_default.pointLightOn}` : ""}`,
						style: pointLightStyle
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						type: "range",
						min: 0,
						max: 100,
						step: 1,
						value: usable ? rawValue : 0,
						disabled: !usable,
						className: `${effort_module_css_default.range}${dragging ? ` ${effort_module_css_default.rangeGlow}` : ""}`,
						onInput,
						onPointerDown: () => setDragging(true),
						onPointerUp: commit,
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
							children: disabled ? "模型目录加载中…" : "当前模型不提供多档推理等级"
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
		* （模型选择器右边、发送按钮前），不再触碰官方菜单 DOM。
		*
		* 触发器显示当前推理档位名，点击弹出浮动卡片形态的 EffortPanel（复用
		* 原有滑块 UI）。当前模型不提供多档推理时整个触发器自动退场。目录在
		* 弹层开合时重新拉取，拖完滑块后本地即时反映。
		*/
		/**
		* 渲染档位触发器 + 弹层。
		* @param props - connection 与会话 id（框架注入）。
		* @returns 触发器元素；不支持多档或无会话时为 null。
		*/
		function EffortTrigger({ connection, sessionId }) {
			const [open, setOpen] = (0, react.useState)(false);
			const rootRef = (0, react.useRef)(null);
			const [reloadTick, setReloadTick] = (0, react.useState)(0);
			const directory = useDirectory(connection, sessionId, reloadTick);
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
				if (open || sessionId === void 0) return;
				const id = window.setInterval(() => {
					setReloadTick((n) => n + 1);
				}, 1e3);
				return () => {
					window.clearInterval(id);
				};
			}, [open, sessionId]);
			const current = directory?.current ?? null;
			const efforts = ((current === null ? void 0 : directory?.groups.find((entry) => entry.id === current.provider))?.models.find((entry) => entry.id === current?.model))?.reasoning?.efforts ?? [];
			const usable = directory !== null && current !== null && efforts.length >= 2;
			const highest = efforts[efforts.length - 1];
			const autoWriteKeyRef = (0, react.useRef)("");
			(0, react.useEffect)(() => {
				if (!usable || current === null || highest === void 0 || sessionId === void 0) return;
				if (current.reasoningEffort !== void 0 && current.reasoningEffort !== "") return;
				const key = `${sessionId}|${current.provider}|${current.model}`;
				if (autoWriteKeyRef.current === key) return;
				autoWriteKeyRef.current = key;
				connection.api.sessions.selectModel({
					sessionId,
					provider: current.provider,
					model: current.model,
					reasoningEffort: highest.id
				}).catch(() => {
					autoWriteKeyRef.current = "";
				});
			}, [
				directory,
				usable,
				sessionId,
				connection
			]);
			if (sessionId === void 0) return null;
			if (!usable) return null;
			const currentEffortId = current?.reasoningEffort || highest?.id;
			const label = efforts.find((entry) => entry.id === currentEffortId)?.name ?? "默认";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: effort_trigger_module_css_default.root,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
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
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(EffortPanel, {
						sessionId,
						connection,
						onClose: () => {
							setOpen(false);
							setReloadTick((n) => n + 1);
						}
					})
				})]
			});
		}
		//#endregion
		//#region src/client/index.ts
		/** 需要的客户端服务：slots（插槽注册）、connection（模型目录读写）。 */
		const inject = ["slots", "connection"];
		/**
		* 在 composer 工具条右侧注册档位触发器。
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