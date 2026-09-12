/**
 * aurora 皮肤 —— 浏览器半区。
 *
 * 与 dsh-web-ui 皮肤契约一致：apply() 只写自己能回收的东西，dispose 时全部还原。
 * 自定义背景配置通过宿主 `/api/skin-aurora/config` 路由读写（持久化到
 * `~/.dsh/skin-aurora.json`）；皮肤中心卡片的修改会派发 `dshc-aurora-config`
 * 窗口事件，本半区监听后重新拉取配置并重绘背景层。
 *
 * 本半区只写 DOM，不声明任何客户端服务：apply() 只依赖 ctx.effect()。
 *
 * CSS 走 bundle 的 CSS-modules 自动注入；token 覆盖在 aurora.module.css 里以
 * body[data-dsh-aurora] 作用域声明。
 */
import type { Context } from '@deepseek-ai/cordis'
import css from './aurora.module.css'

/** 配置变更事件（皮肤中心卡片写入后派发，本半区监听重绘）。 */
export const AURORA_EVENT = 'dshc-aurora-config'

interface AuroraConfig {
  enabled: boolean
  backgroundUrl: string
  opacity: number
  blur: number
  mediaType: 'image' | 'video'
  muted: boolean
}

const DEFAULTS: AuroraConfig = { enabled: true, backgroundUrl: '', opacity: 0.8, blur: 0, mediaType: 'image', muted: true }

let cached: AuroraConfig = { ...DEFAULTS }

/** 从宿主路由拉取最新配置（失败时沿用缓存）。 */
async function fetchConfig(): Promise<AuroraConfig> {
  try {
    const res = await fetch('/api/skin-aurora/config')
    const data = (await res.json()) as { ok?: boolean; config?: Partial<AuroraConfig> }
    if (data?.ok === true && data.config !== undefined) {
      cached = {
        enabled: typeof data.config.enabled === 'boolean' ? data.config.enabled : DEFAULTS.enabled,
        backgroundUrl: typeof data.config.backgroundUrl === 'string' ? data.config.backgroundUrl : DEFAULTS.backgroundUrl,
        opacity: typeof data.config.opacity === 'number' ? data.config.opacity : DEFAULTS.opacity,
        blur: typeof data.config.blur === 'number' ? data.config.blur : DEFAULTS.blur,
        mediaType: data.config.mediaType === 'video' ? 'video' : 'image',
        muted: typeof data.config.muted === 'boolean' ? data.config.muted : DEFAULTS.muted,
      }
    }
  } catch {
    /* 沿用缓存 */
  }
  return cached
}

/** 解析一个模块类名（css-modules 记录按字面量名索引）。 */
const cls = (name: keyof typeof css): string => css[name] ?? ''

function cssEscape(url: string): string {
  return url.replace(/["\\]/g, '\\$&')
}

/** 深色极光渐变（深色模式默认背景）。 */
function auroraGradient(dark: boolean): string {
  return dark
    ? [
        'radial-gradient(1200px 800px at 15% 8%, rgba(90,120,255,0.38), transparent 60%)',
        'radial-gradient(1000px 700px at 85% 18%, rgba(0,200,180,0.24), transparent 55%)',
        'radial-gradient(800px 700px at 60% 115%, rgba(160,80,255,0.15), transparent 60%)',
        'linear-gradient(180deg, #05081a 0%, #0c1234 55%, #111736 100%)',
      ].join(',')
    : [
        'radial-gradient(1200px 800px at 15% 8%, rgba(90,130,255,0.30), transparent 60%)',
        'radial-gradient(1000px 700px at 85% 18%, rgba(0,180,170,0.20), transparent 55%)',
        'radial-gradient(900px 900px at 60% 100%, rgba(150,90,255,0.22), transparent 60%)',
        'linear-gradient(180deg, #f2f5ff 0%, #e4ebfb 55%, #ece7fb 100%)',
      ].join(',')
}

/**
 * 应用 aurora 皮肤：body 属性 + 自定义背景层（配置驱动，经路由读取、事件联动）。
 * 所有写入由 ctx.effect 的 disposer 在卸载时回收。
 * @param ctx - 宿主上下文（effect 生命周期负责回收）。
 */
export function apply(ctx: Context): void {
  const body = document.body
  body.dataset.dshAurora = ''

  let backdrop: HTMLElement | null = null
  let videoEl: HTMLVideoElement | null = null
  let videoSrc = ''

  const renderBackdrop = (cfg: AuroraConfig): void => {
    // 配置变化时：若已是视频背景且 URL 未变，只更新样式（不重载视频，
    // 避免模糊/透明度调节导致重新缓冲卡顿）；否则重建背景层。
    if (backdrop !== null && backdrop.isConnected && cfg.enabled && cfg.backgroundUrl === videoSrc) {
      backdrop.style.opacity = String(cfg.opacity)
      backdrop.style.filter = cfg.blur > 0 ? `blur(${cfg.blur}px)` : 'none'
      if (videoEl !== null && cfg.mediaType === 'video') {
        videoEl.muted = cfg.muted
      }
      return
    }
    backdrop?.remove()
    backdrop = null
    videoEl = null
    videoSrc = ''
    if (!cfg.enabled) return
    const dark = body.dataset.dsDarkTheme !== undefined
    const layer = document.createElement('div')
    layer.className = cls('auroraBackdrop')
    layer.style.opacity = String(cfg.opacity)
    layer.style.filter = cfg.blur > 0 ? `blur(${cfg.blur}px)` : 'none'
    if (cfg.backgroundUrl && cfg.mediaType === 'video') {
      // 视频背景：<video> 铺底，autoplay/muted/loop/playsinline。
      // 永不显示 controls（避免进度条/控制条）；声音只由 muted 开关控制。
      const video = document.createElement('video')
      video.src = cfg.backgroundUrl
      video.autoplay = true
      video.muted = cfg.muted
      video.loop = true
      video.playsInline = true
      video.setAttribute('playsinline', '')
      video.className = cls('auroraVideo')
      layer.appendChild(video)
      videoEl = video
      videoSrc = cfg.backgroundUrl
    } else {
      // 图片/动图背景：background-image（GIF/WebP 动图原生支持）。
      layer.style.backgroundImage = cfg.backgroundUrl
        ? `url("${cssEscape(cfg.backgroundUrl)}")`
        : auroraGradient(dark)
    }
    body.appendChild(layer)
    backdrop = layer
  }

  const refresh = (): void => {
    void fetchConfig().then((cfg) => renderBackdrop(cfg))
  }

  // 皮肤中心卡片写入后联动重绘。
  const onConfig = (): void => refresh()
  window.addEventListener(AURORA_EVENT, onConfig)

  // 深浅主题切换时重画背景（极光渐变分浅/深两套）。
  const observer = new MutationObserver(refresh)
  observer.observe(body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })

  refresh()

  ctx.effect(
    () => () => {
      delete body.dataset.dshAurora
      observer.disconnect()
      window.removeEventListener(AURORA_EVENT, onConfig)
      backdrop?.remove()
      backdrop = null
    },
    'ui-skin-aurora: backdrop',
  )
}
