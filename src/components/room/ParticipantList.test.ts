import { describe, expect, it } from 'vitest'
import { canMakeFree } from './ParticipantList'
import { FREE_SLOT } from '../../lib/guests'
import type { Participant } from '../../lib/types'

const guest = (guestName: string | null, over: Partial<Participant> = {}): Participant => ({
  id: 'p1',
  userId: null,
  guestName,
  guest: true,
  status: 'ACTIVE',
  ...over,
})

describe('canMakeFree', () => {
  it('人数を指定して作成した番号だけのゲストにも出す(在席のまま、再編成は不要)', () => {
    expect(canMakeFree(guest('1'))).toBe(true)
    expect(canMakeFree(guest('12'))).toBe(true)
    expect(canMakeFree(guest(null))).toBe(true)
    expect(canMakeFree(guest(' '))).toBe(true)
  })

  it('名前で参加している枠にも出す', () => {
    expect(canMakeFree(guest('田中'))).toBe(true)
    expect(canMakeFree(guest(null, { userId: 'u1', guest: false }))).toBe(true)
  })

  it('既にフリーの枠・早退者には出さない', () => {
    expect(canMakeFree(guest(FREE_SLOT))).toBe(false)
    expect(canMakeFree(guest('田中', { status: 'LEFT' }))).toBe(false)
    expect(canMakeFree(guest('1', { status: 'LEFT' }))).toBe(false)
  })
})
