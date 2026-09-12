/**
 * Bilibili download panel — the main React UI component.
 *
 * Users paste a video URL and their cookies, select quality, then start
 * downloading. Progress is shown in real time.
 */
import { useState, useCallback, useEffect, useRef, type FC } from 'react'
import type { BiliApi } from './api.ts'
import type { DownloadProgress, QualityPreset, BiliCookies } from '../protocol.ts'
import { QUALITY_PRESETS } from '../protocol.ts'
import type { BiliDownloadKey } from './locales.ts'
import css from './bili-panel.module.css'

export interface BiliDownloadPanelProps {
  api: BiliApi
  onClose: () => void
  /** Locale reader (optional; falls back to built-in Chinese copy). */
  t?: (key: BiliDownloadKey) => string
  /** Remembered cookies to pre-fill when the panel opens. */
  initialCookies?: BiliCookies
  /** Persist the entered cookies into the settings namespace. */
  onRemember?: (cookies: BiliCookies) => Promise<void>
}

/** Cookie input fields. */
interface CookieFields {
  SESSDATA: string
  bili_jct: string
  DedeUserID: string
}

/** Download state machine. */
type Phase = 'idle' | 'fetching-info' | 'ready' | 'downloading' | 'merging' | 'done' | 'error'

/** Parse a yt-dlp format string into a display label. */
function formatLabel(fmt: { id: string; resolution: string; vcodec: string; filesize: number }): string {
  const res = fmt.resolution || '?'
  const codec = fmt.vcodec.includes('avc1') ? 'AVC' : fmt.vcodec.includes('hvc1') ? 'HEVC' : fmt.vcodec.includes('av01') ? 'AV1' : fmt.vcodec || '?'
  const size = fmt.filesize > 0 ? ` ${(fmt.filesize / (1024**3)).toFixed(1)}GB` : ''
  return `${res} (${codec})${size} — [${fmt.id}]`
}

