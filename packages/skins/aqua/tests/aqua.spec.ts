// @vitest-environment jsdom
/**
 * Aqua skin tests: the manifest contract, the dictionary parity the settings
 * rows rely on, and the runtime seam stamper that keeps the stylesheet's
 * `data-dsh-*` hooks attached to whatever the shell renders.
 * @module skin
 */
import { afterEach, describe, expect, it } from 'vitest'
import skin from '../skin.json'
import { en, NS, zh } from '../src/client/locales.ts'
import { startSeamStamper } from '../src/client/seam-stamper.ts'
import { startWordmarkBadge } from '../src/client/wordmark-badge.ts'
import { AQUA_ATTRIBUTE, AQUA_ENABLED_KEY, AquaLayer, DEFAULT_ENABLED } from '../src/client/theme-layer.ts'

/**
 * The skin center's try-on context: a minimal stage host that implements only
 * `effect` and `get`, exactly like packages/skins/skin-center/src/client/try-on.ts.
 */
function stageHost(): { host: { effect(callback: () => () => void): () => void; get(): undefined }; disposeAll: () => void } {
  const disposers: Array<() => void> = []
  return {
    host: {
      effect(callback) {
        disposers.push(callback())
        return () => {}
      },
      get() {
        return undefined
      },
    },
    disposeAll() {
      for (const dispose of disposers.reverse()) dispose()
    },
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.removeAttribute(AQUA_ATTRIBUTE)
  document.documentElement.removeAttribute('data-dsh-float')
  document.documentElement.removeAttribute('data-dsh-compat')
  document.documentElement.removeAttribute('style')
  localStorage.clear()
})

describe('skin manifest', () => {
  it('carries the identity the registry, the bundle row, and the gallery read', () => {
    expect(skin.id).toBe('aqua')
    expect(skin.package).toBe('@captain1275/dsh-client-ui-skin-aqua')
    expect(skin.bodyAttr).toBe(AQUA_ATTRIBUTE)
    expect(skin.wiring.id).toBe('ui-skin-aqua')
    expect(skin.preview.light).toContain('packages/skins/aqua/preview/light.png')
    expect(skin.preview.dark).toContain('packages/skins/aqua/preview/dark.png')
  })
})

describe('dictionaries', () => {
  it('keeps the English dictionary a complete mirror of the Chinese key set', () => {
    expect(NS).toBe('settings.aqua')
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })

  it('carries no emoji (repository rule)', () => {
    const emoji = /[\u{FE0F}\u{200D}\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]/u
    for (const value of [...Object.values(zh), ...Object.values(en)]) {
      expect(emoji.test(value)).toBe(false)
    }
  })
})

describe('layer constants', () => {
  it('gates the stylesheet on the html attribute and defaults to on', () => {
    expect(AQUA_ATTRIBUTE).toBe('data-dsh-aqua')
    // The storage key is carried over from the checkout-era plugin verbatim, so
    // an existing Aqua user keeps every knob (same origin, same localStorage).
    expect(AQUA_ENABLED_KEY).toBe('dsh.ui-aqua.enabled')
    expect(DEFAULT_ENABLED).toBe(true)
  })
})

describe('stage mount (skin-center try-on)', () => {
  it('applies the layer with inline tokens and restores everything on dispose', () => {
    const { host, disposeAll } = stageHost()
    new AquaLayer(host, { stage: true })

    expect(document.documentElement.hasAttribute(AQUA_ATTRIBUTE)).toBe(true)
    expect(document.documentElement.hasAttribute('data-dsh-float')).toBe(true)
    // No theme service on a stage host: the palette rides inline custom
    // properties on <html> instead of the theme override stack.
    expect(document.documentElement.style.getPropertyValue('--dsw-alias-bg-base')).not.toBe('')
    expect(document.documentElement.style.getPropertyValue('--dsh-aqua-blur')).toBe('2px')
    // An ephemeral mount never writes the durable preference back.
    expect(localStorage.getItem(AQUA_ENABLED_KEY)).toBeNull()

    disposeAll()
    expect(document.documentElement.hasAttribute(AQUA_ATTRIBUTE)).toBe(false)
    expect(document.documentElement.style.getPropertyValue('--dsw-alias-bg-base')).toBe('')
  })

  it('honours the disabled preference on the boot-graph path', () => {
    localStorage.setItem(AQUA_ENABLED_KEY, 'false')
    const { host, disposeAll } = stageHost()
    new AquaLayer(host)
    expect(document.documentElement.hasAttribute(AQUA_ATTRIBUTE)).toBe(false)
    disposeAll()
  })
})

