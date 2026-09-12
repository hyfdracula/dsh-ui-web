window.__ModuleLoader__.load({
	id: "@captain1275/dsh-pane-shape",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0dsh-css:C:\Users\19161\Documents\dsh-work\packages\dsh-pane-shape\src\client\pane-shape.module.css.mjs
		const css = "[data-dsh-pane-shape]{--dsh-pane-inset:12px;--dsh-pane-radius:24px;--dsh-pane-radius-flush:18px;--dsh-pane-blur:14px;--dsh-pane-fill:#ffffff8c;--dsh-pane-hairline:#132d5338;--dsh-pane-divider:#132d531f;--dsh-pane-shadow:0 8px 28px #132d531a}[data-dsh-pane-shape] body[data-ds-dark-theme]{--dsh-pane-fill:#1c20288c;--dsh-pane-hairline:#94b4dc4d;--dsh-pane-divider:#94b4dc29;--dsh-pane-shadow:0 8px 28px #02060e66}:root[data-dsh-pane-shape] [data-phase] header,:root[data-dsh-pane-shape] [data-dsh-pane-shape-col],:root[data-dsh-pane-shape] [data-sidebar-right-panel=push]{border-radius:var(--dsh-pane-radius)}:root[data-dsh-pane-shape] [data-sidebar-right-panel]{background:var(--dsh-pane-fill);border-left:1px solid var(--dsh-pane-hairline);backdrop-filter:blur(var(--dsh-pane-blur))}:root[data-dsh-pane-shape] [data-sidebar-right-panel] [data-dockkit-surface],:root[data-dsh-pane-shape] [data-sidebar-right-panel] [data-dockkit-pane]{background:0 0}:root[data-dsh-pane-shape] [data-sidebar-right-panel] [data-dockkit-strip]{border-bottom:1px solid var(--dsh-pane-divider)}:root[data-dsh-pane-shape] [data-sidebar-right-panel]:not([data-sidebar-right-panel=push]){border-radius:var(--dsh-pane-radius-flush) 0 0 var(--dsh-pane-radius-flush)}:root[data-dsh-pane-shape] [data-sidebar-right-panel=push]{inset:var(--dsh-pane-inset) var(--dsh-pane-inset) var(--dsh-pane-inset) auto;height:auto;box-shadow:var(--dsh-pane-shadow);margin:0}:root[data-dsh-pane-shape] [data-dsh-pane-shape-col]{backdrop-filter:blur(var(--dsh-pane-blur));box-shadow:var(--dsh-pane-shadow);padding-top:0}:root[data-dsh-pane-shape] [data-dsh-pane-shape-col]:has([aria-modal=true]){backdrop-filter:none}:root[data-dsh-pane-shape] [data-dsh-pane-shape-col]>*>:first-child{padding-top:0}:root[data-dsh-pane-shape] [data-dsh-pane-shape-brand]{margin-top:-13px}";
		const tagId = "@captain1275/dsh-pane-shape/pane-shape.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@captain1275/dsh-pane-shape";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region src/client/index.ts
		/** <html> 上的门控属性。 */
		const ROOT_ATTRIBUTE = "data-dsh-pane-shape";
		/** 本层需要的元素钩子（全部来自稳定子串或官方 data-*，不碰哈希类名本身）。 */
		const SEAMS = [{
			attribute: "data-dsh-pane-shape-col",
			selector: "[class*=\"sidebarCol\"]",
			first: true
		}, {
			attribute: "data-dsh-pane-shape-brand",
			selector: "[class*=\"sidebarCol\"] [class*=\"brand\"]",
			first: true
		}];
		function stamp(seam) {
			if (seam.first) {
				const element = document.querySelector(seam.selector);
				if (element !== null && !element.hasAttribute(seam.attribute)) element.setAttribute(seam.attribute, "");
				return;
			}
			for (const element of document.querySelectorAll(seam.selector)) if (!element.hasAttribute(seam.attribute)) element.setAttribute(seam.attribute, "");
		}
		function stampAll() {
			for (const seam of SEAMS) stamp(seam);
		}
		/**
		* 开启形状层：贴门控属性、贴钩子，并在 React 重挂载节点时补回。
		* @param ctx - 宿主上下文（只需要 effect 生命周期，无服务依赖）。
		*/
		function apply(ctx) {
			const root = document.documentElement;
			root.setAttribute(ROOT_ATTRIBUTE, "");
			stampAll();
			const observer = new MutationObserver(() => {
				stampAll();
			});
			observer.observe(root, {
				childList: true,
				subtree: true
			});
			ctx.effect(() => () => {
				observer.disconnect();
				for (const seam of SEAMS) for (const element of document.querySelectorAll(`[${seam.attribute}]`)) element.removeAttribute(seam.attribute);
				root.removeAttribute(ROOT_ATTRIBUTE);
			}, "pane-shape.layer");
		}
		//#endregion
		exports.ROOT_ATTRIBUTE = ROOT_ATTRIBUTE;
		exports.SEAMS = SEAMS;
		exports.apply = apply;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map