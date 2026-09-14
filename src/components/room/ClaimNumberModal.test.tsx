import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ClaimNumberModal } from './ClaimNumberModal'
import type { Participant } from '../../lib/types'

const guest = (id: string, guestName: string | null, over: Partial<Participant> = {}): Participant => ({
  id,
  userId: null,
  guestName,
  guest: true,
  status: 'ACTIVE',
  ...over,
})

describe('ClaimNumberModal', () => {
  it('早退中の番号も選択肢に残す(試合表には見えているのに選べないと、復帰したい本人が名乗れなくなるため)', () => {
    const participants = [
      guest('p1', '1'),
      guest('p2', '2', { status: 'LEFT' }),
      guest('p3', '3'),
    ]
    render(
      <ClaimNumberModal
        participants={participants}
        pending={false}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    )
    const options = screen.getAllByRole('option').map((o) => o.textContent)
    expect(options).toContain('2番（早退中）')
  })

  it('他人の実名が付いている番号を選ぶと、早退中と名前を併記し、既に名前が付いている旨を出す(名簿は上書きしない)', () => {
    // まだ自分は誰も名乗っていない(myParticipantId 無し)状態で、実名入りの枠を選ぶ。
    const participants = [guest('p1', '田中', { status: 'LEFT' })]
    render(
      <ClaimNumberModal
        participants={participants}
        pending={false}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'p1' } })
    expect(screen.getByText('1番（早退中・田中）')).toBeInTheDocument()
    expect(screen.getByText(/「田中」さんの名前が付いています/)).toBeInTheDocument()
  })

  it('早退中の番号だけの枠は、選ぶと名前を入力できる(在席にするかどうかとは別)', () => {
    const onSubmit = vi.fn()
    const participants = [guest('p1', '2', { status: 'LEFT' })]
    render(
      <ClaimNumberModal
        participants={participants}
        myParticipantId="p1"
        pending={false}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText('あなたの名前（任意）'), {
      target: { value: 'たろう' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'この名前で参加' }))
    expect(onSubmit).toHaveBeenCalledWith('p1', 'たろう')
  })

  it('自分が今名乗っている番号は、実名入りでも名前欄を出し、今の名前を初期値にする(名前を変更)', () => {
    const participants = [guest('p1', 'たろう')]
    render(
      <ClaimNumberModal
        participants={participants}
        myParticipantId="p1"
        pending={false}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    )
    // 「実名が付いています」の案内文ではなく、現在の名前が入った入力欄が出る。
    expect(screen.queryByText(/さんの名前が付いています/)).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText('あなたの名前（任意）')).toHaveValue('たろう')
  })
})
