import { memo, useSyncExternalStore } from 'react'
import type { LiveTokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ui-conversation SlotMap merge (conversation.composer.dock).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'

/**
 * The read face the dock injects for one session.
 *
 * 0.1.5 removed the `useProjection` hook share from the composer dock's runtime
 * kit (that slot declares no owner props at all), so the plugin supplies the
 * session's own projection face through its inject face instead and the component
 * subscribes with useSyncExternalStore. The face is identity-stable per session
 * key, which is what keeps that subscription from tearing.
 */
export interface LiveUsageReader {
  /** Current projected value, or undefined before the first publish. */
  read(): LiveTokenUsageProjection | undefined
  /** Subscribe to projection publishes. */
  subscribe(listener: () => void): () => void
}

/** Props the dock entry receives: the session standard kit plus the injected reader. */
export type TpsLineDockProps = PropsRuntime<'conversation.composer.dock'> & { usage?: LiveUsageReader }

/** Format throughput with one decimal below 100 tok/s. */
export function formatTokensPerSecond(value: number): string {
  return String(value < 100 ? Math.round(value * 10) / 10 : Math.round(value))
}

/** Reader used when the dock mounted without one (no bound session). */
const NO_USAGE: LiveUsageReader = {
  read: () => undefined,
  subscribe: () => () => {},
}

const STYLE = {
  boxSizing: 'border-box',
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: '12px',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: '20px',
  margin: '0 auto',
  maxWidth: 'var(--dsh-chat-content-width)',
  overflow: 'hidden',
  padding: '0 var(--dsh-composer-side-clearance)',
  textAlign: 'center',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  width: '100%',
} as const

/** Second composer-status line for active or latest response throughput. */
export const TpsLine = memo(function TpsLine({ usage = NO_USAGE }: { usage?: LiveUsageReader }) {
  const value = useSyncExternalStore(usage.subscribe, usage.read)
  const rate = value?.tokensPerSecond
  if (rate === undefined) return null
  return <div style={STYLE}>TPS {formatTokensPerSecond(rate)} tok/s</div>
})

/**
 * Composer-dock entry: adapts the session-scoped `conversation.composer.dock`
 * runtime share plus the plugin-injected projection reader to the TPS line. The
 * dock is the shipped stats-line seat; registering here makes the live TPS row
 * actually mount — previously the TpsLine was only exported and never mounted on
 * rc.6 (issue #56).
 */
export const TpsLineDockEntry = memo(function TpsLineDockEntry(props: TpsLineDockProps) {
  return <TpsLine usage={props.usage} />
})
