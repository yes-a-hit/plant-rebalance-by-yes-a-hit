/**
 * 综合平衡调整 — 运行期入口
 *
 * 四类效果，同一套钩子框架：
 *   A. table      —— 按权重把 objdataOwn.PeaType 换成别的弹种
 *   B. extraShots —— 概率额外调用 _shoot()，实现"一次多颗 / 三连发"
 *   C. foodChance —— 概率把弹种换成 PeaTypePlantfood，即"发射大招弹"（不含无敌效果）
 *   D. deathrattle—— 死亡时弹起砸地，对左右各一格造成范围伤害（高坚果专用，仿 SquashPlant）
 *
 * ── 引擎事实（对 0.14.0 的 assets/main/index.js 核对所得）──
 *   · 发射流程：动画事件 → 监听器 → 读 this.objdataOwn.PeaType → 生成投射物
 *   · 投射物生成接口是单发的（shootOnePea(type, pos, height, layer, velocity, side, boosted)），
 *     所以"一次 N 颗"靠额外调用 this._shoot() 实现。
 *   · 各植物有 foodShoot 分支：把类型换成 PeaTypePlantfood 即为大招弹。
 *   · 监听器分 animationListener 与 specialPeashooterAnimationListener 两种。
 *   · fooding 为真时（正在放大招）一律不干预。
 */

const WEIGHT_TARGETS = [
  {
    label: '豌豆迫击炮',
    cls: 'SlingPeaPlant',
    module: 'chunks:///_virtual/SlingPea.ts',
    listener: 'animationListener',
    fireEvents: ['shoot'],
    table: [
      { type: 'pea', weight: 50, name: '普通豌豆' },
      { type: 'pea_primal', weight: 40, name: '原始大豌豆' },
      { type: 'coconut', weight: 10, name: '椰子炸弹' },
    ],
  },
  {
    label: '双发射手',
    cls: 'RepeaterPlant',
    module: 'chunks:///_virtual/Repeater.ts',
    listener: 'animationListener',
    fireEvents: ['Shoot'],
    table: [
      { type: 'pea', weight: 70, name: '普通豌豆' },
      { type: 'pea_flame_yellow', weight: 15, name: '火焰豌豆' },
      { type: 'pea_snow', weight: 15, name: '寒冰豌豆' },
    ],
  },
  {
    label: '三发射手',
    cls: 'ThreePeaterPlant',
    module: 'chunks:///_virtual/ThreePeater.ts',
    listener: 'animationListener',
    fireEvents: ['shootM', 'shootU', 'shootD'],
    table: [
      { type: 'pea', weight: 70, name: '普通豌豆' },
      { type: 'pea_flame_yellow', weight: 15, name: '火焰豌豆' },
      { type: 'pea_snow', weight: 15, name: '寒冰豌豆' },
    ],
  },
  {
    label: '裂荚射手',
    cls: 'SplitPeaPlant',
    module: 'chunks:///_virtual/SplitPea.ts',
    listener: 'specialPeashooterAnimationListener',
    fireEvents: ['ShootL', 'ShootR'],
    table: [
      { type: 'pea', weight: 70, name: '普通豌豆' },
      { type: 'pea_flame_yellow', weight: 15, name: '火焰豌豆' },
      { type: 'pea_snow', weight: 15, name: '寒冰豌豆' },
    ],
  },
  {
    label: '豌豆荚',
    cls: 'PeaPodPlant',
    module: 'chunks:///_virtual/PeaPod.ts',
    listener: 'animationListener',
    fireEvents: ['Shoot0', 'Shoot1', 'Shoot2', 'Shoot3', 'Shoot4'],
    table: [
      { type: 'pea', weight: 70, name: '普通豌豆' },
      { type: 'pea_flame_yellow', weight: 15, name: '火焰豌豆' },
      { type: 'pea_snow', weight: 15, name: '寒冰豌豆' },
    ],
  },
  {
    label: '寒冰射手',
    cls: 'SnowPeaPlant',
    module: 'chunks:///_virtual/SnowPea.ts',
    listener: 'animationListener',
    fireEvents: ['Shoot'],
    table: [
      { type: 'pea_snow', weight: 90, name: '寒冰豌豆' },
      { type: 'snowdrop', weight: 10, name: '雪滴花冰锥' },
    ],
  },
]

/** B 类：概率额外射击（多发 / 三连发） */
const EXTRA_SHOT_TARGETS = [
  {
    label: '豌豆射手',
    cls: 'PeashooterPlant',
    module: 'chunks:///_virtual/Peashooter.ts',
    listener: 'animationListener',
    fireEvents: ['Shoot'],
    chance: 0.1,
    extraShots: 3,
    delaySeconds: 0.15,
  },
  {
    label: '毒液豌豆',
    cls: 'GooPeashooterPlant',
    module: 'chunks:///_virtual/GooPeashooter.ts',
    listener: 'animationListener',
    fireEvents: ['Shoot'],
    chance: 0.2,
    extraShots: 2,
    delaySeconds: 0.15,
  },
  {
    label: '火焰豌豆',
    cls: 'FirePeashooterPlant',
    module: 'chunks:///_virtual/FirePeashooter.ts',
    listener: 'animationListener',
    fireEvents: ['Shoot'],
    chance: 0.2,
    extraShots: 2,
    extraType: 'pea_flame_blue',
  },
]

/** C 类：概率发射大招弹（不含无敌） */
const FOOD_TARGETS = [
  {
    label: '电能豌豆',
    cls: 'ElectricPeashooter',
    module: 'chunks:///_virtual/ElectricPeashooter.ts',
    listener: 'animationListener',
    fireEvents: ['Shoot'],
    chance: 0.05,
  },
  {
    label: '充能柚子',
    cls: 'CitronPlant',
    module: 'chunks:///_virtual/Citron.ts',
    listener: 'animationListener',
    fireEvents: ['shoot'],
    chance: 0.05,
  },
]

/** D 类：亡语 —— 被啃死的那一瞬间弹起来砸地，左右各一格吃 1800 伤害（仿倭瓜）
 *  hook 点是 WallNutPlant.specialPlantOnKilled（Plant.die 内部唯一的"被敌人打死"分支），
 *  铲子和被吃掉以外的移除不会触发，所以不用担心白嫖伤害。
 */
const DEATHRATTLE_TARGETS = [
  {
    label: '高坚果',
    cls: 'TallnutPlant',
    module: 'chunks:///_virtual/TallNut.ts',
    listener: 'specialPlantOnKilled',
    deathrattle: true,
    damage: 1800,
    rangeSquares: 2, // 以自身为中心、左右各一格
    leapHeight: 110, // 世界单位，和倭瓜的 120 同量级
    leapUpSeconds: 0.14,
    leapDownSeconds: 0.1,
  },
]

/** E 类：柴火藤蔓 —— 点燃经过的投射物
 *
 *  引擎里的点火机制在 `Torchwood`：
 *    ignite(prj) {
 *      prj.torchwoodWaiting = true
 *      const np = await PrjFunctions.shootOnePea(prj.YellowIgnited, ...)
 *      np.copy(prj, false,false,false, true,true,true,true,true,true)
 *      prj.fade()                    // 原投射物消失
 *    }
 *  投射物上带着 `YellowIgnited` 字段（来自数据里的 `YellowIgnitedType`），
 *  它指明「被点着之后变成哪一种弹」—— 转换规则本身就是数据。
 *
 *  与火炬树桩的差别：这里连**抛物线投掷物**一起点（lobbed: true），
 *  所以西瓜 / 冰西瓜 / 卷心菜也吃得到。
 */
/** E 类：柴火藤蔓 —— 发射时直接把弹种换掉
 *
 *  不再「事后扫本行的投射物再逐颗点着」。那个做法有三个毛病，实测全中：
 *    · 依赖池子扫描与时机，点燃不稳定、概率忽高忽低
 *    · 依赖坐标判定「是否同格」，判不准就波及整行
 *    · 需要防重入 + 清理引用，复杂度高且反复出问题
 *
 *  改为在**发射的那一刻**替换弹种：挂 `_shoot`（豌豆系）与
 *  `_lobToZombie`（投手系）—— 弹种本来就以参数形式传进去，直接改参数即可。
 *  这样天然只作用于「本格植物发出的弹」，不需要任何事后范围判断。
 *
 *  转换规则见 PYRE_SWAP_MAP。命中不了的一律原样放行。
 */
const PYRE_SWAP_TARGETS = [
  {
    label: '柴火藤蔓·同格换弹',
    cls: 'LnC',
    module: 'chunks:///_virtual/LnC.ts',
    listener: 'update',
    pyreSync: true,
  },
]

/** F 类：忧郁藤蔓 —— 给所在行挂「暗影状态」
 *
 *  引擎机制（Plant 每帧检查 + LnC 承载）：
 *    // 植物侧
 *    if (this.haveDarkMode) {
 *      if (this.inLnC?.shadowCD > 0 && !this.ShadowPowered) {
 *        this.ShadowPowered = true          // 进入暗影形态
 *        this.onShadowPoweredChanged()
 *      }
 *    }
 *    // 行侧
 *    LnC.setShadowBuff(秒数)   →  this.shadowCD = ...
 *    LnC.update: shadowCD > 0 && (shadowCD -= dt)
 *
 *  `shadowCD` 是**行级**的，所以只要每帧给本行续上一个小量，
 *  同行所有带 `haveDarkMode` 的植物就会持续处于暗影状态 ——
 *  这正是「在暗影拖鞋上」的效果：龙葵解除半伤、暗物质火龙果换弹种、
 *  幽暮投手扩成三条道、暗影豌豆保持原样。
 */
/** 忧郁藤蔓的暗影光环：只作用于同格那一株（实现见 applyGloomShadow）。
 *  注意：本数组必须在 ALL_TARGETS 之前定义 —— const 有暂时性死区，
 *  写在后面会在模块加载时直接抛错。 */
