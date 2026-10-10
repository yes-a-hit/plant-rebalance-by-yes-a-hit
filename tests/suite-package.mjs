/**
 * 交付物一致性断言：清单字段、三份数据补丁、许可与声明、README 口径。
 * 设置 JBTMG_PKG_ROOT 后可校验任意解包目录（用于验证发布的 ZIP）。
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { ok, section } from './harness.mjs'

export function runPackage({ pkgRoot }) {
  section('E. 包内容一致性')
  console.log(`  （校验目录：${pkgRoot}）`)

  const at = (rel) => path.join(pkgRoot, rel)

  // ── 清单 ──
  const packJson = JSON.parse(readFileSync(at('pack.json'), 'utf8'))
  ok(packJson.uuid === 'yes-a-hit.plant-rebalance', 'uuid = yes-a-hit.plant-rebalance', packJson.uuid)
  ok(packJson.name === 'Plant Rebalance by yes-a-hit', 'name = Plant Rebalance by yes-a-hit', packJson.name)
  ok(packJson.version === '4.0.0', 'version = 4.0.0', packJson.version)
  ok(packJson.apiVersion === 2, 'apiVersion = 2')
  ok(packJson.js && packJson.js.startup === true, 'js.startup = true（engine 访问权前提）')
  ok(!('requiredGpNextFeatures' in packJson), '未声明 requiredGpNextFeatures（本版本会拒绝加载）')
  ok(packJson.js.entry === 'scripts/main.js', 'js.entry 指向 scripts/main.js')
  ok(packJson.author === 'yes-a-hit', 'author = yes-a-hit', packJson.author)
  ok(!('depends' in packJson) && !('optionalDepends' in packJson), '无额外前置依赖')

  // ── 数据补丁：植物数值 ──
  const props = JSON.parse(readFileSync(at('jsons/objects/PlantProps.json'), 'utf8'))
  ok(props.objects.length === 39, '植物数值补丁 39 条', String(props.objects.length))
  ok(props.objects.every((o) => o.objclass === 'PlantProperties'), 'objclass 全部为 PlantProperties')
  ok(props.objects.every((o) => Array.isArray(o.aliases) && o.aliases.length === 1), '每条只有一个 alias')
  const aliasList = props.objects.map((o) => o.aliases[0])
  ok(new Set(aliasList).size === aliasList.length, '补丁里没有重复条目')

  const pvine = props.objects.find((o) => o.aliases[0] === 'pvine')
  ok(pvine && pvine.objdata.SunCost === 175,
    '豌豆藤 = 175 阳光（特性 3 的再平衡基准）', pvine ? String(pvine.objdata.SunCost) : '(缺失)')
  const sling = props.objects.find((o) => o.aliases[0] === 'slingpea')
  ok(sling && sling.objdata.SunCost === 250, '豌豆迫击炮 = 250 阳光', sling ? String(sling.objdata.SunCost) : '(缺失)')
  ok(sling && sling.objdata.ShootInterval && typeof sling.objdata.ShootInterval === 'object',
    '豌豆迫击炮的 ShootInterval 是区间对象（保持原结构类型）',
    sling ? JSON.stringify(sling.objdata.ShootInterval) : '')
  const primal = props.objects.find((o) => o.aliases[0] === 'primalwallnut')
  ok(primal && primal.objdata.Toughness === 5000 && primal.objdata.ArmorToughness === 5000,
    '原始坚果墙本体与护甲同为 5000')

  // ── 数据补丁：投射物 ──
  const prj = JSON.parse(readFileSync(at('jsons/objects/ProjectileProps.json'), 'utf8'))
  ok(prj.objects.length === 8, '投射物伤害补丁 8 条', String(prj.objects.length))
  ok(prj.objects.every((o) => o.objclass === 'ProjectileProperties'), 'objclass 全部为 ProjectileProperties')
  ok(prj.objects.every((o) => typeof o.objdata.Damage === 'number'), '全部带 Damage')

  // ── 数据补丁：图鉴全量同步 ──
  const alm = JSON.parse(readFileSync(at('jsons/objects/PlantAlmanac.json'), 'utf8'))
  ok(alm.objects.length === 46, '图鉴同步 46 条', String(alm.objects.length))
  ok(alm.objects.every((o) => o.objclass === 'PlantAlmanacProperties'), 'objclass 全部为 PlantAlmanacProperties')
  ok(alm.objects.every((o) => o.objdata && o.objdata.Special),
    '每条图鉴都带 Special（「平衡改动」说明写在里面）')

  // ── 许可与声明 ──
  ok(existsSync(at('LICENSE')), 'LICENSE 存在')
  ok(existsSync(at('NOTICE.md')), 'NOTICE.md 存在')
  const license = readFileSync(at('LICENSE'), 'utf8')
  ok(license.startsWith('MIT License'), 'LICENSE 以标准标题开头')
  ok(license.includes('Copyright (c) 2026'), 'LICENSE 含版权行')
  ok(license.trim().endsWith('SOFTWARE.'), 'LICENSE 以标准 MIT 全文结尾，未追加附加条款')

  const notice = readFileSync(at('NOTICE.md'), 'utf8')
  ok(notice.includes('不含任何第三方模组代码'), 'NOTICE 声明不含第三方模组代码')
  ok(notice.includes('互操作'), 'NOTICE 说明游戏数据的互操作性边界')
  ok(notice.includes('商标'), 'NOTICE 覆盖商标归属')

  // ── README 口径 ──
  const readme = readFileSync(at('README.md'), 'utf8')
  ok(readme.includes('## 特性'), 'README 含「特性」章节')
  ok(/连射/.test(readme), 'README 写入了「连射」特性')
  ok(readme.includes('175'), 'README 说明了豌豆藤 175 的再平衡理由')
  ok(readme.includes('继承'), 'README 写入了「迫击炮特殊攻击被继承」特性')
  ok(readme.includes('NOTICE.md'), 'README 指向 NOTICE.md')
  ok(readme.includes('不需要任何额外脚本'), 'README 明确说明无需额外脚本')
  ok(!/fix-mod-startup|点\s*bat/i.test(readme), 'README 不含「点 bat」式安装指引')

  const installPath = at('docs/INSTALL.md')
  if (existsSync(installPath)) {
    const install = readFileSync(installPath, 'utf8')
    ok(!/fix-mod-startup|点\s*bat|回来找作者/i.test(install), 'INSTALL.md 不含「点 bat」式指引')
    ok(install.includes('与本模组无关'), 'INSTALL.md 把 afterProject 归因到环境而非本模组')
  }
}
