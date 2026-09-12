/**
 * The skin-center plugin card: one disclosure card inside the Web UI plugin
 * group (插件配置 → Web UI 插件), listing every installed skin plus the
 * official stock look.
 *
 * 0.1.5 lowered what a plugin can do at runtime: the page no longer exposes the
 * kernel module system the 0.1.1 try-on engine mounted bundles through, so a
 * skin can only ever live in the boot graph. The card therefore works against
 * the host's trial API — 试用 backs the user patch up, writes the trial skin
 * into the managed section and reloads; 退出试用 restores the backup and
 * reloads. 应用 persists a skin the same way, 恢复默认 goes back to the stock
 * look. The panel also shows which profile this host serves, because a switch
 * is only loadable when the skin resolves from that profile.
 *
 * Copy rides the standard `t` seat; the theme preview control drives the
 * official theme service (persisted, same as the Appearance row).
 */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
import { SKIN_CENTER_ENTRIES, type SkinCenterEntry } from './generated/skins.ts'
import type { SkinBackgroundHandle } from './background.ts'
import { AuroraBackgroundSection } from './AuroraBackgroundSection.tsx'
import css from './skin-center.module.css'

/** Business face the skin-center apply() injects into the card. */
export interface SkinCenterInjected {
  theme: {
    getTheme(): ThemeSnapshot
    subscribe(listener: () => void): () => void
    setTheme(id: 'light' | 'dark'): void
  }
  /** Background occluder over the shared skin-background namespace. */
  background: SkinBackgroundHandle
}

/** Plugin-card component props: group-item runtime share + locale seat + injected face. */
export type SkinCenterComponentProps =
  PropsRuntime<'web-ui.plugin.item'> & PropsLocale<'skinCenter'> & SkinCenterInjected

/** The apply target of the official stock-look card. */
const OFFICIAL = 'official'

/** Skin ids that read the background-scrim variable and paint a backdrop. */
const BACKDROP_SKIN_IDS = new Set(['blue-fantasy', 'whale-song'])

/** The host's view of the skin state (`GET /api/skin-center/state`). */
interface SkinCenterState {
  /** Active skin id, or `none` for the stock look. */
  active: string
  /** Profile this host serves (0.1.5 never tells a plugin otherwise). */
  profile: string
  /** Skin id currently being tried on, or null. */
  trial: string | null
}

/** One host response carrying the state fields the card mirrors. */
interface StateResponse extends Partial<SkinCenterState> {
  ok?: boolean
  error?: string
  message?: string
}

/**
 * Render the skin-center card: a disclosure header naming the plugin, with the
 * skin list (official default + every installed skin; trial / theme preview /
 * one-click apply) inside its body.
 * @param props - card props.
 * @returns the plugin card.
 */
