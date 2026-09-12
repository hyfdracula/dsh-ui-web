window.__ModuleLoader__.load({
	id: "@captain1275/dsh-client-ui-skin-aurora",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0dsh-css:C:\Users\19161\Documents\dsh-work\packages\skins\aurora\src\client\aurora.module.css.mjs
		const css = "body[data-dsh-aurora]{--dsw-alias-bg-base:#05081a47;--dsw-specific-sidebar-fill:#05081a59;--dsw-specific-input-major:#080a166b;--dsw-specific-sidebar-nav-item-hover:#ffffff14;--dsw-specific-sidebar-nav-item-active:#7aa2ff2e;--dsw-alias-bg-layer-1:#0a0c1899;--dsw-alias-bg-layer-2:#0e112085;--dsw-alias-bg-layer-3:#12162873;--dsw-alias-bg-overlay:#03040a8c;--dsw-alias-bg-mask-1:#03040a6b;--dsw-alias-fill-l2:#ffffff0d;--dsw-alias-interactive-bg-hover:#7aa2ff1f;--dsw-alias-interactive-bg-primary:#7aa2ff33;--dsw-alias-border-l1:#8ca0ff24;--dsw-alias-border-l2:#8ca0ff38;--dsw-alias-label-primary:#eef1ff;--dsw-alias-label-secondary:#b9c2e8;--dsw-alias-label-tertiary:#8b95c4;--dsw-alias-label-error:#ff7a8a;--dsw-alias-brand-primary:#7aa2ff;--dsw-alias-button-primary-fill:#4f6ef7;--dsw-alias-button-primary-hover:#3d5be0}body[data-dsh-aurora]:not([data-ds-dark-theme]){--dsw-alias-bg-base:#fafcff52;--dsw-specific-sidebar-fill:#fafcff66;--dsw-specific-input-major:#fafcff80;--dsw-specific-sidebar-nav-item-hover:#0f142d0f;--dsw-specific-sidebar-nav-item-active:#3b5bd824;--dsw-alias-bg-layer-1:#fff9;--dsw-alias-bg-layer-2:#ffffff80;--dsw-alias-bg-layer-3:#ffffff6b;--dsw-alias-bg-overlay:#fafcff99;--dsw-alias-bg-mask-1:#fafcff8c;--dsw-alias-fill-l2:#0f142d0d;--dsw-alias-interactive-bg-hover:#3b5bd81a;--dsw-alias-interactive-bg-primary:#3b5bd829;--dsw-alias-border-l1:#141e501f;--dsw-alias-border-l2:#141e5033;--dsw-alias-label-primary:#232842;--dsw-alias-label-secondary:#5a6180;--dsw-alias-label-tertiary:#8b92ad;--dsw-alias-label-error:#c62828;--dsw-alias-brand-primary:#3b5bd8;--dsw-alias-button-primary-fill:#3b5bd8;--dsw-alias-button-primary-hover:#2f4ac4}body[data-dsh-aurora][data-ds-dark-theme]{--aion-bg-base:#05081a4d;--aion-bg-1:#05081a59;--aion-bg-2:#05081a4d;--aion-bg-3:#8ca0ff29;--aion-bg-hover:#ffffff0f;--aion-bg-active:#ffffff1a;--aion-fill-2:#ffffff0f;--aion-fill-3:#ffffff1a;--aion-border-base:#8ca0ff29}body[data-dsh-aurora]:not([data-ds-dark-theme]){--aion-bg-base:#fafcff59;--aion-bg-1:#fafcff66;--aion-bg-2:#fafcff59;--aion-bg-3:#141e501f;--aion-bg-hover:#0f142d0f;--aion-bg-active:#0f142d1a;--aion-fill-2:#0f142d0d;--aion-fill-3:#0f142d14;--aion-border-base:#141e5024}.uL7t8a_auroraBackdrop{z-index:-1;pointer-events:none;background-position:50%;background-repeat:no-repeat;background-size:cover;background-attachment:fixed;position:fixed;inset:0}.uL7t8a_auroraVideo{object-fit:cover;width:100%;height:100%;position:absolute;inset:0}body[data-dsh-aurora] [data-dsh-taskboard-entry],body[data-dsh-aurora] [data-dsh-ssh-entry]{margin-top:4px;background:0 0!important}body[data-dsh-aurora] [data-dsh-taskboard-entry]+[data-dsh-ssh-entry],body[data-dsh-aurora] [data-dsh-ssh-entry]+[data-dsh-taskboard-entry]{margin-top:6px}body[data-dsh-aurora] button[class*=newSession]{border-color:var(--dsw-alias-border-l2);background:0 0}body[data-dsh-aurora] button[class*=newSession]:hover{background:var(--dsw-alias-interactive-bg-hover)}body[data-dsh-aurora] [data-composer-card]{-webkit-backdrop-filter:blur(30px);background:#1019266b;border:1px solid #ffffff14;box-shadow:0 8px 32px #0000004d,inset 0 1px #ffffff0f}body[data-dsh-aurora]:not([data-ds-dark-theme]) [data-composer-card]{-webkit-backdrop-filter:blur(30px);background:#ffffff73;border:1px solid #fff9;box-shadow:0 8px 32px #141e5024,inset 0 1px #fffc}body[data-dsh-aurora] [class*=triggerEffort]:before{content:\"· \";margin-right:1px}body[data-dsh-aurora] [class*=triggerEffort]{color:var(--dsw-alias-label-secondary,#b9c2e8);font-weight:600}body[data-dsh-aurora] [class*=userRow] [class*=bubble]{-webkit-backdrop-filter:blur(14px);background:#5e7cff3d;border:1px solid #8ca0ff2e}body[data-dsh-aurora]:not([data-ds-dark-theme]) [class*=userRow] [class*=bubble]{background:#ffffff6b;border:1px solid #141e5024}.uL7t8a_auroraCard{flex-direction:column;gap:8px;padding:2px 0;display:flex}.uL7t8a_auroraCardHead{justify-content:space-between;align-items:center;gap:10px;display:flex}.uL7t8a_auroraCardTitle{color:var(--dsw-alias-label-primary,#eee);font-size:14px;font-weight:600}.uL7t8a_auroraCardDesc{color:var(--dsw-alias-label-tertiary,#888);margin:0;font-size:12px}.uL7t8a_auroraCardBody{flex-direction:column;gap:8px;display:flex}.uL7t8a_auroraField{color:var(--dsw-alias-label-secondary,#999);flex-direction:column;gap:3px;font-size:12px;display:flex}.uL7t8a_auroraField input[type=text]{border:1px solid var(--dsw-alias-border-l2,#80808059);background:var(--dsw-alias-bg-layer-2,#80808026);color:var(--dsw-alias-label-primary,#eee);border-radius:6px;padding:4px 8px;font-size:12px}.uL7t8a_auroraField input[type=range]{accent-color:var(--dsw-alias-brand-primary,#7aa2ff)}.uL7t8a_auroraSwitch{background:var(--dsw-alias-fill-l2,#333);cursor:pointer;border:0;border-radius:999px;flex:none;width:34px;height:18px;padding:0;transition:background .15s;position:relative}.uL7t8a_auroraSwitchOn{background:var(--dsw-alias-brand-primary,#7aa2ff)}.uL7t8a_auroraSwitchThumb{background:#fff;border-radius:50%;width:14px;height:14px;transition:transform .15s;position:absolute;top:2px;left:2px}.uL7t8a_auroraSwitchOn .uL7t8a_auroraSwitchThumb{transform:translate(16px)}.uL7t8a_auroraLocal{align-items:center;gap:8px;font-size:12px;display:flex}.uL7t8a_auroraLocalLabel{color:var(--dsw-alias-label-secondary,#999)}.uL7t8a_auroraLocalThumb{border:1px solid var(--dsw-alias-border-l2,#80808059);background-position:50%;background-size:cover;border-radius:6px;flex:none;width:64px;height:36px}.uL7t8a_auroraBtn{border:1px solid var(--dsw-alias-border-l2,#80808059);background:var(--dsw-alias-bg-layer-2,#80808026);color:var(--dsw-alias-label-secondary,#bbb);cursor:pointer;border-radius:6px;padding:4px 10px;font-size:12px}.uL7t8a_auroraBtn:hover{background:var(--dsw-alias-interactive-bg-hover,#80808033);color:var(--dsw-alias-label-primary,#eee)}";
		const tagId = "@captain1275/dsh-client-ui-skin-aurora/aurora.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@captain1275/dsh-client-ui-skin-aurora";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var aurora_module_css_default = {
			"auroraBackdrop": "uL7t8a_auroraBackdrop",
			"auroraBtn": "uL7t8a_auroraBtn",
			"auroraCard": "uL7t8a_auroraCard",
			"auroraCardBody": "uL7t8a_auroraCardBody",
			"auroraCardDesc": "uL7t8a_auroraCardDesc",
			"auroraCardHead": "uL7t8a_auroraCardHead",
			"auroraCardTitle": "uL7t8a_auroraCardTitle",
			"auroraField": "uL7t8a_auroraField",
			"auroraLocal": "uL7t8a_auroraLocal",
			"auroraLocalLabel": "uL7t8a_auroraLocalLabel",
			"auroraLocalThumb": "uL7t8a_auroraLocalThumb",
			"auroraSwitch": "uL7t8a_auroraSwitch",
			"auroraSwitchOn": "uL7t8a_auroraSwitchOn",
			"auroraSwitchThumb": "uL7t8a_auroraSwitchThumb",
			"auroraVideo": "uL7t8a_auroraVideo"
		};
		//#endregion
		//#region src/client/index.ts
		/** 配置变更事件（皮肤中心卡片写入后派发，本半区监听重绘）。 */
		const AURORA_EVENT = "dshc-aurora-config";
		const DEFAULTS = {
			enabled: true,
			backgroundUrl: "",
			opacity: .8,
			blur: 0,
			mediaType: "image",
			muted: true
		};
		let cached = { ...DEFAULTS };
		/** 从宿主路由拉取最新配置（失败时沿用缓存）。 */
		async function fetchConfig() {
			try {
				const data = await (await fetch("/api/skin-aurora/config")).json();
				if (data?.ok === true && data.config !== void 0) cached = {
					enabled: typeof data.config.enabled === "boolean" ? data.config.enabled : DEFAULTS.enabled,
					backgroundUrl: typeof data.config.backgroundUrl === "string" ? data.config.backgroundUrl : DEFAULTS.backgroundUrl,
					opacity: typeof data.config.opacity === "number" ? data.config.opacity : DEFAULTS.opacity,
					blur: typeof data.config.blur === "number" ? data.config.blur : DEFAULTS.blur,
					mediaType: data.config.mediaType === "video" ? "video" : "image",
					muted: typeof data.config.muted === "boolean" ? data.config.muted : DEFAULTS.muted
				};
			} catch {}
			return cached;
		}
		/** 解析一个模块类名（css-modules 记录按字面量名索引）。 */
		const cls = (name) => aurora_module_css_default[name] ?? "";
		function cssEscape(url) {
			return url.replace(/["\\]/g, "\\$&");
		}
		/** 深色极光渐变（深色模式默认背景）。 */
		function auroraGradient(dark) {
			return dark ? [
				"radial-gradient(1200px 800px at 15% 8%, rgba(90,120,255,0.38), transparent 60%)",
				"radial-gradient(1000px 700px at 85% 18%, rgba(0,200,180,0.24), transparent 55%)",
				"radial-gradient(800px 700px at 60% 115%, rgba(160,80,255,0.15), transparent 60%)",
				"linear-gradient(180deg, #05081a 0%, #0c1234 55%, #111736 100%)"
			].join(",") : [
				"radial-gradient(1200px 800px at 15% 8%, rgba(90,130,255,0.30), transparent 60%)",
				"radial-gradient(1000px 700px at 85% 18%, rgba(0,180,170,0.20), transparent 55%)",
				"radial-gradient(900px 900px at 60% 100%, rgba(150,90,255,0.22), transparent 60%)",
				"linear-gradient(180deg, #f2f5ff 0%, #e4ebfb 55%, #ece7fb 100%)"
			].join(",");
		}
		/**
		* 应用 aurora 皮肤：body 属性 + 自定义背景层（配置驱动，经路由读取、事件联动）。
		* 所有写入由 ctx.effect 的 disposer 在卸载时回收。
		* @param ctx - 宿主上下文（effect 生命周期负责回收）。
		*/
		function apply(ctx) {
			const body = document.body;
			body.dataset.dshAurora = "";
			let backdrop = null;
			let videoEl = null;
			let videoSrc = "";
			const renderBackdrop = (cfg) => {
				if (backdrop !== null && backdrop.isConnected && cfg.enabled && cfg.backgroundUrl === videoSrc) {
					backdrop.style.opacity = String(cfg.opacity);
					backdrop.style.filter = cfg.blur > 0 ? `blur(${cfg.blur}px)` : "none";
					if (videoEl !== null && cfg.mediaType === "video") videoEl.muted = cfg.muted;
					return;
				}
				backdrop?.remove();
				backdrop = null;
				videoEl = null;
				videoSrc = "";
				if (!cfg.enabled) return;
				const dark = body.dataset.dsDarkTheme !== void 0;
				const layer = document.createElement("div");
				layer.className = cls("auroraBackdrop");
				layer.style.opacity = String(cfg.opacity);
				layer.style.filter = cfg.blur > 0 ? `blur(${cfg.blur}px)` : "none";
				if (cfg.backgroundUrl && cfg.mediaType === "video") {
					const video = document.createElement("video");
					video.src = cfg.backgroundUrl;
					video.autoplay = true;
					video.muted = cfg.muted;
					video.loop = true;
					video.playsInline = true;
					video.setAttribute("playsinline", "");
					video.className = cls("auroraVideo");
					layer.appendChild(video);
					videoEl = video;
					videoSrc = cfg.backgroundUrl;
				} else layer.style.backgroundImage = cfg.backgroundUrl ? `url("${cssEscape(cfg.backgroundUrl)}")` : auroraGradient(dark);
				body.appendChild(layer);
				backdrop = layer;
			};
			const refresh = () => {
				fetchConfig().then((cfg) => renderBackdrop(cfg));
			};
			const onConfig = () => refresh();
			window.addEventListener(AURORA_EVENT, onConfig);
			const observer = new MutationObserver(refresh);
			observer.observe(body, {
				attributes: true,
				attributeFilter: ["data-ds-dark-theme"]
			});
			refresh();
			ctx.effect(() => () => {
				delete body.dataset.dshAurora;
				observer.disconnect();
				window.removeEventListener(AURORA_EVENT, onConfig);
				backdrop?.remove();
				backdrop = null;
			}, "ui-skin-aurora: backdrop");
		}
		//#endregion
		exports.AURORA_EVENT = AURORA_EVENT;
		exports.apply = apply;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map