const SHADOW_AURA_TARGETS = [
  {
    label: '忧郁藤蔓暗影光环（仅同格）',
    cls: 'Plant',
    module: 'chunks:///_virtual/Plant.ts',
    listener: 'judgeShadowPlantMode',
    gloomShadow: true,
  },
]

/** G 类：柴火藤蔓禁种名单
 *
 *  引擎的种植准入在 `LnC.putPlantAvailable`，它按植物的 `TAGS` 分派：
 *    -1 != TAGS.indexOf("vine") ? this.vineable(p, e, n) : ...
 *  而 `vineable` **只看格子里有没有藤蔓**，完全不看「底座是哪一种植物」——
 *  也就是说「这几种不能种在柴火藤蔓上」这条规则引擎里根本不存在，必须由模组拦。
 *
 *  这里 hook `putPlantAvailable`：先让引擎判，若通过、且格子里有柴火藤蔓、
 *  且待种植物在黑名单里，就返回 false 拒绝。
 */
const PYRE_BLOCK_NAMES = [
  'coldsnapdragon',   // 冰龙草
  'iceburg',          // 冰生菜
  'snowdrop',         // 雪滴花
  'pepperpult',       // 甜椒投手
  'missiletoe',       // 冰仙子
  'icebloom',         // 寒冰蓓蕾
  'hurrikale',        // 飓风甘蓝
  'glaciershroom',    // 寒冰菇
]

/** H 类：西瓜类投手 + 爆裂藤蔓 → 索敌扩成三条道
 *
 *  需求：西瓜投手 / 冰西瓜 / 哈密瓜投手 种在爆裂藤蔓上时，
 *  索敌范围从「本道」扩成「上中下三条道」。
 *
 *  引擎事实（CabbagePultPlant，三个投手的共同基类）：
 *    detectEnemy() { return this.inLane.zombiePool().some(z =>
 *        this.zombieIsVisible(z) && this.detector.judgeCrossRec(z.bodyRec)) || ... }
 *      —— 只看 this.inLane。
 *
 *    getLobTarget(t) {
 *      if (void 0 === t) t = this.inLane          // ← 接受车道参数
 *      ...t.zombiePool().sort(byX).find(...)      // 取最近的可见目标
 *    }
 *      —— 有车道参数，所以不必改 this.inLane（改了会让 detector 位置失真）。
 *
 *    _lobToZombie(null) 内部会调 this.getLobTarget()，
 *    因此把这两个方法扩开，发射就自动落到实际有僵尸的那条道。
 *
 *  「种在爆裂藤蔓上」的判定：投手与藤蔓处在同一格，
 *  藤蔓登记在 this.inLnC.vineInSquare 里。
 */
const MELON_LANE_TARGETS = [
  {
    label: '投手系·三车道判定',
    cls: 'CabbagePultPlant',
    module: 'chunks:///_virtual/CabbagePult.ts',
    listener: 'detectEnemy',
    melonLanes: 'detect',
  },
  {
    label: '投手系·三车道选目标',
    cls: 'CabbagePultPlant',
    module: 'chunks:///_virtual/CabbagePult.ts',
    listener: 'getLobTarget',
    melonLanes: 'target',
  },
]

const PYRE_BLOCK_TARGETS = [
  {
    label: '柴火藤蔓禁种',
    cls: 'LnC',
    module: 'chunks:///_virtual/LnC.ts',
    listener: 'putPlantAvailable',
    pyreBlock: true,
  },
]

/** I 类：关卡「限制损耗」只统计被僵尸啃食的植物
 *
 *  引擎机制：
 *
 *  1) 失败/过关判定在 LevelTaskCount，模式枚举里的 `PlantLoseLimit` 就是
 *     「限制损耗」。它的计数逻辑无条件减一：
 *         case Q.PlantLoseLimit:
 *           if (this.objdata.LeftPlantsToLose--, this.objdata.LeftPlantsToLose < 0) { ... this.fail() }
 *
 *  2) 唯一的上报点是：
 *         n && this.levelTaskWarnPlantLose() && M.component.calculateLevelTask(T.PlantLoseLimit, {})
 *     也就是说 `levelTaskWarnPlantLose()` 是**唯一的闸门**。
 *
 *  3) 但这个方法**不接受任何参数**，拿不到「怎么死的」：
 *         // 基类 Plant
 *         levelTaskWarnPlantLose = function () { return false }
 *         // 普通植物覆盖成
 *         levelTaskWarnPlantLose = function () { return true }
 *
 *  所以本模组的做法是：先把死因记下来，再在闸门处按死因裁决。
 *
 *  各条死路：
 *    · 玩家铲掉 → `LnC.removePlant` 里对格内植物调 `t.die(!1)`，只传一个 false
 *    · 被僵尸啃 → `kill()` → `die()`（无参）
 *
 *  当前确定拦下的：**玩家铲掉**（在 removePlant 上打标记）。
 *  其余情况（自然消耗 / 墓碑）先只在诊断里如实记录现场，待实测后再收紧 ——
 *  不靠猜测加规则。
 */
const LOSS_GUARD_TARGETS = [
  {
    label: '记录被啃',
    cls: 'Plant',
    module: 'chunks:///_virtual/Plant.ts',
    listener: 'eat',
    eatMark: true,
  },
  {
    label: '记录死亡参数',
    cls: 'Plant',
    module: 'chunks:///_virtual/Plant.ts',
    listener: 'die',
    dieArgs: true,
  },
  {
    label: '损耗裁决',
    cls: 'Plant',
    module: 'chunks:///_virtual/Plant.ts',
    listener: 'levelTaskWarnPlantLose',
    lossVerdict: true,
  },
]

const ALL_TARGETS = [].concat(
  WEIGHT_TARGETS,
  EXTRA_SHOT_TARGETS,
  FOOD_TARGETS,
  DEATHRATTLE_TARGETS,
  PYRE_SWAP_TARGETS,
  SHADOW_AURA_TARGETS,
  PYRE_BLOCK_TARGETS,
  MELON_LANE_TARGETS,
  LOSS_GUARD_TARGETS
)

/** 模组版本 —— 与 pack.json 同步（测试里有断言守着）。
 *  打进启动横幅，便于一眼确认「装的到底是哪一版」。 */
const MOD_VERSION = '4.1.24'

/**
 * 「本来就会自己消失」的植物 ID —— 取自 PlantFeatures.json 里
 * TAGS 含 `losingPlant` 的全部条目（共 68 个）。
 *
 * 包括：一次性（樱桃炸弹 / 倭瓜 / 毁灭菇 / 辣椒…）、即时型（三叶草 /
 * 飓风甘蓝 / 逆时草…）、铺地型（黄金叶 / 瓷砖萝卜）、所有薄荷、
 * 土豆地雷、逃脱树根、暗影油桃 等等。
 *
 * 引擎默认是把它们**计入**损耗的（源码里就有
 * `TAGS.indexOf("losingPlant") → warnLevelTask(PlantLoseLimit)`），
 * 本模组按需求把它们排除在损耗统计之外。
 *
 * 之所以用数据提取而不是手写清单：手写必然漏，且中文名与 codename
 * 对不上时无从核对（例如「咬咬碑」实际是 gravebuster 噬碑藤、
 * 「漩涡琵琶」实际是 loquat 漩涡枇杷）。
 */
const LOSING_PLANT_IDS = new Set([
  3, 6, 12, 36, 45, 46, 47, 50, 51, 54, 56, 62, 64, 65, 67, 74, 80, 82, 84, 87,
  90, 91, 92, 93, 94, 95, 97, 109, 114, 120, 127, 130, 131, 132, 136, 139, 141,
  144, 145, 147, 151, 152, 154, 155, 160, 161, 167, 169, 170, 173, 179,
  180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193,
  197, 203, 211,
])

const diagLines = []
const notedOnce = new Set()
const stats = new Map()
const resolved = new Map()

/**
 * 记一行诊断。
 *
 * ⚠️ 这里必须**直接**打到控制台。
 * 旧实现只把它 push 进 `diagLines`，而那个数组只有在「类定位失败」时
 * 才会被 dumpDiagnostics() 输出 —— 于是正常运行时**一条日志都看不到**，
 * 排查时表现为「模组好像完全没跑」，害得双方反复空转。
 */
function note(line) {
  try {
    const text = String(line)
    try { console.warn('[综合平衡] ' + text) } catch (e) { /* 控制台不可用就算了 */ }
    if (diagLines.length < 200) diagLines.push(text)
  } catch (err) {}
}

/** 同一条诊断只记一次，避免每次死亡都往日志里灌 */
function noteOnce(key, line) {
  try {
    if (notedOnce.has(key)) return
    notedOnce.add(key)
    note(line)
  } catch (err) {}
}

function errText(err) {
  return err && err.message ? err.message : String(err)
}

function safeKeys(obj) {
  try {
    return obj ? Object.keys(obj).join(',') : '(不存在)'
  } catch (err) {
    return '(读取失败)'
  }
}

function pickType(entry) {
  let total = 0
  for (let i = 0; i < entry.table.length; i++) total += entry.table[i].weight
  let roll = Math.random() * total
  for (let i = 0; i < entry.table.length; i++) {
    roll -= entry.table[i].weight
    if (roll < 0) return entry.table[i]
  }
  return entry.table[0]
}

function statOf(label) {
  let s = stats.get(label)
  if (!s) {
    s = { shots: 0, counts: new Map(), extra: 0, food: 0, hits: 0, damage: 0 }
    stats.set(label, s)
  }
  return s
}

