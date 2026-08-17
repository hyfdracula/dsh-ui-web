/**
 * Unit tests for the pure link-state decision logic in link-profile.mjs.
 *
 * Importing link-profile.mjs must not execute main() (it is guarded by the
 * entry-script check), so these tests never touch the real ~/.dsh profile.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { decideLinkAction, isEntryScript, isInsideRepo, resolveHome } from './link-profile.mjs'

const TARGET = '../../dsh-web-ui/packages/dsh-web-ui'

test('missing -> create', () => {
  assert.equal(decideLinkAction('missing', TARGET, null), 'create')
})

test('symlink to target -> keep', () => {
  assert.equal(decideLinkAction('symlink', TARGET, TARGET), 'keep')
})

test('symlink to other -> replace', () => {
  assert.equal(decideLinkAction('symlink', TARGET, '../something-else'), 'replace')
})

test('broken symlink -> replace', () => {
  assert.equal(decideLinkAction('symlink', TARGET, null), 'replace')
})

test('real file -> skip', () => {
  assert.equal(decideLinkAction('file', TARGET, null), 'skip-report')
})

test('real dir -> skip', () => {
  assert.equal(decideLinkAction('dir', TARGET, null), 'skip-report')
})

test('resolveHome prefers DSH_HOME over the default user home', () => {
  assert.equal(resolveHome({ DSH_HOME: 'C:/custom/dsh' }, 'C:/Users/me'), 'C:/custom/dsh')
})

test('resolveHome falls back to ~/.dsh when DSH_HOME is unset or empty', () => {
  assert.equal(resolveHome({}, 'C:/Users/me'), join('C:/Users/me', '.dsh'))
  assert.equal(resolveHome({ DSH_HOME: '' }, 'C:/Users/me'), join('C:/Users/me', '.dsh'))
})

test('resolveHome keeps an explicit DSH_HOME that points elsewhere', () => {
  assert.equal(resolveHome({ DSH_HOME: '/srv/dsh-state' }, '/home/me'), '/srv/dsh-state')
})

test('isInsideRepo requires a separator boundary (win32 style)', () => {
  const root = 'C:\\repo\\dsh-ui-web'
  assert.equal(isInsideRepo('C:\\repo\\dsh-ui-web', root, true), true)
  assert.equal(isInsideRepo('C:\\repo\\dsh-ui-web\\packages\\x', root, true), true)
  assert.equal(isInsideRepo('C:\\repo\\dsh-ui-web-old\\x', root, true), false)
  assert.equal(isInsideRepo('C:\\repo\\dsh-ui-webx', root, true), false)
})

test('isInsideRepo requires a separator boundary (posix style)', () => {
  const root = '/mnt/repo/dsh-ui-web'
  assert.equal(isInsideRepo('/mnt/repo/dsh-ui-web', root, false), true)
  assert.equal(isInsideRepo('/mnt/repo/dsh-ui-web/packages/x', root, false), true)
  assert.equal(isInsideRepo('/mnt/repo/dsh-ui-web-old/x', root, false), false)
  assert.equal(isInsideRepo('/mnt/repo/dsh-ui-webx', root, false), false)
})

test('isInsideRepo normalizes case on win32', () => {
  const root = 'C:\\repo\\dsh-ui-web'
  assert.equal(isInsideRepo('c:\\REPO\\DSH-UI-WEB\\packages\\x', root, true), true)
  assert.equal(isInsideRepo('C:\\REPO\\DSH-UI-WEB-OLD\\x', root, true), false)
})

test('isInsideRepo stays case-sensitive off win32', () => {
  const root = '/mnt/repo/dsh-ui-web'
  assert.equal(isInsideRepo('/mnt/repo/DSH-UI-WEB/x', root, false), false)
  assert.equal(isInsideRepo('/mnt/repo/dsh-ui-web/x', root, false), true)
})

test('isEntryScript matches the real meta url on win32 with case variance', () => {
  const meta = 'file:///C:/repo/dsh-ui-web/scripts/link-profile.mjs'
  assert.equal(isEntryScript('C:\\REPO\\DSH-UI-WEB\\scripts\\link-profile.mjs', meta, true), true)
  assert.equal(isEntryScript('C:\\repo\\dsh-ui-web\\scripts\\link-profile.mjs', meta, true), true)
  assert.equal(isEntryScript('C:\\repo\\dsh-ui-web\\scripts\\other.mjs', meta, true), false)
})

test('isEntryScript bails out on missing argv[1] (import, not a run)', () => {
  const meta = 'file:///C:/repo/dsh-ui-web/scripts/link-profile.mjs'
  assert.equal(isEntryScript(undefined, meta, true), false)
  assert.equal(isEntryScript('', meta, true), false)
})

test('isEntryScript stays case-sensitive off win32', () => {
  const meta = 'file:///C:/repo/dsh-ui-web/scripts/link-profile.mjs'
  assert.equal(isEntryScript('C:\\repo\\dsh-ui-web\\scripts\\link-profile.mjs', meta, false), true)
  assert.equal(isEntryScript('C:\\REPO\\dsh-ui-web\\scripts\\link-profile.mjs', meta, false), false)
})