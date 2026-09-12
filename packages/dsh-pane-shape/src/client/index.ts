/**
 * dsh-pane-shape — 浏览器半区。
 *
 * 只做两件事：
 *  1. 在 <html> 上贴 `data-dsh-pane-shape`（样式层的门控；卸载时移除，回到原样）；
 *  2. 给外壳元素贴本层需要的稳定钩子——外壳的列类名带哈希前缀，皮肤只认稳定属性。
 *
 * 没有 UI、没有服务依赖：它是一层样式 + 一个贴钩子的观察器。
 * @module @captain1275/dsh-pane-shape/client
 */
import type { Context } from '@deepseek-ai/cordis'
import './pane-shape.module.css'

/** <html> 上的门控属性。 */
export const ROOT_ATTRIBUTE = 'data-dsh-pane-shape'

interface Seam {
  readonly attribute: string
  readonly selector: string
  readonly first?: boolean
}

/** 本层需要的元素钩子（全部来自稳定子串或官方 data-*，不碰哈希类名本身）。 */
export const SEAMS: readonly Seam[] = [
  // 左栏列（外壳的 `*sidebarCol` 类名带哈希前缀，只取稳定子串）。
  { attribute: 'data-dsh-pane-shape-col', selector: '[class*="sidebarCol"]', first: true },
  // 品牌行（顶部那行 logo 按钮），用于把顶行提到与另外两块齐平。
  { attribute: 'data-dsh-pane-shape-brand', selector: '[class*="sidebarCol"] [class*="brand"]', first: true },
]

function stamp(seam: Seam): void {
  if (seam.first) {
    const element = document.querySelector(seam.selector)
    if (element !== null && !element.hasAttribute(seam.attribute)) element.setAttribute(seam.attribute, '')
    return
  }
  for (const element of document.querySelectorAll(seam.selector)) {
    if (!element.hasAttribute(seam.attribute)) element.setAttribute(seam.attribute, '')
  }
}

function stampAll(): void {
  for (const seam of SEAMS) stamp(seam)
}

/**
 * 开启形状层：贴门控属性、贴钩子，并在 React 重挂载节点时补回。
 * @param ctx - 宿主上下文（只需要 effect 生命周期，无服务依赖）。
 */
export function apply(ctx: Context): void {
  const root = document.documentElement
  root.setAttribute(ROOT_ATTRIBUTE, '')
  stampAll()
  const observer = new MutationObserver(() => { stampAll() })
  observer.observe(root, { childList: true, subtree: true })

  ctx.effect(() => () => {
    observer.disconnect()
    for (const seam of SEAMS) {
      for (const element of document.querySelectorAll(`[${seam.attribute}]`)) element.removeAttribute(seam.attribute)
    }
    root.removeAttribute(ROOT_ATTRIBUTE)
  }, 'pane-shape.layer')
}