function locateClass(engine, clsName, modulePath) {
  if (!engine) return null
  try {
    const cc = typeof engine.getCc === 'function' ? engine.getCc() : null
    const got = cc && cc.js && cc.js.getClassByName ? cc.js.getClassByName(clsName) : null
    if (typeof got === 'function') return { cls: got, how: 'cc.js' }
  } catch (err) {
    note(clsName + ': cc.js 抛错 ' + errText(err))
  }
  try {
    const got = typeof engine.getClassByName === 'function' ? engine.getClassByName(clsName) : null
    if (typeof got === 'function') return { cls: got, how: 'engine' }
  } catch (err) {
    note(clsName + ': engine.getClassByName 抛错 ' + errText(err))
  }
  try {
    const got =
      typeof engine.getModuleExport === 'function' ? engine.getModuleExport(modulePath, clsName) : null
    if (typeof got === 'function') return { cls: got, how: 'module' }
  } catch (err) {
    note(clsName + ': getModuleExport 抛错 ' + errText(err))
  }
  return null
}

function readOwn(thisArg) {
  try {
    const own = thisArg ? thisArg.objdataOwn : null
    return own && typeof own === 'object' ? own : null
  } catch (err) {
    return null
  }
}

function isFooding(thisArg) {
  try {
    return thisArg && thisArg.fooding === true
  } catch (err) {
    return false
  }
}

/** A 类：换弹种
 *  注意：寒冰射手这类植物有 defaultPea getter，会按 ChanceToFreeze 在
 *  PeaType 与 PeaFreezeType 之间二选一。只改 PeaType 会让概率打折，
 *  所以存在 PeaFreezeType 时一并改掉。
 */
function applyWeight(entry, thisArg, callNext, args) {
  const own = readOwn(thisArg)
  if (!own) return callNext(...args)

  let previous
  let previousFreeze
  let hadFreeze = false
  let chosen
  let patched = false
  try {
    previous = own.PeaType
    chosen = pickType(entry)
    own.PeaType = chosen.type
    patched = own.PeaType === chosen.type

    if (typeof own.PeaFreezeType === 'string') {
      previousFreeze = own.PeaFreezeType
      hadFreeze = true
      own.PeaFreezeType = chosen.type
    }
  } catch (err) {
    patched = false
  }

  if (patched) {
    const s = statOf(entry.label)
    s.shots += 1
    s.counts.set(chosen.type, (s.counts.get(chosen.type) || 0) + 1)
  }

  try {
    return callNext(...args)
  } finally {
    if (patched) {
      try {
        own.PeaType = previous
        if (hadFreeze) own.PeaFreezeType = previousFreeze
      } catch (err) {}
    }
  }
}

/** B 类：概率额外射击
 *  · 默认同时发射（视觉上会叠成一发大火球），可用 delaySeconds 让后续几颗
 *    按游戏时间依次发射（跟随暂停/加速）。
 *  · extraType 用于触发时整体换弹种——火焰豌豆的连射就是这样变成"蓝火大火球"的。
 *    它与 delaySeconds 互斥使用（换色靠同步替换，延迟发射则用默认弹种）。
 */
function applyExtraShots(entry, thisArg, callNext, args, ctx) {
  const s = statOf(entry.label)
  s.shots += 1

  if (Math.random() >= entry.chance) return callNext(...args)

  s.extra += 1
  const own = readOwn(thisArg)
  const delay = entry.delaySeconds || 0

  // 需要整体换色的场合（同步替换，调用完成后还原）
  let prevType = null
  let repainted = false
  if (entry.extraType && own) {
    try {
      prevType = own.PeaType
      own.PeaType = entry.extraType
      repainted = own.PeaType === entry.extraType
    } catch (err) {
      repainted = false
    }
  }

  const fireOnce = () => {
    try {
      if (typeof thisArg._shoot === 'function') thisArg._shoot()
    } catch (err) {
      note(entry.label + ': 额外射击抛错 ' + errText(err))
    }
  }

  try {
    for (let i = 1; i <= entry.extraShots; i++) {
      if (delay > 0 && ctx && ctx.clock && typeof ctx.clock.setTimeout === 'function') {
        try {
          ctx.clock.setTimeout(() => fireOnce(), delay * i)
        } catch (err) {
          note(entry.label + ': 定时器失败，改为立即发射 ' + errText(err))
          fireOnce()
        }
      } else {
        fireOnce()
      }
    }
    return callNext(...args)
  } finally {
    if (repainted) {
      try {
        own.PeaType = prevType
      } catch (err) {}
    }
  }
}

/** C 类：概率改成发射大招弹（只换类型，不触发无敌） */
function applyFoodSwap(entry, thisArg, callNext, args) {
  const own = readOwn(thisArg)
  if (!own) return callNext(...args)

  const s = statOf(entry.label)
  s.shots += 1

  if (Math.random() >= entry.chance) return callNext(...args)

  let previous
  let swapped = false
  try {
    const foodType = own.PeaTypePlantfood
    if (typeof foodType === 'string' && foodType) {
      previous = own.PeaType
      own.PeaType = foodType
      swapped = own.PeaType === foodType
    }
  } catch (err) {
    swapped = false
  }

  if (swapped) s.food += 1

  try {
    return callNext(...args)
  } finally {
    if (swapped) {
      try {
        own.PeaType = previous
      } catch (err) {}
    }
  }
}

/* ───────────────── D 类：亡语（高坚果）───────────────── */

/** 亡语要用到的引擎类，全在 startup 阶段解析一次（setup 里拿不到 ctx.engine） */
const ENGINE_REFS = {
  cc: null,
  tween: null,
  Vec2: null,
  Square: null,
  Rectangle: null,
  ZombieDamageDetails: null,
}

const SQUARE_W_FALLBACK = 68 // Square.SquareWidth
const SQUARE_H_FALLBACK = 80.77 // Square.SquareHeight

function moduleExport(engine, modulePath, exportName) {
  if (!engine || typeof engine.getModuleExport !== 'function') return null
  try {
    const got = engine.getModuleExport(modulePath, exportName)
    return typeof got === 'function' ? got : null
  } catch (err) {
    note('getModuleExport(' + exportName + ') 抛错 ' + errText(err))
    return null
  }
}

/** 与 moduleExport 相同，但不要求导出值是函数。
 *  引擎里 PrjFunctions / CharacterType 这类是**对象**，moduleExport 会把它们过滤掉。 */
function moduleValue(engine, modulePath, exportName) {
  if (!engine || typeof engine.getModuleExport !== 'function') return null
  try {
    return engine.getModuleExport(modulePath, exportName)
  } catch (err) {
    return null
  }
}

function resolveEngineRefs(engine, ctx) {
  // ⚠️ 关键：把 engine 本身也存下来。
  // `startup(ctx)` 阶段 `ctx.engine` 存在，但 `setup(ctx)` 阶段没有 ——
  // 而所有 handler 都是在 setup 里通过 makeHandler(entry, ctx) 创建的，
  // 闭包捕获的 ctx 里没有 engine，于是那里读 `ctx.engine` 恒为 undefined。
  // 实测日志「点火：拿不到 engine」就死在这里。
  ENGINE_REFS.engine = engine || null
  try {
    const cc = engine && typeof engine.getCc === 'function' ? engine.getCc() : null
    ENGINE_REFS.cc = cc || null
    ENGINE_REFS.tween = cc && typeof cc.tween === 'function' ? cc.tween : null
    ENGINE_REFS.Vec2 = (cc && cc.Vec2) || null
  } catch (err) {
    note('cc 命名空间解析失败 ' + errText(err))
  }
  ENGINE_REFS.Rectangle = moduleExport(engine, 'chunks:///_virtual/CharacterManager.ts', 'Rectangle')
  ENGINE_REFS.ZombieDamageDetails = moduleExport(
    engine,
    'chunks:///_virtual/CharacterManager.ts',
    'ZombieDamageDetails'
  )
  ENGINE_REFS.Square = moduleExport(engine, 'chunks:///_virtual/Square.ts', 'Square')

  // ── 点火所需：必须在 startup 阶段全部取出来 ──
  // GP-Next 在 startup 结束后会关闭引擎访问（实测报错
  // `Startup engine access is closed`），运行时再调 engine.getModuleExport
  // 一律抛错。所以这里把「函数本体」缓存下来，运行时只调缓存引用。
  ENGINE_REFS.PrjFunctions = moduleValue(engine, 'chunks:///_virtual/Projectiles.ts', 'PrjFunctions')
  ENGINE_REFS.CharacterType = moduleValue(engine, 'chunks:///_virtual/CharacterManager.ts', 'CharacterType')
  ENGINE_REFS.PyreVinePlant = moduleValue(engine, 'chunks:///_virtual/PyreVine.ts', 'PyreVinePlant')
  ENGINE_REFS.BlastBerryVinePlant = moduleValue(
    engine, 'chunks:///_virtual/BlastBerryVine.ts', 'BlastBerryVinePlant')
  ENGINE_REFS.GloomVinePlant = moduleValue(
    engine, 'chunks:///_virtual/GloomVine.ts', 'GloomVinePlant')
  // 格宽：Square.ts 不直接导出 SquareWidth，它挂在 Square 对象上
  ENGINE_REFS.SquareWidth = (function () {
    try {
      const S = ENGINE_REFS.Square
      if (S && typeof S.SquareWidth === 'number') return S.SquareWidth
    } catch (e) { /* 试下一条路 */ }
    try {
      const w = moduleValue(engine, 'chunks:///_virtual/Square.ts', 'SquareWidth')
      if (typeof w === 'number') return w
    } catch (e) { /* 放弃 */ }
    return null
  })()
  ENGINE_REFS.TorchwoodIgnite = (function () {
    try {
      const mod = moduleValue(engine, 'chunks:///_virtual/Torchwood.ts', 'TorchwoodPlant')
      if (mod && mod.prototype && typeof mod.prototype.ignite === 'function') {
        return mod.prototype.ignite
      }
    } catch (e) { /* 见下方诊断 */ }
    try {
      const byCc = locateClass(engine, 'TorchwoodPlant', 'chunks:///_virtual/Torchwood.ts')
      if (byCc && byCc.cls && byCc.cls.prototype && typeof byCc.cls.prototype.ignite === 'function') {
        return byCc.cls.prototype.ignite
      }
    } catch (e) { /* 见下方诊断 */ }
    return null
  })()
  const line =
    '亡语依赖 tween=' +
    (ENGINE_REFS.tween ? 'ok' : '缺') +
    ' Rectangle=' +
    (ENGINE_REFS.Rectangle ? 'ok' : '缺') +
    ' ZombieDamageDetails=' +
    (ENGINE_REFS.ZombieDamageDetails ? 'ok' : '缺') +
    ' Square=' +
    (ENGINE_REFS.Square ? 'ok' : '缺')
  note(line)
  try {
    // ⚠️ 用 warn 而不是 info：
    // DevTools 控制台默认只显示 Warning 及以上（「默认级别」过滤器），
    // info 级日志会被直接挡掉 —— 表现为「控制台搜不到任何日志」，
    // 让诊断完全失效。这里统一走 warn，确保作者/用户都能看到。
    if (ctx && ctx.log && typeof ctx.log.warn === 'function') ctx.log.warn('[综合平衡] ' + line)
    else if (ctx && ctx.log && typeof ctx.log.info === 'function') ctx.log.info('[综合平衡] ' + line)
  } catch (err) {}
}

