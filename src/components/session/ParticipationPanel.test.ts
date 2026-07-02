import { describe, expect, it } from 'vitest'
import { resolveParticipationMode } from './ParticipationPanel'
import type { User } from '../../lib/types'

const user: User = { id: 'u1', name: '太郎', email: 't@example.com' }

describe('resolveParticipationMode', () => {
  it('未ログインは login', () => {
    expect(resolveParticipationMode(null)).toBe('login')
  })

  it('ログインしていれば join', () => {
    expect(resolveParticipationMode(user)).toBe('join')
  })
})
