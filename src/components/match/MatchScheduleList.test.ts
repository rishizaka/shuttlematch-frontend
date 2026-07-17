import { describe, expect, it } from 'vitest'
import { groupMatchesBySet } from './MatchScheduleList'
import type { Match } from '../../lib/types'

const match = (
  n: number,
  a1: string,
  a2: string,
  b1: string,
  b2: string,
  setNumber = n,
  courtNumber: number | null = null,
): Match => ({
  matchNumber: n,
  setNumber,
  pairA: { player1Id: a1, player2Id: a2 },
  pairB: { player1Id: b1, player2Id: b2 },
  courtNumber,
  startedAt: null,
})

const matches: Match[] = [
  match(1, 'p1', 'p2', 'p3', 'p4'),
  match(2, 'p5', 'p6', 'p1', 'p3'),
  match(3, 'p2', 'p4', 'p5', 'p6'),
]

describe('groupMatchesBySet', () => {
  it('セット番号でまとめ、セット昇順・各セット内はコート番号昇順にする', () => {
    // わざと順不同(第2セットのコート2が先、第1セットが後)で渡す
    const input: Match[] = [
      match(4, 'p1', 'p2', 'p3', 'p4', 2, 2),
      match(2, 'p5', 'p6', 'p7', 'p8', 1, 2),
      match(1, 'p1', 'p2', 'p3', 'p4', 1, 1),
      match(3, 'p5', 'p6', 'p7', 'p8', 2, 1),
    ]
    const groups = groupMatchesBySet(input)
    expect(groups.map((g) => g.setNumber)).toEqual([1, 2])
    expect(groups[0].matches.map((m) => m.courtNumber)).toEqual([1, 2])
    expect(groups[1].matches.map((m) => m.courtNumber)).toEqual([1, 2])
  })

  it('1コート(コート情報なし)でも各セット1試合の塊になる', () => {
    const groups = groupMatchesBySet(matches)
    expect(groups.map((g) => g.setNumber)).toEqual([1, 2, 3])
    expect(groups.every((g) => g.matches.length === 1)).toBe(true)
  })
})
