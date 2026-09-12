/**
 * Trial (live try-on) tests for the 0.1.5 skin switch: profile resolution from
 * argv, profile-manifest bundle detection, and the backup/restore contract the
 * skin center relies on now that a skin can only mount through the boot graph.
 * Everything runs against a throwaway HOME; the real ~/.dsh is never touched.
 * @module @captain1275/dsh-client-ui-skin-center/tests/trial
 */

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  MANAGED_START,
  appendableBase,
  beginTrial,
  currentActive,
  endTrial,
  profileBundleNames,
  readTrial,
  renderManaged,
  resolveActiveProfile,
  resolvePaths,
  trialBackupPath,
  useSkin,
  type SkinSwitchEntry,
} from '../src/skin-switch.ts'

const AQUA: SkinSwitchEntry = { pkg: '@captain1275/dsh-client-ui-skin-aqua', id: 'ui-skin-aqua', dir: 'unused', bundleWired: false }
const XP: SkinSwitchEntry = { pkg: '@captain1275/dsh-client-ui-skin-xp', id: 'ui-skin-xp', dir: 'unused', bundleWired: false }
const REGISTRY: Record<string, SkinSwitchEntry> = { aqua: AQUA, xp: XP }

const homes: string[] = []
afterAll(() => {
  for (const home of homes) rmSync(home, { recursive: true, force: true })
})

/**
 * A throwaway HOME carrying the profile manifest (bundle list) plus a
 * resolvable install of every skin the tests switch to.
 * @param bundles - package names to list in `dsh.profile.bundles`.
 * @param profile - profile name (its directory is created either way).
 */
function fakeHome(bundles: string[] = [], profile = 'web-next'): string {
  const home = mkdtempSync(join(tmpdir(), 'skin-trial-test-'))
  homes.push(home)
  const profileDir = join(home, '.dsh', 'profiles', profile)
  mkdirSync(join(profileDir, 'node_modules'), { recursive: true })
  writeFileSync(join(profileDir, 'package.json'), JSON.stringify({ name: `dsh-profile-${profile}`, dsh: { profile: { bundles } } }, null, 2))
  mkdirSync(join(home, '.dsh'), { recursive: true })
  for (const entry of [AQUA, XP]) {
    const target = join(profileDir, 'node_modules', entry.pkg)
    mkdirSync(join(target, 'lib'), { recursive: true })
    writeFileSync(join(target, 'package.json'), JSON.stringify({ name: entry.pkg, version: '0.2.4', type: 'module', main: 'lib/index.js' }))
    writeFileSync(join(target, 'lib', 'index.js'), 'export function apply() {}\n')
    writeFileSync(join(target, 'skin.json'), JSON.stringify({ id: entry.id.replace(/^ui-skin-/, ''), package: entry.pkg, wiring: { id: entry.id } }))
  }
  return home
}

describe('resolveActiveProfile', () => {
  it('reads the profile the process was started with', () => {
    expect(resolveActiveProfile(['node', 'bin.js', '--profile', 'web-next', '--port', '3081'], {})).toBe('web-next')
    expect(resolveActiveProfile(['node', 'bin.js', '--profile=desktop'], {})).toBe('desktop')
  })

  it('ignores a flag-shaped next token and falls back to env then web', () => {
    expect(resolveActiveProfile(['node', 'bin.js', '--profile', '--port', '3081'], {})).toBe('web')
    expect(resolveActiveProfile(['node', 'bin.js'], { DSH_SKIN_PROFILE: 'custom' })).toBe('custom')
    expect(resolveActiveProfile(['node', 'bin.js'], {})).toBe('web')
  })
})

describe('profileBundleNames', () => {
  it('lists the profile manifest bundle names', () => {
    const home = fakeHome(['@captain1275/dsh-client-ui-skin-aqua', '@deepseek-ai/dsh-base'])
    expect(profileBundleNames('web-next', home)).toEqual(['@captain1275/dsh-client-ui-skin-aqua', '@deepseek-ai/dsh-base'])
  })

  it('returns an empty list for a missing or malformed manifest', () => {
    const home = fakeHome()
    expect(profileBundleNames('nope', home)).toEqual([])
  })
})