function squareSize() {
  let w = SQUARE_W_FALLBACK
  let h = SQUARE_H_FALLBACK
  try {
    const S = ENGINE_REFS.Square
    if (S && typeof S.SquareWidth === 'number') w = S.SquareWidth
    if (S && typeof S.SquareHeight === 'number') h = S.SquareHeight
  } catch (err) {}
  return { w: w, h: h }
}

/** 圈出「以 (x, 本行中线) 为中心、宽 rangeSquares 格」的范围，挑出会被砸到的僵尸。
 *  与 SquashPlant.getZombiesInSmashingRange 同构；Rectangle 拿不到时退回按中心 x 距离判定。 */
function zombiesInSmashRange(plant, entry, x) {
  const out = []
  let pool = null
  try {
    pool = plant.inLane ? plant.inLane.zombiePool() : null
  } catch (err) {
    noteOnce('zpool', '亡语读僵尸池失败 ' + errText(err))
  }
  if (!pool || typeof pool.length !== 'number') return out

  const { w, h } = squareSize()
  let rect = null
  const R = ENGINE_REFS.Rectangle
  const V2 = ENGINE_REFS.Vec2
  if (R && V2 && typeof R.createRectangleCenter === 'function') {
    try {
      let midY = 0
      try {
        midY = plant.inLane.midY
      } catch (err) {
        midY = 0
      }
      rect = R.createRectangleCenter(new V2(x, midY), (entry.rangeSquares || 2) * w, h)
    } catch (err) {
      rect = null
      noteOnce('rect', '亡语建范围矩形失败，改用中心距离判定 ' + errText(err))
    }
  }

  for (let i = 0; i < pool.length; i++) {
    const z = pool[i]
    if (!z) continue
    try {
      if (rect) {
        if (z.bodyRecReal && rect.judgeCrossRec(z.bodyRecReal)) out.push(z)
      } else if (typeof z.worldPositionX === 'number' && Math.abs(z.worldPositionX - x) <= w) {
        out.push(z)
      }
    } catch (err) {}
  }
  return out
}

function smashZombies(targets, entry, damage, s) {
  const ZDD = ENGINE_REFS.ZombieDamageDetails
  if (!ZDD) {
    noteOnce('nozdd', entry.label + ': 没拿到 ZombieDamageDetails，亡语只播动画、不结算伤害')
    return 0
  }
  let hit = 0
  for (let i = 0; i < targets.length; i++) {
    try {
      const dir = ENGINE_REFS.Vec2 ? new ENGINE_REFS.Vec2(0, -20) : null
      const details = new ZDD(damage, true, true, true, dir)
      details.bugKiller = true
      targets[i].dealDamage(details)
      hit += 1
    } catch (err) {
      noteOnce('smash', entry.label + ': 砸僵尸抛错 ' + errText(err))
    }
  }
  if (s) {
    s.hits += hit
    s.damage += hit * damage
  }
  return hit
}

/** 亡语视觉：把 body 挂到弹丸层（脱离即将被销毁的植物节点），原地弹起再砸下，落地即自毁。
 *  拿不到 body / 弹丸层 / tween 时跳过动画，伤害照常结算。 */
function leapForDeathrattle(plant, entry) {
  const tween = ENGINE_REFS.tween
  let body = null
  let layer = null
  try {
    body = plant.body
  } catch (err) {
    body = null
  }
  try {
    layer = plant.inLane ? plant.inLane.prjLayer : null
  } catch (err) {
    layer = null
  }
  if (!body || !layer || typeof tween !== 'function' || typeof body.setParent !== 'function') {
    noteOnce('noleap', entry.label + ': 跳过跳跃动画（body / prjLayer / tween 不齐）')
    return false
  }
  try {
    body.setParent(layer, true)
    if (body.parent !== layer) {
      noteOnce('reparent', entry.label + ': body 重挂载失败，跳过跳跃动画')
      return false
    }
    const pos = body.worldPosition
    const from = pos.clone()
    const peak = pos.clone()
    peak.y = from.y + (entry.leapHeight || 110)
    tween(body)
      .to(entry.leapUpSeconds || 0.14, { worldPosition: peak }, { easing: 'quadOut' })
      .to(entry.leapDownSeconds || 0.1, { worldPosition: from }, { easing: 'quadIn' })
      .call(() => {
        try {
          body.destroy()
        } catch (err) {}
      })
      .start()
    return true
  } catch (err) {
    noteOnce('leaperr', entry.label + ': 跳跃补间失败 ' + errText(err))
    return false
  }
}

/** D 类主体：死亡瞬间弹起，落地那一刻结算范围伤害。
 *  伤害交给游戏时钟调度（高坚果节点那时多半已被销毁，但位移/僵尸池都还在），
 *  时钟不可用则立即结算——宁可少一段动画，不能少这一下伤害。 */
function applyDeathrattle(entry, thisArg, callNext, args, ctx) {
  const s = statOf(entry.label)
  try {
    if (thisArg.__peaRebalanceRattled) return callNext(...args)
    thisArg.__peaRebalanceRattled = true

    let x = 0
    try {
      x = thisArg.worldPositionX
    } catch (err) {
      x = 0
    }
    let scale = 1
    try {
      if (typeof thisArg._dmgScale === 'number' && thisArg._dmgScale > 0) scale = thisArg._dmgScale
    } catch (err) {}
    const damage = Math.round((entry.damage || 1800) * scale)

    s.extra += 1
    leapForDeathrattle(thisArg, entry)

    const land = () => {
      try {
        smashZombies(zombiesInSmashRange(thisArg, entry, x), entry, damage, s)
      } catch (err) {
        noteOnce('land', entry.label + ': 亡语结算抛错 ' + errText(err))
      }
    }

    const delay = (entry.leapUpSeconds || 0.14) + (entry.leapDownSeconds || 0.1)
    const clock = ctx && ctx.clock
    if (clock && typeof clock.setTimeout === 'function') {
      try {
        clock.setTimeout(() => land(), delay)
      } catch (err) {
        noteOnce('clock', entry.label + ': 亡语定时器失败，改为立即结算 ' + errText(err))
        land()
      }
    } else {
      land()
    }
  } catch (err) {
    noteOnce('rattle', entry.label + ': 亡语抛错 ' + errText(err))
  }
  return callNext(...args)
}

/**
 * E 类：柴火藤蔓点火。
 *
 * 挂在 `PyreVinePlant.specialPlantUpdate` 上 —— 它本身是「地面火焰」型植物，
 * 原本只对地面上的僵尸持续烧烤，完全不碰投射物。这里在它每帧更新之后
 * 顺手扫一遍本行的投射物，把带 `YellowIgnited` 的点着。
 */
function applyPyreIgnite(entry, thisArg, callNext, args, ctx) {
  const r = callNext(...args)
  try {
    // ── 探针：先确认钩子到底有没有跑 ──
    pyreProbe(entry, thisArg)

    if (thisArg && !thisArg.sheepend && !thisArg.dead) pyreIgniteLane(thisArg, entry, ctx)
  } catch (err) {
    noteOnce('pyre', entry.label + ': 点火失败 ' + errText(err))
  }
  return r
}

/** 前几次调用把「钩子命中」写进日志 —— 用来区分「没挂上」和「挂了但没点着」 */
let pyreProbeCount = 0
function pyreProbe(entry, thisArg) {
  if (pyreProbeCount >= 6) return
  pyreProbeCount += 1

  let name = '(未知)'
  try {
    name = (thisArg && thisArg.constructor && thisArg.constructor.name) || '(无名)'
  } catch (e) { /* 拿不到就算了 */ }

  // 兜底钩子要对非柴火藤蔓的植物放行
  if (entry.onlyClassMatch && name.indexOf(entry.onlyClassMatch) < 0) {
    if (pyreProbeCount <= 3) {
      note('点火钩子命中 #' + pyreProbeCount + '：' + name +
           '（非柴火藤蔓，跳过；若一直只看到其它植物名，说明过滤词不对）')
    }
    return
  }

  note('点火钩子命中 #' + pyreProbeCount + '：' + name + '  ← 钩子已生效')
}

/**
 * 照抄 `Torchwood.specialPlantLateUpdate` 的做法 —— 这是引擎里唯一的现成点火器。
 *
 * 4.1.0 / 4.1.1 之所以没生效，差在这里：
 *   ① 投射物池在 **`this.inLane.prjPool()`**，不是 `inLnC.prjPool()`
 *      —— `inLane` 与 `inLnC` 是两个不同对象，池子挂在前者上
 *   ② 每颗弹要先过 `prj.height <= 100`（平射）；投掷物另走一条（见 entry.lobbed）
 *   ③ 引擎用 `ignitedCSs` 记「点火后生成的新弹」来做去重
 */

