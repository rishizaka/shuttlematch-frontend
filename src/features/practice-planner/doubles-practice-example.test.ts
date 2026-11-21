import { describe, expect, it } from 'vitest'
import { createDoublesPracticeExample } from './doubles-practice-example'
import type { DoublesPracticeExampleSet } from './doubles-practice-example'

/** そのセットでコートに立っている番号。 */
function playing(set: DoublesPracticeExampleSet): number[] {
  return set.courts.flatMap((court) => [...court.teamA, ...court.teamB])
}

/** 同じコートに入った4人組を `1,2,3,4` の形にしたもの。 */
function foursomes(sets: DoublesPracticeExampleSet[]): string[] {
  return sets.flatMap((set) =>
    set.courts.map((court) =>
      [...court.teamA, ...court.teamB].sort((a, b) => a - b).join(','),
    ),
  )
}

describe('createDoublesPracticeExample', () => {
  it('10人・2面なら、毎セット8人が出て2人が休む', () => {
    const sets = createDoublesPracticeExample({
      participantCount: 10,
      courtCount: 2,
      setCount: 3,
    })

    expect(sets).toHaveLength(3)
    for (const set of sets) {
      expect(set.courts).toHaveLength(2)
      expect(playing(set)).toHaveLength(8)
      expect(set.resting).toHaveLength(2)
    }
  })

  it('1セットの中で同じ番号が二度出てこない(出場と休憩で全員がちょうど一度ずつ現れる)', () => {
    const sets = createDoublesPracticeExample({
      participantCount: 13,
      courtCount: 2,
      setCount: 6,
    })

    for (const set of sets) {
      const everyone = [...playing(set), ...set.resting]
      expect(new Set(everyone).size).toBe(everyone.length)
      expect([...everyone].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 13 }, (_, i) => i + 1),
      )
    }
  })

  it('番号は昇順に並ぶ(チーム内と休憩)', () => {
    const sets = createDoublesPracticeExample({
      participantCount: 11,
      courtCount: 2,
      setCount: 4,
    })

    for (const set of sets) {
      expect([...set.resting]).toEqual([...set.resting].sort((a, b) => a - b))
      for (const court of set.courts) {
        expect(court.teamA[0]).toBeLessThan(court.teamA[1])
        expect(court.teamB[0]).toBeLessThan(court.teamB[1])
      }
    }
  })

  it('人数がコートを埋めるのに足りなければ例を作らない', () => {
    expect(
      createDoublesPracticeExample({ participantCount: 7, courtCount: 2, setCount: 3 }),
    ).toEqual([])
    expect(
      createDoublesPracticeExample({ participantCount: 3, courtCount: 1, setCount: 3 }),
    ).toEqual([])
  })

  it('セット数が0以下なら例を作らない', () => {
    expect(
      createDoublesPracticeExample({ participantCount: 10, courtCount: 2, setCount: 0 }),
    ).toEqual([])
  })

  // TOP の本文で約束している2点。ここが崩れると、説明文のすぐ下に反例が出てしまう。
  describe.each([
    { participantCount: 10, courtCount: 2 },
    { participantCount: 8, courtCount: 2 },
    { participantCount: 13, courtCount: 2 },
    { participantCount: 6, courtCount: 1 },
    { participantCount: 5, courtCount: 1 },
    { participantCount: 9, courtCount: 2 },
    { participantCount: 12, courtCount: 3 },
    { participantCount: 16, courtCount: 4 },
    { participantCount: 20, courtCount: 4 },
  ])('$participantCount人・$courtCount面', ({ participantCount, courtCount }) => {
    const sets = createDoublesPracticeExample({ participantCount, courtCount, setCount: 3 })

    it('同じ4人が同じコートに二度入らない', () => {
      const seen = foursomes(sets)
      expect(new Set(seen).size).toBe(seen.length)
    })

    it('出場回数の差が1回以内に収まる', () => {
      const played = new Map<number, number>()
      for (let number = 1; number <= participantCount; number++) played.set(number, 0)
      for (const set of sets) {
        for (const number of playing(set)) played.set(number, (played.get(number) ?? 0) + 1)
      }
      const counts = [...played.values()]
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
    })
  })

  it('全員が毎セット出場する人数(8人・2面)では休憩が出ない', () => {
    const sets = createDoublesPracticeExample({
      participantCount: 8,
      courtCount: 2,
      setCount: 3,
    })

    for (const set of sets) expect(set.resting).toEqual([])
  })
})
