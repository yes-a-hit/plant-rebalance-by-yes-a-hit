# 引擎笔记

本模组每条改动对应的引擎事实，逐条核对而来，**不是推测**。
改动 `scripts/main.js` 之前，先回这里对照。

> **来源与引用**
> 本文件是对 PvZ2 Gardendless 运行期行为的**互操作性观察笔记**，
> 用于让本模组正确地与目标软件配合，**不复制其源代码**。
> 文中摘录的少量标识符与实现片段，是为说明互操作所必需的**最小引用**，
> 版权归原项目 `Gzh0821/pvzge_web` 及其权利人所有；本仓库不分发该项目的任何文件。
> 完整声明见 [`NOTICE.md`](../NOTICE.md)。

**来源**：`Gzh0821/pvzge_web` 仓库的 `docs/assets/main/index.js`（未压缩 bundle，可直接 grep）。

---

## ⚠️ 三条硬约束（都踩过，写代码前先看）

### 1. 运行时禁止访问引擎

GP-Next 在 **`startup(ctx)` 阶段结束后关闭引擎访问**。此后任何
`engine.getModuleExport(...)` / `engine.getClassByName(...)` / `engine.getCc()`
都会抛 **`Startup engine access is closed`**，**而且不会崩** ——
只表现为功能「改了没效果」，是最难定位的一类失效。

```js
// ✗ 运行时才去取引擎 —— 抛 Startup engine access is closed
const mod = moduleValue(ctx.engine, 'chunks:///_virtual/Torchwood.ts', 'TorchwoodPlant')

// ✓ startup 阶段把函数本体缓存下来，运行时只调缓存引用
ENGINE_REFS.TorchwoodIgnite = moduleValue(
  engine, 'chunks:///_virtual/Torchwood.ts', 'TorchwoodPlant').prototype.ignite
// 运行时：
plant.ignite = ENGINE_REFS.TorchwoodIgnite.bind(plant)
```

另外：**`setup(ctx)` 阶段 `ctx.engine` 就是 `undefined`**（只有 `startup(ctx)` 有）。
而所有 handler 都是 setup 里通过 `makeHandler(entry, ctx)` 创建的，
闭包捕获的那个 ctx 永远没有 engine —— 所以 handler 内部读 `ctx.engine` 恒为空。

### 2. 诊断日志必须直接输出到控制台

把内容 push 进内存数组**不算**「打了日志」—— 如果那个数组只在少数分支才被
打印，正常运行时模组就是哑巴的，会被误判成「模组没加载」。

另外 **DevTools 控制台默认只显示 Warning 及以上**，`info` 会被过滤掉，
所以走 `console.warn`。诊断也不能只打前 N 次 —— 用户重进关卡时早就打完了。

### 3. 打包后类名会被压缩

实测投射物实例的 `constructor.name` 是单字母 `t`。所以「这是不是某某植物」
不能靠类名判断，要用 startup 阶段缓存的类做 `instanceof` / 原型比对，
或者退回数据特征（例如 `objdataOwn.CabbageType === 'blastberry'`）。

## 挂载点总表

八类目标组：

| 组 | 机制 | 挂载点 |
|---|---|---|
| `WEIGHT_TARGETS` | 加权替换 `objdataOwn.PeaType` | 各豌豆系 `animationListener` |
| `EXTRA_SHOT_TARGETS` | 概率额外调用 `_shoot()` | 同组 A |
| `FOOD_TARGETS` | 概率把弹种换成 `PeaTypePlantfood` | 同组 A |
| `DEATHRATTLE_TARGETS` | 死亡亡语·弹起砸地 | `WallNutPlant.specialPlantOnKilled` |
| `PYRE_TARGETS` | 柴火藤蔓点燃投射物 | `PyreVinePlant.specialPlantUpdate` |
| `GLOOM_TARGETS` | 忧郁藤蔓给所在行挂暗影状态 | `GloomVinePlant.specialPlantUpdate` |
| `PYRE_BLOCK_TARGETS` | 柴火藤蔓禁种 8 种 | `LnC.prototype.putPlantAvailable` |
| `MELON_LANE_TARGETS` | 西瓜类投手在爆裂藤蔓上索敌三条道 | `MelonPultPlant` / `CantaloupePultPlant` 的 `detectEnemy` + `getLobTarget` |

## 藤蔓相关引擎事实

### 点火（`Torchwood` → 柴火藤蔓）

引擎唯一的现成点火器是 `TorchwoodPlant.ignite(prj, fooded)`，只依赖
`this.inLnC` 与 `this.ignitedCSs`，与「是哪一种植物」无关 —— 所以可以
`bind` 到柴火藤蔓实例上直接用。

