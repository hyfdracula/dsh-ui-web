#!/usr/bin/env node
/**
 * Link every dsh-web-ui family plugin into the dsh profile's global
 * @captain1275 namespace (~/.dsh/profiles/node_modules/@captain1275).
 *
 * The dsh loader resolves plugin rows (cordis.patch.yml `name:` entries) by
 * Node package resolution from the profile directory, which walks up through
 * ~/.dsh/profiles/node_modules — the layer where the official dsh packages
 * live. Plugins installed through `dsh plugin add` land in the profile's own
 * node_modules and resolve fine; the family links here make the same
 * resolution work for the aggregate bundles (web-ui-all / dsh-skins) whose
 * children are transitively resolved, and repair links left over from older
 * manual setups.
 *
 * Idempotent and safe to rerun: stale links pointing elsewhere are replaced,
 * new packages are added, unrelated entries are left untouched. Real files or
 * directories at a link path are never removed — they are reported and
 * skipped.
 *
 * Usage:
 *   node scripts/link-profile.mjs            # link/refresh the family
 *   node scripts/link-profile.mjs --dry-run  # report without changing
 */
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmdirSync, symlinkSync, unlinkSync } from 'node:fs'
import { dirname, join, relative, resolve as resolvePath } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolvePath(SCRIPT_DIR, '..')

/**
 * Pure decision logic for one link path: what should the caller do with the
 * entry currently sitting at the link path? No filesystem access, so it can
 * be unit-tested directly (see scripts/link-profile.test.mjs).
 *
 * @param {'missing'|'symlink'|'file'|'dir'} existing kind of entry at the link path
 * @param {string} target desired relative symlink target
 * @param {string|null} currentTarget current readlink() value, or null when
 *   the entry is not a symlink (or its link target could not be read)
 * @returns {'create'|'keep'|'replace'|'skip-report'}
 */
export function decideLinkAction(existing, target, currentTarget) {
  if (existing === 'missing') return 'create'
  if (existing === 'symlink') {
    return currentTarget === target ? 'keep' : 'replace'
  }
  // Real file or directory: never unlink it, just report and leave it alone.
  return 'skip-report'
}

function report(msg) {
  console.log(`[link-profile] ${msg}`)
}

/**
 * Resolve the profile home root, matching the dsh runtime: DSH_HOME when set,
 * otherwise ~/.dsh under the user home. `env` and `home` are injectable so the
 * unit tests can pin both sources.
 * @param {Record<string, string | undefined>} [env] - environment to read (defaults to process.env)
 * @param {string} [home] - user home dir (defaults to os.homedir())
 * @returns {string} the profile home root (absolute)
 */
export function resolveHome(env = process.env, home = homedir()) {
  return typeof env.DSH_HOME === 'string' && env.DSH_HOME.length > 0
    ? env.DSH_HOME
    : join(home, '.dsh')
}

/**
 * Repo-containedness check with a separator boundary and (on win32) a
 * case-normalized comparison, so `dsh-ui-web-old/...` is not mistaken for a
 * link inside `dsh-ui-web/...` and Windows case differences do not
 * false-positive the stale scan.
 * @param {string} abs - absolute candidate path
 * @param {string} root - repo root to test containment against
 * @param {boolean} [win32] - compare case-insensitively (default: platform)
 * @returns {boolean} whether abs is root itself or strictly inside it
 */
export function isInsideRepo(abs, root, win32 = process.platform === 'win32') {
  const a = win32 ? abs.toLowerCase() : abs
  const b = win32 ? root.toLowerCase() : root
  // 分隔符随比较模式走（win32 用反斜杠），避免宿主平台 sep 干扰显式传参的测试。
  const boundary = win32 ? '\\' : '/'
  return a === b || a.startsWith(b + boundary)
}

/**
 * Entry-script guard: compare the argv[1] path's file URL against this module's
 * own URL with a case-normalized comparison on win32, and bail out when argv[1]
 * is missing (the module was imported, not run as the entry script).
 * @param {string | undefined} argv1 - process.argv[1]
 * @param {string} metaUrl - import.meta.url of this module
 * @param {boolean} [win32] - case-normalize on win32 (default: platform)
 * @returns {boolean} whether this module was run directly
 */
export function isEntryScript(argv1, metaUrl, win32 = process.platform === 'win32') {
  if (typeof argv1 !== 'string' || argv1.length === 0) return false
  const candidate = pathToFileURL(resolvePath(argv1)).href
  const norm = (s) => win32 ? s.toLowerCase() : s
  return norm(candidate) === norm(metaUrl)
}

/** Family packages publish under this scope; everything else under packages/ is not ours to link. */
const FAMILY_SCOPE = '@captain1275/'

/** Every family package: packages/* and packages/skins/* that has a package.json with a name. */
function familyPackages() {
  const found = []
  const roots = [
    join(REPO_ROOT, 'packages'),
    join(REPO_ROOT, 'packages', 'skins'),
  ]
  for (const root of roots) {
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root).sort()) {
      const pkgJson = join(root, entry, 'package.json')
      if (!existsSync(pkgJson)) continue
      let name
      try { name = JSON.parse(readFileSync(pkgJson, 'utf8')).name } catch { continue }
      if (name && name.startsWith(FAMILY_SCOPE)) {
        found.push({ name: name.slice(FAMILY_SCOPE.length), dir: join(root, entry) })
      }
    }
  }
  return found
}

