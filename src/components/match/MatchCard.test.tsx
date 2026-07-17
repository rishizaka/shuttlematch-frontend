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

const indexes = new Map([
  ['p1', 1],
  ['p2', 4],
  ['p3', 8],
  ['p4', 9],
])

describe('MatchCard', () => {
  it('コート番号と4名の参加者番号を1行で表示する(ペア/vsは出さない)', () => {
    render(<MatchCard match={match} indexByParticipantId={indexes} />)
    expect(
      screen.getByText((_, el) => el?.textContent === '2コート' && el?.tagName === 'SPAN'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('1番')).toHaveTextContent('1')
    expect(screen.getByLabelText('4番')).toHaveTextContent('4')
    expect(screen.getByLabelText('8番')).toHaveTextContent('8')
    expect(screen.getByLabelText('9番')).toHaveTextContent('9')
    expect(screen.queryByText('VS')).not.toBeInTheDocument()
  })

  it('名前(ニックネーム)は表示せず、番号だけで運用する', () => {
    render(<MatchCard match={match} indexByParticipantId={indexes} />)
    // 番号のみ。名前のツールチップは描画されない。
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('番号が未指定のチップは ? を表示する', () => {
    render(<MatchCard match={match} />)
    expect(screen.getAllByText('?').length).toBe(4)
  })

  it('自分のチップと「あなた」バッジを強調表示する', () => {
    render(
      <MatchCard
        match={match}
        indexByParticipantId={indexes}
        highlightParticipantId="p2"
      />,
    )
    expect(screen.getByText('あなた')).toBeInTheDocument()
  })
})
