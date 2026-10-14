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
  ok(packJson.version === '4.1.24', 'version = 4.1.24', packJson.version)
  // 启动横幅里打的版本号必须和 pack.json 一致 —— 否则用户看到的是旧版号，
  // 会让"到底装的哪一版"无法判断（此前为此空转过一轮）。
  const mainSrc = readFileSync(at('scripts/main.js'), 'utf8')
  const mv = mainSrc.match(/const MOD_VERSION = '([^']+)'/)
  ok(mv && mv[1] === packJson.version, 'MOD_VERSION 与 pack.json 版本一致',
    mv ? mv[1] : '(未找到 MOD_VERSION)')
  ok(packJson.apiVersion === 2, 'apiVersion = 2')
  ok(packJson.js && packJson.js.startup === true, 'js.startup = true（engine 访问权前提）')
  ok(!('requiredGpNextFeatures' in packJson), '未声明 requiredGpNextFeatures（本版本会拒绝加载）')
  ok(packJson.js.entry === 'scripts/main.js', 'js.entry 指向 scripts/main.js')
  ok(packJson.author === 'yes-a-hit', 'author = yes-a-hit', packJson.author)
  ok(!('depends' in packJson) && !('optionalDepends' in packJson), '无额外前置依赖')

  // ── 数据补丁：植物数值 ──
  const props = JSON.parse(readFileSync(at('jsons/objects/PlantProps.json'), 'utf8'))
  ok(props.objects.length === 41, '植物数值补丁 41 条', String(props.objects.length))
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
  ok(prj.objects.length === 16, '投射物补丁 16 条（伤害 + 点火链 + 爆裂藤蔓 + 迫击炮 + 暗影火龙果）', String(prj.objects.length))
  ok(prj.objects.every((o) => o.objclass === 'ProjectileProperties'), 'objclass 全部为 ProjectileProperties')
  ok(prj.objects.every((o) => typeof o.objdata.Damage === 'number' || typeof o.objdata.YellowIgnitedType === 'string'),
    '每条要么带 Damage、要么带点火链 YellowIgnitedType')

  // ── 点火链（柴火藤蔓的转换规则）──
  const findPrj = (n) => prj.objects.find((o) => o.aliases[0] === n)

  // ── 暗物质火龙果：主目标伤害 40 -> 80（两种形态都要）──
  ok((findPrj('darkmatter') || {}).objdata.Damage === 80, '暗物质火龙果（正常形态）主目标 80',
    String((findPrj('darkmatter') || {}).objdata.Damage))
  ok((findPrj('darkmatter_shadow') || {}).objdata.Damage === 80, '暗物质火龙果（暗影形态）主目标 80',
    String((findPrj('darkmatter_shadow') || {}).objdata.Damage))

  ok((findPrj('winter_melon') || {}).objdata.YellowIgnitedType === 'melon', '冰西瓜 → 西瓜')
  ok((findPrj('cabbage') || {}).objdata.YellowIgnitedType === 'pepper', '卷心菜 → 甜椒')
  ok((findPrj('pea_flame_yellow') || {}).objdata.YellowIgnitedType === 'pea_flame_blue',
    '火焰豌豆（黄火）→ 蓝火',
    String((findPrj('pea_flame_yellow') || {}).objdata.YellowIgnitedType))
  ok((findPrj('pea_sling_0_pf') || {}).objdata.YellowIgnitedType === 'pea_sling_0_pf_flame_blue',
    '豌豆迫击炮大招豆 → 蓝火',
    String((findPrj('pea_sling_0_pf') || {}).objdata.YellowIgnitedType))
  ok((findPrj('coconut') || {}).objdata === undefined, '椰子炮弹不进点火表（保持不变）')
  ok((findPrj('blastberry') || {}).objdata.YellowIgnitedType === 'cantaloupe',
    '爆裂藤蔓的弹 → 哈密瓜',
    String((findPrj('blastberry') || {}).objdata.YellowIgnitedType))
  ok((findPrj('blastberry') || {}).objdata.Damage === 120, '爆裂藤蔓伤害提升 20%（100 → 120）',
    String((findPrj('blastberry') || {}).objdata.Damage))
  ok((findPrj('blastberry') || {}).objdata.KnockbackDistance === 1,
    '爆裂藤蔓带击退（KnockbackDistance = 1）',
    String((findPrj('blastberry') || {}).objdata.KnockbackDistance))

  // ── 藤蔓阳光 ──
  const findPlant = (n) => props.objects.find((o) => o.aliases[0] === n)
  ok((findPlant('pyrevine') || {}).objdata.SunCost === 150, '柴火藤蔓 150 阳光',
    String((findPlant('pyrevine') || {}).objdata.SunCost))
  ok((findPlant('gloomvine') || {}).objdata.SunCost === 200, '忧郁藤蔓 200 阳光',
    String((findPlant('gloomvine') || {}).objdata.SunCost))
  ok((findPlant('nightshade') || {}).objdata.SunCost === 75, '暗影龙葵已恢复 75 阳光',
    String((findPlant('nightshade') || {}).objdata.SunCost))
  ok((findPlant('nightshade') || {}).objdata.ShadowPoweredDamageScale === 0.5,
    '暗影龙葵保持原版暗影惩罚 0.5（解除半伤由忧郁藤蔓同格光环负责，不是全局数据）',
    String((findPlant('nightshade') || {}).objdata.ShadowPoweredDamageScale))

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
  ok(readme.includes('DSH') && readme.includes('DeepSeek V4.1f'),
    'README 声明了 DSH 与 DeepSeek V4.1f 的协作开发')
  ok(readme.includes('不需要任何额外脚本'), 'README 明确说明无需额外脚本')
  ok(!/fix-mod-startup|点\s*bat/i.test(readme), 'README 不含「点 bat」式安装指引')

  const installPath = at('docs/INSTALL.md')
  if (existsSync(installPath)) {
    const install = readFileSync(installPath, 'utf8')
    ok(!/fix-mod-startup|点\s*bat|回来找作者/i.test(install), 'INSTALL.md 不含「点 bat」式指引')
    ok(install.includes('与本模组无关'), 'INSTALL.md 把 afterProject 归因到环境而非本模组')
  }
}
