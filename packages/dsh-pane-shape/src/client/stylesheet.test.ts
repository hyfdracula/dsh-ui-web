/**
 * 样式表的契约用例：把「门控权重」和「旋钮归皮肤所有」这两条约定钉死，
 * 因为它们都是靠权重算出来的，改动时不会报错、只会静默改观感。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./pane-shape.module.css', import.meta.url), 'utf8')

/** 注释里会引用外壳的类名子串做解释，判据只应看真正的声明。 */
const css = source.replace(/\/\*[\s\S]*?\*\//g, '')

/** 去掉注释后，按 `}` 切开粗粒度规则（本文件没有嵌套规则）。 */
const rules = css
  .split('}')
  .map(chunk => chunk.trim())
  .filter(chunk => chunk.length > 0)
  .map(chunk => {
    const brace = chunk.indexOf('{')
    return { selectors: chunk.slice(0, brace).split(',').map(s => s.trim()).filter(s => s.length > 0), body: chunk.slice(brace + 1) }
  })

const KNOBS = [
  '--dsh-pane-inset',
  '--dsh-pane-radius',
  '--dsh-pane-radius-flush',
  '--dsh-pane-blur',
  '--dsh-pane-fill',
  '--dsh-pane-hairline',
  '--dsh-pane-divider',
  '--dsh-pane-shadow',
]

describe('dsh-pane-shape 样式表', () => {
  it('旋钮声明在 [data-dsh-pane-shape]（0-1-0），皮肤才好用 0-2-0 覆盖', () => {
    const knobRule = rules.find(rule => rule.selectors.length === 1 && rule.selectors[0] === '[data-dsh-pane-shape]')
    expect(knobRule).toBeDefined()
    for (const knob of KNOBS) expect(knobRule?.body).toContain(`${knob}:`)
  })

  it('深色旋钮挂在 body[data-ds-dark-theme] 上（和皮肤自己的深色规则同址）', () => {
    const dark = rules.find(rule => rule.selectors.some(selector => selector === '[data-dsh-pane-shape] body[data-ds-dark-theme]'))
    expect(dark).toBeDefined()
    expect(dark?.body).toContain('--dsh-pane-fill:')
    expect(dark?.body).toContain('--dsh-pane-shadow:')
  })

  it('每个元素规则都门控在 :root[data-dsh-pane-shape]（0-2-0 + 钩子 = 0-3-0）', () => {
    const gated = rules.filter(rule => rule.selectors.some(selector => selector.startsWith(':root[data-dsh-pane-shape]')))
    const ungated = rules.filter(rule => !rule.body.includes('--dsh-pane-') && !rule.selectors.some(selector => selector.startsWith(':root[data-dsh-pane-shape]') || selector === '[data-dsh-pane-shape]' || selector === '[data-dsh-pane-shape] body[data-ds-dark-theme]'))
    expect(gated.length).toBeGreaterThanOrEqual(8)
    expect(ungated).toEqual([])
  })

  it('每个元素规则的每条选择器都带门控（不能只写一半）', () => {
    for (const rule of rules) {
      if (rule.body.includes('--dsh-pane-')) continue
      for (const selector of rule.selectors) {
        expect(selector.startsWith(':root[data-dsh-pane-shape]')).toBe(true)
      }
    }
  })

  it('设置面板的磨砂守卫在（backdrop-filter 会成为 fixed 后代的包含块）', () => {
    const guard = rules.find(rule => rule.selectors.some(selector => selector.includes(":has([aria-modal='true'])")))
    expect(guard).toBeDefined()
    expect(guard?.body).toContain('backdrop-filter: none')
    expect(guard?.selectors.every(selector => selector.startsWith(':root[data-dsh-pane-shape]'))).toBe(true)
  })

  it('分隔线用 --dsh-pane-divider、非停靠形态用 --dsh-pane-radius-flush', () => {
    const strip = rules.find(rule => rule.selectors.some(selector => selector.includes("[data-dockkit-strip]")))
    expect(strip?.body).toContain('var(--dsh-pane-divider)')
    const flush = rules.find(rule => rule.selectors.some(selector => selector.includes(':not([data-sidebar-right-panel=')))
    expect(flush?.body).toContain('var(--dsh-pane-radius-flush)')
  })

  it('只用官方钩子与本层自己的钩子，不碰哈希类名，也不需要 !important', () => {
    expect(css).not.toContain('!important')
    expect(css).not.toContain('[class*=')
    for (const rule of rules) {
      for (const selector of rule.selectors) {
        const attributes = selector.match(/\[[^\]]+\]/g) ?? []
        for (const attribute of attributes) {
          const name = attribute.slice(1).split(/[=\]]/)[0]!
          // `data-*` 是本层与官方外壳的稳定钩子；`aria-*` 是官方 ARIA 状态
          // （磨砂守卫要认 `aria-modal`）。两者都不是哈希类名。
          expect(name.startsWith('data-') || name.startsWith('aria-')).toBe(true)
        }
      }
    }
  })
})
