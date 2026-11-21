import { describe, expect, it } from 'vitest'
import {
  blockedLanes,
  CAM_D,
  CLEAR_HEIGHT,
  LANE_X,
  MAX_SCORE,
  GAP_RELIEF_CAP,
  GAUGE_FULL_STEP,
  hitsObstacle,
  jumpArc,
  multiplierFor,
  picksUp,
  recoveryRate,
  scaleAt,
  skiLevelOf,
  skiScore,
  speedFor,
  stepFor,
  TIME_LIMIT,
  STEP_TIME,
} from './shatopokoSki'

describe('scaleAt(透視投影の縮小率)', () => {
  it('足元(z=0)は等倍で、奥ほど小さくなる', () => {
    expect(scaleAt(0)).toBe(1)
    let prev = scaleAt(0)
    for (let z = 5; z <= 200; z += 5) {
      const s = scaleAt(z)
      expect(s).toBeLessThan(prev)
      expect(s).toBeGreaterThan(0)
      prev = s
    }
  })

  it('カメラ距離のぶん奥に行くと半分の大きさになる', () => {
    expect(scaleAt(CAM_D)).toBeCloseTo(0.5)
  })
})

describe('speedFor(滑走速度)', () => {
  it('速度段が上がるほど速くなり、頭打ちにならない', () => {
    expect(speedFor(1, 1)).toBeGreaterThan(speedFor(0, 1))
    // 上限を置くと、そこに張り付いた時点で「もっと速く」の動機が消える
    expect(speedFor(40, 1)).toBeGreaterThan(speedFor(20, 1))
    expect(speedFor(200, 1)).toBeGreaterThan(speedFor(100, 1))
  })

  it('転倒で段を失っても、レベルのぶんは初速より速いまま', () => {
    // 速度が完全に振り出しに戻ると、進んだ距離が無駄になった感じが強すぎる
    expect(speedFor(0, 4)).toBeGreaterThan(speedFor(0, 1))
  })

  it('負の段を渡されても初速を下回らない', () => {
    expect(speedFor(-3, 1)).toBe(speedFor(0, 1))
  })
})

describe('multiplierFor / skiScore', () => {
  it('羽根を拾っていなければ倍率1.00で、距離がそのままスコアになる', () => {
    expect(multiplierFor(0)).toBe(1)
    expect(skiScore(1234.9, 0)).toBe(1234)
  })

  it('羽根1枚につき +0.01', () => {
    expect(multiplierFor(20)).toBeCloseTo(1.2)
    expect(multiplierFor(100)).toBeCloseTo(2)
  })

  it('距離と倍率の掛け算(切り捨て)', () => {
    expect(skiScore(2000, 20)).toBe(2400)
  })

  it('距離が0なら羽根をいくら拾っても0点', () => {
    // 掛け算なので、片方だけ伸ばしても伸びない
    expect(skiScore(0, 300)).toBe(0)
  })

  it('登録APIの上限を超えない', () => {
    // 超えるとサーバーが400を返して結果画面が壊れるため、フロントで頭打ちにする
    expect(skiScore(90_000, 500)).toBe(MAX_SCORE)
  })

  it('負の距離でも0を下回らない', () => {
    expect(skiScore(-50, 10)).toBe(0)
  })
})

describe('skiLevelOf', () => {
  it('600m ごとに上がる', () => {
    expect(skiLevelOf(0)).toBe(1)
    expect(skiLevelOf(599)).toBe(1)
    expect(skiLevelOf(600)).toBe(2)
    expect(skiLevelOf(1800)).toBe(4)
  })
})

