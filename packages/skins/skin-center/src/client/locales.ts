/**
 * Skin-center locale dictionaries. The plugin-card name, its description,
 * and every control of the in-GUI skin center is localized through the
 * standard `t` seat.
 */

/** Copy keys owned by this plugin. */
export type SkinCenterKey =
  | 'title'
  | 'cardDescription'
  | 'expand'
  | 'collapse'
  | 'intro'
  | 'official'
  | 'officialTagline'
  | 'active'
  | 'tryingOn'
  | 'tryOn'
  | 'exitTryOn'
  | 'trialRunning'
  | 'profile'
  | 'restartHint'
  | 'apply'
  | 'applying'
  | 'restore'
  | 'applyFailed'
  | 'appliedUnconfirmed'
  | 'theme'
  | 'themeLight'
  | 'themeDark'
  | 'tryOnError'
  | 'backgroundOpacity'
  | 'backgroundHint'
  | 'backgroundHintInert'

export const en: Record<SkinCenterKey, string> = {
  title: 'Skin Center',
  cardDescription: 'Try any installed skin on for real (the page reloads into it), apply in one click, exit restores your previous skin.',
  expand: 'Expand',
  collapse: 'Collapse',
  intro: 'Try on backs your current skin up, switches to the skin and reloads; exit restore puts your previous look back. Apply keeps the skin across restarts.',
  official: 'Official default',
  officialTagline: 'The stock DSH look with no skin applied.',
  active: 'Active',
  tryingOn: 'Trying on',
  tryOn: 'Try on',
  exitTryOn: 'Exit try-on',
  trialRunning: 'Trying on',
  profile: 'Profile',
  restartHint: 'Written. The client plugin graph is composed when the Host starts, so restart it to see the change: run /restart in the composer, or relaunch from the desktop shortcut.',
  apply: 'Apply',
  applying: 'Applying…',
  restore: 'Restore',
  applyFailed: 'Apply failed',
  appliedUnconfirmed: 'Applied, but the change has not been confirmed — refresh the page if the skin did not switch',
  theme: 'Theme preview',
  themeLight: 'Light',
  themeDark: 'Dark',
  tryOnError: 'Try-on failed — see console',
  backgroundOpacity: 'Background occlusion',
  backgroundHint: 'Instantly veils the backdrop behind the panels — higher values obscure the art to help you focus.',
  backgroundHintInert: 'Only applies to skins that paint a backdrop (Blue Fantasy / Whale Song). Applies to the official default automatically once such a skin is active.',
}

export const zh: Record<SkinCenterKey, string> = {
  title: '皮肤中心',
  cardDescription: '任意皮肤可真实试用（页面会重载进入该皮肤），应用一键持久化，退出试用即还原你原来的皮肤。',
  expand: '展开',
  collapse: '收起',
  intro: '「试用」会先备份当前配置、切到该皮肤并重载页面；「退出试用」把原来的皮肤还回来。「应用」跨重启保留。',
  official: '官方默认',
  officialTagline: '还原 DSH 官方默认外观，不应用任何皮肤。',
  active: '当前激活',
  tryingOn: '试用中',
  tryOn: '试用',
  exitTryOn: '退出试用',
  trialRunning: '试用中',
  profile: '当前 profile',
  restartHint: '已写入。客户端插件图是宿主启动时组装的，需要重启宿主才会生效：在输入框执行 /restart，或双击桌面图标重新打开。',
  apply: '应用',
  applying: '应用中…',
  restore: '恢复默认',
  applyFailed: '应用失败',
  appliedUnconfirmed: '已写入配置但尚未确认生效——若皮肤未切换请手动刷新页面',
  theme: '主题预览',
  themeLight: '亮色',
  themeDark: '暗色',
  tryOnError: '试用失败，详见控制台',
  backgroundOpacity: '背景遮挡',
  backgroundHint: '即时为面板背后的背景加遮罩——数值越高越能弱化插画，帮你集中注意力。',
  backgroundHintInert: '仅对带背景图插画的皮肤（蓝色幻想 / 鲸吟）生效；官方默认无背景图，该滑块对这些皮肤自动生效。',
}
