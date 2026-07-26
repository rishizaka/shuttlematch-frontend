import { describe, expect, it } from 'vitest'
import { netGapAt } from './shuttleFlap'
import type { NetGapShape } from './shuttleFlap'

/** 1周期ぶんを細かく刻んで、すき間の上端・下端・高さの範囲を調べる。 */
function sweep(n: NetGapShape, oscSpeed: number, breathSpeed: number) {
  const heights: number[] = []
  const tops: number[] = []
  const bottoms: number[] = []
  for (let i = 0; i < 600; i++) {
    const { gapY, gapH } = netGapAt(n, i * 0.02, oscSpeed, breathSpeed)
    heights.push(gapH)
    tops.push(gapY)
    bottoms.push(gapY + gapH)
  }
  return {
    minH: Math.min(...heights),
    maxH: Math.max(...heights),
    minTop: Math.min(...tops),
    maxBottom: Math.max(...bottoms),
  }
}

const base: NetGapShape = {
  baseGapY: 100,
  baseGapH: 150,
  amp: 0,
  phase: 0.7,
  breathAmp: 0,
  breathPhase: 2.1,
}

describe('netGapAt', () => {
  it('揺れも伸縮もないレベルでは、すき間が動かない', () => {
    const a = netGapAt(base, 0, 2.8, 1.5)
    const b = netGapAt(base, 3.3, 2.8, 1.5)
    expect(a).toEqual({ gapY: 100, gapH: 150 })
    expect(b).toEqual(a)
  })

  it('揺れだけのレベル(2〜3)では、高さは変わらず位置だけが上下する', () => {
    const n = { ...base, amp: 20 }
    const s = sweep(n, 2.8, 1.5)
    expect(s.minH).toBeCloseTo(150)
    expect(s.maxH).toBeCloseTo(150)
    // 中心が ±20 動くので、上端も同じ幅で動く
    expect(s.minTop).toBeCloseTo(80)
    expect(s.maxBottom).toBeCloseTo(270)
  })

  it('レベル4以降は、すき間の高さが基準を中心に伸び縮みする', () => {
    const n = { ...base, amp: 20, breathAmp: 11 }
    const s = sweep(n, 2.8, 1.5)
    expect(s.minH).toBeCloseTo(139)
    expect(s.maxH).toBeCloseTo(161)
    // いちばん広がったときでも、揺れ幅と高さの伸びぶんしか外へ出ない
    // (spawnNet の余白 46 + amp + breathAmp/2 はこの範囲を見込んでいる)
    expect(s.minTop).toBeGreaterThanOrEqual(base.baseGapY - n.amp - n.breathAmp / 2 - 0.01)
    expect(s.maxBottom).toBeLessThanOrEqual(
      base.baseGapY + base.baseGapH + n.amp + n.breathAmp / 2 + 0.01,
    )
  })

  it('伸び縮みしても、すき間の中心は揺れの範囲から外れない', () => {
    const n = { ...base, amp: 20, breathAmp: 20 }
    for (let i = 0; i < 200; i++) {
      const { gapY, gapH } = netGapAt(n, i * 0.05, 2.8, 1.5)
      const center = gapY + gapH / 2
      const rest = base.baseGapY + base.baseGapH / 2
      expect(Math.abs(center - rest)).toBeLessThanOrEqual(n.amp + 0.01)
    }
  })
})
