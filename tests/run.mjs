/**
 * 测试入口：校验入口导出、挂载表、宿主兜底、交付物一致性。
 *
 * 用法：
 *   node tests/run.mjs                       # 校验仓库根
 *   JBTMG_PKG_ROOT=<dir> node tests/run.mjs  # 校验解包目录
 *   JBTMG_ENTRY=<file>   node tests/run.mjs  # 指定要加载的模组入口
 *
 * 后两个环境变量由 tools/pack.ps1 在打包后做「用发布产物复测」时使用。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { ok, section, summary, makeCtx } from './harness.mjs'
import { runPackage } from './suite-package.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const pkgRoot = process.env.JBTMG_PKG_ROOT
  ? path.resolve(process.env.JBTMG_PKG_ROOT)
  : repoRoot
const entryFile = process.env.JBTMG_ENTRY
  ? path.resolve(process.env.JBTMG_ENTRY)
  : path.join(repoRoot, 'scripts', 'main.js')

const entryMod = await import(pathToFileURL(entryFile).href)
const mod = entryMod.default

section('0. 入口与导出')
console.log(`  （入口：${entryFile}）`)
ok(!!mod && typeof mod === 'object', '入口有默认导出')
ok(typeof mod.startup === 'function', '导出 startup()')
ok(typeof mod.setup === 'function', '导出 setup()')

section('1. 挂载表（源码静态检查）')
{
  const src = readFileSync(entryFile, 'utf8')
  const labels = [...src.matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1])
  ok(labels.length >= 12, '目标条目至少 12 条', String(labels.length))
  for (const need of ['豌豆迫击炮', '双发射手', '三发射手', '豌豆射手', '寒冰射手', '高坚果']) {
    ok(labels.some((l) => l.includes(need)), `挂载表含「${need}」`)
  }
  for (const group of ['WEIGHT_TARGETS', 'EXTRA_SHOT_TARGETS', 'FOOD_TARGETS', 'DEATHRATTLE_TARGETS']) {
    ok(new RegExp('const\\s+' + group).test(src), `存在 ${group} 目标组`)
  }
  ok(/PeaTypePlantfood/.test(src), '大招替换走 PeaTypePlantfood（只换类型，不触发无敌）')
}

section('2. 宿主兜底')
{
  const bare = { log: { info() {}, warn() {}, error() {} }, ui: { toast() {} } }
  let threw = false
  try {
    mod.startup(bare)
    mod.setup(bare)
  } catch (e) { threw = true; console.log('    (异常: ' + e.message + ')') }
  ok(!threw, '只有 log / ui 的残缺 ctx，startup + setup 不抛异常')
  ok(makeCtx() !== null, '测试用 ModContext 工厂可用')
}

runPackage({ pkgRoot })

summary()