export const BiliDownloadPanel: FC<BiliDownloadPanelProps> = ({ api, onClose, t, initialCookies, onRemember }) => {
  const [url, setUrl] = useState('')
  const [cookies, setCookies] = useState<CookieFields>({
    SESSDATA: initialCookies?.SESSDATA ?? '',
    bili_jct: initialCookies?.bili_jct ?? '',
    DedeUserID: initialCookies?.DedeUserID ?? '',
  })
  const [remembered, setRemembered] = useState(!!initialCookies?.SESSDATA)
  const [rememberState, setRememberState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [resultFile, setResultFile] = useState('')
  const [formats, setFormats] = useState<Array<{ id: string; resolution: string; vcodec: string; filesize: number }>>([])
  const [selectedPreset, setSelectedPreset] = useState(QUALITY_PRESETS[0])
  const [outputDir, setOutputDir] = useState('')
  const [checks, setChecks] = useState<{ ytDlp: boolean | null; ffmpeg: boolean | null }>({ ytDlp: null, ffmpeg: null })
  const abortRef = useRef<AbortController | null>(null)

  // Check environment on mount
  useEffect(() => {
    api.check().then(r => setChecks({ ytDlp: r.ytDlp, ffmpeg: r.ffmpeg })).catch(() => {})
  }, [api])

  // Default output dir
  useEffect(() => {
    if (!outputDir) {
      setOutputDir('B 站下载')
    }
  }, [outputDir])

  /** Fetch video info. */
  const handleFetchInfo = useCallback(async () => {
    if (!url.trim()) { setError('请输入视频链接'); return }
    if (!cookies.SESSDATA) { setError('请输入 SESSDATA'); return }
    setPhase('fetching-info')
    setError('')
    try {
      const result = await api.getInfo(url.trim(), cookies)
      if (result.ok) {
        setFormats(result.info.formats.filter(f => f.resolution && f.vcodec))
        setPhase('ready')
      } else {
        setError(result.error)
        setPhase('idle')
      }
    } catch (e: any) {
      setError(e.message || '获取信息失败')
      setPhase('idle')
    }
  }, [url, cookies, api])

  /** Start download. */
  const handleStart = useCallback(async () => {
    setPhase('downloading')
    setError('')
    setProgress(null)
    setResultFile('')

    try {
      abortRef.current = await api.startDownload(
        url.trim(),
        cookies,
        selectedPreset.videoFmt,
        selectedPreset.audioFmt,
        outputDir,
        (p) => {
          setProgress(p)
          if (p.target === 'merging') setPhase('merging')
        },
        (ok, fileOrError) => {
          if (ok) {
            setResultFile(fileOrError)
            setPhase('done')
          } else {
            setError(fileOrError)
            setPhase('error')
          }
        },
      )
    } catch (e: any) {
      setError(e.message || '启动下载失败')
      setPhase('error')
    }
  }, [url, cookies, selectedPreset, outputDir, api])

  /** Cancel download. */
  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setPhase('idle')
    setProgress(null)
  }, [])

  /** Reset to beginning. */
  const handleReset = useCallback(() => {
    setPhase('idle')
    setProgress(null)
    setResultFile('')
    setError('')
    setFormats([])
  }, [])

  /** Save the entered cookies into the settings namespace. */
  const handleRemember = useCallback(async () => {
    if (!onRemember) return
    setRememberState('saving')
    try {
      await onRemember({ SESSDATA: cookies.SESSDATA, bili_jct: cookies.bili_jct, DedeUserID: cookies.DedeUserID })
      setRemembered(true)
      setRememberState('saved')
    } catch {
      setRememberState('error')
    }
  }, [onRemember, cookies])

  /** Clear remembered cookies (reset to empty strings). */
  const handleForget = useCallback(async () => {
    if (!onRemember) return
    setRememberState('saving')
    try {
      await onRemember({ SESSDATA: '', bili_jct: '', DedeUserID: '' })
      setRemembered(false)
      setCookies({ SESSDATA: '', bili_jct: '', DedeUserID: '' })
      setRememberState('saved')
    } catch {
      setRememberState('error')
    }
  }, [onRemember])

  return (
    <div className={css.panel}>
      {/* Header */}
      <div className={css.header}>
        <h2 className={css.title}>B 站视频下载</h2>
        <button className={css.closeBtn} onClick={onClose} title="关闭">&times;</button>
      </div>

      {/* Environment check */}
      <div className={css.envRow}>
        <span className={css.envLabel}>yt-dlp:</span>
        <span className={checks.ytDlp === true ? css.envOk : checks.ytDlp === false ? css.envFail : css.envUnknown}>
          {checks.ytDlp === null ? '检查中...' : checks.ytDlp ? '就绪' : '未找到'}
        </span>
        <span className={css.envLabel} style={{ marginLeft: 16 }}>ffmpeg:</span>
        <span className={checks.ffmpeg === true ? css.envOk : checks.ffmpeg === false ? css.envFail : css.envUnknown}>
          {checks.ffmpeg === null ? '检查中...' : checks.ffmpeg ? '就绪' : '未找到'}
        </span>
      </div>

      {/* URL Input */}
      <div className={css.fieldRow}>
        <label className={css.label}>视频链接:</label>
        <input
          className={css.input}
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://www.bilibili.com/video/BV... 或 https://b23.tv/..."
          disabled={phase === 'downloading' || phase === 'merging'}
        />
      </div>

      {/* Cookie Input */}
      <div className={css.fieldRow}>
        <label className={css.label}>Cookie:</label>
        <div className={css.cookieGrid}>
          <input
            className={css.input}
            type="text"
            value={cookies.SESSDATA}
            onChange={e => setCookies(c => ({ ...c, SESSDATA: e.target.value }))}
            placeholder="SESSDATA"
            disabled={phase === 'downloading' || phase === 'merging'}
          />
          <input
            className={css.input}
            type="text"
            value={cookies.bili_jct}
            onChange={e => setCookies(c => ({ ...c, bili_jct: e.target.value }))}
            placeholder="bili_jct"
            disabled={phase === 'downloading' || phase === 'merging'}
          />
          <input
            className={css.input}
            type="text"
            value={cookies.DedeUserID}
            onChange={e => setCookies(c => ({ ...c, DedeUserID: e.target.value }))}
            placeholder="DedeUserID"
            disabled={phase === 'downloading' || phase === 'merging'}
          />
        </div>
        {onRemember && (
          <div className={css.rememberRow}>
            <span className={css.rememberHint}>
              {remembered ? '已记住 Cookie，下次打开自动填入' : '可在本机记住 Cookie，下次自动填入'}
            </span>
            {rememberState === 'saving' && <span className={css.rememberHint}>保存中...</span>}
            {rememberState === 'error' && <span className={css.rememberErr}>保存失败</span>}
            {remembered
              ? (
                <button type="button" className={css.btnSmall} onClick={handleForget} disabled={rememberState === 'saving'}>
                  清除已记住
                </button>
              )
              : (
                <button type="button" className={css.btnSmall} onClick={handleRemember} disabled={rememberState === 'saving'}>
                  记住 Cookie
                </button>
              )}
          </div>
        )}
      </div>

      {/* Quality Presets */}
      {phase === 'ready' && (
        <div className={css.fieldRow}>
          <label className={css.label}>画质:</label>
          <select
            className={css.select}
            value={selectedPreset.label}
            onChange={e => {
              const preset = QUALITY_PRESETS.find(p => p.label === e.target.value)
              if (preset) setSelectedPreset(preset)
            }}
          >
            {QUALITY_PRESETS.map(p => (
              <option key={p.label} value={p.label}>{p.label} — {p.description}</option>
            ))}
          </select>
        </div>
      )}

      {/* Available formats info */}
      {phase === 'ready' && formats.length > 0 && (
        <details className={css.formatDetails}>
          <summary className={css.formatSummary}>可用格式 ({formats.length} 个)</summary>
          <div className={css.formatList}>
            {formats.map(f => (
              <div key={f.id} className={css.formatRow}>{formatLabel(f)}</div>
            ))}
          </div>
        </details>
      )}

      {/* Output directory */}
      {phase === 'ready' && (
        <div className={css.fieldRow}>
          <label className={css.label}>保存位置:</label>
          <input
            className={css.input}
            type="text"
            value={outputDir}
            onChange={e => setOutputDir(e.target.value)}
            placeholder="B 站下载（保存到桌面）"
          />
        </div>
      )}

      {/* Progress */}
      {progress && (
        <div className={css.progressSection}>
          <div className={css.progressBar}>
            <div className={css.progressFill} style={{ width: `${progress.percent}%` }} />
          </div>
          <div className={css.progressText}>
            {phase === 'merging' ? '正在合并音视频...' : (
              <>{progress.percent}% — {progress.speed} — 剩余 {progress.eta}</>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={css.errorBox}>
          <strong>错误:</strong> {error}
        </div>
      )}

      {/* Result */}
      {resultFile && (
        <div className={css.resultBox}>
          <strong>下载完成!</strong>
          <div className={css.resultPath}>{resultFile}</div>
        </div>
      )}

      {/* Action Buttons */}
      <div className={css.actions}>
        {phase === 'idle' && (
          <button className={css.btnPrimary} onClick={handleFetchInfo} disabled={checks.ytDlp === false}>
            {checks.ytDlp === null ? '检查环境中...' : '获取视频信息'}
          </button>
        )}
        {phase === 'fetching-info' && (
          <button className={css.btn} disabled>获取中...</button>
        )}
        {phase === 'ready' && (
          <button className={css.btnPrimary} onClick={handleStart}>开始下载</button>
        )}
        {(phase === 'downloading' || phase === 'merging') && (
          <button className={css.btnDanger} onClick={handleCancel}>取消下载</button>
        )}
        {(phase === 'done' || phase === 'error') && (
          <button className={css.btn} onClick={handleReset}>重新开始</button>
        )}
      </div>
    </div>
  )
}