import { describe, expect, it } from 'vitest'
import { filterMatchesForParticipant } from './MatchScheduleList'
import { buildParticipantNameLookup } from './MatchCard'
import type { Match, Participant } from '../../lib/types'

const match = (n: number, a1: string, a2: string, b1: string, b2: string): Match => ({
  matchNumber: n,
  pairA: { player1Id: a1, player2Id: a2 },
  pairB: { player1Id: b1, player2Id: b2 },
  courtNumber: null,
})

const matches: Match[] = [
  match(1, 'p1', 'p2', 'p3', 'p4'),
  match(2, 'p5', 'p6', 'p1', 'p3'),
  match(3, 'p2', 'p4', 'p5', 'p6'),
]

describe('filterMatchesForParticipant', () => {
  it('participantId が null なら全試合を返す', () => {
    expect(filterMatchesForParticipant(matches, null)).toHaveLength(3)
  })

  it('指定した参加者が出場する試合だけを返す', () => {
    const result = filterMatchesForParticipant(matches, 'p1')
    expect(result.map((m) => m.matchNumber)).toEqual([1, 2])
  })

  it('どの試合にもいない参加者は空配列', () => {
    expect(filterMatchesForParticipant(matches, 'p99')).toEqual([])
  })
})

describe('buildParticipantNameLookup', () => {
  it('ParticipantId -> 表示名 のマップを作る (登録ユーザーとゲスト)', () => {
    const participants: Participant[] = [
      { id: 'p1', userId: 'u1', guestName: null, guest: false },
      { id: 'p2', userId: null, guestName: 'ゲスト花子', guest: true },
    ]
    const userNames = new Map([['u1', '太郎']])
    const lookup = buildParticipantNameLookup(participants, userNames)
    expect(lookup.get('p1')).toBe('太郎')
    expect(lookup.get('p2')).toBe('ゲスト花子')
  })
})