/**
 * 本模组点过的弹（原弹 + 新生成的弹），跨藤蔓、跨帧共享。
 *
 * 为什么需要它：`torchwoodWaiting` 是实例属性，写入失败时会静默失效
 * （外面套着 try/catch）；`plant.__zfaIgnited` 又是每株藤蔓各自一份 ——
 * 两层保险都是「软」的，实测出现过同一颗弹被反复点燃。
 * WeakSet 由运行时保证引用唯一性，不依赖目标对象的可写性，是最硬的一层。
 */
const pyreIgnited = new WeakSet()

function pyreIgniteLane(plant, entry, ctx) {
  if (!plant || plant.sheepend || plant.dead) return

  let list = plant.__zfaIgnited
  if (!Array.isArray(list)) { list = []; plant.__zfaIgnited = list }

  const pools = collectProjectilePools(plant)
  if (!pools.length) {
    noteOnce('pyre-nopool', '柴火藤蔓：拿不到任何投射物池（inLane / inLnC 上都试过了）')
    return
  }

  pyreDiag(plant, pools)

  for (let pi = 0; pi < pools.length; pi++) {
    const pool = pools[pi]
    for (let i = 0; i < pool.length; i++) {
      const prj = pool[i]
      try {
        if (!prj || prj.dead || prj.torchwoodWaiting) continue
        if (list.indexOf(prj) >= 0) continue          // 同一株藤蔓只点一次
        if (pyreIgnited.has(prj)) continue            // ★ 全局硬保险：本模组点过的弹永不再点

        // ★ 只点「与藤蔓同格」的投射物。
        // 主判据是行格引用；拿不到 prj.inLnC 时退回横向坐标，
        // 否则这条判定会整个失效、退化成扫整行（实测出现过）。
        if (!isSameSquareAsPlant(prj, plant)) continue

        // 平射投射物一律点；抛物线投掷物在 lobbed 打开时也点
        const isFlat = typeof prj.height === 'number' && prj.height <= 100
        if (!isFlat && !entry.lobbed) continue

        let nextType = prj.YellowIgnited

        // 兜底：实测日志里出现过 `Can't find the plant with type name: ""`，
        // 说明引擎字段可能是空字符串。这里直接从投射物自己的 props 再取一次。
        if (!nextType) {
          try {
            nextType = (prj.objdataOwn && prj.objdataOwn.YellowIgnitedType) || ''
          } catch (e) { nextType = '' }
          if (nextType) {
            try { prj.YellowIgnited = nextType } catch (e) { /* 只读就跳过 */ }
            noteOnce('pyre-fixfield',
              '柴火藤蔓：投射物的 YellowIgnited 为空，已从 props 补上 ' + nextType)
          }
        }
        if (!nextType) continue

        list.push(prj)
        pyreIgnited.add(prj)                          // 原弹也记上

        // 优先用借来的引擎原实现（TorchwoodPlant.ignite）；
        // 借不到（类定位失败）才退回自写的那份。
        const ign = borrowTorchIgnite(plant, ctx)
        if (typeof ign === 'function') {
          Promise.resolve(ign(prj, false)).then(function (np) {
            try {
              if (np) {
                np.inLnC = prj.inLnC
                // 借来的 ignite 只标记了原弹，新弹要自己补，
                // 否则下一帧会被再点一次（普通豌豆 → 黄火 → 蓝火）
                np.torchwoodWaiting = true
                pyreIgnited.add(np)                   // ★ 硬保险：属性写不进也挡得住
              }
            } catch (e) { /* 拿不到就算了 */ }
          }).catch(function () { /* 单颗失败不打断 */ })
        } else {
          igniteOneProjectile(prj, nextType, ctx)
        }
      } catch (e) { /* 单颗失败不影响其它 */ }
    }
  }

  // 清掉已经消失的引用，避免数组无限增长
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]
    if (!p || p.dead) list.splice(i, 1)
  }
}

/**
 * 收集本行所有可能装着投射物的池子。
 *
 * 直线弹在 `inLane.prjPool()`；投掷物（西瓜 / 卷心菜这类）可能挂在别处，
 * 所以把已知的几种池子名都试一遍，去重后一起返回。
 */
function collectProjectilePools(plant) {
  const out = []
  const seen = new Set()
  const sources = [plant.inLane, plant.inLnC]
  const names = ['prjPool', 'lobPool', 'shootPool', 'prjPoolAll']
  for (let s = 0; s < sources.length; s++) {
    const src = sources[s]
    if (!src) continue
    for (let n = 0; n < names.length; n++) {
      try {
        const fn = src[names[n]]
        if (typeof fn !== 'function') continue
        const got = fn.call(src)
        if (!got || typeof got.concat !== 'function') continue
        const arr = got.concat()
        if (seen.has(arr) || !arr.length) continue
        seen.add(arr)
        out.push(arr)
      } catch (e) { /* 某个池子不可用就跳过 */ }
    }
  }
  return out
}

/** 投射物是否正处在藤蔓所在的那一格 */
let pyreSquareDiag = 0
function isSameSquareAsPlant(prj, plant) {
  // 主判据：行格对象同一引用
  if (prj.inLnC && plant.inLnC) return prj.inLnC === plant.inLnC

  // 退路：横向坐标落在本格范围内
  const w = ENGINE_REFS.SquareWidth
  if (w) {
    try {
      const dx = Math.abs(prj.node.worldPosition.x - plant.node.worldPosition.x)
      const same = dx <= w * 0.5
      if (pyreSquareDiag < 5) {
        pyreSquareDiag += 1
        note('点火范围判定（坐标回退）：dx=' + Math.round(dx) +
             ' 格宽=' + Math.round(w) + ' -> ' + (same ? '同格' : '不同格'))
      }
      return same
    } catch (e) { /* 坐标拿不到，继续往下 */ }
  }

  if (pyreSquareDiag < 5) {
    pyreSquareDiag += 1
    note('点火范围判定：prj.inLnC=' + (prj.inLnC ? '有' : '无') +
         ' plant.inLnC=' + (plant.inLnC ? '有' : '无') +
         ' 格宽=' + (w ? '有' : '无') + ' —— 无法判定，暂按同格处理')
  }
  return true
}

/** 前几次必打，之后每 5 秒补一条 —— 保证任何时刻进关都能在控制台看到 */
let pyreDiagCount = 0
let pyreDiagLast = 0
function pyreDiag(plant, pools) {
  const now = Date.now()
  const early = pyreDiagCount < 4
  if (!early && now - pyreDiagLast < 5000) return
  pyreDiagCount += 1
  pyreDiagLast = now

  const parts = pools.map(function (pool, idx) {
    const detail = pool.map(function (p) {
      if (!p) return 'null'
      const cls = (p.constructor && p.constructor.name) || '?'
      const h = typeof p.height === 'number' ? Math.round(p.height) : '?'
      const t = p.YellowIgnited ? p.YellowIgnited : '空'

      let props = '-'
      try {
        if (p.objdataOwn) {
          const keys = Object.keys(p.objdataOwn)
          props = keys.length ? keys.slice(0, 6).join('|') : '(空对象)'
        }
      } catch (e) { props = '读取失败' }

      return cls + ' h' + h + ' YI=[' + t + '] props{' + props + '}'
    }).join('  ')
    return '池' + idx + '(' + pool.length + '): ' + (detail || '空')
  })
  note('柴火藤蔓诊断 #' + pyreDiagCount + '：' + (parts.join('  ') || '没有池子'))
}

/**
 * 直接**借用**火炬树桩的 `ignite` —— 而不是自己重写一份。
 *
 * 引擎里 `TorchwoodPlant.ignite(prj, fooded)` 只依赖：
 *   this.inLnC      拿行上下文
 *   this.ignitedCSs 去重数组
 * 与「是哪一种植物」无关，所以 bind 到柴火藤蔓实例上就能直接用。
 *
 * 这是主人那句「调用火炬树桩的代码」的字面做法 —— 之前我一直在"抄"，
 * 抄漏任何一处（比如把 inLane 抄成 inLnC）就整条失效。
 */
function borrowTorchIgnite(plant, ctx) {
  if (typeof plant.ignite === 'function' && plant.__zfaBorrowedIgnite) return plant.ignite

  // 直接用 startup 阶段缓存好的原型方法 —— 运行时已无法再访问引擎
  const proto = ENGINE_REFS.TorchwoodIgnite
  if (typeof proto !== 'function') {
    noteOnce('pyre-noborrow', '柴火藤蔓：没有可用的 TorchwoodPlant.ignite（startup 阶段未取到）')
    return null
  }

  if (!Array.isArray(plant.ignitedCSs)) plant.ignitedCSs = []
  plant.ignite = proto.bind(plant)
  plant.__zfaBorrowedIgnite = true
  note('柴火藤蔓：已借用 TorchwoodPlant.ignite（startup 缓存）')
  return plant.ignite
}

/**
 * 把一颗投射物替换成它的「被点着形态」（借用失败时的退路）。
 * 完全照引擎 `Torchwood.ignite` 的写法：
 * 用 `PrjFunctions.shootOnePea` 按目标弹种生成一颗新的，
 * 再把原投射物的状态 `copy` 过去，最后让原投射物 `fade()`。
 */