describe('renderManaged with a bundled skin', () => {
  it('never inserts a row for a skin the profile already bundles', () => {
    const rendered = renderManaged('aqua', REGISTRY, [AQUA.pkg])
    expect(rendered).toContain(MANAGED_START)
    // The duplicate-loader-entry crash: no insert row for a bundled skin.
    expect(rendered).not.toContain('- insert:')
    expect(rendered).toContain('- id: ui-skin-xp')
  })

  it('inserts a row for a skin nothing else wires', () => {
    const rendered = renderManaged('aqua', REGISTRY, [])
    expect(rendered).toContain('- insert:')
    expect(rendered).toContain(`name: '${AQUA.pkg}'`)
  })
})

describe('trial lifecycle', () => {
  it('backs the patch up once, applies the trial skin, and restores on exit', () => {
    const home = fakeHome([AQUA.pkg])
    const opts = { home, profile: 'web-next', registry: REGISTRY }
    // The user's baseline: xp active via the managed section.
    useSkin('xp', opts)
    const baseline = readFileSync(resolvePaths(home, 'web-next').patchPath, 'utf8')
    expect(currentActive(baseline, REGISTRY)).toBe('xp')

    const started = beginTrial('aqua', opts)
    expect(started.trial.skin).toBe('aqua')
    const patchPath = resolvePaths(home, 'web-next').patchPath
    const during = readFileSync(patchPath, 'utf8')
    expect(existsSync(trialBackupPath(patchPath))).toBe(true)
    expect(readTrial({ home, profile: 'web-next', registry: REGISTRY })?.skin).toBe('aqua')
    // aqua is bundled, so the trial must not add an insert row for it.
    expect(during).not.toContain('- insert:')

    const message = endTrial({ home, profile: 'web-next' })
    expect(message).toContain('trial ended')
    expect(readFileSync(patchPath, 'utf8')).toBe(baseline)
    expect(existsSync(trialBackupPath(patchPath))).toBe(false)
    expect(readTrial({ home, profile: 'web-next', registry: REGISTRY })).toBeNull()
  })

  it('keeps the pre-trial patch when a second trial starts inside the first', () => {
    const home = fakeHome()
    const opts = { home, profile: 'web-next', registry: REGISTRY }
    useSkin('official', opts)
    const baseline = readFileSync(resolvePaths(home, 'web-next').patchPath, 'utf8')

    beginTrial('aqua', opts)
    beginTrial('xp', opts)
    expect(readTrial({ home, profile: 'web-next', registry: REGISTRY })?.skin).toBe('xp')

    endTrial({ home, profile: 'web-next' })
    expect(readFileSync(resolvePaths(home, 'web-next').patchPath, 'utf8')).toBe(baseline)
  })

  it('removes the patch file again when the user had none before the trial', () => {
    const home = fakeHome([AQUA.pkg])
    const opts = { home, profile: 'web-next', registry: REGISTRY }
    const patchPath = resolvePaths(home, 'web-next').patchPath
    expect(existsSync(patchPath)).toBe(false)

    beginTrial('aqua', opts)
    expect(existsSync(patchPath)).toBe(true)

    endTrial({ home, profile: 'web-next' })
    // An empty cordis.patch.yml is not a patch list: the loader would refuse
    // the next boot, so the file must be gone, not empty.
    expect(existsSync(patchPath)).toBe(false)
  })

  it('collapses a bare [] base instead of appending after a closed list', () => {
    const home = fakeHome([AQUA.pkg])
    const opts = { home, profile: 'web-next', registry: REGISTRY }
    const patchPath = resolvePaths(home, 'web-next').patchPath
    // `dsh` writes `[]` into a patch file it has nothing to put in; appending a
    // managed section after it produces a YAML parse error and the Host refuses
    // to boot (measured).
    writeFileSync(patchPath, '[]\n')
    beginTrial('aqua', opts)
    const written = readFileSync(patchPath, 'utf8')
    expect(written.trimStart().startsWith('[]')).toBe(false)
    expect(written).toContain(MANAGED_START)
    expect(appendableBase('[]\n')).toBe('')
    expect(appendableBase('[]\r\n')).toBe('')
  })

  it('reports no trial when the backup is absent', () => {
    const home = fakeHome()
    expect(readTrial({ home, profile: 'web-next', registry: REGISTRY })).toBeNull()
    expect(endTrial({ home, profile: 'web-next' })).toBe('no trial is running.')
  })

  it('refuses an unknown skin instead of writing a broken patch', () => {
    const home = fakeHome()
    expect(() => beginTrial('nope', { home, profile: 'web-next', registry: REGISTRY }))
      .toThrow(/unknown skin "nope"/)
    expect(existsSync(trialBackupPath(resolvePaths(home, 'web-next').patchPath))).toBe(false)
  })
})

