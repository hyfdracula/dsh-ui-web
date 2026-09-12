/**
 * The Bilibili download plugin card for the settings page.
 *
 * Registers into the `web-ui.plugin.item` child slot the Web UI plugin group
 * declares. Hidden from the sidebar entirely: the card is the only entry
 * point. Clicking "open panel" mounts the download panel as a full-screen
 * modal (portal to body), so it reliably appears above the GUI.
 */
import { useCallback, useState, type FC } from 'react'
import { createPortal } from 'react-dom'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { BiliApi } from './api.ts'
import type { BiliCookies, CookieSettings } from '../protocol.ts'
import { cookiesToSettings, settingsToCookies } from '../protocol.ts'
import type { BiliDownloadKey } from './locales.ts'
import { BiliDownloadPanel } from './BiliDownloadPanel.tsx'
import css from './bili-panel.module.css'

/** What the registration injects (beyond the locale reader). */
export interface BiliCardFace {
  /** The API client the panel operates through. */
  api: BiliApi
  /** The remembered-cookie settings scope (may be unready on the wire). */
  cookieScope: SettingsScope<CookieSettings>
}

/** Props the renderer binds for the Bilibili download card. */
export type BiliSettingsCardProps =
  PropsLocale<'bili-download'>
  & InjectFace<BiliCardFace>

/**
 * Render the settings card; clicking its header expands the card, and the
 * open button mounts a full-screen modal.
 * @param props - locale reader, API client, and the cookie scope.
 */
export const BiliSettingsCard: FC<BiliSettingsCardProps> = ({ t, api, cookieScope }) => {
  const [open, setOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  // Load remembered cookies when the panel opens; the scope may still be
  // loading at card mount, so read at open time instead.
  const readSaved = useCallback((): BiliCookies => {
    const snapshot = cookieScope.getSnapshot()
    return snapshot.status === 'ready' ? settingsToCookies(snapshot.value) : { SESSDATA: '', bili_jct: '', DedeUserID: '' }
  }, [cookieScope])

  const saveCookies = useCallback(async (cookies: BiliCookies): Promise<void> => {
    const settings = cookiesToSettings(cookies)
    await cookieScope.set('sessdata', settings.sessdata ?? '')
    await cookieScope.set('biliJct', settings.biliJct ?? '')
    await cookieScope.set('dedeUserID', settings.dedeUserID ?? '')
  }, [cookieScope])

  return (
    <>
      <li className={css.card}>
        <button
          type="button"
          className={css.cardHeader}
          aria-expanded={open}
          onClick={() => { setOpen(!open) }}
        >
          <span className={css.cardHeadText}>
            <span className={css.cardName}>{t('card.title')}</span>
            <span className={css.cardDescription}>{t('card.description')}</span>
          </span>
          <span className={open ? css.cardChevronOpen : css.cardChevron}>{'\u25BE'}</span>
        </button>
        {open
          ? (
            <div className={css.cardBody}>
              <p className={css.cardHint}>{t('card.hint')}</p>
              <button
                type="button"
                className={css.btnPrimary}
                onClick={() => { setPanelOpen(true) }}
              >
                {t('card.open')}
              </button>
            </div>
          )
          : null}
      </li>
      {panelOpen
        ? (
          createPortal(
            <div
              className={css.modalBackdrop}
              onClick={(event) => { if (event.target === event.currentTarget) setPanelOpen(false) }}
              role="dialog"
              aria-modal="true"
            >
              <div className={css.modal}>
                <BiliDownloadPanel
                  api={api}
                  onClose={() => { setPanelOpen(false) }}
                  t={t}
                  initialCookies={readSaved()}
                  onRemember={saveCookies}
                />
              </div>
            </div>,
            document.body,
          )
        )
        : null}
    </>
  )
}