function igniteOneProjectile(prj, nextType, ctx) {
  // 全部走 startup 阶段缓存好的引用。
  // 运行时引擎访问已关闭（`Startup engine access is closed`），
  // 这里绝不能再去调 engine.getModuleExport。
  const PrjFunctions = ENGINE_REFS.PrjFunctions
  const Vec2 = ENGINE_REFS.Vec2
  const CharType = ENGINE_REFS.CharacterType
  if (!PrjFunctions || typeof PrjFunctions.shootOnePea !== 'function' || !Vec2) {
    noteOnce('pyre-prj', '点火依赖缺失：PrjFunctions=' + !!PrjFunctions + ' Vec2=' + !!Vec2)
    return null
  }

  prj.torchwoodWaiting = true      // 防重入；引擎原实现也这么做
  const origin = { inLnC: prj.inLnC }

  Promise.resolve(
    PrjFunctions.shootOnePea(
      nextType,
      prj.worldPosition,
      prj.height,
      prj.node && prj.node.parent,
      new Vec2(8, 0),
      CharType ? CharType.zombie : 0
    )
  ).then(function (np) {
    try {
      if (!np) {
        note('点火：shootOnePea(' + nextType + ') 返回 null，未替换')
        return
      }
      if (typeof np.copy !== 'function') {
        note('点火：shootOnePea 返回的对象没有 copy 方法（type=' + typeof np + '）')
        return
      }
      np.copy(prj, false, false, false, true, true, true, true, true, true)
      np.inLnC = origin.inLnC
      // ★ 新生成的弹必须同样带上防重入标记。
      // 否则它下一帧会被再点一次 —— 表现就是「普通豌豆最终变成蓝火」：
      //   pea → 黄火 → 蓝火（两次点火叠在一起）
      try { np.torchwoodWaiting = true } catch (e) { /* 只读就跳过 */ }
      pyreIgnited.add(np)                            // ★ 同上，硬保险
      if (typeof prj.fade === 'function') prj.fade()
      note('点火成功：' + nextType)
    } catch (e) {
      note('点火后 copy/fade 失败 ' + errText(e))
    }
  }).catch(function (e) {
    note('点火生成失败（' + nextType + '）' + errText(e))
  })

  return null
}

/**
 * F 类：忧郁藤蔓的暗影光环。
 *
 * 每帧给所在行续一个短时长的 `shadowCD`，使同行植物持续处于暗影状态。
 * 续 0.2 秒 —— 略大于一帧（60fps 约 0.017s），既不断档，
 * 也不会在忧郁藤蔓被铲掉后长时间残留。
 */
// applyGloomAura 已废弃：它给整行续 shadowCD，暗影范围超出需求。
// 现由 applyGloomShadow（挂在 Plant.judgeShadowPlantMode 上）只作用于同格那一株。

/**
 * G 类：柴火藤蔓禁种。
 *
 * 引擎的 `putPlantAvailable` 判完之后我们再补一道：
 * 格子里若有柴火藤蔓，且待种植物在黑名单里 → 返回 false。
 *
 * 注意：打包后的类名是压缩过的（实测投射物类名是 `t`），
 * 所以「是不是柴火藤蔓」不能靠 constructor.name，改用 startup 阶段
 * 缓存的 `PyreVinePlant` 做原型比对。待种植物同理，先打诊断把
 * 真实标识暴露出来再收紧。
 */
let pyreBlockLogged = 0
function applyPyreBlock(entry, thisArg, callNext, args) {
  const r = callNext(...args)
  if (!r) return r                      // 引擎本来就拒绝，不必再管

  try {
    const vines = thisArg && thisArg.vineInSquare
    if (!vines || !vines.length) return r
    if (!vines.some(isPyreVineInstance)) return r

    const plantArg = args[1]
    const info = describePlantArg(plantArg)
    const blocked = PYRE_BLOCK_NAMES.some(function (n) { return info.indexOf(n) >= 0 })

    if (pyreBlockLogged < 8) {
      pyreBlockLogged += 1
      note('柴火藤蔓禁种判定 #' + pyreBlockLogged +
           '：格内有柴火藤蔓，待种=' + info + ' 拦截=' + blocked)
    }
    if (blocked) return false
  } catch (err) {
    noteOnce('pyreblock-err', '禁种判定失败 ' + errText(err))
  }
  return r
}

/** 判断某个藤蔓实例是不是柴火藤蔓 */
function isPyreVineInstance(v) {
  if (!v || v.dead) return false
  const cls = ENGINE_REFS.PyreVinePlant
  if (cls) {
    try { if (v instanceof cls) return true } catch (e) { /* 继续试别的办法 */ }
    try { if (v.constructor === cls) return true } catch (e) { /* 继续 */ }
    try {
      const proto = cls.prototype
      if (proto && Object.prototype.isPrototypeOf.call(proto, v)) return true
    } catch (e) { /* 放弃 */ }
  }
  // 退路：靠数据特征认（柴火藤蔓 150 阳光 + 有 FireDistance 字段）
  try {
    const d = v.objdataOwn
    if (d && d.FireDistance !== undefined && d.SunCost === 150) return true
  } catch (e) { /* 放弃 */ }
  return false
}

/** 把「待种植物」这个参数里的可读信息尽量挖出来，供诊断与黑名单匹配 */
function describePlantArg(plantArg) {
  const bits = ['raw=' + plantArg]
  try {
    const f = plantArg && plantArg.TAGS ? plantArg : null
    if (f) {
      bits.push('TAGS=' + f.TAGS.join('/'))
      if (f.CODENAME) bits.push('CODENAME=' + f.CODENAME)
      if (f.NAME) bits.push('NAME=' + JSON.stringify(f.NAME))
    }
  } catch (e) { /* 忽略 */ }
  return bits.join(' ')
}

/**
 * H 类：西瓜类投手的三车道索敌。
 *
 * 本道判定/选目标的结果照原样返回；只有「本道空着」且「格内有爆裂藤蔓」时，
 * 才去上下两条道找。这样单道场景的行为与不装模组完全一致。
 */
let melonLaneLogged = 0
function applyMelonLanes(entry, thisArg, callNext, args) {
  let own = null
  try { own = callNext(...args) } catch (e) { own = null }

  try {
    if (!thisArg || thisArg.dead) return own
    if (!hasBlastVineInSquare(thisArg)) return own

    if (entry.melonLanes === 'detect') {
      if (own) return own                          // 本道已有目标
      const hit = otherLanes(thisArg).some(function (lane) {
        return laneHasTarget(thisArg, lane)
      })
      if (hit && melonLaneLogged < 8) {
        melonLaneLogged += 1
        note('西瓜类投手三车道：本道无目标，已扩到相邻道（开火判定命中）')
      }
      return own || hit
    }

    if (entry.melonLanes === 'target') {
      if (own) return own                          // 本道有目标就优先本道
      const picked = pickTargetAcrossLanes(thisArg)
      if (picked && melonLaneLogged < 8) {
        melonLaneLogged += 1
        note('西瓜类投手三车道：本道无目标，已从相邻道取到目标')
      }
      return picked || own
    }
  } catch (err) {
    noteOnce('melonlane-err', '三车道索敌失败 ' + errText(err))
  }
  return own
}

/** 同格里有没有爆裂藤蔓（藤蔓登记在 inLnC.vineInSquare 中） */
function hasBlastVineInSquare(plant) {
  const lnc = plant && plant.inLnC
  if (!lnc || !Array.isArray(lnc.vineInSquare)) return false
  const cls = ENGINE_REFS.BlastBerryVinePlant
  for (let i = 0; i < lnc.vineInSquare.length; i++) {
    const v = lnc.vineInSquare[i]
    if (!v || v.dead) continue
    if (cls) {
      try { if (v instanceof cls) return true } catch (e) { /* 换下一种比法 */ }
      try { if (v.constructor === cls) return true } catch (e) { /* 换下一种比法 */ }
      try {
        if (cls.prototype && Object.prototype.isPrototypeOf.call(cls.prototype, v)) return true
      } catch (e) { /* 放弃该类名判定 */ }
    }
    // 退路：靠数据特征认（爆裂藤蔓的弹种是 blastberry）
    try {
      const d = v.objdataOwn
      if (d && (d.CabbageType === 'blastberry' || d.CabbageTypePlantfood === 'blastberry_pf')) {
        return true
      }
    } catch (e) { /* 放弃这条藤蔓 */ }
  }
  return false
}

/** 本植物所在道之外的上下两条道 */
function otherLanes(plant) {
  const mid = plant && plant.inLane
  const out = []
  if (!mid) return out
  if (mid.UpperLane) out.push(mid.UpperLane)
  if (mid.LowerLane) out.push(mid.LowerLane)
  return out
}

/**
 * 某条道上有没有「位于本植物右侧的可见僵尸」。
 *
 * 这里刻意不套用 `this.detector`：它的高度只有一格
 * （`createRectangleNodeSide(node, SquareWidth*(9-cIndex), SquareHeight)`），
 * 拿去判别道的僵尸纵向必然不重叠，会永远判不中。
 */
function laneHasTarget(plant, lane) {
  if (!lane || typeof lane.zombiePool !== 'function') return false
  let px = 0
  try { px = plant.node ? plant.node.worldPosition.x : 0 } catch (e) { px = 0 }
  let pool = []
  try { pool = lane.zombiePool() } catch (e) { return false }
  for (let i = 0; i < pool.length; i++) {
    const z = pool[i]
    try {
      if (!z || z.dead) continue
      if (typeof plant.zombieIsVisible === 'function' && !plant.zombieIsVisible(z)) continue
      const zx = z.node ? z.node.worldPosition.x : null
      if (zx !== null && zx > px) return true
    } catch (e) { /* 单个僵尸判不了就跳过 */ }
  }
  return false
}

