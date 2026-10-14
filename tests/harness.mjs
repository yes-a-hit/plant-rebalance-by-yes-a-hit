/**
 * 通用断言器 + 最小 ModContext 工厂。
 *
 * 本模组的测试主要面向「挂载表 / 数据补丁 / 交付物一致性」；
 * 运行期的实际手感由游戏内面板与日志核对。
 */

let pass = 0
let fail = 0
const failures = []

export function ok(cond, msg, detail) {
  if (cond) {
    pass += 1
    console.log('  ✅ ' + msg)
  } else {
    fail += 1
    failures.push(msg + (detail ? ' :: ' + detail : ''))
    console.log('  ❌ ' + msg + (detail ? ' :: ' + detail : ''))
  }
}

export function near(a, b, eps, msg) {
  ok(Math.abs(a - b) <= eps, msg, `${a} vs ${b}`)
}

export function section(title) {
  console.log('\n===== ' + title + ' =====')
}

export function summary() {
  console.log('\n' + '='.repeat(52))
  console.log(`通过 ${pass} 项，失败 ${fail} 项`)
  if (fail) {
    console.log('失败明细：')
    failures.forEach((f) => console.log('  - ' + f))
    process.exitCode = 1
  } else {
    console.log('全部断言通过 ✅')
  }
}

/** 最小 ModContext：log / ui / clock，够 startup + setup 跑完不抛 */
export function makeCtx(over = {}) {
  return {
    log: { info() {}, warn() {}, error() {} },
    ui: { toast() {} },
    clock: {
      setTimeout(fn) { try { fn() } catch (e) { /* 忽略 */ } return 0 },
      onTick() {},
    },
    ...over,
  }
}