describe('wordmark badge', () => {
  it('swaps the stock 0.1.1 HARNESS plate for the official pill in dark mode', () => {
    document.body.innerHTML = `<button data-dsh-wordmark><svg viewBox="0 0 182 24">
      <rect x="129.348" y="5.5" width="52" height="14"></rect><g clip-path="url(#badge)"></g></svg></button>`
    const handle = startWordmarkBadge(true)
    expect(document.querySelectorAll('[data-dsh-aqua-harness-badge]').length).toBe(1)
    expect(document.querySelector('rect[x="129.348"]')?.hasAttribute('data-dsh-aqua-badge-hidden')).toBe(true)
    handle.dispose()
    expect(document.querySelectorAll('[data-dsh-aqua-harness-badge]').length).toBe(0)
    expect(document.querySelector('rect[x="129.348"]')?.hasAttribute('data-dsh-aqua-badge-hidden')).toBe(false)
  })

  it('leaves the 0.1.5 whale wordmark alone (no plate to replace)', () => {
    document.body.innerHTML = '<button data-dsh-wordmark><svg viewBox="0 0 23.16 17.04"><path d="M0 0h1"></path></svg></button>'
    const handle = startWordmarkBadge(true)
    expect(document.querySelectorAll('[data-dsh-aqua-harness-badge]').length).toBe(0)
    expect(document.querySelector('svg path')?.hasAttribute('data-dsh-aqua-badge-hidden')).toBe(false)
    handle.dispose()
  })
})

describe('seam stamper', () => {  it('stamps every seam it can find and leaves unmatched ones inert', () => {
    document.body.innerHTML = `
      <div id="frame"><div class="AkH1Nq_sidebarCol"><div class="root"></div>
        <button class="brand"></button><button class="newSession"></button></div></div>
      <div id="inputbar"><div data-composer-card=""><button class="add"></button></div></div>
    `
    const dispose = startSeamStamper()
    expect(document.querySelector('#frame')?.hasAttribute('data-dsh-frame')).toBe(true)
    expect(document.querySelector('.AkH1Nq_sidebarCol .root')?.hasAttribute('data-dsh-sidebar-root')).toBe(true)
    expect(document.querySelector('button.brand')?.hasAttribute('data-dsh-wordmark')).toBe(true)
    expect(document.querySelector('button.newSession')?.hasAttribute('data-dsh-surface')).toBe(true)
    expect(document.querySelector('#inputbar')?.hasAttribute('data-dsh-inputbar')).toBe(true)
    expect(document.querySelector('[data-composer-card] .add')?.hasAttribute('data-dsh-add')).toBe(true)
    // Nothing to stamp for a seam the shell does not render.
    expect(document.querySelector('[data-dsh-stats]')).toBeNull()
    dispose()
  })

  it('keeps stamping nodes that mount later, and stops when disposed', async () => {
    const dispose = startSeamStamper()
    const button = document.createElement('button')
    button.className = 'later_newSession'
    document.body.append(button)
    // MutationObserver callbacks are microtask-scheduled.
    await new Promise(resolve => { setTimeout(resolve, 0) })
    expect(button.hasAttribute('data-dsh-surface')).toBe(true)

    dispose()
    const after = document.createElement('button')
    after.className = 'after_newSession'
    document.body.append(after)
    await new Promise(resolve => { setTimeout(resolve, 0) })
    expect(after.hasAttribute('data-dsh-surface')).toBe(false)
  })
})