/** 从上下两条道里挑一个最靠前的可见目标 */
function pickTargetAcrossLanes(plant) {
  let best = null
  const lanes = otherLanes(plant)
  for (let i = 0; i < lanes.length; i++) {
    let pool = []
    try { pool = lanes[i].zombiePool().concat() } catch (e) { continue }
    pool.sort(function (a, b) { return a.worldPositionX - b.worldPositionX })
    for (let j = 0; j < pool.length; j++) {
      const z = pool[j]
      try {
        if (!z || z.dead) continue
        if (typeof plant.zombieIsVisible === 'function' && !plant.zombieIsVisible(z)) continue
        if (!best || z.worldPositionX < best.worldPositionX) best = z
      } catch (e) { /* 跳过这个僵尸 */ }
    }
  }
  return best || undefined
}

/** J 类：忧郁藤蔓的暗影光环 —— 只作用于「同格（藤蔓上方）那一株」
 *
 *  引擎侧 `Plant.judgeShadowPlantMode()` 每帧重算 `ShadowPowered`：
 *      if ((this.inLnC?.shadowCD > 0 || MintBoosted) && !this.ShadowPowered)  → 置 true
 *      else if (this.inLnC?.shadowCD <= 0 && !MintBoosted && this.ShadowPowered) → 置 false
 *
 *  注意 `shadowCD` 是**行级**的。早先一版用 `LnC.setShadowBuff` 续它，
 *  结果是同行所有带暗影形态的植物一起进入暗影 —— 范围超出需求。
 *
 *  改为挂在本方法之后：只对「同格里站着忧郁藤蔓」的那一株补位。
 *  本方法每帧都会重算，所以每帧对着同一株补一次即可。
 */

let gloomShadowLogged = 0
function applyGloomShadow(entry, thisArg, callNext, args) {
  const r = callNext(...args)
  try {
    const plant = thisArg
    if (!plant || plant.dead || !plant.haveDarkMode) return r

    const hasGloom = hasGloomVineInSquare(plant)

    // 解除暗影惩罚：同格有忧郁藤蔓时把本实例的 ShadowPoweredDamageScale 视为 1，
    // 离开后恢复原值。
    // 注意 objdataOwn 是**实例属性**（引擎里是 `this._objdataOwn = new X`），
    // 所以改它不会影响别的植株 —— 这也是「只作用于同格」的关键。
    try {
      const od = plant.objdataOwn
      if (od && od.ShadowPoweredDamageScale !== undefined) {
        if (plant.__zfaOrigShadowScale === undefined) {
          plant.__zfaOrigShadowScale = od.ShadowPoweredDamageScale
        }
        const want = hasGloom ? 1 : plant.__zfaOrigShadowScale
        if (od.ShadowPoweredDamageScale !== want) od.ShadowPoweredDamageScale = want
      }
    } catch (e) { /* objdataOwn 不可写就跳过 */ }

    if (!hasGloom) return r                                // 不同格，不走暗影光环
    if (plant.ShadowPowered) return r                      // 已在暗影中，不重复触发

    plant.ShadowPowered = true
    try {
      if (plant._darkSlots) {
        plant._darkSlots.forEach(function (s) { s.displayIndex = 1 })
      }
    } catch (e) { /* 视觉槽位拿不到就算了 */ }
    try {
      if (typeof plant.onShadowPoweredChanged === 'function') plant.onShadowPoweredChanged()
    } catch (e) { /* 同上 */ }

    if (gloomShadowLogged < 8) {
      gloomShadowLogged += 1
      note('忧郁藤蔓暗影光环：同格植物已进入暗影并解除半伤（' + classNameOf(plant) + '）')
    }
  } catch (err) {
    noteOnce('gloomshadow-err', '暗影光环失败 ' + errText(err))
  }
  return r
}

/** 同格里有没有忧郁藤蔓（排除植物自身） */
function hasGloomVineInSquare(plant) {
  const lnc = plant && plant.inLnC
  if (!lnc || !Array.isArray(lnc.vineInSquare)) return false
  const cls = ENGINE_REFS.GloomVinePlant
  for (let i = 0; i < lnc.vineInSquare.length; i++) {
    const v = lnc.vineInSquare[i]
    if (!v || v.dead || v === plant) continue
    if (cls) {
      try { if (v instanceof cls) return true } catch (e) { /* 换下一种比法 */ }
      try { if (v.constructor === cls) return true } catch (e) { /* 换下一种比法 */ }
      try {
        if (cls.prototype && Object.prototype.isPrototypeOf.call(cls.prototype, v)) return true
      } catch (e) { /* 放弃该类名判定 */ }
    }
  }
  return false
}

/** 取实例的构造名（打包后可能被压缩，仅用于诊断） */
function classNameOf(obj) {
  try {
    return (obj && obj.constructor && obj.constructor.name) || '?'
  } catch (e) { return '?' }
}

// markShoveled / applyShovelMark 已废弃：
// 「铲除」不再单独识别，改由 die 的实参统一判定（见 applyDieArgs / applyLossVerdict）。

/**
 * 损耗裁决：被僵尸弄死的算，明确的移除（铲除 / 自然消耗）不算。
 *
 * 引擎里**带参数调 die 的只有两种**（全文件实测）：
 *     .die(!0)   → n = true   「算作被击杀」
 *     .die(!1)   → n = false  「明确移除」
 * 这就是天然的区分器，不必逐一枚举死法 —— 枚举必然漏。
 *
 * 僵尸的杀伤途径很多：啃食、焚烧、甩麦克风、碾压、击飞、踢出场地、
 * 僵尸爆炸、被顶飞……它们最终都汇到 kill() → die()（不带参数），
 * 因此「除显式移除之外一律计入」正好覆盖全部僵尸杀伤。
 *
 * eat() 另外单独标记一次，作为「确实被啃过」的确定性证据：
 * 即使某条路径后来补了一次 die(false)，被啃过的仍然计入。
 */
let lossLogCount = 0
function applyEatMark(entry, thisArg, callNext, args) {
  try {
    if (thisArg) thisArg.__zfaEaten = true
  } catch (e) { /* 标不上不影响主流程 */ }
  return callNext(...args)
}

function applyDieArgs(entry, thisArg, callNext, args) {
  try {
    if (thisArg) thisArg.__zfaDieArg = args.length > 0 ? args[0] : undefined
  } catch (e) { /* 记不上不影响主流程 */ }
  return callNext(...args)
}

function applyLossVerdict(entry, thisArg, callNext, args) {
  const orig = callNext(...args)
  try {
    if (!orig) return orig                       // 引擎本来就不算，别动
    const plant = thisArg
    const eaten = !!(plant && plant.__zfaEaten)
    const explicitRemove = !!(plant && plant.__zfaDieArg === false)
    const isLosing = !!(plant && LOSING_PLANT_IDS.has(plant.ID))
    // 「本来就会自己消失」的植物一律不计；其余除显式移除之外一律计入
    const counted = !isLosing && (eaten || !explicitRemove)

    if (lossLogCount < 12) {
      lossLogCount += 1
      note('损耗裁决：' + classNameOf(plant) + ' ID=' + (plant && plant.ID) +
           ' 被啃=' + eaten + ' 显式移除=' + explicitRemove + ' 自消失类=' + isLosing +
           ' -> ' + (counted ? '计' : '不计'))
    }
    if (!counted) return false
  } catch (err) {
    noteOnce('lossverdict-err', '损耗裁决失败 ' + errText(err))
  }
  return orig
}

/** 柴火藤蔓的弹种转换表（命中的换掉，未命中原样放行） */
const PYRE_SWAP_MAP = {
  pea: 'pea_flame_yellow',             // 普通豌豆 → 黄火
  pea_snow: 'pea',                     // 冰豌豆 → 普通豌豆
  pea_flame_yellow: 'pea_flame_blue',  // 黄火 → 蓝火
  winter_melon: 'melon',               // 冰西瓜 → 西瓜
  cabbage: 'pepper',                   // 卷心菜 → 甜椒
  blastberry: 'cantaloupe',            // 爆莓 → 哈密瓜
}

/**
 * E 类：柴火藤蔓换弹。
 *
 * 实现方式的关键取舍：弹种字段（`objdataOwn.PeaType` / `CabbageType`）
 * 是植物**长期持有**的属性，改一次就一直生效，不必卡在发射时机。
 * 而 `_shoot` 是各植物子类**各自定义**的（`Plant.ts` 里根本没有），
 * 无法用一条 hook 覆盖 —— 这也是上一版挂空的原因。
 *
 * 所以挂在 `LnC.update` 上：每帧只处理「本格站着柴火藤蔓」的格子，
 * 把该格植物的弹种同步成被点燃后的版本；藤蔓没了再同步回原值。
 */
let pyreSyncLogged = 0
function applyPyreSync(entry, thisArg, callNext, args) {
  const r = callNext(...args)
  try {
    const lnc = thisArg
    if (lnc && Array.isArray(lnc.vineInSquare) && lnc.vineInSquare.length) {
      syncPyreOnLnC(lnc)
    }
  } catch (err) {
    noteOnce('pyresync-err', '换弹同步失败 ' + errText(err))
  }
  return r
}

/** 判断某个藤蔓实例是不是柴火藤蔓 */
function isPyreVine(v) {
  if (!v || v.dead) return false
  const cls = ENGINE_REFS.PyreVinePlant
  if (cls) {
    try { if (v instanceof cls) return true } catch (e) { /* 换下一种比法 */ }
    try { if (v.constructor === cls) return true } catch (e) { /* 换下一种比法 */ }
    try {
      if (cls.prototype && Object.prototype.isPrototypeOf.call(cls.prototype, v)) return true
    } catch (e) { /* 放弃该类名判定 */ }
  }
  // 退路：数据特征（柴火藤蔓 150 阳光 + 带 FireDistance）
  try {
    const d = v.objdataOwn
    if (d && d.FireDistance !== undefined && d.SunCost === 150) return true
  } catch (e) { /* 放弃 */ }
  return false
}

/** 本格里有没有柴火藤蔓 */
function lncHasPyreVine(lnc) {
  const vines = lnc && lnc.vineInSquare
  if (!Array.isArray(vines)) return false
  for (let i = 0; i < vines.length; i++) {
    if (isPyreVine(vines[i])) return true
  }
  return false
}