export function SkinCenter({ t, theme, background }: SkinCenterComponentProps) {
  const snapshot = useSyncExternalStore(theme.subscribe, theme.getTheme)
  const opacity = useSyncExternalStore(background.subscribe, background.opacity)
  const [state, setState] = useState<SkinCenterState | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const activeId = state !== null && state.active !== 'none' ? state.active : undefined
  const trialId = state?.trial ?? null
  const backdropActive = activeId !== undefined && BACKDROP_SKIN_IDS.has(activeId)

  /** Read the host state (active skin, trial, serving profile). */
  const refresh = async (): Promise<void> => {
    try {
      const response = await fetch('/api/skin-center/state')
      const payload = await response.json().catch(() => null) as StateResponse | null
      if (response.ok && payload?.ok === true && typeof payload.active === 'string') {
        setState({
          active: payload.active,
          profile: typeof payload.profile === 'string' ? payload.profile : '',
          trial: typeof payload.trial === 'string' ? payload.trial : null,
        })
      }
    } catch {
      /* the card simply stays without state */
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  // A running trial owns the page: open the card so the exit is one click away.
  useEffect(() => {
    if (trialId !== null) setOpen(true)
  }, [trialId])

  /**
   * One POST to the skin-center API.
   * @param path - route suffix under `/api/skin-center`.
   * @param body - JSON body.
   * @returns the parsed response, or null when the request failed.
   */
  const post = async (path: string, body: Record<string, unknown>): Promise<StateResponse | null> => {
    try {
      const response = await fetch(`/api/skin-center/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => null) as StateResponse | null
      if (!response.ok || payload?.ok !== true) {
        setError(payload?.error ?? `HTTP ${response.status}`)
        return null
      }
      setError(null)
      return payload
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      return null
    }
  }

  /**
   * Poll the host until it reports the target active (the config watcher
   * applies the patch a moment after the write), or time out.
   * @param target - skin id, or `official` for the stock look.
   * @returns whether the target became active within the poll budget.
   */
  const confirmActive = (target: string): Promise<boolean> =>
    new Promise(resolve => {
      const expected = target === OFFICIAL ? 'none' : target
      let tries = 0
      const tick = (): void => {
        tries += 1
        void fetch('/api/skin-center/state')
          .then(async response => {
            const payload = await response.json().catch(() => null) as StateResponse | null
            if (response.ok && payload?.ok === true && payload.active === expected) {
              resolve(true)
              return
            }
            if (tries >= 20) resolve(false)
            else window.setTimeout(tick, 250)
          })
          .catch(() => {
            if (tries >= 20) resolve(false)
            else window.setTimeout(tick, 250)
          })
      }
      tick()
    })

  /**
   * One-click apply: the host rewrites the managed section of the user patch.
   * The client boot graph is composed at HOST BOOT (0.1.5 embeds it in the
   * served index.html), so the new skin only reaches the page after a restart —
   * the card says so instead of reloading into the old graph.
   * @param target - skin id, or `official` for the stock look.
   */
  const applySkin = (target: string): void => {
    setError(null)
    setNotice(null)
    setBusy(target)
    const body = target === OFFICIAL ? { official: true } : { skin: target }
    void post('apply', body).then(payload => {
      if (payload === null) { setBusy(null); return }
      // Patch written; the host already reports the target active. Wait for
      // that confirmation so a failed watcher reload is visible.
      void confirmActive(target).then(confirmed => {
        setBusy(null)
        void refresh()
        if (confirmed) {
          setNotice(t('restartHint'))
        } else {
          const command = target === OFFICIAL ? 'dsh-skin use official' : `dsh-skin use ${target}`
          setError(`${t('appliedUnconfirmed')} — ${command}`)
        }
      })
    })
  }

  /**
   * Start a trial: the host backs the user patch up and writes the trial skin
   * into the managed section. The skin mounts on the next host start (the client
   * graph is boot-time), so the card records the trial and asks for a restart.
   * @param entry - the skin to try on.
   */
  const startTrial = (entry: SkinCenterEntry): void => {
    setError(null)
    setNotice(null)
    setBusy(entry.id)
    void post('trial', { skin: entry.id }).then(payload => {
      setBusy(null)
      if (payload === null) return
      void refresh()
      setNotice(t('restartHint'))
    })
  }

  /** Leave the trial: the host restores the backed-up patch, then a restart. */
  const exitTrial = (): void => {
    setError(null)
    setNotice(null)
    setBusy('exit-trial')
    void post('trial/exit', {}).then(payload => {
      setBusy(null)
      if (payload === null) return
      void refresh()
      setNotice(t('restartHint'))
    })
  }

  const dark = snapshot.active.colorScheme === 'dark'

  /** One row: trial control + apply button. Shared by the official card and every skin card. */
  const actionButtons = (opts: {
    key: string
    isActive: boolean
    isTrying: boolean
    onTryOn: () => void
    applyLabel: string
  }): ReactNode => (
    <div className={css.actions}>
      {opts.isActive ? (
        <button type="button" className={`${css.button} ${css.buttonGhost}`} disabled>
          {t('tryOn')}
        </button>
      ) : opts.isTrying ? (
        <button type="button" className={`${css.button} ${css.buttonPrimary}`} disabled>
          {t('tryingOn')}
        </button>
      ) : (
        <button
          type="button"
          className={`${css.button} ${css.buttonPrimary}`}
          disabled={busy !== null}
          onClick={opts.onTryOn}
        >
          {t('tryOn')}
        </button>
      )}
      <button
        type="button"
        className={css.button}
        disabled={busy !== null}
        onClick={() => { applySkin(opts.key) }}
      >
        {busy === opts.key ? t('applying') : opts.applyLabel}
      </button>
    </div>
  )

  return (
    <li className={css.pluginCard}>
      <button
        type="button"
        className={css.cardHeader}
        aria-expanded={open}
        aria-label={`${t(open ? 'collapse' : 'expand')}: ${t('title')}`}
        onClick={() => { setOpen(current => !current) }}
      >
        <span className={css.headText}>
          <span className={css.pluginName}>
            {t('title')}
            <span className={css.titleBadge}>{String(SKIN_CENTER_ENTRIES.length)}</span>
          </span>
          <span className={css.cardDescription} title={t('cardDescription')}>{t('cardDescription')}</span>
        </span>
        <span className={open ? css.chevronOpen : css.chevron}>▾</span>
      </button>

      {open
        ? (
          <div className={css.cardBody}>
            <div className={css.head}>
              <div className={css.intro} title={t('intro')}>{t('intro')}</div>
              <div className={css.themeRow}>
                <span className={css.themeLabel}>{t('theme')}</span>
                <button
                  type="button"
                  className={`${css.themeButton} ${dark ? '' : css.themeButtonActive}`}
                  onClick={() => { theme.setTheme('light') }}
                >
                  {t('themeLight')}
                </button>
                <button
                  type="button"
                  className={`${css.themeButton} ${dark ? css.themeButtonActive : ''}`}
                  onClick={() => { theme.setTheme('dark') }}
                >
                  {t('themeDark')}
                </button>
              </div>
              {state !== null && state.profile !== ''
                ? <p className={css.profileLine}>{t('profile')}: {state.profile}</p>
                : null}
            </div>

            {trialId !== null
              ? (
                <div className={css.trialBanner} role="status">
                  <span className={css.trialText}>
                    {t('trialRunning')}: {SKIN_CENTER_ENTRIES.find(entry => entry.id === trialId)?.nameEn ?? trialId}
                  </span>
                  <button
                    type="button"
                    className={css.button}
                    disabled={busy !== null}
                    onClick={exitTrial}
                  >
                    {busy === 'exit-trial' ? t('applying') : t('exitTryOn')}
                  </button>
                </div>
              )
              : null}

            <div className={css.backgroundRow}>
              <div className={css.backgroundHead}>
                <span className={css.backgroundLabel}>{t('backgroundOpacity')}</span>
                <span className={css.backgroundValue} aria-hidden="true">{opacity}%</span>
              </div>
              <input
                id="skin-center-background-opacity"
                className={css.backgroundRange}
                type="range"
                min="0"
                max="100"
                step="5"
                value={opacity}
                aria-valuetext={`${opacity}%`}
                aria-label={t('backgroundOpacity')}
                onChange={(event) => { background.set(Number(event.target.value)) }}
              />
              <p className={backdropActive ? css.backgroundHint : css.backgroundHintMuted}>
                {backdropActive ? t('backgroundHint') : t('backgroundHintInert')}
              </p>
            </div>

            {notice !== null && <div className={css.trialBanner} role="status"><span className={css.trialText}>{notice}</span></div>}
            {error !== null && <div className={css.error}>{error}</div>}

            <div className={css.list}>
              {(() => {
                const isActive = activeId === undefined
                const badge = isActive ? t('active') : null
                return (
                  <div className={css.card} key={OFFICIAL}>
                    <div className={css.cardHead}>
                      <span className={css.swatch} style={{ background: '#98a1ab' }} aria-hidden="true" />
                      <span className={css.cardName} title={t('official')}>{t('official')}</span>
                      {badge !== null && (
                        <span className={`${css.badge} ${css.badgeActive}`}>{badge}</span>
                      )}
                    </div>
                    <div className={css.cardTagline} title={t('officialTagline')}>{t('officialTagline')}</div>
                    {actionButtons({
                      key: OFFICIAL,
                      isActive,
                      isTrying: false,
                      onTryOn: () => { applySkin(OFFICIAL) },
                      applyLabel: t('restore'),
                    })}
                  </div>
                )
              })()}

              {SKIN_CENTER_ENTRIES.map(entry => {
                const isActive = entry.id === activeId
                const isTrying = entry.id === trialId
                const badge = isActive ? t('active') : isTrying ? t('tryingOn') : null
                return (
                  <div className={css.card} key={entry.id}>
                    <div className={css.cardHead}>
                      <span className={css.swatch} style={{ background: entry.accent }} aria-hidden="true" />
                      <span className={css.cardName} title={entry.nameEn}>{entry.nameEn}</span>
                      {badge !== null && (
                        <span className={`${css.badge} ${isActive ? css.badgeActive : css.badgeTrying}`}>
                          {badge}
                        </span>
                      )}
                    </div>
                    <div className={css.cardTagline} title={entry.tagline}>{entry.tagline}</div>
                    {actionButtons({
                      key: entry.id,
                      isActive,
                      isTrying,
                      onTryOn: () => { startTrial(entry) },
                      applyLabel: t('apply'),
                    })}
                    {entry.id === 'aurora' && (
                      <AuroraBackgroundSection />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
        : null}
    </li>
  )
}
