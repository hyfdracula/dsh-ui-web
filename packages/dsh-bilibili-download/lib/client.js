window.__ModuleLoader__.load({
	id: "@captain1275/dsh-bilibili-download",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/protocol.ts
		/** Convert the settings-namespace shape to the API cookie shape. */
		function settingsToCookies(settings) {
			return {
				SESSDATA: settings?.sessdata ?? "",
				bili_jct: settings?.biliJct ?? "",
				DedeUserID: settings?.dedeUserID ?? ""
			};
		}
		/** Convert the API cookie shape to the settings-namespace shape. */
		function cookiesToSettings(cookies) {
			return {
				sessdata: cookies.SESSDATA,
				biliJct: cookies.bili_jct,
				dedeUserID: cookies.DedeUserID
			};
		}
		/** API prefix constant (shared by host routes and client api.ts). */
		const BILI_API = {
			info: "/api/dsh-bilibili-download/info",
			start: "/api/dsh-bilibili-download/start",
			check: "/api/dsh-bilibili-download/check"
		};
		/** Predefined quality presets the UI offers. */
		const QUALITY_PRESETS = [
			{
				label: "4K 超高清 (HEVC)",
				videoFmt: "30121",
				audioFmt: "30280",
				description: "5.1 GB, 麒麟芯片硬解"
			},
			{
				label: "4K 超高清 (AV1)",
				videoFmt: "100029",
				audioFmt: "30280",
				description: "3.6 GB, 需软解"
			},
			{
				label: "4K 超高清 (AVC)",
				videoFmt: "30120",
				audioFmt: "30280",
				description: "9.6 GB, 最兼容"
			},
			{
				label: "1080P 高码率 (HEVC)",
				videoFmt: "30102",
				audioFmt: "30280",
				description: "1.9 GB"
			},
			{
				label: "1080P 高码率 (AVC)",
				videoFmt: "30112",
				audioFmt: "30280",
				description: "2.7 GB"
			},
			{
				label: "1080P 高清 (AVC)",
				videoFmt: "30080",
				audioFmt: "30280",
				description: "1.8 GB"
			},
			{
				label: "720P 准高清 (AVC)",
				videoFmt: "30064",
				audioFmt: "30280",
				description: "840 MB"
			}
		];
		//#endregion
		//#region src/client/api.ts
		/**
		* Client-side API for the dsh-bilibili-download plugin.
		*
		* Talks to the host routes via plain fetch, same origin.
		*/
		/** Error class for API errors. */
		var BiliApiError = class extends Error {
			constructor(message) {
				super(message);
				this.name = "BiliApiError";
			}
		};
		/** Helper: check response or throw. */
		async function readJson(response) {
			let body;
			try {
				body = await response.json();
			} catch {
				throw new BiliApiError(`HTTP ${response.status}: invalid JSON`);
			}
			if (!response.ok) throw new BiliApiError(typeof body === "object" && body !== null && typeof body.error === "string" ? body.error : `HTTP ${response.status}`);
			return body;
		}
		/** Client-side API for the download routes. */
		var BiliApi = class {
			/** Check if yt-dlp and ffmpeg are available. */
			async check() {
				return readJson(await fetch(BILI_API.check));
			}
			/** Get video info (title, formats, etc.). */
			async getInfo(url, cookies) {
				return readJson(await fetch(BILI_API.info, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						url,
						cookies
					})
				}));
			}
			/**
			* Start a download. Returns an NDJSON stream reader.
			* @param url - video URL
			* @param cookies - auth cookies
			* @param videoFmt - yt-dlp format id for video
			* @param audioFmt - yt-dlp format id for audio
			* @param outputDir - output directory
			* @param onProgress - progress callback
			* @param onResult - result callback (file path or error)
			* @returns AbortController to cancel the download
			*/
			async startDownload(url, cookies, videoFmt, audioFmt, outputDir, onProgress, onResult) {
				const controller = new AbortController();
				const response = await fetch(BILI_API.start, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						url,
						cookies,
						videoFmt,
						audioFmt,
						outputDir
					}),
					signal: controller.signal
				});
				if (!response.ok || response.body === null) throw new BiliApiError(await response.text().catch(() => "") || `HTTP ${response.status}`);
				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let buffer = "";
				const readLoop = async () => {
					try {
						for (;;) {
							const { done, value } = await reader.read();
							if (done) break;
							buffer += decoder.decode(value, { stream: true });
							const lines = buffer.split("\n");
							buffer = lines.pop() ?? "";
							for (const line of lines) {
								if (line.trim() === "") continue;
								try {
									const parsed = JSON.parse(line);
									if (parsed.type === "progress") onProgress(parsed.progress);
									else if (parsed.type === "result") onResult(parsed.ok, parsed.ok ? parsed.file : parsed.error);
								} catch {}
							}
						}
					} catch (e) {
						if (e.name !== "AbortError") onResult(false, e.message || "下载中断");
					}
				};
				readLoop();
				return controller;
			}
		};
		//#endregion
		//#region \0dsh-css:C:\Users\19161\Documents\dsh-work\packages\dsh-bilibili-download\src\client\bili-panel.module.css.mjs
		const css = ".lgk5Jq_card{border:1px solid var(--border,#80808038);background:var(--bg-1,#8080800f);border-radius:8px;list-style:none;overflow:hidden}.lgk5Jq_cardHeader{width:100%;color:var(--text-0,#e6e6e6);cursor:pointer;text-align:left;background:0 0;border:none;justify-content:space-between;align-items:flex-start;gap:10px;padding:10px 12px;font-family:inherit;font-size:13px;display:flex}.lgk5Jq_cardHeader:hover{background:var(--bg-2,#8080801a)}.lgk5Jq_cardHeadText{flex-direction:column;gap:2px;min-width:0;display:flex}.lgk5Jq_cardName{color:var(--text-0,#fff);font-weight:600}.lgk5Jq_cardDescription{color:var(--text-2,#8a8f98);font-size:12px;line-height:1.5}.lgk5Jq_cardChevron{color:var(--text-2,#8a8f98);flex-shrink:0;transition:transform .15s}.lgk5Jq_cardChevronOpen{color:var(--text-2,#8a8f98);flex-shrink:0;transform:rotate(180deg)}.lgk5Jq_cardBody{flex-direction:column;gap:8px;padding:0 12px 12px;display:flex}.lgk5Jq_cardHint{color:var(--text-2,#8a8f98);margin:0;font-size:12px;line-height:1.5}.lgk5Jq_modalBackdrop{z-index:9999;background:#0a0b0ed1;justify-content:center;align-items:center;padding:24px;display:flex;position:fixed;inset:0}.lgk5Jq_modal{background:var(--bg-0,#17181c);width:min(760px,100%);max-height:calc(100vh - 48px);color:var(--text-0,#e6e6e6);border:1px solid #80808047;border-radius:12px;overflow-y:auto;box-shadow:0 18px 60px #0000008c}.lgk5Jq_entry{width:100%;color:var(--text-1,#d0d3d6);cursor:pointer;text-align:left;background:0 0;border:none;border-radius:6px;align-items:center;gap:8px;padding:8px 12px;font-size:13px;transition:background .15s;display:flex}.lgk5Jq_entry:hover{background:var(--bg-2,#8080801f)}.lgk5Jq_entry[data-active=true]{background:var(--bg-2,#8080802e);color:var(--text-0,#fff)}.lgk5Jq_entryIcon{opacity:.85;flex-shrink:0;justify-content:center;align-items:center;width:16px;height:16px;display:inline-flex}.lgk5Jq_entryLabel{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.lgk5Jq_view{box-sizing:border-box;background:var(--bg-0,#17181c);width:100%;height:100%;color:var(--text-0,#e6e6e6);padding:20px 24px;position:relative;overflow-y:auto}.lgk5Jq_panel{flex-direction:column;gap:14px;max-width:720px;margin:0 auto;padding-top:8px;display:flex}.lgk5Jq_header{justify-content:space-between;align-items:center;margin-bottom:4px;display:flex}.lgk5Jq_title{color:var(--text-0,#fff);margin:0;font-size:17px;font-weight:600}.lgk5Jq_closeBtn{color:var(--text-2,#8a8f98);cursor:pointer;background:0 0;border:none;border-radius:4px;padding:4px 8px;font-size:20px;line-height:1}.lgk5Jq_closeBtn:hover{background:var(--bg-2,#80808033);color:var(--text-0,#fff)}.lgk5Jq_envRow{background:var(--bg-1,#80808014);border-radius:6px;align-items:center;gap:6px;padding:8px 12px;font-size:12px;display:flex}.lgk5Jq_envLabel{color:var(--text-2,#8a8f98)}.lgk5Jq_envOk{color:#4caf50;font-weight:500}.lgk5Jq_envFail{color:#f44336;font-weight:500}.lgk5Jq_envUnknown{color:var(--text-2,#8a8f98)}.lgk5Jq_fieldRow{flex-direction:column;gap:6px;display:flex}.lgk5Jq_label{color:var(--text-2,#8a8f98);font-size:12px;font-weight:500}.lgk5Jq_input{border:1px solid var(--border,#80808040);background:var(--bg-2,#8080801a);width:100%;color:var(--text-0,#fff);box-sizing:border-box;border-radius:6px;outline:none;padding:8px 10px;font-family:inherit;font-size:13px}.lgk5Jq_input:focus{border-color:var(--accent,#4d9fff)}.lgk5Jq_input::placeholder{color:var(--text-3,#5a5f66)}.lgk5Jq_input:disabled{opacity:.5;cursor:not-allowed}.lgk5Jq_cookieGrid{grid-template-columns:1fr 1fr 1fr;gap:8px;display:grid}.lgk5Jq_rememberRow{color:var(--text-2,#8a8f98);flex-wrap:wrap;align-items:center;gap:10px;font-size:12px;display:flex}.lgk5Jq_rememberHint{color:var(--text-2,#8a8f98)}.lgk5Jq_rememberErr{color:#f44336}.lgk5Jq_btnSmall{border:1px solid var(--border,#80808040);background:var(--bg-2,#8080801f);color:var(--text-0,#fff);cursor:pointer;border-radius:6px;padding:4px 10px;font-family:inherit;font-size:12px;transition:background .15s}.lgk5Jq_btnSmall:hover{background:var(--bg-2,#80808033)}.lgk5Jq_btnSmall:disabled{opacity:.5;cursor:not-allowed}.lgk5Jq_select{border:1px solid var(--border,#80808040);background:var(--bg-2,#8080801a);width:100%;color:var(--text-0,#fff);cursor:pointer;border-radius:6px;outline:none;padding:8px 10px;font-family:inherit;font-size:13px}.lgk5Jq_formatDetails{font-size:12px}.lgk5Jq_formatSummary{cursor:pointer;color:var(--text-2,#8a8f98);user-select:none;padding:4px 0}.lgk5Jq_formatList{border:1px solid var(--border,#80808033);border-radius:6px;max-height:200px;margin-top:4px;padding:8px;overflow-y:auto}.lgk5Jq_formatRow{color:var(--text-1,#c8ccd0);border-radius:4px;padding:4px 6px}.lgk5Jq_formatRow:hover{background:var(--bg-2,#80808026)}.lgk5Jq_progressSection{flex-direction:column;gap:6px;display:flex}.lgk5Jq_progressBar{background:var(--bg-2,#80808026);border-radius:4px;height:8px;overflow:hidden}.lgk5Jq_progressFill{background:linear-gradient(90deg,#4d9fff,#7c4dff);border-radius:4px;height:100%;transition:width .3s}.lgk5Jq_progressText{color:var(--text-2,#8a8f98);font-family:ui-monospace,monospace;font-size:12px}.lgk5Jq_errorBox{color:#f8715f;word-break:break-word;background:#f443361f;border:1px solid #f443364d;border-radius:6px;padding:10px 12px;font-size:12.5px;line-height:1.5}.lgk5Jq_resultBox{color:#7bd88a;background:#4caf501f;border:1px solid #4caf504d;border-radius:6px;padding:10px 12px;font-size:12.5px;line-height:1.5}.lgk5Jq_resultPath{color:var(--text-1,#c8ccd0);word-break:break-all;margin-top:6px;font-family:ui-monospace,monospace;font-size:12px}.lgk5Jq_actions{gap:10px;margin-top:4px;display:flex}.lgk5Jq_btn,.lgk5Jq_btnPrimary,.lgk5Jq_btnDanger{cursor:pointer;border:1px solid #0000;border-radius:6px;padding:8px 18px;font-family:inherit;font-size:13px;transition:background .15s}.lgk5Jq_btn{background:var(--bg-2,#8080801f);color:var(--text-0,#fff)}.lgk5Jq_btn:hover{background:var(--bg-2,#80808033)}.lgk5Jq_btnPrimary{background:var(--accent,#4d9fff);color:#fff}.lgk5Jq_btnPrimary:hover{filter:brightness(1.1)}.lgk5Jq_btnPrimary:disabled{opacity:.5;cursor:not-allowed}.lgk5Jq_btnDanger{color:#fff;background:#d32f2f}.lgk5Jq_btnDanger:hover{background:#b71c1c}";
		const tagId = "@captain1275/dsh-bilibili-download/bili-panel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@captain1275/dsh-bilibili-download";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var bili_panel_module_css_default = {
			"actions": "lgk5Jq_actions",
			"btn": "lgk5Jq_btn",
			"btnDanger": "lgk5Jq_btnDanger",
			"btnPrimary": "lgk5Jq_btnPrimary",
			"btnSmall": "lgk5Jq_btnSmall",
			"card": "lgk5Jq_card",
			"cardBody": "lgk5Jq_cardBody",
			"cardChevron": "lgk5Jq_cardChevron",
			"cardChevronOpen": "lgk5Jq_cardChevronOpen",
			"cardDescription": "lgk5Jq_cardDescription",
			"cardHeadText": "lgk5Jq_cardHeadText",
			"cardHeader": "lgk5Jq_cardHeader",
			"cardHint": "lgk5Jq_cardHint",
			"cardName": "lgk5Jq_cardName",
			"closeBtn": "lgk5Jq_closeBtn",
			"cookieGrid": "lgk5Jq_cookieGrid",
			"entry": "lgk5Jq_entry",
			"entryIcon": "lgk5Jq_entryIcon",
			"entryLabel": "lgk5Jq_entryLabel",
			"envFail": "lgk5Jq_envFail",
			"envLabel": "lgk5Jq_envLabel",
			"envOk": "lgk5Jq_envOk",
			"envRow": "lgk5Jq_envRow",
			"envUnknown": "lgk5Jq_envUnknown",
			"errorBox": "lgk5Jq_errorBox",
			"fieldRow": "lgk5Jq_fieldRow",
			"formatDetails": "lgk5Jq_formatDetails",
			"formatList": "lgk5Jq_formatList",
			"formatRow": "lgk5Jq_formatRow",
			"formatSummary": "lgk5Jq_formatSummary",
			"header": "lgk5Jq_header",
			"input": "lgk5Jq_input",
			"label": "lgk5Jq_label",
			"modal": "lgk5Jq_modal",
			"modalBackdrop": "lgk5Jq_modalBackdrop",
			"panel": "lgk5Jq_panel",
			"progressBar": "lgk5Jq_progressBar",
			"progressFill": "lgk5Jq_progressFill",
			"progressSection": "lgk5Jq_progressSection",
			"progressText": "lgk5Jq_progressText",
			"rememberErr": "lgk5Jq_rememberErr",
			"rememberHint": "lgk5Jq_rememberHint",
			"rememberRow": "lgk5Jq_rememberRow",
			"resultBox": "lgk5Jq_resultBox",
			"resultPath": "lgk5Jq_resultPath",
			"select": "lgk5Jq_select",
			"title": "lgk5Jq_title",
			"view": "lgk5Jq_view"
		};
		//#endregion
		//#region src/client/BiliDownloadPanel.tsx
		/**
		* Bilibili download panel — the main React UI component.
		*
		* Users paste a video URL and their cookies, select quality, then start
		* downloading. Progress is shown in real time.
		*/
		/** Parse a yt-dlp format string into a display label. */
		function formatLabel(fmt) {
			return `${fmt.resolution || "?"} (${fmt.vcodec.includes("avc1") ? "AVC" : fmt.vcodec.includes("hvc1") ? "HEVC" : fmt.vcodec.includes("av01") ? "AV1" : fmt.vcodec || "?"})${fmt.filesize > 0 ? ` ${(fmt.filesize / 1024 ** 3).toFixed(1)}GB` : ""} — [${fmt.id}]`;
		}
		const BiliDownloadPanel = ({ api, onClose, t, initialCookies, onRemember }) => {
			const [url, setUrl] = (0, react.useState)("");
			const [cookies, setCookies] = (0, react.useState)({
				SESSDATA: initialCookies?.SESSDATA ?? "",
				bili_jct: initialCookies?.bili_jct ?? "",
				DedeUserID: initialCookies?.DedeUserID ?? ""
			});
			const [remembered, setRemembered] = (0, react.useState)(!!initialCookies?.SESSDATA);
			const [rememberState, setRememberState] = (0, react.useState)("idle");
			const [phase, setPhase] = (0, react.useState)("idle");
			const [error, setError] = (0, react.useState)("");
			const [progress, setProgress] = (0, react.useState)(null);
			const [resultFile, setResultFile] = (0, react.useState)("");
			const [formats, setFormats] = (0, react.useState)([]);
			const [selectedPreset, setSelectedPreset] = (0, react.useState)(QUALITY_PRESETS[0]);
			const [outputDir, setOutputDir] = (0, react.useState)("");
			const [checks, setChecks] = (0, react.useState)({
				ytDlp: null,
				ffmpeg: null
			});
			const abortRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				api.check().then((r) => setChecks({
					ytDlp: r.ytDlp,
					ffmpeg: r.ffmpeg
				})).catch(() => {});
			}, [api]);
			(0, react.useEffect)(() => {
				if (!outputDir) setOutputDir("B 站下载");
			}, [outputDir]);
			/** Fetch video info. */
			const handleFetchInfo = (0, react.useCallback)(async () => {
				if (!url.trim()) {
					setError("请输入视频链接");
					return;
				}
				if (!cookies.SESSDATA) {
					setError("请输入 SESSDATA");
					return;
				}
				setPhase("fetching-info");
				setError("");
				try {
					const result = await api.getInfo(url.trim(), cookies);
					if (result.ok) {
						setFormats(result.info.formats.filter((f) => f.resolution && f.vcodec));
						setPhase("ready");
					} else {
						setError(result.error);
						setPhase("idle");
					}
				} catch (e) {
					setError(e.message || "获取信息失败");
					setPhase("idle");
				}
			}, [
				url,
				cookies,
				api
			]);
			/** Start download. */
			const handleStart = (0, react.useCallback)(async () => {
				setPhase("downloading");
				setError("");
				setProgress(null);
				setResultFile("");
				try {
					abortRef.current = await api.startDownload(url.trim(), cookies, selectedPreset.videoFmt, selectedPreset.audioFmt, outputDir, (p) => {
						setProgress(p);
						if (p.target === "merging") setPhase("merging");
					}, (ok, fileOrError) => {
						if (ok) {
							setResultFile(fileOrError);
							setPhase("done");
						} else {
							setError(fileOrError);
							setPhase("error");
						}
					});
				} catch (e) {
					setError(e.message || "启动下载失败");
					setPhase("error");
				}
			}, [
				url,
				cookies,
				selectedPreset,
				outputDir,
				api
			]);
			/** Cancel download. */
			const handleCancel = (0, react.useCallback)(() => {
				abortRef.current?.abort();
				abortRef.current = null;
				setPhase("idle");
				setProgress(null);
			}, []);
			/** Reset to beginning. */
			const handleReset = (0, react.useCallback)(() => {
				setPhase("idle");
				setProgress(null);
				setResultFile("");
				setError("");
				setFormats([]);
			}, []);
			/** Save the entered cookies into the settings namespace. */
			const handleRemember = (0, react.useCallback)(async () => {
				if (!onRemember) return;
				setRememberState("saving");
				try {
					await onRemember({
						SESSDATA: cookies.SESSDATA,
						bili_jct: cookies.bili_jct,
						DedeUserID: cookies.DedeUserID
					});
					setRemembered(true);
					setRememberState("saved");
				} catch {
					setRememberState("error");
				}
			}, [onRemember, cookies]);
			/** Clear remembered cookies (reset to empty strings). */
			const handleForget = (0, react.useCallback)(async () => {
				if (!onRemember) return;
				setRememberState("saving");
				try {
					await onRemember({
						SESSDATA: "",
						bili_jct: "",
						DedeUserID: ""
					});
					setRemembered(false);
					setCookies({
						SESSDATA: "",
						bili_jct: "",
						DedeUserID: ""
					});
					setRememberState("saved");
				} catch {
					setRememberState("error");
				}
			}, [onRemember]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: bili_panel_module_css_default.panel,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: bili_panel_module_css_default.header,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							className: bili_panel_module_css_default.title,
							children: "B 站视频下载"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: bili_panel_module_css_default.closeBtn,
							onClick: onClose,
							title: "关闭",
							children: "×"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: bili_panel_module_css_default.envRow,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: bili_panel_module_css_default.envLabel,
								children: "yt-dlp:"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: checks.ytDlp === true ? bili_panel_module_css_default.envOk : checks.ytDlp === false ? bili_panel_module_css_default.envFail : bili_panel_module_css_default.envUnknown,
								children: checks.ytDlp === null ? "检查中..." : checks.ytDlp ? "就绪" : "未找到"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: bili_panel_module_css_default.envLabel,
								style: { marginLeft: 16 },
								children: "ffmpeg:"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: checks.ffmpeg === true ? bili_panel_module_css_default.envOk : checks.ffmpeg === false ? bili_panel_module_css_default.envFail : bili_panel_module_css_default.envUnknown,
								children: checks.ffmpeg === null ? "检查中..." : checks.ffmpeg ? "就绪" : "未找到"
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: bili_panel_module_css_default.fieldRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: bili_panel_module_css_default.label,
							children: "视频链接:"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: bili_panel_module_css_default.input,
							type: "text",
							value: url,
							onChange: (e) => setUrl(e.target.value),
							placeholder: "https://www.bilibili.com/video/BV... 或 https://b23.tv/...",
							disabled: phase === "downloading" || phase === "merging"
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: bili_panel_module_css_default.fieldRow,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								className: bili_panel_module_css_default.label,
								children: "Cookie:"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: bili_panel_module_css_default.cookieGrid,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: bili_panel_module_css_default.input,
										type: "text",
										value: cookies.SESSDATA,
										onChange: (e) => setCookies((c) => ({
											...c,
											SESSDATA: e.target.value
										})),
										placeholder: "SESSDATA",
										disabled: phase === "downloading" || phase === "merging"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: bili_panel_module_css_default.input,
										type: "text",
										value: cookies.bili_jct,
										onChange: (e) => setCookies((c) => ({
											...c,
											bili_jct: e.target.value
										})),
										placeholder: "bili_jct",
										disabled: phase === "downloading" || phase === "merging"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: bili_panel_module_css_default.input,
										type: "text",
										value: cookies.DedeUserID,
										onChange: (e) => setCookies((c) => ({
											...c,
											DedeUserID: e.target.value
										})),
										placeholder: "DedeUserID",
										disabled: phase === "downloading" || phase === "merging"
									})
								]
							}),
							onRemember && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: bili_panel_module_css_default.rememberRow,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: bili_panel_module_css_default.rememberHint,
										children: remembered ? "已记住 Cookie，下次打开自动填入" : "可在本机记住 Cookie，下次自动填入"
									}),
									rememberState === "saving" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: bili_panel_module_css_default.rememberHint,
										children: "保存中..."
									}),
									rememberState === "error" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: bili_panel_module_css_default.rememberErr,
										children: "保存失败"
									}),
									remembered ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: bili_panel_module_css_default.btnSmall,
										onClick: handleForget,
										disabled: rememberState === "saving",
										children: "清除已记住"
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: bili_panel_module_css_default.btnSmall,
										onClick: handleRemember,
										disabled: rememberState === "saving",
										children: "记住 Cookie"
									})
								]
							})
						]
					}),
					phase === "ready" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: bili_panel_module_css_default.fieldRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: bili_panel_module_css_default.label,
							children: "画质:"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							className: bili_panel_module_css_default.select,
							value: selectedPreset.label,
							onChange: (e) => {
								const preset = QUALITY_PRESETS.find((p) => p.label === e.target.value);
								if (preset) setSelectedPreset(preset);
							},
							children: QUALITY_PRESETS.map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("option", {
								value: p.label,
								children: [
									p.label,
									" — ",
									p.description
								]
							}, p.label))
						})]
					}),
					phase === "ready" && formats.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
						className: bili_panel_module_css_default.formatDetails,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", {
							className: bili_panel_module_css_default.formatSummary,
							children: [
								"可用格式 (",
								formats.length,
								" 个)"
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: bili_panel_module_css_default.formatList,
							children: formats.map((f) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: bili_panel_module_css_default.formatRow,
								children: formatLabel(f)
							}, f.id))
						})]
					}),
					phase === "ready" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: bili_panel_module_css_default.fieldRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							className: bili_panel_module_css_default.label,
							children: "保存位置:"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: bili_panel_module_css_default.input,
							type: "text",
							value: outputDir,
							onChange: (e) => setOutputDir(e.target.value),
							placeholder: "B 站下载（保存到桌面）"
						})]
					}),
					progress && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: bili_panel_module_css_default.progressSection,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: bili_panel_module_css_default.progressBar,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: bili_panel_module_css_default.progressFill,
								style: { width: `${progress.percent}%` }
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: bili_panel_module_css_default.progressText,
							children: phase === "merging" ? "正在合并音视频..." : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								progress.percent,
								"% — ",
								progress.speed,
								" — 剩余 ",
								progress.eta
							] })
						})]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: bili_panel_module_css_default.errorBox,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "错误:" }),
							" ",
							error
						]
					}),
					resultFile && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: bili_panel_module_css_default.resultBox,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "下载完成!" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: bili_panel_module_css_default.resultPath,
							children: resultFile
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: bili_panel_module_css_default.actions,
						children: [
							phase === "idle" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: bili_panel_module_css_default.btnPrimary,
								onClick: handleFetchInfo,
								disabled: checks.ytDlp === false,
								children: checks.ytDlp === null ? "检查环境中..." : "获取视频信息"
							}),
							phase === "fetching-info" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: bili_panel_module_css_default.btn,
								disabled: true,
								children: "获取中..."
							}),
							phase === "ready" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: bili_panel_module_css_default.btnPrimary,
								onClick: handleStart,
								children: "开始下载"
							}),
							(phase === "downloading" || phase === "merging") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: bili_panel_module_css_default.btnDanger,
								onClick: handleCancel,
								children: "取消下载"
							}),
							(phase === "done" || phase === "error") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: bili_panel_module_css_default.btn,
								onClick: handleReset,
								children: "重新开始"
							})
						]
					})
				]
			});
		};
		//#endregion
		//#region src/client/BiliSettingsCard.tsx
		/**
		* The Bilibili download plugin card for the settings page.
		*
		* Registers into the `web-ui.plugin.item` child slot the Web UI plugin group
		* declares. Hidden from the sidebar entirely: the card is the only entry
		* point. Clicking "open panel" mounts the download panel as a full-screen
		* modal (portal to body), so it reliably appears above the GUI.
		*/
		/**
		* Render the settings card; clicking its header expands the card, and the
		* open button mounts a full-screen modal.
		* @param props - locale reader, API client, and the cookie scope.
		*/
		const BiliSettingsCard = ({ t, api, cookieScope }) => {
			const [open, setOpen] = (0, react.useState)(false);
			const [panelOpen, setPanelOpen] = (0, react.useState)(false);
			const readSaved = (0, react.useCallback)(() => {
				const snapshot = cookieScope.getSnapshot();
				return snapshot.status === "ready" ? settingsToCookies(snapshot.value) : {
					SESSDATA: "",
					bili_jct: "",
					DedeUserID: ""
				};
			}, [cookieScope]);
			const saveCookies = (0, react.useCallback)(async (cookies) => {
				const settings = cookiesToSettings(cookies);
				await cookieScope.set("sessdata", settings.sessdata ?? "");
				await cookieScope.set("biliJct", settings.biliJct ?? "");
				await cookieScope.set("dedeUserID", settings.dedeUserID ?? "");
			}, [cookieScope]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: bili_panel_module_css_default.card,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: bili_panel_module_css_default.cardHeader,
					"aria-expanded": open,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: bili_panel_module_css_default.cardHeadText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: bili_panel_module_css_default.cardName,
							children: t("card.title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: bili_panel_module_css_default.cardDescription,
							children: t("card.description")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: open ? bili_panel_module_css_default.cardChevronOpen : bili_panel_module_css_default.cardChevron,
						children: "▾"
					})]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: bili_panel_module_css_default.cardBody,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: bili_panel_module_css_default.cardHint,
						children: t("card.hint")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: bili_panel_module_css_default.btnPrimary,
						onClick: () => {
							setPanelOpen(true);
						},
						children: t("card.open")
					})]
				}) : null]
			}), panelOpen ? (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: bili_panel_module_css_default.modalBackdrop,
				onClick: (event) => {
					if (event.target === event.currentTarget) setPanelOpen(false);
				},
				role: "dialog",
				"aria-modal": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: bili_panel_module_css_default.modal,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BiliDownloadPanel, {
						api,
						onClose: () => {
							setPanelOpen(false);
						},
						t,
						initialCookies: readSaved(),
						onRemember: saveCookies
					})
				})
			}), document.body) : null] });
		};
		//#endregion
		//#region src/client/locales.ts
		/** `bili-download` namespace dictionaries: the Bilibili download card copy. */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"card.title": "B 站视频下载",
			"card.description": "输入 B 站视频链接与登录 Cookie，选择画质，用本机 yt-dlp + ffmpeg 下载并显示进度。",
			"card.open": "打开下载面板",
			"card.hint": "不再占用侧边栏；需要下载时从设置页这里打开。",
			"modal.close": "关闭",
			"panel.title": "B 站视频下载",
			"panel.env.ytdlp": "yt-dlp",
			"panel.env.ffmpeg": "ffmpeg",
			"panel.env.ready": "就绪",
			"panel.env.missing": "未找到",
			"panel.env.checking": "检查中...",
			"panel.urlLabel": "视频链接",
			"panel.urlPlaceholder": "https://www.bilibili.com/video/BV... 或 https://b23.tv/...",
			"panel.cookieLabel": "Cookie",
			"panel.sessdata": "SESSDATA",
			"panel.biliJct": "bili_jct",
			"panel.dedeUserID": "DedeUserID",
			"panel.qualityLabel": "画质",
			"panel.outputLabel": "保存位置",
			"panel.outputPlaceholder": "B 站下载（保存到桌面）",
			"panel.availableFormats": "可用格式 ({count} 个)",
			"panel.fetchInfo": "获取视频信息",
			"panel.fetching": "获取中...",
			"panel.startDownload": "开始下载",
			"panel.cancelDownload": "取消下载",
			"panel.restart": "重新开始",
			"panel.merging": "正在合并音视频...",
			"panel.progress": "{percent}% — {speed} — 剩余 {eta}",
			"panel.error": "错误",
			"panel.done": "下载完成!",
			"panel.savePath": "文件已保存到:"
		};
		/** English dictionary (complete mirror). Keyed identically. */
		const en = {
			"card.title": "Bilibili Download",
			"card.description": "Enter a Bilibili video URL and login cookie, pick quality, then download with local yt-dlp + ffmpeg and watch progress. This entry no longer occupies the sidebar.",
			"card.open": "Open download panel",
			"card.hint": "Now hidden from the sidebar; open it here from settings when needed.",
			"modal.close": "Close",
			"panel.title": "Bilibili Download",
			"panel.env.ytdlp": "yt-dlp",
			"panel.env.ffmpeg": "ffmpeg",
			"panel.env.ready": "ready",
			"panel.env.missing": "missing",
			"panel.env.checking": "checking...",
			"panel.urlLabel": "Video URL",
			"panel.urlPlaceholder": "https://www.bilibili.com/video/BV... or https://b23.tv/...",
			"panel.cookieLabel": "Cookie",
			"panel.sessdata": "SESSDATA",
			"panel.biliJct": "bili_jct",
			"panel.dedeUserID": "DedeUserID",
			"panel.qualityLabel": "Quality",
			"panel.outputLabel": "Save to",
			"panel.outputPlaceholder": "B 站下载 (saved to Desktop)",
			"panel.availableFormats": "Available formats ({count})",
			"panel.fetchInfo": "Fetch video info",
			"panel.fetching": "Fetching...",
			"panel.startDownload": "Start download",
			"panel.cancelDownload": "Cancel",
			"panel.restart": "Restart",
			"panel.merging": "Merging audio/video...",
			"panel.progress": "{percent}% — {speed} — {eta} left",
			"panel.error": "Error",
			"panel.done": "Download complete!",
			"panel.savePath": "Saved to:"
		};
		//#endregion
		//#region src/client/index.ts
		/** Locale namespace this plugin owns. */
		const NS = "bili-download";
		/** Settings namespace of the remembered cookies (spelled here AND in the host half). */
		const COOKIE_NS = "bili-download";
		/** Required services. */
		const inject = [
			"slots",
			"locale",
			"settingsScope"
		];
		/**
		* Register the settings card.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "bili-download: dictionaries");
			const api = new BiliApi();
			const t = ctx.locale.bind(NS);
			const cookieScope = (ctx.get("webUiSettings") ?? ctx.settingsScope).bind({ namespace: COOKIE_NS });
			ctx.slots.inject("web-ui.plugin.item", () => ctx.slots.register({
				name: "web-ui.plugin.item",
				id: "bili-download",
				order: 90,
				locale: NS,
				inject: () => ({
					t,
					api,
					cookieScope
				})
			}, BiliSettingsCard));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map