/** 把本格植物的弹种同步成「被点着」或「原样」 */
function syncPyreOnLnC(lnc) {
  const hasPyre = lncHasPyreVine(lnc)

  const plants = []
  try {
    if (typeof lnc.getAllPlants === 'function') {
      const all = lnc.getAllPlants()
      if (Array.isArray(all)) for (let i = 0; i < all.length; i++) plants.push(all[i])
    }
  } catch (e) { /* 换下一条来源 */ }
  if (Array.isArray(lnc.plantInSquare)) {
    for (let i = 0; i < lnc.plantInSquare.length; i++) plants.push(lnc.plantInSquare[i])
  }
  if (Array.isArray(lnc.vineInSquare)) {
    for (let i = 0; i < lnc.vineInSquare.length; i++) plants.push(lnc.vineInSquare[i])
  }

  for (let i = 0; i < plants.length; i++) {
    syncPlantProjectiles(plants[i], hasPyre)
  }
}

/** 单个植物的弹种同步（只碰 PeaType / CabbageType 两个字段） */
function syncPlantProjectiles(plant, hasPyre) {
  const od = plant && plant.objdataOwn
  if (!od) return

  const keys = ['PeaType', 'CabbageType']
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    const cur = od[key]
    if (typeof cur !== 'string') continue

    const origKey = '__zfaOrig_' + key
    if (plant[origKey] === undefined) plant[origKey] = cur
    const orig = plant[origKey]
    const want = hasPyre ? (PYRE_SWAP_MAP[orig] || orig) : orig
    if (cur === want) continue
    try {
      od[key] = want
      if (pyreSyncLogged < 10) {
        pyreSyncLogged += 1
        note('柴火藤蔓换弹：' + key + ' ' + cur + ' -> ' + want)
      }
    } catch (e) { /* 字段只读就跳过 */ }
  }
}

function makeHandler(entry, ctx) {
  return function ({ thisArg, args, callNext }) {
    try {
      if (entry.deathrattle) return applyDeathrattle(entry, thisArg, callNext, args, ctx)

      const eventName = args[0] && args[0].name
      if (entry.fireEvents && entry.fireEvents.indexOf(eventName) < 0) return callNext(...args)
      if (isFooding(thisArg)) return callNext(...args)

      if (entry.table) return applyWeight(entry, thisArg, callNext, args)
      if (entry.extraShots) return applyExtraShots(entry, thisArg, callNext, args, ctx)
      if (entry.chance) return applyFoodSwap(entry, thisArg, callNext, args)
      if (entry.pyreSync) return applyPyreSync(entry, thisArg, callNext, args)
      if (entry.ignite) return applyPyreIgnite(entry, thisArg, callNext, args, ctx)
      if (entry.gloomShadow) return applyGloomShadow(entry, thisArg, callNext, args)
      if (entry.pyreBlock) return applyPyreBlock(entry, thisArg, callNext, args)
      if (entry.melonLanes) return applyMelonLanes(entry, thisArg, callNext, args)
      if (entry.eatMark) return applyEatMark(entry, thisArg, callNext, args)
      if (entry.dieArgs) return applyDieArgs(entry, thisArg, callNext, args)
      if (entry.lossVerdict) return applyLossVerdict(entry, thisArg, callNext, args)
      return callNext(...args)
    } catch (err) {
      noteOnce('handler', entry.label + ': 钩子抛错 ' + errText(err))
      return callNext(...args)
    }
  }
}

/** 把继承来的方法固化成"本类自有"，这样 hooks.wrapMethod 面对继承方法也能正确包住。
 *  例：高坚果的 specialPlantOnKilled 来自 WallNutPlant，不固化的话坚果墙也可能被一起改。 */
function materializeInherited(target, methodName) {
  try {
    if (Object.prototype.hasOwnProperty.call(target, methodName)) return
    const inherited = target[methodName]
    if (typeof inherited !== 'function') return
    target[methodName] = function (...a) {
      return inherited.apply(this, a)
    }
  } catch (err) {}
}

function installHook(ctx, entry, cls) {
  const hooks = ctx.unsafe && ctx.unsafe.hooks
  const proto = cls.prototype
  const method = entry.listener
  if (typeof proto[method] !== 'function') {
    note(entry.label + ': 原型上没有 ' + method)
    return false
  }
  materializeInherited(proto, method)

  if (hooks && typeof hooks.wrapMethod === 'function') {
    try {
      hooks.wrapMethod({ target: proto, methodName: method, handler: makeHandler(entry, ctx) })
      return true
    } catch (err) {
      note(entry.label + ': wrapMethod 抛错，改用直接包装 ' + errText(err))
    }
  }

  // 兜底：GP-Next 的 wrapMethod 不可用时，直接在原型上包一层
  try {
    const orig = proto[method]
    const handler = makeHandler(entry, ctx)
    proto[method] = function (...a) {
      return handler({ thisArg: this, args: a, callNext: (...x) => orig.apply(this, x) })
    }
    noteOnce('directwrap', entry.label + ': 使用直接包装（未走 hooks.wrapMethod）')
    return true
  } catch (err) {
    note(entry.label + ': 直接包装失败 ' + errText(err))
    return false
  }
}

function describe(entry) {
  const s = stats.get(entry.label)
  if (!s || (s.shots === 0 && s.extra === 0)) return '0 次'
  if (entry.deathrattle) {
    return `亡语触发 ${s.extra} 次 · 砸中 ${s.hits} 只 · 累计 ${s.damage} 伤害`
  }
  if (entry.table) {
    return entry.table
      .map((t) => {
        const hits = s.counts.get(t.type) || 0
        return `${t.name} ${hits}(${((hits / s.shots) * 100).toFixed(1)}%)`
      })
      .join(' · ')
  }
  if (entry.extraShots) {
    return `${s.shots} 次发射 · 触发连射 ${s.extra}(${((s.extra / s.shots) * 100).toFixed(1)}%)`
  }
  return `${s.shots} 次发射 · 触发大招弹 ${s.food}(${((s.food / s.shots) * 100).toFixed(1)}%)`
}

function dumpDiagnostics(ctx) {
  ctx.log.warn('[综合平衡] ---- 诊断 ----')
  for (let i = 0; i < diagLines.length; i++) ctx.log.warn('[综合平衡] ' + diagLines[i])
  ctx.log.warn('[综合平衡] ---- 诊断结束 ----')
}

function definePanel(ctx) {
  try {
    ctx.controls.definePanel({
      title: '综合平衡调整',
      description: '各植物射击时按规则换弹种、多发射击或触发大招弹。',
      groups: [
        {
          title: '发射统计',
          items: ALL_TARGETS.map((entry) => ({
            type: 'readonly',
            key: 'stat-' + entry.cls,
            label: entry.label,
            getValue: () => describe(entry),
          })),
        },
        {
          title: '操作',
          items: [
            {
              type: 'action',
              key: 'diag',
              label: '输出诊断到日志',
              onClick: () => {
                dumpDiagnostics(ctx)
                ctx.ui.toast('诊断已写入日志', 'info')
              },
            },
            {
              type: 'action',
              key: 'reset',
              label: '清零统计',
              onClick: () => {
                stats.clear()
                ctx.ui.toast('统计已清零', 'info')
              },
            },
          ],
        },
      ],
    })
  } catch (err) {
    ctx.log.warn('[综合平衡] 面板创建失败：' + errText(err))
  }
}

export default {
  startup(ctx) {
    try {
      note('startup 进入')
      const engine = ctx && ctx.engine
      resolveEngineRefs(engine, ctx)
      for (let i = 0; i < ALL_TARGETS.length; i++) {
        const entry = ALL_TARGETS[i]
        const found = locateClass(engine, entry.cls, entry.module)
        if (found) {
          resolved.set(entry.cls, found)
        } else {
          note(`${entry.label}(${entry.cls}) 未定位`)
        }
      }
      ctx.log.warn(`[综合平衡] startup 定位 ${resolved.size}/${ALL_TARGETS.length} 个植物类`)
      if (resolved.size < ALL_TARGETS.length) dumpDiagnostics(ctx)
    } catch (err) {
      note('startup 顶层异常: ' + errText(err))
      try {
        ctx.log.error('[综合平衡] startup 异常：' + errText(err))
        dumpDiagnostics(ctx)
      } catch (inner) {}
    }
  },

  setup(ctx) {
    try {
      let hooked = 0
      const failed = []
      for (let i = 0; i < ALL_TARGETS.length; i++) {
        const entry = ALL_TARGETS[i]
        const found = resolved.get(entry.cls)
        if (!found) {
          failed.push(entry.label)
          continue
        }
        try {
          if (installHook(ctx, entry, found.cls)) hooked += 1
          else failed.push(entry.label)
        } catch (err) {
          note(entry.label + ': 挂载抛错 ' + errText(err))
          failed.push(entry.label)
        }
      }

      note('模组已启动：钩子就绪（连射 / 开大 / 亡语 / 柴火藤蔓点火 / 忧郁藤蔓光环）v' + MOD_VERSION)
      ctx.log.warn(`[综合平衡] 已挂载 ${hooked}/${ALL_TARGETS.length} 个植物`)
      if (failed.length) note('未挂载：' + failed.join('、'))

      if (hooked === 0) {
        dumpDiagnostics(ctx)
        ctx.ui.toast('综合平衡：钩子全部挂载失败（详见日志）', 'error')
        return
      }
      ctx.ui.toast(`综合平衡已生效（${hooked}/${ALL_TARGETS.length} 个植物）`, 'success')
      definePanel(ctx)
    } catch (err) {
      try {
        ctx.log.error('[综合平衡] setup 异常：' + errText(err))
        dumpDiagnostics(ctx)
      } catch (inner) {}
    }
  },
}