describe('hitsObstacle', () => {
  const [left, center, right] = LANE_X

  it('同じレーンの地上にいれば当たる', () => {
    expect(hitsObstacle(center, center, 0)).toBe(true)
  })

  it('隣のレーンにいれば当たらない', () => {
    expect(hitsObstacle(left, center, 0)).toBe(false)
    expect(hitsObstacle(right, center, 0)).toBe(false)
  })

  it('十分な高さまで飛んでいれば飛び越えられる', () => {
    expect(hitsObstacle(center, center, CLEAR_HEIGHT + 0.01)).toBe(false)
    expect(hitsObstacle(center, center, CLEAR_HEIGHT - 0.01)).toBe(true)
  })

  it('レーンの中間まで動いていれば、どちらの障害物にも当たらない', () => {
    // 移動中のすり抜け。ここが詰まっていないと「避けたのに当たった」が起きる
    const mid = (left + center) / 2
    expect(hitsObstacle(mid, left, 0)).toBe(false)
    expect(hitsObstacle(mid, center, 0)).toBe(false)
  })
})

describe('picksUp', () => {
  const center = LANE_X[1]

  it('同じレーンの同じ高さなら拾える', () => {
    expect(picksUp(center, center, 0, 0.55)).toBe(true)
  })

  it('空中の羽根は、飛んでいないと届かない', () => {
    expect(picksUp(center, center, 0, 2.2)).toBe(false)
    expect(picksUp(center, center, 2.0, 2.2)).toBe(true)
  })

  it('レーンが違えば高さが合っていても拾えない', () => {
    expect(picksUp(LANE_X[0], center, 0, 0.55)).toBe(false)
  })
})

describe('jumpArc(ジャンプ台の弾道)', () => {
  it('障害物を越えられる高さまで上がる', () => {
    // ここを下回ると、ジャンプ台に乗っても岩を飛び越せず理不尽になる
    expect(jumpArc().apex).toBeGreaterThan(CLEAR_HEIGHT)
  })

  it('滞空は1秒前後。空中の羽根を数枚拾えて、かつ間延びしない長さ', () => {
    const { airtime } = jumpArc()
    expect(airtime).toBeGreaterThan(0.8)
    expect(airtime).toBeLessThan(1.4)
  })

  it('落ちるほうが上がるより長い(羽根がひらいて失速する)', () => {
    // シャトルの空気抵抗をジャンプに持ち込んでいる。ここが逆だとただの放物線になる
    const { apex, airtime } = jumpArc()
    const rise = Math.sqrt((2 * apex) / 23)
    expect(airtime - rise).toBeGreaterThan(rise)
  })
})

describe('stepFor(速度段の決まり方)', () => {
  it('滑り出しは0段で、無事故が続くと段が上がる', () => {
    expect(stepFor(0, 0)).toBe(0)
    expect(stepFor(STEP_TIME - 0.01, 0)).toBe(0)
    expect(stepFor(STEP_TIME, 0)).toBe(1)
    expect(stepFor(STEP_TIME * 3, 0)).toBe(3)
  })

  it('ラケットは無事故の時間とは別に段を積む(打たれれば早く速くなる)', () => {
    expect(stepFor(0, 2)).toBe(2)
    expect(stepFor(STEP_TIME * 2, 2)).toBe(4)
  })

  it('段は青天井。拾い続ければどこまでも上がる', () => {
    expect(stepFor(STEP_TIME * 50, 20)).toBe(70)
    expect(stepFor(STEP_TIME * 200, 0)).toBe(200)
  })

  it('転倒直後(いずれも0)は初速に戻る', () => {
    expect(stepFor(0, 0)).toBe(0)
  })

  it('持ち時間いっぱい転ばなければ、ゲージを振り切るところまで行く', () => {
    expect(stepFor(TIME_LIMIT, 0)).toBeGreaterThan(GAUGE_FULL_STEP)
  })

  it('無事故だけでゲージを振り切るには、持ち時間の半分以上かかる', () => {
    // すぐ振り切れるなら、転ばずに滑り続けることが報われない
    expect(STEP_TIME * GAUGE_FULL_STEP).toBeGreaterThan(TIME_LIMIT * 0.5)
  })
})

