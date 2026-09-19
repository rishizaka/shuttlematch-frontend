import { describe, expect, it } from 'vitest'
import { FREE_SLOT, displayGuestName, isClaimableSlot, VISITOR_PLACEHOLDER } from './guests'

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

describe('displayGuestName', () => {
  it('番号のまま(まだ誰も名乗っていない)なら「空き」と表示する', () => {
    expect(displayGuestName(null)).toBe('空き')
    expect(displayGuestName(undefined)).toBe('空き')
    expect(displayGuestName('')).toBe('空き')
    expect(displayGuestName('7')).toBe('空き')
    expect(displayGuestName(' 12 ')).toBe('空き')
  })

  it('名前を空欄で「参加する」を押した実際の「ゲスト」は、空きと区別してそのまま出す', () => {
    // 未クレームの番号(→「空き」)と紛れないよう、guestName="ゲスト" は素通しする。
    expect(displayGuestName('ゲスト')).toBe('ゲスト')
  })

  it('実名・フリー・遅刻者ビジターはそのまま出す', () => {
    expect(displayGuestName('たろう')).toBe('たろう')
    expect(displayGuestName(FREE_SLOT)).toBe(FREE_SLOT)
    expect(displayGuestName(VISITOR_PLACEHOLDER)).toBe(VISITOR_PLACEHOLDER)
  })
})
