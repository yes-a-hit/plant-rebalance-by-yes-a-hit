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

## 挂载点总表

四类目标组，共 12 条植物类：

| 组 | 机制 | 植物 |
|---|---|---|
| `WEIGHT_TARGETS` | 加权替换 `objdataOwn.PeaType` | 豌豆迫击炮 / 双发 / 三发 / 裂荚 / 豌豆荚 / 寒冰 / 豌豆射手 / 毒液豌豆 / 火焰豌豆 / 电能豌豆 / 充能柚子 / 高坚果 |
| `EXTRA_SHOT_TARGETS` | 概率额外调用 `_shoot()` | 豌豆射手 / 毒液豌豆 / 火焰豌豆 / 电能豌豆 / 充能柚子 / 高坚果 |
| `FOOD_TARGETS` | 概率把弹种换成 `PeaTypePlantfood` | 电能豌豆 / 充能柚子 / 高坚果 |
| `DEATHRATTLE_TARGETS` | 死亡亡语·弹起砸地 | 高坚果 |

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
