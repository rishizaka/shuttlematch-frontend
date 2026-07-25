import { describe, expect, it } from 'vitest'
import { FREE_SLOT, isClaimableSlot, VISITOR_PLACEHOLDER } from './guests'

describe('isClaimableSlot', () => {
  it('名前なし・番号だけの枠は名前を付けてよい', () => {
    expect(isClaimableSlot(null)).toBe(true)
    expect(isClaimableSlot(undefined)).toBe(true)
    expect(isClaimableSlot('')).toBe(true)
    expect(isClaimableSlot('7')).toBe(true)
    expect(isClaimableSlot(' 12 ')).toBe(true)
  })

  it('運営者が用意した予約枠・フリー枠は名前を付けてよい', () => {
    expect(isClaimableSlot(VISITOR_PLACEHOLDER)).toBe(true)
    expect(isClaimableSlot(FREE_SLOT)).toBe(true)
  })

  it('実名入りの枠は名簿を上書きしない(紐付けのみ)', () => {
    expect(isClaimableSlot('たろう')).toBe(false)
    expect(isClaimableSlot('ゲスト')).toBe(false)
  })
})