投射物池在 **`this.inLane.prjPool()`**（不是 `inLnC.prjPool()`，
两者是不同对象）。平射弹判 `prj.height <= 100`；本模组放开这条以便
连抛物线投掷物一起点。

投射物实例上的 `YellowIgnited` 字段来自数据的 `YellowIgnitedType`，
指明「被点着之后变成哪一种弹」—— 转换规则本身就是数据。

### 禁种（引擎里根本没有这条规则）

`LnC.putPlantAvailable(t, e, n, i, o, a)` 按植物的 `TAGS` 分派：

```js
-1 != TAGS.indexOf("vine") ? this.vineable(p, e, n) : ...
```

而 `vineable` 的实现只看「格子里有没有藤蔓」：

```js
vineable(t, e, n) {
  return (!this.vineCooling || !t) &&
         !(t && this.vineInSquare.length > 0 || this.rail && !this.cart || ...)
}
```

**完全不看底座是哪一种植物。** 所以「某几种不能种在柴火藤蔓上」
必须由模组在 `putPlantAvailable` 上拦。

### 暗影状态（行级 buff）

```js
// 植物侧每帧检查
if (this.haveDarkMode) {
  if (this.inLnC?.shadowCD > 0 && !this.ShadowPowered) {
    this.ShadowPowered = true
    this.onShadowPoweredChanged()
  }
}
// 行侧
LnC.setShadowBuff(秒)  →  this.shadowCD = ...
LnC.update:  shadowCD > 0 && (shadowCD -= dt)
```

`shadowCD` 是**行级**的 —— 所以只要忧郁藤蔓每帧给本行续一个小量
（本模组用 0.2 秒），同行所有带 `haveDarkMode` 的植物就持续处于暗影形态。

各植物在暗影下的表现不同：

| 植物 | 走哪条路 |
|---|---|
| 暗影龙葵 `nightshade` | `ShadowPoweredDamageScale`（原版 0.5 = 伤害减半） |
| 暗物质火龙果 `darkmatterdragonfruit` | `get defaultPea()` 换成 `PeaTypeShadow` |
| 幽暮投手 `dusklobber` | `detectEnemy` 与开火各扩一条道（即「3x3」） |
| 暗影豌豆 `shadowpeashooter` | `ZombiesToDragShadowPowered` |

### 投手的三条道（`CabbagePultPlant`）

```js
detectEnemy() { return this.inLane.zombiePool().some(z =>
    this.zombieIsVisible(z) && this.detector.judgeCrossRec(z.bodyRec)) || ... }
                                       // ↑ 只看 this.inLane

getLobTarget(t) {
  if (void 0 === t) t = this.inLane    // ← 接受车道参数
  ...t.zombiePool().sort(byX).find(...)
}
_lobToZombie(null) 内部会调 this.getLobTarget()   // 所以扩这两个方法就够了
```

`this.detector` 的高度只有一格
（`createRectangleNodeSide(node, SquareWidth*(9-cIndex), SquareHeight)`），
**拿它去判别道的僵尸纵向必然不重叠** —— 跨道判定要用别的条件。

类族：`MelonPultPlant`（西瓜 + 冰西瓜共用，靠数据区分）、
`CantaloupePultPlant`（哈密瓜）、基类都是 `CabbagePultPlant`。

### 藤蔓在格子里的登记

`LnC.vineInSquare` 是藤蔓列表，`LnC.plantInSquare` 是植物列表。
藤蔓叠在植物上时两者同处一个 `LnC`，所以投手可以用
`this.inLnC.vineInSquare` 判断「自己身上有没有爆裂藤蔓」。

### 各植物的事件名

| 植物 | 类 | 监听器 | 发射事件 |
|---|---|---|---|
| 豌豆迫击炮 | `SlingPeaPlant` | `animationListener` | `shoot` |
| 双发射手 | `RepeaterPlant` | `animationListener` | `Shoot` |
| 三发射手 | `ThreePeaterPlant` | `animationListener` | `shootM` / `shootU` / `shootD` |
| 裂荚射手 | `SplitPeaPlant` | `animationListener` | `ShootL` / `ShootR` |
| 豌豆荚 | `PeaPodPlant` | `animationListener` | `Shoot0`…`Shoot4` |
| 寒冰射手 | `SnowPeaPlant` | `animationListener` | `Shoot` |
| 豌豆射手 | `PeashooterPlant` | `animationListener` | `Shoot` |
| 毒液豌豆 | `GooPeashooterPlant` | `animationListener` | `Shoot` |
| 火焰豌豆 | `FirePeashooterPlant` | `animationListener` | `Shoot` |
| 电能豌豆 | `ElectricPeashooter` | `animationListener` | `Shoot` |
| 充能柚子 | `CitronPlant` | `animationListener` | `shoot` |

