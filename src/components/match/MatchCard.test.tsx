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

const indexes = new Map([
  ['p1', 1],
  ['p2', 4],
  ['p3', 8],
  ['p4', 9],
])

describe('MatchCard', () => {
  it('コート番号と4名の参加者番号を1行で表示する(ペア/vsは出さない)', () => {
    render(
      <MatchCard
        match={match}
        nameByParticipantId={names}
        indexByParticipantId={indexes}
      />,
    )
    expect(
      screen.getByText((_, el) => el?.textContent === '2コート' && el?.tagName === 'SPAN'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '太郎' })).toHaveTextContent('1')
    expect(screen.getByRole('button', { name: '次郎' })).toHaveTextContent('4')
    expect(screen.getByRole('button', { name: '三郎' })).toHaveTextContent('8')
    expect(screen.getByRole('button', { name: '花子' })).toHaveTextContent('9')
    expect(screen.queryByText('VS')).not.toBeInTheDocument()
  })

  it('ニックネームはツールチップとして描画される', () => {
    render(
      <MatchCard
        match={match}
        nameByParticipantId={names}
        indexByParticipantId={indexes}
      />,
    )
    const tooltips = screen.getAllByRole('tooltip')
    expect(tooltips.map((t) => t.textContent)).toEqual([
      '太郎',
      '次郎',
      '三郎',
      '花子',
    ])
  })

  it('名前が未解決の ParticipantId は短縮 ID で表示する', () => {
    render(<MatchCard match={match} nameByParticipantId={new Map()} />)
    // p1 などは 8 文字未満なのでそのまま表示される。
    expect(screen.getAllByText('p1').length).toBeGreaterThan(0)
  })

  it('自分のチップと「あなた」バッジを強調表示する', () => {
    render(
      <MatchCard
        match={match}
        nameByParticipantId={names}
        indexByParticipantId={indexes}
        highlightParticipantId="p2"
      />,
    )
    expect(screen.getByText('あなた')).toBeInTheDocument()
  })
})
