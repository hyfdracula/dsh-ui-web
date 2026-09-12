window.__ModuleLoader__.load({
	id: "@captain1275/dsh-path-links",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region src/index.ts
		/**
		* 裸路径尾部标点裁剪（半角 + 全角）。只对裸路径分支生效——带引号路径
		* 是"复制为路径"语义，引号内逐字保留，连 ! 都不裁。
		*/
		const TRAILING = /[.,;:!?)\]}…！？，。；：、）》】」』'"]+$/;
		/**
		* Windows 绝对路径识别。
		* - 带引号分支："C:\…" / "\\server\share\…"，引号内逐字保留（verbatim）。
		* - 裸路径分支：盘符前要求词边界（防止 abcC:\x 拦腰误链）；字符集排除
		*   CJK 表意文字与全角字符（防止吞掉紧随的中文行文；含中文的裸路径请
		*   带引号粘贴）；排除 \\?\ \\.\ 设备前缀。
		*/
		const PATH_RE = /"((?:[A-Za-z]:[\\/]|\\\\(?![?\\]))[^"\r\n]+)"|(?<![\p{L}\p{N}:_\\/])((?:[A-Za-z]:[\\/]|\\\\(?![?\\]))[^\s"'<>|*?\r\n　-〿㐀-䶿一-鿿豈-﫿＀-ｅ]+)/gu;
		/**
		* 把文本里的 Windows 绝对路径切分成独立 token。
		* @param text - 原始文本。
		* @returns 有序 token 列表；路径段保留真实路径，其余为文本段。
		*/
		function splitPathTokens(text) {
			const out = [];
			let cursor = 0;
			let m;
			while ((m = PATH_RE.exec(text)) !== null) {
				const full = m[0];
				const quoted = m[1];
				const path = quoted !== void 0 ? quoted : (m[2] ?? "").replace(TRAILING, "");
				if (path.length === 0) continue;
				const pathStart = full.indexOf(path);
				if (m.index > cursor) out.push({ text: text.slice(cursor, m.index) });
				if (pathStart > 0) out.push({ text: full.slice(0, pathStart) });
				out.push({ path });
				const after = full.slice(pathStart + path.length);
				if (after.length > 0) out.push({ text: after });
				cursor = m.index + full.length;
			}
			if (cursor < text.length) out.push({ text: text.slice(cursor) });
			if (out.length === 0) out.push({ text });
			return out;
		}
		//#endregion
		exports.splitPathTokens = splitPathTokens;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map