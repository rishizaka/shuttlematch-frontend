import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MatchCard } from './MatchCard'
import { FREE_SLOT } from '../../lib/guests'
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
    // コンパクト表示ではコートは「2コ」の短縮ラベル。
    expect(
      screen.getByText((_, el) => el?.textContent === '2コ' && el?.tagName === 'SPAN'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('1番')).toHaveTextContent('1')
    expect(screen.getByLabelText('4番')).toHaveTextContent('4')
    expect(screen.getByLabelText('8番')).toHaveTextContent('8')
    expect(screen.getByLabelText('9番')).toHaveTextContent('9')
    expect(screen.queryByText('VS')).not.toBeInTheDocument()
  })

  it('名前が無ければツールチップは出ない(番号のみ運用)', () => {
    render(<MatchCard match={match} indexByParticipantId={indexes} />)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('名前があれば番号タップでツールチップに名前を表示する', () => {
    const names = new Map([['p1', 'たろう']])
    render(
      <MatchCard match={match} indexByParticipantId={indexes} nameByParticipantId={names} />,
    )
    // 初期はツールチップなし。
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    // 1番(p1)のチップをタップすると名前が出る。
    fireEvent.click(screen.getByLabelText('1番 たろう'))
    expect(screen.getByRole('tooltip')).toHaveTextContent('たろう')
  })

  it('番号が未指定のチップは ? を表示する', () => {
    render(<MatchCard match={match} />)
    expect(screen.getAllByText('?').length).toBe(4)
  })

  it('自分のチップをゴールドで強調表示する(コンパクトなので「あなた」バッジは出さない)', () => {
    render(
      <MatchCard
        match={match}
        indexByParticipantId={indexes}
        highlightParticipantId="p2"
      />,
    )
    // p2 は 4番。自分のチップはロゴのゴールド(accent)で塗られる。
    expect(screen.getByLabelText('4番').className).toContain('bg-accent-500')
    // 他のチップはゴールドにならない。
    expect(screen.getByLabelText('1番').className).not.toContain('bg-accent-500')
  })

  it('フリーの枠はティールで塗り、番号の下に「フリー」と表示する(タップ不要)', () => {
    const names = new Map([['p1', FREE_SLOT]])
    render(
      <MatchCard match={match} indexByParticipantId={indexes} nameByParticipantId={names} />,
    )
    expect(screen.getByLabelText('1番 フリー').className).toContain('border-teal-300')
    // 既に見えているので、タップして開くツールチップは無い(冗長になるため)。
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('1番 フリー'))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    // 他のチップには影響しない。
    expect(screen.getByLabelText('4番').className).not.toContain('border-teal-300')
  })

  it('フリーの枠が終了済みセットでは、色を落とした終了済み用の見た目になる', () => {
    const names = new Map([['p1', FREE_SLOT]])
    render(
      <MatchCard
        match={match}
        indexByParticipantId={indexes}
        nameByParticipantId={names}
        finished
      />,
    )
    expect(screen.getByLabelText('1番 フリー').className).toContain('border-teal-100')
  })
})
