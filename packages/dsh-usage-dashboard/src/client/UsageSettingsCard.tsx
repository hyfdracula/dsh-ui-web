/**
 * Usage dashboard settings card — a simple informational card for the
 * Web UI plugin group: explains what the dashboard records and where the
 * data lives. No configuration fields (the dashboard is zero-config).
 * @module @captain1275/dsh-usage-dashboard/client/UsageSettingsCard
 */
import { useState, type ReactNode } from 'react'
import { t } from './locales.ts'
import css from './usage-settings.module.css'

/** Props the settings slot binds (owner share; card renders standalone). */
export interface UsageSettingsCardProps {
  /** Marker field: no owner props are consumed. */
  children?: never
}

/**
 * Render the informational settings card.
 * @returns the card element.
 */
export function UsageSettingsCard(_props: UsageSettingsCardProps): ReactNode {
  const [open, setOpen] = useState(false)
  return (
    <li className={css.card}>
      <button
        type="button"
        className={css.header}
        aria-expanded={open}
        aria-label={`${open ? t('usage.collapse') : t('usage.expand')}: ${t('usage.settingsTitle')}`}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.headText}>
          <span className={css.name}>{t('usage.settingsTitle')}</span>
          <span className={css.description}>{t('usage.settingsHint')}</span>
        </span>
        <span className={open ? css.chevronOpen : css.chevron}>▾</span>
      </button>
      {open
        ? (
          <div className={css.body}>
            <div className={css.legendRow}>
              <span className={css.dot} style={{ background: '#3f76d8' }} /> {t('usage.settingsMoreRecord')}
            </div>
            <div className={css.legendRow}>
              <span className={css.dot} style={{ background: '#6e9be8' }} /> {t('usage.settingsMoreEntry')}
            </div>
            <div className={css.legendRow}>
              <span className={css.dot} style={{ background: '#a8ccf2' }} /> {t('usage.settingsMorePath')}
            </div>
          </div>
        )
        : null}
    </li>
  )
}
