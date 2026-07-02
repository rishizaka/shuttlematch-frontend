import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MatchCard } from './MatchCard'
import type { Match } from '../../lib/types'

const match: Match = {
  matchNumber: 3,
  setNumber: 2,
  pairA: { player1Id: 'p1', player2Id: 'p2' },
  pairB: { player1Id: 'p3', player2Id: 'p4' },
  courtNumber: 2,
  startedAt: null,
}

const names = new Map([
  ['p1', '太郎'],
  ['p2', '次郎'],
  ['p3', '三郎'],
  ['p4', '花子'],
])

describe('MatchCard', () => {
  it('コート番号・両ペアの名前を表示する', () => {
    render(<MatchCard match={match} nameByParticipantId={names} />)
    expect(screen.getByText('2 コート')).toBeInTheDocument()
    expect(screen.getByText('太郎')).toBeInTheDocument()
    expect(screen.getByText('花子')).toBeInTheDocument()
    expect(screen.getByText('VS')).toBeInTheDocument()
  })

  it('名前が未解決の ParticipantId は短縮 ID で表示する', () => {
    render(<MatchCard match={match} nameByParticipantId={new Map()} />)
    // p1 などは 8 文字未満なのでそのまま表示される。
    expect(screen.getAllByText('p1').length).toBeGreaterThan(0)
  })
})
