#!/usr/bin/env node
/**
 * 价目表离线刷新 CLI。
 *
 * 拉取 LiteLLM 全量价目并归一化（与宿主刷新路由共用 pricing-normalize.mjs），
 * 默认写入包内置快照 packages/dsh-usage-dashboard/pricing-default.json（随包
 * 分发，提交进仓库）；`--user` 改写用户级覆盖 $DSH_HOME/usage-pricing.json；
 * `--both` 两处都写。
 *
 * 用法：
 *   node scripts/refresh-pricing.mjs            # 更新包内置快照
 *   node scripts/refresh-pricing.mjs --user     # 更新用户级覆盖
 *   node scripts/refresh-pricing.mjs --both     # 两者都更新
 *   node scripts/refresh-pricing.mjs --fx 7.3   # 指定 USD->CNY 汇率
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { DEFAULT_FX, fetchLiteLLMPricing, normalizeLiteLLM } from '../packages/dsh-usage-dashboard/src/pricing-normalize.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(SCRIPT_DIR, '..')

const args = process.argv.slice(2)
const toUser = args.includes('--user')
const toBoth = args.includes('--both')
const fxIndex = args.indexOf('--fx')
const fx = fxIndex >= 0 ? Number(args[fxIndex + 1]) : DEFAULT_FX
if (!Number.isFinite(fx) || fx <= 0) {
  console.error('[refresh-pricing] invalid --fx value')
  process.exit(1)
}

const userPath = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'usage-pricing.json')
const builtinPath = join(REPO_ROOT, 'packages', 'dsh-usage-dashboard', 'pricing-default.json')

console.log('[refresh-pricing] fetching LiteLLM pricing ...')
const { text, url } = await fetchLiteLLMPricing()
console.log(`[refresh-pricing] source: ${url} (${text.length} bytes)`)
const { snapshot, stats } = normalizeLiteLLM(text, fx)
snapshot._url = url
console.log(`[refresh-pricing] normalized: ${stats.providers} providers, ${stats.models} models, ${stats.aliases} aliases (${stats.aliasConflicts} conflicts skipped, ${stats.skipped} entries skipped), fx=${fx}`)

const payload = JSON.stringify(snapshot)
if (toUser || toBoth) {
  writeFileSync(userPath, payload, 'utf8')
  console.log(`[refresh-pricing] wrote user override: ${userPath}`)
}
if (!toUser || toBoth) {
  writeFileSync(builtinPath, payload, 'utf8')
  console.log(`[refresh-pricing] wrote builtin snapshot: ${builtinPath}`)
}
