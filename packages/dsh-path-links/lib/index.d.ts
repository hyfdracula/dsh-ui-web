/** 切分结果：一段普通文本或一个路径 token。 */
export type PathToken = { path: string } | { text: string }

/**
 * 把文本里的 Windows 绝对路径切分成独立 token。
 * @param text - 原始文本。
 * @returns 有序 token 列表；路径段保留真实路径，其余为文本段。
 */
export declare function splitPathTokens(text: string): PathToken[]
