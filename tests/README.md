# tests

模拟验收测试，不需要游戏本体。

```bash
npm test          # 等价于 node tests/run.mjs
```

## 文件

| 文件 | 作用 |
|---|---|
| `harness.mjs` | 断言器 + 最小 ModContext 工厂（log / ui / clock） |
| `suite-package.mjs` | 交付物一致性：清单字段、三份数据补丁、许可与声明、README 口径 |
| `run.mjs` | 入口导出、挂载表静态检查、宿主兜底、再跑交付物套件 |

## 覆盖范围

- **清单**：uuid / name / version / author / `js.startup` / 未声明 `requiredGpNextFeatures`
- **数据补丁**：
  - `PlantProps` 39 条，objclass 与 alias 唯一性
  - `ProjectileProps` 8 条，全部带 `Damage`
  - `PlantAlmanac` 46 条，每条都有 `Special`
  - 关键数值：豌豆藤 175、豌豆迫击炮 250、原始坚果墙本体与护甲同为 5000
- **挂载表**：四类目标组存在，且含关键植物
- **宿主兜底**：只有 `log` / `ui` 的残缺 ctx，`startup + setup` 不抛异常
- **README 口径**：含「特性」章节、说明 175 的再平衡理由、不含「点 bat」式指引

## 不在断言范围内

**运行期手感** —— 连射触发率、弹种实际分布、亡语伤害数值 —— 不在断言范围内。
那部分靠游戏内面板的命中统计与日志核对，依据见 `docs/ENGINE-NOTES.md`。

原因很实际：这些效果依赖引擎的动画事件时序与随机数，
假类还原出来的分布与真机不会一致，硬断言反而会给出虚假的信心。

## 用发布产物复测

`tools/pack.ps1` 打完包会自动解包，并用**包内**的 `scripts/main.js` 重跑同一套断言。
手动跑等价于：

```bash
JBTMG_PKG_ROOT=<解包目录> JBTMG_ENTRY=<解包目录>/scripts/main.js node tests/run.mjs
```

> 解包目录里没有 `package.json`，`.js` 会被 node 当成 CommonJS。
> `tools/pack.ps1` 的做法是往解包目录补一个 `{"type":"module"}`。
