import { describe, expect, it } from 'vitest'
import { groupMatchesBySet } from './MatchScheduleList'
import { buildParticipantNameLookup } from './MatchCard'
import type { Match, Participant } from '../../lib/types'

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

describe('buildParticipantNameLookup', () => {
  it('ParticipantId -> 表示名 のマップを作る (登録ユーザーとゲスト)', () => {
    const participants: Participant[] = [
      { id: 'p1', userId: 'u1', guestName: null, guest: false, status: 'ACTIVE' },
      { id: 'p2', userId: null, guestName: 'ゲスト花子', guest: true, status: 'ACTIVE' },
    ]
    const userNames = new Map([['u1', '太郎']])
    const lookup = buildParticipantNameLookup(participants, userNames)
    expect(lookup.get('p1')).toBe('太郎')
    expect(lookup.get('p2')).toBe('ゲスト花子')
  })

  it('自己申告していないゲスト(名前が番号のまま)は「ゲスト」と表示する', () => {
    const participants: Participant[] = [
      { id: 'p1', userId: null, guestName: '1', guest: true, status: 'ACTIVE' },
      { id: 'p2', userId: null, guestName: '2', guest: true, status: 'ACTIVE' },
    ]
    const lookup = buildParticipantNameLookup(participants, new Map())
    expect(lookup.get('p1')).toBe('ゲスト')
    expect(lookup.get('p2')).toBe('ゲスト')
  })

  it('途中の参加者が削除されて位置がずれても、数字のままの名前は「ゲスト」と表示する', () => {
    // 4番を削除した後の一覧: 「5」という名前の参加者が4番目に来る。
    const participants: Participant[] = [
      { id: 'p1', userId: null, guestName: '1', guest: true, status: 'ACTIVE' },
      { id: 'p5', userId: null, guestName: '5', guest: true, status: 'ACTIVE' },
    ]
    const lookup = buildParticipantNameLookup(participants, new Map())
    expect(lookup.get('p5')).toBe('ゲスト')
  })
})
