/**
 * 浏览器半区的用例：门控属性、两个钩子、React 重挂载后的补钩、卸载时的还原。
 *
 * 这里用一个极小的 DOM 替身而不是 jsdom：`apply()` 只用到 4 个 DOM 能力
 * （documentElement 的 set/removeAttribute、querySelector、querySelectorAll、
 * MutationObserver），替身不必实现 CSS 匹配——`querySelectorAll` 只按属性存在与否
 * 过滤预先登记的节点，这正是清理代码唯一的用法。
 */
import { describe, expect, it } from 'vitest'
import { ROOT_ATTRIBUTE, SEAMS, apply } from './index.ts'

class FakeElement {
  readonly attributes = new Set<string>()
  constructor(readonly label: string) {}
  hasAttribute(name: string): boolean { return this.attributes.has(name) }
  getAttribute(name: string): string | null { return this.attributes.has(name) ? '' : null }
  setAttribute(name: string): void { this.attributes.add(name) }
  removeAttribute(name: string): void { this.attributes.delete(name) }
}

/** 登记「选择器 -> 节点」，并按 CSS 属性选择器 `[name]` 支持 querySelectorAll。 */
class FakeDocument {
  readonly documentElement = new FakeElement('html')
  private readonly registry = new Map<string, FakeElement[]>()
  private readonly all: FakeElement[] = []
  register(selector: string, ...elements: FakeElement[]): void {
    this.registry.set(selector, elements)
    for (const element of elements) if (!this.all.includes(element)) this.all.push(element)
  }
  querySelector(selector: string): FakeElement | null {
    return this.registry.get(selector)?.[0] ?? null
  }
  querySelectorAll(selector: string): FakeElement[] {
    const attribute = /^\[([^\]]+)\]$/.exec(selector)
    if (attribute === null) throw new Error(`替身只支持属性选择器，收到 ${selector}`)
    return this.all.filter(element => element.hasAttribute(attribute[1]!))
  }
}

class FakeObserver {
  static last: FakeObserver | null = null
  callback: (() => void) | null = null
  readonly observed: unknown[] = []
  disconnected = false
  constructor(callback: () => void) { this.callback = callback; FakeObserver.last = this }
  observe(target: unknown): void { this.observed.push(target) }
  disconnect(): void { this.disconnected = true }
  fire(): void { this.callback?.() }
}

function harness(): {
  document: FakeDocument
  column: FakeElement
  brand: FakeElement
  dispose: () => void
} {
  const document = new FakeDocument()
  const column = new FakeElement('column')
  const brand = new FakeElement('brand')
  document.register(SEAMS[0]!.selector, column)
  document.register(SEAMS[1]!.selector, brand)
  const previousDocument = globalThis.document
  const previousObserver = globalThis.MutationObserver
  globalThis.document = document as unknown as Document
  globalThis.MutationObserver = FakeObserver as unknown as typeof MutationObserver
  let dispose = (): void => {}
  apply({ effect: (callback: () => () => void) => { dispose = callback() } } as never)
  const restore = (): void => {
    globalThis.document = previousDocument
    globalThis.MutationObserver = previousObserver
  }
  return { document, column, brand, dispose: () => { dispose(); restore() } }
}

describe('dsh-pane-shape 浏览器半区', () => {
  it('把门控贴到 <html>，并给每个钩子贴属性', () => {
    const { document, column, brand, dispose } = harness()
    try {
      expect(document.documentElement.hasAttribute(ROOT_ATTRIBUTE)).toBe(true)
      expect(column.hasAttribute('data-dsh-pane-shape-col')).toBe(true)
      expect(brand.hasAttribute('data-dsh-pane-shape-brand')).toBe(true)
    } finally {
      dispose()
    }
  })

  it('钩子属性值是空串（CSS 只按存在与否匹配）', () => {
    const { column, dispose } = harness()
    try {
      expect(column.getAttribute('data-dsh-pane-shape-col')).toBe('')
    } finally {
      dispose()
    }
  })

  it('观察 <html> 的子树变化，并在重挂载后补回钩子', () => {
    const { document, column, dispose } = harness()
    try {
      const observer = FakeObserver.last
      expect(observer).not.toBeNull()
      expect(observer?.observed).toEqual([document.documentElement])
      column.removeAttribute('data-dsh-pane-shape-col')
      expect(column.hasAttribute('data-dsh-pane-shape-col')).toBe(false)
      observer?.fire()
      expect(column.hasAttribute('data-dsh-pane-shape-col')).toBe(true)
    } finally {
      dispose()
    }
  })

  it('卸载时摘掉门控与全部钩子，并断开观察器', () => {
    const { document, column, brand, dispose } = harness()
    const observer = FakeObserver.last
    dispose()
    expect(document.documentElement.hasAttribute(ROOT_ATTRIBUTE)).toBe(false)
    expect(column.hasAttribute('data-dsh-pane-shape-col')).toBe(false)
    expect(brand.hasAttribute('data-dsh-pane-shape-brand')).toBe(false)
    expect(observer?.disconnected).toBe(true)
  })

  it('钩子表只认稳定属性/子串，不碰哈希类名', () => {
    expect(SEAMS.length).toBeGreaterThan(0)
    for (const seam of SEAMS) {
      expect(seam.attribute.startsWith('data-dsh-pane-shape')).toBe(true)
      expect(seam.selector).toContain('[class*="')
      expect(seam.selector).not.toMatch(/\.[A-Za-z0-9_-]{6,}_/)
    }
  })
})
