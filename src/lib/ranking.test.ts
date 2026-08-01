import { describe, expect, it } from 'vitest'
import { canEnterRanking, rankForScore } from './ranking'
import type { RankingEntry } from './types'

const entries = (...scores: number[]): RankingEntry[] =>
  scores.map((score, i) => ({
    rank: i + 1,
    playerName: `P${i}`,
    score,
    recordedAt: '2026-08-01T00:00:00Z',
  }))

describe('rankForScore', () => {
  it('空のランキングには1位で入る', () => {
    expect(rankForScore([], 1)).toBe(1)
  })

  it('5件未満なら必ず入る', () => {
    expect(rankForScore(entries(90, 80), 10)).toBe(3)
  })

  it('満席なら5位を上回ったときだけ入る', () => {
    const full = entries(90, 80, 70, 60, 50)
    expect(rankForScore(full, 85)).toBe(2)
    expect(rankForScore(full, 51)).toBe(5)
    expect(rankForScore(full, 49)).toBeNull()
  })

  it('同点では入れない(先に記録した方が上位)', () => {
    expect(rankForScore(entries(90, 80, 70, 60, 50), 50)).toBeNull()
    expect(rankForScore(entries(90, 80), 80)).toBe(3)
  })
})

describe('canEnterRanking', () => {
  it('0点は名前入力を出さない', () => {
    expect(canEnterRanking([], 0)).toBe(false)
    expect(canEnterRanking([], 1)).toBe(true)
  })
})