function main() {
  const DRY = process.argv.includes('--dry-run')

  // 与 dsh 运行时同一解析：DSH_HOME ?? ~/.dsh（install.ps1 会把 DSH_HOME 传进来）。
  const HOME = resolveHome()
  if (!HOME) {
    report('cannot determine home directory (DSH_HOME/HOME is unset and os.homedir() is empty)')
    process.exit(1)
  }
  const PROFILES_NM = join(HOME, 'profiles', 'node_modules')
  const LINK_DIR = join(PROFILES_NM, FAMILY_SCOPE)

  const packages = familyPackages()
  report(`found ${packages.length} family package(s) under packages/`)
  if (DRY) report('--dry-run: no changes will be made')

  if (!existsSync(LINK_DIR)) {
    if (DRY) {
      report(`would create link dir: ${LINK_DIR}`)
      process.exit(0)
    }
    mkdirSync(LINK_DIR, { recursive: true })
    report(`created link dir: ${LINK_DIR}`)
  }

  let changed = 0
  const failures = []
  for (const { name, dir } of packages) {
    const linkPath = join(LINK_DIR, name)
    // Windows without Developer Mode cannot create symlinks (EPERM), so this
    // machine uses directory junctions instead. Junctions require absolute
    // targets and readlink reports the absolute target, so the keep-check
    // compares against that same absolute value on win32.
    const WIN32 = process.platform === 'win32'
    const target = WIN32 ? dir : relative(LINK_DIR, dir) // keep links relative, like the official ones
    let existing = 'missing'
    let linkIsJunctionDir = false
    try {
      const st = lstatSync(linkPath)
      existing = st.isSymbolicLink() ? 'symlink' : st.isDirectory() ? 'dir' : 'file'
      // Windows junctions report as both a symlink and a directory under lstat.
      if (existing === 'symlink' && st.isDirectory()) linkIsJunctionDir = true
    } catch {}
    let current = null
    if (existing === 'symlink') {
      try { current = readlinkSync(linkPath) } catch {}
    }
    const action = decideLinkAction(existing, target, current)
    if (action === 'keep') continue // already correct
    if (action === 'skip-report') {
      if (DRY) {
        report(`would skip ${name} (not a symlink)`)
      } else {
        report(`skipped (not a symlink, untouched): ${linkPath}`)
      }
      continue
    }
    if (action === 'create') {
      if (DRY) { report(`would link ${name} -> ${target}`); changed++; continue }
      try {
        symlinkSync(target, linkPath, WIN32 ? 'junction' : undefined)
        report(`linked ${name} -> ${target}`)
      } catch (e) {
        if (e && e.code === 'EEXIST') {
          // 并发实例抢先创建：保持现状，不算失败（下次重跑会走 keep）。
          report(`link exists already (kept as-is): ${name}`)
        } else {
          report(`warning: failed to link ${name}: ${e instanceof Error ? e.message : String(e)}`)
          failures.push(`link ${name}`)
          continue
        }
      }
    } else {
      if (DRY) { report(`would replace ${name} -> ${current ?? '(broken)'}`); changed++; continue }
      try {
        // Windows junctions are directory reparse points; unlink EPERMs, so rmdir.
        if (linkIsJunctionDir) rmdirSync(linkPath)
        else unlinkSync(linkPath)
        symlinkSync(target, linkPath, WIN32 ? 'junction' : undefined)
        report(`replaced ${name} -> ${target} (was ${current ?? '(broken)'})`)
      } catch (e) {
        if (e && e.code === 'EEXIST') {
          // 移除/重链之间被并发实例接管：保持现状，不算失败。
          report(`link exists already (kept as-is): ${name}`)
        } else {
          report(`warning: failed to replace ${name}: ${e instanceof Error ? e.message : String(e)}`)
          failures.push(`replace ${name}`)
          continue
        }
      }
    }
    changed++
  }

  // Report stale family links (pointing outside this repo) so the user can
  // clean them by hand if needed.
  const stale = []
  for (const entry of readdirSync(LINK_DIR)) {
    const linkPath = join(LINK_DIR, entry)
    let target
    try { target = readlinkSync(linkPath) } catch { continue }
    const abs = resolvePath(LINK_DIR, target)
    const known = packages.some((p) => p.name === entry)
    if (known) continue
    // 路径分隔符边界 + Windows 大小写归一：避免把 dsh-ui-web-old/... 或大小写
    // 变体误判为 repo 内链接。
    if (isInsideRepo(abs, REPO_ROOT)) continue
    stale.push({ entry, target })
  }
  if (stale.length) {
    for (const s of stale) report(`stale (untouched): ${s.entry} -> ${s.target}`)
  }

  if (failures.length) {
    report(`warning: ${failures.length} operation(s) failed: ${failures.join(', ')}`)
    process.exitCode = 1
  }
  report(changed === 0 ? 'nothing to do' : `${changed} link(s) ${DRY ? 'would be ' : ''}updated`)
}

// Run only when invoked as the entry script, so the module can be imported
// (e.g. by the unit tests) without touching the real profile. Windows case
// variants and junction/symlink invocations are normalized by comparing file
// URLs case-insensitively; a missing argv[1] (an import) never runs main().
if (isEntryScript(process.argv[1], import.meta.url)) {
  main()
}
