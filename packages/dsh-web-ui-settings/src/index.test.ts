/**
 * Smoke tests for dsh-web-ui-settings: locales, persona config normalization,
 * skill-file sync, and atomic persistence (the CI gate requires at least one
 * test file per package).
 * @module @captain1275/dsh-client-ui-web-ui-settings
 */
import { describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { en, zh, type WebUIPluginsKey } from './client/locales.ts'
import {
  DEFAULT_PERSONA,
  SKILL_NAME_RE,
  applyPersonaSkill,
  normalizeConfig,
  personaConfigPath,
  personaSkillDisabledPath,
  personaSkillPath,
  readPersonaConfig,
  syncPersonaFiles,
  writePersonaSkill,
} from './index.ts'

/** 测试用：在临时 DSH_HOME 下运行。 */
function withTempHome(fn: () => void): void {
  const home = join(tmpdir(), `dsh-web-ui-settings-test-${process.pid}-${Date.now()}`)
  const prev = process.env.DSH_HOME
  process.env.DSH_HOME = home
  try {
    fn()
  } finally {
    if (prev === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = prev
    rmSync(home, { recursive: true, force: true })
  }
}

describe('dsh-web-ui-settings locales', () => {
  it('defines the Web UI plugin group copy in zh', () => {
    expect(zh['title']).toBe('Web UI 插件')
  })

  it('zh and en share the same key set', () => {
    const zhKeys = Object.keys(zh).sort() as WebUIPluginsKey[]
    const enKeys = Object.keys(en).sort()
    expect(enKeys).toEqual(zhKeys)
  })
})

describe('dsh-web-ui-settings persona host logic', () => {
  it('default persona is enabled with a valid skill name', () => {
    expect(DEFAULT_PERSONA.enabled).toBe(true)
    expect(SKILL_NAME_RE.test(DEFAULT_PERSONA.name)).toBe(true)
    expect(DEFAULT_PERSONA.description.length).toBeGreaterThan(0)
    expect(DEFAULT_PERSONA.content.length).toBeGreaterThan(0)
  })

  it('merges partial payloads with the current config and keeps unspecified fields', () => {
    const current = { ...DEFAULT_PERSONA, name: 'my-persona', description: '现有描述', content: '# 现有正文' }
    const result = normalizeConfig({ enabled: false }, current)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.config.enabled).toBe(false)
      expect(result.config.name).toBe('my-persona')
      expect(result.config.description).toBe('现有描述')
      expect(result.config.content).toBe('# 现有正文')
    }
  })

  it('rejects empty explicit values with an explicit error instead of defaulting', () => {
    const current = { ...DEFAULT_PERSONA }
    expect(normalizeConfig({ description: '' }, current).ok).toBe(false)
    expect(normalizeConfig({ content: '' }, current).ok).toBe(false)
    expect(normalizeConfig({ name: '' }, current).ok).toBe(false)
  })

  it('rejects invalid skill names', () => {
    const current = { ...DEFAULT_PERSONA }
    expect(normalizeConfig({ name: 'Bad Name!' }, current).ok).toBe(false)
    expect(normalizeConfig({ name: '小咪' }, current).ok).toBe(false)
  })

  it('reads default config when persona.json is absent', () => {
    withTempHome(() => {
      expect(readPersonaConfig().name).toBe(DEFAULT_PERSONA.name)
    })
  })

  it('serializes description as a JSON string in SKILL.md frontmatter', () => {
    withTempHome(() => {
      const cfg = { ...DEFAULT_PERSONA, description: 'line1\nline2 "quotes" \\ backslash \t tab' }
      writePersonaSkill(cfg)
      const md = readFileSync(personaSkillPath(), 'utf8')
      expect(md).toContain(`description: ${JSON.stringify(cfg.description)}`)
      const match = /^---\nname: [^\n]+\ndescription: (.*)\n---\n/.exec(md)
      expect(match).not.toBeNull()
      expect(JSON.parse(match?.[1] ?? 'null')).toBe(cfg.description)
    })
  })

  it('writes persona.json and syncs SKILL.md on enable, stashes on disable', () => {
    withTempHome(() => {
      const cfg = { ...DEFAULT_PERSONA, description: '测试描述', content: '# 测试正文' }
      applyPersonaSkill(cfg)
      expect(existsSync(personaConfigPath())).toBe(false) // applyPersonaSkill 不写 json
      expect(readFileSync(personaSkillPath(), 'utf8')).toContain('# 测试正文')

      applyPersonaSkill({ ...cfg, enabled: false })
      expect(existsSync(personaSkillPath())).toBe(false)
      expect(existsSync(personaSkillDisabledPath())).toBe(true)

      applyPersonaSkill(cfg)
      expect(readFileSync(personaSkillPath(), 'utf8')).toContain('# 测试正文')
    })
  })

  it('disable replaces a stale stash with the latest SKILL.md', () => {
    withTempHome(() => {
      const cfg = { ...DEFAULT_PERSONA, content: '# 最新正文' }
      applyPersonaSkill(cfg)
      applyPersonaSkill({ ...cfg, enabled: false })
      // 模拟外部进程重建 SKILL.md + 残留更旧的 stash：再次禁用应覆盖 stash 为最新内容。
      writeFileSync(personaSkillPath(), '# 外部重建的旧文件', 'utf8')
      writeFileSync(personaSkillDisabledPath(), '# 更旧的 stash', 'utf8')
      applyPersonaSkill({ ...cfg, enabled: false })
      expect(existsSync(personaSkillPath())).toBe(false)
      expect(readFileSync(personaSkillDisabledPath(), 'utf8')).toBe('# 外部重建的旧文件')
    })
  })

  it('persists config atomically via syncPersonaFiles and leaves no temp files', () => {
    withTempHome(() => {
      mkdirSync(join(process.env.DSH_HOME as string, 'skills'), { recursive: true })
      const next = { ...DEFAULT_PERSONA, name: 'my-persona', content: '# 原子写正文' }
      syncPersonaFiles(DEFAULT_PERSONA, next)
      expect(readPersonaConfig().content).toBe('# 原子写正文')
      expect(readFileSync(personaSkillPath(), 'utf8')).toContain('# 原子写正文')
      const leftovers = readdirSync(process.env.DSH_HOME as string).filter((f) => f.includes('.tmp'))
      expect(leftovers).toEqual([])
    })
  })

  it('persists config via persona.json for read-back', () => {
    withTempHome(() => {
      mkdirSync(join(process.env.DSH_HOME as string, 'skills'), { recursive: true })
      const cfg = { ...DEFAULT_PERSONA, name: 'my-persona', content: '# 我的' }
      writeFileSync(personaConfigPath(), JSON.stringify(cfg), 'utf8')
      expect(readPersonaConfig().name).toBe('my-persona')
    })
  })
})