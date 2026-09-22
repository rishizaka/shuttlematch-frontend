import { describe, expect, it } from 'vitest'
import { createDoublesPracticePlan } from './doubles-practice-plan'

describe('createDoublesPracticePlan', () => {
  it('10人・2面・90分を、休憩2人・15セット・平均12回として見積もる', () => {
    expect(
      createDoublesPracticePlan({
        participantCount: 10,
        courtCount: 2,
        availableMinutes: 90,
        minutesPerSet: 6,
      }),
    ).toMatchObject({
      activePlayersPerSet: 8,
      restingPlayersPerSet: 2,
      playersNeeded: 0,
      setCount: 15,
      totalPlaySlots: 120,
      minimumPlayCount: 12,
      maximumPlayCount: 12,
    })
  })

  it('人数がコートを埋める人数に足りない場合は不足人数を返す', () => {
    const plan = createDoublesPracticePlan({
      participantCount: 7,
      courtCount: 2,
      availableMinutes: 90,
      minutesPerSet: 6,
    })

    expect(plan.playersNeeded).toBe(1)
    expect(plan.restingPlayersPerSet).toBe(0)
  })

  it('割り切れない出場枠は最小・最大の回数で表す', () => {
    const plan = createDoublesPracticePlan({
      participantCount: 13,
      courtCount: 2,
      availableMinutes: 90,
      minutesPerSet: 6,
    })

    expect(plan.restingPlayersPerSet).toBe(5)
    expect(plan.minimumPlayCount).toBe(9)
    expect(plan.maximumPlayCount).toBe(10)
  })
})
