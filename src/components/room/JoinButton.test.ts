import { describe, expect, it } from 'vitest'
import { canJoin } from './JoinButton'
import type { Room } from '../../lib/types'

const base: Room = {
  id: 's1',
  shareCode: 'abcd1234',
  title: 'テスト',
  heldAt: '2026-06-30T10:00:00Z',
  location: null,
  capacity: null,
  courtCount: null,
  status: 'OPEN',
  createdBy: 'u1',
  participantCount: 0,
  participants: [],
  fixedPairs: [],
  quickCreated: false,
}

describe('canJoin', () => {
  it('準備中・受付中は参加できる', () => {
    expect(canJoin({ ...base, status: 'PREPARING' })).toBe(true)
    expect(canJoin({ ...base, status: 'OPEN' })).toBe(true)
  })

  it('試合生成済み・終了は参加できない', () => {
    expect(canJoin({ ...base, status: 'GENERATED' })).toBe(false)
    expect(canJoin({ ...base, status: 'CLOSED' })).toBe(false)
  })
})