**注意事件名大小写不统一**（`Shoot` vs `shoot`），照抄，别改。

---

## 三类机制的实现

### A. 加权换弹种（`applyWeight`）

在监听器里按权重量表 `objdataOwn.PeaType`，调用完原实现后还原。

### B. 概率连射（`applyExtraShots`）

```js
if (Math.random() >= entry.chance) return callNext(...args)
// 触发：额外调用 entry.extraShots 次 thisArg._shoot()
for (let i = 1; i <= entry.extraShots; i++) { ... fireOnce() ... }
```

- `delaySeconds` 用 `ctx.clock.setTimeout` 做间隔；拿不到定时器就立即发射（降级）。
- `extraType` 用于**整体换弹种** —— 火焰豌豆的连射就是靠它变成「蓝火大火球」的
  （调用前换、调用后还原）。

### C. 概率开大（`applyFoodSwap`）

把 `PeaType` 换成 `PeaTypePlantfood`。**只换类型，不触发无敌效果。**

### D. 死亡亡语（`applyDeathrattle`）

高坚果倒下时弹起并砸地：用 `Square.SquareWidth` / `SquareHeight` 换算格子坐标，
对落点矩形内的僵尸结算伤害。拿不到 `Square` 时退化为固定像素常量
（`SQUARE_W_FALLBACK = 68` / `SQUARE_H_FALLBACK = 80.77`）。

---

## 特性成因（重要）

README 里那三条「特性」不是玄学，成因很具体：

### 连射会串到所有豌豆

`_shoot` 是**豌豆系共有**的方法，各植物把自己的实现覆写在上面。
`applyExtraShots` 触发时调的是 `thisArg._shoot()` ——
即**当前实例自己的那份实现**，而不是某个统一的发射函数。

于是：只要一只植物进了连射名单，它触发的那次额外发射就**带上它自己的全部特性**。
超级豌豆迫击炮继承了普通迫击炮的特殊攻击逻辑，也是同一条路径的结果。

**这是设计取舍，不是实现失误。** 要改成「只对名单内植物生效」，
得改成在钩子里直接生成投射物、绕过 `_shoot` —— 但那会丢掉各植物的手感差异，
而且和 `PeaType` 的权重表打架。保留串扰反而更好玩。

### 豌豆藤 175 的来历

原版 125 阳光的豌豆藤，产出约等于「1.5 个豌豆射手」，性价比过高。
在连射环境下把价格提到 175，恰好落回合理区间 ——
**这条涨价是配合连射特性的再平衡，不是独立削弱。**

---

## 关键约束

### 投射物型弹种不能进投掷路径

`SlingPeaPlant._shoot` 走的是**抛物线投掷**：

```js
S.lobOneCabbageOnZombie(peaType, ..., 60 * (0.8 + Math.random() * 0.2), ...)
```

`blastberry` 这类自带 `ShotCount` / `ShotType` 的发射器型弹种，
被这条路径处理后**打不出伤害**。投掷路径只接受直线型
（有 `Damage`、无嵌套 `ShotType`）。

### `ShootInterval` 可能是区间对象

既可能是数字，也可能是 `{ Min, Max }`，引擎侧走 `getRandomFromRange`。
改的时候**保持原结构类型**，别把区间拍成数字。

### 继承方法的固化

`materializeInherited` 在包装前会把继承来的方法先固化成**本类自有属性**，
否则 `hooks.wrapMethod` 面对继承方法会连父类一起污染。

### 监听器有两种

`animationListener` 与 `specialPeashooterAnimationListener`。
各植物用哪个不统一，挂载前要逐个确认。

---

## 关键字段所在文件

| 内容 | 文件 |
|---|---|
| 植物 codename / 名称 / 世界 | `Features\PlantFeatures.json` |
| 植物数值（`SunCost` / `ShootInterval` / `Toughness` …） | `Objects\PlantProps.json` |
| **投射物伤害**（经常不在植物身上） | `Objects\ProjectileProps.json` |
| 植物图鉴文本 | `Objects\PlantAlmanac.json` |

**找伤害值时先看投射物** —— 例：甜椒投手 `pepperpult` 自身无 `Damage`，
伤害挂在投射物 `pepper` 上（本包把它从 50 提到 80）。
