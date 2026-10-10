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

const ALL_TARGETS = [].concat(WEIGHT_TARGETS, EXTRA_SHOT_TARGETS, FOOD_TARGETS, DEATHRATTLE_TARGETS)

const diagLines = []
const notedOnce = new Set()
const stats = new Map()
const resolved = new Map()

function note(line) {
  try {
    if (diagLines.length >= 200) return
    diagLines.push(String(line))
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

function resolveEngineRefs(engine, ctx) {
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
    if (ctx && ctx.log && typeof ctx.log.info === 'function') ctx.log.info('[综合平衡] ' + line)
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
  ctx.log.info('[综合平衡] ---- 诊断 ----')
  for (let i = 0; i < diagLines.length; i++) ctx.log.info('[综合平衡] ' + diagLines[i])
  ctx.log.info('[综合平衡] ---- 诊断结束 ----')
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
      ctx.log.info(`[综合平衡] startup 定位 ${resolved.size}/${ALL_TARGETS.length} 个植物类`)
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

      ctx.log.info(`[综合平衡] 已挂载 ${hooked}/${ALL_TARGETS.length} 个植物`)
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
