import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ParticipantList, canMakeFree, isFreeSlot } from './ParticipantList'
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

describe('isFreeSlot', () => {
  it('フリー枠(在席)には「解除」を出す', () => {
    expect(isFreeSlot(guest(FREE_SLOT))).toBe(true)
  })

  it('フリーでない枠には出さない', () => {
    expect(isFreeSlot(guest('1'))).toBe(false)
    expect(isFreeSlot(guest('田中'))).toBe(false)
    expect(isFreeSlot(guest(null))).toBe(false)
  })

  it('早退中のフリー枠には出さない(復帰してから解除する)', () => {
    expect(isFreeSlot(guest(FREE_SLOT, { status: 'LEFT' }))).toBe(false)
  })
})

describe('ParticipantList (削除ボタン)', () => {
  const participants: Participant[] = [
    guest('1', { id: 'p1' }),
    guest('2', { id: 'p2' }),
    guest('3', { id: 'p3' }),
  ]

  it('onlyLastRemovable が無ければ全行に削除ボタンを出す(生成前)', () => {
    render(<ParticipantList participants={participants} onRemove={() => {}} />)
    expect(screen.getByLabelText('1番を削除')).toBeInTheDocument()
    expect(screen.getByLabelText('2番を削除')).toBeInTheDocument()
    expect(screen.getByLabelText('3番を削除')).toBeInTheDocument()
  })

  it('onlyLastRemovable が true なら一番後ろの行にだけ削除ボタンを出す(生成後・末尾限定)', () => {
    render(
      <ParticipantList participants={participants} onRemove={() => {}} onlyLastRemovable />,
    )
    expect(screen.queryByLabelText('1番を削除')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('2番を削除')).not.toBeInTheDocument()
    expect(screen.getByLabelText('3番を削除')).toBeInTheDocument()
  })

  it('末尾の削除ボタンをクリックすると onRemove にその参加者が渡る', () => {
    const onRemove = vi.fn()
    render(
      <ParticipantList participants={participants} onRemove={onRemove} onlyLastRemovable />,
    )
    fireEvent.click(screen.getByLabelText('3番を削除'))
    expect(onRemove).toHaveBeenCalledWith(participants[2])
  })
})

describe('ParticipantList (複数選択モード)', () => {
  const participants: Participant[] = [
    guest('1', { id: 'p1' }),
    guest('2', { id: 'p2' }),
    guest('3', { id: 'p3', status: 'LEFT' }),
  ]

  it('選択モードでは個別の操作ボタンを隠し、在席者にだけチェックボックスを出す', () => {
    render(
      <ParticipantList
        participants={participants}
        onMarkLeft={() => {}}
        selecting
        selectedIds={new Set()}
        onToggleSelect={() => {}}
      />,
    )
    // 個別の早退ボタンは選択モード中は出ない。
    expect(screen.queryByText('早退', { selector: 'button *' })).not.toBeInTheDocument()
    // 早退中(3番)にもチェックボックスは出る(まとめて復帰にも使うため)。
    // まだ何も選んでいないので、在席・早退中のどちらも押せる。
    expect(screen.getByLabelText('1番を選択')).toBeInTheDocument()
    expect(screen.getByLabelText('2番を選択')).toBeInTheDocument()
    expect(screen.getByLabelText('3番を選択')).toBeInTheDocument()
    expect(screen.getByLabelText('3番を選択')).not.toBeDisabled()
  })

  it('在席者を1人選ぶと、早退中の行は選べなくなる(逆も同様)', () => {
    render(
      <ParticipantList
        participants={participants}
        selecting
        selectedIds={new Set(['p1'])}
        onToggleSelect={() => {}}
      />,
    )
    expect(screen.getByLabelText('2番を選択')).not.toBeDisabled()
    expect(screen.getByLabelText('3番を選択')).toBeDisabled()
  })

  it('早退中を1人選ぶと、在席者の行は選べなくなる', () => {
    render(
      <ParticipantList
        participants={participants}
        selecting
        selectedIds={new Set(['p3'])}
        onToggleSelect={() => {}}
      />,
    )
    expect(screen.getByLabelText('1番を選択')).toBeDisabled()
    expect(screen.getByLabelText('2番を選択')).toBeDisabled()
    expect(screen.getByLabelText('3番を選択')).not.toBeDisabled()
  })

  it('選択モードでないときは今まで通り個別ボタンを出し、チェックボックスは出ない', () => {
    render(<ParticipantList participants={participants} onMarkLeft={() => {}} />)
    expect(screen.getAllByRole('button', { name: /早退/ }).length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('1番を選択')).not.toBeInTheDocument()
  })

  it('チェックボックスをクリックすると onToggleSelect にその参加者が渡る', () => {
    const onToggleSelect = vi.fn()
    render(
      <ParticipantList
        participants={participants}
        selecting
        selectedIds={new Set()}
        onToggleSelect={onToggleSelect}
      />,
    )
    fireEvent.click(screen.getByLabelText('2番を選択'))
    expect(onToggleSelect).toHaveBeenCalledWith(participants[1])
  })

  it('selectedIds に含まれる参加者はチェック済みで表示する', () => {
    render(
      <ParticipantList
        participants={participants}
        selecting
        selectedIds={new Set(['p2'])}
        onToggleSelect={() => {}}
      />,
    )
    expect(screen.getByLabelText('1番を選択')).not.toBeChecked()
    expect(screen.getByLabelText('2番を選択')).toBeChecked()
  })
})