describe('recoveryRate(転倒後の立ち直り)', () => {
  it('ぶつかる前の段に戻るまでは再加速が早い', () => {
    expect(recoveryRate(0, 6)).toBeGreaterThan(1)
    expect(recoveryRate(5, 6)).toBeGreaterThan(1)
  })

  it('元の段まで戻ったら、あとは通常のペース', () => {
    expect(recoveryRate(6, 6)).toBe(1)
    expect(recoveryRate(9, 6)).toBe(1)
  })

  it('一度も転んでいなければ(recoverTo=0)ずっと通常ペース', () => {
    expect(recoveryRate(0, 0)).toBe(1)
  })

  it('立ち直りは倍以上。等速で積み直すと1回の事故でプレイが終わる', () => {
    expect(recoveryRate(0, 10)).toBeGreaterThanOrEqual(2)
  })

  it('失った段が大きいほど速く戻る', () => {
    expect(recoveryRate(0, 30)).toBeGreaterThan(recoveryRate(0, 10))
    expect(recoveryRate(0, 10)).toBeGreaterThan(recoveryRate(0, 3))
  })

  it('高速域から落ちても、積み直しは現実的な時間で終わる', () => {
    // 各段ごとに STEP_TIME/倍率 だけかかる。32段ぶん失った場合の合計を見る
    let sec = 0
    for (let step = 0; step < 32; step++) sec += 5 / recoveryRate(step, 32)
    expect(sec).toBeLessThan(30)
  })
})

describe('際限なく速くなること', () => {
  it('ゲージ満タンの段で、初速の2倍以上は出ている', () => {
    // ここが近いと、ジャンプ台を踏み続けるご褒美が薄くなる
    expect(speedFor(GAUGE_FULL_STEP, 1)).toBeGreaterThan(speedFor(0, 1) * 2)
  })

  it('行間隔の緩和には打ち止めがあり、それ以上は速くなるほど避けにくくなる', () => {
    // 緩和が青天井だと、いくら加速しても反応時間が一定に保たれてしまい、
    // 「いつか物理的に間に合わなくなる」という上限の代わりが働かない
    const gapAt = (step: number) => 28 * (1 + Math.min(step, GAP_RELIEF_CAP) * 0.06)
    const reactionAt = (step: number) => gapAt(step) / speedFor(step, 9)
    expect(reactionAt(GAP_RELIEF_CAP)).toBeGreaterThan(reactionAt(GAP_RELIEF_CAP * 2))
    expect(reactionAt(GAP_RELIEF_CAP * 2)).toBeGreaterThan(reactionAt(GAP_RELIEF_CAP * 4))
    // 十分に速くなれば、人間の反応(おおよそ0.25秒)では間に合わなくなる
    expect(reactionAt(60)).toBeLessThan(0.25)
  })
})

describe('blockedLanes(ふさぐレーンの決め方)', () => {
  /** pick を決定的にして、乱数に頼らず中身を確かめる。 */
  const first = () => 0
  const last = (n: number) => n - 1

  it('どんな入力でも、必ず1本は通れる', () => {
    // ここが崩れると避けようがない = 理不尽な即死になる
    for (const n of [0, 1, 2, 3, 99]) {
      for (const pick of [first, last]) {
        const blocked = blockedLanes(n, pick)
        expect(blocked.length).toBeLessThanOrEqual(2)
        expect(new Set(blocked).size).toBe(blocked.length)
        const free = [0, 1, 2].filter((l) => !blocked.includes(l))
        expect(free.length).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('障害物なしの行では、どのレーンもふさがない', () => {
    expect(blockedLanes(0, first)).toEqual([])
  })

  it('ふさぐ本数だけ選ばれる', () => {
    expect(blockedLanes(1, first)).toHaveLength(1)
    expect(blockedLanes(2, first)).toEqual([0, 1])
  })
})
